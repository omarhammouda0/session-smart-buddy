import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { UserPlus, ChevronDown, ChevronUp, Clock, Monitor, MapPin, Phone, XCircle, AlertTriangle, Check, Loader2, DollarSign, Sparkles, Sunrise, Sun, Moon } from 'lucide-react';
import { SessionType, Student, DEFAULT_DURATION, StudentMaterial, AppSettings } from '@/types/student';
import { DAY_NAMES_AR } from '@/lib/arabicConstants';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { generateSessionsForSchedule } from '@/lib/dateUtils';
import { useConflictDetection, formatTimeAr, ConflictResult } from '@/hooks/useConflictDetection';
import { DurationPicker } from '@/components/DurationPicker';
import { StudentMaterialsSection } from '@/components/StudentMaterialsSection';
import { cn } from '@/lib/utils';
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

interface AddStudentDialogProps {
  onAdd: (name: string, scheduleDays: number[], sessionTime: string, sessionType: SessionType, phone?: string, parentPhone?: string, customStart?: string, customEnd?: string, sessionDuration?: number, materials?: StudentMaterial[], useCustomPrices?: boolean, customPriceOnsite?: number, customPriceOnline?: number) => void;
  defaultStart: string;
  defaultEnd: string;
  students?: Student[];
  settings?: AppSettings;
  defaultDuration?: number;
  defaultPriceOnsite?: number;
  defaultPriceOnline?: number;
}

