import { useState, useMemo, useEffect } from 'react';
import {
  format,
  isBefore,
  startOfDay,
  startOfWeek,
  endOfWeek,
  addWeeks,
  endOfMonth,
  startOfMonth,
  addMonths,
  parseISO,
} from 'date-fns';
import { Calendar, Clock, User, ChevronLeft, Undo2, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { Student, Session } from '@/types/student';
import { formatShortDateAr } from '@/lib/arabicConstants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface BulkEditSessionsDialogProps {
  students: Student[];
  onBulkUpdateTime: (
    studentIds: string[],
    sessionIds: string[],
    newTime: string
  ) => { success: boolean; updatedCount: number; conflicts: ConflictInfo[] };
  onBulkMarkAsVacation?: (
    studentIds: string[],
    sessionIds: string[]
  ) => { success: boolean; updatedCount: number };
}

interface SessionWithStudent {
  session: Session;
  student: Student;
  originalTime: string;
  newTime: string;
}

interface ConflictInfo {
  session: Session;
  student: Student;
  conflictsWith: {
    session: Session;
    student: Student;
  };
  type: 'exact' | 'partial' | 'close';
  gap?: number;
}

interface CategorizedSessions {
  safe: SessionWithStudent[];
  warnings: SessionWithStudent[];
  conflicts: SessionWithStudent[];
}

interface UndoData {
  sessionUpdates: { sessionId: string; studentId: string; originalTime: string }[];
  timestamp: number;
  count: number;
  studentName: string;
}

// Storage key for undo data
const UNDO_STORAGE_KEY = 'bulk-edit-undo-data';
const UNDO_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

