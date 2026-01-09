import { useState, useMemo } from "react";
import { BookOpen, CalendarDays, History, CreditCard } from "lucide-react";

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

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { DAY_NAMES_AR, DAY_NAMES_SHORT_AR } from "@/lib/arabicConstants";
import { cn } from "@/lib/utils";

const Index = () => {
  const now = new Date();
  const today = now.getDay();

  const [activeTab, setActiveTab] = useState("sessions");
  const [selectedDayOfWeek, setSelectedDayOfWeek] = useState(today);

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

  if (!isLoaded) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">جاري التحميل…</div>;
  }

  return (
    <div dir="rtl" className="min-h-screen relative bg-background overflow-hidden">
      {/* 🌈 Animated Hero Background */}
      <div
        className="absolute top-0 left-0 right-0 h-[280px] -z-10
                      bg-gradient-to-br from-primary/25 via-purple-500/10 to-blue-500/20
                      bg-[length:400%_400%] animate-gradient"
      />

      {/* ================= Floating Command Bar ================= */}
      <div className="sticky top-3 z-50 flex justify-center px-3">
        <div
          className="flex items-center gap-1.5 sm:gap-2 px-3 py-2 rounded-2xl
                        bg-background/80 backdrop-blur-xl border border-border
                        shadow-lg"
        >
          <AddStudentDialog
            onAdd={addStudent}
            defaultStart={settings.defaultSemesterStart}
            defaultEnd={settings.defaultSemesterEnd}
            students={students}
            defaultDuration={settings.defaultSessionDuration}
          />

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

      {/* ================= Main Content ================= */}
      <main className="max-w-4xl mx-auto px-4 pt-10 pb-12 space-y-10">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          {/* ===== Tabs ===== */}
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
          <TabsContent value="sessions" className="space-y-8">
            {students.length === 0 ? (
              <EmptyState />
            ) : (
              <>
                {/* ⚡ Hero */}
                <div className="text-center space-y-1 animate-in fade-in slide-in-from-top-4 duration-300">
                  <p className="text-sm text-muted-foreground">⚡ اليوم</p>
                  <h1 className="text-4xl font-heading font-bold">{studentsForDay.length} حصص</h1>
                  <p className="text-sm text-muted-foreground">{DAY_NAMES_AR[selectedDayOfWeek]} • لنبدأ</p>
                </div>

                {/* 🎴 Sessions */}
                {studentsForDay.length === 0 ? (
                  <p className="text-center text-muted-foreground">لا توجد حصص اليوم</p>
                ) : (
                  <div className="grid gap-4 animate-in fade-in slide-in-from-bottom-3 duration-300">
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

                {/* 🗓 Day Selector */}
                <div className="pt-6 text-center space-y-2">
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
                            : "bg-background/70 backdrop-blur hover:bg-accent",
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

          {/* ================= CALENDAR ================= */}
          <TabsContent value="calendar">
            <CalendarView students={students} onRescheduleSession={rescheduleSession} />
          </TabsContent>

          {/* ================= HISTORY ================= */}
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

          {/* ================= PAYMENTS ================= */}
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
