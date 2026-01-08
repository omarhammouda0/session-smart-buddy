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
import { ChevronRight, ChevronLeft, Calendar as CalendarIcon, GripVertical, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Student, Session } from "@/types/student";
import { DAY_NAMES_AR, DAY_NAMES_SHORT_AR } from "@/lib/arabicConstants";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
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

  // Get all sessions grouped by date
  const sessionsByDate = useMemo(() => {
    const map = new Map<string, SessionWithStudent[]>();

    students.forEach((student) => {
      student.sessions.forEach((session) => {
        const existing = map.get(session.date) || [];
        existing.push({ session, student });
        map.set(session.date, existing);
      });
    });

    // Sort sessions by time within each day
    map.forEach((sessions, date) => {
      sessions.sort((a, b) => {
        const timeA = a.session.time || a.student.sessionTime || "16:00";
        const timeB = b.session.time || b.student.sessionTime || "16:00";
        return timeA.localeCompare(timeB);
      });
    });

    return map;
  }, [students]);

  // Get days for current view
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

  // Check for time conflicts
  const checkTimeConflict = (
    studentId: string,
    sessionId: string,
    newDate: string,
    newTime: string,
  ): { hasConflict: boolean; conflictStudent?: string } => {
    const sessionsOnDate = sessionsByDate.get(newDate) || [];
    const sessionDuration = 60; // minutes

    const [newHour, newMin] = newTime.split(":").map(Number);
    const newStartMinutes = newHour * 60 + newMin;
    const newEndMinutes = newStartMinutes + sessionDuration;

    for (const { session, student } of sessionsOnDate) {
      if (session.id === sessionId) continue; // Skip the session being moved

      const otherTime = session.time || student.sessionTime || "16:00";
      const [otherHour, otherMin] = otherTime.split(":").map(Number);
      const otherStartMinutes = otherHour * 60 + otherMin;
      const otherEndMinutes = otherStartMinutes + sessionDuration;

      // Check for overlap
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

  // Drag and drop handlers
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

    // Check if the student already has a session on the new date
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

    // Show confirmation dialog with time selection
    setConfirmDialog({
      open: true,
      sessionId: dragState.sessionId,
      studentId: dragState.studentId,
      studentName: dragState.studentName,
      originalDate: dragState.originalDate,
      originalTime: dragState.originalTime,
      newDate,
      newTime: dragState.originalTime, // Default to original time
    });
    setDragState(null);
  };

  const confirmReschedule = () => {
    if (!confirmDialog) return;

    // Check for time conflicts
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
      title: "تم تعديل موعد الحصة",
      description: `تم نقل حصة ${confirmDialog.studentName} من ${format(parseISO(confirmDialog.originalDate), "dd/MM")} إلى ${format(parseISO(confirmDialog.newDate), "dd/MM")} الساعة ${confirmDialog.newTime}`,
    });
    setConfirmDialog(null);
  };

  const getStatusColor = (status: Session["status"]) => {
    switch (status) {
      case "completed":
        return "bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30";
      case "cancelled":
        return "bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30";
      case "vacation":
        return "bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30";
      default:
        return "bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/30";
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

  // Generate time options (every 30 minutes)
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
    <Card className="w-full">
      <CardHeader className="space-y-3 pb-3">
        {/* Header Row */}
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <CalendarIcon className="h-5 w-5 text-primary" />
            عرض التقويم
          </CardTitle>

          {/* View Mode Tabs */}
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "day" | "week" | "month")}>
            <TabsList className="grid grid-cols-3 h-9">
              <TabsTrigger value="day" className="text-xs px-2 sm:px-3">
                يومي
              </TabsTrigger>
              <TabsTrigger value="week" className="text-xs px-2 sm:px-3">
                أسبوعي
              </TabsTrigger>
              <TabsTrigger value="month" className="text-xs px-2 sm:px-3">
                شهري
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Navigation Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" onClick={goToNext} className="h-9 w-9 p-0">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={goToPrev} className="h-9 w-9 p-0">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>

          <h3 className="font-semibold text-xs sm:text-sm">
            {viewMode === "day"
              ? format(currentDate, "EEEE dd MMMM yyyy", { locale: ar })
              : viewMode === "week"
                ? `${format(days[0], "dd MMM", { locale: ar })} - ${format(days[days.length - 1], "dd MMM yyyy", { locale: ar })}`
                : format(currentDate, "MMMM yyyy", { locale: ar })}
          </h3>

          <Button variant="outline" size="sm" onClick={goToToday} className="h-9 px-3 text-xs">
            اليوم
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-2 sm:p-4">
        {/* Calendar Grid */}
        <div className={cn("grid gap-1", viewMode === "day" ? "grid-cols-1" : "grid-cols-7")}>
          {/* Day headers (hide for day view) */}
          {viewMode !== "day" &&
            DAY_NAMES_SHORT_AR.map((day, i) => (
              <div key={i} className="text-center text-xs font-medium text-muted-foreground py-2 border-b">
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
                  "border rounded-lg p-2 transition-all",
                  viewMode === "day"
                    ? "min-h-[400px]"
                    : viewMode === "week"
                      ? "min-h-[100px] sm:min-h-[120px]"
                      : "min-h-[70px] sm:min-h-[90px]",
                  !isCurrentMonth && "opacity-40 bg-muted/20",
                  isToday && "ring-2 ring-primary shadow-sm",
                  isDragTarget && "bg-primary/10 border-primary border-2 border-dashed shadow-lg scale-105",
                )}
                onDragOver={(e) => handleDragOver(e, dateStr)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, dateStr)}
              >
                {/* Date header */}
                <div
                  className={cn(
                    "text-sm font-medium mb-2 pb-1.5 border-b flex items-center justify-between",
                    isToday && "text-primary font-bold",
                  )}
                >
                  <span>{viewMode === "day" ? format(day, "EEEE dd MMMM", { locale: ar }) : format(day, "d")}</span>
                  {daySessions.length > 0 && (
                    <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                      {daySessions.length}
                    </span>
                  )}
                </div>

                {/* Sessions */}
                <div
                  className={cn(
                    "space-y-1.5",
                    viewMode === "day" ? "max-h-[340px]" : "max-h-[75px]",
                    "overflow-y-auto",
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
                          "text-xs p-2 rounded-md border flex items-start gap-1.5 transition-all",
                          getStatusColor(session.status),
                          canDrag && "cursor-grab active:cursor-grabbing hover:shadow-md hover:scale-105",
                          !canDrag && "cursor-default opacity-70",
                        )}
                      >
                        {canDrag && <GripVertical className="h-3.5 w-3.5 shrink-0 opacity-50 mt-0.5" />}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{student.name}</div>
                          <div className="text-[10px] opacity-75 flex items-center gap-1 mt-0.5">
                            <Clock className="h-2.5 w-2.5" />
                            {time}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {viewMode === "month" && daySessions.length > 2 && (
                    <div className="text-[10px] text-center text-muted-foreground py-1">
                      +{daySessions.length - 2} المزيد
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 sm:gap-4 mt-4 pt-3 border-t text-xs">
          <span className="text-muted-foreground font-medium">الحالة:</span>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-blue-500/40 border border-blue-500/60" />
            <span>مجدولة</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-green-500/40 border border-green-500/60" />
            <span>مكتملة</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-red-500/40 border border-red-500/60" />
            <span>ملغاة</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-amber-500/40 border border-amber-500/60" />
            <span>إجازة</span>
          </div>
          <div className="flex items-center gap-1.5 mr-auto text-muted-foreground">
            <GripVertical className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">اسحب لتغيير الموعد</span>
            <span className="sm:hidden">اسحب</span>
          </div>
        </div>
      </CardContent>

      {/* Reschedule Confirmation Dialog */}
      <Dialog open={confirmDialog?.open || false} onOpenChange={(open) => !open && setConfirmDialog(null)}>
        <DialogContent dir="rtl" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>تأكيد تغيير موعد الحصة</DialogTitle>
            <DialogDescription>
              حصة <span className="font-semibold text-foreground">{confirmDialog?.studentName}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Original Date/Time */}
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">الموعد الحالي:</Label>
              <div className="p-3 bg-muted rounded-lg">
                <div className="text-sm font-medium">
                  {confirmDialog && format(parseISO(confirmDialog.originalDate), "EEEE dd/MM/yyyy", { locale: ar })}
                </div>
                <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {confirmDialog?.originalTime}
                </div>
              </div>
            </div>

            {/* New Date */}
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">الموعد الجديد:</Label>
              <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
                <div className="text-sm font-medium text-primary">
                  {confirmDialog && format(parseISO(confirmDialog.newDate), "EEEE dd/MM/yyyy", { locale: ar })}
                </div>
              </div>
            </div>

            {/* New Time Selection */}
            <div className="space-y-2">
              <Label htmlFor="new-time" className="text-sm">
                الوقت:
              </Label>
              <Select
                value={confirmDialog?.newTime}
                onValueChange={(time) => setConfirmDialog((prev) => (prev ? { ...prev, newTime: time } : null))}
              >
                <SelectTrigger id="new-time" className="h-11">
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

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setConfirmDialog(null)}>
              إلغاء
            </Button>
            <Button onClick={confirmReschedule}>تأكيد النقل</Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
