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
  getDay,
} from 'date-fns';
import { Calendar, Clock, Users, AlertTriangle, Check, ChevronLeft, Undo2, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { Student, Session } from '@/types/student';
import { DAY_NAMES_SHORT_AR, formatShortDateAr } from '@/lib/arabicConstants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
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
  const [dateFrom, setDateFrom] = useState<Date | undefined>(today);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('all');
  const [selectedDays, setSelectedDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);

  // Time modification
  const [timeModType, setTimeModType] = useState<'offset' | 'specific'>('offset');
  const [offsetDirection, setOffsetDirection] = useState<'+' | '-'>('+');
  const [offsetHours, setOffsetHours] = useState<number>(3);
  const [offsetMinutes, setOffsetMinutes] = useState<number>(0);
  const [specificTime, setSpecificTime] = useState<string>('');

  // Undo state
  const [undoData, setUndoData] = useState<UndoData | null>(null);
  const [undoTimeLeft, setUndoTimeLeft] = useState<number>(0);

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

  // Calculate matching sessions with new times
  const matchingSessions = useMemo(() => {
    const sessions: SessionWithStudent[] = [];
    const todayStr = format(today, 'yyyy-MM-dd');

    students.forEach(student => {
      if (selectedStudentId !== 'all' && student.id !== selectedStudentId) return;

      student.sessions.forEach(session => {
        if (session.status !== 'scheduled') return;
        if (session.date < todayStr) return;
        if (dateFrom && session.date < format(dateFrom, 'yyyy-MM-dd')) return;
        if (dateTo && session.date > format(dateTo, 'yyyy-MM-dd')) return;

        // Filter by day of week
        const sessionDayOfWeek = getDay(parseISO(session.date));
        if (!selectedDays.includes(sessionDayOfWeek)) return;

        const originalTime = session.time || student.sessionTime || '16:00';
        const newTime = calculateNewTime(originalTime);

        sessions.push({
          session,
          student,
          originalTime,
          newTime,
        });
      });
    });

    return sessions.sort((a, b) => {
      const dateCompare = a.session.date.localeCompare(b.session.date);
      if (dateCompare !== 0) return dateCompare;
      return a.originalTime.localeCompare(b.originalTime);
    });
  }, [students, selectedStudentId, dateFrom, dateTo, selectedDays, timeModType, offsetDirection, offsetHours, offsetMinutes, specificTime, today]);

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
      let conflictGap = Infinity;

      // Check against all other sessions on same date
      students.forEach(otherStudent => {
        otherStudent.sessions.forEach(otherSession => {
          if (otherSession.id === session.id) return;
          if (otherSession.date !== sessionDate) return;
          if (otherSession.status === 'cancelled') return;

          // Check if this session is also being updated
          const otherMatchingSession = matchingSessions.find(ms => ms.session.id === otherSession.id);
          const otherTime = otherMatchingSession
            ? otherMatchingSession.newTime
            : (otherSession.time || otherStudent.sessionTime || '16:00');
          
          const otherStartMinutes = timeToMinutes(otherTime);
          const otherEndMinutes = otherStartMinutes + sessionDuration;

          // Skip if same student (can't conflict with self unless exactly same time which is impossible)
          if (student.id === otherStudent.id) return;

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

          if (gap > 0 && gap < minGap && gap < conflictGap) {
            if (conflictType !== 'overlap') {
              conflictType = 'close';
              conflictGap = gap;
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

  const toggleDay = (day: number) => {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const handleShowPreview = () => {
    if (matchingSessions.length === 0) {
      toast({
        title: 'لا توجد جلسات',
        description: 'لا توجد جلسات تطابق المعايير المحددة',
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
    };
    localStorage.setItem(UNDO_STORAGE_KEY, JSON.stringify(undoInfo));
    setUndoData(undoInfo);

    // Apply changes
    const studentIds = [...new Set(sessionsToApply.map(s => s.student.id))];
    const sessionIds = sessionsToApply.map(s => s.session.id);
    const newTime = sessionsToApply[0]?.newTime || '';

    // For offset mode, we need to update each session with its own new time
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
    setDateFrom(today);
    setDateTo(undefined);
    setSelectedStudentId('all');
    setSelectedDays([0, 1, 2, 3, 4, 5, 6]);
    setTimeModType('offset');
    setOffsetDirection('+');
    setOffsetHours(3);
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
                          {undoData.count} جلسة • متبقي {formatUndoTimeLeft()}
                        </p>
                      </div>
                      <Button variant="outline" size="sm" onClick={handleUndo} className="gap-1">
                        <Undo2 className="h-3.5 w-3.5" />
                        تراجع
                      </Button>
                    </div>
                  )}

                  {/* Date Range */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <Calendar className="h-4 w-4" />
                      نطاق التاريخ
                    </Label>
                    
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      <Button type="button" variant="outline" size="sm" className="text-xs h-7"
                        onClick={() => { setDateFrom(today); setDateTo(endOfWeek(today, { weekStartsOn: 0 })); }}>
                        هذا الأسبوع
                      </Button>
                      <Button type="button" variant="outline" size="sm" className="text-xs h-7"
                        onClick={() => {
                          const start = startOfWeek(addWeeks(today, 1), { weekStartsOn: 0 });
                          setDateFrom(start); setDateTo(endOfWeek(start, { weekStartsOn: 0 }));
                        }}>
                        الأسبوع القادم
                      </Button>
                      <Button type="button" variant="outline" size="sm" className="text-xs h-7"
                        onClick={() => {
                          setDateFrom(today);
                          setDateTo(endOfWeek(addWeeks(today, 2), { weekStartsOn: 0 }));
                        }}>
                        أسبوعين
                      </Button>
                      <Button type="button" variant="outline" size="sm" className="text-xs h-7"
                        onClick={() => { setDateFrom(today); setDateTo(endOfMonth(today)); }}>
                        هذا الشهر
                      </Button>
                      <Button type="button" variant="outline" size="sm" className="text-xs h-7"
                        onClick={() => {
                          const nextMonth = addMonths(today, 1);
                          setDateFrom(startOfMonth(nextMonth)); setDateTo(endOfMonth(nextMonth));
                        }}>
                        الشهر القادم
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-xs text-muted-foreground">من</span>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className={cn('w-full justify-start text-right font-normal', !dateFrom && 'text-muted-foreground')}>
                              {dateFrom ? format(dateFrom, 'dd/MM/yyyy') : 'اختر تاريخ'}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <CalendarPicker mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className="pointer-events-auto" />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">إلى</span>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className={cn('w-full justify-start text-right font-normal', !dateTo && 'text-muted-foreground')}>
                              {dateTo ? format(dateTo, 'dd/MM/yyyy') : 'اختر تاريخ'}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <CalendarPicker mode="single" selected={dateTo} onSelect={setDateTo}
                              disabled={date => dateFrom ? isBefore(date, dateFrom) : false} initialFocus className="pointer-events-auto" />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  </div>

                  {/* Student Filter */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <Users className="h-4 w-4" />
                      تصفية حسب الطالب
                    </Label>
                    <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                      <SelectTrigger>
                        <SelectValue placeholder="جميع الطلاب" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">جميع الطلاب</SelectItem>
                        {students.map(student => (
                          <SelectItem key={student.id} value={student.id}>
                            {student.name} ({formatTimeAr(student.sessionTime || '16:00')})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Days of Week Filter */}
                  <div className="space-y-2">
                    <Label>تصفية حسب أيام الأسبوع</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {[0, 1, 2, 3, 4, 5, 6].map(day => (
                        <button
                          key={day}
                          type="button"
                          onClick={() => toggleDay(day)}
                          className={cn(
                            'px-3 py-1.5 rounded-lg text-xs border transition-colors',
                            selectedDays.includes(day)
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-card border-border hover:border-primary/50'
                          )}
                        >
                          {DAY_NAMES_SHORT_AR[day]}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" variant="ghost" size="sm" className="text-xs h-6"
                        onClick={() => setSelectedDays([0, 1, 2, 3, 4, 5, 6])}>
                        تحديد الكل
                      </Button>
                      <Button type="button" variant="ghost" size="sm" className="text-xs h-6"
                        onClick={() => setSelectedDays([])}>
                        إلغاء الكل
                      </Button>
                    </div>
                  </div>

                  {/* Time Modification */}
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
                          <Label htmlFor="offset" className="font-medium cursor-pointer">تعديل بمقدار زمني</Label>
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
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-sm font-medium mb-1">
                      الجلسات المطابقة: {matchingSessions.length}
                    </p>
                    {matchingSessions.length > 0 && (
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
                    )}
                  </div>
                </div>
              </ScrollArea>

              <div className="flex gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setOpen(false)} className="flex-1">
                  إلغاء
                </Button>
                <Button onClick={handleShowPreview} disabled={matchingSessions.length === 0} className="flex-1">
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
                  {/* Summary */}
                  <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                    <p className="font-medium">ملخص التغييرات</p>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-success/10 rounded p-2">
                        <p className="text-lg font-bold text-success">{categorizedSessions.safe.length}</p>
                        <p className="text-xs text-success">آمنة</p>
                      </div>
                      <div className="bg-warning/10 rounded p-2">
                        <p className="text-lg font-bold text-warning">{categorizedSessions.warnings.length}</p>
                        <p className="text-xs text-warning">تحذيرات</p>
                      </div>
                      <div className="bg-destructive/10 rounded p-2">
                        <p className="text-lg font-bold text-destructive">{categorizedSessions.conflicts.length}</p>
                        <p className="text-xs text-destructive">تعارضات</p>
                      </div>
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
                        {categorizedSessions.safe.slice(0, 5).map(({ session, student, originalTime, newTime }) => (
                          <div key={session.id} className="bg-success/5 border border-success/20 rounded p-2 text-sm">
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{student.name}</span>
                              <span className="text-xs text-muted-foreground">{formatShortDateAr(session.date)}</span>
                            </div>
                            <div className="flex items-center gap-1 text-xs mt-1">
                              <span className="text-muted-foreground">{formatTimeAr(originalTime)}</span>
                              <ChevronLeft className="h-3 w-3 text-success" />
                              <span className="text-success font-medium">{formatTimeAr(newTime)}</span>
                            </div>
                          </div>
                        ))}
                        {categorizedSessions.safe.length > 5 && (
                          <p className="text-xs text-muted-foreground text-center">
                            و {categorizedSessions.safe.length - 5} جلسة أخرى...
                          </p>
                        )}
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
                      <p className="text-xs text-muted-foreground">جلسات قريبة من بعضها (أقل من 15 دقيقة)</p>
                      <div className="space-y-1">
                        {categorizedSessions.warnings.slice(0, 3).map(({ session, student, originalTime, newTime }) => (
                          <div key={session.id} className="bg-warning/5 border border-warning/20 rounded p-2 text-sm">
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{student.name}</span>
                              <span className="text-xs text-muted-foreground">{formatShortDateAr(session.date)}</span>
                            </div>
                            <div className="flex items-center gap-1 text-xs mt-1">
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
                        {categorizedSessions.conflicts.slice(0, 3).map(({ session, student, originalTime, newTime }) => (
                          <div key={session.id} className="bg-destructive/5 border border-destructive/20 rounded p-2 text-sm">
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{student.name}</span>
                              <span className="text-xs text-muted-foreground">{formatShortDateAr(session.date)}</span>
                            </div>
                            <div className="flex items-center gap-1 text-xs mt-1">
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
                <Button variant="outline" onClick={() => setShowPreview(false)}>
                  العودة للتعديل
                </Button>
                {categorizedSessions.safe.length > 0 && (
                  <Button onClick={() => applyChanges(false)} className="bg-success hover:bg-success/90">
                    تطبيق الآمنة فقط ({categorizedSessions.safe.length})
                  </Button>
                )}
                {categorizedSessions.warnings.length > 0 && categorizedSessions.safe.length > 0 && (
                  <Button onClick={() => applyChanges(true)} variant="outline">
                    تطبيق الآمنة + التحذيرات ({categorizedSessions.safe.length + categorizedSessions.warnings.length})
                  </Button>
                )}
              </div>
            </>
          )}

          {/* Success Screen */}
          {showSuccessDialog && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center">
                <Check className="h-8 w-8 text-success" />
              </div>
              <div className="text-center">
                <p className="text-xl font-bold mb-1">تم بنجاح!</p>
                <p className="text-muted-foreground">
                  تم تعديل {lastApplyResult.safe + lastApplyResult.warnings} جلسة
                </p>
              </div>

              <div className="bg-muted/50 rounded-lg p-3 w-full text-sm">
                <div className="flex justify-between mb-1">
                  <span>جلسات آمنة:</span>
                  <span className="font-medium text-success">{lastApplyResult.safe}</span>
                </div>
                {lastApplyResult.warnings > 0 && (
                  <div className="flex justify-between mb-1">
                    <span>تحذيرات مقبولة:</span>
                    <span className="font-medium text-warning">{lastApplyResult.warnings}</span>
                  </div>
                )}
                {lastApplyResult.conflicts > 0 && (
                  <div className="flex justify-between">
                    <span>تعارضات تم تخطيها:</span>
                    <span className="font-medium text-destructive">{lastApplyResult.conflicts}</span>
                  </div>
                )}
              </div>

              {undoData && undoTimeLeft > 0 && (
                <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 w-full text-center">
                  <p className="text-sm mb-2">يمكنك التراجع خلال {formatUndoTimeLeft()}</p>
                  <Button variant="outline" size="sm" onClick={handleUndo} className="gap-1">
                    <Undo2 className="h-3.5 w-3.5" />
                    تراجع عن التغييرات
                  </Button>
                </div>
              )}

              <Button onClick={() => { setOpen(false); resetForm(); }} className="w-full">
                تم
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
