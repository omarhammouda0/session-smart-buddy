import { useState, useMemo } from "react";
import { format, parseISO, isBefore, isAfter, startOfToday } from "date-fns";
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
  getCancellationCount?: (studentId: string) => number;
  getAllStudentCancellations?: (studentId: string) => CancellationRecord[];
  onClearMonthCancellations?: (studentId: string, month: string) => Promise<boolean>;
}

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

  const selectedStudent = students.find((s) => s.id === selectedStudentId);

  // Conflict detection
  const { checkRestoreConflict, getSessionsWithGaps } = useConflictDetection(students);

  // ==================== ACTION HANDLERS ====================

  // ✅ Handle date selection - opens time picker dialog
  const handleDateSelect = (date: Date) => {
    if (!selectedStudent) return;
    setAddSessionDate(date);
    setAddSessionTime(selectedStudent.sessionTime || "16:00"); // Default to student's time
    setShowTimePickerDialog(true);
  };

  // ✅ Confirm session creation with selected time
  const handleConfirmAddSession = () => {
    if (addSessionDate && selectedStudent) {
      handleAddSession(selectedStudent.id, addSessionDate, addSessionTime);
    }
  };

  // ✅ ADD SESSION (with custom time and conflict check)
  const handleAddSession = (studentId: string, date: Date, customTime?: string) => {
    const student = students.find((s) => s.id === studentId);
    if (!student) return;

    const dateStr = format(date, "yyyy-MM-dd");
    const todayStr = format(today, "yyyy-MM-dd");
    const isPastSession = dateStr < todayStr;
    // ✅ Use custom time if provided, otherwise use student's default time
    const sessionTime = customTime || student.sessionTime || "16:00";
    const sessionDuration = student.sessionDuration || 60;

    // ✅ Check if session with SAME TIME already exists on this date for THIS student
    const existingSessionAtSameTime = student.sessions.find((s) => {
      if (s.date !== dateStr) return false;
      const existingTime = s.time || student.sessionTime || "16:00";
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

    // ✅ Check for time conflicts with OTHER students on the same date
    const conflictsWithOtherStudents = students.some((otherStudent) => {
      if (otherStudent.id === studentId) return false;
      return otherStudent.sessions.some((session) => {
        if (session.date !== dateStr) return false;
        const otherTime = session.time || otherStudent.sessionTime || "16:00";
        const otherDuration = session.duration || otherStudent.sessionDuration || 60;
        return checkTimeConflict(sessionTime, sessionDuration, otherTime, otherDuration);
      });
    });

    if (conflictsWithOtherStudents) {
      const conflictingStudent = students.find((s) =>
        s.sessions.some((session) => {
          if (session.date !== dateStr || s.id === studentId) return false;
          const otherTime = session.time || s.sessionTime || "16:00";
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

    // ✅ Add the session
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

  // ✅ RESTORE SESSION (with past/future logic)
  const handleRestoreWithCheck = (studentId: string, sessionId: string) => {
    const student = students.find((s) => s.id === studentId);
    const session = student?.sessions.find((s) => s.id === sessionId);
    if (!student || !session) return;

    const todayStr = format(today, "yyyy-MM-dd");
    const isPastSession = session.date < todayStr;
    const sessionTime = session.time || student.sessionTime || "16:00";
    const previousStatus = session.status;

    // Past session: Just restore status, stays in history
    if (isPastSession) {
      onRestoreSession?.(studentId, sessionId);
      toast({
        title: "✅ تم تحديث الحالة",
        description: `تم استعادة الجلسة من "${getStatusLabel(previousStatus)}" إلى "مجدولة" (ستبقى في السجل لأنها جلسة سابقة)`,
      });
      return;
    }

    // Future session: Check conflicts before restoring
    const conflictResult = checkRestoreConflict(studentId, sessionId);

    if (conflictResult.severity === "none") {
      onRestoreSession?.(studentId, sessionId);
      toast({
        title: "✅ تمت الاستعادة بنجاح",
        description: `تم استعادة الجلسة من "${getStatusLabel(previousStatus)}" وإرجاعها إلى الحصص القادمة`,
      });
      return;
    }

    // Show conflict dialog for future sessions
    setRestoreConflictDialog({
      open: true,
      studentId,
      sessionId,
      conflictResult,
      sessionInfo: {
        studentName: student.name,
        date: formatShortDateAr(session.date),
        time: sessionTime,
      },
    });
  };

  const handleConfirmRestore = () => {
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

  // ✅ TOGGLE COMPLETE (with past/future logic)
  const handleToggleComplete = (studentId: string, sessionId: string) => {
    const student = students.find((s) => s.id === studentId);
    const session = student?.sessions.find((s) => s.id === sessionId);
    if (!student || !session) return;

    const todayStr = format(today, "yyyy-MM-dd");
    const isPastSession = session.date < todayStr;
    const isCompleted = session.status === "completed";

    onToggleComplete?.(studentId, sessionId);

    if (isCompleted) {
      // Undoing completion
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
    } else {
      // Marking as complete
      toast({
        title: "✅ تم إكمال الجلسة",
        description: `تم تسجيل الجلسة كمكتملة ونقلها إلى السجل`,
      });
    }
  };

  // ✅ MARK AS VACATION
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
        time: session.time || student.sessionTime || "16:00",
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

  // ✅ CANCEL SESSION
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
      const cancellationCount = getCancellationCount?.(cancelDialog.student.id) ?? 0;
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

  // ✅ DELETE SESSION (with confirmation)
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
        time: session.time || student.sessionTime || "16:00",
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

  // ✅ Only future scheduled sessions
  const getUpcomingSessions = () => {
    if (!selectedStudent) return [];
    const todayStr = format(today, "yyyy-MM-dd");

    return selectedStudent.sessions
      .filter((session) => session.status === "scheduled" && session.date >= todayStr)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((session) => ({ ...session, studentName: selectedStudent.name, studentId: selectedStudent.id }));
  };

  // ✅ History sessions (completed/cancelled/vacation) - ascending order
  const getHistorySessions = () => {
    if (!selectedStudent) return [];
    return selectedStudent.sessions
      .filter((s) => s.status === "completed" || s.status === "cancelled" || s.status === "vacation")
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((s) => ({ ...s, studentName: selectedStudent.name, studentId: selectedStudent.id }));
  };

  const getHistoryStats = () => {
    if (!selectedStudent) return { completed: 0, cancelled: 0, vacation: 0, total: 0, completionRate: 0 };
    let completed = 0,
      cancelled = 0,
      vacation = 0;
    selectedStudent.sessions.forEach((session) => {
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
    <Card dir="rtl">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-heading flex items-center gap-2">
          <History className="h-4 w-4" />
          إدارة الحصص
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">اختر طالب لإضافة حصص جديدة أو عرض السجل</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
            <SelectTrigger className="w-full h-10">
              <Users className="h-4 w-4 ml-2 text-muted-foreground shrink-0" />
              <SelectValue placeholder="اختر طالب لعرض التفاصيل" />
            </SelectTrigger>
            <SelectContent className="bg-popover z-50">
              <SelectItem value="all" className="text-muted-foreground">
                اختر طالب...
              </SelectItem>
              {students.map((student) => (
                <SelectItem key={student.id} value={student.id}>
                  <div className="flex items-center gap-2">
                    <span>{student.name}</span>
                    <span className="text-xs text-muted-foreground">({student.sessionTime || "16:00"})</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedStudentId !== "all" && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelectedStudentId("all")}
              className="h-10 w-10 shrink-0"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {selectedStudentId !== "all" && selectedStudent ? (
          <Tabs value={historyTab} onValueChange={(v) => setHistoryTab(v as "upcoming" | "history")}>
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger value="upcoming" className="gap-1.5 text-xs">
                <CalendarClock className="h-3.5 w-3.5" />
                الحصص القادمة
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-1.5 text-xs">
                <History className="h-3.5 w-3.5" />
                السجل
              </TabsTrigger>
            </TabsList>

            <TabsContent value="upcoming" className="mt-3 space-y-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                  <CalendarClock className="h-3 w-3" />
                  حصص {selectedStudent.name} القادمة
                  <Badge variant="secondary" className="mr-2 text-[10px]">
                    {upcomingSessions.length}
                  </Badge>
                </p>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1">
                      <Plus className="h-3 w-3" />
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
              <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded-lg">
                💡 يمكنك إضافة عدة حصص في نفس اليوم بأوقات مختلفة. الحصص المكتملة/الملغاة/الإجازات تنتقل تلقائياً للسجل.
              </p>
              <ScrollArea className="h-[250px]">
                <div className="space-y-1 pl-2">
                  {upcomingSessions.length === 0 ? (
                    <p className="text-center text-muted-foreground py-6 text-xs">لا توجد حصص قادمة</p>
                  ) : (
                    (() => {
                      const elements: React.ReactNode[] = [];
                      let lastDate: string | null = null;

                      upcomingSessions.forEach((session) => {
                        const sessionsWithGaps = getSessionsWithGaps(session.date);
                        const sessionGapInfo = sessionsWithGaps.find((s) => s.session.id === session.id);

                        const hasConflict = sessionGapInfo?.hasConflict || false;
                        const conflictType = sessionGapInfo?.conflictType;
                        const gapAfter = sessionGapInfo?.gapAfter;

                        if (session.date !== lastDate) {
                          if (lastDate !== null) {
                            elements.push(
                              <div
                                key={`sep-${session.date}`}
                                className="border-t border-dashed border-border/50 my-2"
                              />,
                            );
                          }
                          lastDate = session.date;
                        }

                        elements.push(
                          <div
                            key={session.id}
                            className={cn(
                              "relative flex items-center justify-between p-2.5 rounded-lg text-xs border transition-all bg-card",
                              hasConflict &&
                                (conflictType === "exact" || conflictType === "partial") &&
                                "bg-destructive/5 border-destructive/30",
                              hasConflict && conflictType === "close" && "bg-warning/5 border-warning/30",
                            )}
                          >
                            {hasConflict && (
                              <div
                                className={cn(
                                  "absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] shadow-sm z-10",
                                  (conflictType === "exact" || conflictType === "partial") &&
                                    "bg-destructive text-destructive-foreground",
                                  conflictType === "close" && "bg-warning text-warning-foreground",
                                )}
                              >
                                {conflictType === "exact" || conflictType === "partial" ? (
                                  <XCircle className="h-3 w-3" />
                                ) : (
                                  <AlertTriangle className="h-3 w-3" />
                                )}
                              </div>
                            )}

                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <div
                                className={cn(
                                  "w-5 h-5 rounded-full flex items-center justify-center shrink-0",
                                  !hasConflict && "bg-primary/20 text-primary",
                                  hasConflict &&
                                    (conflictType === "exact" || conflictType === "partial") &&
                                    "bg-destructive/20 text-destructive",
                                  hasConflict && conflictType === "close" && "bg-warning/20 text-warning",
                                )}
                              >
                                {hasConflict && (conflictType === "exact" || conflictType === "partial") ? (
                                  <XCircle className="h-3 w-3" />
                                ) : hasConflict && conflictType === "close" ? (
                                  <AlertTriangle className="h-3 w-3" />
                                ) : (
                                  <Calendar className="h-3 w-3" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-medium truncate">
                                  {formatShortDateAr(session.date)}
                                  <span className="text-muted-foreground font-normal mr-1">
                                    ({session.time || selectedStudent.sessionTime || "16:00"})
                                    <span className="text-muted-foreground/70 mr-1">
                                      ({formatDurationAr(session.duration || selectedStudent.sessionDuration || 60)})
                                    </span>
                                  </span>
                                </p>
                                {hasConflict && (conflictType === "exact" || conflictType === "partial") && (
                                  <span className="text-[10px] text-destructive">❌ تعارض</span>
                                )}
                                {hasConflict && conflictType === "close" && (
                                  <span className="text-[10px] text-warning">⚠️ قريب جداً</span>
                                )}
                              </div>
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
                                className="h-7 w-7 text-success"
                                onClick={() => handleToggleComplete(session.studentId, session.id)}
                                title="إكمال الجلسة"
                              >
                                <Check className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-warning"
                                onClick={() => handleMarkAsVacation(session.studentId, session.id)}
                                title="تحديد كإجازة"
                              >
                                <Palmtree className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive"
                                onClick={() => openCancelDialog(session.studentId, session.id)}
                                title="إلغاء الجلسة"
                              >
                                <Ban className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                onClick={() => openDeleteConfirmDialog(session.studentId, session.id)}
                                title="حذف نهائي"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>,
                        );

                        if (gapAfter !== null && gapAfter !== undefined) {
                          elements.push(
                            <GapIndicator key={`gap-${session.id}`} gapMinutes={gapAfter} className="my-0.5" />,
                          );
                        }
                      });

                      return elements;
                    })()
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="history" className="mt-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground font-medium">إضافة حصة سابقة</p>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1">
                      <Plus className="h-3 w-3" />
                      إضافة
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
                    <CalendarPicker
                      mode="single"
                      selected={addSessionDate}
                      disabled={(date) => isAfter(date, today)}
                      onSelect={(date) => date && handleDateSelect(date)}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded-lg">
                💡 اختر تاريخًا سابقًا لإضافة حصة، وستُسجل تلقائياً كمكتملة وتظهر هنا في السجل.
              </p>

              <div className="p-3 rounded-lg bg-muted/50 border">
                <p className="text-xs text-muted-foreground mb-2 font-medium">
                  {selectedStudent.name} - إحصائيات الفصل
                </p>
                <div className="grid grid-cols-4 gap-2">
                  <div className="text-center">
                    <p className="text-lg font-bold">{historyStats.total}</p>
                    <p className="text-[10px] text-muted-foreground">الإجمالي</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-success">{historyStats.completed}</p>
                    <p className="text-[10px] text-success/80">مكتملة</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-warning">{historyStats.vacation}</p>
                    <p className="text-[10px] text-warning/80">إجازة</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-destructive">{historyStats.cancelled}</p>
                    <p className="text-[10px] text-destructive/80">ملغاة</p>
                  </div>
                </div>
              </div>
              {historyStats.total > 0 && (
                <div className="p-2 rounded-lg bg-success/10 border border-success/20 text-center">
                  <p className="text-sm font-medium text-success">نسبة الإنجاز: {historyStats.completionRate}%</p>
                </div>
              )}

              <ScrollArea className="h-[180px]">
                <div className="space-y-1.5 pl-2">
                  {historySessions.length === 0 ? (
                    <p className="text-center text-muted-foreground py-6 text-xs">لا توجد حصص سابقة</p>
                  ) : (
                    historySessions.map((session) => {
                      // ✅ Check if this is a past session
                      const todayStr = format(today, "yyyy-MM-dd");
                      const isPastSession = session.date < todayStr;

                      return (
                        <div
                          key={session.id}
                          className={cn(
                            "flex flex-col p-2 rounded text-xs border",
                            session.status === "completed" && "bg-success/5 border-success/20",
                            session.status === "vacation" && "bg-warning/5 border-warning/20",
                            session.status === "cancelled" && "bg-destructive/5 border-destructive/20",
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <div
                                className={cn(
                                  "w-5 h-5 rounded-full flex items-center justify-center shrink-0",
                                  session.status === "completed" && "bg-success/20 text-success",
                                  session.status === "vacation" && "bg-warning/20 text-warning",
                                  session.status === "cancelled" && "bg-destructive/20 text-destructive",
                                )}
                              >
                                {session.status === "completed" ? (
                                  <Check className="h-3 w-3" />
                                ) : session.status === "vacation" ? (
                                  <Palmtree className="h-3 w-3" />
                                ) : (
                                  <X className="h-3 w-3" />
                                )}
                              </div>
                              <p className="font-medium truncate">
                                {formatShortDateAr(session.date)}
                                <span className="text-muted-foreground font-normal mr-1">
                                  ({session.time || selectedStudent.sessionTime || "16:00"})
                                  <span className="text-muted-foreground/70 mr-1">
                                    ({formatDurationAr(session.duration || selectedStudent.sessionDuration || 60)})
                                  </span>
                                </span>
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
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

                              {/* ✅ PAST SESSIONS: Only DELETE button (no تراجع or استعادة) */}
                              {isPastSession ? (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                  onClick={() => openDeleteConfirmDialog(session.studentId, session.id)}
                                  title="حذف نهائي"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              ) : (
                                /* ✅ FUTURE SESSIONS: Show تراجع/استعادة + DELETE */
                                <>
                                  {session.status === "completed" ? (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 px-2 text-warning"
                                      onClick={() => handleToggleComplete(session.studentId, session.id)}
                                      title="التراجع عن الإكمال"
                                    >
                                      <X className="h-3.5 w-3.5 ml-1" />
                                      تراجع
                                    </Button>
                                  ) : (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 px-2 text-success"
                                      onClick={() => handleRestoreWithCheck(session.studentId, session.id)}
                                      title="استعادة الجلسة"
                                    >
                                      <RotateCcw className="h-3.5 w-3.5 ml-1" />
                                      استعادة
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                    onClick={() => openDeleteConfirmDialog(session.studentId, session.id)}
                                    title="حذف نهائي"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </>
                              )}

                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px]",
                                  session.status === "completed" && "border-success/30 text-success",
                                  session.status === "vacation" && "border-warning/30 text-warning",
                                  session.status === "cancelled" && "border-destructive/30 text-destructive",
                                )}
                              >
                                {getStatusLabel(session.status)}
                              </Badge>
                            </div>
                          </div>

                          {/* Show session details for completed sessions */}
                          {session.status === "completed" && (session.topic || session.notes || session.homework) && (
                            <div className="mt-2 mr-7 text-[10px] text-muted-foreground space-y-0.5 bg-muted/30 rounded p-1.5">
                              {session.topic && (
                                <p className="flex items-center gap-1">
                                  <BookOpen className="h-2.5 w-2.5" />
                                  {session.topic}
                                </p>
                              )}
                              {session.homework && (
                                <p className="flex items-center gap-1">
                                  <ClipboardCheck className="h-2.5 w-2.5" />
                                  {session.homework}
                                  {session.homeworkStatus === "completed" && " ✓"}
                                  {session.homeworkStatus === "incomplete" && " ❌"}
                                </p>
                              )}
                            </div>
                          )}
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
                  onRestore={handleRestoreWithCheck}
                  onClearMonth={onClearMonthCancellations}
                />
              )}
            </TabsContent>
          </Tabs>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">اختر طالب من القائمة أعلاه لعرض حصصه وسجله</p>
          </div>
        )}
      </CardContent>

      {/* Restore Conflict Dialog */}
      {restoreConflictDialog && (
        <RestoreConflictDialog
          open={restoreConflictDialog.open}
          onOpenChange={(open) => !open && setRestoreConflictDialog(null)}
          conflictResult={restoreConflictDialog.conflictResult}
          sessionInfo={restoreConflictDialog.sessionInfo}
          onConfirm={handleConfirmRestore}
        />
      )}

      {/* Vacation Confirmation Dialog */}
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
              <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded-lg mt-2">
                💡 لن يتم احتساب هذه الجلسة في الدفعات أو نسبة الإنجاز
              </p>
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

      {/* Cancel Session Dialog */}
      {cancelDialog && (
        <CancelSessionDialog
          open={cancelDialog.open}
          onOpenChange={(open) => !open && setCancelDialog(null)}
          student={cancelDialog.student}
          session={cancelDialog.session}
          currentCount={getCancellationCount?.(cancelDialog.student.id) ?? 0}
          onConfirm={handleConfirmCancel}
          onMarkAsVacation={handleCancelAsVacation}
        />
      )}

      {/* Delete Confirmation Dialog */}
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
                  <p className="text-xs text-muted-foreground mt-1">الحالة: {deleteConfirmDialog.sessionInfo.status}</p>
                </div>
              )}
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-2 mt-2">
                <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                  ⚠️ هذا الإجراء لا يمكن التراجع عنه
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  بعد الحذف، يمكنك إضافة جلسة جديدة في نفس التاريخ دون تعارض
                </p>
              </div>
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

      {/* Time Picker Dialog for Adding Sessions */}
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
                <p className="text-xs text-muted-foreground">
                  💡 الوقت الافتراضي: {selectedStudent?.sessionTime || "16:00"}
                </p>
              </div>

              {/* Show existing sessions on this date */}
              {addSessionDate &&
                selectedStudent &&
                (() => {
                  const dateStr = format(addSessionDate, "yyyy-MM-dd");
                  const existingSessions = selectedStudent.sessions.filter((s) => s.date === dateStr);
                  if (existingSessions.length > 0) {
                    return (
                      <div className="bg-warning/10 border border-warning/30 rounded-lg p-2">
                        <p className="text-xs font-medium text-warning mb-1">⚠️ حصص موجودة في هذا اليوم:</p>
                        <div className="space-y-1">
                          {existingSessions.map((s) => (
                            <p key={s.id} className="text-xs text-muted-foreground">
                              • {formatTimeAr(s.time || selectedStudent.sessionTime || "16:00")} (
                              {getStatusLabel(s.status)})
                            </p>
                          ))}
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}
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

// Cancellation History Inline Component
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
