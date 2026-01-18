import { useState, useEffect, useMemo } from 'react';
import { Edit2, Phone, Clock, Monitor, MapPin, Calendar, XCircle, AlertTriangle, Check, Loader2, Banknote, RotateCcw, History, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogBody,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Student, SessionType, CancellationPolicy, AppSettings } from '@/types/student';
import { DAY_NAMES_AR, formatDurationAr, calculateEndTime } from '@/lib/arabicConstants';
import { useConflictDetection, formatTimeAr, ConflictResult } from '@/hooks/useConflictDetection';
import { generateSessionsForSchedule } from '@/lib/dateUtils';
import { DURATION_OPTIONS, DEFAULT_DURATION } from '@/types/student';
import { CancellationPolicySettings } from '@/components/CancellationPolicySettings';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface CancellationRecord {
  id: string;
  studentId: string;
  sessionDate: string;
  sessionTime?: string;
  reason?: string;
  cancelledAt: string;
  month: string;
}

interface EditStudentDialogProps {
  student: Student;
  students?: Student[];
  appSettings?: AppSettings;
  currentCancellationCount?: number;
  allCancellations?: CancellationRecord[];
  onRestoreSession?: (studentId: string, sessionId: string) => void;
  onClearMonthCancellations?: (studentId: string, month: string) => Promise<boolean>;
  onUpdateName: (name: string) => void;
  onUpdateTime: (time: string) => void;
  onUpdatePhone: (phone: string) => void;
  onUpdateParentPhone?: (parentPhone: string) => void;
  onUpdateSessionType: (type: SessionType) => void;
  onUpdateSchedule: (days: number[], start?: string, end?: string) => void;
  onUpdateDuration?: (duration: number) => void;
  onUpdateCustomSettings?: (settings: {
    useCustomSettings?: boolean;
    sessionDuration?: number;
    customPriceOnsite?: number;
    customPriceOnline?: number;
  }) => void;
  onUpdateCancellationPolicy?: (policy: CancellationPolicy) => void;
}

