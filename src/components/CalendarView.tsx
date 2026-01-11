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
  Plus,
  Filter,
  Download,
  Printer,
  BarChart3,
  Users,
  X,
  Trash2,
  Sunrise,
  Sunset,
  Moon,
  TrendingUp,
  Zap,
  Coffee,
  Star,
  Phone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Student, Session } from "@/types/student";
import { DAY_NAMES_SHORT_AR } from "@/lib/arabicConstants";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  onDeleteSession?: (studentId: string, sessionId: string) => void;
  onQuickPayment?: (studentId: string, sessionId: string, sessionDate: string) => void;
  onAddSession?: (studentId: string, date: string, time?: string) => void;
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
  onDeleteSession,
  onQuickPayment,
  onAddSession,
}: CalendarViewProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"week" | "month">("week");
  const [selectedStudentFilter, setSelectedStudentFilter] = useState<string>("all");
  const [showWeeklySummary, setShowWeeklySummary] = useState(false);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dropTargetDate, setDropTargetDate] = useState<string | null>(null);

  // Add Session Dialog State
  const [addSessionDialog, setAddSessionDialog] = useState<{
    open: boolean;
    date: string;
    selectedStudentId: string;
    time: string;
  } | null>(null);

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
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState<{
    open: boolean;
    session: Session;
    student: Student;
  } | null>(null);

  // Day details dialog - shows all sessions for a specific day
  const [dayDetailsDialog, setDayDetailsDialog] = useState<{
    open: boolean;
    date: string;
    sessions: SessionWithStudent[];
  } | null>(null);

  // Filter students based on selection
  const filteredStudents = useMemo(() => {
    if (selectedStudentFilter === "all") return students;
    return students.filter(s => s.id === selectedStudentFilter);
  }, [students, selectedStudentFilter]);

  const sessionsByDate = useMemo(() => {
    const map = new Map<string, SessionWithStudent[]>();
    filteredStudents.forEach((student) => {
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
  }, [filteredStudents]);

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

  // Weekly/Monthly Summary Calculation
  const periodSummary = useMemo(() => {
    let totalSessions = 0;
    let completedSessions = 0;
    let cancelledSessions = 0;
    let scheduledSessions = 0;
    let totalMinutes = 0;
    const studentStats = new Map<string, { name: string; sessions: number; hours: number }>();

    days.forEach(day => {
      const dateStr = format(day, "yyyy-MM-dd");
      const isInCurrentPeriod = viewMode === "month" ? isSameMonth(day, currentDate) : true;

      if (isInCurrentPeriod) {
        const daySessions = sessionsByDate.get(dateStr) || [];
        daySessions.forEach(({ session, student }) => {
          totalSessions++;
          const duration = session.duration || student.sessionDuration || 60;

          if (session.status === "completed") {
            completedSessions++;
            totalMinutes += duration;
          } else if (session.status === "cancelled") {
            cancelledSessions++;
          } else if (session.status === "scheduled") {
            scheduledSessions++;
            totalMinutes += duration;
          }

          // Track per-student stats
          const existing = studentStats.get(student.id) || { name: student.name, sessions: 0, hours: 0 };
          existing.sessions++;
          if (session.status !== "cancelled") {
            existing.hours += duration / 60;
          }
          studentStats.set(student.id, existing);
        });
      }
    });

    const totalHours = Math.round(totalMinutes / 60 * 10) / 10;
    const completionRate = totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;

    // Additional insights
    // Find busiest day
    let busiestDay = { date: "", count: 0 };
    const dayOfWeekStats = new Array(7).fill(0);
    const timeSlotStats = { morning: 0, afternoon: 0, evening: 0 };

    days.forEach(day => {
      const dateStr = format(day, "yyyy-MM-dd");
      const isInCurrentPeriod = viewMode === "month" ? isSameMonth(day, currentDate) : true;
      if (!isInCurrentPeriod) return;

      const daySessions = sessionsByDate.get(dateStr) || [];
      if (daySessions.length > busiestDay.count) {
        busiestDay = { date: dateStr, count: daySessions.length };
      }

      // Day of week distribution
      dayOfWeekStats[day.getDay()] += daySessions.length;

      // Time slot distribution
      daySessions.forEach(({ session, student }) => {
        const time = session.time || student.sessionTime || "12:00";
        const hour = parseInt(time.split(":")[0]);
        if (hour < 12) timeSlotStats.morning++;
        else if (hour < 17) timeSlotStats.afternoon++;
        else timeSlotStats.evening++;
      });
    });

    // Find most popular day of week
    const dayNames = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
    const busiestDayOfWeek = dayOfWeekStats.indexOf(Math.max(...dayOfWeekStats));

    return {
      totalSessions,
      completedSessions,
      cancelledSessions,
      scheduledSessions,
      totalHours,
      completionRate,
      studentStats: Array.from(studentStats.values()).sort((a, b) => b.sessions - a.sessions),
      busiestDay,
      busiestDayOfWeek: dayNames[busiestDayOfWeek],
      busiestDayOfWeekCount: dayOfWeekStats[busiestDayOfWeek],
      timeSlotStats,
      averageSessionsPerDay: days.length > 0 ? Math.round(totalSessions / days.length * 10) / 10 : 0,
    };
  }, [days, sessionsByDate, currentDate, viewMode]);

  // Get time of day icon and color
  const getTimeOfDayInfo = (time: string) => {
    const hour = parseInt(time?.split(":")[0] || "12");
    if (hour < 12) return { icon: Sunrise, color: "text-amber-500", label: "صباحاً" };
    if (hour < 17) return { icon: Sunset, color: "text-orange-500", label: "ظهراً" };
    return { icon: Moon, color: "text-indigo-500", label: "مساءً" };
  };

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

  const handleDeleteClick = () => {
    if (!sessionActionDialog) return;
    setSessionActionDialog(null);
    setDeleteConfirmDialog({ open: true, session: sessionActionDialog.session, student: sessionActionDialog.student });
  };

  const confirmDelete = () => {
    if (!deleteConfirmDialog || !onDeleteSession) return;
    onDeleteSession(deleteConfirmDialog.student.id, deleteConfirmDialog.session.id);
    setDeleteConfirmDialog(null);
    toast({
      title: "✓ تم حذف الحصة",
      description: `تم حذف حصة ${deleteConfirmDialog.student.name} نهائياً`,
    });
  };

  const handlePaymentClick = () => {
    if (!sessionActionDialog || !onQuickPayment) return;
    const { session, student } = sessionActionDialog;
    setSessionActionDialog(null);
    onQuickPayment(student.id, session.id, session.date);
  };

  // Add new session
  const handleAddNewSession = () => {
    if (!addSessionDialog || !onAddSession || !addSessionDialog.selectedStudentId) return;
    onAddSession(addSessionDialog.selectedStudentId, addSessionDialog.date, addSessionDialog.time || undefined);
    setAddSessionDialog(null);
    toast({
      title: "✓ تمت إضافة الحصة",
      description: `تمت إضافة حصة جديدة في ${format(parseISO(addSessionDialog.date), "dd/MM/yyyy", { locale: ar })}`,
    });
  };

  // Export to text/clipboard
  const handleExport = (type: "copy" | "print") => {
    const periodLabel = viewMode === "week"
      ? `${format(days[0], "dd MMM", { locale: ar })} - ${format(days[days.length - 1], "dd MMM yyyy", { locale: ar })}`
      : format(currentDate, "MMMM yyyy", { locale: ar });

    let exportText = `📅 تقرير التقويم - ${periodLabel}\n`;
    exportText += `${"═".repeat(40)}\n\n`;

    exportText += `📊 ملخص الفترة:\n`;
    exportText += `• إجمالي الحصص: ${periodSummary.totalSessions}\n`;
    exportText += `• المكتملة: ${periodSummary.completedSessions}\n`;
    exportText += `• الملغاة: ${periodSummary.cancelledSessions}\n`;
    exportText += `• المجدولة: ${periodSummary.scheduledSessions}\n`;
    exportText += `• إجمالي الساعات: ${periodSummary.totalHours} ساعة\n`;
    exportText += `• نسبة الإنجاز: ${periodSummary.completionRate}%\n\n`;

    exportText += `📋 تفاصيل الحصص:\n`;
    exportText += `${"─".repeat(40)}\n`;

    days.forEach(day => {
      const dateStr = format(day, "yyyy-MM-dd");
      const isInCurrentPeriod = viewMode === "month" ? isSameMonth(day, currentDate) : true;
      if (!isInCurrentPeriod) return;

      const daySessions = sessionsByDate.get(dateStr) || [];
      if (daySessions.length === 0) return;

      exportText += `\n📆 ${format(day, "EEEE dd/MM/yyyy", { locale: ar })}\n`;
      daySessions.forEach(({ session, student }) => {
        const time = session.time || student.sessionTime;
        const status = getStatusLabel(session.status);
        exportText += `   • ${time} - ${student.name} (${status})\n`;
      });
    });

    if (type === "copy") {
      navigator.clipboard.writeText(exportText);
      toast({
        title: "✓ تم النسخ",
        description: "تم نسخ التقرير إلى الحافظة",
      });
    } else {
      // Print
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(`
          <html dir="rtl" lang="ar">
            <head>
              <title>تقرير التقويم - ${periodLabel}</title>
              <style>
                body { font-family: 'Cairo', 'Tajawal', Arial, sans-serif; padding: 20px; line-height: 1.8; }
                pre { white-space: pre-wrap; font-family: inherit; }
              </style>
            </head>
            <body><pre>${exportText}</pre></body>
          </html>
        `);
        printWindow.document.close();
        printWindow.print();
      }
    }
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

  // Handle day click to show all sessions
  const handleDayClick = (dateStr: string, sessions: SessionWithStudent[]) => {
    if (dragState || touchDragState?.active) return;
    setDayDetailsDialog({
      open: true,
      date: dateStr,
      sessions,
    });
  };

  return (
    <Card className="w-full border-2 shadow-xl overflow-hidden">
      <CardHeader className="space-y-4 pb-4 bg-gradient-to-br from-primary/5 via-background to-background border-b">
        {/* Header Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary to-purple-500 text-white shadow-lg shadow-primary/25">
              <CalendarIcon className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-display font-bold text-foreground">
                عرض التقويم
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 font-medium">
                {selectedStudentFilter === "all"
                  ? `${students.length} طالب • ${periodSummary.totalSessions} حصة`
                  : `${periodSummary.totalSessions} حصة`
                }
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Student Filter */}
            <Select value={selectedStudentFilter} onValueChange={setSelectedStudentFilter}>
              <SelectTrigger className="w-[160px] h-9 rounded-lg border-2 text-sm">
                <Filter className="h-3.5 w-3.5 ml-2 text-muted-foreground" />
                <SelectValue placeholder="كل الطلاب" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  <span className="flex items-center gap-2">
                    <Users className="h-3.5 w-3.5" />
                    كل الطلاب
                  </span>
                </SelectItem>
                {students.map(student => (
                  <SelectItem key={student.id} value={student.id}>
                    {student.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Summary Toggle */}
            <Button
              variant={showWeeklySummary ? "default" : "outline"}
              size="sm"
              onClick={() => setShowWeeklySummary(!showWeeklySummary)}
              className="h-9 gap-1.5 rounded-lg"
            >
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">ملخص</span>
            </Button>

            {/* Export Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-1.5 rounded-lg">
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline">تصدير</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExport("copy")}>
                  <Download className="h-4 w-4 ml-2" />
                  نسخ للحافظة
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("print")}>
                  <Printer className="h-4 w-4 ml-2" />
                  طباعة
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Weekly Summary Panel - Enhanced */}
        {showWeeklySummary && (
          <div className="space-y-4 p-4 rounded-xl bg-gradient-to-br from-muted/40 to-muted/20 border-2">
            {/* Main Stats Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="text-center p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 hover:scale-105 transition-transform">
                <CalendarIcon className="h-5 w-5 mx-auto mb-1 text-blue-500" />
                <p className="text-2xl font-bold text-blue-600 tabular-nums">{periodSummary.totalSessions}</p>
                <p className="text-xs text-muted-foreground font-medium">إجمالي الحصص</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 hover:scale-105 transition-transform">
                <CheckCircle2 className="h-5 w-5 mx-auto mb-1 text-emerald-500" />
                <p className="text-2xl font-bold text-emerald-600 tabular-nums">{periodSummary.completedSessions}</p>
                <p className="text-xs text-muted-foreground font-medium">مكتملة</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 hover:scale-105 transition-transform">
                <Clock className="h-5 w-5 mx-auto mb-1 text-purple-500" />
                <p className="text-2xl font-bold text-purple-600 tabular-nums">{periodSummary.totalHours}</p>
                <p className="text-xs text-muted-foreground font-medium">ساعة</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 hover:scale-105 transition-transform">
                <TrendingUp className="h-5 w-5 mx-auto mb-1 text-amber-500" />
                <p className="text-2xl font-bold text-amber-600 tabular-nums">{periodSummary.completionRate}%</p>
                <p className="text-xs text-muted-foreground font-medium">نسبة الإنجاز</p>
              </div>
            </div>

            {/* Completion Progress Bar */}
            {periodSummary.totalSessions > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>تقدم الإنجاز</span>
                  <span>{periodSummary.completedSessions} من {periodSummary.totalSessions}</span>
                </div>
                <Progress value={periodSummary.completionRate} className="h-2" />
              </div>
            )}

            {/* Insights Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t">
              {/* Busiest Day of Week */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-background/50">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Star className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">أكثر يوم ازدحاماً</p>
                  <p className="text-sm font-bold">{periodSummary.busiestDayOfWeek}</p>
                  <p className="text-xs text-muted-foreground">{periodSummary.busiestDayOfWeekCount} حصة</p>
                </div>
              </div>

              {/* Time Distribution */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-background/50">
                <div className="p-2 rounded-lg bg-orange-500/10">
                  <Sunset className="h-4 w-4 text-orange-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">توزيع الأوقات</p>
                  <div className="flex gap-2 text-xs mt-1">
                    <span className="flex items-center gap-1">
                      <Sunrise className="h-3 w-3 text-amber-500" />
                      {periodSummary.timeSlotStats.morning}
                    </span>
                    <span className="flex items-center gap-1">
                      <Sunset className="h-3 w-3 text-orange-500" />
                      {periodSummary.timeSlotStats.afternoon}
                    </span>
                    <span className="flex items-center gap-1">
                      <Moon className="h-3 w-3 text-indigo-500" />
                      {periodSummary.timeSlotStats.evening}
                    </span>
                  </div>
                </div>
              </div>

              {/* Average Per Day */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-background/50">
                <div className="p-2 rounded-lg bg-cyan-500/10">
                  <Zap className="h-4 w-4 text-cyan-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">متوسط يومي</p>
                  <p className="text-sm font-bold">{periodSummary.averageSessionsPerDay} حصة/يوم</p>
                </div>
              </div>
            </div>

            {/* Top Students */}
            {periodSummary.studentStats.length > 0 && (
              <div className="pt-3 border-t">
                <p className="text-xs text-muted-foreground font-semibold mb-2 flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  أكثر الطلاب حصصاً:
                </p>
                <div className="flex flex-wrap gap-2">
                  {periodSummary.studentStats.slice(0, 5).map((stat, i) => (
                    <Badge
                      key={i}
                      variant="secondary"
                      className={cn(
                        "text-xs transition-all hover:scale-105",
                        i === 0 && "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                      )}
                    >
                      {i === 0 && <Star className="h-3 w-3 ml-1 fill-current" />}
                      {stat.name}: {stat.sessions} حصة
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Tip */}
            {periodSummary.cancelledSessions > 0 && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-500/5 border border-rose-500/20 text-sm">
                <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0" />
                <p className="text-rose-700 dark:text-rose-400">
                  لديك <strong>{periodSummary.cancelledSessions}</strong> حصة ملغاة هذا الأسبوع
                </p>
              </div>
            )}
          </div>
        )}

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1.5 bg-muted/50 p-1.5 rounded-xl shadow-inner w-fit">
          {[
            { value: "week", label: "أسبوعي" },
            { value: "month", label: "شهري" },
          ].map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setViewMode(value as "week" | "month")}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200",
                viewMode === value
                  ? "bg-background text-primary shadow-md scale-105"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/50",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Navigation Bar */}
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
          <h3 className="font-display font-bold text-base sm:text-lg text-center px-4 py-2 bg-gradient-to-r from-primary/10 to-purple-500/10 rounded-xl">
            {viewMode === "week"
              ? `${format(days[0], "dd MMM", { locale: ar })} - ${format(days[days.length - 1], "dd MMM yyyy", { locale: ar })}`
              : format(currentDate, "MMMM yyyy", { locale: ar })}
          </h3>
          <Button
            variant="outline"
            size="sm"
            onClick={goToToday}
            className="h-10 px-4 rounded-xl border-2 hover:border-primary hover:bg-primary/5 hover:scale-105 transition-all shadow-sm font-semibold"
          >
            اليوم
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-3 sm:p-6">
        {/* Filter indicator */}
        {selectedStudentFilter !== "all" && (
          <div className="mb-4 p-3 rounded-xl bg-primary/5 border-2 border-primary/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">
                عرض حصص: <span className="font-bold text-primary">{students.find(s => s.id === selectedStudentFilter)?.name}</span>
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedStudentFilter("all")}
              className="h-7 px-2 text-xs"
            >
              <X className="h-3.5 w-3.5 ml-1" />
              إزالة الفلتر
            </Button>
          </div>
        )}

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
                {/* Date header - clickable to see all sessions */}
                <div
                  className={cn(
                    "flex items-center justify-between mb-2 sm:mb-3 pb-1 sm:pb-2 border-b-2 shrink-0 cursor-pointer hover:bg-muted/30 rounded-t-lg -mx-2 -mt-2 sm:-mx-3 sm:-mt-3 px-2 pt-2 sm:px-3 sm:pt-3 transition-colors",
                    isToday ? "border-primary" : "border-border/50",
                    isDropTarget && (hasDropConflict || hasDropWarning) && "mt-6",
                  )}
                  onClick={() => handleDayClick(dateStr, daySessions)}
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
                    <span className="text-[10px] sm:text-xs bg-primary text-primary-foreground px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full font-bold shadow-sm cursor-pointer hover:scale-110 transition-transform">
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
                          <div className="flex items-center gap-1">
                            <div className="font-bold truncate text-xs sm:text-sm flex-1">{student.name}</div>
                            {/* Session type indicator */}
                            {student.sessionType === "online" ? (
                              <Monitor className="h-3 w-3 text-blue-500 shrink-0" />
                            ) : (
                              <MapPin className="h-3 w-3 text-emerald-500 shrink-0" />
                            )}
                          </div>
                          <div className="text-[10px] sm:text-xs opacity-80 flex items-center gap-1 sm:gap-1.5 mt-0.5 sm:mt-1">
                            {(() => {
                              const timeInfo = getTimeOfDayInfo(time || "12:00");
                              const TimeIcon = timeInfo.icon;
                              return <TimeIcon className={cn("h-3 w-3 sm:h-3.5 sm:w-3.5", timeInfo.color)} />;
                            })()}
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

        {/* Legend Footer */}
        <div className="flex flex-wrap items-center gap-4 mt-6 pt-4 border-t-2 text-sm bg-gradient-to-r from-muted/30 to-muted/10 p-4 rounded-xl">
          <span className="text-muted-foreground font-bold">الحالة:</span>
          {[
            { color: "bg-blue-500/40", label: "مجدولة", icon: CalendarIcon },
            { color: "bg-emerald-500/40", label: "مكتملة", icon: CheckCircle2 },
            { color: "bg-rose-500/40", label: "ملغاة", icon: XCircle },
            { color: "bg-amber-500/40", label: "إجازة", icon: Coffee },
          ].map(({ color, label, icon: Icon }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className={cn("w-4 h-4 rounded-md border-2 border-current flex items-center justify-center", color)}>
                <Icon className="h-2.5 w-2.5" />
              </div>
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

                {/* Delete button - available for all session statuses */}
                {onDeleteSession && (
                  <div className="pt-3 mt-3 border-t">
                    <Button
                      onClick={handleDeleteClick}
                      variant="outline"
                      className="w-full h-10 border-slate-300 text-slate-600 hover:bg-slate-100 hover:text-slate-800 hover:border-slate-400 gap-2 text-sm"
                    >
                      <Trash2 className="h-4 w-4" />
                      حذف الحصة نهائياً
                    </Button>
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={deleteConfirmDialog?.open || false}
        onOpenChange={(open) => !open && setDeleteConfirmDialog(null)}
      >
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-slate-700">
              <Trash2 className="h-5 w-5" />
              تأكيد حذف الحصة
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                هل تريد حذف حصة <strong>{deleteConfirmDialog?.student.name}</strong> في{" "}
                <strong>{deleteConfirmDialog?.session.time || deleteConfirmDialog?.student.sessionTime}</strong> نهائياً؟
              </p>
              <p className="text-rose-600 text-sm font-medium">
                ⚠️ هذا الإجراء لا يمكن التراجع عنه. سيتم حذف الحصة من جميع السجلات.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-slate-700 text-white hover:bg-slate-800">
              <Trash2 className="h-4 w-4 ml-2" />
              حذف نهائياً
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
              <div className="relative">
                <Input
                  id="new-time"
                  type="time"
                  value={confirmDialog?.newTime || ""}
                  onChange={(e) => updateConfirmDialogTime(e.target.value)}
                  className={cn(
                    "h-12 rounded-xl border-2 text-center text-lg font-bold",
                    confirmDialog?.conflictInfo.hasConflict && "border-rose-500/50 text-rose-600",
                    confirmDialog?.conflictInfo.severity === "warning" && !confirmDialog?.conflictInfo.hasConflict && "border-amber-500/50 text-amber-600",
                  )}
                />
                {confirmDialog?.conflictInfo.hasConflict && (
                  <div className="mt-2 p-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-600 text-xs flex items-center gap-1.5">
                    <XCircle className="h-3.5 w-3.5" />
                    تعارض مع {confirmDialog.conflictInfo.conflictStudent} في الساعة {confirmDialog.conflictInfo.conflictTime}
                  </div>
                )}
                {confirmDialog?.conflictInfo.severity === "warning" && !confirmDialog?.conflictInfo.hasConflict && (
                  <div className="mt-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-600 text-xs flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    قريب من {confirmDialog.conflictInfo.conflictStudent} في الساعة {confirmDialog.conflictInfo.conflictTime}
                  </div>
                )}
              </div>
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

      {/* Day Details Dialog - Shows all sessions for a specific day */}
      <Dialog open={dayDetailsDialog?.open || false} onOpenChange={(open) => !open && setDayDetailsDialog(null)}>
        <DialogContent dir="rtl" className="sm:max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl font-display font-bold flex items-center gap-2">
                <div className="p-2 rounded-lg bg-gradient-to-br from-primary to-purple-500 text-white">
                  <CalendarIcon className="h-5 w-5" />
                </div>
                <div>
                  <div>{dayDetailsDialog && format(parseISO(dayDetailsDialog.date), "EEEE", { locale: ar })}</div>
                  <div className="text-sm font-normal text-muted-foreground">
                    {dayDetailsDialog && format(parseISO(dayDetailsDialog.date), "dd MMMM yyyy", { locale: ar })}
                  </div>
                </div>
              </DialogTitle>
              {onAddSession && dayDetailsDialog && (
                <Button
                  size="sm"
                  onClick={() => {
                    setDayDetailsDialog(null);
                    setAddSessionDialog({
                      open: true,
                      date: dayDetailsDialog.date,
                      selectedStudentId: "",
                      time: "",
                    });
                  }}
                  className="h-8 gap-1.5 rounded-lg bg-gradient-to-r from-primary to-purple-500"
                >
                  <Plus className="h-4 w-4" />
                  إضافة حصة
                </Button>
              )}
            </div>
            <DialogDescription>
              {dayDetailsDialog?.sessions.length === 0
                ? "لا توجد حصص في هذا اليوم"
                : `${dayDetailsDialog?.sessions.length} حصة مجدولة`
              }
            </DialogDescription>
          </DialogHeader>

          {dayDetailsDialog && dayDetailsDialog.sessions.length > 0 ? (
            <>
              {/* Day Summary Stats - Compact inline version */}
              <div className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-muted/30 border text-xs shrink-0">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <CalendarIcon className="h-3.5 w-3.5 text-blue-500" />
                    <span className="font-bold text-blue-600">{dayDetailsDialog.sessions.length}</span>
                    <span className="text-muted-foreground">حصص</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    <span className="font-bold text-emerald-600">
                      {dayDetailsDialog.sessions.filter(s => s.session.status === "completed").length}
                    </span>
                    <span className="text-muted-foreground">مكتملة</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-purple-500" />
                    <span className="font-bold text-purple-600">
                      {Math.round(dayDetailsDialog.sessions.reduce((acc, { session, student }) =>
                        acc + (session.status !== "cancelled" ? (session.duration || student.sessionDuration || 60) : 0), 0) / 60 * 10) / 10}
                    </span>
                    <span className="text-muted-foreground">س</span>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto min-h-0 -mx-6 px-6">
                <div className="space-y-1.5 py-2">
                  {dayDetailsDialog.sessions.map(({ session, student }) => {
                    const time = session.time || student.sessionTime;
                    const timeInfo = getTimeOfDayInfo(time || "12:00");
                    const TimeIcon = timeInfo.icon;

                    return (
                      <div
                        key={session.id}
                        className={cn(
                          "p-2 rounded-lg border transition-all hover:shadow-sm cursor-pointer group",
                          getStatusColor(session.status),
                        )}
                        onClick={() => {
                          setDayDetailsDialog(null);
                          setSessionActionDialog({ open: true, session, student });
                        }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center shrink-0">
                              <User className="h-3 w-3" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="font-semibold text-xs truncate block">{student.name}</span>
                              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                <TimeIcon className={cn("h-2.5 w-2.5", timeInfo.color)} />
                                <span>{time}</span>
                                {student.sessionType === "online" ? (
                                  <Monitor className="h-2.5 w-2.5 text-blue-500" />
                                ) : (
                                  <MapPin className="h-2.5 w-2.5 text-emerald-500" />
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Badge className={cn("text-[9px] h-4 px-1.5", getStatusBadgeColor(session.status))}>
                              {getStatusLabel(session.status)}
                            </Badge>
                            {/* Inline action buttons */}
                            {session.status === "scheduled" && onToggleComplete && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-5 w-5 p-0 text-emerald-600 hover:bg-emerald-500/10 opacity-0 group-hover:opacity-100"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDayDetailsDialog(null);
                                  setCompleteConfirmDialog({ open: true, session, student });
                                }}
                              >
                                <CheckCircle2 className="h-3 w-3" />
                              </Button>
                            )}
                            {onDeleteSession && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-5 w-5 p-0 text-slate-400 hover:bg-slate-500/10 hover:text-slate-600 opacity-0 group-hover:opacity-100"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDayDetailsDialog(null);
                                  setDeleteConfirmDialog({ open: true, session, student });
                                }}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <div className="py-12 text-center text-muted-foreground">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted/50 flex items-center justify-center">
                <CalendarIcon className="h-8 w-8 opacity-50" />
              </div>
              <p className="text-lg font-medium">لا توجد حصص</p>
              <p className="text-sm mb-4">هذا اليوم فارغ من الحصص</p>
              {onAddSession && dayDetailsDialog && (
                <Button
                  onClick={() => {
                    setDayDetailsDialog(null);
                    setAddSessionDialog({
                      open: true,
                      date: dayDetailsDialog.date,
                      selectedStudentId: "",
                      time: "",
                    });
                  }}
                  className="gap-2 bg-gradient-to-r from-primary to-purple-500"
                >
                  <Plus className="h-4 w-4" />
                  إضافة حصة جديدة
                </Button>
              )}
            </div>
          )}

          <div className="flex justify-end pt-4 border-t shrink-0">
            <Button variant="outline" onClick={() => setDayDetailsDialog(null)} className="rounded-xl">
              إغلاق
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Session Dialog */}
      <Dialog open={addSessionDialog?.open || false} onOpenChange={(open) => !open && setAddSessionDialog(null)}>
        <DialogContent dir="rtl" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-display font-bold flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              إضافة حصة جديدة
            </DialogTitle>
            <DialogDescription>
              {addSessionDialog && format(parseISO(addSessionDialog.date), "EEEE dd MMMM yyyy", { locale: ar })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Student Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">اختر الطالب</Label>
              <Select
                value={addSessionDialog?.selectedStudentId || ""}
                onValueChange={(value) => {
                  if (addSessionDialog) {
                    const student = students.find(s => s.id === value);
                    setAddSessionDialog({
                      ...addSessionDialog,
                      selectedStudentId: value,
                      time: student?.sessionTime || addSessionDialog.time,
                    });
                  }
                }}
              >
                <SelectTrigger className="h-11 rounded-xl border-2">
                  <SelectValue placeholder="اختر طالب..." />
                </SelectTrigger>
                <SelectContent>
                  {students.map(student => (
                    <SelectItem key={student.id} value={student.id}>
                      <div className="flex items-center gap-2">
                        <User className="h-3.5 w-3.5" />
                        <span>{student.name}</span>
                        <span className="text-xs text-muted-foreground">({student.sessionTime})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Time Input */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">وقت الحصة</Label>
              <Input
                type="time"
                value={addSessionDialog?.time || ""}
                onChange={(e) => {
                  if (addSessionDialog) {
                    setAddSessionDialog({
                      ...addSessionDialog,
                      time: e.target.value,
                    });
                  }
                }}
                className="h-11 rounded-xl border-2 text-center text-lg font-bold"
              />
              {addSessionDialog?.selectedStudentId && (
                <p className="text-xs text-muted-foreground">
                  💡 الوقت الافتراضي للطالب: {students.find(s => s.id === addSessionDialog.selectedStudentId)?.sessionTime}
                </p>
              )}
            </div>

            {/* Conflict Warning */}
            {addSessionDialog?.selectedStudentId && addSessionDialog?.time && (
              (() => {
                const conflict = checkTimeConflict(
                  addSessionDialog.selectedStudentId,
                  "",
                  addSessionDialog.date,
                  addSessionDialog.time
                );
                if (conflict.hasConflict) {
                  return (
                    <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-600 text-sm flex items-center gap-2">
                      <XCircle className="h-4 w-4" />
                      تعارض مع {conflict.conflictStudent} في الساعة {conflict.conflictTime}
                    </div>
                  );
                }
                if (conflict.severity === "warning") {
                  return (
                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-600 text-sm flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      قريب من {conflict.conflictStudent} في الساعة {conflict.conflictTime}
                    </div>
                  );
                }
                return null;
              })()
            )}
          </div>

          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setAddSessionDialog(null)} className="rounded-xl">
              إلغاء
            </Button>
            <Button
              onClick={handleAddNewSession}
              disabled={!addSessionDialog?.selectedStudentId}
              className="rounded-xl bg-gradient-to-r from-primary to-purple-500"
            >
              <Plus className="h-4 w-4 ml-2" />
              إضافة الحصة
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
