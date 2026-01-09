import { useState, useMemo } from "react";
import {
  BookOpen,
  CalendarDays,
  History,
  CreditCard,
  Users,
} from "lucide-react";

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

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

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

  const {
    getCancellationCount,
    getAllStudentCancellations,
    clearMonthCancellations,
  } = useCancellationTracking(students);

  const studentsForDay = useMemo(() => {
    return students
      .filter((s) =>
        s.scheduleDays.some((d) => d.dayOfWeek === selectedDayOfWeek)
      )
      .sort((a, b) =>
        (a.sessionTime || "16:00").localeCompare(b.sessionTime || "16:00")
      );
  }, [students, selectedDayOfWeek]);

  const allStudentsFiltered = useMemo(() => {
    const q = allStudentsSearch.trim().toLowerCase();
    return students.filter(
      (s) => q === "" || s.name.toLowerCase().includes(q)
    );
  }, [students, allStudentsSearch]);

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        جاري التحميل…
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen relative bg-background overflow-hidden">
      {/* 🌈 Animated hero background */}
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
          {/* ➕ Add Student */}
          <AddStudentDialog
            onAdd={addStudent}
            defaultStart={settings.defaultSemesterStart}
            defaultEnd={settings.defaultSemesterEnd}
            students={students}
            defaultDuration={settings.defaultSessionDuration}
          />

          {/* 👥 All Students */}
          <Sheet>
            <SheetTrigger asChild>
              <button
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl
                           bg-accent/40 hover:bg-accent transition
                           text-sm font-medium"
              >
                <Users className="h-4 w-4" />
                جميع الطلاب
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                  {students.length}
                </span>
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
                  <div
                    key={student.id}
                    className="p-3 rounded-lg border bg-card"
                  >
                    <div className="font-medium">{student.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {student.sessionTime || "—"} •{" "}
                      {student.scheduleDays
                        .map((d) => DAY_NAMES_SHORT_AR[d.dayOfWeek])
                        .join("، ")}
                    </div>
                  </div>
                ))}
              </div>
            </SheetContent>
          </Sheet>

          <div className="w-px h-6 bg-border mx-1" />

          {/* Secondary actions */}
          <SemesterSettings settings={settings} onUpdate={updateSettings} />
          <ReminderSettingsDialog />
          <ReminderHistoryDialog />
          <MonthlyReportDialog
            students={students}
            payments={payments}
            settings={settings}
          />
          <BulkEditSessionsDialog
            students={students}
            onBulkUpdateTime={bulkUpdateSessionTime}
            onUpdateSessionDate={updateSessionDateTime}
            onBulkMarkAsVacation={bulkMarkAsVacation}
          />
          <AddVacationDialog
            students={students}
            onBulkMarkAsVacation={bulkMarkAsVacation}
          />
        </div>
      </div>

      {/* ================= Main Content ================= */}
      <main className="max-w-4xl mx-auto px-4 pt-10 pb-12 space-y-10">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