export const EditStudentDialog = ({
  student,
  students = [],
  appSettings,
  currentCancellationCount = 0,
  allCancellations = [],
  onRestoreSession,
  onClearMonthCancellations,
  onUpdateName,
  onUpdateTime,
  onUpdatePhone,
  onUpdateParentPhone,
  onUpdateSessionType,
  onUpdateSchedule,
  onUpdateDuration,
  onUpdateCustomSettings,
  onUpdateCancellationPolicy,
}: EditStudentDialogProps) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(student.name);
  const [phone, setPhone] = useState(student.phone || '');
  const [parentPhone, setParentPhone] = useState(student.parentPhone || '');
  const [sessionTime, setSessionTime] = useState(student.sessionTime || '16:00');
  const [sessionType, setSessionType] = useState<SessionType>(student.sessionType || 'onsite');
  const [sessionDuration, setSessionDuration] = useState<number>(student.sessionDuration || DEFAULT_DURATION);
  const [selectedDays, setSelectedDays] = useState<number[]>(
    student.scheduleDays.map(d => d.dayOfWeek)
  );
  
  // Custom settings state
  const [useCustomSettings, setUseCustomSettings] = useState(student.useCustomSettings || false);
  const [customPriceOnsite, setCustomPriceOnsite] = useState<string>(student.customPriceOnsite?.toString() || '');
  const [customPriceOnline, setCustomPriceOnline] = useState<string>(student.customPriceOnline?.toString() || '');

  // Effective pricing (for display)
  const defaultPriceOnsite = appSettings?.defaultPriceOnsite ?? 150;
  const defaultPriceOnline = appSettings?.defaultPriceOnline ?? 120;

  const customOnsiteNum = Number(customPriceOnsite);
  const customOnlineNum = Number(customPriceOnline);

  const hasCustomOnsite = useCustomSettings && Number.isFinite(customOnsiteNum) && customOnsiteNum > 0;
  const hasCustomOnline = useCustomSettings && Number.isFinite(customOnlineNum) && customOnlineNum > 0;

  const effectivePriceOnsite = hasCustomOnsite ? customOnsiteNum : defaultPriceOnsite;
  const effectivePriceOnline = hasCustomOnline ? customOnlineNum : defaultPriceOnline;
  
  // Conflict detection state
  const [isChecking, setIsChecking] = useState(false);
  const [conflictResults, setConflictResults] = useState<Map<string, ConflictResult>>(new Map());
  const [showWarningDialog, setShowWarningDialog] = useState(false);
  
  const { checkConflict } = useConflictDetection(students);

  // Check conflicts when time or days change (debounced)
  useEffect(() => {
    if (!open || selectedDays.length === 0) {
      setConflictResults(new Map());
      return;
    }
    
    // Only check if time changed
    if (sessionTime === student.sessionTime) {
      setConflictResults(new Map());
      return;
    }
    
    setIsChecking(true);
    const timer = setTimeout(() => {
      // Get this student's session IDs to exclude from conflict check
      const studentSessionIds = new Set(student.sessions.map(s => s.id));
      
      // Check conflicts for each of the student's existing sessions
      const results = new Map<string, ConflictResult>();
      
      student.sessions.forEach(session => {
        // Only check scheduled/vacation sessions
        if (session.status === 'cancelled' || session.status === 'completed') return;
        
        const result = checkConflict(
          { date: session.date, startTime: sessionTime },
          session.id // Exclude this session from check
        );
        
        if (result.severity !== 'none') {
          results.set(session.date, result);
        }
      });
      
      setConflictResults(results);
      setIsChecking(false);
    }, 300); // 300ms debounce
    
    return () => clearTimeout(timer);
  }, [open, sessionTime, selectedDays, student, checkConflict]);

  // Summarize conflicts
  const conflictSummary = useMemo(() => {
    let errorCount = 0;
    let warningCount = 0;
    const conflictingStudents = new Set<string>();
    
    conflictResults.forEach((result) => {
      if (result.severity === 'error') {
        errorCount++;
        result.conflicts.forEach(c => conflictingStudents.add(c.student.name));
      } else if (result.severity === 'warning') {
        warningCount++;
        result.conflicts.forEach(c => conflictingStudents.add(c.student.name));
      }
    });
    
    return {
      errorCount,
      warningCount,
      conflictingStudents: Array.from(conflictingStudents),
      hasErrors: errorCount > 0,
      hasWarnings: warningCount > 0,
    };
  }, [conflictResults]);

  const handleSave = () => {
    // If there are error conflicts when time changed, block
    if (sessionTime !== student.sessionTime && conflictSummary.hasErrors) {
      return;
    }
    
    // If there are warnings when time changed, show confirmation
    if (sessionTime !== student.sessionTime && conflictSummary.hasWarnings) {
      setShowWarningDialog(true);
      return;
    }
    
    proceedWithSave();
  };
  
  const proceedWithSave = () => {
    if (name.trim() !== student.name) {
      onUpdateName(name.trim());
    }
    if (phone !== (student.phone || '')) {
      onUpdatePhone(phone);
    }
    if (parentPhone !== (student.parentPhone || '')) {
      onUpdateParentPhone?.(parentPhone);
    }
    if (sessionTime !== student.sessionTime) {
      onUpdateTime(sessionTime);
    }
    if (sessionType !== student.sessionType) {
      onUpdateSessionType(sessionType);
    }
    if (sessionDuration !== (student.sessionDuration || DEFAULT_DURATION)) {
      onUpdateDuration?.(sessionDuration);
    }
    
    // Update custom settings
    const hasCustomSettingsChange = 
      useCustomSettings !== (student.useCustomSettings || false) ||
      (useCustomSettings && (
        parseFloat(customPriceOnsite || '0') !== (student.customPriceOnsite || 0) ||
        parseFloat(customPriceOnline || '0') !== (student.customPriceOnline || 0)
      ));
    
    if (hasCustomSettingsChange) {
      onUpdateCustomSettings?.({
        useCustomSettings,
        sessionDuration,
        customPriceOnsite: useCustomSettings && customPriceOnsite ? parseFloat(customPriceOnsite) : undefined,
        customPriceOnline: useCustomSettings && customPriceOnline ? parseFloat(customPriceOnline) : undefined,
      });
    }
    
    const currentDays = student.scheduleDays.map(d => d.dayOfWeek).sort().join(',');
    const newDays = selectedDays.sort().join(',');
    if (currentDays !== newDays && selectedDays.length > 0) {
      onUpdateSchedule(selectedDays);
    }
    
    setOpen(false);
    setShowWarningDialog(false);
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      // Reset to current values when opening
      setName(student.name);
      setPhone(student.phone || '');
      setParentPhone(student.parentPhone || '');
      setSessionTime(student.sessionTime || '16:00');
      setSessionType(student.sessionType || 'onsite');
      setSessionDuration(student.sessionDuration || DEFAULT_DURATION);
      setSelectedDays(student.scheduleDays.map(d => d.dayOfWeek));
      setUseCustomSettings(student.useCustomSettings || false);
      setCustomPriceOnsite(student.customPriceOnsite?.toString() || '');
      setCustomPriceOnline(student.customPriceOnline?.toString() || '');
      setConflictResults(new Map());
    }
    setOpen(isOpen);
  };

  const toggleDay = (day: number) => {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };
  
  const timeChanged = sessionTime !== student.sessionTime;

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0">
            <Edit2 className="h-3.5 w-3.5" />
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col" dir="rtl">
          <DialogHeader>
            <DialogTitle className="font-heading">تعديل بيانات الطالب</DialogTitle>
          </DialogHeader>
          
          <DialogBody>
            <div className="space-y-4 py-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="edit-name">اسم الطالب</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="اسم الطالب"
              />
            </div>

            {/* Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-phone" className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" />
                  رقم الطالب (واتساب)
                </Label>
                <Input
                  id="edit-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+966xxxxxxxxx"
                  dir="ltr"
                  className="text-right"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-parent-phone" className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" />
                  رقم ولي الأمر (واتساب)
                </Label>
                <Input
                  id="edit-parent-phone"
                  type="tel"
                  value={parentPhone}
                  onChange={(e) => setParentPhone(e.target.value)}
                  placeholder="+966xxxxxxxxx"
                  dir="ltr"
                  className="text-right"
                />
              </div>
            </div>

            {/* Session Time */}
            <div className="space-y-2">
              <Label htmlFor="edit-time" className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                وقت الحصة
              </Label>
              <div className="relative">
                <Input
                  id="edit-time"
                  type="time"
                  value={sessionTime}
                  onChange={(e) => setSessionTime(e.target.value)}
                  className={`w-32 ${timeChanged && conflictSummary.hasErrors ? 'border-destructive' : ''}`}
                />
                {isChecking && (
                  <div className="absolute left-2 top-1/2 -translate-y-1/2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>
              
              {/* End time display */}
              <div className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded">
                وقت النهاية: {calculateEndTime(sessionTime, sessionDuration).endTime}
                {calculateEndTime(sessionTime, sessionDuration).crossesMidnight && (
                  <span className="text-destructive mr-1">(الغد)</span>
                )}
              </div>
            </div>
            
            {/* Session Duration */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                مدة الحصة
              </Label>
              <Select value={sessionDuration.toString()} onValueChange={(v) => setSessionDuration(Number(v))}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DURATION_OPTIONS.map((d) => (
                    <SelectItem key={d} value={d.toString()}>
                      {formatDurationAr(d)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Conflict Warning Box */}
            {timeChanged && !isChecking && conflictSummary.hasErrors && (
              <div className="p-3 rounded-lg bg-destructive/10 border-2 border-destructive">
                <div className="flex items-start gap-2">
                  <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold text-destructive text-sm">
                      ❌ تعارض مع {conflictSummary.errorCount} جلسة
                    </p>
                    <p className="text-xs text-destructive/80">
                      وقت {formatTimeAr(sessionTime)} يتعارض مع: {conflictSummary.conflictingStudents.slice(0, 3).join('، ')}
                      {conflictSummary.conflictingStudents.length > 3 && ` (+${conflictSummary.conflictingStudents.length - 3})`}
                    </p>
                    <p className="text-xs text-destructive/70">
                      الرجاء اختيار وقت مختلف
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {timeChanged && !isChecking && !conflictSummary.hasErrors && conflictSummary.hasWarnings && (
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border-2 border-amber-500">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold text-amber-700 dark:text-amber-400 text-sm">
                      ⚠️ قريب من {conflictSummary.warningCount} جلسة
                    </p>
                    <p className="text-xs text-amber-600 dark:text-amber-500">
                      فاصل أقل من 30 دقيقة مع: {conflictSummary.conflictingStudents.slice(0, 3).join('، ')}
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {timeChanged && !isChecking && !conflictSummary.hasErrors && !conflictSummary.hasWarnings && (
              <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-500">
                <Check className="h-4 w-4" />
                <span>✓ الوقت متاح</span>
              </div>
            )}

            {/* Session Type */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                {sessionType === 'online' ? <Monitor className="h-3.5 w-3.5" /> : <MapPin className="h-3.5 w-3.5" />}
                نوع الحصة
              </Label>
              <Select value={sessionType} onValueChange={(v) => setSessionType(v as SessionType)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="onsite">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      حضوري
                    </div>
                  </SelectItem>
                  <SelectItem value="online">
                    <div className="flex items-center gap-2">
                      <Monitor className="h-4 w-4" />
                      أونلاين
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Schedule Days */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                أيام الحصص
              </Label>
              <div className="flex flex-wrap gap-2">
                {[0, 1, 2, 3, 4, 5, 6].map(day => (
                  <label
                    key={day}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                      selectedDays.includes(day)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-card border-border hover:border-primary/50'
                    }`}
                  >
                    <Checkbox
                      checked={selectedDays.includes(day)}
                      onCheckedChange={() => toggleDay(day)}
                      className="hidden"
                    />
                    <span className="text-sm">{DAY_NAMES_AR[day]}</span>
                  </label>
                ))}
              </div>
              {selectedDays.length === 0 && (
                <p className="text-xs text-destructive">يجب اختيار يوم واحد على الأقل</p>
              )}
            </div>

            {/* Custom Pricing Settings */}
            <div className="space-y-3 pt-2 border-t">
              <div className="rounded-lg border bg-muted/30 p-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-muted-foreground" />
                    حضوري
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="font-medium">{effectivePriceOnsite} جنيه</span>
                    <Badge variant={hasCustomOnsite ? 'secondary' : 'outline'} className="text-[10px]">
                      {hasCustomOnsite ? 'مخصص' : 'افتراضي'}
                    </Badge>
                  </span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="flex items-center gap-1">
                    <Monitor className="h-3 w-3 text-muted-foreground" />
                    أونلاين
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="font-medium">{effectivePriceOnline} جنيه</span>
                    <Badge variant={hasCustomOnline ? 'secondary' : 'outline'} className="text-[10px]">
                      {hasCustomOnline ? 'مخصص' : 'افتراضي'}
                    </Badge>
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="use-custom"
                  checked={useCustomSettings}
                  onCheckedChange={(checked) => setUseCustomSettings(checked === true)}
                />
                <Label htmlFor="use-custom" className="text-sm cursor-pointer flex items-center gap-1.5">
                  <Banknote className="h-3.5 w-3.5" />
                  أسعار مخصصة لهذا الطالب
                </Label>
              </div>
              
              {useCustomSettings && (
                <div className="grid grid-cols-2 gap-3 pr-6">
                  <div className="space-y-1">
                    <Label htmlFor="custom-price-onsite" className="text-xs flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      حضوري
                    </Label>
                    <div className="relative">
                      <Input
                        id="custom-price-onsite"
                        type="number"
                        min="0"
                        step="0.5"
                        value={customPriceOnsite}
                        onChange={(e) => setCustomPriceOnsite(e.target.value)}
                        placeholder="100"
                        className="pl-10 h-9"
                      />
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                        جنيه
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="custom-price-online" className="text-xs flex items-center gap-1">
                      <Monitor className="h-3 w-3" />
                      أونلاين
                    </Label>
                    <div className="relative">
                      <Input
                        id="custom-price-online"
                        type="number"
                        min="0"
                        step="0.5"
                        value={customPriceOnline}
                        onChange={(e) => setCustomPriceOnline(e.target.value)}
                        placeholder="80"
                        className="pl-10 h-9"
                      />
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                        جنيه
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Cancellation Policy Section */}
            {onUpdateCancellationPolicy && (
              <CancellationPolicySettings
                student={student}
                currentCount={currentCancellationCount}
                onSave={onUpdateCancellationPolicy}
              />
            )}

            {/* Cancellation History Section */}
            {allCancellations.length > 0 && (
              <CancellationHistorySection
                student={student}
                cancellations={allCancellations}
                onRestore={onRestoreSession}
                onClearMonth={onClearMonthCancellations}
              />
            )}
            </div>
          </DialogBody>

          <DialogFooter className="flex-col sm:flex-row-reverse gap-2">
            <Button
              onClick={handleSave} 
              disabled={!name.trim() || selectedDays.length === 0 || (timeChanged && conflictSummary.hasErrors) || isChecking}
              className="w-full sm:w-auto"
            >
              {isChecking ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin ml-2" />
                  جاري التحقق...
                </>
              ) : (
                'حفظ التعديلات'
              )}
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)} className="w-full sm:w-auto">
              إلغاء
            </Button>
          </DialogFooter>

          {/* Warning Confirmation Dialog */}
      <AlertDialog open={showWarningDialog} onOpenChange={setShowWarningDialog}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              تحذير: جلسات قريبة جداً
            </AlertDialogTitle>
            <AlertDialogDescription className="text-right space-y-2">
              <p>
                تغيير الوقت إلى {formatTimeAr(sessionTime)} سيجعل {conflictSummary.warningCount} جلسة بفاصل أقل من 30 دقيقة.
              </p>
              <p className="text-muted-foreground text-sm">
                الطلاب المتأثرون: {conflictSummary.conflictingStudents.join('، ')}
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={proceedWithSave}
              className="bg-amber-500 hover:bg-amber-600"
            >
              نعم، احفظ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
        </DialogContent>
      </Dialog>
      
      {/* Warning Confirmation Dialog */}
      <AlertDialog open={showWarningDialog} onOpenChange={setShowWarningDialog}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              تحذير: جلسات قريبة جداً
            </AlertDialogTitle>
            <AlertDialogDescription className="text-right space-y-2">
              <p>
                تغيير الوقت إلى {formatTimeAr(sessionTime)} سيجعل {conflictSummary.warningCount} جلسة بفاصل أقل من 30 دقيقة.
              </p>
              <p className="text-muted-foreground text-sm">
                الطلاب المتأثرون: {conflictSummary.conflictingStudents.join('، ')}
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction 
              onClick={proceedWithSave}
              className="bg-amber-500 hover:bg-amber-600"
            >
              نعم، احفظ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

// Cancellation History Section Component
const CancellationHistorySection = ({
  student,
  cancellations,
  onRestore,
  onClearMonth,
}: {
  student: Student;
  cancellations: CancellationRecord[];
  onRestore?: (studentId: string, sessionId: string) => void;
  onClearMonth?: (studentId: string, month: string) => Promise<boolean>;
}) => {
  const [clearingMonth, setClearingMonth] = useState<string | null>(null);
  const [confirmClearMonth, setConfirmClearMonth] = useState<string | null>(null);

  // Group cancellations by month
  const groupedByMonth = useMemo(() => {
    const groups: Record<string, CancellationRecord[]> = {};
    cancellations.forEach((c) => {
      if (!groups[c.month]) {
        groups[c.month] = [];
      }
      groups[c.month].push(c);
    });
    // Sort months descending (newest first)
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [cancellations]);

  const formatMonthLabel = (monthStr: string) => {
    try {
      const [year, month] = monthStr.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1, 1);
      return format(date, 'MMMM yyyy', { locale: ar });
    } catch {
      return monthStr;
    }
  };

  const formatSessionDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return format(date, 'EEEE d MMMM', { locale: ar });
    } catch {
      return dateStr;
    }
  };

  const handleRestore = (cancellation: CancellationRecord) => {
    // Find the session by date
    const session = student.sessions.find(
      (s) => s.date === cancellation.sessionDate && s.status === 'cancelled'
    );
    if (session && onRestore) {
      onRestore(student.id, session.id);
    }
  };

  const handleClearMonth = async (month: string) => {
    if (!onClearMonth) return;
    setClearingMonth(month);
    setConfirmClearMonth(null);
    try {
      await onClearMonth(student.id, month);
    } finally {
      setClearingMonth(null);
    }
  };

  const canRestore = (cancellation: CancellationRecord) => {
    return student.sessions.some(
      (s) => s.date === cancellation.sessionDate && s.status === 'cancelled'
    );
  };

  if (groupedByMonth.length === 0) return null;

  return (
    <div className="space-y-3 p-4 rounded-lg border bg-card" dir="rtl">
      <div className="flex items-center gap-2 text-sm font-medium">
        <History className="h-4 w-4 text-muted-foreground" />
        <span>سجل الإلغاءات</span>
        <Badge variant="secondary" className="text-xs">
          {cancellations.length}
        </Badge>
      </div>

      <div className="space-y-4 max-h-60 overflow-y-auto">
        {groupedByMonth.map(([month, monthCancellations]) => (
          <div key={month} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  {formatMonthLabel(month)}
                </span>
                <Badge
                  variant="outline"
                  className={cn(
                    'text-xs',
                    monthCancellations.length >= (student.cancellationPolicy?.monthlyLimit ?? 3)
                      ? 'border-destructive text-destructive'
                      : ''
                  )}
                >
                  {monthCancellations.length} / {student.cancellationPolicy?.monthlyLimit ?? 3}
                </Badge>
              </div>
              {onClearMonth && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 gap-1 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => setConfirmClearMonth(month)}
                  disabled={clearingMonth === month}
                >
                  {clearingMonth === month ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Trash2 className="h-3 w-3" />
                  )}
                  تصفير
                </Button>
              )}
            </div>

            <div className="space-y-1.5">
              {monthCancellations
                .sort((a, b) => b.sessionDate.localeCompare(a.sessionDate))
                .map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between p-2 rounded-md bg-muted/50 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-xs">
                        {formatSessionDate(c.sessionDate)}
                      </p>
                      {c.reason && (
                        <p className="text-xs text-muted-foreground truncate">
                          {c.reason}
                        </p>
                      )}
                    </div>
                    {canRestore(c) && onRestore && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 gap-1 text-xs shrink-0"
                        onClick={() => handleRestore(c)}
                      >
                        <RotateCcw className="h-3 w-3" />
                        استعادة
                      </Button>
                    )}
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>

      {/* Confirmation Dialog for Clearing Month */}
      <AlertDialog open={!!confirmClearMonth} onOpenChange={(open) => !open && setConfirmClearMonth(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              تأكيد تصفير الإلغاءات
            </AlertDialogTitle>
            <AlertDialogDescription className="text-right">
              سيتم حذف جميع سجلات الإلغاء لشهر {confirmClearMonth ? formatMonthLabel(confirmClearMonth) : ''} نهائياً.
              <br />
              <span className="text-destructive font-medium">هذا الإجراء لا يمكن التراجع عنه.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmClearMonth && handleClearMonth(confirmClearMonth)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              تصفير
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
