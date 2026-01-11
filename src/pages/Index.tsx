import { useState, useMemo } from "react";
import {
  GraduationCap,
  BookOpen,
  CreditCard,
  Users,
  Trash2,
  Clock,
  Monitor,
  MapPin,
  History,
  CalendarDays,
  Sparkles,
  CheckCircle2,
  XCircle,
  DollarSign,
  User,
  Timer,
  ChevronDown,
  ChevronUp,
  Check,
} from "lucide-react";
import { format, parseISO, differenceInMinutes } from "date-fns";
import { ar } from "date-fns/locale";
import { useStudents } from "@/hooks/useStudents";
import { useAutoReminders } from "@/hooks/useAutoReminders";
import { useCancellationTracking } from "@/hooks/useCancellationTracking";
import { useConflictDetection, ConflictResult } from "@/hooks/useConflictDetection";
import { AddStudentDialog } from "@/components/AddStudentDialog";
import { SemesterSettings } from "@/components/SemesterSettings";
import { EditStudentDialog } from "@/components/EditStudentDialog";
import { PaymentsDashboard } from "@/components/PaymentsDashboard";
import { QuickPaymentDialog } from "@/components/QuickPaymentDialog";
import { EmptyState } from "@/components/EmptyState";
import { StudentSearchCombobox } from "@/components/StudentSearchCombobox";
import { StatsBar } from "@/components/StatsBar";
import { EndOfMonthReminder } from "@/components/EndOfMonthReminder";
import { SessionHistoryBar } from "@/components/SessionHistoryBar";
import { BulkEditSessionsDialog } from "@/components/BulkEditSessionsDialog";
import { AddVacationDialog } from "@/components/AddVacationDialog";
import { RestoreConflictDialog } from "@/components/RestoreConflictDialog";
import { ReminderSettingsDialog } from "@/components/ReminderSettingsDialog";
import { ReminderHistoryDialog } from "@/components/ReminderHistoryDialog";
import { MonthlyReportDialog } from "@/components/MonthlyReportDialog";
import { StudentNotesHistory } from "@/components/StudentNotesHistory";
import { CalendarView } from "@/components/CalendarView";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { DAY_NAMES_SHORT_AR, formatShortDateAr } from "@/lib/arabicConstants";
import { cn } from "@/lib/utils";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Student, PaymentMethod, Session } from "@/types/student";

const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

// Helper function to open WhatsApp
const openWhatsApp = (phone: string) => {
  if (!phone) return;
  let cleaned = phone.replace(/[^\d+]/g, "");
  if (cleaned.startsWith("0")) {
    cleaned = "49" + cleaned.substring(1);
  }
  cleaned = cleaned.replace("+", "");
  window.open(`https://wa.me/${cleaned}`, "_blank");
};

interface SessionWithStudent {
  session: Session;
  student: Student;
}

