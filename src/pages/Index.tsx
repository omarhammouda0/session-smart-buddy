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

  const [selectedDayOfWeek, setSelectedDayOfWeek] = useState(now.getDay());
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

  /* =========================
     Helpers (UNCHANGED)
  ========================== */

  const getStudentsForDay = () =>
    students.filter((student) => student.scheduleDays.some((d) => d.dayOfWeek === selectedDayOfWeek));

  const studentsForDay = getStudentsForDay();

  const filteredStudents = studentsForDay
    .filter((s) => studentFilter === "all" || s.id === studentFilter)
    .sort((a, b) => {
      const timeA = a.sessionTime || "16:00";
      const timeB = b.sessionTime || "16:00";
      return timeA.localeCompare(timeB);
    });

  const weekDays = Array.from({ length: 7 }).map((_, i) => {
    const studentsOnDay = students.filter((student) => student.scheduleDays.some((d) => d.dayOfWeek === i));

    return {
      dayOfWeek: i,
      dayName: DAY_NAMES_SHORT_AR[i],
      isToday: now.getDay() === i,
      studentCount: studentsOnDay.length,
    };
  });

  const goToPrevDay = () => setSelectedDayOfWeek((prev) => (prev === 0 ? 6 : prev - 1));

  const goToNextDay = () => setSelectedDayOfWeek((prev) => (prev === 6 ? 0 : prev + 1));

  const goToToday = () => setSelectedDayOfWeek(now.getDay());

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="text-muted-foreground animate-pulse">جاري التحميل...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* ================= HEADER ================= */}
      <header className="sticky top-0 z-10 border-b bg-card/90 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-heading font-bold text-lg">متابعة الطلاب</h1>
              <p className="text-xs text-muted-foreground">إدارة الحصص والمدفوعات</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end">
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
      </header>

      {/* ================= MAIN ================= */}
      <main className="max-w-4xl mx-auto px-4 py-4 space-y-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-4 rounded-xl bg-muted p-1">
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
                {/* Context header */}
                <div className="text-center">
                  <h2 className="font-heading font-bold text-xl">حصص يوم {DAY_NAMES_AR[selectedDayOfWeek]}</h2>
                  <p className="text-sm text-muted-foreground">{filteredStudents.length} طلاب مجدولين</p>
                </div>

                {/* Day navigation */}
                <div className="flex items-center justify-center gap-2">
                  <Button variant="ghost" size="icon" onClick={goToNextDay}>
                    <ChevronRight />
                  </Button>

                  <div className="flex gap-1 overflow-x-auto">
                    {weekDays.map((day) => (
                      <button
                        key={day.dayOfWeek}
                        onClick={() => {
                          setSelectedDayOfWeek(day.dayOfWeek);
                          setStudentFilter("all");
                        }}
                        className={cn(
                          "px-3 py-2 rounded-lg text-sm transition",
                          selectedDayOfWeek === day.dayOfWeek
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted hover:bg-accent",
                        )}
                      >
                        {day.dayName}
                        {day.studentCount > 0 && (
                          <span className="block text-[10px] opacity-80">{day.studentCount}</span>
                        )}
                      </button>
                    ))}
                  </div>

                  <Button variant="ghost" size="icon" onClick={goToPrevDay}>
                    <ChevronLeft />
                  </Button>

                  {selectedDayOfWeek !== now.getDay() && (
                    <Button variant="outline" size="sm" onClick={goToToday}>
                      اليوم
                    </Button>
                  )}
                </div>

                {/* Filters */}
                <div className="bg-card rounded-xl border p-3 flex items-center gap-2">
                  <Select value={studentFilter} onValueChange={(value) => setStudentFilter(value)}>
                    <SelectTrigger className="w-full">
                      <Users className="h-4 w-4 ml-2" />
                      <SelectValue placeholder="جميع الطلاب" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">جميع الطلاب</SelectItem>
                      {students.map((student) => (
                        <SelectItem key={student.id} value={student.id}>
                          {student.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {studentFilter !== "all" && (
                    <Button variant="ghost" size="icon" onClick={() => setStudentFilter("all")}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {/* Student list */}
                {filteredStudents.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">لا توجد حصص مجدولة لهذا اليوم</div>
                ) : (
                  <div className="grid gap-3">
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
