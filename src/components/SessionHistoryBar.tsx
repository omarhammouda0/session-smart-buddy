import { useState, useMemo } from "react";
import {
  format,
  parseISO,
  isBefore,
  isAfter,
  startOfToday,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  addWeeks,
  addMonths,
  subMonths,
} from "date-fns";
import { ar } from "date-fns/locale";
import {
  History,
  Users,
  Check,
  X,
  Calendar,
  Ban,
  CalendarClock,
  Plus,
  Trash2,
  Palmtree,
  RotateCcw,
  AlertTriangle,
  XCircle,
  FileText,
  BookOpen,
  ClipboardCheck,
  Loader2,
  Search,
  ChevronDown,
  Clock,
  TrendingUp,
} from "lucide-react";
import { Student, Session, HomeworkStatus } from "@/types/student";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { formatShortDateAr, formatDurationAr } from "@/lib/arabicConstants";
import { useConflictDetection, ConflictResult, formatTimeAr } from "@/hooks/useConflictDetection";
import { GapIndicator } from "@/components/GapIndicator";
import { ConflictWarning } from "@/components/ConflictWarning";
import { RestoreConflictDialog } from "@/components/RestoreConflictDialog";
import { CancelSessionDialog } from "@/components/CancelSessionDialog";
import { SessionNotesDialog } from "@/components/notes/SessionNotesDialog";
import { SessionHomeworkDialog } from "@/components/notes/SessionHomeworkDialog";
import { toast } from "@/hooks/use-toast";

interface CancellationRecord {
  id: string;
  studentId: string;
  sessionDate: string;
  sessionTime?: string;
  reason?: string;
  cancelledAt: string;
  month: string;
}

interface SessionHistoryBarProps {
  students: Student[];
  onCancelSession?: (studentId: string, sessionId: string, reason?: string) => void;
  onDeleteSession?: (studentId: string, sessionId: string) => void;
  onRestoreSession?: (studentId: string, sessionId: string) => void;
  onToggleComplete?: (studentId: string, sessionId: string) => void;
  onRescheduleSession?: (studentId: string, sessionId: string, newDate: string) => void;
  onAddSession?: (studentId: string, date: string, customTime?: string) => void;
  onMarkAsVacation?: (studentId: string, sessionId: string) => void;
  onUpdateSessionDetails?: (
    studentId: string,
    sessionId: string,
    details: {
      topic?: string;
      notes?: string;
      homework?: string;
      homeworkStatus?: HomeworkStatus;
    },
  ) => void;
  getCancellationCount?: (studentId: string, month?: string) => number;
  getAllStudentCancellations?: (studentId: string) => CancellationRecord[];
  onClearMonthCancellations?: (studentId: string, month: string) => Promise<boolean>;
}

type TimeFilter = "this-week" | "next-week" | "this-month" | "next-month" | "last-month" | "custom";
type SortOrder = "date-asc" | "date-desc" | "time-asc";

