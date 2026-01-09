import { useMemo, useState } from "react";
import { GraduationCap, Users, CalendarDays, History, CreditCard, Sparkles, Plus, Clock } from "lucide-react";

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
import { AddStudentDialog } from "@/components/AddStudentDialog";
import { StudentSearchCombobox } from "@/components/StudentSearchCombobox";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

import { DAY_NAMES_AR, DAY_NAMES_SHORT_AR } from "@/lib/arabicConstants";
import { cn } from "@/lib/utils";

export default function Index() {
  const now = new Date();
  const today = now.getDay();

  const [activeTab, setActiveTab] = useState("sessions");
  const [selectedDay, setSelectedDay] = useState(today);
  const [studentsSearch, setStudentsSearch] = useState("");

  const {
    students,
    payments,
    settings,
    isLoaded,
    addStudent,
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

  const nextSession = studentsForDay[0];

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

          <p className="text-muted-foreground">{DAY_NAMES_AR[selectedDay]} · خلّينا نبدأ اليوم 👋</p>
        </div>
      </section>

      {/* 🧭 TODAY ACTIONS BAR */}
      <div className="max-w-4xl mx-auto px-4 -mt-6 relative z-10">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-2xl bg-background/70 backdrop-blur border shadow-lg">
          {/* Add Student */}
          <AddStudentDialog
            onAdd={addStudent}
            defaultStart={settings.defaultSemesterStart}
            defaultEnd={settings.defaultSemesterEnd}
            students={students}
            defaultDuration={settings.defaultSessionDuration}
          >
            <Button variant="ghost" className="h-14 flex-col gap-1">
              <Plus className="h-5 w-5 text-primary" />
              <span className="text-xs">إضافة طالب</span>
            </Button>
          </AddStudentDialog>

          {/* All Students */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" className="h-14 flex-col gap-1">
                <Users className="h-5 w-5 text-primary" />
                <span className="text-xs">جميع الطلاب ({students.length})</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left">
              <SheetHeader>
                <SheetTitle>جميع الطلاب</SheetTitle>
              </SheetHeader>
              <div className="mt-4">
                <StudentSearchCombobox
                  students={students}
                  value={studentsSearch}
                  onChange={setStudentsSearch}
                  placeholder="ابحث عن طالب..."
                />
              </div>
            </SheetContent>
          </Sheet>

          {/* Go to Calendar */}
          <Button variant="ghost" className="h-14 flex-col gap-1" onClick={() => setActiveTab("calendar")}>
            <CalendarDays className="h-5 w-5 text-primary" />
            <span className="text-xs">التقويم</span>
          </Button>

          {/* Next Session */}
          <div className="h-14 flex flex-col items-center justify-center gap-1 rounded-xl bg-primary/5">
            <Clock className="h-4 w-4 text-primary" />
            <span className="text-xs text-muted-foreground">
              {nextSession ? `أقرب حصة ${nextSession.sessionTime}` : "لا توجد حصص"}
            </span>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <main className="max-w-4xl mx-auto px-4 pb-10 mt-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-4 rounded-2xl bg-muted/50 p-1">
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

          {/* TODAY SESSIONS */}
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

          <TabsContent value="calendar">
            <CalendarView students={students} onRescheduleSession={rescheduleSession} />
          </TabsContent>

          <TabsContent value="history">
            <SessionHistoryBar students={students} />
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
}