// Helper to parse time to minutes
const timeToMinutes = (time: string): number => {
  if (!time) return 16 * 60; // Default 4 PM
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

// Helper to convert minutes to time string
const minutesToTime = (minutes: number): string => {
  // Handle overflow past midnight
  const normalizedMinutes = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(normalizedMinutes / 60);
  const m = normalizedMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

// Format time in Arabic (12-hour)
const formatTimeAr = (time: string): string => {
  if (!time) return '4:00 م';
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'م' : 'ص';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
};

type TimePeriod = 'this-week' | 'next-week' | 'this-month' | 'next-month' | 'custom';

export const BulkEditSessionsDialog = ({
  students,
  onBulkUpdateTime,
}: BulkEditSessionsDialogProps) => {
  const [open, setOpen] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [lastApplyResult, setLastApplyResult] = useState<{ safe: number; warnings: number; conflicts: number }>({ safe: 0, warnings: 0, conflicts: 0 });

  // Filters
  const today = startOfDay(new Date());
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('this-month');
  const [dateFrom, setDateFrom] = useState<Date | undefined>(today);
  const [dateTo, setDateTo] = useState<Date | undefined>(endOfMonth(today));

  // Time modification
  const [timeModType, setTimeModType] = useState<'offset' | 'specific'>('offset');
  const [offsetDirection, setOffsetDirection] = useState<'+' | '-'>('+');
  const [offsetHours, setOffsetHours] = useState<number>(4);
  const [offsetMinutes, setOffsetMinutes] = useState<number>(0);
  const [specificTime, setSpecificTime] = useState<string>('');

  // Undo state
  const [undoData, setUndoData] = useState<UndoData | null>(null);
  const [undoTimeLeft, setUndoTimeLeft] = useState<number>(0);

  // Calculate date range based on selected period
  const updateDateRange = (period: TimePeriod) => {
    setSelectedPeriod(period);
    switch (period) {
      case 'this-week':
        setDateFrom(today);
        setDateTo(endOfWeek(today, { weekStartsOn: 0 }));
        break;
      case 'next-week':
        const nextWeekStart = startOfWeek(addWeeks(today, 1), { weekStartsOn: 0 });
        setDateFrom(nextWeekStart);
        setDateTo(endOfWeek(nextWeekStart, { weekStartsOn: 0 }));
        break;
      case 'this-month':
        setDateFrom(today);
        setDateTo(endOfMonth(today));
        break;
      case 'next-month':
        const nextMonth = addMonths(today, 1);
        setDateFrom(startOfMonth(nextMonth));
        setDateTo(endOfMonth(nextMonth));
        break;
      case 'custom':
        // Keep current values
        break;
    }
  };

  // Load undo data on mount
  useEffect(() => {
    const stored = localStorage.getItem(UNDO_STORAGE_KEY);
    if (stored) {
      try {
        const data: UndoData = JSON.parse(stored);
        const elapsed = Date.now() - data.timestamp;
        if (elapsed < UNDO_TIMEOUT_MS) {
          setUndoData(data);
        } else {
          localStorage.removeItem(UNDO_STORAGE_KEY);
        }
      } catch {
        localStorage.removeItem(UNDO_STORAGE_KEY);
      }
    }
  }, []);

  // Update undo timer
  useEffect(() => {
    if (!undoData) {
      setUndoTimeLeft(0);
      return;
    }

    const updateTimer = () => {
      const elapsed = Date.now() - undoData.timestamp;
      const remaining = Math.max(0, UNDO_TIMEOUT_MS - elapsed);
      setUndoTimeLeft(remaining);

      if (remaining === 0) {
        setUndoData(null);
        localStorage.removeItem(UNDO_STORAGE_KEY);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [undoData]);

  // Calculate new time based on modification type
  const calculateNewTime = (originalTime: string): string => {
    if (timeModType === 'specific') {
      return specificTime || originalTime;
    }

    const originalMinutes = timeToMinutes(originalTime);
    const offsetTotalMinutes = offsetHours * 60 + offsetMinutes;
    const newMinutes = offsetDirection === '+'
      ? originalMinutes + offsetTotalMinutes
      : originalMinutes - offsetTotalMinutes;

    return minutesToTime(newMinutes);
  };

  // Get selected student
  const selectedStudent = useMemo(() => {
    return students.find(s => s.id === selectedStudentId);
  }, [students, selectedStudentId]);

  // Calculate matching sessions with new times
  const matchingSessions = useMemo(() => {
    const sessions: SessionWithStudent[] = [];
    
    if (!selectedStudentId || !selectedStudent) return sessions;
    
    const todayStr = format(today, 'yyyy-MM-dd');
    const fromStr = dateFrom ? format(dateFrom, 'yyyy-MM-dd') : todayStr;
    const toStr = dateTo ? format(dateTo, 'yyyy-MM-dd') : undefined;

    selectedStudent.sessions.forEach(session => {
      // Only scheduled sessions
      if (session.status !== 'scheduled') return;
      
      // Must be in date range
      if (session.date < fromStr) return;
      if (toStr && session.date > toStr) return;

      const originalTime = session.time || selectedStudent.sessionTime || '16:00';
      const newTime = calculateNewTime(originalTime);

      sessions.push({
        session,
        student: selectedStudent,
        originalTime,
        newTime,
      });
    });

    return sessions.sort((a, b) => a.session.date.localeCompare(b.session.date));
  }, [selectedStudent, selectedStudentId, dateFrom, dateTo, timeModType, offsetDirection, offsetHours, offsetMinutes, specificTime, today]);

  // Categorize sessions by conflict status
  const categorizedSessions = useMemo((): CategorizedSessions => {
    const result: CategorizedSessions = { safe: [], warnings: [], conflicts: [] };
    const sessionDuration = 60;
    const minGap = 15;

    matchingSessions.forEach(sessionData => {
      const { session, student, newTime } = sessionData;
      const sessionDate = session.date;
      const newStartMinutes = timeToMinutes(newTime);
      const newEndMinutes = newStartMinutes + sessionDuration;

      let conflictType = 'none' as 'none' | 'close' | 'overlap';

      // Check against all other sessions on same date from OTHER students
      students.forEach(otherStudent => {
        if (otherStudent.id === student.id) return; // Skip same student
        
        otherStudent.sessions.forEach(otherSession => {
          if (otherSession.date !== sessionDate) return;
          if (otherSession.status === 'cancelled' || otherSession.status === 'vacation') return;

          const otherTime = otherSession.time || otherStudent.sessionTime || '16:00';
          const otherStartMinutes = timeToMinutes(otherTime);
          const otherEndMinutes = otherStartMinutes + sessionDuration;

          // Check exact overlap
          if (newStartMinutes === otherStartMinutes) {
            conflictType = 'overlap';
            return;
          }

          // Check partial overlap
          const overlaps =
            (newStartMinutes >= otherStartMinutes && newStartMinutes < otherEndMinutes) ||
            (newEndMinutes > otherStartMinutes && newEndMinutes <= otherEndMinutes) ||
            (newStartMinutes <= otherStartMinutes && newEndMinutes >= otherEndMinutes);

          if (overlaps) {
            conflictType = 'overlap';
            return;
          }

          // Check close sessions
          const gapBefore = Math.abs(newStartMinutes - otherEndMinutes);
          const gapAfter = Math.abs(otherStartMinutes - newEndMinutes);
          const gap = Math.min(gapBefore, gapAfter);

          if (gap > 0 && gap < minGap) {
            if (conflictType !== 'overlap') {
              conflictType = 'close';
            }
          }
        });
      });

      if (conflictType === 'overlap') {
        result.conflicts.push(sessionData);
      } else if (conflictType === 'close') {
        result.warnings.push(sessionData);
      } else {
        result.safe.push(sessionData);
      }
    });

    return result;
  }, [matchingSessions, students]);

  const handleShowPreview = () => {
    if (!selectedStudentId) {
      toast({
        title: 'اختر طالب',
        description: 'الرجاء اختيار طالب أولاً',
        variant: 'destructive',
      });
      return;
    }

    if (matchingSessions.length === 0) {
      toast({
        title: 'لا توجد جلسات',
        description: `لا توجد جلسات مجدولة لـ ${selectedStudent?.name || 'الطالب'} في هذه الفترة`,
        variant: 'destructive',
      });
      return;
    }

    if (timeModType === 'specific' && !specificTime) {
      toast({
        title: 'خطأ',
        description: 'الرجاء تحديد الوقت الجديد',
        variant: 'destructive',
      });
      return;
    }

    if (timeModType === 'offset' && offsetHours === 0 && offsetMinutes === 0) {
      toast({
        title: 'خطأ',
        description: 'الرجاء تحديد مقدار التعديل',
        variant: 'destructive',
      });
      return;
    }

    // Validate offset range (-12h to +12h)
    const totalOffset = offsetHours * 60 + offsetMinutes;
    if (totalOffset > 12 * 60) {
      toast({
        title: 'خطأ',
        description: 'الحد الأقصى للتعديل 12 ساعة',
        variant: 'destructive',
      });
      return;
    }

    setShowPreview(true);
  };

  const applyChanges = (includeWarnings: boolean) => {
    const sessionsToApply = includeWarnings
      ? [...categorizedSessions.safe, ...categorizedSessions.warnings]
      : categorizedSessions.safe;

    if (sessionsToApply.length === 0) {
      toast({
        title: 'لا توجد جلسات للتطبيق',
        description: 'جميع الجلسات المحددة بها تعارضات',
        variant: 'destructive',
      });
      return;
    }

    // Save undo data before applying
    const undoInfo: UndoData = {
      sessionUpdates: sessionsToApply.map(s => ({
        sessionId: s.session.id,
        studentId: s.student.id,
        originalTime: s.originalTime,
      })),
      timestamp: Date.now(),
      count: sessionsToApply.length,
      studentName: selectedStudent?.name || '',
    };
    localStorage.setItem(UNDO_STORAGE_KEY, JSON.stringify(undoInfo));
    setUndoData(undoInfo);

    // Apply changes - update each session with its own new time
    sessionsToApply.forEach(s => {
      onBulkUpdateTime([s.student.id], [s.session.id], s.newTime);
    });

    setLastApplyResult({
      safe: categorizedSessions.safe.length,
      warnings: includeWarnings ? categorizedSessions.warnings.length : 0,
      conflicts: categorizedSessions.conflicts.length,
    });

    setShowPreview(false);
    setShowSuccessDialog(true);
  };

  const handleUndo = () => {
    if (!undoData) return;

    // Restore original times
    undoData.sessionUpdates.forEach(update => {
      onBulkUpdateTime([update.studentId], [update.sessionId], update.originalTime);
    });

    toast({
      title: '✓ تم التراجع',
      description: `تم استعادة ${undoData.count} جلسة إلى أوقاتها الأصلية`,
    });

    localStorage.removeItem(UNDO_STORAGE_KEY);
    setUndoData(null);
    setShowSuccessDialog(false);
  };

  const resetForm = () => {
    setSelectedStudentId('');
    setSelectedPeriod('this-month');
    setDateFrom(today);
    setDateTo(endOfMonth(today));
    setTimeModType('offset');
    setOffsetDirection('+');
    setOffsetHours(4);
    setOffsetMinutes(0);
    setSpecificTime('');
    setShowPreview(false);
  };

  const formatUndoTimeLeft = () => {
    const minutes = Math.floor(undoTimeLeft / 60000);
    const seconds = Math.floor((undoTimeLeft % 60000) / 1000);
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) {
          setShowPreview(false);
          setShowSuccessDialog(false);
        }
      }}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Clock className="h-4 w-4" />
            <span className="hidden sm:inline">تعديل جماعي</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-heading">
              <Clock className="h-5 w-5" />
              تعديل جماعي للجلسات
            </DialogTitle>
          </DialogHeader>

          {/* Main Form */}
          {!showPreview && !showSuccessDialog && (
            <>
              <ScrollArea className="flex-1 -mx-6 px-6">
                <div className="space-y-5 pb-4">
                  {/* Undo Banner */}
                  {undoData && undoTimeLeft > 0 && (
                    <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 flex items-center justify-between">
                      <div className="text-sm">
                        <p className="font-medium">يمكنك التراجع عن التعديل السابق</p>
                        <p className="text-muted-foreground text-xs">
                          {undoData.count} جلسة لـ {undoData.studentName} • متبقي {formatUndoTimeLeft()}
                        </p>
                      </div>
                      <Button variant="outline" size="sm" onClick={handleUndo} className="gap-1">
                        <Undo2 className="h-3.5 w-3.5" />
                        تراجع
                      </Button>
                    </div>
                  )}

                  {/* Step 1: Select Student */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <User className="h-4 w-4" />
                      اختر الطالب
                    </Label>
                    <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                      <SelectTrigger className={cn(!selectedStudentId && 'text-muted-foreground')}>
                        <SelectValue placeholder="اختر طالب..." />
                      </SelectTrigger>
                      <SelectContent>
                        {students.map(student => (
                          <SelectItem key={student.id} value={student.id}>
                            {student.name} ({formatTimeAr(student.sessionTime || '16:00')})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Step 2: Select Time Period */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <Calendar className="h-4 w-4" />
                      الفترة الزمنية
                    </Label>
                    
                    {/* Quick Period Buttons */}
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant={selectedPeriod === 'this-week' ? 'default' : 'outline'}
                        size="sm"
                        className="text-xs"
                        onClick={() => updateDateRange('this-week')}
                      >
                        هذا الأسبوع
                      </Button>
                      <Button
                        type="button"
                        variant={selectedPeriod === 'next-week' ? 'default' : 'outline'}
                        size="sm"
                        className="text-xs"
                        onClick={() => updateDateRange('next-week')}
                      >
                        الأسبوع القادم
                      </Button>
                      <Button
                        type="button"
                        variant={selectedPeriod === 'this-month' ? 'default' : 'outline'}
                        size="sm"
                        className="text-xs"
                        onClick={() => updateDateRange('this-month')}
                      >
                        هذا الشهر
                      </Button>
                      <Button
                        type="button"
                        variant={selectedPeriod === 'next-month' ? 'default' : 'outline'}
                        size="sm"
                        className="text-xs"
                        onClick={() => updateDateRange('next-month')}
                      >
                        الشهر القادم
                      </Button>
                    </div>

                    {/* Custom Date Range */}
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">أو نطاق مخصص:</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-xs text-muted-foreground">من</span>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className={cn('w-full justify-start text-right font-normal', !dateFrom && 'text-muted-foreground')}
                                onClick={() => setSelectedPeriod('custom')}
                              >
                                {dateFrom ? format(dateFrom, 'dd/MM/yyyy') : 'اختر تاريخ'}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <CalendarPicker
                                mode="single"
                                selected={dateFrom}
                                onSelect={(date) => {
                                  setDateFrom(date);
                                  setSelectedPeriod('custom');
                                }}
                                initialFocus
                                className="pointer-events-auto"
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">إلى</span>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className={cn('w-full justify-start text-right font-normal', !dateTo && 'text-muted-foreground')}
                                onClick={() => setSelectedPeriod('custom')}
                              >
                                {dateTo ? format(dateTo, 'dd/MM/yyyy') : 'اختر تاريخ'}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <CalendarPicker
                                mode="single"
                                selected={dateTo}
                                onSelect={(date) => {
                                  setDateTo(date);
                                  setSelectedPeriod('custom');
                                }}
                                disabled={date => dateFrom ? isBefore(date, dateFrom) : false}
                                initialFocus
                                className="pointer-events-auto"
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Step 3: Session Count */}
                  {selectedStudentId && (
                    <div className={cn(
                      'rounded-lg p-3 text-center',
                      matchingSessions.length > 0 ? 'bg-primary/10 border border-primary/30' : 'bg-muted/50'
                    )}>
                      <p className="text-lg font-bold">
                        {matchingSessions.length} جلسة محددة
                      </p>
                      {matchingSessions.length === 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          لا توجد جلسات مجدولة لـ {selectedStudent?.name} في هذه الفترة
                        </p>
                      )}
                    </div>
                  )}

                  {/* Step 4: Time Modification */}
                  <div className="space-y-3">
                    <Label className="flex items-center gap-1.5">
                      <Clock className="h-4 w-4" />
                      تغيير الوقت
                    </Label>

                    <RadioGroup value={timeModType} onValueChange={(v) => setTimeModType(v as 'offset' | 'specific')}>
                      {/* Offset Option */}
                      <div className={cn('border rounded-lg p-3 transition-colors', timeModType === 'offset' && 'border-primary bg-primary/5')}>
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value="offset" id="offset" />
                          <Label htmlFor="offset" className="font-medium cursor-pointer">تحويل بمقدار زمني</Label>
                        </div>
                        {timeModType === 'offset' && (
                          <div className="mt-3 flex items-center gap-2 flex-wrap">
                            <Select value={offsetDirection} onValueChange={(v) => setOffsetDirection(v as '+' | '-')}>
                              <SelectTrigger className="w-16">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="+">+</SelectItem>
                                <SelectItem value="-">-</SelectItem>
                              </SelectContent>
                            </Select>
                            <Select value={String(offsetHours)} onValueChange={(v) => setOffsetHours(Number(v))}>
                              <SelectTrigger className="w-20">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(h => (
                                  <SelectItem key={h} value={String(h)}>{h} ساعة</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Select value={String(offsetMinutes)} onValueChange={(v) => setOffsetMinutes(Number(v))}>
                              <SelectTrigger className="w-20">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {[0, 15, 30, 45].map(m => (
                                  <SelectItem key={m} value={String(m)}>{m} دقيقة</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <span className="text-xs text-muted-foreground">
                              (مثال: 4:00 م → {formatTimeAr(calculateNewTime('16:00'))})
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Specific Time Option */}
                      <div className={cn('border rounded-lg p-3 transition-colors', timeModType === 'specific' && 'border-primary bg-primary/5')}>
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value="specific" id="specific" />
                          <Label htmlFor="specific" className="font-medium cursor-pointer">تحديد وقت معين</Label>
                        </div>
                        {timeModType === 'specific' && (
                          <div className="mt-3">
                            <Input
                              type="time"
                              value={specificTime}
                              onChange={e => setSpecificTime(e.target.value)}
                              className="w-32"
                            />
                            {specificTime && (
                              <p className="text-xs text-muted-foreground mt-1">
                                جميع الجلسات → {formatTimeAr(specificTime)}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </RadioGroup>
                  </div>

                  {/* Quick Summary */}
                  {selectedStudentId && matchingSessions.length > 0 && (
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-sm font-medium mb-1">ملخص سريع</p>
                      <div className="flex gap-3 text-xs">
                        <span className="text-success flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> {categorizedSessions.safe.length} آمنة
                        </span>
                        <span className="text-warning flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" /> {categorizedSessions.warnings.length} تحذيرات
                        </span>
                        <span className="text-destructive flex items-center gap-1">
                          <XCircle className="h-3 w-3" /> {categorizedSessions.conflicts.length} تعارضات
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>

              <div className="flex gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setOpen(false)} className="flex-1">
                  إلغاء
                </Button>
                <Button
                  onClick={handleShowPreview}
                  disabled={!selectedStudentId || matchingSessions.length === 0}
                  className="flex-1"
                >
                  معاينة التغييرات
                </Button>
              </div>
            </>
          )}

          {/* Preview Screen */}
          {showPreview && !showSuccessDialog && (
            <>
              <ScrollArea className="flex-1 -mx-6 px-6">
                <div className="space-y-4 pb-4">
                  {/* Header */}
                  <div className="text-center">
                    <p className="font-medium">{selectedStudent?.name}</p>
                    <p className="text-sm text-muted-foreground">
                      المعاينة ({matchingSessions.length} جلسات)
                    </p>
                  </div>

                  {/* Summary */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-success/10 rounded p-2">
                      <p className="text-lg font-bold text-success">{categorizedSessions.safe.length}</p>
                      <p className="text-xs text-success">آمنة ✓</p>
                    </div>
                    <div className="bg-warning/10 rounded p-2">
                      <p className="text-lg font-bold text-warning">{categorizedSessions.warnings.length}</p>
                      <p className="text-xs text-warning">تحذيرات ⚠️</p>
                    </div>
                    <div className="bg-destructive/10 rounded p-2">
                      <p className="text-lg font-bold text-destructive">{categorizedSessions.conflicts.length}</p>
                      <p className="text-xs text-destructive">تعارضات ❌</p>
                    </div>
                  </div>

                  {/* Safe Sessions */}
                  {categorizedSessions.safe.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-success" />
                        <p className="font-medium text-sm">آمنة ({categorizedSessions.safe.length})</p>
                      </div>
                      <div className="space-y-1">
                        {categorizedSessions.safe.map(({ session, originalTime, newTime }) => (
                          <div key={session.id} className="bg-success/5 border border-success/20 rounded p-2 text-sm">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">✓</span>
                              <span className="text-xs">{formatShortDateAr(session.date)}</span>
                            </div>
                            <div className="flex items-center justify-center gap-2 mt-1">
                              <span className="text-muted-foreground">{formatTimeAr(originalTime)}</span>
                              <ChevronLeft className="h-3 w-3 text-success" />
                              <span className="text-success font-medium">{formatTimeAr(newTime)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Warnings */}
                  {categorizedSessions.warnings.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-warning" />
                        <p className="font-medium text-sm">تحذيرات ({categorizedSessions.warnings.length})</p>
                      </div>
                      <p className="text-xs text-muted-foreground">جلسات قريبة من طلاب آخرين (أقل من 15 دقيقة)</p>
                      <div className="space-y-1">
                        {categorizedSessions.warnings.map(({ session, originalTime, newTime }) => (
                          <div key={session.id} className="bg-warning/5 border border-warning/20 rounded p-2 text-sm">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">⚠️</span>
                              <span className="text-xs">{formatShortDateAr(session.date)}</span>
                            </div>
                            <div className="flex items-center justify-center gap-2 mt-1">
                              <span className="text-muted-foreground">{formatTimeAr(originalTime)}</span>
                              <ChevronLeft className="h-3 w-3 text-warning" />
                              <span className="text-warning font-medium">{formatTimeAr(newTime)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Conflicts */}
                  {categorizedSessions.conflicts.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <XCircle className="h-4 w-4 text-destructive" />
                        <p className="font-medium text-sm">تعارضات ({categorizedSessions.conflicts.length})</p>
                      </div>
                      <p className="text-xs text-muted-foreground">هذه الجلسات لن يتم تعديلها</p>
                      <div className="space-y-1">
                        {categorizedSessions.conflicts.map(({ session, originalTime, newTime }) => (
                          <div key={session.id} className="bg-destructive/5 border border-destructive/20 rounded p-2 text-sm opacity-60">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">❌</span>
                              <span className="text-xs">{formatShortDateAr(session.date)}</span>
                            </div>
                            <div className="flex items-center justify-center gap-2 mt-1">
                              <span className="text-muted-foreground">{formatTimeAr(originalTime)}</span>
                              <ChevronLeft className="h-3 w-3 text-destructive" />
                              <span className="text-destructive font-medium line-through">{formatTimeAr(newTime)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>

              <div className="flex flex-col gap-2 pt-4 border-t">
                {categorizedSessions.warnings.length > 0 && categorizedSessions.safe.length > 0 && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => applyChanges(false)}
                      className="flex-1 text-xs"
                    >
                      تطبيق الآمنة فقط ({categorizedSessions.safe.length})
                    </Button>
                    <Button
                      onClick={() => applyChanges(true)}
                      className="flex-1 text-xs"
                    >
                      تطبيق مع التحذيرات ({categorizedSessions.safe.length + categorizedSessions.warnings.length})
                    </Button>
                  </div>
                )}
                {(categorizedSessions.warnings.length === 0 || categorizedSessions.safe.length === 0) && (
                  <Button
                    onClick={() => applyChanges(true)}
                    disabled={categorizedSessions.safe.length === 0 && categorizedSessions.warnings.length === 0}
                    className="w-full"
                  >
                    تطبيق التغييرات ({categorizedSessions.safe.length + categorizedSessions.warnings.length})
                  </Button>
                )}
                <Button variant="outline" onClick={() => setShowPreview(false)}>
                  <ChevronLeft className="h-4 w-4 ml-1" />
                  رجوع
                </Button>
              </div>
            </>
          )}

          {/* Success Screen */}
          {showSuccessDialog && (
            <div className="py-6 text-center space-y-4">
              <div className="w-16 h-16 bg-success/20 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-8 w-8 text-success" />
              </div>
              <div>
                <p className="text-lg font-medium">✓ تم تحديث {lastApplyResult.safe + lastApplyResult.warnings} جلسة</p>
                <p className="text-sm text-muted-foreground">لـ {selectedStudent?.name}</p>
              </div>
              
              {undoData && undoTimeLeft > 0 && (
                <div className="bg-muted/50 rounded-lg p-3">
                  <Button variant="outline" onClick={handleUndo} className="gap-2">
                    <Undo2 className="h-4 w-4" />
                    تراجع عن التغييرات
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2">
                    متاح لمدة {formatUndoTimeLeft()}
                  </p>
                </div>
              )}

              <Button onClick={() => {
                resetForm();
                setShowSuccessDialog(false);
                setOpen(false);
              }} className="w-full">
                إغلاق
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
