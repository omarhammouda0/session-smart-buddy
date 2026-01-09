import { useState, useMemo } from "react";
import { BookOpen, CalendarDays, History, CreditCard, Users, Clock, MapPin } from "lucide-react";

import { useStudents } from "@/hooks/useStudents";
import { useCancellationTracking } from "@/hooks/useCancellationTracking";

import { StudentCard } from "@/components/StudentCard";
import { EmptyState } from "@/components/EmptyState";
import { CalendarView } from "@/components/CalendarView";
import { SessionHistoryBar } from "@/components/SessionHistoryBar";
import { PaymentsDashboard } from "@/components/PaymentsDashboard";
import { StatsBar } from "@/components/StatsBar";
import { EndOfMonthReminder } from "@/components/EndOfMonthReminder";

import { AddStudentDialog } from "@/components/AddStudentDialog";
import { SemesterSettings } from "@/components/SemesterSettings";
import { ReminderSettingsDialog } from "@/components/ReminderSettingsDialog";
import { ReminderHistoryDialog } from "@/components/ReminderHistoryDialog";
import { MonthlyReportDialog } from "@/components/MonthlyReportDialog";
import { BulkEditSessionsDialog } from "@/components/BulkEditSessionsDialog";
import { AddVacationDialog } from "@/components/AddVacationDialog";
import { StudentSearchCombobox } from "@/components/StudentSearchCombobox";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

import { DAY_NAMES_AR, DAY_NAMES_SHORT_AR } from "@/lib/arabicConstants";
import { cn } from "@/lib/utils";

