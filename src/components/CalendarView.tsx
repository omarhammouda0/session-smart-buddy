import React, { useState, useMemo, useCallback } from "react";
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
  AlertTriangle,
  CheckCircle2,
  XCircle,
  DollarSign,
  User,
  Monitor,
  MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Student, Session } from "@/types/student";
import { DAY_NAMES_SHORT_AR } from "@/lib/arabicConstants";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface CalendarViewProps {
  students: Student[];
  onRescheduleSession: (studentId: string, sessionId: string, newDate: string) => void;
  onUpdateSessionDateTime?: (studentId: string, sessionId: string, newDate: string, newTime: string) => void;
  onToggleComplete?: (studentId: string, sessionId: string) => void;
  onCancelSession?: (studentId: string, sessionId: string, reason?: string) => void;
  onQuickPayment?: (studentId: string, sessionId: string, sessionDate: string) => void;
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
interface ConflictInfo {
  hasConflict: boolean;
  conflictStudent?: string;
  conflictTime?: string;
  severity: "none" | "warning" | "error";
}

export const CalendarView = ({
  students,
  onRescheduleSession,
  onUpdateSessionDateTime,
  onToggleComplete,
  onCancelSession,
  onQuickPayment,
}: CalendarViewProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"week" | "month">("week");
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dropTargetDate, setDropTargetDate] = useState<string | null>(null);
  const [touchDragState, setTouchDragState] = useState<{
    active: boolean;
    startX: number;
    startY: number;
    sessionId: string;
    studentId: string;
    studentName: string;
    originalDate: string;
    originalTime: string;
  } | null>(null);
  const longPressTimer = React.useRef<NodeJS.Timeout | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    sessionId: string;
    studentId: string;
    studentName: string;
    originalDate: string;
    originalTime: string;
    newDate: string;
    newTime: string;
    conflictInfo: ConflictInfo;
  } | null>(null);
  const [sessionActionDialog, setSessionActionDialog] = useState<{
    open: boolean;
    session: Session;
    student: Student;
  } | null>(null);
  const [cancelConfirmDialog, setCancelConfirmDialog] = useState<{
    open: boolean;
    session: Session;
    student: Student;
  } | null>(null);
  const [completeConfirmDialog, setCompleteConfirmDialog] = useState<{
    open: boolean;
    session: Session;
    student: Student;
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
    map.forEach((sessions) => {
      sessions.sort((a, b) => {
        const timeA = a.session.time || a.student.sessionTime;
        const timeB = b.session.time || b.student.sessionTime;
        return (timeA || "").localeCompare(timeB || "");
      });
    });
    return map;
  }, [students]);

  const days = useMemo(() => {
    if (viewMode === "week") {
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

  const checkTimeConflict = useCallback(
    (studentId: string, sessionId: string, newDate: string, newTime: string): ConflictInfo => {
      const sessionsOnDate = sessionsByDate.get(newDate) || [];
      const sessionDuration = 60;
      if (!newTime) return { hasConflict: false, severity: "none" };
      const [newHour, newMin] = newTime.split(":").map(Number);
      const newStartMinutes = newHour * 60 + newMin;
      const newEndMinutes = newStartMinutes + sessionDuration;
      for (const { session, student } of sessionsOnDate) {
        if (session.id === sessionId) continue;
        const otherTime = session.time || student.sessionTime;
        if (!otherTime) continue;
        const [otherHour, otherMin] = otherTime.split(":").map(Number);
        const otherStartMinutes = otherHour * 60 + otherMin;
        const otherEndMinutes = otherStartMinutes + sessionDuration;
        const hasOverlap =
          (newStartMinutes >= otherStartMinutes && newStartMinutes < otherEndMinutes) ||
          (newEndMinutes > otherStartMinutes && newEndMinutes <= otherEndMinutes) ||
          (newStartMinutes <= otherStartMinutes && newEndMinutes >= otherEndMinutes);
        if (hasOverlap) {
          const isSameStudent = student.id === studentId;
          return {
            hasConflict: true,
            conflictStudent: isSameStudent ? `${student.name} (نفس الطالب)` : student.name,
            conflictTime: otherTime,
            severity: "error",
          };
        }
        const timeDiff = Math.abs(newStartMinutes - otherStartMinutes);
        if (timeDiff < 15 && timeDiff > 0) {
          const isSameStudent = student.id === studentId;
          return {
            hasConflict: false,
            conflictStudent: isSameStudent ? `${student.name} (نفس الطالب)` : student.name,
            conflictTime: otherTime,
            severity: "warning",
          };
        }
      }
      return { hasConflict: false, severity: "none" };
    },
    [sessionsByDate],
  );

  const getDropTargetConflict = useCallback(
    (targetDate: string): ConflictInfo => {
      if (!dragState && !touchDragState?.active) return { hasConflict: false, severity: "none" };
      const state = dragState || touchDragState;
      if (!state) return { hasConflict: false, severity: "none" };
      return checkTimeConflict(state.studentId, state.sessionId, targetDate, state.originalTime);
    },
    [dragState, touchDragState, checkTimeConflict],
  );

  const goToPrev = () => {
    if (viewMode === "week") setCurrentDate(subWeeks(currentDate, 1));
    else setCurrentDate(subMonths(currentDate, 1));
  };
  const goToNext = () => {
    if (viewMode === "week") setCurrentDate(addWeeks(currentDate, 1));
    else setCurrentDate(addMonths(currentDate, 1));
  };
  const goToToday = () => {
    setCurrentDate(new Date());
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

  const handleTouchStart = useCallback(
    (e: React.TouchEvent, sessionId: string, studentId: string, studentName: string, date: string, time: string) => {
      const touch = e.touches[0];
      longPressTimer.current = setTimeout(() => {
        setTouchDragState({
          active: true,
          startX: touch.clientX,
          startY: touch.clientY,
          sessionId,
          studentId,
          studentName,
          originalDate: date,
          originalTime: time,
        });
        if (navigator.vibrate) navigator.vibrate(50);
        toast({ title: "اسحب الحصة", description: "حرك إصبعك لنقل الحصة إلى يوم آخر" });
      }, 500);
    },
    [],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
      if (!touchDragState?.active) return;
      const touch = e.touches[0];
      const element = document.elementFromPoint(touch.clientX, touch.clientY);
      const dayCell = element?.closest("[data-date]");
      if (dayCell) {
        const dateStr = dayCell.getAttribute("data-date");
        if (dateStr && dateStr !== touchDragState.originalDate) setDropTargetDate(dateStr);
      } else setDropTargetDate(null);
    },
    [touchDragState],
  );

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (!touchDragState?.active) {
      setTouchDragState(null);
      return;
    }
    if (dropTargetDate && dropTargetDate !== touchDragState.originalDate) {
      const conflictInfo = checkTimeConflict(
        touchDragState.studentId,
        touchDragState.sessionId,
        dropTargetDate,
        touchDragState.originalTime,
      );
      setConfirmDialog({
        open: true,
        sessionId: touchDragState.sessionId,
        studentId: touchDragState.studentId,
        studentName: touchDragState.studentName,
        originalDate: touchDragState.originalDate,
        originalTime: touchDragState.originalTime,
        newDate: dropTargetDate,
        newTime: touchDragState.originalTime,
        conflictInfo,
      });
    }
    setTouchDragState(null);
    setDropTargetDate(null);
  }, [touchDragState, dropTargetDate, checkTimeConflict]);

  const handleDrop = (e: React.DragEvent, newDate: string) => {
    e.preventDefault();
    setDropTargetDate(null);
    if (!dragState) return;
    if (dragState.originalDate === newDate) {
      setDragState(null);
      return;
    }
    const conflictInfo = checkTimeConflict(dragState.studentId, dragState.sessionId, newDate, dragState.originalTime);
    setConfirmDialog({
      open: true,
      sessionId: dragState.sessionId,
      studentId: dragState.studentId,
      studentName: dragState.studentName,
      originalDate: dragState.originalDate,
      originalTime: dragState.originalTime,
      newDate,
      newTime: dragState.originalTime,
      conflictInfo,
    });
    setDragState(null);
  };

  const updateConfirmDialogTime = (newTime: string) => {
    if (!confirmDialog) return;
    const conflictInfo = checkTimeConflict(
      confirmDialog.studentId,
      confirmDialog.sessionId,
      confirmDialog.newDate,
      newTime,
    );
    setConfirmDialog({ ...confirmDialog, newTime, conflictInfo });
  };

  const confirmReschedule = () => {
    if (!confirmDialog) return;
    if (confirmDialog.conflictInfo.hasConflict) {
      toast({
        title: "❌ لا يمكن نقل الحصة",
        description: `يوجد تعارض مع حصة ${confirmDialog.conflictInfo.conflictStudent} في نفس الوقت`,
        variant: "destructive",
      });
      return;
    }
    if (onUpdateSessionDateTime)
      onUpdateSessionDateTime(
        confirmDialog.studentId,
        confirmDialog.sessionId,
        confirmDialog.newDate,
        confirmDialog.newTime,
      );
    else onRescheduleSession(confirmDialog.studentId, confirmDialog.sessionId, confirmDialog.newDate);
    toast({
      title: "✓ تم تعديل موعد الحصة",
      description: `تم نقل حصة ${confirmDialog.studentName} من ${format(parseISO(confirmDialog.originalDate), "dd/MM")} الساعة ${confirmDialog.originalTime} إلى ${format(parseISO(confirmDialog.newDate), "dd/MM")} الساعة ${confirmDialog.newTime}`,
    });
    setConfirmDialog(null);
  };

  const handleSessionClick = (e: React.MouseEvent, session: Session, student: Student) => {
    if (dragState || touchDragState?.active) return;
    e.stopPropagation();
    setSessionActionDialog({ open: true, session, student });
  };

  const handleCompleteClick = () => {
    if (!sessionActionDialog) return;
    setSessionActionDialog(null);
    setCompleteConfirmDialog({
      open: true,
      session: sessionActionDialog.session,
      student: sessionActionDialog.student,
    });
  };

  const confirmComplete = () => {
    if (!completeConfirmDialog || !onToggleComplete) return;
    onToggleComplete(completeConfirmDialog.student.id, completeConfirmDialog.session.id);
    setCompleteConfirmDialog(null);
  };

  const handleCancelClick = () => {
    if (!sessionActionDialog) return;
    setSessionActionDialog(null);
    setCancelConfirmDialog({ open: true, session: sessionActionDialog.session, student: sessionActionDialog.student });
  };

  const confirmCancel = () => {
    if (!cancelConfirmDialog || !onCancelSession) return;
    const reason = prompt("سبب الإلغاء (اختياري):");
    onCancelSession(cancelConfirmDialog.student.id, cancelConfirmDialog.session.id, reason || undefined);
    setCancelConfirmDialog(null);
  };

  const handlePaymentClick = () => {
    if (!sessionActionDialog || !onQuickPayment) return;
    const { session, student } = sessionActionDialog;
    setSessionActionDialog(null);
    onQuickPayment(student.id, session.id, session.date);
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

  const getStatusBadgeColor = (status: Session["status"]) => {
    switch (status) {
      case "completed":
        return "bg-emerald-500 text-white";
      case "cancelled":
        return "bg-rose-500 text-white";
      case "vacation":
        return "bg-amber-500 text-white";
      default:
        return "bg-blue-500 text-white";
    }
  };

  const today = new Date();
  const timeOptions = useMemo(() => {
    const options = [];
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += 30) {
        options.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
      }
    }
    return options;
  }, []);

  return (
    <Card className="w-full border-2 shadow-lg">
      <CardHeader className="space-y-4 pb-4 bg-gradient-to-br from-primary/5 via-background to-background border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary ring-2 ring-primary/20">
              <CalendarIcon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                عرض التقويم
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">اضغط على حصة لإدارتها</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 bg-muted/50 p-1.5 rounded-xl shadow-inner">
            {[
              { value: "week", label: "أسبوعي" },
              { value: "month", label: "شهري" },
            ].map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setViewMode(value as "week" | "month")}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                  viewMode === value
                    ? "bg-background text-primary shadow-md scale-105"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
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
            {viewMode === "week"
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
        <div className="grid gap-3 grid-cols-7">
          {DAY_NAMES_SHORT_AR.map((day, i) => (
            <div
              key={i}
              className="text-center text-sm font-bold text-muted-foreground py-3 bg-muted/30 rounded-xl border-b-2 border-primary/10"
            >
              {day}
            </div>
          ))}
          {days.map((day, index) => {
            const dateStr = format(day, "yyyy-MM-dd");
            const daySessions = sessionsByDate.get(dateStr) || [];
            const isCurrentMonth = viewMode === "month" ? isSameMonth(day, currentDate) : true;
            const isToday = isSameDay(day, today);
            const isDragging = dragState !== null || touchDragState?.active;
            const isDropTarget =
              dropTargetDate === dateStr &&
              dragState?.originalDate !== dateStr &&
              touchDragState?.originalDate !== dateStr;
            const dropConflict = isDropTarget ? getDropTargetConflict(dateStr) : null;
            const hasDropConflict = dropConflict?.hasConflict;
            const hasDropWarning = dropConflict?.severity === "warning";

            return (
              <div
                key={index}
                data-date={dateStr}
                className={cn(
                  "border-2 rounded-xl p-2 sm:p-3 transition-all duration-200 touch-manipulation relative flex flex-col",
                  viewMode === "week"
                    ? "min-h-[160px] sm:min-h-[200px] max-h-[300px] sm:max-h-[400px]"
                    : "min-h-[100px] sm:min-h-[140px] max-h-[180px] sm:max-h-[220px]",
                  !isCurrentMonth && "opacity-40 bg-muted/20",
                  isToday && "ring-2 ring-primary shadow-lg bg-primary/5",
                  isDropTarget && hasDropConflict && "bg-rose-500/20 border-rose-500 border-dashed scale-105 shadow-xl",
                  isDropTarget &&
                    hasDropWarning &&
                    "bg-amber-500/20 border-amber-500 border-dashed scale-105 shadow-xl",
                  isDropTarget &&
                    !hasDropConflict &&
                    !hasDropWarning &&
                    "bg-gradient-to-br from-primary/20 to-primary/5 border-primary border-dashed scale-105 shadow-xl",
                  touchDragState?.active && "select-none",
                  !isDropTarget && !isToday && isDragging && "hover:border-primary/30 hover:shadow-md",
                )}
                onDragOver={(e) => handleDragOver(e, dateStr)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, dateStr)}
              >
                {isDropTarget && dropConflict && (dropConflict.hasConflict || dropConflict.severity === "warning") && (
                  <div
                    className={cn(
                      "absolute top-1 left-1 right-1 px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 z-10",
                      hasDropConflict ? "bg-rose-500 text-white" : "bg-amber-500 text-white",
                    )}
                  >
                    {hasDropConflict ? (
                      <>
                        <XCircle className="h-3 w-3" />
                        تعارض مع {dropConflict.conflictStudent}
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="h-3 w-3" />
                        قريب من {dropConflict.conflictStudent}
                      </>
                    )}
                  </div>
                )}
                {/* Date header - fixed */}
                <div
                  className={cn(
                    "flex items-center justify-between mb-2 sm:mb-3 pb-1 sm:pb-2 border-b-2 shrink-0",
                    isToday ? "border-primary" : "border-border/50",
                    isDropTarget && (hasDropConflict || hasDropWarning) && "mt-6",
                  )}
                >
                  <span
                    className={cn(
                      "text-base sm:text-lg font-bold",
                      isToday &&
                        "bg-primary text-primary-foreground px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg shadow-sm",
                    )}
                  >
                    {format(day, "d")}
                  </span>
                  {daySessions.length > 0 && (
                    <span className="text-[10px] sm:text-xs bg-primary text-primary-foreground px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full font-bold shadow-sm">
                      {daySessions.length}
                    </span>
                  )}
                </div>
                {/* Sessions - scrollable */}
                <div className="space-y-1.5 sm:space-y-2 overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent">
                  {daySessions.map(({ session, student }) => {
                    const time = session.time || student.sessionTime;
                    const canDrag = session.status === "scheduled";
                    return (
                      <div
                        key={session.id}
                        draggable={canDrag}
                        onDragStart={(e) =>
                          canDrag && handleDragStart(e, session.id, student.id, student.name, session.date, time || "")
                        }
                        onDragEnd={handleDragEnd}
                        onTouchStart={(e) =>
                          canDrag && handleTouchStart(e, session.id, student.id, student.name, session.date, time || "")
                        }
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                        onClick={(e) => handleSessionClick(e, session, student)}
                        className={cn(
                          "text-xs sm:text-sm p-2 sm:p-3 rounded-lg border-2 flex items-start gap-1.5 sm:gap-2 transition-all duration-200 touch-manipulation select-none cursor-pointer",
                          getStatusColor(session.status),
                          canDrag && "active:cursor-grabbing hover:shadow-lg active:scale-95",
                          touchDragState?.sessionId === session.id && touchDragState?.active && "opacity-50 scale-95",
                          dragState?.sessionId === session.id && "opacity-50 scale-95",
                        )}
                      >
                        {canDrag && <GripVertical className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 opacity-50 mt-0.5" />}
                        <div className="flex-1 min-w-0">
                          <div className="font-bold truncate text-xs sm:text-sm">{student.name}</div>
                          <div className="text-[10px] sm:text-xs opacity-80 flex items-center gap-1 sm:gap-1.5 mt-0.5 sm:mt-1">
                            <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                            <span className="font-medium">{time}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-4 mt-6 pt-4 border-t-2 text-sm bg-muted/20 p-4 rounded-xl">
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

      {/* Session Action Dialog */}
      <Dialog open={sessionActionDialog?.open || false} onOpenChange={(open) => !open && setSessionActionDialog(null)}>
        <DialogContent dir="rtl" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              {sessionActionDialog?.student.name}
            </DialogTitle>
            <DialogDescription>
              {sessionActionDialog &&
                format(parseISO(sessionActionDialog.session.date), "EEEE dd MMMM yyyy", { locale: ar })}
            </DialogDescription>
          </DialogHeader>
          {sessionActionDialog && (
            <div className="space-y-4 py-4">
              <div className="p-4 rounded-xl bg-muted/50 border-2 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="font-bold">
                      {sessionActionDialog.session.time || sessionActionDialog.student.sessionTime}
                    </span>
                  </div>
                  <Badge className={getStatusBadgeColor(sessionActionDialog.session.status)}>
                    {getStatusLabel(sessionActionDialog.session.status)}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {sessionActionDialog.student.sessionType === "online" ? (
                    <>
                      <Monitor className="h-4 w-4" />
                      <span>أونلاين</span>
                    </>
                  ) : (
                    <>
                      <MapPin className="h-4 w-4" />
                      <span>حضوري</span>
                    </>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                {sessionActionDialog.session.status === "scheduled" && (
                  <>
                    {onToggleComplete && (
                      <Button
                        onClick={handleCompleteClick}
                        className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-white gap-2 text-base"
                      >
                        <CheckCircle2 className="h-5 w-5" />
                        تسجيل كمكتملة
                      </Button>
                    )}
                    {onCancelSession && (
                      <Button
                        onClick={handleCancelClick}
                        variant="outline"
                        className="w-full h-12 border-rose-500/50 text-rose-600 hover:bg-rose-500/10 gap-2 text-base"
                      >
                        <XCircle className="h-5 w-5" />
                        إلغاء الحصة
                      </Button>
                    )}
                    {onQuickPayment && (
                      <Button
                        onClick={handlePaymentClick}
                        variant="outline"
                        className="w-full h-12 border-amber-500/50 text-amber-600 hover:bg-amber-500/10 gap-2 text-base"
                      >
                        <DollarSign className="h-5 w-5" />
                        تسجيل دفع
                      </Button>
                    )}
                  </>
                )}
                {sessionActionDialog.session.status === "completed" && onQuickPayment && (
                  <>
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 text-emerald-700 text-sm font-medium">
                      <CheckCircle2 className="h-4 w-4" />
                      تم إكمال هذه الحصة
                    </div>
                    <Button
                      onClick={handlePaymentClick}
                      className="w-full h-12 bg-amber-500 hover:bg-amber-600 text-white gap-2 text-base"
                    >
                      <DollarSign className="h-5 w-5" />
                      تسجيل دفع
                    </Button>
                  </>
                )}
                {sessionActionDialog.session.status === "cancelled" && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-500/10 text-rose-700 text-sm font-medium">
                    <XCircle className="h-4 w-4" />
                    تم إلغاء هذه الحصة
                  </div>
                )}
                {sessionActionDialog.session.status === "vacation" && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 text-amber-700 text-sm font-medium">
                    <CalendarIcon className="h-4 w-4" />
                    هذه الحصة إجازة
                  </div>
                )}
              </div>
            </div>
          )}
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setSessionActionDialog(null)} className="rounded-xl">
              إغلاق
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Complete Confirmation Dialog */}
      <AlertDialog
        open={completeConfirmDialog?.open || false}
        onOpenChange={(open) => !open && setCompleteConfirmDialog(null)}
      >
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد إكمال الحصة</AlertDialogTitle>
            <AlertDialogDescription>
              هل تريد تسجيل حصة <strong>{completeConfirmDialog?.student.name}</strong> في{" "}
              <strong>{completeConfirmDialog?.session.time || completeConfirmDialog?.student.sessionTime}</strong>{" "}
              كمكتملة؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={confirmComplete} className="bg-emerald-600 text-white hover:bg-emerald-700">
              تأكيد الإكمال
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog
        open={cancelConfirmDialog?.open || false}
        onOpenChange={(open) => !open && setCancelConfirmDialog(null)}
      >
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد إلغاء الحصة</AlertDialogTitle>
            <AlertDialogDescription>
              هل تريد إلغاء حصة <strong>{cancelConfirmDialog?.student.name}</strong> في{" "}
              <strong>{cancelConfirmDialog?.session.time || cancelConfirmDialog?.student.sessionTime}</strong>؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>رجوع</AlertDialogCancel>
            <AlertDialogAction onClick={confirmCancel} className="bg-rose-600 text-white hover:bg-rose-700">
              تأكيد الإلغاء
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reschedule Confirmation Dialog */}
      <Dialog open={confirmDialog?.open || false} onOpenChange={(open) => !open && setConfirmDialog(null)}>
        <DialogContent dir="rtl" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              {confirmDialog?.conflictInfo.hasConflict ? (
                <XCircle className="h-6 w-6 text-rose-500" />
              ) : confirmDialog?.conflictInfo.severity === "warning" ? (
                <AlertTriangle className="h-6 w-6 text-amber-500" />
              ) : (
                <CheckCircle2 className="h-6 w-6 text-primary" />
              )}
              تأكيد تغيير موعد الحصة
            </DialogTitle>
            <DialogDescription>
              حصة <span className="font-bold text-foreground">{confirmDialog?.studentName}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {confirmDialog?.conflictInfo.hasConflict && (
              <div className="p-4 rounded-xl bg-rose-500/10 border-2 border-rose-500/30 flex items-start gap-3">
                <XCircle className="h-5 w-5 text-rose-500 mt-0.5 shrink-0" />
                <div>
                  <p className="font-bold text-rose-700">لا يمكن نقل الحصة</p>
                  <p className="text-sm text-rose-600 mt-1">
                    يوجد تعارض مع حصة <span className="font-bold">{confirmDialog.conflictInfo.conflictStudent}</span> في
                    الساعة {confirmDialog.conflictInfo.conflictTime}
                  </p>
                </div>
              </div>
            )}
            {confirmDialog?.conflictInfo.severity === "warning" && !confirmDialog.conflictInfo.hasConflict && (
              <div className="p-4 rounded-xl bg-amber-500/10 border-2 border-amber-500/30 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                <div>
                  <p className="font-bold text-amber-700">تحذير: حصة قريبة</p>
                  <p className="text-sm text-amber-600 mt-1">
                    يوجد حصة قريبة لـ <span className="font-bold">{confirmDialog.conflictInfo.conflictStudent}</span> في
                    الساعة {confirmDialog.conflictInfo.conflictTime}
                  </p>
                </div>
              </div>
            )}
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
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground font-medium">الموعد الجديد:</Label>
              <div
                className={cn(
                  "p-3 border-2 rounded-xl",
                  confirmDialog?.conflictInfo.hasConflict
                    ? "bg-rose-500/10 border-rose-500/30"
                    : "bg-gradient-to-br from-primary/10 to-primary/5 border-primary/30",
                )}
              >
                <div
                  className={cn(
                    "text-sm font-bold",
                    confirmDialog?.conflictInfo.hasConflict ? "text-rose-700" : "text-primary",
                  )}
                >
                  {confirmDialog && format(parseISO(confirmDialog.newDate), "EEEE dd/MM/yyyy", { locale: ar })}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-time" className="text-sm font-medium">
                اختر الوقت الجديد:
              </Label>
              <Select value={confirmDialog?.newTime} onValueChange={updateConfirmDialogTime}>
                <SelectTrigger
                  id="new-time"
                  className={cn(
                    "h-11 rounded-xl border-2",
                    confirmDialog?.conflictInfo.hasConflict && "border-rose-500/50",
                  )}
                >
                  <SelectValue placeholder="اختر الوقت" />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {timeOptions.map((time) => {
                    const timeConflict = confirmDialog
                      ? checkTimeConflict(confirmDialog.studentId, confirmDialog.sessionId, confirmDialog.newDate, time)
                      : null;
                    return (
                      <SelectItem
                        key={time}
                        value={time}
                        className={cn(
                          timeConflict?.hasConflict && "text-rose-500",
                          timeConflict?.severity === "warning" && !timeConflict.hasConflict && "text-amber-500",
                        )}
                      >
                        <span className="flex items-center gap-2">
                          {time}
                          {timeConflict?.hasConflict && (
                            <Badge variant="destructive" className="text-[10px] px-1 py-0">
                              تعارض
                            </Badge>
                          )}
                          {timeConflict?.severity === "warning" && !timeConflict.hasConflict && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0 text-amber-500 border-amber-500">
                              قريب
                            </Badge>
                          )}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">💡 الوقت الحالي: {confirmDialog?.originalTime}</p>
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setConfirmDialog(null)} className="rounded-xl">
              إلغاء
            </Button>
            <Button
              onClick={confirmReschedule}
              disabled={!confirmDialog?.newTime || confirmDialog?.conflictInfo.hasConflict}
              className={cn(
                "rounded-xl shadow-lg hover:shadow-xl",
                confirmDialog?.conflictInfo.hasConflict
                  ? "bg-muted text-muted-foreground cursor-not-allowed"
                  : "bg-gradient-to-r from-primary to-primary/80",
              )}
            >
              {confirmDialog?.conflictInfo.hasConflict ? "غير متاح" : "تأكيد النقل"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
