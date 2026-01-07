import { useState } from 'react';
import { GraduationCap, BookOpen, CreditCard } from 'lucide-react';
import { useStudents } from '@/hooks/useStudents';
import { AddStudentDialog } from '@/components/AddStudentDialog';
import { SemesterSettings } from '@/components/SemesterSettings';
import { MonthSelector } from '@/components/MonthSelector';
import { StudentCard } from '@/components/StudentCard';
import { PaymentsDashboard } from '@/components/PaymentsDashboard';
import { EmptyState } from '@/components/EmptyState';
import { StatsBar } from '@/components/StatsBar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DAY_NAMES_SHORT } from '@/types/student';
import { cn } from '@/lib/utils';

const Index = () => {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [activeTab, setActiveTab] = useState('sessions');
  const [selectedDay, setSelectedDay] = useState<number>(now.getDay()); // Default to today's day

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
    updateStudentSchedule,
    addExtraSession,
    removeSession,
    toggleSessionComplete,
    togglePaymentStatus,
  } = useStudents();

  // Filter students by selected day of week
  const studentsForDay = students.filter(student =>
    student.scheduleDays.some(d => d.dayOfWeek === selectedDay)
  );

  // Get days that have students scheduled
  const daysWithStudents = DAY_NAMES_SHORT.map((_, index) => ({
    day: index,
    count: students.filter(s => s.scheduleDays.some(d => d.dayOfWeek === index)).length,
  })).filter(d => d.count > 0);

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center">
                <GraduationCap className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="font-heading font-bold text-lg leading-tight">Student Tracker</h1>
                <p className="text-xs text-muted-foreground">Sessions & Payments</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <SemesterSettings settings={settings} onUpdate={updateSettings} />
              <AddStudentDialog
                onAdd={addStudent}
                defaultStart={settings.defaultSemesterStart}
                defaultEnd={settings.defaultSemesterEnd}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-4 space-y-4">
        {/* Month Selector */}
        <div className="flex justify-center">
          <MonthSelector
            month={selectedMonth}
            year={selectedYear}
            onChange={(m, y) => {
              setSelectedMonth(m);
              setSelectedYear(y);
            }}
          />
        </div>

        {/* Stats */}
        {students.length > 0 && (
          <StatsBar
            students={students}
            payments={payments}
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
          />
        )}

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full grid grid-cols-2 mb-4">
            <TabsTrigger value="sessions" className="gap-2">
              <BookOpen className="h-4 w-4" />
              Sessions
            </TabsTrigger>
            <TabsTrigger value="payments" className="gap-2">
              <CreditCard className="h-4 w-4" />
              Payments
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sessions" className="mt-0 space-y-4">
            {students.length === 0 ? (
              <EmptyState />
            ) : (
              <>
                {/* Day Filter Bar */}
                <div className="flex flex-wrap gap-2 justify-center">
                  {DAY_NAMES_SHORT.map((day, index) => {
                    const dayData = daysWithStudents.find(d => d.day === index);
                    const hasStudents = dayData && dayData.count > 0;
                    const isToday = index === now.getDay();
                    
                    return (
                      <button
                        key={day}
                        onClick={() => setSelectedDay(index)}
                        disabled={!hasStudents}
                        className={cn(
                          "px-4 py-2 rounded-lg font-medium text-sm transition-all relative",
                          selectedDay === index
                            ? "bg-primary text-primary-foreground shadow-md"
                            : hasStudents
                              ? "bg-card border border-border hover:border-primary/50 hover:bg-muted/50"
                              : "bg-muted/30 text-muted-foreground/50 cursor-not-allowed",
                          isToday && selectedDay !== index && hasStudents && "ring-2 ring-primary/30"
                        )}
                      >
                        {day}
                        {hasStudents && (
                          <span className={cn(
                            "ml-1.5 text-xs px-1.5 py-0.5 rounded-full",
                            selectedDay === index
                              ? "bg-primary-foreground/20 text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                          )}>
                            {dayData.count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Students for selected day */}
                {studentsForDay.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No students scheduled for {DAY_NAMES_SHORT[selectedDay]}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {studentsForDay.map(student => (
                      <StudentCard
                        key={student.id}
                        student={student}
                        selectedMonth={selectedMonth}
                        selectedYear={selectedYear}
                        onRemove={() => removeStudent(student.id)}
                        onUpdateName={(name) => updateStudentName(student.id, name)}
                        onUpdateTime={(time) => updateStudentTime(student.id, time)}
                        onUpdateSchedule={(days, start, end) => updateStudentSchedule(student.id, days, start, end)}
                        onAddSession={(date) => addExtraSession(student.id, date)}
                        onRemoveSession={(sessionId) => removeSession(student.id, sessionId)}
                        onToggleSession={(sessionId) => toggleSessionComplete(student.id, sessionId)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="payments" className="mt-0">
            <PaymentsDashboard
              students={students}
              payments={payments}
              selectedMonth={selectedMonth}
              selectedYear={selectedYear}
              onTogglePayment={togglePaymentStatus}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Index;
