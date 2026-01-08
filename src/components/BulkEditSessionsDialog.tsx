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
  addDays,
  isSameMonth,
  isWithinInterval,
} from 'date-fns';
import { Calendar, Clock, User, Undo2, CheckCircle2, XCircle, AlertCircle, ArrowDown, CheckSquare, Square } from 'lucide-react';
import { Student, Session } from '@/types/student';
import { formatShortDateAr, DAY_NAMES_AR, MONTH_NAMES_AR } from '@/lib/arabicConstants';
import { Button } from '@/components/ui/button';
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
import { Checkbox } from '@/components/ui/checkbox';

interface BulkEditSessionsDialogProps {
  students: Student[];
  onBulkUpdateTime: (
    studentIds: string[],
    sessionIds: string[],
    newTime: string
  ) => { success: boolean; updatedCount: number; conflicts: ConflictInfo[] };
  onUpdateSessionDate?: (
    studentId: string,
    sessionId: string,
    newDate: string,
    newTime: string
  ) => void;
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
  originalDate: string;
  newDate: string;
  weekLabel?: string;
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
  sessionUpdates: { sessionId: string; studentId: string; originalTime: string; originalDate: string }[];
  timestamp: number;
  count: number;
  studentName: string;
}

interface WeekOption {
  id: string;
  label: string;
  dateRange: string;
  startDate: Date;
  endDate: Date;
}

