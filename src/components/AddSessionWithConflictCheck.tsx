import { useState, useMemo, useEffect } from 'react';
import { format } from 'date-fns';
import { Calendar, AlertTriangle, Clock, Sparkles, Sunrise, Sun, Moon } from 'lucide-react';
import { Student } from '@/types/student';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { useConflictDetection, formatTimeAr } from '@/hooks/useConflictDetection';
import { ConflictWarning } from '@/components/ConflictWarning';
import { cn } from '@/lib/utils';

interface AddSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: Student;
  students: Student[];
  onAdd: (studentId: string, date: string, time?: string) => void;
}

export const AddSessionWithConflictCheck = ({
  open,
  onOpenChange,
  student,
  students,
  onAdd,
}: AddSessionDialogProps) => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string>(student.sessionTime || '16:00');
  const [showWarningDialog, setShowWarningDialog] = useState(false);
  
  const { checkConflict, getSuggestedSlots } = useConflictDetection(students);

  // Reset when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedDate(undefined);
      setSelectedTime(student.sessionTime || '16:00');
    }
  }, [open, student.sessionTime]);
  
  // Check for duplicate session on the same date
  const hasDuplicateSession = useMemo(() => {
    if (!selectedDate) return false;
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    return student.sessions?.some(s => s.date === dateStr && s.status === 'scheduled') ?? false;
  }, [selectedDate, student.sessions]);

  // Check for conflicts
  const conflictResult = useMemo(() => {
    if (!selectedDate) return null;
    
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    return checkConflict({ date: dateStr, startTime: selectedTime });
  }, [selectedDate, selectedTime, checkConflict]);

  // Get available slots for selected date
  const availableSlots = useMemo(() => {
    if (!selectedDate) return [];

    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    return getSuggestedSlots(dateStr, student.sessionDuration || 60, "08:00", "22:00", 8);
  }, [selectedDate, getSuggestedSlots, student.sessionDuration]);

  const handleTimeChange = (time: string) => {
    setSelectedTime(time);
  };
  
  const handleSuggestionSelect = (time: string) => {
    setSelectedTime(time);
  };
  
  const handleSave = () => {
    if (!selectedDate) return;
    
    if (conflictResult?.severity === 'error') {
      // Can't save with error conflicts
      return;
    }
    
    if (conflictResult?.severity === 'warning') {
      // Show warning dialog
      setShowWarningDialog(true);
      return;
    }
    
    // Safe to add
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    onAdd(student.id, dateStr, selectedTime);
    onOpenChange(false);
  };
  
  const handleConfirmWithWarning = () => {
    if (!selectedDate) return;
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    onAdd(student.id, dateStr, selectedTime);
    setShowWarningDialog(false);
    onOpenChange(false);
  };
  
  const isFormValid = selectedDate && selectedTime;
  const canSave = isFormValid && conflictResult?.severity !== 'error' && !hasDuplicateSession;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-heading">
              <Calendar className="h-5 w-5" />
              إضافة حصة جديدة
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              إضافة حصة لـ <span className="font-medium">{student.name}</span>
            </p>
            
            {/* Date Picker */}
            <div className="space-y-2">
              <Label>التاريخ</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-right font-normal",
                      !selectedDate && "text-muted-foreground"
                    )}
                  >
                    <Calendar className="ml-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, 'dd/MM/yyyy') : "اختر تاريخ"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
                  <CalendarPicker
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            
            {/* Time Picker */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                وقت الحصة
              </Label>
              <Input
                type="time"
                value={selectedTime}
                onChange={(e) => handleTimeChange(e.target.value)}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                الوقت الافتراضي: {formatTimeAr(student.sessionTime || '16:00')}
              </p>
            </div>

            {/* Available Slots */}
            {selectedDate && availableSlots.length > 0 && (
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5 text-green-700">
                  <Sparkles className="h-4 w-4" />
                  أوقات متاحة
                </Label>
                <div className="flex flex-wrap gap-2">
                  {availableSlots.map((slot) => (
                    <Button
                      key={slot.time}
                      type="button"
                      size="sm"
                      variant={selectedTime === slot.time ? "default" : "outline"}
                      className={cn(
                        "gap-1.5 h-8 text-xs",
                        selectedTime === slot.time && "ring-2 ring-primary ring-offset-1"
                      )}
                      onClick={() => handleSuggestionSelect(slot.time)}
                    >
                      {slot.type === "morning" && <Sunrise className="h-3 w-3" />}
                      {slot.type === "afternoon" && <Sun className="h-3 w-3" />}
                      {slot.type === "evening" && <Moon className="h-3 w-3" />}
                      {slot.timeAr}
                    </Button>
                  ))}
                </div>
                {availableSlots.length === 0 && (
                  <p className="text-xs text-amber-600">
                    لا توجد أوقات متاحة في هذا اليوم
                  </p>
                )}
              </div>
            )}

            {/* Conflict Status */}
            {selectedDate && conflictResult && (
              <ConflictWarning
                result={conflictResult}
                onSelectSuggestion={handleSuggestionSelect}
              />
            )}

            {/* Duplicate session warning */}
            {hasDuplicateSession && (
              <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-300">
                ⚠️ يوجد جلسة مجدولة بالفعل لهذا الطالب في نفس اليوم
              </div>
            )}
          </div>
          
          <DialogFooter className="flex-row-reverse gap-2 sm:justify-start">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              إلغاء
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={!canSave}
              className={cn(
                conflictResult?.severity === 'error' && "opacity-50 cursor-not-allowed"
              )}
            >
              حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Warning Confirmation Dialog */}
      <AlertDialog open={showWarningDialog} onOpenChange={setShowWarningDialog}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              ⚠️ تحذير: جلسات قريبة جداً
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>الحصة الجديدة ستكون قريبة جداً من حصة أخرى.</p>
                
                {conflictResult?.conflicts.map((conflict, idx) => (
                  <div key={idx} className="p-3 rounded-lg bg-warning/10 border border-warning/30">
                    <p className="font-medium">{conflict.student.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatTimeAr(conflict.session.time || ('sessionTime' in conflict.student ? conflict.student.sessionTime : undefined) || '16:00')}
                      {conflict.gap !== undefined && (
                        <span className="mr-1">(فاصل {conflict.gap} دقيقة فقط)</span>
                      )}
                    </p>
                  </div>
                ))}
                
                <p className="text-sm">
                  ⚠️ قد لا يكون لديك وقت كافٍ للتحضير والراحة. نوصي بفاصل 30 دقيقة على الأقل.
                </p>
                
                <p className="font-medium">هل تريد الإضافة على أي حال؟</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmWithWarning}>
              نعم، أضف الحصة
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
