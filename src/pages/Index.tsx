import { useState, useMemo } from "react";
import {
  GraduationCap,
  BookOpen,
  CreditCard,
  Users,
  X,
  Trash2,
  Clock,
  Monitor,
  MapPin,
  History,
  CalendarDays,
  Sparkles,
  CheckCircle2,
  Award,
  Zap,
  TrendingUp,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ar } from "date-fns/locale";
import { useStudents } from "@/hooks/useStudents";
import { useCancellationTracking } from "@/hooks/useCancellationTracking";
import { useConflictDetection, ConflictResult } from "@/hooks/useConflictDetection";
import { AddStudentDialog } from "@/components/AddStudentDialog";
import { SemesterSettings } from "@/components/SemesterSettings";
import { StudentCard } from "@/components/StudentCard";
import { EditStudentDialog } from "@/components/EditStudentDialog";
import { PaymentsDashboard } from "@/components/PaymentsDashboard";
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
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DAY_NAMES_SHORT_AR, DAY_NAMES_AR, formatShortDateAr } from "@/lib/arabicConstants";
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

const Index = () => {
  const now = new Date();
  const [selectedDayOfWeek] = useState(now.getDay());
  const [activeTab, setActiveTab] = useState("sessions");
  const [studentFilter, setStudentFilter] = useState<string>("all");
  const [allStudentsSearch, setAllStudentsSearch] = useState("");

  const [addConflictDialog, setAddConflictDialog] = useState<{
    open: boolean;
    studentId: string;
    date: string;
    conflictResult: ConflictResult;
    sessionInfo: { studentName: string; date: string; time: string };
  } | null>(null);

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

  const handleAddSession = (studentId: string, date: string) => {
    const student = students.find((s) => s.id === studentId);
    if (!student) return;

    const sessionTime = student.sessionTime || "16:00";
    const conflictResult = checkConflict({ date, startTime: sessionTime });

    if (conflictResult.severity === "error") {
      setAddConflictDialog({
        open: true,
        studentId,
        date,
        conflictResult,
        sessionInfo: {
          studentName: student.name,
          date: formatShortDateAr(date),
          time: sessionTime,
        },
      });
      return;
    }

    if (conflictResult.severity === "warning") {
      setAddConflictDialog({
        open: true,
        studentId,
        date,
        conflictResult,
        sessionInfo: {
          studentName: student.name,
          date: formatShortDateAr(date),
          time: sessionTime,
        },
      });
      return;
    }

    addExtraSession(studentId, date);
    toast({
      title: "تمت إضافة الحصة",
      description: `حصة جديدة بتاريخ ${format(parseISO(date), "dd/MM/yyyy")}${student ? ` لـ ${student.name}` : ""}`,
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
      } else {
        toast({
          title: "تم إلغاء الحصة",
          description: reason ? `السبب: ${reason}` : "تم إلغاء الحصة بنجاح",
          variant: "destructive",
        });
      }
    } else {
      toast({
        title: "تم إلغاء الحصة",
        description: reason ? `السبب: ${reason}` : "تم إلغاء الحصة بنجاح",
        variant: "destructive",
      });
    }
  };

  const handleDeleteSession = (studentId: string, sessionId: string) => {
    deleteSession(studentId, sessionId);
    toast({
      title: "تم حذف الحصة",
      description: "تم حذف الحصة نهائياً",
    });
  };

  const handleRestoreSession = async (studentId: string, sessionId: string) => {
    const student = students.find((s) => s.id === studentId);
    const session = student?.sessions.find((s) => s.id === sessionId);

    if (session?.status === "cancelled") {
      await removeCancellation(studentId, session.date);
    }

    restoreSession(studentId, sessionId);
    toast({
      title: "تم استعادة الحصة",
      description: "تم استعادة الحصة وتحديث عداد الإلغاءات",
    });
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
    toast({
      title: "تم تحديد الحصة كإجازة",
      description: "لن يتم احتساب هذه الحصة في المدفوعات",
    });
  };

  const selectedMonth = now.getMonth();
  const selectedYear = now.getFullYear();

  // ✅ Today's date string
  const todayStr = format(now, "yyyy-MM-dd");

  // ✅ FIXED: Get students who actually have sessions TODAY
  const getStudentsForDay = () => {
    return students
      .map((student) => ({
        ...student,
        todaySessions: student.sessions.filter((s) => s.date === todayStr),
      }))
      .filter((student) => student.todaySessions.length > 0);
  };

  const studentsForDay = getStudentsForDay();

  const filteredStudents = studentsForDay
    .filter((s) => studentFilter === "all" || s.id === studentFilter)
    .sort((a, b) => {
      const timeA = a.sessionTime || "16:00";
      const timeB = b.sessionTime || "16:00";
      return timeA.localeCompare(timeB);
    });

  const allStudentsSortedByTime = useMemo(() => {
    const searchLower = allStudentsSearch.trim().toLowerCase();
    return [...students]
      .filter((s) => searchLower === "" || s.name.toLowerCase().includes(searchLower))
      .sort((a, b) => {
        const timeA = a.sessionTime || "16:00";
        const timeB = b.sessionTime || "16:00";
        return timeA.localeCompare(timeB);
      });
  }, [students, allStudentsSearch]);

  // ✅ Calculate today's sessions dynamically
  const todaysSessions = useMemo(() => {
    return students.reduce((acc, student) => {
      const sessions = student.sessions.filter((s) => s.date === todayStr);
      return acc + sessions.length;
    }, 0);
  }, [students, todayStr]);

  const todaysCompletedSessions = useMemo(() => {
    return students.reduce((acc, student) => {
      const sessions = student.sessions.filter((s) => s.date === todayStr && s.status === "completed");
      return acc + sessions.length;
    }, 0);
  }, [students, todayStr]);

  const todaysScheduledSessions = useMemo(() => {
    return students.reduce((acc, student) => {
      const sessions = student.sessions.filter((s) => s.date === todayStr && s.status === "scheduled");
      return acc + sessions.length;
    }, 0);
  }, [students, todayStr]);

  const getGreeting = () => {
    const hour = now.getHours();
    if (hour < 12) return "صباح الخير";
    if (hour < 18) return "مساءً سعيداً";
    return "مساء الخير";
  };

  const getMotivationalMessage = () => {
    if (todaysSessions === 0) return { text: "يوم راحة!", emoji: "🌟", color: "from-blue-500 to-cyan-500" };
    if (todaysCompletedSessions === todaysSessions)
      return { text: "إنجاز رائع!", emoji: "🏆", color: "from-emerald-500 to-green-500" };
    if (todaysCompletedSessions >= todaysSessions / 2)
      return { text: "أداء ممتاز!", emoji: "⭐", color: "from-amber-500 to-yellow-500" };
    return { text: "لنبدأ!", emoji: "💪", color: "from-primary to-primary/70" };
  };

  const motivational = getMotivationalMessage();

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">جاري التحميل...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen safe-bottom relative" dir="rtl">
      {/* Animated Background */}
      <div
        className="fixed inset-0 -z-10"
        style={{
          background: `
            radial-gradient(circle at 20% 50%, hsl(var(--primary) / 0.12) 0%, transparent 50%),
            radial-gradient(circle at 80% 80%, hsl(var(--primary) / 0.08) 0%, transparent 50%),
            radial-gradient(circle at 40% 20%, hsl(var(--primary) / 0.06) 0%, transparent 50%),
            linear-gradient(135deg, hsl(var(--background)) 0%, hsl(var(--primary) / 0.02) 100%)
          `,
          backgroundSize: "200% 200%",
          animation: "gradientShift 20s ease infinite",
        }}
      />

      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div
          className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl"
          style={{ animation: "float 25s ease-in-out infinite" }}
        />
        <div
          className="absolute bottom-1/3 right-1/3 w-[500px] h-[500px] bg-primary/3 rounded-full blur-3xl"
          style={{ animation: "float 30s ease-in-out infinite reverse" }}
        />
      </div>

      <style>{`
        @keyframes gradientShift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @keyframes float {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(40px, -40px) scale(1.1); }
          66% { transform: translate(-30px, 30px) scale(0.9); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.8; }
        }
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.6s ease-out forwards;
        }
        .animate-pulse-slow {
          animation: pulse 3s ease-in-out infinite;
        }
        .shimmer {
          background: linear-gradient(90deg, transparent, hsl(var(--primary) / 0.1), transparent);
          background-size: 200% 100%;
          animation: shimmer 3s infinite;
        }
      `}</style>

      {/* Header */}
      <header className="bg-card/90 backdrop-blur-xl border-b border-border/50 sticky top-0 z-10 safe-top shadow-lg">
        <div className="px-3 py-3 sm:px-4 sm:py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-primary via-primary to-primary/80 shadow-xl flex items-center justify-center shrink-0 ring-4 ring-primary/10 animate-pulse-slow">
                <GraduationCap className="h-6 w-6 text-primary-foreground drop-shadow-lg" />
              </div>
              <div className="min-w-0">
                <h1 className="font-heading font-bold text-lg sm:text-xl leading-tight truncate bg-gradient-to-r from-foreground via-primary to-foreground bg-clip-text text-transparent">
                  متابعة الطلاب
                </h1>
                <p className="text-[10px] sm:text-xs text-muted-foreground font-medium">إدارة احترافية للحصص</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2">
              <Sheet>
                <SheetTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-10 px-3 sm:px-4 gap-2 rounded-xl border-2 hover:border-primary hover:bg-primary/10 transition-all hover:scale-105 shadow-md relative overflow-hidden group"
                  >
                    <div className="absolute inset-0 shimmer group-hover:opacity-100 opacity-0 transition-opacity" />
                    <Users className="h-4 w-4 relative z-10" />
                    <span className="hidden sm:inline text-sm font-semibold relative z-10">الطلاب</span>
                    <Badge className="relative z-10 bg-primary text-primary-foreground shadow-sm">
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
                                {student.sessionTime || "16:00"}
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

      {/* Main Content */}
      <main className="px-3 py-4 sm:px-4 sm:py-6 space-y-4 sm:space-y-6 max-w-5xl mx-auto">
        {/* Welcome Card */}
        {students.length > 0 && activeTab === "sessions" && (
          <div className="relative animate-fade-in-up">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20 rounded-3xl blur-2xl opacity-50" />

            <Card className="relative border-2 border-primary/20 shadow-2xl bg-gradient-to-br from-card via-card/95 to-primary/5 backdrop-blur-sm overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-primary/10 to-transparent rounded-full blur-3xl" />
              <div className="absolute bottom-0 left-0 w-40 h-40 bg-gradient-to-tr from-primary/5 to-transparent rounded-full blur-3xl" />

              <CardContent className="p-5 sm:p-7 relative">
                <div className="flex items-start justify-between gap-4 flex-wrap sm:flex-nowrap">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10">
                          <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-primary animate-pulse" />
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
                          {getGreeting()} عمر! 👋
                        </h2>
                      </div>

                      <Badge
                        className={cn(
                          "px-3 py-1.5 text-sm font-bold shadow-lg animate-pulse-slow bg-gradient-to-r",
                          motivational.color,
                        )}
                      >
                        {motivational.emoji} {motivational.text}
                      </Badge>
                    </div>

                    <div className="space-y-2">
                      <p className="text-base sm:text-lg text-foreground/90 font-medium">
                        {todaysSessions > 0 ? (
                          <span className="flex items-center gap-2 flex-wrap">
                            لديك
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary/15 rounded-xl font-bold text-primary text-xl">
                              <Zap className="h-5 w-5" />
                              {todaysSessions}
                            </span>
                            {todaysSessions === 1 ? "حصة" : todaysSessions === 2 ? "حصتان" : "حصص"} اليوم
                            {todaysCompletedSessions > 0 && (
                              <>
                                <span className="text-muted-foreground">|</span>
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/15 rounded-xl font-bold text-emerald-600">
                                  <CheckCircle2 className="h-4 w-4" />
                                  {todaysCompletedSessions}
                                </span>
                                مكتملة
                              </>
                            )}
                          </span>
                        ) : (
                          <span className="flex items-center gap-2">
                            <span className="text-2xl">🌟</span>
                            لا توجد حصص مجدولة اليوم
                          </span>
                        )}
                      </p>

                      {todaysScheduledSessions > 0 && (
                        <p className="text-sm text-muted-foreground flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-primary" />
                          متبقي {todaysScheduledSessions} {todaysScheduledSessions === 1 ? "حصة" : "حصص"}
                          {todaysSessions > 0 && " - هل أنت مستعد؟ 💪"}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-3 py-2 rounded-lg w-fit">
                      <CalendarDays className="h-4 w-4 text-primary" />
                      {format(now, "EEEE، dd MMMM yyyy", { locale: ar })}
                    </div>
                  </div>

                  {todaysSessions > 0 && (
                    <div className="flex flex-col items-center gap-3 bg-gradient-to-br from-primary/15 to-primary/5 rounded-2xl p-4 sm:p-5 border-2 border-primary/20 shadow-xl min-w-[110px] sm:min-w-[130px]">
                      <div className="relative w-20 h-20 sm:w-24 sm:h-24">
                        <svg className="transform -rotate-90 w-full h-full">
                          <circle
                            cx="50%"
                            cy="50%"
                            r="35"
                            stroke="currentColor"
                            strokeWidth="6"
                            fill="transparent"
                            className="text-muted/30"
                          />
                          <circle
                            cx="50%"
                            cy="50%"
                            r="35"
                            stroke="url(#gradient)"
                            strokeWidth="6"
                            fill="transparent"
                            strokeDasharray={`${2 * Math.PI * 35}`}
                            strokeDashoffset={`${2 * Math.PI * 35 * (1 - todaysCompletedSessions / todaysSessions)}`}
                            className="transition-all duration-1000"
                            strokeLinecap="round"
                          />
                          <defs>
                            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                              <stop offset="0%" stopColor="hsl(var(--primary))" />
                              <stop offset="100%" stopColor="hsl(var(--primary) / 0.6)" />
                            </linearGradient>
                          </defs>
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-2xl sm:text-3xl font-black bg-gradient-to-br from-primary to-primary/70 bg-clip-text text-transparent">
                            {Math.round((todaysCompletedSessions / todaysSessions) * 100)}%
                          </span>
                        </div>
                      </div>
                      <div className="text-center space-y-1">
                        <div className="text-xs font-bold text-foreground">التقدم اليوم</div>
                        <div className="flex items-center gap-1.5 justify-center">
                          <Award className="h-3.5 w-3.5 text-primary" />
                          <span className="text-sm text-primary font-bold">
                            {todaysCompletedSessions}/{todaysSessions}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full grid grid-cols-4 mb-5 h-13 bg-gradient-to-br from-muted/80 to-muted/50 p-1.5 rounded-2xl shadow-lg backdrop-blur-md border border-border/50">
            <TabsTrigger
              value="sessions"
              className="gap-2 text-sm rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-lg transition-all font-semibold data-[state=active]:scale-105"
            >
              <BookOpen className="h-4 w-4" />
              <span className="hidden xs:inline">الحصص</span>
            </TabsTrigger>
            <TabsTrigger
              value="calendar"
              className="gap-2 text-sm rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-lg transition-all font-semibold data-[state=active]:scale-105"
            >
              <CalendarDays className="h-4 w-4" />
              <span className="hidden xs:inline">التقويم</span>
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="gap-2 text-sm rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-lg transition-all font-semibold data-[state=active]:scale-105"
            >
              <History className="h-4 w-4" />
              <span className="hidden xs:inline">السجل</span>
            </TabsTrigger>
            <TabsTrigger
              value="payments"
              className="gap-2 text-sm rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-lg transition-all font-semibold data-[state=active]:scale-105"
            >
              <CreditCard className="h-4 w-4" />
              <span className="hidden xs:inline">المدفوعات</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sessions" className="mt-0 space-y-4">
            {students.length === 0 ? (
              <EmptyState />
            ) : (
              <>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Select
                      value={studentFilter}
                      onValueChange={(value) => {
                        setStudentFilter(value);
                      }}
                    >
                      <SelectTrigger className="w-full h-12 rounded-xl border-2 hover:border-primary transition-all bg-card/90 backdrop-blur-sm shadow-md font-medium">
                        <Users className="h-4 w-4 ml-2 text-muted-foreground shrink-0" />
                        <SelectValue placeholder="جميع الطلاب" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover z-50">
                        <SelectItem value="all">جميع الطلاب</SelectItem>
                        {students.map((student) => (
                          <SelectItem key={student.id} value={student.id}>
                            <div className="flex items-center gap-2">
                              <span>{student.name}</span>
                              <span className="text-xs text-muted-foreground hidden sm:inline">
                                ({student.scheduleDays.map((d) => DAY_NAMES_SHORT_AR[d.dayOfWeek]).join("، ")})
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {studentFilter !== "all" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-12 w-12 shrink-0 rounded-xl hover:bg-destructive/10 hover:text-destructive border-2 border-transparent hover:border-destructive/50 transition-all"
                        onClick={() => setStudentFilter("all")}
                      >
                        <X className="h-5 w-5" />
                      </Button>
                    )}
                  </div>
                </div>

                {filteredStudents.length === 0 ? (
                  <Card className="border-2 border-dashed bg-card/50 backdrop-blur-sm shadow-lg">
                    <CardContent className="p-10 text-center">
                      <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center shadow-lg">
                        <CalendarDays className="h-10 w-10 text-muted-foreground" />
                      </div>
                      <h3 className="font-bold text-xl mb-2">
                        {studentFilter !== "all" ? `لا توجد حصص لهذا الطالب اليوم` : `لا توجد حصص مجدولة اليوم`}
                      </h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        {format(now, "EEEE، dd MMMM yyyy", { locale: ar })}
                      </p>
                      <Badge className="bg-primary/10 text-primary border-primary/20">استمتع بيومك! 🌟</Badge>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:gap-5">
                    {filteredStudents.map((student, index) => (
                      <div
                        key={student.id}
                        className="animate-fade-in-up"
                        style={{ animationDelay: `${index * 0.1}s` }}
                      >
                        <StudentCard
                          student={student}
                          students={students}
                          settings={settings}
                          selectedDayOfWeek={selectedDayOfWeek}
                          todaySessions={student.todaySessions}
                          onRemove={() => removeStudent(student.id)}
                          onUpdateName={(name) => updateStudentName(student.id, name)}
                          onUpdateTime={(time) => updateStudentTime(student.id, time)}
                          onUpdatePhone={(phone) => updateStudentPhone(student.id, phone)}
                          onUpdateSessionType={(type) => updateStudentSessionType(student.id, type)}
                          onUpdateSchedule={(days, start, end) => updateStudentSchedule(student.id, days, start, end)}
                          onUpdateDuration={(duration) => updateStudentDuration(student.id, duration)}
                          onUpdateCustomSettings={(settings) => updateStudentCustomSettings(student.id, settings)}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="calendar" className="mt-0">
            <CalendarView students={students} onRescheduleSession={rescheduleSession} />
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
              settings={settings}
            />
          </TabsContent>
        </Tabs>

        <EndOfMonthReminder students={students} payments={payments} onTogglePayment={togglePaymentStatus} />
      </main>

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