const Index = () => {
  const now = new Date();
  const [activeTab, setActiveTab] = useState("sessions");
  const [allStudentsSearch, setAllStudentsSearch] = useState("");
  const [showAllSessions, setShowAllSessions] = useState(false);
  const [addConflictDialog, setAddConflictDialog] = useState<{
    open: boolean;
    studentId: string;
    date: string;
    conflictResult: ConflictResult;
    sessionInfo: { studentName: string; date: string; time: string };
  } | null>(null);

  const [quickPaymentDialog, setQuickPaymentDialog] = useState<{
    open: boolean;
    student: Student | null;
    sessionId: string;
    sessionDate: string;
  }>({ open: false, student: null, sessionId: "", sessionDate: "" });

  const {
    students,
    payments,
    settings,
    isLoaded,
    updateSettings,
    addStudent,
    removeStudent,
    updateStudentName,
    updateStudentTime,
    updateStudentPhone,
    updateStudentParentPhone,
    updateStudentSessionType,
    updateStudentSchedule,
    updateStudentDuration,
    updateStudentCustomSettings,
    updateStudentCancellationPolicy,
    addExtraSession,
    removeSession,
    deleteSession,
    restoreSession,
    rescheduleSession,
    updateSessionDateTime,
    toggleSessionComplete,
    togglePaymentStatus,
    recordPayment,
    resetMonthlyPayment,
    bulkUpdateSessionTime,
    markSessionAsVacation,
    bulkMarkAsVacation,
    updateSessionDetails,
  } = useStudents();

  const {
    getCancellationCount,
    getAllStudentCancellations,
    recordCancellation,
    removeCancellation,
    clearMonthCancellations,
  } = useCancellationTracking(students);

  const { checkConflict } = useConflictDetection(students);

  // Auto reminders hook - sends WhatsApp 1 hour before session & 3 days before month end for payments
  useAutoReminders({ students, payments, settings });

  // Session Handlers
  const handleAddSession = (studentId: string, date: string, customTime?: string) => {
    const student = students.find((s) => s.id === studentId);
    if (!student) return;
    const sessionTime = customTime || student.sessionTime;
    const conflictResult = checkConflict({ date, startTime: sessionTime }, undefined, studentId);
    if (conflictResult.severity === "error" || conflictResult.severity === "warning") {
      setAddConflictDialog({
        open: true,
        studentId,
        date,
        conflictResult,
        sessionInfo: { studentName: student.name, date: formatShortDateAr(date), time: sessionTime },
      });
      return;
    }
    addExtraSession(studentId, date, sessionTime);
    toast({
      title: "تمت إضافة الحصة",
      description: `حصة جديدة بتاريخ ${format(parseISO(date), "dd/MM/yyyy")} الساعة ${sessionTime} لـ ${student.name}`,
    });
  };

  const handleForceAddSession = () => {
    if (!addConflictDialog) return;
    const { studentId, date } = addConflictDialog;
    const student = students.find((s) => s.id === studentId);
    addExtraSession(studentId, date);
    toast({
      title: "تمت إضافة الحصة",
      description: `حصة جديدة بتاريخ ${format(parseISO(date), "dd/MM/yyyy")}${student ? ` لـ ${student.name}` : ""}`,
    });
    setAddConflictDialog(null);
  };

  const handleCancelSession = async (studentId: string, sessionId: string, reason?: string) => {
    const student = students.find((s) => s.id === studentId);
    const session = student?.sessions.find((s) => s.id === sessionId);
    if (session) {
      const result = await recordCancellation(studentId, session.date, session.time, reason);
      removeSession(studentId, sessionId);
      if (result.success) {
        if (result.autoNotificationSent) {
          toast({
            title: "تم إلغاء الحصة وإرسال تنبيه",
            description: `تم إرسال رسالة WhatsApp تلقائياً لولي الأمر (${result.newCount}/${result.limit} إلغاءات)`,
          });
        } else if (result.limitReached || result.limitExceeded) {
          toast({
            title: "⚠️ تم الوصول للحد الأقصى",
            description: `${student?.name} وصل لـ ${result.newCount}/${result.limit} إلغاء هذا الشهر`,
            variant: "destructive",
          });
        } else {
          toast({
            title: "تم إلغاء الحصة",
            description: reason
              ? `السبب: ${reason}`
              : `إلغاء ${result.newCount}${result.limit ? `/${result.limit}` : ""} هذا الشهر`,
          });
        }
      }
    } else {
      toast({ title: "تم إلغاء الحصة", description: reason ? `السبب: ${reason}` : "تم إلغاء الحصة بنجاح" });
    }
  };

  const handleDeleteSession = (studentId: string, sessionId: string) => {
    deleteSession(studentId, sessionId);
    toast({ title: "تم حذف الحصة", description: "تم حذف الحصة نهائياً" });
  };

  const handleRestoreSession = async (studentId: string, sessionId: string) => {
    const student = students.find((s) => s.id === studentId);
    const session = student?.sessions.find((s) => s.id === sessionId);
    if (session?.status === "cancelled") await removeCancellation(studentId, session.date);
    restoreSession(studentId, sessionId);
    toast({ title: "تم استعادة الحصة", description: "تم استعادة الحصة وتحديث عداد الإلغاءات" });
  };

  const handleToggleComplete = (studentId: string, sessionId: string) => {
    const student = students.find((s) => s.id === studentId);
    const session = student?.sessions.find((s) => s.id === sessionId);
    const wasCompleted = session?.status === "completed";
    toggleSessionComplete(studentId, sessionId);
    toast({
      title: wasCompleted ? "تم إلغاء الإكمال" : "تم إكمال الحصة",
      description: wasCompleted ? "تم إرجاع الحصة إلى مجدولة" : "أحسنت! تم تسجيل الحصة كمكتملة",
    });
  };

  const handleMarkAsVacation = (studentId: string, sessionId: string) => {
    markSessionAsVacation(studentId, sessionId);
    toast({ title: "تم تحديد الحصة كإجازة", description: "لن يتم احتساب هذه الحصة في المدفوعات" });
  };

  // Payment Handlers
  const handleQuickPayment = (studentId: string, sessionId: string, sessionDate: string) => {
    const student = students.find((s) => s.id === studentId);
    if (!student) return;
    setQuickPaymentDialog({ open: true, student, sessionId, sessionDate });
  };

  const handleQuickPaymentConfirm = (amount: number, method: PaymentMethod) => {
    if (!quickPaymentDialog.student || !quickPaymentDialog.sessionId) return;
    const sessionDate = new Date(quickPaymentDialog.sessionDate);
    recordPayment(quickPaymentDialog.student.id, {
      month: sessionDate.getMonth(),
      year: sessionDate.getFullYear(),
      amount,
      method,
      paidAt: new Date().toISOString(),
      notes: `session:${quickPaymentDialog.sessionId}|date:${quickPaymentDialog.sessionDate}`,
    });
    const methodLabel = method === "cash" ? "كاش" : method === "bank" ? "تحويل بنكي" : "محفظة إلكترونية";
    toast({
      title: "✅ تم تسجيل الدفعة",
      description: `${quickPaymentDialog.student.name}: ${amount.toLocaleString()} جنيه (${methodLabel})`,
    });
    setQuickPaymentDialog({ open: false, student: null, sessionId: "", sessionDate: "" });
  };

  const handleRecordPayment = (
    studentId: string,
    paymentData: { month: number; year: number; amount: number; method: PaymentMethod; paidAt: string; notes?: string },
  ) => {
    const student = students.find((s) => s.id === studentId);
    if (!student) return;
    recordPayment(studentId, paymentData);
    const methodLabel =
      paymentData.method === "cash" ? "كاش" : paymentData.method === "bank" ? "تحويل بنكي" : "محفظة إلكترونية";
    toast({
      title: "✅ تم تسجيل الدفعة",
      description: `${student.name}: ${paymentData.amount.toLocaleString()} جنيه (${methodLabel})`,
    });
  };

  // Computed Values
  const selectedMonth = now.getMonth();
  const selectedYear = now.getFullYear();
  const todayStr = format(now, "yyyy-MM-dd");
  const currentTimeStr = format(now, "HH:mm");

  const allTodaySessions = useMemo((): SessionWithStudent[] => {
    const sessions: SessionWithStudent[] = [];
    students.forEach((student) => {
      student.sessions
        .filter((s) => s.date === todayStr)
        .forEach((session) => {
          sessions.push({ session, student });
        });
    });
    return sessions.sort((a, b) => {
      const timeA = a.session.time || a.student.sessionTime || "00:00";
      const timeB = b.session.time || b.student.sessionTime || "00:00";
      return timeA.localeCompare(timeB);
    });
  }, [students, todayStr]);

  const todayStats = useMemo(() => {
    const total = allTodaySessions.length;
    const completed = allTodaySessions.filter((s) => s.session.status === "completed").length;
    const scheduled = allTodaySessions.filter((s) => s.session.status === "scheduled").length;
    const cancelled = allTodaySessions.filter((s) => s.session.status === "cancelled").length;
    const vacation = allTodaySessions.filter((s) => s.session.status === "vacation").length;
    const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, scheduled, cancelled, vacation, progressPercent };
  }, [allTodaySessions]);

  const nextSession = useMemo((): SessionWithStudent | null => {
    return (
      allTodaySessions.find((item) => {
        if (item.session.status !== "scheduled") return false;
        const sessionTime = item.session.time || item.student.sessionTime || "00:00";
        return sessionTime >= currentTimeStr;
      }) || null
    );
  }, [allTodaySessions, currentTimeStr]);

  const timeUntilNext = useMemo(() => {
    if (!nextSession) return null;
    const sessionTime = nextSession.session.time || nextSession.student.sessionTime || "16:00";
    const [hours, minutes] = sessionTime.split(":").map(Number);
    const sessionDateTime = new Date(now);
    sessionDateTime.setHours(hours, minutes, 0, 0);
    const diffMinutes = differenceInMinutes(sessionDateTime, now);
    if (diffMinutes <= 0) return "الآن";
    if (diffMinutes < 60) return `بعد ${diffMinutes} دقيقة`;
    const diffHours = Math.floor(diffMinutes / 60);
    const remainingMinutes = diffMinutes % 60;
    if (remainingMinutes === 0) return `بعد ${diffHours} ساعة`;
    return `بعد ${diffHours} ساعة و ${remainingMinutes} دقيقة`;
  }, [nextSession, now]);

  const allStudentsSortedByTime = useMemo(() => {
    const searchLower = allStudentsSearch.trim().toLowerCase();
    return [...students]
      .filter((s) => searchLower === "" || s.name.toLowerCase().includes(searchLower))
      .sort((a, b) => (a.sessionTime || "").localeCompare(b.sessionTime || ""));
  }, [students, allStudentsSearch]);

  const visibleSessions = showAllSessions ? allTodaySessions : allTodaySessions.slice(0, 5);
  const hasMoreSessions = allTodaySessions.length > 5;

  const getGreeting = () => {
    const hour = now.getHours();
    if (hour < 12) return "صباح الخير";
    if (hour < 18) return "مساءً سعيداً";
    return "مساء الخير";
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">جاري التحميل...</div>
      </div>
    );
  }

  return (
    <div
      dir="rtl"
      className="min-h-screen safe-bottom relative bg-gradient-to-br from-background via-background to-primary/5"
    >
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-primary/3 rounded-full blur-3xl" />
      </div>

      <header className="bg-card/95 backdrop-blur-xl border-b border-border/50 sticky top-0 z-10 safe-top shadow-sm">
        <div className="px-3 py-3 sm:px-4 sm:py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 shadow-lg flex items-center justify-center shrink-0">
                <GraduationCap className="h-5 w-5 text-primary-foreground" />
              </div>
              <div className="min-w-0">
                <h1 className="font-heading font-bold text-base sm:text-lg leading-tight truncate">متابعة الطلاب</h1>
                <p className="text-[10px] sm:text-xs text-muted-foreground hidden xs:block">
                  {format(now, "EEEE، d MMMM", { locale: ar })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Sheet>
                <SheetTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 w-9 sm:w-auto sm:px-3 gap-1.5 rounded-lg border hover:border-primary hover:bg-primary/5 transition-all"
                  >
                    <Users className="h-4 w-4" />
                    <span className="hidden sm:inline text-sm">الطلاب</span>
                    <Badge variant="secondary" className="hidden sm:flex h-5 px-1.5 text-xs">
                      {students.length}
                    </Badge>
                  </Button>
                </SheetTrigger>
                <SheetContent className="w-full sm:max-w-md" side="left">
                  <SheetHeader>
                    <SheetTitle className="font-heading text-right">جميع الطلاب ({students.length})</SheetTitle>
                  </SheetHeader>
                  <div className="mt-4">
                    <StudentSearchCombobox
                      students={students}
                      value={allStudentsSearch}
                      onChange={setAllStudentsSearch}
                      placeholder="ابحث عن طالب..."
                    />
                  </div>
                  <div className="mt-3 space-y-2 max-h-[calc(100vh-180px)] overflow-y-auto" dir="rtl">
                    {allStudentsSortedByTime.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">
                        {allStudentsSearch.trim() ? "لا يوجد نتائج" : "لا يوجد طلاب حتى الآن"}
                      </p>
                    ) : (
                      allStudentsSortedByTime.map((student) => (
                        <div
                          key={student.id}
                          className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-medium truncate">{student.name}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {student.sessionTime}
                              </span>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                {(student.sessionType || "onsite") === "online" ? (
                                  <>
                                    <Monitor className="h-3 w-3" /> أونلاين
                                  </>
                                ) : (
                                  <>
                                    <MapPin className="h-3 w-3" /> حضوري
                                  </>
                                )}
                              </span>
                              <span>•</span>
                              <span>{student.scheduleDays.map((d) => DAY_NAMES_SHORT_AR[d.dayOfWeek]).join("، ")}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <EditStudentDialog
                              student={student}
                              students={students}
                              appSettings={settings}
                              currentCancellationCount={getCancellationCount(student.id)}
                              allCancellations={getAllStudentCancellations(student.id)}
                              onRestoreSession={handleRestoreSession}
                              onClearMonthCancellations={clearMonthCancellations}
                              onUpdateName={(name) => updateStudentName(student.id, name)}
                              onUpdateTime={(time) => updateStudentTime(student.id, time)}
                              onUpdatePhone={(phone) => updateStudentPhone(student.id, phone)}
                              onUpdateParentPhone={(parentPhone) => updateStudentParentPhone(student.id, parentPhone)}
                              onUpdateSessionType={(type) => updateStudentSessionType(student.id, type)}
                              onUpdateSchedule={(days, start, end) =>
                                updateStudentSchedule(student.id, days, start, end)
                              }
                              onUpdateDuration={(duration) => updateStudentDuration(student.id, duration)}
                              onUpdateCustomSettings={(settings) => updateStudentCustomSettings(student.id, settings)}
                              onUpdateCancellationPolicy={(policy) =>
                                updateStudentCancellationPolicy(student.id, policy)
                              }
                            />
                            <StudentNotesHistory studentId={student.id} studentName={student.name} />

                            {student.phone && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-500/10 shrink-0"
                                onClick={() => openWhatsApp(student.phone!)}
                                title="فتح واتساب"
                              >
                                <WhatsAppIcon className="h-4 w-4" />
                              </Button>
                            )}

                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent dir="rtl">
                                <AlertDialogHeader>
                                  <AlertDialogTitle>حذف الطالب</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    هل أنت متأكد من حذف {student.name}؟ سيتم حذف جميع سجلات الحصص والمدفوعات.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter className="flex-row-reverse gap-2">
                                  <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => removeStudent(student.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    حذف
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </SheetContent>
              </Sheet>
              <AddVacationDialog students={students} onBulkMarkAsVacation={bulkMarkAsVacation} />
              <BulkEditSessionsDialog
                students={students}
                onBulkUpdateTime={bulkUpdateSessionTime}
                onUpdateSessionDate={updateSessionDateTime}
                onBulkMarkAsVacation={bulkMarkAsVacation}
              />
              <MonthlyReportDialog students={students} payments={payments} settings={settings} />
              <ReminderHistoryDialog />
              <ReminderSettingsDialog />
              <SemesterSettings settings={settings} onUpdate={updateSettings} />
              <AddStudentDialog
                onAdd={addStudent}
                defaultStart={settings.defaultSemesterStart}
                defaultEnd={settings.defaultSemesterEnd}
                students={students}
                defaultDuration={settings.defaultSessionDuration}
              />
            </div>
          </div>
        </div>
      </header>

      <main className="px-3 py-4 sm:px-4 sm:py-6 space-y-4 max-w-5xl mx-auto">
        {students.length > 0 && activeTab === "sessions" && (
          <div className="flex items-center justify-between gap-3 p-3 sm:p-4 bg-card rounded-xl border shadow-sm">
            <div className="flex items-center gap-3 min-w-0">
              <div className="hidden sm:flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <span className="font-semibold text-foreground">{getGreeting()} عمر!</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="outline" className="gap-1 bg-blue-500/10 text-blue-700 border-blue-500/30">
                  <CalendarDays className="h-3 w-3" />
                  {todayStats.total} حصص
                </Badge>
                {todayStats.completed > 0 && (
                  <Badge variant="outline" className="gap-1 bg-emerald-500/10 text-emerald-700 border-emerald-500/30">
                    <CheckCircle2 className="h-3 w-3" />
                    {todayStats.completed} مكتملة
                  </Badge>
                )}
                {todayStats.cancelled > 0 && (
                  <Badge variant="outline" className="gap-1 bg-rose-500/10 text-rose-700 border-rose-500/30">
                    <XCircle className="h-3 w-3" />
                    {todayStats.cancelled} ملغاة
                  </Badge>
                )}
              </div>
            </div>
            {todayStats.total > 0 && (
              <div className="flex items-center gap-2">
                <div className="hidden sm:block w-24 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-emerald-500 transition-all duration-500"
                    style={{ width: `${todayStats.progressPercent}%` }}
                  />
                </div>
                <span className="text-sm font-bold text-primary">{todayStats.progressPercent}%</span>
              </div>
            )}
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full grid grid-cols-4 mb-4 h-12 bg-muted/50 p-1 rounded-xl">
            <TabsTrigger
              value="sessions"
              className="gap-1.5 text-xs sm:text-sm rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all font-medium"
            >
              <BookOpen className="h-4 w-4" />
              <span className="hidden xs:inline">الحصص</span>
            </TabsTrigger>
            <TabsTrigger
              value="calendar"
              className="gap-1.5 text-xs sm:text-sm rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all font-medium"
            >
              <CalendarDays className="h-4 w-4" />
              <span className="hidden xs:inline">التقويم</span>
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="gap-1.5 text-xs sm:text-sm rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all font-medium"
            >
              <History className="h-4 w-4" />
              <span className="hidden xs:inline">إدارة الطلبة</span>
            </TabsTrigger>
            <TabsTrigger
              value="payments"
              className="gap-1.5 text-xs sm:text-sm rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all font-medium"
            >
              <CreditCard className="h-4 w-4" />
              <span className="hidden xs:inline">المدفوعات</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sessions" className="mt-0 space-y-4">
            {students.length === 0 ? (
              <EmptyState />
            ) : allTodaySessions.length === 0 ? (
              <Card className="border-2 border-dashed">
                <CardContent className="p-10 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-muted flex items-center justify-center">
                    <CalendarDays className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="font-bold text-lg mb-2">لا توجد حصص اليوم</h3>
                  <p className="text-sm text-muted-foreground">{format(now, "EEEE، d MMMM yyyy", { locale: ar })}</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {nextSession && (
                  <Card className="border-2 border-primary/30 bg-gradient-to-r from-primary/5 to-transparent overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                            <Timer className="h-6 w-6 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs text-muted-foreground mb-0.5">الحصة القادمة</p>
                            <p className="font-bold text-lg truncate">{nextSession.student.name}</p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Clock className="h-3.5 w-3.5" />
                              <span>{nextSession.session.time || nextSession.student.sessionTime}</span>
                              {timeUntilNext && (
                                <>
                                  <span>•</span>
                                  <span className="text-primary font-medium">{timeUntilNext}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="sm"
                                className="bg-emerald-500 hover:bg-emerald-600 text-white gap-1.5 h-9 px-4"
                              >
                                <Check className="h-4 w-4" />
                                <span className="hidden sm:inline">إكمال</span>
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent dir="rtl">
                              <AlertDialogHeader>
                                <AlertDialogTitle>تأكيد إكمال الحصة</AlertDialogTitle>
                                <AlertDialogDescription>
                                  هل تريد تسجيل حصة <strong>{nextSession.student.name}</strong> كمكتملة؟
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter className="flex-row-reverse gap-2">
                                <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleToggleComplete(nextSession.student.id, nextSession.session.id)}
                                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                                >
                                  تأكيد الإكمال
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-rose-500/50 text-rose-600 hover:bg-rose-500/10 gap-1.5 h-9 px-4"
                              >
                                <XCircle className="h-4 w-4" />
                                <span className="hidden sm:inline">إلغاء</span>
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent dir="rtl">
                              <AlertDialogHeader>
                                <AlertDialogTitle>تأكيد إلغاء الحصة</AlertDialogTitle>
                                <AlertDialogDescription>
                                  هل تريد إلغاء حصة <strong>{nextSession.student.name}</strong>؟
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter className="flex-row-reverse gap-2">
                                <AlertDialogCancel>رجوع</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => {
                                    const reason = prompt("سبب الإلغاء (اختياري):");
                                    handleCancelSession(
                                      nextSession.student.id,
                                      nextSession.session.id,
                                      reason || undefined,
                                    );
                                  }}
                                  className="bg-rose-600 text-white hover:bg-rose-700"
                                >
                                  تأكيد الإلغاء
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Card className="border overflow-hidden">
                  <CardHeader className="pb-3 border-b bg-muted/30">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <Clock className="h-4 w-4 text-primary" />
                        جدول اليوم
                      </CardTitle>
                      <div className="flex items-center gap-1.5 text-xs">
                        {todayStats.scheduled > 0 && (
                          <Badge variant="outline" className="bg-blue-500/10 text-blue-700 border-blue-500/30">
                            {todayStats.scheduled} مجدولة
                          </Badge>
                        )}
                        {todayStats.completed > 0 && (
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30">
                            {todayStats.completed} مكتملة
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y">
                      {visibleSessions.map((item, index) => {
                        const { session, student } = item;
                        const sessionTime = session.time || student.sessionTime || "16:00";
                        const isCompleted = session.status === "completed";
                        const isCancelled = session.status === "cancelled";
                        const isVacation = session.status === "vacation";
                        const isScheduled = session.status === "scheduled";
                        const isNextSession = nextSession?.session.id === session.id;
                        return (
                          <div
                            key={session.id}
                            className={cn(
                              "flex gap-3 sm:gap-4 p-3 sm:p-4 transition-all",
                              isCompleted && "bg-emerald-500/5",
                              isCancelled && "bg-rose-500/5",
                              isVacation && "bg-amber-500/5",
                              isScheduled && !isNextSession && "hover:bg-muted/50",
                              isNextSession && "bg-primary/5",
                            )}
                          >
                            <div className="flex flex-col items-center">
                              <div
                                className={cn(
                                  "w-14 h-14 rounded-xl flex flex-col items-center justify-center font-bold text-sm border-2 shadow-sm",
                                  isCompleted && "bg-emerald-500 text-white border-emerald-600",
                                  isCancelled && "bg-rose-500 text-white border-rose-600",
                                  isVacation && "bg-amber-500 text-white border-amber-600",
                                  isScheduled && "bg-blue-500 text-white border-blue-600",
                                )}
                              >
                                <span className="text-base font-bold">{sessionTime.substring(0, 5)}</span>
                              </div>
                              {index < visibleSessions.length - 1 && (
                                <div
                                  className={cn(
                                    "w-0.5 flex-1 mt-2 min-h-[16px]",
                                    isCompleted && "bg-emerald-300",
                                    isCancelled && "bg-rose-300",
                                    isVacation && "bg-amber-300",
                                    isScheduled && "bg-blue-300",
                                  )}
                                />
                              )}
                            </div>
                            <div className="flex-1 min-w-0 py-1">
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <User
                                    className={cn(
                                      "h-4 w-4 shrink-0",
                                      isCompleted && "text-emerald-600",
                                      isCancelled && "text-rose-600",
                                      isVacation && "text-amber-600",
                                      isScheduled && "text-blue-600",
                                    )}
                                  />
                                  <h4 className="font-bold text-base truncate">{student.name}</h4>
                                </div>
                                <Badge
                                  className={cn(
                                    "shrink-0 text-xs font-semibold",
                                    isCompleted && "bg-emerald-500 text-white",
                                    isCancelled && "bg-rose-500 text-white",
                                    isVacation && "bg-amber-500 text-white",
                                    isScheduled && "bg-blue-500 text-white",
                                  )}
                                >
                                  {isCompleted && "✓ مكتملة"}
                                  {isCancelled && "✕ ملغاة"}
                                  {isVacation && "🏖 إجازة"}
                                  {isScheduled && "◉ مجدولة"}
                                </Badge>
                              </div>
                              {isScheduled && !isNextSession && (
                                <div className="flex items-center gap-2 flex-wrap">
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        size="sm"
                                        className="bg-emerald-500 hover:bg-emerald-600 text-white gap-1.5 h-9 px-4"
                                      >
                                        <CheckCircle2 className="h-4 w-4" />
                                        إكمال
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent dir="rtl">
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>تأكيد إكمال الحصة</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          هل تريد تسجيل حصة <strong>{student.name}</strong> في{" "}
                                          <strong>{sessionTime}</strong> كمكتملة؟
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter className="flex-row-reverse gap-2">
                                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => handleToggleComplete(student.id, session.id)}
                                          className="bg-emerald-600 text-white hover:bg-emerald-700"
                                        >
                                          تأكيد الإكمال
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="border-rose-500/50 text-rose-600 hover:bg-rose-500/10 gap-1.5 h-9 px-4"
                                      >
                                        <XCircle className="h-4 w-4" />
                                        إلغاء
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent dir="rtl">
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>تأكيد إلغاء الحصة</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          هل تريد إلغاء حصة <strong>{student.name}</strong> في{" "}
                                          <strong>{sessionTime}</strong>؟
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter className="flex-row-reverse gap-2">
                                        <AlertDialogCancel>رجوع</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => {
                                            const reason = prompt("سبب الإلغاء (اختياري):");
                                            handleCancelSession(student.id, session.id, reason || undefined);
                                          }}
                                          className="bg-rose-600 text-white hover:bg-rose-700"
                                        >
                                          تأكيد الإلغاء
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="border-amber-500/50 text-amber-600 hover:bg-amber-500/10 gap-1.5 h-9 px-4"
                                    onClick={() => handleQuickPayment(student.id, session.id, session.date)}
                                  >
                                    <DollarSign className="h-4 w-4" />
                                    دفع
                                  </Button>
                                </div>
                              )}
                              {isCompleted && (
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-emerald-600 font-medium">✓ تم إكمال الحصة</span>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="border-amber-500/50 text-amber-600 hover:bg-amber-500/10 gap-1.5 h-8 px-3 text-xs"
                                    onClick={() => handleQuickPayment(student.id, session.id, session.date)}
                                  >
                                    <DollarSign className="h-3.5 w-3.5" />
                                    دفع
                                  </Button>
                                </div>
                              )}
                              {isCancelled && <span className="text-sm text-rose-600">تم إلغاء هذه الحصة</span>}
                              {isVacation && <span className="text-sm text-amber-600">إجازة</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {hasMoreSessions && (
                      <div className="border-t p-3">
                        <Button
                          variant="ghost"
                          className="w-full gap-2 text-muted-foreground hover:text-foreground"
                          onClick={() => setShowAllSessions(!showAllSessions)}
                        >
                          {showAllSessions ? (
                            <>
                              <ChevronUp className="h-4 w-4" />
                              عرض أقل
                            </>
                          ) : (
                            <>
                              <ChevronDown className="h-4 w-4" />
                              عرض الكل ({allTodaySessions.length - 5} إضافية)
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="calendar" className="mt-0">
            <CalendarView
              students={students}
              onRescheduleSession={rescheduleSession}
              onUpdateSessionDateTime={updateSessionDateTime}
              onToggleComplete={handleToggleComplete}
              onCancelSession={handleCancelSession}
              onQuickPayment={handleQuickPayment}
            />
          </TabsContent>
          <TabsContent value="history" className="mt-0">
            <SessionHistoryBar
              students={students}
              onCancelSession={handleCancelSession}
              onDeleteSession={handleDeleteSession}
              onRestoreSession={handleRestoreSession}
              onToggleComplete={handleToggleComplete}
              onRescheduleSession={rescheduleSession}
              onAddSession={handleAddSession}
              onMarkAsVacation={handleMarkAsVacation}
              onUpdateSessionDetails={updateSessionDetails}
              getCancellationCount={getCancellationCount}
              getAllStudentCancellations={getAllStudentCancellations}
              onClearMonthCancellations={clearMonthCancellations}
            />
          </TabsContent>
          <TabsContent value="payments" className="mt-0 space-y-4">
            {students.length > 0 && (
              <StatsBar
                students={students}
                payments={payments}
                selectedMonth={selectedMonth}
                selectedYear={selectedYear}
              />
            )}
            <PaymentsDashboard
              students={students}
              payments={payments}
              selectedMonth={selectedMonth}
              selectedYear={selectedYear}
              onTogglePayment={togglePaymentStatus}
              onRecordPayment={handleRecordPayment}
              onResetPayment={resetMonthlyPayment}
              settings={settings}
            />
          </TabsContent>
        </Tabs>

        <EndOfMonthReminder students={students} payments={payments} onTogglePayment={togglePaymentStatus} />
      </main>

      <QuickPaymentDialog
        open={quickPaymentDialog.open}
        onOpenChange={(open) =>
          !open && setQuickPaymentDialog({ open: false, student: null, sessionId: "", sessionDate: "" })
        }
        student={quickPaymentDialog.student}
        sessionId={quickPaymentDialog.sessionId}
        sessionDate={quickPaymentDialog.sessionDate}
        settings={settings}
        payments={payments}
        onConfirm={handleQuickPaymentConfirm}
      />
      {addConflictDialog && (
        <RestoreConflictDialog
          open={addConflictDialog.open}
          onOpenChange={(open) => !open && setAddConflictDialog(null)}
          conflictResult={addConflictDialog.conflictResult}
          sessionInfo={addConflictDialog.sessionInfo}
          onConfirm={addConflictDialog.conflictResult.severity === "warning" ? handleForceAddSession : undefined}
          title={
            addConflictDialog.conflictResult.severity === "error" ? "لا يمكن إضافة الحصة" : "تحذير: تعارض في الوقت"
          }
          confirmText={addConflictDialog.conflictResult.severity === "warning" ? "إضافة على أي حال" : undefined}
        />
      )}
    </div>
  );
};

export default Index;
