import { useState, useMemo } from "react";
import {
  GraduationCap,
  BookOpen,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  Users,
  X,
  Trash2,
  Clock,
  Monitor,
  MapPin,
  History,
  FileText,
  CalendarDays,
  Sparkles,
  TrendingUp,
  CheckCircle2,
  Circle,
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
  const [selectedDayOfWeek, setSelectedDayOfWeek] = useState(now.getDay()); // ✅ Already shows today
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

  // ✅ ALL FUNCTIONS UNCHANGED - KEEPING EXACTLY AS IS
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

  const getStudentsForDay = () => {
    return students.filter((student) => {
      return student.scheduleDays.some((d) => d.dayOfWeek === selectedDayOfWeek);
    });
  };

  const studentsForDay = getStudentsForDay();

  const filteredStudents = studentsForDay
    .filter((s) => studentFilter === "all" || s.id === studentFilter)
    .sort((a, b) => {
      const timeA = a.sessionTime || "16:00";
      const timeB = b.sessionTime || "16:00";
      return timeA.localeCompare(timeB);
    });

  const goToPrevDay = () => {
    setSelectedDayOfWeek((prev) => (prev === 0 ? 6 : prev - 1));
  };

  const goToNextDay = () => {
    setSelectedDayOfWeek((prev) => (prev === 6 ? 0 : prev + 1));
  };

  const goToToday = () => {
    setSelectedDayOfWeek(now.getDay());
  };

  const getWeekDays = () => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const studentsOnDay = students.filter((student) => student.scheduleDays.some((d) => d.dayOfWeek === i));

      const selectedStudentHasSession =
        studentFilter !== "all" &&
        students.some((student) => student.id === studentFilter && student.scheduleDays.some((d) => d.dayOfWeek === i));

      days.push({
        dayOfWeek: i,
        dayName: DAY_NAMES_SHORT_AR[i],
        isToday: now.getDay() === i,
        studentCount: studentsOnDay.length,
        hasSelectedStudent: selectedStudentHasSession,
      });
    }
    return days;
  };

  const weekDays = getWeekDays();

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

  // ✅ NEW: Calculate today's stats (visual only - no functionality change)
  const todayStr = format(now, "yyyy-MM-dd");
  const todaysSessions = students.reduce((acc, student) => {
    const sessions = student.sessions.filter((s) => s.date === todayStr);
    return acc + sessions.length;
  }, 0);

  const todaysCompletedSessions = students.reduce((acc, student) => {
    const sessions = student.sessions.filter((s) => s.date === todayStr && s.status === "completed");
    return acc + sessions.length;
  }, 0);

  const todaysScheduledSessions = students.reduce((acc, student) => {
    const sessions = student.sessions.filter((s) => s.date === todayStr && s.status === "scheduled");
    return acc + sessions.length;
  }, 0);

  // ✅ NEW: Get greeting based on time
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
      className="min-h-screen safe-bottom relative overflow-hidden"
      dir="rtl"
      style={{
        background:
          "linear-gradient(135deg, hsl(var(--background)) 0%, hsl(var(--primary) / 0.03) 25%, hsl(var(--background)) 50%, hsl(var(--primary) / 0.05) 75%, hsl(var(--background)) 100%)",
        backgroundSize: "400% 400%",
        animation: "gradientShift 15s ease infinite",
      }}
    >
      {/* ✅ NEW: Animated Background CSS */}
      <style>{`
        @keyframes gradientShift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fadeIn 0.5s ease-out forwards;
        }
      `}</style>

      {/* Header - UNCHANGED */}
      <header className="bg-card/95 backdrop-blur-md border-b border-border/50 sticky top-0 z-10 safe-top shadow-sm">
        <div className="px-3 py-3 sm:px-4 sm:py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-primary via-primary to-primary/80 shadow-lg flex items-center justify-center shrink-0 ring-2 ring-primary/20">
                <GraduationCap className="h-5 w-5 sm:h-6 sm:w-6 text-primary-foreground drop-shadow" />
              </div>
              <div className="min-w-0">
                <h1 className="font-heading font-bold text-lg sm:text-xl leading-tight truncate bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">
                  متابعة الطلاب
                </h1>
                <p className="text-[10px] sm:text-xs text-muted-foreground hidden xs:block font-medium">
                  إدارة الحصص والمدفوعات
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end">
              <Sheet>
                <SheetTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 px-2.5 sm:px-3.5 gap-1.5 rounded-xl border-2 hover:border-primary hover:bg-primary/5 transition-all hover:scale-105 shadow-sm"
                  >
                    <Users className="h-4 w-4" />
                    <span className="hidden sm:inline text-sm font-medium">الطلاب</span>
                    <span className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full font-bold shadow-sm">
                      {students.length}
                    </span>
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
      <main className="px-3 py-3 sm:px-4 sm:py-4 space-y-3 sm:space-y-4 max-w-4xl mx-auto">
        {/* ✅ NEW: Welcome Section */}
        {students.length > 0 && activeTab === "sessions" && (
          <Card className="border-2 shadow-lg bg-gradient-to-br from-primary/5 via-background to-background animate-fade-in overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl"></div>
            <CardContent className="p-4 sm:p-6 relative">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    <h2 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                      {getGreeting()} عمر! 👋
                    </h2>
                  </div>
                  <p className="text-sm sm:text-base text-muted-foreground mb-4">
                    {todaysSessions > 0 ? (
                      <>
                        لديك <span className="font-bold text-primary">{todaysSessions}</span>{" "}
                        {todaysSessions === 1 ? "حصة" : "حصص"} اليوم
                        {todaysCompletedSessions > 0 && (
                          <>
                            , أكملت <span className="font-bold text-emerald-600">{todaysCompletedSessions}</span> منها
                          </>
                        )}
                        . {todaysScheduledSessions > 0 ? "هل أنت مستعد؟ 💪" : "رائع! استمر في العمل الجيد! 🎉"}
                      </>
                    ) : (
                      <>لا توجد حصص مجدولة اليوم. استمتع بيومك! 🌟</>
                    )}
                  </p>
                  <div className="text-xs text-muted-foreground">
                    {format(now, "EEEE، dd MMMM yyyy", { locale: ar })}
                  </div>
                </div>

                {todaysSessions > 0 && (
                  <div className="flex flex-col items-center gap-2 bg-primary/10 rounded-xl p-3 sm:p-4 min-w-[80px] sm:min-w-[100px]">
                    <div className="relative w-16 h-16 sm:w-20 sm:h-20">
                      <svg className="transform -rotate-90 w-full h-full">
                        <circle
                          cx="50%"
                          cy="50%"
                          r="30"
                          stroke="currentColor"
                          strokeWidth="6"
                          fill="transparent"
                          className="text-muted/20"
                        />
                        <circle
                          cx="50%"
                          cy="50%"
                          r="30"
                          stroke="currentColor"
                          strokeWidth="6"
                          fill="transparent"
                          strokeDasharray={`${2 * Math.PI * 30}`}
                          strokeDashoffset={`${2 * Math.PI * 30 * (1 - todaysCompletedSessions / todaysSessions)}`}
                          className="text-primary transition-all duration-1000"
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-lg sm:text-xl font-bold text-primary">
                          {Math.round((todaysCompletedSessions / todaysSessions) * 100)}%
                        </span>
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs font-medium text-muted-foreground">التقدم</div>
                      <div className="text-xs text-primary font-bold">
                        {todaysCompletedSessions}/{todaysSessions}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Tabs - UNCHANGED */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full grid grid-cols-4 mb-4 h-12 bg-muted/50 p-1.5 rounded-2xl shadow-sm">
            <TabsTrigger
              value="sessions"
              className="gap-2 text-sm rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-md transition-all font-medium"
            >
              <BookOpen className="h-4 w-4" />
              <span className="hidden xs:inline">الحصص</span>
            </TabsTrigger>
            <TabsTrigger
              value="calendar"
              className="gap-2 text-sm rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-md transition-all font-medium"
            >
              <CalendarDays className="h-4 w-4" />
              <span className="hidden xs:inline">التقويم</span>
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="gap-2 text-sm rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-md transition-all font-medium"
            >
              <History className="h-4 w-4" />
              <span className="hidden xs:inline">السجل</span>
            </TabsTrigger>
            <TabsTrigger
              value="payments"
              className="gap-2 text-sm rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-md transition-all font-medium"
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
                <div className="space-y-2.5">
                  <div className="flex items-center justify-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={goToNextDay}
                      className="h-10 w-10 rounded-xl hover:bg-primary/10 hover:scale-110 transition-all"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </Button>
                    <div className="text-center min-w-[140px] sm:min-w-[180px]">
                      <p className="font-heading font-bold text-lg sm:text-xl bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                        {DAY_NAMES_AR[selectedDayOfWeek]}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={goToPrevDay}
                      className="h-10 w-10 rounded-xl hover:bg-primary/10 hover:scale-110 transition-all"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </Button>
                    {selectedDayOfWeek !== now.getDay() && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={goToToday}
                        className="mr-1 h-9 rounded-xl border-2 hover:border-primary hover:scale-105 transition-all shadow-sm"
                      >
                        اليوم
                      </Button>
                    )}
                  </div>

                  <div className="flex justify-start sm:justify-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide -mx-3 px-3 sm:mx-0 sm:px-0">
                    {weekDays.map((day) => (
                      <button
                        key={day.dayOfWeek}
                        onClick={() => {
                          setSelectedDayOfWeek(day.dayOfWeek);
                          setStudentFilter("all");
                        }}
                        className={cn(
                          "flex flex-col items-center px-3 py-2 rounded-xl transition-all min-w-[52px] shrink-0 relative shadow-sm",
                          selectedDayOfWeek === day.dayOfWeek
                            ? "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg scale-105"
                            : day.hasSelectedStudent
                              ? "bg-accent border-2 border-accent-foreground/20 ring-2 ring-primary/40"
                              : day.isToday
                                ? "bg-primary/10 border-2 border-primary/30 hover:bg-primary/20"
                                : "bg-card border-2 border-border hover:border-primary/50 hover:shadow-md",
                        )}
                      >
                        {day.hasSelectedStudent && selectedDayOfWeek !== day.dayOfWeek && (
                          <span className="absolute -top-1 -left-1 w-2.5 h-2.5 bg-primary rounded-full shadow-lg" />
                        )}
                        <span className="text-sm font-bold">{day.dayName}</span>
                        {day.studentCount > 0 && (
                          <span
                            className={cn(
                              "text-[9px] px-1.5 rounded-full mt-1 font-bold",
                              selectedDayOfWeek === day.dayOfWeek
                                ? "bg-primary-foreground/20 text-primary-foreground"
                                : "bg-primary/10 text-primary",
                            )}
                          >
                            {day.studentCount}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <Select
                      value={studentFilter}
                      onValueChange={(value) => {
                        setStudentFilter(value);
                        if (value !== "all") {
                          const student = students.find((s) => s.id === value);
                          if (student && student.scheduleDays.length > 0) {
                            setSelectedDayOfWeek(student.scheduleDays[0].dayOfWeek);
                          }
                        }
                      }}
                    >
                      <SelectTrigger className="w-full h-11 rounded-xl border-2 hover:border-primary transition-colors">
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
                        className="h-11 w-11 shrink-0 rounded-xl hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setStudentFilter("all")}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {filteredStudents.length === 0 ? (
                  <div className="text-center py-12 animate-fade-in">
                    <p className="text-muted-foreground">
                      {studentFilter !== "all"
                        ? `لا توجد حصص لهذا الطالب يوم ${DAY_NAMES_AR[selectedDayOfWeek]}`
                        : `لا توجد حصص مجدولة ليوم ${DAY_NAMES_AR[selectedDayOfWeek]}`}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">اضغط على أيام أخرى لعرض الحصص</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:gap-4">
                    {filteredStudents.map((student) => (
                      <StudentCard
                        key={student.id}
                        student={student}
                        students={students}
                        settings={settings}
                        selectedDayOfWeek={selectedDayOfWeek}
                        onRemove={() => removeStudent(student.id)}
                        onUpdateName={(name) => updateStudentName(student.id, name)}
                        onUpdateTime={(time) => updateStudentTime(student.id, time)}
                        onUpdatePhone={(phone) => updateStudentPhone(student.id, phone)}
                        onUpdateSessionType={(type) => updateStudentSessionType(student.id, type)}
                        onUpdateSchedule={(days, start, end) => updateStudentSchedule(student.id, days, start, end)}
                        onUpdateDuration={(duration) => updateStudentDuration(student.id, duration)}
                        onUpdateCustomSettings={(settings) => updateStudentCustomSettings(student.id, settings)}
                      />
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
