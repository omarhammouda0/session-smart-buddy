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
  MoreHorizontal,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Student, Session } from "@/types/student";
import { DAY_NAMES_SHORT_AR } from "@/lib/arabicConstants";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";

interface CalendarViewProps {
  students: Student[];
  onRescheduleSession: (studentId: string, sessionId: string, newDate: string) => void;
  onUpdateSessionDateTime?: (studentId: string, sessionId: string, newDate: string, newTime: string) => void;
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

export const CalendarView = ({ students, onRescheduleSession, onUpdateSessionDateTime }: CalendarViewProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"week" | "month">("week");
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dropTargetDate, setDropTargetDate] = useState<string | null>(null);
  const [selectedDaySheet, setSelectedDaySheet] = useState<{ date: string; sessions: SessionWithStudent[] } | null>(
    null,
  );
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

  // Build sessions map
  const sessionsByDate = useMemo(() => {
    const map = new Map<string, SessionWithStudent[]>();

    students.forEach((student) => {
      student.sessions.forEach((session) => {
        const existing = map.get(session.date) || [];
        existing.push({ session, student });
        map.set(session.date, existing);
      });
    });

    // Sort sessions by time
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

  // ✅ IMPROVED: Check for time conflicts with more detailed info
  const checkTimeConflict = useCallback(
    (studentId: string, sessionId: string, newDate: string, newTime: string): ConflictInfo => {
      const sessionsOnDate = sessionsByDate.get(newDate) || [];
      const sessionDuration = 60; // Default duration

      if (!newTime) {
        return { hasConflict: false, severity: "none" };
      }

      const [newHour, newMin] = newTime.split(":").map(Number);
      const newStartMinutes = newHour * 60 + newMin;
      const newEndMinutes = newStartMinutes + sessionDuration;

      for (const { session, student } of sessionsOnDate) {
        // Skip same session or same student
        if (session.id === sessionId || student.id === studentId) continue;

        const otherTime = session.time || student.sessionTime;
        if (!otherTime) continue;

        const [otherHour, otherMin] = otherTime.split(":").map(Number);
        const otherStartMinutes = otherHour * 60 + otherMin;
        const otherEndMinutes = otherStartMinutes + sessionDuration;

        // Check for overlap
        const hasOverlap =
          (newStartMinutes >= otherStartMinutes && newStartMinutes < otherEndMinutes) ||
          (newEndMinutes > otherStartMinutes && newEndMinutes <= otherEndMinutes) ||
          (newStartMinutes <= otherStartMinutes && newEndMinutes >= otherEndMinutes);

        if (hasOverlap) {
          return {
            hasConflict: true,
            conflictStudent: student.name,
            conflictTime: otherTime,
            severity: "error",
          };
        }

        // Check for close proximity (within 15 minutes) - warning only
        const timeDiff = Math.abs(newStartMinutes - otherStartMinutes);
        if (timeDiff < 15 && timeDiff > 0) {
          return {
            hasConflict: false,
            conflictStudent: student.name,
            conflictTime: otherTime,
            severity: "warning",
          };
        }
      }

      return { hasConflict: false, severity: "none" };
    },
    [sessionsByDate],
  );

  // ✅ NEW: Check conflict for drop target (used for visual feedback)
  const getDropTargetConflict = useCallback(
    (targetDate: string): ConflictInfo => {
      if (!dragState && !touchDragState?.active) {
        return { hasConflict: false, severity: "none" };
      }

      const state = dragState || touchDragState;
      if (!state) return { hasConflict: false, severity: "none" };

      return checkTimeConflict(state.studentId, state.sessionId, targetDate, state.originalTime);
    },
    [dragState, touchDragState, checkTimeConflict],
  );

  const goToPrev = () => {
    if (viewMode === "week") {
      setCurrentDate(subWeeks(currentDate, 1));
    } else {
      setCurrentDate(subMonths(currentDate, 1));
    }
  };

  const goToNext = () => {
    if (viewMode === "week") {
      setCurrentDate(addWeeks(currentDate, 1));
    } else {
      setCurrentDate(addMonths(currentDate, 1));
    }
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

        if (navigator.vibrate) {
          navigator.vibrate(50);
        }

        toast({
          title: "اسحب الحصة",
          description: "حرك إصبعك لنقل الحصة إلى يوم آخر",
        });
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
        if (dateStr && dateStr !== touchDragState.originalDate) {
          setDropTargetDate(dateStr);
        }
      } else {
        setDropTargetDate(null);
      }
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

  // ✅ Re-check conflict when time changes in dialog
  const updateConfirmDialogTime = (newTime: string) => {
    if (!confirmDialog) return;

    const conflictInfo = checkTimeConflict(
      confirmDialog.studentId,
      confirmDialog.sessionId,
      confirmDialog.newDate,
      newTime,
    );

    setConfirmDialog({
      ...confirmDialog,
      newTime,
      conflictInfo,
    });
  };

  const confirmReschedule = () => {
    if (!confirmDialog) return;

    // Block if there's a hard conflict
    if (confirmDialog.conflictInfo.hasConflict) {
      toast({
        title: "❌ لا يمكن نقل الحصة",
        description: `يوجد تعارض مع حصة ${confirmDialog.conflictInfo.conflictStudent} في نفس الوقت`,
        variant: "destructive",
      });
      return;
    }

    // Use onUpdateSessionDateTime to update BOTH date AND time
    if (onUpdateSessionDateTime) {
      onUpdateSessionDateTime(
        confirmDialog.studentId,
        confirmDialog.sessionId,
        confirmDialog.newDate,
        confirmDialog.newTime,
      );
    } else {
      onRescheduleSession(confirmDialog.studentId, confirmDialog.sessionId, confirmDialog.newDate);
    }

    toast({
      title: "✓ تم تعديل موعد الحصة",
      description: `تم نقل حصة ${confirmDialog.studentName} من ${format(parseISO(confirmDialog.originalDate), "dd/MM")} الساعة ${confirmDialog.originalTime} إلى ${format(parseISO(confirmDialog.newDate), "dd/MM")} الساعة ${confirmDialog.newTime}`,
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
        {/* Calendar Grid */}
        <div className="grid gap-3 grid-cols-7">
          {/* Day headers */}
          {DAY_NAMES_SHORT_AR.map((day, i) => (
            <div
              key={i}
              className="text-center text-sm font-bold text-muted-foreground py-3 bg-muted/30 rounded-xl border-b-2 border-primary/10"
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
            const isDragging = dragState !== null || touchDragState?.active;
            const isDropTarget =
              dropTargetDate === dateStr &&
              dragState?.originalDate !== dateStr &&
              touchDragState?.originalDate !== dateStr;

            // ✅ Get conflict info for drop target
            const dropConflict = isDropTarget ? getDropTargetConflict(dateStr) : null;
            const hasDropConflict = dropConflict?.hasConflict;
            const hasDropWarning = dropConflict?.severity === "warning";

            const maxVisible = viewMode === "week" ? 4 : 2;

            return (
              <div
                key={index}
                data-date={dateStr}
                className={cn(
                  "border-2 rounded-xl p-2 sm:p-3 transition-all duration-200 touch-manipulation relative",
                  viewMode === "week" ? "min-h-[160px] sm:min-h-[200px]" : "min-h-[100px] sm:min-h-[140px]",
                  !isCurrentMonth && "opacity-40 bg-muted/20",
                  isToday && "ring-2 ring-primary shadow-lg bg-primary/5",
                  // ✅ Visual feedback for conflicts
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
                {/* ✅ Conflict indicator on drop target */}
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

                {/* Date header */}
                <div
                  className={cn(
                    "flex items-center justify-between mb-2 sm:mb-3 pb-1 sm:pb-2 border-b-2",
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

                {/* Sessions */}
                <div className="space-y-1.5 sm:space-y-2">
                  {daySessions.slice(0, maxVisible).map(({ session, student }) => {
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
                        className={cn(
                          "text-xs sm:text-sm p-2 sm:p-3 rounded-lg border-2 flex items-start gap-1.5 sm:gap-2 transition-all duration-200 touch-manipulation select-none",
                          getStatusColor(session.status),
                          canDrag && "cursor-grab active:cursor-grabbing hover:shadow-lg active:scale-95",
                          !canDrag && "cursor-default opacity-75",
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

                  {/* Show More Button */}
                  {daySessions.length > maxVisible && (
                    <Sheet
                      open={selectedDaySheet?.date === dateStr}
                      onOpenChange={(open) => !open && setSelectedDaySheet(null)}
                    >
                      <SheetTrigger asChild>
                        <button
                          onClick={() => setSelectedDaySheet({ date: dateStr, sessions: daySessions })}
                          className="w-full text-xs text-primary hover:text-primary/80 py-2 bg-primary/5 hover:bg-primary/10 rounded-lg font-bold transition-colors flex items-center justify-center gap-1.5"
                        >
                          <MoreHorizontal className="h-3.5 w-3.5" />+{daySessions.length - maxVisible} المزيد
                        </button>
                      </SheetTrigger>
                      <SheetContent side="left" className="w-full sm:max-w-md">
                        <SheetHeader>
                          <SheetTitle className="text-right font-bold">
                            {format(parseISO(dateStr), "EEEE dd MMMM yyyy", { locale: ar })}
                          </SheetTitle>
                        </SheetHeader>
                        <ScrollArea className="h-[calc(100vh-120px)] mt-4">
                          <div className="space-y-3 pr-4">
                            {daySessions.map(({ session, student }) => {
                              const time = session.time || student.sessionTime;

                              return (
                                <div
                                  key={session.id}
                                  className={cn(
                                    "p-4 rounded-xl border-2 transition-all",
                                    getStatusColor(session.status),
                                  )}
                                >
                                  <div className="flex items-start justify-between">
                                    <div>
                                      <div className="font-bold text-base">{student.name}</div>
                                      <div className="text-sm opacity-80 flex items-center gap-2 mt-2">
                                        <Clock className="h-4 w-4" />
                                        <span className="font-medium">{time}</span>
                                      </div>
                                    </div>
                                    <div
                                      className={cn(
                                        "text-xs px-2.5 py-1 rounded-full font-bold",
                                        session.status === "completed" && "bg-emerald-500/30 text-emerald-700",
                                        session.status === "cancelled" && "bg-rose-500/30 text-rose-700",
                                        session.status === "vacation" && "bg-amber-500/30 text-amber-700",
                                        session.status === "scheduled" && "bg-blue-500/30 text-blue-700",
                                      )}
                                    >
                                      {getStatusLabel(session.status)}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </ScrollArea>
                      </SheetContent>
                    </Sheet>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
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

      {/* ✅ IMPROVED: Reschedule Confirmation Dialog with Conflict Warning */}
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
            {/* ✅ Conflict Warning Banner */}
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
                    // Check if this time has conflict
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
