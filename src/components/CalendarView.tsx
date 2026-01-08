import { useState, useMemo } from "react";
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  parseISO,
} from "date-fns";
import { ar } from "date-fns/locale";
import {
  ChevronRight,
  ChevronLeft,
  Calendar as CalendarIcon,
  GripVertical,
  Clock,
  CalendarDays,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Student, Session } from "@/types/student";
import { DAY_NAMES_AR, DAY_NAMES_SHORT_AR } from "@/lib/arabicConstants";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

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
  originalTime: string;
}

export const CalendarView = ({ students, onRescheduleSession }: CalendarViewProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"day" | "week" | "month">("week");
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dropTargetDate, setDropTargetDate] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    sessionId: string;
    studentId: string;
    studentName: string;
    originalDate: string;
    originalTime: string;
    newDate: string;
    newTime: string;
  } | null>(null);

  const sessionsByDate = useMemo(() => {
    const map = new Map<string, SessionWithStudent[]>();

    students.forEach((student) => {
      student.sessions.forEach((session) => {
        const existing = map.get(session.date) || [];
        existing.push({ session, student });
        map.set(session.date, existing);
      });
    });

    map.forEach((sessions, date) => {
      sessions.sort((a, b) => {
        const timeA = a.session.time || a.student.sessionTime || "16:00";
        const timeB = b.session.time || b.student.sessionTime || "16:00";
        return timeA.localeCompare(timeB);
      });
    });

    return map;
  }, [students]);

  const days = useMemo(() => {
    if (viewMode === "day") {
      return [currentDate];
    } else if (viewMode === "week") {
      const start = startOfWeek(currentDate, { weekStartsOn: 0 });
      const end = endOfWeek(currentDate, { weekStartsOn: 0 });
      return eachDayOfInterval({ start, end });
    } else {
      const start = startOfMonth(currentDate);
      const end = endOfMonth(currentDate);
      const monthDays = eachDayOfInterval({ start, end });

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

  const goToPrev = () => {
    if (viewMode === "day") {
      const newDate = new Date(currentDate);
      newDate.setDate(newDate.getDate() - 1);
      setCurrentDate(newDate);
    } else if (viewMode === "week") {
      setCurrentDate(subWeeks(currentDate, 1));
    } else {
      setCurrentDate(subMonths(currentDate, 1));
    }
  };

  const goToNext = () => {
    if (viewMode === "day") {
      const newDate = new Date(currentDate);
      newDate.setDate(newDate.getDate() + 1);
      setCurrentDate(newDate);
    } else if (viewMode === "week") {
      setCurrentDate(addWeeks(currentDate, 1));
    } else {
      setCurrentDate(addMonths(currentDate, 1));
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const checkTimeConflict = (
    studentId: string,
    sessionId: string,
    newDate: string,
    newTime: string,
  ): { hasConflict: boolean; conflictStudent?: string } => {
    const sessionsOnDate = sessionsByDate.get(newDate) || [];
    const sessionDuration = 60;

    const [newHour, newMin] = newTime.split(":").map(Number);
    const newStartMinutes = newHour * 60 + newMin;
    const newEndMinutes = newStartMinutes + sessionDuration;

    for (const { session, student } of sessionsOnDate) {
      if (session.id === sessionId) continue;

      const otherTime = session.time || student.sessionTime || "16:00";
      const [otherHour, otherMin] = otherTime.split(":").map(Number);
      const otherStartMinutes = otherHour * 60 + otherMin;
      const otherEndMinutes = otherStartMinutes + sessionDuration;

      const hasOverlap =
        (newStartMinutes >= otherStartMinutes && newStartMinutes < otherEndMinutes) ||
        (newEndMinutes > otherStartMinutes && newEndMinutes <= otherEndMinutes) ||
        (newStartMinutes <= otherStartMinutes && newEndMinutes >= otherEndMinutes);

      if (hasOverlap) {
        return { hasConflict: true, conflictStudent: student.name };
      }
    }

    return { hasConflict: false };
  };

  const handleDragStart = (
    e: React.DragEvent,
    sessionId: string,
    studentId: string,
    studentName: string,
    date: string,
    time: string,
  ) => {
    e.dataTransfer.effectAllowed = "move";
    setDragState({ sessionId, studentId, studentName, originalDate: date, originalTime: time });
  };

  const handleDragEnd = () => {
    setDragState(null);
    setDropTargetDate(null);
  };

  const handleDragOver = (e: React.DragEvent, dateStr: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
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

    const student = students.find((s) => s.id === dragState.studentId);
    const hasExistingSession = student?.sessions.some((s) => s.date === newDate && s.id !== dragState.sessionId);

    if (hasExistingSession) {
      toast({
        title: "لا يمكن النقل",
        description: `${dragState.studentName} لديه حصة بالفعل في هذا التاريخ`,
        variant: "destructive",
      });
      setDragState(null);
      return;
    }

    setConfirmDialog({
      open: true,
      sessionId: dragState.sessionId,
      studentId: dragState.studentId,
      studentName: dragState.studentName,
      originalDate: dragState.originalDate,
      originalTime: dragState.originalTime,
      newDate,
      newTime: dragState.originalTime,
    });
    setDragState(null);
  };

  const confirmReschedule = () => {
    if (!confirmDialog) return;

    const { hasConflict, conflictStudent } = checkTimeConflict(
      confirmDialog.studentId,
      confirmDialog.sessionId,
      confirmDialog.newDate,
      confirmDialog.newTime,
    );

    if (hasConflict) {
      toast({
        title: "تعارض في الموعد",
        description: `يوجد تعارض مع حصة ${conflictStudent} في نفس الوقت`,
        variant: "destructive",
      });
      return;
    }

    onRescheduleSession(confirmDialog.studentId, confirmDialog.sessionId, confirmDialog.newDate);
    toast({
      title: "✓ تم تعديل موعد الحصة",
      description: `تم نقل حصة ${confirmDialog.studentName} من ${format(parseISO(confirmDialog.originalDate), "dd/MM")} إلى ${format(parseISO(confirmDialog.newDate), "dd/MM")}`,
    });
    setConfirmDialog(null);
  };

  const getStatusColor = (status: Session["status"]) => {
    switch (status) {
      case "completed":
        return "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30";
      case "cancelled":
        return "bg-rose-500/20 text-rose-700 dark:text-rose-400 border-rose-500/40 hover:bg-rose-500/30";
      case "vacation":
        return "bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/40 hover:bg-amber-500/30";
      default:
        return "bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/40 hover:bg-blue-500/30";
    }
  };

  const getStatusLabel = (status: Session["status"]) => {
    switch (status) {
      case "completed":
        return "مكتملة";
      case "cancelled":
        return "ملغاة";
      case "vacation":
        return "إجازة";
      default:
        return "مجدولة";
    }
  };

  const today = new Date();

  const timeOptions = useMemo(() => {
    const options = [];
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += 30) {
        const time = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
        options.push(time);
      }
    }
    return options;
  }, []);

  return (
    <Card className="w-full border-2 shadow-lg">
      <CardHeader className="space-y-4 pb-4 bg-gradient-to-br from-primary/5 via-background to-background border-b">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary ring-2 ring-primary/20">
              <CalendarIcon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                عرض التقويم
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">اسحب الحصص لتغيير المواعيد</p>
            </div>
          </div>

          {/* View Mode Pills */}
          <div className="flex items-center gap-1.5 bg-muted/50 p-1.5 rounded-xl shadow-inner">
            {[
              { value: "day", label: "يومي", icon: CalendarDays },
              { value: "week", label: "أسبوعي", icon: CalendarDays },
              { value: "month", label: "شهري", icon: CalendarIcon },
            ].map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setViewMode(value as "day" | "week" | "month")}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2",
                  viewMode === value
                    ? "bg-background text-primary shadow-md scale-105"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between bg-background/80 backdrop-blur-sm p-3 rounded-xl border-2 border-border/50 shadow-sm">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={goToNext}
              className="h-10 w-10 p-0 rounded-xl border-2 hover:border-primary hover:bg-primary/5 hover:scale-110 transition-all shadow-sm"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={goToPrev}
              className="h-10 w-10 p-0 rounded-xl border-2 hover:border-primary hover:bg-primary/5 hover:scale-110 transition-all shadow-sm"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </div>

          <h3 className="font-bold text-sm sm:text-base text-center px-3 py-1.5 bg-primary/5 rounded-lg">
            {viewMode === "day"
              ? format(currentDate, "EEEE dd MMMM yyyy", { locale: ar })
              : viewMode === "week"
                ? `${format(days[0], "dd MMM", { locale: ar })} - ${format(days[days.length - 1], "dd MMM yyyy", { locale: ar })}`
                : format(currentDate, "MMMM yyyy", { locale: ar })}
          </h3>

          <Button
            variant="outline"
            size="sm"
            onClick={goToToday}
            className="h-10 px-4 rounded-xl border-2 hover:border-primary hover:bg-primary/5 hover:scale-105 transition-all shadow-sm font-medium"
          >
            اليوم
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-3 sm:p-6">
        {/* Calendar Grid */}
        <div className={cn("grid gap-2", viewMode === "day" ? "grid-cols-1" : "grid-cols-7")}>
          {/* Day headers */}
          {viewMode !== "day" &&
            DAY_NAMES_SHORT_AR.map((day, i) => (
              <div
                key={i}
                className="text-center text-xs font-bold text-muted-foreground py-2 bg-muted/30 rounded-t-xl border-b-2 border-primary/10"
              >
                {day}
              </div>
            ))}

          {/* Day cells */}
          {days.map((day, index) => {
            const dateStr = format(day, "yyyy-MM-dd");
            const daySessions = sessionsByDate.get(dateStr) || [];
            const isCurrentMonth = viewMode === "month" ? isSameMonth(day, currentDate) : true;
            const isToday = isSameDay(day, today);
            const isDragTarget = dropTargetDate === dateStr && dragState?.originalDate !== dateStr;

            return (
              <div
                key={index}
                className={cn(
                  "border-2 rounded-xl p-2 sm:p-3 transition-all duration-200",
                  viewMode === "day" ? "min-h-[500px]" : viewMode === "week" ? "min-h-[140px]" : "min-h-[100px]",
                  !isCurrentMonth && "opacity-40 bg-muted/20",
                  isToday && "ring-2 ring-primary shadow-lg bg-primary/5",
                  isDragTarget &&
                    "bg-gradient-to-br from-primary/20 to-primary/5 border-primary border-dashed scale-105 shadow-xl",
                  !isDragTarget && !isToday && "hover:border-primary/30 hover:shadow-md",
                )}
                onDragOver={(e) => handleDragOver(e, dateStr)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, dateStr)}
              >
                {/* Date header */}
                <div
                  className={cn(
                    "flex items-center justify-between mb-2 pb-2 border-b-2",
                    isToday ? "border-primary" : "border-border/50",
                  )}
                >
                  <span
                    className={cn(
                      "text-sm font-bold",
                      isToday && "bg-primary text-primary-foreground px-2 py-1 rounded-lg shadow-sm",
                    )}
                  >
                    {viewMode === "day" ? format(day, "EEEE dd MMMM", { locale: ar }) : format(day, "d")}
                  </span>
                  {daySessions.length > 0 && (
                    <span className="text-[10px] bg-primary text-primary-foreground px-2 py-0.5 rounded-full font-bold shadow-sm">
                      {daySessions.length}
                    </span>
                  )}
                </div>

                {/* Sessions */}
                <div
                  className={cn(
                    "space-y-2",
                    viewMode === "day" ? "max-h-[420px]" : "max-h-[90px]",
                    "overflow-y-auto scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent",
                  )}
                >
                  {(viewMode === "month" ? daySessions.slice(0, 2) : daySessions).map(({ session, student }) => {
                    const time = session.time || student.sessionTime || "16:00";
                    const canDrag = session.status === "scheduled";

                    return (
                      <div
                        key={session.id}
                        draggable={canDrag}
                        onDragStart={(e) =>
                          canDrag && handleDragStart(e, session.id, student.id, student.name, session.date, time)
                        }
                        onDragEnd={handleDragEnd}
                        className={cn(
                          "text-xs p-2.5 rounded-lg border-2 flex items-start gap-2 transition-all duration-200",
                          getStatusColor(session.status),
                          canDrag && "cursor-grab active:cursor-grabbing hover:shadow-lg hover:scale-105",
                          !canDrag && "cursor-default opacity-75",
                        )}
                      >
                        {canDrag && <GripVertical className="h-4 w-4 shrink-0 opacity-50" />}
                        <div className="flex-1 min-w-0">
                          <div className="font-bold truncate">{student.name}</div>
                          <div className="text-[10px] opacity-80 flex items-center gap-1.5 mt-1">
                            <Clock className="h-3 w-3" />
                            <span className="font-medium">{time}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {viewMode === "month" && daySessions.length > 2 && (
                    <div className="text-[10px] text-center text-muted-foreground py-1 font-medium">
                      +{daySessions.length - 2} المزيد
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 mt-6 pt-4 border-t-2 text-xs bg-muted/20 p-3 rounded-xl">
          <span className="text-muted-foreground font-bold">الحالة:</span>
          {[
            { color: "bg-blue-500/40", label: "مجدولة" },
            { color: "bg-emerald-500/40", label: "مكتملة" },
            { color: "bg-rose-500/40", label: "ملغاة" },
            { color: "bg-amber-500/40", label: "إجازة" },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-2">
              <div className={cn("w-4 h-4 rounded-md border-2 border-current", color)} />
              <span className="font-medium">{label}</span>
            </div>
          ))}
          <div className="flex items-center gap-2 mr-auto text-muted-foreground">
            <GripVertical className="h-4 w-4" />
            <span className="hidden sm:inline font-medium">اسحب لتغيير الموعد</span>
            <span className="sm:hidden font-medium">اسحب</span>
          </div>
        </div>
      </CardContent>

      {/* Reschedule Dialog */}
      <Dialog open={confirmDialog?.open || false} onOpenChange={(open) => !open && setConfirmDialog(null)}>
        <DialogContent dir="rtl" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">تأكيد تغيير موعد الحصة</DialogTitle>
            <DialogDescription>
              حصة <span className="font-bold text-foreground">{confirmDialog?.studentName}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Original */}
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground font-medium">الموعد الحالي:</Label>
              <div className="p-3 bg-muted/50 rounded-xl border-2">
                <div className="text-sm font-bold">
                  {confirmDialog && format(parseISO(confirmDialog.originalDate), "EEEE dd/MM/yyyy", { locale: ar })}
                </div>
                <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  {confirmDialog?.originalTime}
                </div>
              </div>
            </div>

            {/* New */}
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground font-medium">الموعد الجديد:</Label>
              <div className="p-3 bg-gradient-to-br from-primary/10 to-primary/5 border-2 border-primary/30 rounded-xl">
                <div className="text-sm font-bold text-primary">
                  {confirmDialog && format(parseISO(confirmDialog.newDate), "EEEE dd/MM/yyyy", { locale: ar })}
                </div>
              </div>
            </div>

            {/* Time */}
            <div className="space-y-2">
              <Label htmlFor="new-time" className="text-sm font-medium">
                الوقت:
              </Label>
              <Select
                value={confirmDialog?.newTime}
                onValueChange={(time) => setConfirmDialog((prev) => (prev ? { ...prev, newTime: time } : null))}
              >
                <SelectTrigger id="new-time" className="h-11 rounded-xl border-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {timeOptions.map((time) => (
                    <SelectItem key={time} value={time}>
                      {time}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setConfirmDialog(null)} className="rounded-xl">
              إلغاء
            </Button>
            <Button
              onClick={confirmReschedule}
              className="rounded-xl bg-gradient-to-r from-primary to-primary/80 shadow-lg hover:shadow-xl"
            >
              تأكيد النقل
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