export const SessionHistoryBar = ({
  students,
  onCancelSession,
  onDeleteSession,
  onRestoreSession,
  onToggleComplete,
  onRescheduleSession,
  onAddSession,
  onMarkAsVacation,
  onUpdateSessionDetails,
  getCancellationCount,
  getAllStudentCancellations,
  onClearMonthCancellations,
}: SessionHistoryBarProps) => {
  const [selectedStudentId, setSelectedStudentId] = useState<string>("all");
  const [historyTab, setHistoryTab] = useState<"upcoming" | "history">("upcoming");
  const [searchQuery, setSearchQuery] = useState("");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("this-week");
  const [customDateRange, setCustomDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [sortOrder, setSortOrder] = useState<SortOrder>("date-asc");

  const today = startOfToday();
  const [rescheduleDate, setRescheduleDate] = useState<Date | undefined>(undefined);
  const [addSessionDate, setAddSessionDate] = useState<Date | undefined>(undefined);
  const [addSessionTime, setAddSessionTime] = useState<string>("");
  const [showTimePickerDialog, setShowTimePickerDialog] = useState(false);

  // Dialog states
  const [restoreConflictDialog, setRestoreConflictDialog] = useState<{
    open: boolean;
    studentId: string;
    sessionId: string;
    conflictResult: ConflictResult;
    sessionInfo: { studentName: string; date: string; time: string };
  } | null>(null);

  const [vacationDialog, setVacationDialog] = useState<{
    open: boolean;
    studentId: string;
    sessionId: string;
    sessionInfo: { studentName: string; date: string; time: string };
  } | null>(null);

  const [cancelDialog, setCancelDialog] = useState<{
    open: boolean;
    student: Student;
    session: Session & { studentId: string };
  } | null>(null);

  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState<{
    open: boolean;
    studentId: string;
    sessionId: string;
    sessionInfo: { studentName: string; date: string; time: string; status: string };
  } | null>(null);

  const [completeDialog, setCompleteDialog] = useState<{
    open: boolean;
    studentId: string;
    sessionId: string;
    sessionInfo: { studentName: string; date: string; time: string };
  } | null>(null);

  const [undoCompleteDialog, setUndoCompleteDialog] = useState<{
    open: boolean;
    studentId: string;
    sessionId: string;
    sessionInfo: { studentName: string; date: string; time: string };
  } | null>(null);

  const [restoreDialog, setRestoreDialog] = useState<{
    open: boolean;
    studentId: string;
    sessionId: string;
    sessionInfo: { studentName: string; date: string; time: string; previousStatus: string };
  } | null>(null);

  const selectedStudent = students.find((s) => s.id === selectedStudentId);

  // Conflict detection
  const { checkRestoreConflict, getSessionsWithGaps } = useConflictDetection(students);

  // ==================== TIME FILTER LOGIC ====================

  const getFilterDateRange = (): { start: string; end: string } => {
    const todayStr = format(today, "yyyy-MM-dd");

    switch (timeFilter) {
      case "this-week": {
        const weekStart = startOfWeek(today, { weekStartsOn: 0 });
        const weekEnd = endOfWeek(today, { weekStartsOn: 0 });
        return {
          start: format(weekStart, "yyyy-MM-dd"),
          end: format(weekEnd, "yyyy-MM-dd"),
        };
      }
      case "next-week": {
        const nextWeekStart = startOfWeek(addWeeks(today, 1), { weekStartsOn: 0 });
        const nextWeekEnd = endOfWeek(addWeeks(today, 1), { weekStartsOn: 0 });
        return {
          start: format(nextWeekStart, "yyyy-MM-dd"),
          end: format(nextWeekEnd, "yyyy-MM-dd"),
        };
      }
      case "this-month": {
        const monthStart = startOfMonth(today);
        const monthEnd = endOfMonth(today);
        return {
          start: format(monthStart, "yyyy-MM-dd"),
          end: format(monthEnd, "yyyy-MM-dd"),
        };
      }
      case "next-month": {
        const nextMonthStart = startOfMonth(addMonths(today, 1));
        const nextMonthEnd = endOfMonth(addMonths(today, 1));
        return {
          start: format(nextMonthStart, "yyyy-MM-dd"),
          end: format(nextMonthEnd, "yyyy-MM-dd"),
        };
      }
      case "last-month": {
        const lastMonthStart = startOfMonth(subMonths(today, 1));
        const lastMonthEnd = endOfMonth(subMonths(today, 1));
        return {
          start: format(lastMonthStart, "yyyy-MM-dd"),
          end: format(lastMonthEnd, "yyyy-MM-dd"),
        };
      }
      case "custom": {
        if (customDateRange.from && customDateRange.to) {
          return {
            start: format(customDateRange.from, "yyyy-MM-dd"),
            end: format(customDateRange.to, "yyyy-MM-dd"),
          };
        }
        return { start: todayStr, end: todayStr };
      }
      default:
        return { start: todayStr, end: todayStr };
    }
  };

  const getFilterLabel = (): string => {
    const { start, end } = getFilterDateRange();

    switch (timeFilter) {
      case "this-week":
        return `هذا الأسبوع (${formatShortDateAr(start)} - ${formatShortDateAr(end)})`;
      case "next-week":
        return `الأسبوع القادم (${formatShortDateAr(start)} - ${formatShortDateAr(end)})`;
      case "this-month":
        return `هذا الشهر (${format(parseISO(start), "MMMM yyyy", { locale: ar })})`;
      case "next-month":
        return `الشهر القادم (${format(parseISO(start), "MMMM yyyy", { locale: ar })})`;
      case "last-month":
        return `الشهر الماضي (${format(parseISO(start), "MMMM yyyy", { locale: ar })})`;
      case "custom":
        return customDateRange.from && customDateRange.to
          ? `${formatShortDateAr(start)} - ${formatShortDateAr(end)}`
          : "نطاق مخصص";
      default:
        return "";
    }
  };

  // ==================== ACTION HANDLERS ====================

  const handleDateSelect = (date: Date) => {
    if (!selectedStudent) return;
    setAddSessionDate(date);
    setAddSessionTime(selectedStudent.sessionTime);
    setShowTimePickerDialog(true);
  };

  const handleConfirmAddSession = () => {
    if (addSessionDate && selectedStudent) {
      handleAddSession(selectedStudent.id, addSessionDate, addSessionTime);
    }
  };

  const handleAddSession = (studentId: string, date: Date, customTime?: string) => {
    const student = students.find((s) => s.id === studentId);
    if (!student) return;

    const dateStr = format(date, "yyyy-MM-dd");
    const todayStr = format(today, "yyyy-MM-dd");
    const isPastSession = dateStr < todayStr;
    const sessionTime = customTime || student.sessionTime;
    const sessionDuration = student.sessionDuration || 60;

    const existingSessionAtSameTime = student.sessions.find((s) => {
      if (s.date !== dateStr) return false;
      const existingTime = s.time || student.sessionTime;
      const existingDuration = s.duration || student.sessionDuration || 60;
      return checkTimeConflict(sessionTime, sessionDuration, existingTime, existingDuration);
    });

    if (existingSessionAtSameTime) {
      toast({
        title: "⚠️ لا يمكن إضافة الحصة",
        description: `يوجد بالفعل جلسة لـ ${student.name} في ${formatShortDateAr(dateStr)} في نفس الوقت (${formatTimeAr(sessionTime)})`,
        variant: "destructive",
      });
      return;
    }

    const conflictsWithOtherStudents = students.some((otherStudent) => {
      if (otherStudent.id === studentId) return false;
      return otherStudent.sessions.some((session) => {
        if (session.date !== dateStr) return false;
        const otherTime = session.time || otherStudent.sessionTime;
        const otherDuration = session.duration || otherStudent.sessionDuration || 60;
        return checkTimeConflict(sessionTime, sessionDuration, otherTime, otherDuration);
      });
    });

    if (conflictsWithOtherStudents) {
      const conflictingStudent = students.find((s) =>
        s.sessions.some((session) => {
          if (session.date !== dateStr || s.id === studentId) return false;
          const otherTime = session.time || s.sessionTime;
          const otherDuration = session.duration || s.sessionDuration || 60;
          return checkTimeConflict(sessionTime, sessionDuration, otherTime, otherDuration);
        }),
      );

      toast({
        title: "⚠️ لا يمكن إضافة الحصة",
        description: `يوجد تعارض مع جلسة ${conflictingStudent?.name} في نفس الوقت (${formatTimeAr(sessionTime)})`,
        variant: "destructive",
      });
      return;
    }

    onAddSession?.(studentId, dateStr, sessionTime);
    setAddSessionDate(undefined);
    setAddSessionTime("");
    setShowTimePickerDialog(false);

    if (isPastSession) {
      toast({
        title: "✅ تمت الإضافة بنجاح",
        description: `تم إضافة جلسة سابقة في ${formatShortDateAr(dateStr)} الساعة ${formatTimeAr(sessionTime)} وتم تسجيلها كمكتملة تلقائياً`,
      });
    } else {
      toast({
        title: "✅ تمت الإضافة بنجاح",
        description: `تم إضافة جلسة جديدة في ${formatShortDateAr(dateStr)} الساعة ${formatTimeAr(sessionTime)} في الحصص القادمة`,
      });
    }
  };

  const openCompleteDialog = (studentId: string, sessionId: string) => {
    const student = students.find((s) => s.id === studentId);
    const session = student?.sessions.find((s) => s.id === sessionId);
    if (!student || !session) return;

    setCompleteDialog({
      open: true,
      studentId,
      sessionId,
      sessionInfo: {
        studentName: student.name,
        date: formatShortDateAr(session.date),
        time: session.time || student.sessionTime,
      },
    });
  };

  const handleConfirmComplete = () => {
    if (completeDialog) {
      onToggleComplete?.(completeDialog.studentId, completeDialog.sessionId);
      toast({
        title: "✅ تم إكمال الجلسة",
        description: `تم تسجيل الجلسة كمكتملة ونقلها إلى السجل`,
      });
      setCompleteDialog(null);
    }
  };

  const openUndoCompleteDialog = (studentId: string, sessionId: string) => {
    const student = students.find((s) => s.id === studentId);
    const session = student?.sessions.find((s) => s.id === sessionId);
    if (!student || !session) return;

    setUndoCompleteDialog({
      open: true,
      studentId,
      sessionId,
      sessionInfo: {
        studentName: student.name,
        date: formatShortDateAr(session.date),
        time: session.time || student.sessionTime,
      },
    });
  };

  const handleConfirmUndoComplete = () => {
    if (undoCompleteDialog) {
      const student = students.find((s) => s.id === undoCompleteDialog.studentId);
      const session = student?.sessions.find((s) => s.id === undoCompleteDialog.sessionId);
      const todayStr = format(today, "yyyy-MM-dd");
      const isPastSession = session && session.date < todayStr;

      onToggleComplete?.(undoCompleteDialog.studentId, undoCompleteDialog.sessionId);

      if (isPastSession) {
        toast({
          title: "↩️ تم التراجع عن الإكمال",
          description: `تم تغيير حالة الجلسة من "مكتملة" إلى "مجدولة" (ستبقى في السجل لأنها جلسة سابقة)`,
        });
      } else {
        toast({
          title: "↩️ تم التراجع عن الإكمال",
          description: `تم إرجاع الجلسة من "مكتملة" إلى الحصص القادمة`,
        });
      }
      setUndoCompleteDialog(null);
    }
  };

  const openRestoreDialog = (studentId: string, sessionId: string) => {
    const student = students.find((s) => s.id === studentId);
    const session = student?.sessions.find((s) => s.id === sessionId);
    if (!student || !session) return;

    const todayStr = format(today, "yyyy-MM-dd");
    const isPastSession = session.date < todayStr;

    if (isPastSession) {
      setRestoreDialog({
        open: true,
        studentId,
        sessionId,
        sessionInfo: {
          studentName: student.name,
          date: formatShortDateAr(session.date),
          time: session.time || student.sessionTime,
          previousStatus: getStatusLabel(session.status),
        },
      });
      return;
    }

    const conflictResult = checkRestoreConflict(studentId, sessionId);

    if (conflictResult.severity === "none") {
      setRestoreDialog({
        open: true,
        studentId,
        sessionId,
        sessionInfo: {
          studentName: student.name,
          date: formatShortDateAr(session.date),
          time: session.time || student.sessionTime,
          previousStatus: getStatusLabel(session.status),
        },
      });
    } else {
      setRestoreConflictDialog({
        open: true,
        studentId,
        sessionId,
        conflictResult,
        sessionInfo: {
          studentName: student.name,
          date: formatShortDateAr(session.date),
          time: session.time || student.sessionTime,
        },
      });
    }
  };

  const handleConfirmRestore = () => {
    if (restoreDialog) {
      onRestoreSession?.(restoreDialog.studentId, restoreDialog.sessionId);
      const student = students.find((s) => s.id === restoreDialog.studentId);
      const session = student?.sessions.find((s) => s.id === restoreDialog.sessionId);
      const todayStr = format(today, "yyyy-MM-dd");
      const isPastSession = session && session.date < todayStr;

      if (isPastSession) {
        toast({
          title: "✅ تم تحديث الحالة",
          description: `تم استعادة الجلسة من "${restoreDialog.sessionInfo.previousStatus}" إلى "مجدولة" (ستبقى في السجل لأنها جلسة سابقة)`,
        });
      } else {
        toast({
          title: "✅ تمت الاستعادة بنجاح",
          description: `تم استعادة الجلسة من "${restoreDialog.sessionInfo.previousStatus}" وإرجاعها إلى الحصص القادمة`,
        });
      }
      setRestoreDialog(null);
    }
  };

  const handleConfirmRestoreWithConflict = () => {
    if (restoreConflictDialog) {
      onRestoreSession?.(restoreConflictDialog.studentId, restoreConflictDialog.sessionId);
      toast({
        title: "✅ تمت الاستعادة رغم التعارض",
        description: `تم استعادة الجلسة إلى الحصص القادمة (يوجد تعارض مع جلسات أخرى)`,
        variant: "default",
      });
      setRestoreConflictDialog(null);
    }
  };

  const handleMarkAsVacation = (studentId: string, sessionId: string) => {
    const student = students.find((s) => s.id === studentId);
    const session = student?.sessions.find((s) => s.id === sessionId);
    if (!student || !session) return;

    setVacationDialog({
      open: true,
      studentId,
      sessionId,
      sessionInfo: {
        studentName: student.name,
        date: formatShortDateAr(session.date),
        time: session.time || student.sessionTime,
      },
    });
  };

  const handleConfirmVacation = () => {
    if (vacationDialog) {
      onMarkAsVacation?.(vacationDialog.studentId, vacationDialog.sessionId);
      toast({
        title: "🏖️ تم تحديد الجلسة كإجازة",
        description: `تم نقل الجلسة إلى السجل كإجازة (لن يتم احتسابها في الدفعات أو نسبة الإنجاز)`,
      });
      setVacationDialog(null);
    }
  };

  const openCancelDialog = (studentId: string, sessionId: string) => {
    const student = students.find((s) => s.id === studentId);
    const session = student?.sessions.find((s) => s.id === sessionId);
    if (!student || !session) return;

    setCancelDialog({
      open: true,
      student,
      session: { ...session, studentId },
    });
  };

  const handleConfirmCancel = (reason?: string) => {
    if (cancelDialog) {
      const sessionMonth = format(new Date(cancelDialog.session.date), "yyyy-MM");
      const cancellationCount = getCancellationCount?.(cancelDialog.student.id, sessionMonth) ?? 0;
      const monthlyLimit = cancelDialog.student.cancellationPolicy?.monthlyLimit ?? 3;

      onCancelSession?.(cancelDialog.session.studentId, cancelDialog.session.id, reason);

      if (cancellationCount + 1 >= monthlyLimit) {
        toast({
          title: "⚠️ تم إلغاء الجلسة",
          description: `تم إلغاء الجلسة${reason ? ` (${reason})` : ""}. لقد وصلت إلى الحد الشهري للإلغاءات (${monthlyLimit})`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "❌ تم إلغاء الجلسة",
          description: `تم إلغاء الجلسة ونقلها إلى السجل${reason ? ` - السبب: ${reason}` : ""}`,
        });
      }
      setCancelDialog(null);
    }
  };

  const handleCancelAsVacation = () => {
    if (cancelDialog) {
      onMarkAsVacation?.(cancelDialog.session.studentId, cancelDialog.session.id);
      toast({
        title: "🏖️ تم تحديد الجلسة كإجازة",
        description: `تم تحديد الجلسة كإجازة بدلاً من إلغاء (لن يتم احتسابها في حد الإلغاءات)`,
      });
      setCancelDialog(null);
    }
  };

  const openDeleteConfirmDialog = (studentId: string, sessionId: string) => {
    const student = students.find((s) => s.id === studentId);
    const session = student?.sessions.find((s) => s.id === sessionId);
    if (!student || !session) return;

    setDeleteConfirmDialog({
      open: true,
      studentId,
      sessionId,
      sessionInfo: {
        studentName: student.name,
        date: formatShortDateAr(session.date),
        time: session.time || student.sessionTime,
        status: getStatusLabel(session.status),
      },
    });
  };

  const handleConfirmDelete = () => {
    if (deleteConfirmDialog) {
      onDeleteSession?.(deleteConfirmDialog.studentId, deleteConfirmDialog.sessionId);
      toast({
        title: "🗑️ تم الحذف نهائياً",
        description: `تم حذف الجلسة بشكل نهائي ولا يمكن استعادتها. يمكنك الآن إضافة جلسة جديدة في نفس التاريخ`,
        variant: "destructive",
      });
      setDeleteConfirmDialog(null);
    }
  };

  // ==================== HELPER FUNCTIONS ====================

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "completed":
        return "مكتملة";
      case "cancelled":
        return "ملغاة";
      case "vacation":
        return "إجازة";
      case "scheduled":
        return "مجدولة";
      default:
        return status;
    }
  };

  const checkTimeConflict = (time1: string, duration1: number, time2: string, duration2: number) => {
    const [h1, m1] = time1.split(":").map(Number);
    const [h2, m2] = time2.split(":").map(Number);
    const start1 = h1 * 60 + m1;
    const end1 = start1 + duration1;
    const start2 = h2 * 60 + m2;
    const end2 = start2 + duration2;
    return start1 < end2 && end1 > start2;
  };

  const getRelativeTimeLabel = (dateStr: string): string => {
    const sessionDate = parseISO(dateStr);
    const todayDate = today;
    const diffDays = Math.floor((sessionDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "⏰ اليوم";
    if (diffDays === 1) return "⏱️ غداً";
    if (diffDays === -1) return "⏱️ أمس";
    if (diffDays > 0 && diffDays <= 7) return `⏱️ بعد ${diffDays} ${diffDays === 2 ? "يومان" : "أيام"}`;
    if (diffDays < 0 && diffDays >= -7)
      return `⏱️ منذ ${Math.abs(diffDays)} ${Math.abs(diffDays) === 2 ? "يومان" : "أيام"}`;
    return "";
  };

  const sortSessions = (sessions: (Session & { studentName: string; studentId: string })[]) => {
    return sessions.sort((a, b) => {
      const student = students.find((s) => s.id === a.studentId);
      const dateCompare = sortOrder === "date-desc" ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date);

      if (dateCompare !== 0) return dateCompare;

      const timeA = a.time || student?.sessionTime || "";
      const timeB = b.time || student?.sessionTime || "";

      if (sortOrder === "time-asc") {
        return timeA.localeCompare(timeB);
      }

      return 0;
    });
  };

  const filterSessionsByDateRange = (sessions: (Session & { studentName: string; studentId: string })[]) => {
    const { start, end } = getFilterDateRange();
    return sessions.filter((s) => s.date >= start && s.date <= end);
  };

  const filterSessionsBySearch = (sessions: (Session & { studentName: string; studentId: string })[]) => {
    if (!searchQuery.trim()) return sessions;

    const query = searchQuery.toLowerCase();
    return sessions.filter((s) => {
      const matchName = s.studentName.toLowerCase().includes(query);
      const matchDate = s.date.includes(query) || formatShortDateAr(s.date).includes(query);
      const matchNotes = s.notes?.toLowerCase().includes(query);
      const matchTopic = s.topic?.toLowerCase().includes(query);

      return matchName || matchDate || matchNotes || matchTopic;
    });
  };

  const getUpcomingSessions = () => {
    if (!selectedStudent) return [];
    const todayStr = format(today, "yyyy-MM-dd");

    let sessions = selectedStudent.sessions
      .filter((session) => session.status === "scheduled" && session.date >= todayStr)
      .map((session) => ({ ...session, studentName: selectedStudent.name, studentId: selectedStudent.id }));

    sessions = filterSessionsByDateRange(sessions);
    sessions = filterSessionsBySearch(sessions);
    sessions = sortSessions(sessions);

    return sessions;
  };

  const getHistorySessions = () => {
    if (!selectedStudent) return [];

    let sessions = selectedStudent.sessions
      .filter((s) => s.status === "completed" || s.status === "cancelled" || s.status === "vacation")
      .map((s) => ({ ...s, studentName: selectedStudent.name, studentId: selectedStudent.id }));

    sessions = filterSessionsByDateRange(sessions);
    sessions = filterSessionsBySearch(sessions);
    sessions = sortSessions(sessions);

    return sessions;
  };

  const getHistoryStats = () => {
    if (!selectedStudent) return { completed: 0, cancelled: 0, vacation: 0, total: 0, completionRate: 0 };

    const { start, end } = getFilterDateRange();
    const filteredSessions = selectedStudent.sessions.filter((s) => s.date >= start && s.date <= end);

    let completed = 0,
      cancelled = 0,
      vacation = 0;

    filteredSessions.forEach((session) => {
      if (session.status === "completed") completed++;
      else if (session.status === "cancelled") cancelled++;
      else if (session.status === "vacation") vacation++;
    });

    const total = completed + cancelled + vacation;
    const rateTotal = completed + cancelled;

    return {
      completed,
      cancelled,
      vacation,
      total,
      completionRate: rateTotal > 0 ? Math.round((completed / rateTotal) * 100) : 0,
    };
  };

  const upcomingSessions = getUpcomingSessions();
  const historySessions = getHistorySessions();
  const historyStats = getHistoryStats();

  // ==================== RENDER ====================

  return (
    <Card dir="rtl" className="border-2">
      <CardHeader className="pb-3 bg-gradient-to-r from-card to-primary/5">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-heading flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            📊 حصص {selectedStudent?.name || "الطلاب"}
          </CardTitle>
          {selectedStudentId !== "all" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedStudentId("all");
                setSearchQuery("");
                setTimeFilter("this-week");
              }}
              className="h-8 gap-1"
            >
              <X className="h-3.5 w-3.5" />
              إلغاء التحديد
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-4">
        {/* Student Selector */}
        <div className="flex items-center gap-2">
          <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
            <SelectTrigger className="w-full h-11 bg-background">
              <Users className="h-4 w-4 ml-2 text-muted-foreground shrink-0" />
              <SelectValue placeholder="اختر طالب لعرض التفاصيل" />
            </SelectTrigger>
            <SelectContent className="bg-popover z-50">
              <SelectItem value="all" className="text-muted-foreground">
                اختر طالب...
              </SelectItem>
              {students.map((student) => (
                <SelectItem key={student.id} value={student.id}>
                  {student.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedStudentId !== "all" && selectedStudent ? (
          <>
            {/* Status Cards */}
            <div className="grid grid-cols-4 gap-2">
              {[
                {
                  label: "قادمة",
                  count: upcomingSessions.length,
                  icon: CalendarClock,
                  color: "from-blue-500 to-cyan-500",
                  bg: "bg-blue-500/10",
                  border: "border-blue-500/30",
                },
                {
                  label: "مكتملة",
                  count: historyStats.completed,
                  icon: Check,
                  color: "from-emerald-500 to-green-500",
                  bg: "bg-emerald-500/10",
                  border: "border-emerald-500/30",
                },
                {
                  label: "ملغية",
                  count: historyStats.cancelled,
                  icon: Ban,
                  color: "from-rose-500 to-red-500",
                  bg: "bg-rose-500/10",
                  border: "border-rose-500/30",
                },
                {
                  label: "إجازة",
                  count: historyStats.vacation,
                  icon: Palmtree,
                  color: "from-amber-500 to-yellow-500",
                  bg: "bg-amber-500/10",
                  border: "border-amber-500/30",
                },
              ].map((stat, i) => (
                <div key={i} className={cn("rounded-xl border-2 p-3 text-center", stat.bg, stat.border)}>
                  <stat.icon className="h-4 w-4 mx-auto mb-1" />
                  <p className="text-2xl font-bold">{stat.count}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Time Filters */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                فترة العرض
              </label>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: "this-week" as TimeFilter, label: "هذا الأسبوع" },
                  { value: "next-week" as TimeFilter, label: "الأسبوع القادم" },
                  { value: "this-month" as TimeFilter, label: "هذا الشهر" },
                  { value: "next-month" as TimeFilter, label: "الشهر القادم" },
                  { value: "last-month" as TimeFilter, label: "الشهر الماضي" },
                ].map((filter) => (
                  <Button
                    key={filter.value}
                    variant={timeFilter === filter.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTimeFilter(filter.value)}
                    className="h-8 text-xs"
                  >
                    {filter.label}
                  </Button>
                ))}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={timeFilter === "custom" ? "default" : "outline"}
                      size="sm"
                      className="h-8 text-xs gap-1"
                    >
                      نطاق مخصص
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-3" align="start">
                    <div className="space-y-2">
                      <p className="text-sm font-medium">اختر نطاقاً مخصصاً</p>
                      <CalendarPicker
                        mode="range"
                        selected={{ from: customDateRange.from, to: customDateRange.to }}
                        onSelect={(range) => {
                          setCustomDateRange({ from: range?.from, to: range?.to });
                          if (range?.from && range?.to) {
                            setTimeFilter("custom");
                          }
                        }}
                        numberOfMonths={1}
                        className="rounded-md border"
                      />
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Active Filter Display */}
              <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-lg p-2">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  عرض: <span className="font-semibold text-foreground">{getFilterLabel()}</span>
                </p>
                {timeFilter !== "this-week" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setTimeFilter("this-week")}
                    className="h-6 px-2 text-xs"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>

            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="بحث في الحصص (التاريخ، الملاحظات، الموضوع...)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10 h-10 bg-background"
              />
            </div>

            {/* Tabs */}
            <Tabs value={historyTab} onValueChange={(v) => setHistoryTab(v as "upcoming" | "history")}>
              <TabsList className="w-full grid grid-cols-2">
                <TabsTrigger value="upcoming" className="gap-1.5">
                  <CalendarClock className="h-4 w-4" />
                  القادمة ({upcomingSessions.length})
                </TabsTrigger>
                <TabsTrigger value="history" className="gap-1.5">
                  <History className="h-4 w-4" />
                  السجل ({historySessions.length})
                </TabsTrigger>
              </TabsList>

              {/* Upcoming Tab */}
              <TabsContent value="upcoming" className="mt-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as SortOrder)}>
                      <SelectTrigger className="h-8 w-[140px] text-xs">
                        <TrendingUp className="h-3 w-3 ml-1" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="date-asc">التاريخ (الأقرب)</SelectItem>
                        <SelectItem value="date-desc">التاريخ (الأبعد)</SelectItem>
                        <SelectItem value="time-asc">الوقت (الأبكر)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="default" size="sm" className="h-8 px-3 gap-1.5 shadow-lg">
                        <Plus className="h-3.5 w-3.5" />
                        إضافة حصة
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
                      <CalendarPicker
                        mode="single"
                        selected={addSessionDate}
                        onSelect={(date) => date && handleDateSelect(date)}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <ScrollArea className="h-[350px]">
                  <div className="space-y-2 pr-2">
                    {upcomingSessions.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <CalendarClock className="h-12 w-12 mx-auto mb-3 opacity-20" />
                        <p className="text-sm font-medium">لا توجد حصص قادمة</p>
                        <p className="text-xs mt-1">في الفترة المحددة</p>
                      </div>
                    ) : (
                      upcomingSessions.map((session) => {
                        const relativeTime = getRelativeTimeLabel(session.date);
                        const sessionsWithGaps = getSessionsWithGaps(session.date);
                        const sessionGapInfo = sessionsWithGaps.find((s) => s.session.id === session.id);
                        const hasConflict = sessionGapInfo?.hasConflict || false;
                        const conflictType = sessionGapInfo?.conflictType;

                        return (
                          <div
                            key={session.id}
                            className={cn(
                              "relative rounded-xl border-2 p-3 bg-card transition-all hover:shadow-md",
                              hasConflict &&
                                (conflictType === "exact" || conflictType === "partial") &&
                                "border-destructive/50 bg-destructive/5",
                              hasConflict && conflictType === "close" && "border-warning/50 bg-warning/5",
                              !hasConflict && "border-border",
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge variant="outline" className="text-xs font-semibold">
                                    {formatShortDateAr(session.date)}
                                  </Badge>
                                  <span className="text-sm font-bold">
                                    {session.time || selectedStudent.sessionTime}
                                  </span>
                                  {relativeTime && (
                                    <span className="text-xs text-muted-foreground">{relativeTime}</span>
                                  )}
                                </div>

                                {hasConflict && (
                                  <p className="text-xs text-destructive font-medium mt-1">
                                    {conflictType === "exact" || conflictType === "partial"
                                      ? "❌ تعارض في الوقت"
                                      : "⚠️ قريب جداً من جلسة أخرى"}
                                  </p>
                                )}
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                <SessionNotesDialog
                                  session={session}
                                  studentId={session.studentId}
                                  studentName={session.studentName}
                                />
                                <SessionHomeworkDialog
                                  session={session}
                                  studentId={session.studentId}
                                  studentName={session.studentName}
                                />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-success hover:bg-success/10"
                                  onClick={() => openCompleteDialog(session.studentId, session.id)}
                                  title="إكمال"
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-warning hover:bg-warning/10"
                                  onClick={() => handleMarkAsVacation(session.studentId, session.id)}
                                  title="إجازة"
                                >
                                  <Palmtree className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                  onClick={() => openCancelDialog(session.studentId, session.id)}
                                  title="إلغاء"
                                >
                                  <Ban className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                  onClick={() => openDeleteConfirmDialog(session.studentId, session.id)}
                                  title="حذف"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* History Tab */}
              <TabsContent value="history" className="mt-3 space-y-3">
                {historyStats.total > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-success/10 border-2 border-success/30 rounded-xl p-3 text-center">
                      <p className="text-2xl font-bold text-success">{historyStats.completionRate}%</p>
                      <p className="text-xs text-muted-foreground mt-1">نسبة الإنجاز</p>
                    </div>
                    <div className="bg-muted/50 border-2 rounded-xl p-3 text-center">
                      <p className="text-2xl font-bold">{historyStats.total}</p>
                      <p className="text-xs text-muted-foreground mt-1">إجمالي الحصص</p>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as SortOrder)}>
                    <SelectTrigger className="h-8 w-[140px] text-xs">
                      <TrendingUp className="h-3 w-3 ml-1" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="date-asc">التاريخ (الأقدم)</SelectItem>
                      <SelectItem value="date-desc">التاريخ (الأحدث)</SelectItem>
                      <SelectItem value="time-asc">الوقت (الأبكر)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <ScrollArea className="h-[300px]">
                  <div className="space-y-2 pr-2">
                    {historySessions.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <History className="h-12 w-12 mx-auto mb-3 opacity-20" />
                        <p className="text-sm font-medium">لا توجد حصص سابقة</p>
                        <p className="text-xs mt-1">في الفترة المحددة</p>
                      </div>
                    ) : (
                      historySessions.map((session) => {
                        const todayStr = format(today, "yyyy-MM-dd");
                        const isPastSession = session.date < todayStr;
                        const relativeTime = getRelativeTimeLabel(session.date);

                        return (
                          <div
                            key={session.id}
                            className={cn(
                              "rounded-xl border-2 p-3 transition-all hover:shadow-md",
                              session.status === "completed" && "bg-success/5 border-success/30",
                              session.status === "vacation" && "bg-warning/5 border-warning/30",
                              session.status === "cancelled" && "bg-destructive/5 border-destructive/30",
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <div
                                    className={cn(
                                      "w-6 h-6 rounded-full flex items-center justify-center shrink-0",
                                      session.status === "completed" && "bg-success/20 text-success",
                                      session.status === "vacation" && "bg-warning/20 text-warning",
                                      session.status === "cancelled" && "bg-destructive/20 text-destructive",
                                    )}
                                  >
                                    {session.status === "completed" ? (
                                      <Check className="h-3.5 w-3.5" />
                                    ) : session.status === "vacation" ? (
                                      <Palmtree className="h-3.5 w-3.5" />
                                    ) : (
                                      <X className="h-3.5 w-3.5" />
                                    )}
                                  </div>

                                  <Badge variant="outline" className="text-xs">
                                    {formatShortDateAr(session.date)}
                                  </Badge>
                                  <span className="text-sm font-bold">
                                    {session.time || selectedStudent.sessionTime}
                                  </span>
                                  {relativeTime && (
                                    <span className="text-xs text-muted-foreground">{relativeTime}</span>
                                  )}
                                </div>

                                {session.topic && (
                                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                    <BookOpen className="h-3 w-3" />
                                    {session.topic}
                                  </p>
                                )}
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                <Badge
                                  className={cn(
                                    "text-xs",
                                    session.status === "completed" && "bg-success/20 text-success border-success/30",
                                    session.status === "vacation" && "bg-warning/20 text-warning border-warning/30",
                                    session.status === "cancelled" &&
                                      "bg-destructive/20 text-destructive border-destructive/30",
                                  )}
                                >
                                  {getStatusLabel(session.status)}
                                </Badge>

                                <SessionNotesDialog
                                  session={session}
                                  studentId={session.studentId}
                                  studentName={session.studentName}
                                />
                                <SessionHomeworkDialog
                                  session={session}
                                  studentId={session.studentId}
                                  studentName={session.studentName}
                                />

                                {isPastSession ? (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                    onClick={() => openDeleteConfirmDialog(session.studentId, session.id)}
                                    title="حذف"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                ) : (
                                  <>
                                    {session.status === "completed" ? (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 px-2 text-warning hover:bg-warning/10"
                                        onClick={() => openUndoCompleteDialog(session.studentId, session.id)}
                                        title="تراجع"
                                      >
                                        <X className="h-3.5 w-3.5 ml-1" />
                                        تراجع
                                      </Button>
                                    ) : (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 px-2 text-success hover:bg-success/10"
                                        onClick={() => openRestoreDialog(session.studentId, session.id)}
                                        title="استعادة"
                                      >
                                        <RotateCcw className="h-3.5 w-3.5 ml-1" />
                                        استعادة
                                      </Button>
                                    )}
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                      onClick={() => openDeleteConfirmDialog(session.studentId, session.id)}
                                      title="حذف"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>

                {getAllStudentCancellations && (
                  <CancellationHistoryInline
                    student={selectedStudent}
                    cancellations={getAllStudentCancellations(selectedStudent.id)}
                    onRestore={openRestoreDialog}
                    onClearMonth={onClearMonthCancellations}
                  />
                )}
              </TabsContent>
            </Tabs>
          </>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="h-16 w-16 mx-auto mb-4 opacity-20" />
            <p className="text-sm font-medium">اختر طالب من القائمة أعلاه</p>
            <p className="text-xs mt-1">لعرض حصصه وسجله</p>
          </div>
        )}
      </CardContent>

      {/* All Dialogs - KEEPING ORIGINAL IMPLEMENTATION */}

      <AlertDialog open={completeDialog?.open ?? false} onOpenChange={(open) => !open && setCompleteDialog(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-success">
              <Check className="h-5 w-5" />
              تأكيد إكمال الحصة
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>هل تريد تسجيل هذه الحصة كمكتملة؟</p>
              {completeDialog && (
                <div className="bg-success/10 border border-success/30 rounded-lg p-3 mt-2">
                  <p className="font-medium text-foreground">{completeDialog.sessionInfo.studentName}</p>
                  <p className="text-sm text-muted-foreground">
                    {completeDialog.sessionInfo.date} - {formatTimeAr(completeDialog.sessionInfo.time)}
                  </p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmComplete}
              className="bg-success text-success-foreground hover:bg-success/90"
            >
              <Check className="h-4 w-4 ml-1" />
              نعم، أكمل الحصة
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={undoCompleteDialog?.open ?? false}
        onOpenChange={(open) => !open && setUndoCompleteDialog(null)}
      >
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-warning">
              <RotateCcw className="h-5 w-5" />
              تأكيد التراجع عن الإكمال
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>هل تريد التراجع عن إكمال هذه الحصة؟</p>
              {undoCompleteDialog && (
                <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 mt-2">
                  <p className="font-medium text-foreground">{undoCompleteDialog.sessionInfo.studentName}</p>
                  <p className="text-sm text-muted-foreground">
                    {undoCompleteDialog.sessionInfo.date} - {formatTimeAr(undoCompleteDialog.sessionInfo.time)}
                  </p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmUndoComplete}
              className="bg-warning text-warning-foreground hover:bg-warning/90"
            >
              <X className="h-4 w-4 ml-1" />
              نعم، تراجع
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={restoreDialog?.open ?? false} onOpenChange={(open) => !open && setRestoreDialog(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-success">
              <RotateCcw className="h-5 w-5" />
              تأكيد استعادة الحصة
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>هل تريد استعادة هذه الحصة؟</p>
              {restoreDialog && (
                <div className="bg-success/10 border border-success/30 rounded-lg p-3 mt-2">
                  <p className="font-medium text-foreground">{restoreDialog.sessionInfo.studentName}</p>
                  <p className="text-sm text-muted-foreground">
                    {restoreDialog.sessionInfo.date} - {formatTimeAr(restoreDialog.sessionInfo.time)}
                  </p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmRestore}
              className="bg-success text-success-foreground hover:bg-success/90"
            >
              <RotateCcw className="h-4 w-4 ml-1" />
              نعم، استعد الحصة
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {restoreConflictDialog && (
        <RestoreConflictDialog
          open={restoreConflictDialog.open}
          onOpenChange={(open) => !open && setRestoreConflictDialog(null)}
          conflictResult={restoreConflictDialog.conflictResult}
          sessionInfo={restoreConflictDialog.sessionInfo}
          onConfirm={handleConfirmRestoreWithConflict}
        />
      )}

      <AlertDialog open={vacationDialog?.open ?? false} onOpenChange={(open) => !open && setVacationDialog(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-warning">
              <Palmtree className="h-5 w-5" />
              تحديد كإجازة؟
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>هل تريد تحديد هذه الجلسة كإجازة؟</p>
              {vacationDialog && (
                <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 mt-2">
                  <p className="font-medium text-foreground">{vacationDialog.sessionInfo.studentName}</p>
                  <p className="text-sm text-muted-foreground">
                    {vacationDialog.sessionInfo.date} - {formatTimeAr(vacationDialog.sessionInfo.time)}
                  </p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmVacation}
              className="bg-warning text-warning-foreground hover:bg-warning/90"
            >
              <Palmtree className="h-4 w-4 ml-1" />
              نعم، حدد كإجازة
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {cancelDialog && (
        <CancelSessionDialog
          open={cancelDialog.open}
          onOpenChange={(open) => !open && setCancelDialog(null)}
          student={cancelDialog.student}
          session={cancelDialog.session}
          currentCount={
            getCancellationCount?.(cancelDialog.student.id, format(new Date(cancelDialog.session.date), "yyyy-MM")) ?? 0
          }
          onConfirm={handleConfirmCancel}
          onMarkAsVacation={handleCancelAsVacation}
        />
      )}

      <AlertDialog
        open={deleteConfirmDialog?.open ?? false}
        onOpenChange={(open) => !open && setDeleteConfirmDialog(null)}
      >
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              تأكيد الحذف النهائي
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p className="font-medium">هل أنت متأكد من حذف هذه الجلسة نهائياً؟</p>
              {deleteConfirmDialog && (
                <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 mt-2">
                  <p className="font-medium text-foreground">{deleteConfirmDialog.sessionInfo.studentName}</p>
                  <p className="text-sm text-muted-foreground">
                    {deleteConfirmDialog.sessionInfo.date} - {formatTimeAr(deleteConfirmDialog.sessionInfo.time)}
                  </p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <Trash2 className="h-4 w-4 ml-1" />
              نعم، احذف نهائياً
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showTimePickerDialog} onOpenChange={setShowTimePickerDialog}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5" />
              اختر وقت الحصة
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              {addSessionDate && (
                <div className="bg-primary/10 border border-primary/30 rounded-lg p-3">
                  <p className="text-sm font-medium text-foreground">{selectedStudent?.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatShortDateAr(format(addSessionDate, "yyyy-MM-dd"))}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">الوقت:</label>
                <input
                  type="time"
                  value={addSessionTime}
                  onChange={(e) => setAddSessionTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border bg-background text-foreground"
                  dir="ltr"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel
              onClick={() => {
                setShowTimePickerDialog(false);
                setAddSessionDate(undefined);
                setAddSessionTime("");
              }}
            >
              إلغاء
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmAddSession} disabled={!addSessionTime}>
              <Plus className="h-4 w-4 ml-1" />
              إضافة الحصة
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

// Cancellation History Inline Component - KEEPING ORIGINAL
const CancellationHistoryInline = ({
  student,
  cancellations,
  onRestore,
  onClearMonth,
}: {
  student: Student;
  cancellations: CancellationRecord[];
  onRestore?: (studentId: string, sessionId: string) => void;
  onClearMonth?: (studentId: string, month: string) => Promise<boolean>;
}) => {
  const [clearingMonth, setClearingMonth] = useState<string | null>(null);
  const [confirmClearMonth, setConfirmClearMonth] = useState<string | null>(null);

  const groupedByMonth = useMemo(() => {
    const groups: Record<string, CancellationRecord[]> = {};
    cancellations.forEach((c) => {
      if (!groups[c.month]) {
        groups[c.month] = [];
      }
      groups[c.month].push(c);
    });
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [cancellations]);

  const formatMonthLabel = (monthStr: string) => {
    try {
      const [year, month] = monthStr.split("-");
      const date = new Date(parseInt(year), parseInt(month) - 1, 1);
      return format(date, "MMMM yyyy", { locale: ar });
    } catch {
      return monthStr;
    }
  };

  const formatSessionDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return format(date, "EEEE d MMMM", { locale: ar });
    } catch {
      return dateStr;
    }
  };

  const handleRestore = (cancellation: CancellationRecord) => {
    const session = student.sessions.find((s) => s.date === cancellation.sessionDate && s.status === "cancelled");
    if (session && onRestore) {
      onRestore(student.id, session.id);
    }
  };

  const handleClearMonth = async (month: string) => {
    if (!onClearMonth) return;
    setClearingMonth(month);
    setConfirmClearMonth(null);
    try {
      await onClearMonth(student.id, month);
      toast({
        title: "✅ تم تصفير الإلغاءات",
        description: `تم حذف جميع سجلات إلغاء شهر ${formatMonthLabel(month)} نهائياً`,
      });
    } finally {
      setClearingMonth(null);
    }
  };

  const canRestore = (cancellation: CancellationRecord) => {
    return student.sessions.some((s) => s.date === cancellation.sessionDate && s.status === "cancelled");
  };

  if (cancellations.length === 0) return null;

  return (
    <>
      <div className="space-y-3 p-3 rounded-lg border bg-muted/30 mt-4" dir="rtl">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Ban className="h-4 w-4 text-destructive" />
          <span>سجل الإلغاءات</span>
          <Badge variant="secondary" className="text-xs">
            {cancellations.length}
          </Badge>
        </div>

        <div className="space-y-3 max-h-48 overflow-y-auto">
          {groupedByMonth.map(([month, monthCancellations]) => (
            <div key={month} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">{formatMonthLabel(month)}</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs",
                      monthCancellations.length >= (student.cancellationPolicy?.monthlyLimit ?? 3)
                        ? "border-destructive text-destructive"
                        : "",
                    )}
                  >
                    {monthCancellations.length} / {student.cancellationPolicy?.monthlyLimit ?? 3}
                  </Badge>
                </div>
                {onClearMonth && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 gap-1 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setConfirmClearMonth(month)}
                    disabled={clearingMonth === month}
                  >
                    {clearingMonth === month ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
                    )}
                    تصفير
                  </Button>
                )}
              </div>

              <div className="space-y-1">
                {monthCancellations
                  .sort((a, b) => b.sessionDate.localeCompare(a.sessionDate))
                  .map((c) => (
                    <div key={c.id} className="flex items-center justify-between p-2 rounded-md bg-background text-xs">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{formatSessionDate(c.sessionDate)}</p>
                        {c.reason && <p className="text-muted-foreground truncate">{c.reason}</p>}
                      </div>
                      {canRestore(c) && onRestore && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 gap-1 text-xs shrink-0"
                          onClick={() => handleRestore(c)}
                        >
                          <RotateCcw className="h-3 w-3" />
                          استعادة
                        </Button>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <AlertDialog open={!!confirmClearMonth} onOpenChange={(open) => !open && setConfirmClearMonth(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              تأكيد تصفير الإلغاءات
            </AlertDialogTitle>
            <AlertDialogDescription className="text-right">
              سيتم حذف جميع سجلات الإلغاء لشهر {confirmClearMonth ? formatMonthLabel(confirmClearMonth) : ""} نهائياً.
              <br />
              <span className="text-destructive font-medium">هذا الإجراء لا يمكن التراجع عنه.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmClearMonth && handleClearMonth(confirmClearMonth)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              تصفير
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
