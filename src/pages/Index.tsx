import { useMemo, useState } from "react";
import { GraduationCap, Users, CalendarDays, History, CreditCard, Sparkles } from "lucide-react";
import { useStudents } from "@/hooks/useStudents";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { StudentCard } from "@/components/StudentCard";
import { EmptyState } from "@/components/EmptyState";
import { CalendarView } from "@/components/CalendarView";
import { SessionHistoryBar } from "@/components/SessionHistoryBar";
import { PaymentsDashboard } from "@/components/PaymentsDashboard";
import { StatsBar } from "@/components/StatsBar";
import { EndOfMonthReminder } from "@/components/EndOfMonthReminder";
import { DAY_NAMES_AR, DAY_NAMES_SHORT_AR } from "@/lib/arabicConstants";
import { cn } from "@/lib/utils";

export default function Index() {
  const now = new Date();
  const today = now.getDay();

  const [activeTab, setActiveTab] = useState("sessions");
  const [selectedDay, setSelectedDay] = useState(today);

  const {
    students,
    payments,
    settings,
    isLoaded,
    removeStudent,
    updateStudentName,
    updateStudentTime,
    updateStudentPhone,
    updateStudentSessionType,
    updateStudentSchedule,
    updateStudentDuration,
    updateStudentCustomSettings,
    togglePaymentStatus,
    rescheduleSession,
  } = useStudents();

  const studentsForDay = useMemo(() => {
    return students
      .filter((s) => s.scheduleDays.some((d) => d.dayOfWeek === selectedDay))
      .sort((a, b) => (a.sessionTime || "").localeCompare(b.sessionTime || ""));
  }, [students, selectedDay]);

  if (!isLoaded) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">جاري التحميل...</div>;
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* 🌈 Animated Hero */}
      <section className="relative overflow-hidden rounded-b-3xl">
        <div
          className="absolute inset-0 bg-gradient-to-br from-primary/20 via-emerald-200/30 to-sky-200/30 blur-2xl"
          style={{
            backgroundSize: "200% 200%",
            animation: "floatGradient 18s ease infinite",
          }}
        />
        <div className="relative px-6 py-10 text-center">
          <div className="inline-flex items-center gap-2 text-sm text-primary mb-2">
            <Sparkles className="h-4 w-4" />
            اليوم
          </div>

          <h1 className="text-4xl font-heading font-bold mb-1">{studentsForDay.length} حصة</h1>

          <p className="text-muted-foreground">{DAY_NAMES_AR[selectedDay]} · خلينا نبدأ اليوم 👋</p>
        </div>
      </section>

      {/* Tabs */}
      <main className="max-w-4xl mx-auto px-4 pb-10">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-4 rounded-2xl bg-muted/50 p-1 mt-6">
            <TabsTrigger value="sessions">
              <GraduationCap className="h-4 w-4 ml-1" />
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

          {/* 🧑‍🎓 Today Sessions */}
          <TabsContent value="sessions" className="mt-6">
            {studentsForDay.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                {studentsForDay.map((student) => (
                  <StudentCard
                    key={student.id}
                    student={student}
                    students={students}
                    settings={settings}
                    selectedDayOfWeek={selectedDay}
                    onRemove={() => removeStudent(student.id)}
                    onUpdateName={(v) => updateStudentName(student.id, v)}
                    onUpdateTime={(v) => updateStudentTime(student.id, v)}
                    onUpdatePhone={(v) => updateStudentPhone(student.id, v)}
                    onUpdateSessionType={(v) => updateStudentSessionType(student.id, v)}
                    onUpdateSchedule={(d, s, e) => updateStudentSchedule(student.id, d, s, e)}
                    onUpdateDuration={(v) => updateStudentDuration(student.id, v)}
                    onUpdateCustomSettings={(v) => updateStudentCustomSettings(student.id, v)}
                  />
                ))}
              </div>
            )}

            {/* Day Switch */}
            <div className="flex justify-center gap-2 mt-10 text-sm">
              {DAY_NAMES_SHORT_AR.map((day, i) => (
                <Button
                  key={i}
                  size="sm"
                  variant={i === selectedDay ? "default" : "ghost"}
                  className={cn("rounded-xl", i === selectedDay && "shadow-md")}
                  onClick={() => setSelectedDay(i)}
                >
                  {day}
                </Button>
              ))}
            </div>
          </TabsContent>

          {/* 📅 Calendar */}
          <TabsContent value="calendar">
            <CalendarView students={students} onRescheduleSession={rescheduleSession} />
          </TabsContent>

          {/* 🕘 History */}
          <TabsContent value="history">
            <SessionHistoryBar students={students} />
          </TabsContent>

          {/* 💳 Payments */}
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
}
