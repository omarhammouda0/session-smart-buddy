import { useState, useMemo } from 'react';
import { format, parseISO, isBefore, isAfter, startOfDay } from 'date-fns';
import { Calendar, Clock, Users, AlertTriangle, Check, ChevronLeft } from 'lucide-react';
import { Student, Session } from '@/types/student';
import { DAY_NAMES_AR, DAY_NAMES_SHORT_AR, formatShortDateAr } from '@/lib/arabicConstants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
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

// Helper to add minutes to time string
const addMinutesToTime = (time: string, minutes: number): string => {
  const [h, m] = time.split(':').map(Number);
  const totalMinutes = h * 60 + m + minutes;
  const newH = Math.floor(totalMinutes / 60) % 24;
  const newM = totalMinutes % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
};

// Helper to parse time to minutes
const timeToMinutes = (time: string): number => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

// Format time in Arabic (12-hour)
const formatTimeAr = (time: string): string => {
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
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [conflicts, setConflicts] = useState<ConflictInfo[]>([]);

  // Filters
  const today = startOfDay(new Date());
  const [dateFrom, setDateFrom] = useState<Date | undefined>(today);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('all');
  const [selectedDays, setSelectedDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [currentTimeFilter, setCurrentTimeFilter] = useState<string>('all');
  const [newTime, setNewTime] = useState<string>('');

  // Calculate matching sessions
  const matchingSessions = useMemo(() => {
    const sessions: SessionWithStudent[] = [];
    const todayStr = format(today, 'yyyy-MM-dd');

    students.forEach(student => {
      // Filter by student
      if (selectedStudentId !== 'all' && student.id !== selectedStudentId) return;

      student.sessions.forEach(session => {
        // Only scheduled sessions (not completed/cancelled)
        if (session.status !== 'scheduled') return;

        // Only future sessions
        if (session.date < todayStr) return;

        // Filter by date range
        if (dateFrom && session.date < format(dateFrom, 'yyyy-MM-dd')) return;
        if (dateTo && session.date > format(dateTo, 'yyyy-MM-dd')) return;

        // Filter by day of week
        const sessionDate = parseISO(session.date);
        if (!selectedDays.includes(sessionDate.getDay())) return;

        // Filter by current time (if specified)
        if (currentTimeFilter !== 'all' && student.sessionTime !== currentTimeFilter) return;

        sessions.push({
          session,
          student,
          newTime: newTime || student.sessionTime,
        });
      });
    });

    // Sort by date then by student time
    return sessions.sort((a, b) => {
      const dateCompare = a.session.date.localeCompare(b.session.date);
      if (dateCompare !== 0) return dateCompare;
      return (a.student.sessionTime || '16:00').localeCompare(b.student.sessionTime || '16:00');
    });
  }, [students, selectedStudentId, dateFrom, dateTo, selectedDays, currentTimeFilter, newTime, today]);

  // Get unique times from students for filter
  const uniqueTimes = useMemo(() => {
    const times = new Set<string>();
    students.forEach(s => {
      if (s.sessionTime) times.add(s.sessionTime);
    });
    return Array.from(times).sort();
  }, [students]);

  // Check for conflicts when applying
  const checkConflicts = (): ConflictInfo[] => {
    if (!newTime) return [];

    const foundConflicts: ConflictInfo[] = [];
    const sessionDuration = 60; // Fixed 60 minutes
    const minGap = 15; // Minimum gap in minutes

    matchingSessions.forEach(({ session, student }) => {
      const sessionDate = session.date;
      const newStartMinutes = timeToMinutes(newTime);
      const newEndMinutes = newStartMinutes + sessionDuration;

      // Check against all other sessions on the same date
      students.forEach(otherStudent => {
        otherStudent.sessions.forEach(otherSession => {
          // Skip same session
          if (otherSession.id === session.id) return;
          // Skip if not same date
          if (otherSession.date !== sessionDate) return;
          // Skip cancelled sessions
          if (otherSession.status === 'cancelled') return;

          // Check if this session is also being updated
          const isAlsoBeingUpdated = matchingSessions.some(
            ms => ms.session.id === otherSession.id
          );

          const otherTime = isAlsoBeingUpdated ? newTime : otherStudent.sessionTime;
          const otherStartMinutes = timeToMinutes(otherTime);
          const otherEndMinutes = otherStartMinutes + sessionDuration;

          // Exact overlap
          if (newStartMinutes === otherStartMinutes && student.id !== otherStudent.id) {
            foundConflicts.push({
              session,
              student,
              conflictsWith: { session: otherSession, student: otherStudent },
              type: 'exact',
            });
            return;
          }

          // Partial overlap
          const overlaps =
            (newStartMinutes >= otherStartMinutes && newStartMinutes < otherEndMinutes) ||
            (newEndMinutes > otherStartMinutes && newEndMinutes <= otherEndMinutes) ||
            (newStartMinutes <= otherStartMinutes && newEndMinutes >= otherEndMinutes);

          if (overlaps && student.id !== otherStudent.id) {
            foundConflicts.push({
              session,
              student,
              conflictsWith: { session: otherSession, student: otherStudent },
              type: 'partial',
            });
            return;
          }

          // Too close
          const gapBefore = Math.abs(newStartMinutes - otherEndMinutes);
          const gapAfter = Math.abs(otherStartMinutes - newEndMinutes);
          const gap = Math.min(gapBefore, gapAfter);

          if (gap > 0 && gap < minGap && student.id !== otherStudent.id) {
            foundConflicts.push({
              session,
              student,
              conflictsWith: { session: otherSession, student: otherStudent },
              type: 'close',
              gap,
            });
          }
        });
      });
    });

    return foundConflicts;
  };

  const handleApply = () => {
    if (!newTime) {
      toast({
        title: 'خطأ',
        description: 'الرجاء تحديد الوقت الجديد',
        variant: 'destructive',
      });
      return;
    }

    if (matchingSessions.length === 0) {
      toast({
        title: 'لا توجد جلسات',
        description: 'لا توجد جلسات تطابق المعايير المحددة',
        variant: 'destructive',
      });
      return;
    }

    const foundConflicts = checkConflicts();
    
    if (foundConflicts.some(c => c.type === 'exact' || c.type === 'partial')) {
      setConflicts(foundConflicts);
      setShowConflictDialog(true);
      return;
    }

    // If only close conflicts (warnings), show them but allow proceed
    if (foundConflicts.length > 0) {
      setConflicts(foundConflicts);
      setShowConflictDialog(true);
      return;
    }

    // No conflicts - apply directly
    applyChanges();
  };

  const applyChanges = (skipConflicts = false) => {
    const sessionsToUpdate = skipConflicts
      ? matchingSessions.filter(
          ms => !conflicts.some(c => c.session.id === ms.session.id)
        )
      : matchingSessions;

    const studentIds = [...new Set(sessionsToUpdate.map(s => s.student.id))];
    const sessionIds = sessionsToUpdate.map(s => s.session.id);

    const result = onBulkUpdateTime(studentIds, sessionIds, newTime);

    if (result.success) {
      toast({
        title: '✓ تم تعديل الجلسات',
        description: `تم تعديل ${result.updatedCount} جلسة بنجاح`,
      });
      setOpen(false);
      resetForm();
    }
    setShowConflictDialog(false);
  };

  const resetForm = () => {
    setDateFrom(today);
    setDateTo(undefined);
    setSelectedStudentId('all');
    setSelectedDays([0, 1, 2, 3, 4, 5, 6]);
    setCurrentTimeFilter('');
    setNewTime('');
    setConflicts([]);
  };

  const toggleDay = (day: number) => {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
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

          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-5 pb-4">
              {/* Date Range */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  نطاق التاريخ
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-xs text-muted-foreground">من</span>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            'w-full justify-start text-right font-normal',
                            !dateFrom && 'text-muted-foreground'
                          )}
                        >
                          {dateFrom ? format(dateFrom, 'dd/MM/yyyy') : 'اختر تاريخ'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarPicker
                          mode="single"
                          selected={dateFrom}
                          onSelect={setDateFrom}
                          disabled={date => isBefore(date, today)}
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
                          className={cn(
                            'w-full justify-start text-right font-normal',
                            !dateTo && 'text-muted-foreground'
                          )}
                        >
                          {dateTo ? format(dateTo, 'dd/MM/yyyy') : 'اختر تاريخ'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarPicker
                          mode="single"
                          selected={dateTo}
                          onSelect={setDateTo}
                          disabled={date =>
                            isBefore(date, dateFrom || today)
                          }
                          initialFocus
                          className="pointer-events-auto"
                        />
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

              {/* Day Filter */}
              <div className="space-y-2">
                <Label>تصفية حسب اليوم</Label>
                <div className="flex flex-wrap gap-2">
                  {[0, 1, 2, 3, 4, 5, 6].map(day => (
                    <button
                      key={day}
                      onClick={() => toggleDay(day)}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-sm border transition-colors',
                        selectedDays.includes(day)
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-card border-border hover:border-primary/50'
                      )}
                    >
                      {DAY_NAMES_SHORT_AR[day]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Current Time Filter */}
              <div className="space-y-2">
                <Label>الوقت الحالي (اختياري)</Label>
              <Select value={currentTimeFilter} onValueChange={setCurrentTimeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="جميع الأوقات" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع الأوقات</SelectItem>
                    {uniqueTimes.map(time => (
                      <SelectItem key={time} value={time}>
                        {formatTimeAr(time)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* New Time */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  الوقت الجديد
                </Label>
                <Input
                  type="time"
                  value={newTime}
                  onChange={e => setNewTime(e.target.value)}
                  className="text-center"
                />
                {newTime && (
                  <p className="text-sm text-muted-foreground">
                    سيتم تغيير وقت الجلسات إلى {formatTimeAr(newTime)}
                  </p>
                )}
              </div>

              {/* Preview */}
              <div className="space-y-2">
                <Label>معاينة</Label>
                <div className="rounded-lg border bg-muted/30 p-3">
                  {matchingSessions.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      لا توجد جلسات تطابق المعايير المحددة
                    </p>
                  ) : (
                    <>
                      <p className="text-sm font-medium mb-2">
                        سيتم تعديل {matchingSessions.length} جلسة:
                      </p>
                      <ScrollArea className="h-[150px]">
                        <div className="space-y-1.5">
                          {matchingSessions.slice(0, 20).map(({ session, student }) => (
                            <div
                              key={session.id}
                              className="flex items-center justify-between text-sm bg-card rounded p-2"
                            >
                              <div>
                                <span className="font-medium">{student.name}</span>
                                <span className="text-muted-foreground mx-1">-</span>
                                <span className="text-muted-foreground">
                                  {formatShortDateAr(session.date)}
                                </span>
                              </div>
                              {newTime && (
                                <div className="flex items-center gap-1 text-xs">
                                  <span className="text-muted-foreground">
                                    {formatTimeAr(student.sessionTime || '16:00')}
                                  </span>
                                  <ChevronLeft className="h-3 w-3 text-primary" />
                                  <span className="text-primary font-medium">
                                    {formatTimeAr(newTime)}
                                  </span>
                                </div>
                              )}
                            </div>
                          ))}
                          {matchingSessions.length > 20 && (
                            <p className="text-xs text-muted-foreground text-center pt-2">
                              و {matchingSessions.length - 20} جلسة أخرى...
                            </p>
                          )}
                        </div>
                      </ScrollArea>
                    </>
                  )}
                </div>
              </div>
            </div>
          </ScrollArea>

          {/* Actions */}
          <div className="flex gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setOpen(false)} className="flex-1">
              إلغاء
            </Button>
            <Button
              onClick={handleApply}
              disabled={!newTime || matchingSessions.length === 0}
              className="flex-1"
            >
              <Check className="h-4 w-4 ml-1.5" />
              تطبيق التغييرات
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Conflict Dialog */}
      <AlertDialog open={showConflictDialog} onOpenChange={setShowConflictDialog}>
        <AlertDialogContent dir="rtl" className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              {conflicts.some(c => c.type === 'exact' || c.type === 'partial')
                ? 'تعارضات في المواعيد'
                : 'تحذير: جلسات قريبة'}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  {conflicts.some(c => c.type === 'exact' || c.type === 'partial')
                    ? `توجد ${conflicts.filter(c => c.type !== 'close').length} تعارضات في المواعيد`
                    : `توجد ${conflicts.length} جلسات قريبة من بعضها (أقل من 15 دقيقة)`}
                </p>
                <ScrollArea className="h-[120px]">
                  <div className="space-y-2">
                    {conflicts.slice(0, 5).map((conflict, i) => (
                      <div key={i} className="text-sm bg-muted rounded p-2">
                        <p className="font-medium">{conflict.student.name}</p>
                        <p className="text-muted-foreground text-xs">
                          {formatShortDateAr(conflict.session.date)}
                          {conflict.type === 'close' && ` (${conflict.gap} دقيقة فقط)`}
                        </p>
                        <p className="text-xs text-destructive">
                          تعارض مع: {conflict.conflictsWith.student.name}
                        </p>
                      </div>
                    ))}
                    {conflicts.length > 5 && (
                      <p className="text-xs text-muted-foreground">
                        و {conflicts.length - 5} تعارضات أخرى...
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            {conflicts.some(c => c.type === 'exact' || c.type === 'partial') ? (
              <AlertDialogAction onClick={() => applyChanges(true)}>
                تطبيق على الجلسات بدون تعارض
              </AlertDialogAction>
            ) : (
              <AlertDialogAction onClick={() => applyChanges(false)}>
                نعم، أكمل
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
