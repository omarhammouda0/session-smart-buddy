import { useState } from "react";
import { BookOpen, CreditCard, History, CalendarDays, Users } from "lucide-react";

import { useStudents } from "@/hooks/useStudents";
import { useCancellationTracking } from "@/hooks/useCancellationTracking";

import { StudentCard } from "@/components/StudentCard";
import { EmptyState } from "@/components/EmptyState";
import { CalendarView } from "@/components/CalendarView";
import { SessionHistoryBar } from "@/components/SessionHistoryBar";
import { PaymentsDashboard } from "@/components/PaymentsDashboard";
import { StatsBar } from "@/components/StatsBar";
import { EndOfMonthReminder } from "@/components/EndOfMonthReminder";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { DAY_NAMES_AR, DAY_NAMES_SHORT_AR } from "@/lib/arabicConstants";
import { cn } from "@/lib/utils";

const Index = () => {
  const now = new Date();
  const today = now.getDay();

  const [activeTab, setActiveTab] = useState("sessions");
  const [selectedDayOfWeek, setSelectedDayOfWeek] = useState(today);
  const [studentFilter, setStudentFilter] = useState("all");

  const { students, payments, settings, isLoaded, rescheduleSession, togglePaymentStatus, updateSessionDetails } =
    useStudents();

  const { getCancellationCount, getAllStudentCancellations, clearMonthCancellations } =
    useCancellationTracking(students);

  if (!isLoaded) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }

  const studentsForDay = students
    .filter((s) => s.scheduleDays.some((d) => d.dayOfWeek === selectedDayOfWeek))
    .filter((s) => studentFilter === "all" || s.id === studentFilter)
    .sort((a, b) => (a.sessionTime || "16:00").localeCompare(b.sessionTime || "16:00"));

  const weekDays = Array.from({ length: 7 }).map((_, i) => ({
    day: i,
    label: DAY_NAMES_SHORT_AR[i],
  }));

  return (
    <div dir="rtl" className="min-h-screen relative overflow-hidden bg-background">
      {/* 🌈 Animated gradient background */}
      <div className="absolute inset-0 -z-10 bg-[length:400%_400%] animate-gradient bg-gradient-to-br from-primary/20 via-purple-500/10 to-blue-500/20" />

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-4 bg-background/60 backdrop-blur rounded-xl p-1">
            <TabsTrigger value="sessions">
              <BookOpen className="h-4 w-4 ml-1" /> اليوم
            </TabsTrigger>
            <TabsTrigger value="calendar">
              <CalendarDays className="h-4 w-4 ml-1" /> التقويم
            </TabsTrigger>
            <TabsTrigger value="history">
              <History className="h-4 w-4 ml-1" /> السجل
            </TabsTrigger>
            <TabsTrigger value="payments">
              <CreditCard className="h-4 w-4 ml-1" /> المدفوعات
            </TabsTrigger>
          </TabsList>

          {/* ================= TODAY ================= */}
          <TabsContent value="sessions" className="space-y-8">
            {students.length === 0 ? (
              <EmptyState />
            ) : (
              <>
                {/* ⚡ HERO */}
                <div className="text-center space-y-2 animate-in fade-in slide-in-from-top-4 duration-300">
                  <p className="text-sm text-muted-foreground">⚡ اليوم</p>
                  <h1 className="text-4xl font-heading font-bold">{studentsForDay.length} حصص</h1>
                  <p className="text-sm text-muted-foreground">{DAY_NAMES_AR[selectedDayOfWeek]} • لنبدأ</p>
                </div>

                {/* 🎴 CARDS */}
                <div
                  key={selectedDayOfWeek}
                  className="grid gap-4 animate-in fade-in slide-in-from-bottom-3 duration-300"
                >
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

                {/* 🗓 OTHER DAYS */}
                <div className="pt-6 text-center space-y-2">
                  <p className="text-xs text-muted-foreground">يوم آخر؟</p>
                  <div className="flex justify-center gap-1">
                    {weekDays.map((d) => (
                      <button
                        key={d.day}
                        onClick={() => setSelectedDayOfWeek(d.day)}
                        className={cn(
                          "px-3 py-2 rounded-lg text-sm transition",
                          selectedDayOfWeek === d.day
                            ? "bg-primary text-primary-foreground"
                            : "bg-background/60 backdrop-blur hover:bg-accent",
                        )}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </TabsContent>

          {/* ================= OTHER TABS ================= */}
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
