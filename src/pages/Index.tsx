import { useState, useMemo } from "react";
import {
  GraduationCap,
  BookOpen,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  Users,
  X,
  History,
  CalendarDays,
} from "lucide-react";
import { format, parseISO } from "date-fns";

import { useStudents } from "@/hooks/useStudents";
import { useCancellationTracking } from "@/hooks/useCancellationTracking";
import { useConflictDetection, ConflictResult } from "@/hooks/useConflictDetection";

import { AddStudentDialog } from "@/components/AddStudentDialog";
import { SemesterSettings } from "@/components/SemesterSettings";
import { StudentCard } from "@/components/StudentCard";
import { PaymentsDashboard } from "@/components/PaymentsDashboard";
import { EmptyState } from "@/components/EmptyState";
import { StatsBar } from "@/components/StatsBar";
import { EndOfMonthReminder } from "@/components/EndOfMonthReminder";
import { SessionHistoryBar } from "@/components/SessionHistoryBar";
import { BulkEditSessionsDialog } from "@/components/BulkEditSessionsDialog";
import { AddVacationDialog } from "@/components/AddVacationDialog";
import { RestoreConflictDialog } from "@/components/RestoreConflictDialog";
import { ReminderSettingsDialog } from "@/components/ReminderSettingsDialog";
import { ReminderHistoryDialog } from "@/components/ReminderHistoryDialog";
import { MonthlyReportDialog } from "@/components/MonthlyReportDialog";
import { CalendarView } from "@/components/CalendarView";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { DAY_NAMES_AR, DAY_NAMES_SHORT_AR, formatShortDateAr } from "@/lib/arabicConstants";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

const Index = () => {
  const now = new Date();

  const [activeTab, setActiveTab] = useState("sessions");
  const [selectedDayOfWeek, setSelectedDayOfWeek] = useState(now.getDay());
  const [studentFilter, setStudentFilter] = useState("all");

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
    updateStudentSessionType,
    updateStudentSchedule,
    updateStudentDuration,
    updateStudentCustomSettings,
    addExtraSession,
    removeSession,
    deleteSession,
    restoreSession,
    rescheduleSession,
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

  const studentsForDay = students
    .filter((s) => s.scheduleDays.some((d) => d.dayOfWeek === selectedDayOfWeek))
    .filter((s) => studentFilter === "all" || s.id === studentFilter)
    .sort((a, b) => (a.sessionTime || "16:00").localeCompare(b.sessionTime || "16:00"));

  const weekDays = Array.from({ length: 7 }).map((_, i) => ({
    dayOfWeek: i,
    dayName: DAY_NAMES_SHORT_AR[i],
    studentCount: students.filter((s) => s.scheduleDays.some((d) => d.dayOfWeek === i)).length,
  }));

  if (!isLoaded) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">جاري التحميل...</div>;
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* ================= HEADER ================= */}
      <header className="sticky top-0 z-10 bg-card border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-bold">متابعة الطلاب</h1>
              <p className="text-xs text-muted-foreground">إدارة الحصص والمدفوعات</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <AddVacationDialog students={students} onBulkMarkAsVacation={bulkMarkAsVacation} />
            <BulkEditSessionsDialog
              students={students}
              onBulkUpdateTime={bulkUpdateSessionTime}
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
      </header>

      {/* ================= MAIN ================= */}
      <main className="max-w-4xl mx-auto px-4 py-4 space-y-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-4 bg-muted rounded-xl p-1">
            <TabsTrigger value="sessions">
              <BookOpen className="h-4 w-4 ml-1" />
              الحصص
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

          {/* ================= SESSIONS TAB ================= */}
          <TabsContent value="sessions" className="space-y-4">
            {students.length === 0 ? (
              <EmptyState />
            ) : (
              <>
                {/* Title + Summary */}
                <div className="text-center space-y-1">
                  <h2 className="font-bold text-xl">حصص يوم {DAY_NAMES_AR[selectedDayOfWeek]}</h2>
                  <p className="text-xs text-muted-foreground">
                    👤 {studentsForDay.length} طالب • ⏱️ {studentsForDay.length} حصة
                  </p>
                </div>

                {/* Day selector */}
                <div className="flex justify-center gap-1 overflow-x-auto">
                  {weekDays.map((day) => (
                    <button
                      key={day.dayOfWeek}
                      onClick={() => {
                        setSelectedDayOfWeek(day.dayOfWeek);
                        setStudentFilter("all");
                      }}
                      className={cn(
                        "px-3 py-2 rounded-lg text-sm",
                        selectedDayOfWeek === day.dayOfWeek
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted hover:bg-accent",
                      )}
                    >
                      {day.dayName}
                      {day.studentCount > 0 && <div className="text-[10px] opacity-70">{day.studentCount}</div>}
                    </button>
                  ))}
                </div>

                {/* Filter + List */}
                <div className="bg-card border rounded-xl p-3 space-y-3">
                  <Select value={studentFilter} onValueChange={setStudentFilter}>
                    <SelectTrigger>
                      <Users className="h-4 w-4 ml-2" />
                      <SelectValue placeholder="جميع الطلاب" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">جميع الطلاب</SelectItem>
                      {students.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {studentsForDay.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">لا توجد حصص لهذا اليوم</div>
                  ) : (
                    <div className="grid gap-3">
                      {studentsForDay.map((student) => (
                        <StudentCard
                          key={student.id}
                          student={student}
                          students={students}
                          settings={settings}
                          selectedDayOfWeek={selectedDayOfWeek}
                          onRemove={() => removeStudent(student.id)}
                          onUpdateName={(n) => updateStudentName(student.id, n)}
                          onUpdateTime={(t) => updateStudentTime(student.id, t)}
                          onUpdatePhone={(p) => updateStudentPhone(student.id, p)}
                          onUpdateSessionType={(t) => updateStudentSessionType(student.id, t)}
                          onUpdateSchedule={(d, s, e) => updateStudentSchedule(student.id, d, s, e)}
                          onUpdateDuration={(d) => updateStudentDuration(student.id, d)}
                          onUpdateCustomSettings={(s) => updateStudentCustomSettings(student.id, s)}
                        />
                      ))}
                    </div>
                  )}
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

      {addConflictDialog && (
        <RestoreConflictDialog
          open={addConflictDialog.open}
          onOpenChange={(open) => !open && setAddConflictDialog(null)}
          conflictResult={addConflictDialog.conflictResult}
          sessionInfo={addConflictDialog.sessionInfo}
        />
      )}
    </div>
  );
};

export default Index;
