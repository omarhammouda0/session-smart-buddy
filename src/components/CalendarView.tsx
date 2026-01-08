import { useState, useMemo } from 'react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addWeeks, subWeeks, addMonths, subMonths, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { ChevronRight, ChevronLeft, Calendar as CalendarIcon, GripVertical, Clock, Monitor, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { Student, Session } from '@/types/student';
import { DAY_NAMES_AR, DAY_NAMES_SHORT_AR } from '@/lib/arabicConstants';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';

interface CalendarViewProps {
  students: Student[];
  onRescheduleSession: (studentId: string, sessionId: string, newDate: string) => void;
}

interface SessionWithStudent {
  session: Session;
  student: Student;
}

interface DragState {
  sessionId: string;
  studentId: string;
  studentName: string;
  originalDate: string;
}

export const CalendarView = ({ students, onRescheduleSession }: CalendarViewProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dropTargetDate, setDropTargetDate] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    sessionId: string;
    studentId: string;
    studentName: string;
    originalDate: string;
    newDate: string;
  } | null>(null);

  // Get all sessions grouped by date
  const sessionsByDate = useMemo(() => {
    const map = new Map<string, SessionWithStudent[]>();
    
    students.forEach(student => {
      student.sessions.forEach(session => {
        const existing = map.get(session.date) || [];
        existing.push({ session, student });
        map.set(session.date, existing);
      });
    });

    // Sort sessions by time within each day
    map.forEach((sessions, date) => {
      sessions.sort((a, b) => {
        const timeA = a.session.time || a.student.sessionTime || '16:00';
        const timeB = b.session.time || b.student.sessionTime || '16:00';
        return timeA.localeCompare(timeB);
      });
    });

    return map;
  }, [students]);

  // Get days for current view
  const days = useMemo(() => {
    if (viewMode === 'week') {
      const start = startOfWeek(currentDate, { weekStartsOn: 0 });
      const end = endOfWeek(currentDate, { weekStartsOn: 0 });
      return eachDayOfInterval({ start, end });
    } else {
      const start = startOfMonth(currentDate);
      const end = endOfMonth(currentDate);
      const monthDays = eachDayOfInterval({ start, end });
      
      // Add padding days for week alignment
      const firstDayOfWeek = start.getDay();
      const paddingStart = [];
      for (let i = firstDayOfWeek - 1; i >= 0; i--) {
        const date = new Date(start);
        date.setDate(date.getDate() - (i + 1));
        paddingStart.push(date);
      }
      
      const lastDayOfWeek = end.getDay();
      const paddingEnd = [];
      for (let i = 1; i <= 6 - lastDayOfWeek; i++) {
        const date = new Date(end);
        date.setDate(date.getDate() + i);
        paddingEnd.push(date);
      }
      
      return [...paddingStart, ...monthDays, ...paddingEnd];
    }
  }, [currentDate, viewMode]);

  // Navigation
  const goToPrev = () => {
    if (viewMode === 'week') {
      setCurrentDate(subWeeks(currentDate, 1));
    } else {
      setCurrentDate(subMonths(currentDate, 1));
    }
  };

  const goToNext = () => {
    if (viewMode === 'week') {
      setCurrentDate(addWeeks(currentDate, 1));
    } else {
      setCurrentDate(addMonths(currentDate, 1));
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, sessionId: string, studentId: string, studentName: string, date: string) => {
    e.dataTransfer.effectAllowed = 'move';
    setDragState({ sessionId, studentId, studentName, originalDate: date });
  };

  const handleDragEnd = () => {
    setDragState(null);
    setDropTargetDate(null);
  };

  const handleDragOver = (e: React.DragEvent, dateStr: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTargetDate(dateStr);
  };

  const handleDragLeave = () => {
    setDropTargetDate(null);
  };

  const handleDrop = (e: React.DragEvent, newDate: string) => {
    e.preventDefault();
    setDropTargetDate(null);

    if (!dragState) return;
    if (dragState.originalDate === newDate) {
      setDragState(null);
      return;
    }

    // Check if the student already has a session on the new date
    const student = students.find(s => s.id === dragState.studentId);
    const hasExistingSession = student?.sessions.some(
      s => s.date === newDate && s.id !== dragState.sessionId
    );

    if (hasExistingSession) {
      toast({
        title: "لا يمكن النقل",
        description: `${dragState.studentName} لديه حصة بالفعل في هذا التاريخ`,
        variant: "destructive",
      });
      setDragState(null);
      return;
    }

    // Show confirmation dialog
    setConfirmDialog({
      open: true,
      sessionId: dragState.sessionId,
      studentId: dragState.studentId,
      studentName: dragState.studentName,
      originalDate: dragState.originalDate,
      newDate,
    });
    setDragState(null);
  };

  const confirmReschedule = () => {
    if (!confirmDialog) return;
    
    onRescheduleSession(confirmDialog.studentId, confirmDialog.sessionId, confirmDialog.newDate);
    toast({
      title: "تم تعديل موعد الحصة",
      description: `تم نقل حصة ${confirmDialog.studentName} من ${format(parseISO(confirmDialog.originalDate), 'dd/MM')} إلى ${format(parseISO(confirmDialog.newDate), 'dd/MM')}`,
    });
    setConfirmDialog(null);
  };

  const getStatusColor = (status: Session['status']) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30';
      case 'cancelled':
        return 'bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30';
      case 'vacation':
        return 'bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30';
      default:
        return 'bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/30';
    }
  };

  const getStatusLabel = (status: Session['status']) => {
    switch (status) {
      case 'completed': return 'مكتملة';
      case 'cancelled': return 'ملغاة';
      case 'vacation': return 'إجازة';
      default: return 'مجدولة';
    }
  };

  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <CalendarIcon className="h-5 w-5 text-primary" />
            عرض التقويم
          </CardTitle>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'week' | 'month')} className="w-full sm:w-auto">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="week" className="text-xs sm:text-sm">أسبوعي</TabsTrigger>
                <TabsTrigger value="month" className="text-xs sm:text-sm">شهري</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" onClick={goToNext} className="h-8 w-8">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={goToPrev} className="h-8 w-8">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
          
          <h3 className="font-semibold text-sm sm:text-base">
            {viewMode === 'week' 
              ? `${format(days[0], 'dd MMM', { locale: ar })} - ${format(days[6], 'dd MMM yyyy', { locale: ar })}`
              : format(currentDate, 'MMMM yyyy', { locale: ar })
            }
          </h3>
          
          <Button variant="outline" size="sm" onClick={goToToday} className="text-xs h-8">
            اليوم
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-2 sm:p-4">
        {/* Week/Month Grid */}
        <div className={cn(
          "grid gap-1",
          viewMode === 'week' ? "grid-cols-7" : "grid-cols-7"
        )}>
          {/* Day headers */}
          {DAY_NAMES_SHORT_AR.map((day, i) => (
            <div key={i} className="text-center text-xs font-medium text-muted-foreground py-2 border-b">
              {day}
            </div>
          ))}

          {/* Day cells */}
          {days.map((day, index) => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const daySessions = sessionsByDate.get(dateStr) || [];
            const isCurrentMonth = viewMode === 'month' ? isSameMonth(day, currentDate) : true;
            const isToday = isSameDay(day, today);
            const isDragTarget = dropTargetDate === dateStr && dragState?.originalDate !== dateStr;

            return (
              <div
                key={index}
                className={cn(
                  "min-h-[80px] sm:min-h-[100px] border rounded-lg p-1 transition-colors",
                  !isCurrentMonth && "opacity-40",
                  isToday && "ring-2 ring-primary ring-offset-1",
                  isDragTarget && "bg-primary/10 border-primary border-dashed",
                  viewMode === 'month' && "min-h-[60px] sm:min-h-[80px]"
                )}
                onDragOver={(e) => handleDragOver(e, dateStr)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, dateStr)}
              >
                {/* Date number */}
                <div className={cn(
                  "text-xs font-medium mb-1 text-center",
                  isToday && "text-primary font-bold"
                )}>
                  {format(day, 'd')}
                </div>

                {/* Sessions */}
                <div className="space-y-0.5 max-h-[60px] sm:max-h-[80px] overflow-y-auto">
                  {daySessions.slice(0, viewMode === 'month' ? 2 : 5).map(({ session, student }) => {
                    const time = session.time || student.sessionTime || '16:00';
                    const canDrag = session.status === 'scheduled';
                    
                    return (
                      <div
                        key={session.id}
                        draggable={canDrag}
                        onDragStart={(e) => canDrag && handleDragStart(e, session.id, student.id, student.name, session.date)}
                        onDragEnd={handleDragEnd}
                        className={cn(
                          "text-[10px] sm:text-xs p-1 rounded border truncate flex items-center gap-0.5",
                          getStatusColor(session.status),
                          canDrag && "cursor-grab active:cursor-grabbing hover:opacity-80",
                          !canDrag && "cursor-default opacity-70"
                        )}
                        title={`${student.name} - ${time} - ${getStatusLabel(session.status)}`}
                      >
                        {canDrag && <GripVertical className="h-2.5 w-2.5 shrink-0 opacity-50" />}
                        <span className="truncate">{student.name}</span>
                      </div>
                    );
                  })}
                  {daySessions.length > (viewMode === 'month' ? 2 : 5) && (
                    <div className="text-[10px] text-muted-foreground text-center">
                      +{daySessions.length - (viewMode === 'month' ? 2 : 5)} المزيد
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-4 pt-3 border-t text-xs">
          <span className="text-muted-foreground">الحالة:</span>
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded bg-blue-500/40" />
            <span>مجدولة</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded bg-green-500/40" />
            <span>مكتملة</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded bg-red-500/40" />
            <span>ملغاة</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded bg-amber-500/40" />
            <span>إجازة</span>
          </div>
          <div className="flex items-center gap-1 mr-auto text-muted-foreground">
            <GripVertical className="h-3 w-3" />
            <span>اسحب لتغيير الموعد</span>
          </div>
        </div>
      </CardContent>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialog?.open || false} onOpenChange={(open) => !open && setConfirmDialog(null)}>
        <DialogContent dir="rtl" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>تأكيد تغيير الموعد</DialogTitle>
            <DialogDescription>
              هل تريد نقل حصة <span className="font-semibold">{confirmDialog?.studentName}</span>؟
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">من:</span>
              <span className="font-medium">
                {confirmDialog && format(parseISO(confirmDialog.originalDate), 'EEEE dd/MM/yyyy', { locale: ar })}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">إلى:</span>
              <span className="font-medium text-primary">
                {confirmDialog && format(parseISO(confirmDialog.newDate), 'EEEE dd/MM/yyyy', { locale: ar })}
              </span>
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setConfirmDialog(null)}>
              إلغاء
            </Button>
            <Button onClick={confirmReschedule}>
              تأكيد النقل
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