export const AddStudentDialog = ({ onAdd, defaultStart, defaultEnd, students = [], settings, defaultDuration = DEFAULT_DURATION, defaultPriceOnsite = 150, defaultPriceOnline = 120 }: AddStudentDialogProps) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [sessionTime, setSessionTime] = useState('');
  const [sessionDuration, setSessionDuration] = useState<number>(60); // Default to 1 hour
  const [sessionType, setSessionType] = useState<SessionType | null>(null);
  const [showCustomDates, setShowCustomDates] = useState(false);
  const [customStart, setCustomStart] = useState(defaultStart);
  const [customEnd, setCustomEnd] = useState(defaultEnd);
  const [materials, setMaterials] = useState<StudentMaterial[]>([]);

  // Custom pricing state
  const [useCustomPrices, setUseCustomPrices] = useState(false);
  const [customPriceOnsite, setCustomPriceOnsite] = useState<number>(defaultPriceOnsite);
  const [customPriceOnline, setCustomPriceOnline] = useState<number>(defaultPriceOnline);

  // Conflict detection state
  const [isChecking, setIsChecking] = useState(false);
  const [conflictResults, setConflictResults] = useState<Map<string, ConflictResult>>(new Map());
  const [showWarningDialog, setShowWarningDialog] = useState(false);
  
  const { checkConflict } = useConflictDetection(students);

  // Check conflicts when time or days change (debounced)
  useEffect(() => {
    if (!open || selectedDays.length === 0 || !sessionTime) {
      setConflictResults(new Map());
      return;
    }
    
    setIsChecking(true);
    const timer = setTimeout(() => {
      const semesterStart = showCustomDates ? customStart : defaultStart;
      const semesterEnd = showCustomDates ? customEnd : defaultEnd;
      
      // Generate session dates for selected days
      const sessionDates = generateSessionsForSchedule(selectedDays, semesterStart, semesterEnd);
      
      // Check conflicts for each date
      const results = new Map<string, ConflictResult>();
      let hasError = false;
      let hasWarning = false;
      
      sessionDates.forEach(date => {
        const result = checkConflict({ date, startTime: sessionTime });
        if (result.severity !== 'none') {
          results.set(date, result);
          if (result.severity === 'error') hasError = true;
          if (result.severity === 'warning') hasWarning = true;
        }
      });
      
      setConflictResults(results);
      setIsChecking(false);
    }, 300); // 300ms debounce
    
    return () => clearTimeout(timer);
  }, [open, sessionTime, selectedDays, showCustomDates, customStart, customEnd, defaultStart, defaultEnd, checkConflict]);

  // Summarize conflicts
  const conflictSummary = useMemo(() => {
    let errorCount = 0;
    let warningCount = 0;
    const errorDates: string[] = [];
    const warningDates: string[] = [];
    const conflictingStudents = new Set<string>();
    
    conflictResults.forEach((result, date) => {
      if (result.severity === 'error') {
        errorCount++;
        errorDates.push(date);
        result.conflicts.forEach(c => conflictingStudents.add(c.student.name));
      } else if (result.severity === 'warning') {
        warningCount++;
        warningDates.push(date);
        result.conflicts.forEach(c => conflictingStudents.add(c.student.name));
      }
    });
    
    return {
      errorCount,
      warningCount,
      errorDates,
      warningDates,
      conflictingStudents: Array.from(conflictingStudents),
      hasErrors: errorCount > 0,
      hasWarnings: warningCount > 0,
    };
  }, [conflictResults]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || selectedDays.length === 0 || !sessionTime || !sessionDuration || !sessionType) return;
    
    // If there are error conflicts, block submission
    if (conflictSummary.hasErrors) {
      return;
    }
    
    // If there are warnings, show confirmation dialog
    if (conflictSummary.hasWarnings) {
      setShowWarningDialog(true);
      return;
    }
    
    // No conflicts - proceed
    proceedWithAdd();
  };
  
  const proceedWithAdd = () => {
    if (!sessionType || !sessionDuration || !sessionTime) return;
    const useCustom = showCustomDates && (customStart !== defaultStart || customEnd !== defaultEnd);
    onAdd(
      name.trim(),
      selectedDays,
      sessionTime,
      sessionType,
      phone.trim() || undefined,
      parentPhone.trim() || undefined,
      useCustom ? customStart : undefined,
      useCustom ? customEnd : undefined,
      sessionDuration,
      materials.length > 0 ? materials : undefined,
      useCustomPrices || undefined,
      useCustomPrices ? customPriceOnsite : undefined,
      useCustomPrices ? customPriceOnline : undefined
    );
    resetForm();
    setOpen(false);
    setShowWarningDialog(false);
  };

  const resetForm = () => {
    setName('');
    setPhone('');
    setParentPhone('');
    setSelectedDays([]);
    setSessionTime('');
    setSessionDuration(60); // Reset to default 1 hour
    setSessionType(null);
    setShowCustomDates(false);
    setCustomStart(defaultStart);
    setCustomEnd(defaultEnd);
    setConflictResults(new Map());
    setMaterials([]);
    setUseCustomPrices(false);
    setCustomPriceOnsite(defaultPriceOnsite);
    setCustomPriceOnline(defaultPriceOnline);
  };

  const toggleDay = (day: number) => {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort()
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
        <DialogTrigger asChild>
          <Button className="gradient-primary gap-2 shadow-lg hover:shadow-xl transition-shadow">
            <UserPlus className="h-4 w-4" />
            إضافة طالب
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col" dir="rtl">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">إضافة طالب جديد</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <form onSubmit={handleSubmit} className="space-y-5 pt-4 pb-2">
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">اسم الطالب</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="أدخل اسم الطالب"
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone" className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5" />
                    رقم الطالب (واتساب)
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+966xxxxxxxxx"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="parentPhone" className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5" />
                    رقم ولي الأمر (واتساب)
                  </Label>
                  <Input
                    id="parentPhone"
                    type="tel"
                    value={parentPhone}
                    onChange={(e) => setParentPhone(e.target.value)}
                    placeholder="+966xxxxxxxxx"
                    dir="ltr"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="time" className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  وقت الحصة
                </Label>
                <div className="relative">
                  <Input
                    id="time"
                    type="time"
                    value={sessionTime}
                    onChange={(e) => setSessionTime(e.target.value)}
                    className={conflictSummary.hasErrors ? 'border-destructive' : ''}
                  />
                  {isChecking && (
                    <div className="absolute left-2 top-1/2 -translate-y-1/2">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  )}
                </div>

                {/* Available Time Slots - Based on working hours and selected days */}
                {(() => {
                  // Show available slots based on working hours even without selected days
                  const workStart = settings?.workingHoursStart || "14:00";
                  const workEnd = settings?.workingHoursEnd || "22:00";

                  // Parse working hours to minutes
                  const parseTime = (time: string) => {
                    const [h, m] = time.split(':').map(Number);
                    return h * 60 + (m || 0);
                  };

                  const formatTimeArabic = (minutes: number) => {
                    const h = Math.floor(minutes / 60);
                    const m = minutes % 60;
                    const period = h >= 12 ? 'م' : 'ص';
                    const hour12 = h % 12 || 12;
                    return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
                  };

                  const minutesToTimeStr = (minutes: number) => {
                    const h = Math.floor(minutes / 60);
                    const m = minutes % 60;
                    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                  };

                  const workStartMin = parseTime(workStart);
                  const workEndMin = parseTime(workEnd);
                  const duration = sessionDuration || defaultDuration || 60;

                  // Generate all possible slots within working hours (every 30 min)
                  const allSlots: Array<{
                    time: string;
                    timeAr: string;
                    type: 'morning' | 'afternoon' | 'evening';
                    hasConflict: boolean;
                    conflictDays: string[];
                  }> = [];

                  for (let min = workStartMin; min + duration <= workEndMin; min += 30) {
                    const timeStr = minutesToTimeStr(min);
                    const hour = Math.floor(min / 60);

                    let type: 'morning' | 'afternoon' | 'evening';
                    if (hour < 12) type = 'morning';
                    else if (hour < 17) type = 'afternoon';
                    else type = 'evening';

                    // Check conflicts on selected days
                    let hasConflict = false;
                    const conflictDays: string[] = [];

                    if (selectedDays.length > 0) {
                      const semesterStart = showCustomDates ? customStart : defaultStart;
                      const semesterEnd = showCustomDates ? customEnd : defaultEnd;
                      const sessionDates = generateSessionsForSchedule(selectedDays, semesterStart, semesterEnd);

                      // Check first 5 dates of each day
                      const sampleDates = sessionDates.slice(0, Math.min(10, sessionDates.length));

                      sampleDates.forEach(date => {
                        const result = checkConflict({ date, startTime: timeStr });
                        if (result.severity === 'error') {
                          hasConflict = true;
                          const dayOfWeek = new Date(date).getDay();
                          const dayName = DAY_NAMES_AR[dayOfWeek];
                          if (!conflictDays.includes(dayName)) {
                            conflictDays.push(dayName);
                          }
                        }
                      });
                    }

                    allSlots.push({
                      time: timeStr,
                      timeAr: formatTimeArabic(min),
                      type,
                      hasConflict,
                      conflictDays,
                    });
                  }

                  if (allSlots.length === 0) return null;

                  // Count conflicting slots for legend
                  const conflictCount = allSlots.filter(s => s.hasConflict).length;

                  return (
                    <div className="space-y-2 pt-2">
                      <Label className="text-xs font-medium flex items-center gap-1 text-emerald-700">
                        <Sparkles className="h-3 w-3" />
                        ساعات العمل ({formatTimeArabic(workStartMin)} - {formatTimeArabic(workEndMin)})
                      </Label>

                      {/* Available Slots */}
                      <div className="flex flex-wrap gap-1.5">
                        {allSlots.map((slot) => (
                          <Button
                            key={slot.time}
                            type="button"
                            size="sm"
                            variant={sessionTime === slot.time ? "default" : slot.hasConflict ? "ghost" : "outline"}
                            disabled={slot.hasConflict}
                            className={cn(
                              "gap-1 h-7 text-xs px-2",
                              sessionTime === slot.time && "ring-2 ring-primary ring-offset-1",
                              slot.hasConflict && "opacity-40 line-through cursor-not-allowed text-muted-foreground"
                            )}
                            onClick={() => !slot.hasConflict && setSessionTime(slot.time)}
                            title={slot.hasConflict ? `تعارض في: ${slot.conflictDays.join('، ')}` : ''}
                          >
                            {slot.type === "morning" && <Sunrise className="h-3 w-3" />}
                            {slot.type === "afternoon" && <Sun className="h-3 w-3" />}
                            {slot.type === "evening" && <Moon className="h-3 w-3" />}
                            {slot.timeAr}
                          </Button>
                        ))}
                      </div>

                      {/* Legend */}
                      {selectedDays.length > 0 && conflictCount > 0 && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <span className="line-through opacity-50">2:00 م</span>
                          <span>= وقت مشغول في أحد الأيام المحددة</span>
                        </p>
                      )}
                    </div>
                  );
                })()}
              </div>
              <div className="space-y-2">
                <Label>نوع الحصة</Label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSessionType('onsite')}
                    className={`
                      flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border transition-all
                      ${sessionType === 'onsite'
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-card border-border hover:border-primary/50'
                      }
                    `}
                  >
                    <MapPin className="h-3.5 w-3.5" />
                    <span className="text-sm">حضوري</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSessionType('online')}
                    className={`
                      flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border transition-all
                      ${sessionType === 'online'
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-card border-border hover:border-primary/50'
                      }
                    `}
                  >
                    <Monitor className="h-3.5 w-3.5" />
                    <span className="text-sm">أونلاين</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Custom Pricing Section */}
            <div className="space-y-3 p-3 rounded-lg border bg-muted/30">
              <div className="flex items-center justify-between">
                <Label htmlFor="customPrices" className="flex items-center gap-2 cursor-pointer">
                  <DollarSign className="h-4 w-4 text-amber-500" />
                  <span>سعر مخصص للحصة</span>
                </Label>
                <Switch
                  id="customPrices"
                  checked={useCustomPrices}
                  onCheckedChange={setUseCustomPrices}
                />
              </div>

              {useCustomPrices && (
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="space-y-2">
                    <Label htmlFor="priceOnsite" className="text-xs flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      سعر الحضوري (ج.م)
                    </Label>
                    <Input
                      id="priceOnsite"
                      type="number"
                      min="0"
                      value={customPriceOnsite}
                      onChange={(e) => setCustomPriceOnsite(Number(e.target.value) || 0)}
                      placeholder={String(defaultPriceOnsite)}
                      className="text-center"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="priceOnline" className="text-xs flex items-center gap-1">
                      <Monitor className="h-3 w-3" />
                      سعر الأونلاين (ج.م)
                    </Label>
                    <Input
                      id="priceOnline"
                      type="number"
                      min="0"
                      value={customPriceOnline}
                      onChange={(e) => setCustomPriceOnline(Number(e.target.value) || 0)}
                      placeholder={String(defaultPriceOnline)}
                      className="text-center"
                    />
                  </div>
                </div>
              )}

              {!useCustomPrices && (
                <p className="text-xs text-muted-foreground">
                  السعر الافتراضي: حضوري {defaultPriceOnsite} ج.م | أونلاين {defaultPriceOnline} ج.م
                </p>
              )}
            </div>

            {/* Duration Picker */}
            <DurationPicker
              startTime={sessionTime || '00:00'}
              duration={sessionDuration}
              onDurationChange={setSessionDuration}
              showEndTime={!!sessionTime && !!sessionDuration}
              placeholder="اختر المدة"
            />

            {/* Conflict Warning Box */}
            {!isChecking && conflictSummary.hasErrors && (
              <div className="p-3 rounded-lg bg-destructive/10 border-2 border-destructive">
                <div className="flex items-start gap-2">
                  <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold text-destructive text-sm">
                      ❌ تعارض مع {conflictSummary.errorCount} جلسة موجودة
                    </p>
                    <p className="text-xs text-destructive/80">
                      يتعارض وقت {formatTimeAr(sessionTime)} مع: {conflictSummary.conflictingStudents.slice(0, 3).join('، ')}
                      {conflictSummary.conflictingStudents.length > 3 && ` (+${conflictSummary.conflictingStudents.length - 3})`}
                    </p>
                    <p className="text-xs text-destructive/70">
                      الرجاء اختيار وقت مختلف
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {!isChecking && !conflictSummary.hasErrors && conflictSummary.hasWarnings && (
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
                    <p className="text-xs text-amber-500 dark:text-amber-600">
                      يمكنك الاستمرار، لكن ننصح بفاصل أكبر
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {!isChecking && !conflictSummary.hasErrors && !conflictSummary.hasWarnings && selectedDays.length > 0 && sessionTime && (
              <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-500">
                <Check className="h-4 w-4" />
                <span>✓ الوقت متاح</span>
              </div>
            )}

            <div className="space-y-3">
              <Label>أيام الحصص الأسبوعية</Label>
              <p className="text-xs text-muted-foreground">اختر الأيام التي يحضر فيها الطالب أسبوعياً</p>
              <div className="flex flex-wrap gap-2">
                {DAY_NAMES_AR.map((day, index) => (
                  <label
                    key={day}
                    className={`
                      flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all
                      ${selectedDays.includes(index)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-card border-border hover:border-primary/50'
                      }
                    `}
                  >
                    <Checkbox
                      checked={selectedDays.includes(index)}
                      onCheckedChange={() => toggleDay(index)}
                      className="sr-only"
                    />
                    <span className="text-sm font-medium">{day}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Student Materials Section */}
            <StudentMaterialsSection
              materials={materials}
              onMaterialsChange={setMaterials}
            />

            <Collapsible open={showCustomDates} onOpenChange={setShowCustomDates}>
              <CollapsibleTrigger asChild>
                <Button type="button" variant="ghost" className="w-full justify-between text-muted-foreground">
                  تواريخ الفصل الدراسي (اختياري)
                  {showCustomDates ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 pt-2">
                <p className="text-xs text-muted-foreground">حدد بداية ونهاية الفصل الدراسي للطالب</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="customStart">تاريخ البداية</Label>
                    <Input
                      id="customStart"
                      type="date"
                      value={customStart}
                      onChange={(e) => setCustomStart(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="customEnd">تاريخ النهاية</Label>
                    <Input
                      id="customEnd"
                      type="date"
                      value={customEnd}
                      onChange={(e) => setCustomEnd(e.target.value)}
                    />
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
            </form>
          </DialogBody>

          <DialogFooter className="flex-row-reverse gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} className="flex-1">
              إلغاء
            </Button>
            <Button 
              type="submit" 
              onClick={handleSubmit}
              className="flex-1 gradient-primary"
              disabled={!name.trim() || selectedDays.length === 0 || !sessionTime || !sessionDuration || !sessionType || conflictSummary.hasErrors || isChecking}
            >
              {isChecking ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin ml-2" />
                  جاري التحقق...
                </>
              ) : (
                'إضافة الطالب'
              )}
            </Button>
          </DialogFooter>
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
                سيتم إنشاء {conflictSummary.warningCount} جلسة بفاصل أقل من 30 دقيقة عن جلسات أخرى.
              </p>
              <p className="text-muted-foreground text-sm">
                الطلاب المتأثرون: {conflictSummary.conflictingStudents.join('، ')}
              </p>
              <p className="text-muted-foreground text-sm">
                قد لا يكون لديك وقت كافٍ للتحضير أو الراحة بين الحصص.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction 
              onClick={proceedWithAdd}
              className="bg-amber-500 hover:bg-amber-600"
            >
              نعم، أضف الطالب
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