const Index = () => {
  const now = new Date();
  const today = now.getDay();

  const [activeTab, setActiveTab] = useState("sessions");
  const [selectedDayOfWeek, setSelectedDayOfWeek] = useState(today);
  const [allStudentsSearch, setAllStudentsSearch] = useState("");

  const {
    students,
    payments,
    settings,
    isLoaded,
    updateSettings,
    addStudent,
    bulkUpdateSessionTime,
    bulkMarkAsVacation,
    updateSessionDateTime,
    rescheduleSession,
    togglePaymentStatus,
    updateSessionDetails,
  } = useStudents();

  const { getCancellationCount, getAllStudentCancellations, clearMonthCancellations } =
    useCancellationTracking(students);

  const studentsForDay = useMemo(() => {
    return students
      .filter((s) => s.scheduleDays.some((d) => d.dayOfWeek === selectedDayOfWeek))
      .sort((a, b) => (a.sessionTime || "16:00").localeCompare(b.sessionTime || "16:00"));
  }, [students, selectedDayOfWeek]);

  const nextSession = studentsForDay[0];

  const allStudentsFiltered = useMemo(() => {
    const q = allStudentsSearch.trim().toLowerCase();
    return students.filter((s) => q === "" || s.name.toLowerCase().includes(q));
  }, [students, allStudentsSearch]);

  if (!isLoaded) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">جاري التحميل…</div>;
  }

  return (
    <div dir="rtl" className="min-h-screen relative bg-background overflow-hidden">
      {/* 🌈 Hero background */}
      <div
        className="absolute top-0 left-0 right-0 h-[260px] -z-10
                   bg-gradient-to-br from-primary/25 via-purple-500/10 to-blue-500/20
                   bg-[length:400%_400%] animate-gradient"
      />

      {/* ================= Floating Command Bar ================= */}
      <div className="sticky top-3 z-50 flex justify-center px-3">
        <div
          className="flex items-center gap-1.5 sm:gap-2 px-3 py-2 rounded-2xl
                        bg-background/80 backdrop-blur-xl border border-border shadow-lg"
        >
          <AddStudentDialog
            onAdd={addStudent}
            defaultStart={settings.defaultSemesterStart}
            defaultEnd={settings.defaultSemesterEnd}
            students={students}
            defaultDuration={settings.defaultSessionDuration}
          />

          <Sheet>
            <SheetTrigger asChild>
              <button
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl
                                 bg-accent/40 hover:bg-accent transition text-sm font-medium"
              >
                <Users className="h-4 w-4" />
                جميع الطلاب
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{students.length}</span>
              </button>
            </SheetTrigger>

            <SheetContent side="left" className="w-full sm:max-w-md" dir="rtl">
              <SheetHeader>
                <SheetTitle>جميع الطلاب ({students.length})</SheetTitle>
              </SheetHeader>

              <div className="mt-4">
                <StudentSearchCombobox
                  students={students}
                  value={allStudentsSearch}
                  onChange={setAllStudentsSearch}
                  placeholder="ابحث عن طالب..."
                />
              </div>

              <div className="mt-4 space-y-2 max-h-[70vh] overflow-y-auto">
                {allStudentsFiltered.map((student) => (
                  <div key={student.id} className="p-3 rounded-lg border bg-card">
                    <div className="font-medium">{student.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {student.sessionTime || "—"} •{" "}
                      {student.scheduleDays.map((d) => DAY_NAMES_SHORT_AR[d.dayOfWeek]).join("، ")}
                    </div>
                  </div>
                ))}
              </div>
            </SheetContent>
          </Sheet>

          <div className="w-px h-6 bg-border mx-1" />

          <SemesterSettings settings={settings} onUpdate={updateSettings} />
          <ReminderSettingsDialog />
          <ReminderHistoryDialog />
          <MonthlyReportDialog students={students} payments={payments} settings={settings} />
          <BulkEditSessionsDialog
            students={students}
            onBulkUpdateTime={bulkUpdateSessionTime}
            onUpdateSessionDate={updateSessionDateTime}
            onBulkMarkAsVacation={bulkMarkAsVacation}
          />
          <AddVacationDialog students={students} onBulkMarkAsVacation={bulkMarkAsVacation} />
        </div>
      </div>

      {/* ================= Main ================= */}
      <main className="max-w-4xl mx-auto px-4 pt-8 pb-12 space-y-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-4 bg-background/70 backdrop-blur rounded-xl p-1 shadow">
            <TabsTrigger value="sessions">
              <BookOpen className="h-4 w-4 ml-1" />
              اليوم
            </TabsTrigger>
            <TabsTrigger value="calendar">
              <CalendarDays className="h-4 w-4 ml-1" />
              التقويم
            </TabsTrigger>
            <TabsTrigger value="history">
              <History className="h-4 w-4 ml-1" />
              السجل
            </TabsTrigger>
            <TabsTrigger value="payments">
              <CreditCard className="h-4 w-4 ml-1" />
              المدفوعات
            </TabsTrigger>
          </TabsList>

          {/* ================= TODAY ================= */}
          <TabsContent value="sessions" className="space-y-6">
            {students.length === 0 ? (
              <EmptyState />
            ) : (
              <>
                {/* Hero */}
                <div className="text-center space-y-1">
                  <p className="text-sm text-muted-foreground">⚡ اليوم</p>
                  <h1 className="text-4xl font-heading font-bold">{studentsForDay.length} حصص</h1>
                  <p className="text-sm text-muted-foreground">{DAY_NAMES_AR[selectedDayOfWeek]}</p>
                </div>

                {/* Status Strip */}
                {nextSession && (
                  <div className="flex justify-center">
                    <div
                      className="flex items-center gap-4 px-4 py-2 rounded-xl
                                    bg-background/70 backdrop-blur border shadow-sm text-sm"
                    >
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {nextSession.sessionTime}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        {nextSession.name}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {nextSession.sessionType === "online" ? "أونلاين" : "حضوري"}
                      </span>
                    </div>
                  </div>
                )}

                {/* Sessions Section */}
                <section className="space-y-3">
                  <h3 className="text-sm font-medium text-muted-foreground text-center">حصص اليوم</h3>

                  {studentsForDay.length === 0 ? (
                    <p className="text-center text-muted-foreground">لا توجد حصص اليوم</p>
                  ) : (
                    <div className="grid gap-4">
                      {studentsForDay.map((student) => (
                        <StudentCard
                          key={student.id}
                          student={student}
                          students={students}
                          settings={settings}
                          selectedDayOfWeek={selectedDayOfWeek}
                          onRemove={() => {}}
                          onUpdateName={() => {}}
                          onUpdateTime={() => {}}
                          onUpdatePhone={() => {}}
                          onUpdateSessionType={() => {}}
                          onUpdateSchedule={() => {}}
                          onUpdateDuration={() => {}}
                          onUpdateCustomSettings={() => {}}
                        />
                      ))}
                    </div>
                  )}
                </section>

                {/* Day selector */}
                <div className="pt-4 text-center space-y-2">
                  <p className="text-xs text-muted-foreground">يوم آخر؟</p>
                  <div className="flex justify-center gap-1 flex-wrap">
                    {DAY_NAMES_SHORT_AR.map((day, i) => (
                      <button
                        key={i}
                        onClick={() => setSelectedDayOfWeek(i)}
                        className={cn(
                          "px-3 py-2 rounded-lg text-sm transition",
                          selectedDayOfWeek === i
                            ? "bg-primary text-primary-foreground"
                            : "bg-background/70 hover:bg-accent",
                        )}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="calendar">
            <CalendarView students={students} onRescheduleSession={rescheduleSession} />
          </TabsContent>

          <TabsContent value="history">
            <SessionHistoryBar
              students={students}
              onCancelSession={() => {}}
              onDeleteSession={() => {}}
              onRestoreSession={() => {}}
              onToggleComplete={() => {}}
              onRescheduleSession={rescheduleSession}
              onAddSession={() => {}}
              onMarkAsVacation={() => {}}
              onUpdateSessionDetails={updateSessionDetails}
              getCancellationCount={getCancellationCount}
              getAllStudentCancellations={getAllStudentCancellations}
              onClearMonthCancellations={clearMonthCancellations}
            />
          </TabsContent>

          <TabsContent value="payments" className="space-y-4">
            <StatsBar
              students={students}
              payments={payments}
              selectedMonth={now.getMonth()}
              selectedYear={now.getFullYear()}
            />
            <PaymentsDashboard
              students={students}
              payments={payments}
              selectedMonth={now.getMonth()}
              selectedYear={now.getFullYear()}
              onTogglePayment={togglePaymentStatus}
              settings={settings}
            />
          </TabsContent>
        </Tabs>

        <EndOfMonthReminder students={students} payments={payments} onTogglePayment={togglePaymentStatus} />
      </main>
    </div>
  );
};

export default Index;