interface MonthOption {
  id: string;
  label: string;
  year: number;
  month: number;
  startDate: Date;
  endDate: Date;
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

// Generate time options for dropdown (every 30 mins)
const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const hour = Math.floor(i / 2);
  const min = (i % 2) * 30;
  return `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
});

// Day of week options (0 = Sunday, 6 = Saturday)
const DAY_OPTIONS = [
  { value: 0, label: 'الأحد' },
  { value: 1, label: 'الاثنين' },
  { value: 2, label: 'الثلاثاء' },
  { value: 3, label: 'الأربعاء' },
  { value: 4, label: 'الخميس' },
  { value: 5, label: 'الجمعة' },
  { value: 6, label: 'السبت' },
];

type ModificationType = 'offset' | 'specific' | 'day-change';

// Calculate new date when changing day of week
const calculateNewDate = (originalDate: string, originalDay: number, newDay: number): string => {
  const date = parseISO(originalDate);
  const currentDay = getDay(date);
  
  // Calculate day difference
  let dayDiff = newDay - currentDay;
  
  // If new day is before or same as original day in the week, move to next week
  if (dayDiff <= 0) {
    dayDiff += 7;
  }
  
  const newDate = addDays(date, dayDiff);
  return format(newDate, 'yyyy-MM-dd');
};

// Format date range for display
const formatDateRangeAr = (start: Date, end: Date): string => {
  const startDay = format(start, 'd');
  const endDay = format(end, 'd');
  const startMonth = MONTH_NAMES_AR[start.getMonth()];
  const endMonth = MONTH_NAMES_AR[end.getMonth()];
  
  if (startMonth === endMonth) {
    return `${startDay}-${endDay} ${startMonth}`;
  }
  return `${startDay} ${startMonth} - ${endDay} ${endMonth}`;
};

// Generate week options (next 8 weeks)
const generateWeekOptions = (today: Date): WeekOption[] => {
  const weeks: WeekOption[] = [];
  const weekLabels = ['هذا الأسبوع', 'الأسبوع القادم', 'الأسبوع الثالث', 'الأسبوع الرابع', 'الأسبوع الخامس', 'الأسبوع السادس', 'الأسبوع السابع', 'الأسبوع الثامن'];
  
  for (let i = 0; i < 8; i++) {
    const weekStart = i === 0 ? today : startOfWeek(addWeeks(today, i), { weekStartsOn: 0 });
    const weekEnd = endOfWeek(addWeeks(today, i), { weekStartsOn: 0 });
    
    weeks.push({
      id: `week-${i}`,
      label: weekLabels[i],
      dateRange: formatDateRangeAr(weekStart, weekEnd),
      startDate: weekStart,
      endDate: weekEnd,
    });
  }
  
  return weeks;
};

// Generate month options (next 6 months)
const generateMonthOptions = (today: Date): MonthOption[] => {
  const months: MonthOption[] = [];
  
  for (let i = 0; i < 6; i++) {
    const monthDate = addMonths(today, i);
    const monthStart = i === 0 ? today : startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthDate);
    
    months.push({
      id: `month-${i}`,
      label: `${MONTH_NAMES_AR[monthDate.getMonth()]} ${monthDate.getFullYear()}`,
      year: monthDate.getFullYear(),
      month: monthDate.getMonth(),
      startDate: monthStart,
      endDate: monthEnd,
    });
  }
  
  return months;
};

export const BulkEditSessionsDialog = ({
  students,
  onBulkUpdateTime,
  onUpdateSessionDate,
}: BulkEditSessionsDialogProps) => {
  const [open, setOpen] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [lastApplyResult, setLastApplyResult] = useState<{ safe: number; warnings: number; conflicts: number }>({ safe: 0, warnings: 0, conflicts: 0 });

  // Filters
  const today = startOfDay(new Date());
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  
  // Multi-period selection
  const [selectedWeeks, setSelectedWeeks] = useState<Set<string>>(new Set());
  const [selectedMonths, setSelectedMonths] = useState<Set<string>>(new Set());
  const [useCustomRange, setUseCustomRange] = useState(false);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(today);
  const [dateTo, setDateTo] = useState<Date | undefined>(endOfMonth(today));

  // Generate options
  const weekOptions = useMemo(() => generateWeekOptions(today), [today]);
  const monthOptions = useMemo(() => generateMonthOptions(today), [today]);

  // Modification type
  const [modType, setModType] = useState<ModificationType>('offset');

  // Offset modification
  const [offsetDirection, setOffsetDirection] = useState<'+' | '-'>('+');
  const [offsetHours, setOffsetHours] = useState<number>(4);
  const [offsetMinutes, setOffsetMinutes] = useState<number>(0);

  // Specific time modification
  const [specificTime, setSpecificTime] = useState<string>('');

  // Day change modification
  const [originalDay, setOriginalDay] = useState<number>(1); // Monday
  const [originalTime, setOriginalTime] = useState<string>('16:00');
  const [newDay, setNewDay] = useState<number>(5); // Friday
  const [newTime, setNewTime] = useState<string>('13:00');

  // Undo state
  const [undoData, setUndoData] = useState<UndoData | null>(null);
  const [undoTimeLeft, setUndoTimeLeft] = useState<number>(0);

  // Toggle week selection
  const toggleWeek = (weekId: string) => {
    setUseCustomRange(false);
    const newSelected = new Set(selectedWeeks);
    if (newSelected.has(weekId)) {
      newSelected.delete(weekId);
    } else {
      newSelected.add(weekId);
    }
    setSelectedWeeks(newSelected);
  };

  // Toggle month selection (also toggles all weeks in that month)
  const toggleMonth = (monthId: string) => {
    setUseCustomRange(false);
    const newSelectedMonths = new Set(selectedMonths);
    const month = monthOptions.find(m => m.id === monthId);
    
    if (!month) return;
    
    if (newSelectedMonths.has(monthId)) {
      newSelectedMonths.delete(monthId);
      // Unselect weeks that fall within this month
      const newSelectedWeeks = new Set(selectedWeeks);
      weekOptions.forEach(week => {
        if (isSameMonth(week.startDate, month.startDate) || isSameMonth(week.endDate, month.startDate)) {
          newSelectedWeeks.delete(week.id);
        }
      });
      setSelectedWeeks(newSelectedWeeks);
    } else {
      newSelectedMonths.add(monthId);
      // Select weeks that fall within this month
      const newSelectedWeeks = new Set(selectedWeeks);
      weekOptions.forEach(week => {
        if (isSameMonth(week.startDate, month.startDate) || isSameMonth(week.endDate, month.startDate)) {
          newSelectedWeeks.add(week.id);
        }
      });
      setSelectedWeeks(newSelectedWeeks);
    }
    
    setSelectedMonths(newSelectedMonths);
  };

  // Select all
  const selectAll = () => {
    setUseCustomRange(false);
    setSelectedWeeks(new Set(weekOptions.map(w => w.id)));
    setSelectedMonths(new Set(monthOptions.map(m => m.id)));
  };

  // Deselect all
  const deselectAll = () => {
    setSelectedWeeks(new Set());
    setSelectedMonths(new Set());
    setUseCustomRange(false);
  };

  // Check if date is within any selected period
  const isDateInSelectedPeriods = (dateStr: string): { inPeriod: boolean; weekLabel?: string } => {
    const date = parseISO(dateStr);
    
    if (useCustomRange && dateFrom && dateTo) {
      if (isWithinInterval(date, { start: dateFrom, end: dateTo })) {
        return { inPeriod: true, weekLabel: 'نطاق مخصص' };
      }
      return { inPeriod: false };
    }
    
    // Check weeks
    for (const weekId of selectedWeeks) {
      const week = weekOptions.find(w => w.id === weekId);
      if (week && isWithinInterval(date, { start: week.startDate, end: week.endDate })) {
        return { inPeriod: true, weekLabel: `${week.label} (${week.dateRange})` };
      }
    }
    
    return { inPeriod: false };
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

  // Calculate new time based on offset modification
  const calculateOffsetTime = (sessionTime: string): string => {
    const originalMinutes = timeToMinutes(sessionTime);
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

  // Check if any period is selected
  const hasSelectedPeriod = useMemo(() => {
    return selectedWeeks.size > 0 || selectedMonths.size > 0 || useCustomRange;
  }, [selectedWeeks, selectedMonths, useCustomRange]);

  // Calculate matching sessions with new times/dates
  const matchingSessions = useMemo(() => {
    const sessions: SessionWithStudent[] = [];
    
    if (!selectedStudentId || !selectedStudent || !hasSelectedPeriod) return sessions;

    selectedStudent.sessions.forEach(session => {
      // Only scheduled sessions
      if (session.status !== 'scheduled') return;
      
      // Must be in selected period
      const { inPeriod, weekLabel } = isDateInSelectedPeriods(session.date);
      if (!inPeriod) return;

      const sessionTime = session.time || selectedStudent.sessionTime || '16:00';

      // For day-change mode, filter by original day and time
      if (modType === 'day-change') {
        const sessionDay = getDay(parseISO(session.date));
        if (sessionDay !== originalDay) return;
        
        // Check if time matches (within 30 min tolerance for matching)
        const sessionMinutes = timeToMinutes(sessionTime);
        const originalMinutes = timeToMinutes(originalTime);
        if (Math.abs(sessionMinutes - originalMinutes) > 30) return;
      }

      let calculatedNewTime: string;
      let calculatedNewDate: string = session.date;

      if (modType === 'offset') {
        calculatedNewTime = calculateOffsetTime(sessionTime);
      } else if (modType === 'specific') {
        calculatedNewTime = specificTime || sessionTime;
      } else {
        // day-change
        calculatedNewTime = newTime;
        calculatedNewDate = calculateNewDate(session.date, originalDay, newDay);
      }

      sessions.push({
        session,
        student: selectedStudent,
        originalTime: sessionTime,
        newTime: calculatedNewTime,
        originalDate: session.date,
        newDate: calculatedNewDate,
        weekLabel,
      });
    });

    return sessions.sort((a, b) => a.session.date.localeCompare(b.session.date));
  }, [selectedStudent, selectedStudentId, hasSelectedPeriod, selectedWeeks, selectedMonths, useCustomRange, dateFrom, dateTo, modType, offsetDirection, offsetHours, offsetMinutes, specificTime, originalDay, originalTime, newDay, newTime, weekOptions]);

  // Group sessions by week for preview
  const sessionsByWeek = useMemo(() => {
    const groups: { [key: string]: SessionWithStudent[] } = {};
    
    matchingSessions.forEach(session => {
      const key = session.weekLabel || 'أخرى';
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(session);
    });
    
    return groups;
  }, [matchingSessions]);

  // Categorize sessions by conflict status
  const categorizedSessions = useMemo((): CategorizedSessions => {
    const result: CategorizedSessions = { safe: [], warnings: [], conflicts: [] };
    const sessionDuration = 60;
    const minGap = 15;

    matchingSessions.forEach(sessionData => {
      const { session, student, newTime: sessNewTime, newDate: sessNewDate } = sessionData;
      const newStartMinutes = timeToMinutes(sessNewTime);
      const newEndMinutes = newStartMinutes + sessionDuration;

      let conflictType = 'none' as 'none' | 'close' | 'overlap';

      // Check against all other sessions on the NEW date from OTHER students
      students.forEach(otherStudent => {
        if (otherStudent.id === student.id) return; // Skip same student
        
        otherStudent.sessions.forEach(otherSession => {
          if (otherSession.date !== sessNewDate) return;
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

    if (!hasSelectedPeriod) {
      toast({
        title: 'اختر فترة زمنية',
        description: 'يجب اختيار أسبوع واحد على الأقل',
        variant: 'destructive',
      });
      return;
    }

    if (modType === 'day-change' && originalDay === newDay) {
      toast({
        title: 'اليوم متطابق',
        description: 'اليوم الأصلي والجديد متطابقان. استخدم "تحويل بمقدار زمني" بدلاً من ذلك',
        variant: 'destructive',
      });
      return;
    }

    if (matchingSessions.length === 0) {
      if (modType === 'day-change') {
        toast({
          title: 'لا توجد جلسات',
          description: `لا توجد جلسات لـ ${selectedStudent?.name} في ${DAY_OPTIONS.find(d => d.value === originalDay)?.label} الساعة ${formatTimeAr(originalTime)} خلال الفترات المختارة`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'لا توجد جلسات',
          description: `لا توجد جلسات مجدولة لـ ${selectedStudent?.name || 'الطالب'} في الفترات المختارة`,
          variant: 'destructive',
        });
      }
      return;
    }

    if (modType === 'specific' && !specificTime) {
      toast({
        title: 'خطأ',
        description: 'الرجاء تحديد الوقت الجديد',
        variant: 'destructive',
      });
      return;
    }

    if (modType === 'offset' && offsetHours === 0 && offsetMinutes === 0) {
      toast({
        title: 'خطأ',
        description: 'الرجاء تحديد مقدار التعديل',
        variant: 'destructive',
      });
      return;
    }

    // Validate offset range (-12h to +12h)
    if (modType === 'offset') {
      const totalOffset = offsetHours * 60 + offsetMinutes;
      if (totalOffset > 12 * 60) {
        toast({
          title: 'خطأ',
          description: 'الحد الأقصى للتعديل 12 ساعة',
          variant: 'destructive',
        });
        return;
      }
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
        originalDate: s.originalDate,
      })),
      timestamp: Date.now(),
      count: sessionsToApply.length,
      studentName: selectedStudent?.name || '',
    };
    localStorage.setItem(UNDO_STORAGE_KEY, JSON.stringify(undoInfo));
    setUndoData(undoInfo);

    // Apply changes
    sessionsToApply.forEach(s => {
      if (modType === 'day-change' && onUpdateSessionDate) {
        // Update both date and time
        onUpdateSessionDate(s.student.id, s.session.id, s.newDate, s.newTime);
      } else {
        // Just update time
        onBulkUpdateTime([s.student.id], [s.session.id], s.newTime);
      }
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

    // Restore original times and dates
    undoData.sessionUpdates.forEach(update => {
      if (onUpdateSessionDate) {
        onUpdateSessionDate(update.studentId, update.sessionId, update.originalDate, update.originalTime);
      } else {
        onBulkUpdateTime([update.studentId], [update.sessionId], update.originalTime);
      }
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
    setSelectedWeeks(new Set());
    setSelectedMonths(new Set());
    setUseCustomRange(false);
    setDateFrom(today);
    setDateTo(endOfMonth(today));
    setModType('offset');
    setOffsetDirection('+');
    setOffsetHours(4);
    setOffsetMinutes(0);
    setSpecificTime('');
    setOriginalDay(1);
    setOriginalTime('16:00');
    setNewDay(5);
    setNewTime('13:00');
    setShowPreview(false);
  };

  const formatUndoTimeLeft = () => {
    const minutes = Math.floor(undoTimeLeft / 60000);
    const seconds = Math.floor((undoTimeLeft % 60000) / 1000);
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  };

  // Format date with day name in Arabic
  const formatDateWithDay = (dateStr: string): string => {
    const date = parseISO(dateStr);
    const dayIndex = getDay(date);
    const dayName = DAY_OPTIONS.find(d => d.value === dayIndex)?.label || '';
    return `${dayName} ${formatShortDateAr(dateStr)}`;
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

                  {/* Step 2: Multi-Period Selection */}
                  <div className="space-y-3">
                    <Label className="flex items-center gap-1.5">
                      <Calendar className="h-4 w-4" />
                      الفترة الزمنية (يمكن اختيار أكثر من واحدة)
                    </Label>
                    
                    {/* Quick Actions */}
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-xs flex-1"
                        onClick={selectAll}
                      >
                        <CheckSquare className="h-3.5 w-3.5 ml-1" />
                        تحديد الكل
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-xs flex-1"
                        onClick={deselectAll}
                      >
                        <Square className="h-3.5 w-3.5 ml-1" />
                        إلغاء التحديد
                      </Button>
                    </div>
                    
                    {/* Weeks */}
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground font-medium">الأسابيع:</p>
                      <div className="grid grid-cols-1 gap-1.5 max-h-40 overflow-y-auto">
                        {weekOptions.map(week => (
                          <label
                            key={week.id}
                            className={cn(
                              'flex items-center gap-2 p-2 rounded-md border cursor-pointer transition-colors text-sm',
                              selectedWeeks.has(week.id) && !useCustomRange
                                ? 'border-primary bg-primary/5'
                                : 'border-border hover:border-primary/50'
                            )}
                          >
                            <Checkbox
                              checked={selectedWeeks.has(week.id) && !useCustomRange}
                              onCheckedChange={() => toggleWeek(week.id)}
                            />
                            <span className="font-medium">{week.label}</span>
                            <span className="text-muted-foreground text-xs mr-auto">({week.dateRange})</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Months */}
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground font-medium">أو الأشهر الكاملة:</p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {monthOptions.map(month => (
                          <label
                            key={month.id}
                            className={cn(
                              'flex items-center gap-2 p-2 rounded-md border cursor-pointer transition-colors text-sm',
                              selectedMonths.has(month.id) && !useCustomRange
                                ? 'border-primary bg-primary/5'
                                : 'border-border hover:border-primary/50'
                            )}
                          >
                            <Checkbox
                              checked={selectedMonths.has(month.id) && !useCustomRange}
                              onCheckedChange={() => toggleMonth(month.id)}
                            />
                            <span className="font-medium">{month.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Custom Date Range */}
                    <div className="space-y-1.5">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={useCustomRange}
                          onCheckedChange={(checked) => {
                            setUseCustomRange(!!checked);
                            if (checked) {
                              setSelectedWeeks(new Set());
                              setSelectedMonths(new Set());
                            }
                          }}
                        />
                        <span className="text-xs text-muted-foreground font-medium">أو نطاق مخصص</span>
                      </label>
                      
                      {useCustomRange && (
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          <div>
                            <span className="text-xs text-muted-foreground">من</span>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  className={cn('w-full justify-start text-right font-normal text-sm', !dateFrom && 'text-muted-foreground')}
                                >
                                  {dateFrom ? format(dateFrom, 'dd/MM/yyyy') : 'اختر تاريخ'}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <CalendarPicker
                                  mode="single"
                                  selected={dateFrom}
                                  onSelect={setDateFrom}
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
                                  className={cn('w-full justify-start text-right font-normal text-sm', !dateTo && 'text-muted-foreground')}
                                >
                                  {dateTo ? format(dateTo, 'dd/MM/yyyy') : 'اختر تاريخ'}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <CalendarPicker
                                  mode="single"
                                  selected={dateTo}
                                  onSelect={setDateTo}
                                  disabled={date => dateFrom ? isBefore(date, dateFrom) : false}
                                  initialFocus
                                  className="pointer-events-auto"
                                />
                              </PopoverContent>
                            </Popover>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Session Count */}
                    {selectedStudentId && hasSelectedPeriod && (
                      <div className="text-sm font-medium text-primary">
                        {matchingSessions.length} جلسة محددة
                      </div>
                    )}
                  </div>

                  {/* Step 3: Modification Type */}
                  <div className="space-y-3">
                    <Label className="flex items-center gap-1.5">
                      <Clock className="h-4 w-4" />
                      نوع التعديل
                    </Label>

                    <RadioGroup value={modType} onValueChange={(v) => setModType(v as ModificationType)}>
                      {/* Offset Option */}
                      <div className={cn('border rounded-lg p-3 transition-colors', modType === 'offset' && 'border-primary bg-primary/5')}>
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value="offset" id="offset" />
                          <Label htmlFor="offset" className="font-medium cursor-pointer">تحويل بمقدار زمني</Label>
                        </div>
                        {modType === 'offset' && (
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
                              (مثال: 4:00 م → {formatTimeAr(calculateOffsetTime('16:00'))})
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Day + Time Change Option */}
                      <div className={cn('border rounded-lg p-3 transition-colors', modType === 'day-change' && 'border-primary bg-primary/5')}>
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value="day-change" id="day-change" />
                          <Label htmlFor="day-change" className="font-medium cursor-pointer">تغيير اليوم والوقت</Label>
                        </div>
                        {modType === 'day-change' && (
                          <div className="mt-3 space-y-3">
                            {/* Original Day + Time */}
                            <div className="space-y-2">
                              <p className="text-xs text-muted-foreground">من:</p>
                              <div className="flex gap-2">
                                <Select value={String(originalDay)} onValueChange={(v) => setOriginalDay(Number(v))}>
                                  <SelectTrigger className="flex-1">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {DAY_OPTIONS.map(d => (
                                      <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <span className="text-xs text-muted-foreground self-center">في</span>
                                <Select value={originalTime} onValueChange={setOriginalTime}>
                                  <SelectTrigger className="w-28">
                                    <SelectValue>{formatTimeAr(originalTime)}</SelectValue>
                                  </SelectTrigger>
                                  <SelectContent>
                                    {TIME_OPTIONS.map(t => (
                                      <SelectItem key={t} value={t}>{formatTimeAr(t)}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            {/* Arrow */}
                            <div className="flex justify-center">
                              <ArrowDown className="h-4 w-4 text-muted-foreground" />
                            </div>

                            {/* New Day + Time */}
                            <div className="space-y-2">
                              <p className="text-xs text-muted-foreground">إلى:</p>
                              <div className="flex gap-2">
                                <Select value={String(newDay)} onValueChange={(v) => setNewDay(Number(v))}>
                                  <SelectTrigger className="flex-1">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {DAY_OPTIONS.map(d => (
                                      <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <span className="text-xs text-muted-foreground self-center">في</span>
                                <Select value={newTime} onValueChange={setNewTime}>
                                  <SelectTrigger className="w-28">
                                    <SelectValue>{formatTimeAr(newTime)}</SelectValue>
                                  </SelectTrigger>
                                  <SelectContent>
                                    {TIME_OPTIONS.map(t => (
                                      <SelectItem key={t} value={t}>{formatTimeAr(t)}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </RadioGroup>
                  </div>
                </div>
              </ScrollArea>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-4 border-t">
                <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>
                  إلغاء
                </Button>
                <Button className="flex-1 gap-1" onClick={handleShowPreview}>
                  معاينة التغييرات
                  <ArrowDown className="h-4 w-4 -rotate-90" />
                </Button>
              </div>
            </>
          )}

          {/* Preview View */}
          {showPreview && !showSuccessDialog && (
            <>
              <div className="flex items-center gap-2 mb-3">
                <Button variant="ghost" size="sm" onClick={() => setShowPreview(false)}>
                  <ArrowDown className="h-4 w-4 rotate-90" />
                </Button>
                <span className="font-medium">المعاينة ({matchingSessions.length} جلسة)</span>
              </div>

              {/* Stats Summary */}
              <div className="flex gap-3 mb-3 text-sm">
                <div className="flex items-center gap-1 text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>آمنة: {categorizedSessions.safe.length}</span>
                </div>
                <div className="flex items-center gap-1 text-yellow-600">
                  <AlertCircle className="h-4 w-4" />
                  <span>تحذيرات: {categorizedSessions.warnings.length}</span>
                </div>
                <div className="flex items-center gap-1 text-red-600">
                  <XCircle className="h-4 w-4" />
                  <span>تعارضات: {categorizedSessions.conflicts.length}</span>
                </div>
              </div>

              {/* Sessions List Grouped by Week */}
              <ScrollArea className="flex-1 -mx-6 px-6">
                <div className="space-y-4 pb-4">
                  {Object.entries(sessionsByWeek).map(([weekLabel, sessions]) => (
                    <div key={weekLabel} className="space-y-2">
                      <h4 className="text-sm font-medium text-muted-foreground border-b pb-1">
                        {weekLabel}
                      </h4>
                      <div className="space-y-2">
                        {sessions.map(sessionData => {
                          const isConflict = categorizedSessions.conflicts.some(c => c.session.id === sessionData.session.id);
                          const isWarning = categorizedSessions.warnings.some(w => w.session.id === sessionData.session.id);
                          
                          return (
                            <div
                              key={sessionData.session.id}
                              className={cn(
                                'p-3 rounded-lg border text-sm',
                                isConflict && 'border-red-300 bg-red-50',
                                isWarning && 'border-yellow-300 bg-yellow-50',
                                !isConflict && !isWarning && 'border-green-300 bg-green-50'
                              )}
                            >
                              <div className="flex items-center gap-2 mb-1">
                                {isConflict ? (
                                  <XCircle className="h-4 w-4 text-red-600" />
                                ) : isWarning ? (
                                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                                ) : (
                                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                                )}
                                <span className="font-medium">{formatDateWithDay(sessionData.originalDate)}</span>
                              </div>
                              
                              <div className="mr-6 text-muted-foreground">
                                {modType === 'day-change' ? (
                                  <>
                                    <div>{formatDateWithDay(sessionData.originalDate)}، {formatTimeAr(sessionData.originalTime)}</div>
                                    <div className="my-1 text-primary">↓</div>
                                    <div>{formatDateWithDay(sessionData.newDate)}، {formatTimeAr(sessionData.newTime)}</div>
                                  </>
                                ) : (
                                  <>
                                    {formatTimeAr(sessionData.originalTime)} → {formatTimeAr(sessionData.newTime)}
                                  </>
                                )}
                              </div>
                              
                              {isWarning && (
                                <p className="text-xs text-yellow-700 mt-1 mr-6">تحذير: فاصل أقل من 15 دقيقة</p>
                              )}
                              {isConflict && (
                                <p className="text-xs text-red-700 mt-1 mr-6">تعارض: توجد جلسة أخرى في نفس الوقت</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              {/* Apply Buttons */}
              <div className="flex flex-col gap-2 pt-4 border-t">
                {categorizedSessions.conflicts.length > 0 && (
                  <p className="text-xs text-red-600 text-center">
                    لا يمكن تطبيق الجلسات المتعارضة ({categorizedSessions.conflicts.length})
                  </p>
                )}
                
                {categorizedSessions.warnings.length > 0 && categorizedSessions.safe.length > 0 && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => applyChanges(false)}
                    >
                      تطبيق الآمنة فقط ({categorizedSessions.safe.length})
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={() => applyChanges(true)}
                    >
                      تطبيق الكل ({categorizedSessions.safe.length + categorizedSessions.warnings.length})
                    </Button>
                  </div>
                )}
                
                {categorizedSessions.warnings.length === 0 && categorizedSessions.safe.length > 0 && (
                  <Button className="w-full" onClick={() => applyChanges(false)}>
                    تطبيق التغييرات ({categorizedSessions.safe.length})
                  </Button>
                )}
                
                {categorizedSessions.safe.length === 0 && categorizedSessions.warnings.length > 0 && (
                  <Button className="w-full" onClick={() => applyChanges(true)}>
                    تطبيق مع التحذيرات ({categorizedSessions.warnings.length})
                  </Button>
                )}
              </div>
            </>
          )}

          {/* Success Dialog */}
          {showSuccessDialog && (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              
              <div>
                <h3 className="text-lg font-medium">✓ تم تحديث {lastApplyResult.safe + lastApplyResult.warnings} جلسة</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  لـ {selectedStudent?.name}
                </p>
              </div>

              {undoData && undoTimeLeft > 0 && (
                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="text-sm mb-2">يمكنك التراجع عن هذا التعديل</p>
                  <Button variant="outline" onClick={handleUndo} className="gap-1">
                    <Undo2 className="h-4 w-4" />
                    تراجع عن التغييرات
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2">
                    متاح لمدة {formatUndoTimeLeft()}
                  </p>
                </div>
              )}

              <Button
                variant="outline"
                onClick={() => {
                  resetForm();
                  setShowSuccessDialog(false);
                  setOpen(false);
                }}
              >
                إغلاق
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
