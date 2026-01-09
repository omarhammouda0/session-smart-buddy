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
  onAddSession?: (studentId: string, date: string) => void;
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

  // Conflict detection
  const { checkRestoreConflict, getSessionsWithGaps } = useConflictDetection(students);
  const [restoreConflictDialog, setRestoreConflictDialog] = useState<{
    open: boolean;
    studentId: string;
    sessionId: string;
    conflictResult: ConflictResult;
    sessionInfo: { studentName: string; date: string; time: string };
  } | null>(null);

  // Vacation confirmation dialog
  const [vacationDialog, setVacationDialog] = useState<{
    open: boolean;
    studentId: string;
    sessionId: string;
    sessionInfo: { studentName: string; date: string; time: string };
  } | null>(null);

  // Cancel session dialog
  const [cancelDialog, setCancelDialog] = useState<{
    open: boolean;
    student: Student;
    session: Session & { studentId: string };
  } | null>(null);

  const selectedStudent = students.find((s) => s.id === selectedStudentId);

  // Handle restore with conflict check
  const handleRestoreWithCheck = (studentId: string, sessionId: string) => {
    const student = students.find((s) => s.id === studentId);
    const session = student?.sessions.find((s) => s.id === sessionId);
    if (!student || !session) return;

    const conflictResult = checkRestoreConflict(studentId, sessionId);

    if (conflictResult.severity === "none") {
      // No conflicts, restore directly
      onRestoreSession?.(studentId, sessionId);
      toast({
        title: "تم الاستعادة",
        description: `تم استعادة جلسة ${student.name} - ${formatShortDateAr(session.date)}`,
      });
      return;
    }

    // Show conflict dialog
    setRestoreConflictDialog({
      open: true,
      studentId,
      sessionId,
      conflictResult,
      sessionInfo: {
        studentName: student.name,
        date: formatShortDateAr(session.date),
        time: session.time || student.sessionTime || "16:00",
      },
    });
  };

  const handleConfirmRestore = () => {
    if (restoreConflictDialog) {
      const student = students.find((s) => s.id === restoreConflictDialog.studentId);
      onRestoreSession?.(restoreConflictDialog.studentId, restoreConflictDialog.sessionId);
      toast({ title: "تم الاستعادة", description: `تم استعادة الجلسة بنجاح` });
      setRestoreConflictDialog(null);
    }
  };

  // Handle vacation with confirmation
  const handleMarkAsVacation = (studentId: string, sessionId: string) => {
    const student = students.find((s) => s.id === studentId);
    const session = student?.sessions.find((s) => s.id === sessionId);
    if (!student || !session) return;

    // Show confirmation dialog
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
      toast({ title: "تم التحديد", description: `تم تحديد الجلسة كإجازة` });
      setVacationDialog(null);
    }
  };

  // Wrapper functions with toast notifications
  const handleToggleComplete = (studentId: string, sessionId: string) => {
    const student = students.find((s) => s.id === studentId);
    const session = student?.sessions.find((s) => s.id === sessionId);
    if (!student || !session) return;

    const isCompleted = session.status === "completed";
    onToggleComplete?.(studentId, sessionId);
    toast({
      title: isCompleted ? "تم التراجع" : "تم الإكمال",
      description: isCompleted ? `تم إلغاء إكمال جلسة ${student.name}` : `تم تسجيل إكمال جلسة ${student.name}`,
    });
  };

  // Open cancel dialog instead of direct cancel
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
      onCancelSession?.(cancelDialog.session.studentId, cancelDialog.session.id, reason);
      toast({ title: "تم الإلغاء", description: `تم إلغاء الجلسة` });
      setCancelDialog(null);
    }
  };

  const handleCancelAsVacation = () => {
    if (cancelDialog) {
      onMarkAsVacation?.(cancelDialog.session.studentId, cancelDialog.session.id);
      toast({ title: "تم التحديد", description: `تم تحديد الجلسة كإجازة` });
      setCancelDialog(null);
    }
  };

  const handleDeleteSession = (studentId: string, sessionId: string) => {
    const student = students.find((s) => s.id === studentId);
    if (!student) return;

    onDeleteSession?.(studentId, sessionId);
    toast({ title: "تم الحذف", description: `تم حذف الجلسة نهائياً`, variant: "destructive" });
  };

  const getScheduledSessions = () => {
    if (!selectedStudent) return [];
    const semesterStart = parseISO(selectedStudent.semesterStart);
    return selectedStudent.sessions
      .filter((session) => {
        const sessionDate = parseISO(session.date);
        return !isBefore(sessionDate, semesterStart) && session.status !== "completed";
      })
      .sort((a, b) => a.date.localeCompare(b.date)) // Already ascending
      .map((session) => ({ ...session, studentName: selectedStudent.name, studentId: selectedStudent.id }));
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
    // Completion rate excludes vacation sessions
    const rateTotal = completed + cancelled;
    return {
      completed,
      cancelled,
      vacation,
      total,
      completionRate: rateTotal > 0 ? Math.round((completed / rateTotal) * 100) : 0,
    };
  };

  const getHistorySessions = () => {
    if (!selectedStudent) return [];
    return selectedStudent.sessions
      .filter((s) => s.status === "completed" || s.status === "cancelled" || s.status === "vacation")
      .sort((a, b) => a.date.localeCompare(b.date)) // Changed to ascending
      .map((s) => ({ ...s, studentName: selectedStudent.name, studentId: selectedStudent.id }));
  };

  const scheduledSessions = getScheduledSessions();
  const historyStats = getHistoryStats();
  const historySessions = getHistorySessions();

  const handleAddSession = (studentId: string, date: Date) => {
    onAddSession?.(studentId, format(date, "yyyy-MM-dd"));
    setAddSessionDate(undefined);
    toast({
      title: "تم الإضافة",
      description: `تم إضافة جلسة بتاريخ ${formatShortDateAr(format(date, "yyyy-MM-dd"))}`,
    });
  };

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
                الحصص
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
                  حصص {selectedStudent.name}
                  <Badge variant="secondary" className="mr-2 text-[10px]">
                    {scheduledSessions.length}
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
                      onSelect={(date) => date && handleAddSession(selectedStudent.id, date)}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded-lg">
                💡 اختر تاريخ من التقويم لإضافة حصة. الحصص السابقة تُسجل تلقائياً كمكتملة.
              </p>
              <ScrollArea className="h-[250px]">
                <div className="space-y-1 pl-2">
                  {scheduledSessions.length === 0 ? (
                    <p className="text-center text-muted-foreground py-6 text-xs">لا توجد حصص مجدولة</p>
                  ) : (
                    scheduledSessions.map((session) => {
                      // Get sessions with gaps for the current date
                      const sessionsWithGaps = getSessionsWithGaps(session.date);
                      const sessionGapInfo = sessionsWithGaps.find((s) => s.session.id === session.id);

                      // Check if this session has conflicts
                      const hasConflict = sessionGapInfo?.hasConflict || false;
                      const conflictType = sessionGapInfo?.conflictType;
                      const gapAfter = sessionGapInfo?.gapAfter;
                      const gapSeverity = sessionGapInfo?.gapSeverity;

                      return (
                        <div
                          key={session.id}
                          className={cn(
                            "relative flex items-center justify-between p-2.5 rounded-lg text-xs border transition-all mb-1",
                            session.status === "cancelled" && "bg-destructive/5 border-destructive/20",
                            session.status === "vacation" && "bg-warning/10 border-warning/30",
                            session.status === "scheduled" && !hasConflict && "bg-card",
                            session.status === "scheduled" &&
                              hasConflict &&
                              conflictType === "exact" &&
                              "bg-destructive/5 border-destructive/30",
                            session.status === "scheduled" &&
                              hasConflict &&
                              conflictType === "partial" &&
                              "bg-destructive/5 border-destructive/30",
                            session.status === "scheduled" &&
                              hasConflict &&
                              conflictType === "close" &&
                              "bg-warning/5 border-warning/30",
                          )}
                        >
                          {/* Conflict badge */}
                          {session.status === "scheduled" && hasConflict && (
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
                                session.status === "cancelled" && "bg-destructive/20 text-destructive",
                                session.status === "vacation" && "bg-warning/20 text-warning",
                                session.status === "scheduled" && !hasConflict && "bg-primary/20 text-primary",
                                session.status === "scheduled" &&
                                  hasConflict &&
                                  (conflictType === "exact" || conflictType === "partial") &&
                                  "bg-destructive/20 text-destructive",
                                session.status === "scheduled" &&
                                  hasConflict &&
                                  conflictType === "close" &&
                                  "bg-warning/20 text-warning",
                              )}
                            >
                              {session.status === "cancelled" ? (
                                <Ban className="h-3 w-3" />
                              ) : session.status === "vacation" ? (
                                <Palmtree className="h-3 w-3" />
                              ) : hasConflict && (conflictType === "exact" || conflictType === "partial") ? (
                                <XCircle className="h-3 w-3" />
                              ) : hasConflict && conflictType === "close" ? (
                                <AlertTriangle className="h-3 w-3" />
                              ) : (
                                <Calendar className="h-3 w-3" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p
                                className={cn(
                                  "font-medium truncate",
                                  session.status === "cancelled" && "line-through text-muted-foreground",
                                  session.status === "vacation" && "text-warning",
                                )}
                              >
                                {formatShortDateAr(session.date)}
                                <span className="text-muted-foreground font-normal mr-1">
                                  ({session.time || selectedStudent.sessionTime || "16:00"})
                                  <span className="text-muted-foreground/70 mr-1">
                                    ({formatDurationAr(session.duration || selectedStudent.sessionDuration || 60)})
                                  </span>
                                </span>
                              </p>
                              {session.status === "cancelled" && (
                                <span className="text-[10px] text-destructive">ملغاة</span>
                              )}
                              {session.status === "vacation" && <span className="text-[10px] text-warning">إجازة</span>}
                              {session.status === "scheduled" &&
                                hasConflict &&
                                (conflictType === "exact" || conflictType === "partial") && (
                                  <span className="text-[10px] text-destructive">❌ تعارض</span>
                                )}
                              {session.status === "scheduled" && hasConflict && conflictType === "close" && (
                                <span className="text-[10px] text-warning">⚠️ قريب جداً</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {/* Notes button */}
                            <SessionNotesDialog
                              session={session}
                              studentId={session.studentId}
                              studentName={session.studentName}
                            />
                            {/* Homework button */}
                            <SessionHomeworkDialog
                              session={session}
                              studentId={session.studentId}
                              studentName={session.studentName}
                            />
                            {session.status === "cancelled" ? (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-success"
                                  onClick={() => handleRestoreWithCheck(session.studentId, session.id)}
                                >
                                  <RotateCcw className="h-3.5 w-3.5 ml-1" />
                                  استعادة
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive"
                                  onClick={() => handleDeleteSession(session.studentId, session.id)}
                                  title="حذف نهائي"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            ) : session.status === "vacation" ? (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-primary"
                                  onClick={() => handleRestoreWithCheck(session.studentId, session.id)}
                                >
                                  <RotateCcw className="h-3.5 w-3.5 ml-1" />
                                  استعادة
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive"
                                  onClick={() => openCancelDialog(session.studentId, session.id)}
                                  title="إلغاء"
                                >
                                  <Ban className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-success"
                                  onClick={() => handleToggleComplete(session.studentId, session.id)}
                                  title="إكمال"
                                >
                                  <Check className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-warning"
                                  onClick={() => handleMarkAsVacation(session.studentId, session.id)}
                                  title="إجازة"
                                >
                                  <Palmtree className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive"
                                  onClick={() => openCancelDialog(session.studentId, session.id)}
                                  title="إلغاء"
                                >
                                  <Ban className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                  onClick={() => handleDeleteSession(session.studentId, session.id)}
                                  title="حذف نهائي"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            )}
                          </div>

                          {/* Show gap indicator after this session if there's a gap */}
                          {session.status === "scheduled" && gapAfter !== null && gapAfter !== undefined && (
                            <div className="absolute -bottom-2 left-0 right-0">
                              <GapIndicator gapMinutes={gapAfter} className="my-0.5" />
                            </div>
                          )}
                        </div>
                      );
                    })
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
                      onSelect={(date) => date && handleAddSession(selectedStudent.id, date)}
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
                    historySessions.map((session) => (
                      <div
                        key={session.id}
                        className={cn(
                          "flex flex-col p-2 rounded text-xs border mb-1",
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
                            {/* Notes button */}
                            <SessionNotesDialog
                              session={session}
                              studentId={session.studentId}
                              studentName={session.studentName}
                            />
                            {/* Homework button */}
                            <SessionHomeworkDialog
                              session={session}
                              studentId={session.studentId}
                              studentName={session.studentName}
                            />
                            {session.status === "completed" ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-warning"
                                onClick={() => handleToggleComplete(session.studentId, session.id)}
                              >
                                <X className="h-3.5 w-3.5 ml-1" />
                                تراجع
                              </Button>
                            ) : session.status === "vacation" ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-primary"
                                onClick={() => handleRestoreWithCheck(session.studentId, session.id)}
                              >
                                <RotateCcw className="h-3.5 w-3.5 ml-1" />
                                استعادة
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-success"
                                onClick={() => handleRestoreWithCheck(session.studentId, session.id)}
                              >
                                <RotateCcw className="h-3.5 w-3.5 ml-1" />
                                استعادة
                              </Button>
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
                              {session.status === "completed"
                                ? "مكتملة"
                                : session.status === "vacation"
                                  ? "إجازة"
                                  : "ملغاة"}
                            </Badge>
                          </div>
                        </div>
                        {/* Show notes preview for completed sessions */}
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
                    ))
                  )}
                </div>
              </ScrollArea>

              {/* Cancellation History Section */}
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
    </Card>
  );
};

// Cancellation History Inline Component for Management Tab
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

  // Group cancellations by month
  const groupedByMonth = useMemo(() => {
    const groups: Record<string, CancellationRecord[]> = {};
    cancellations.forEach((c) => {
      if (!groups[c.month]) {
        groups[c.month] = [];
      }
      groups[c.month].push(c);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)); // Changed to ascending
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
                  .sort((a, b) => a.sessionDate.localeCompare(b.sessionDate)) // Changed to ascending
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

      {/* Confirmation Dialog */}
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
