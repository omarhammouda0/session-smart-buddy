import { useState } from 'react';
import { GraduationCap, BookOpen, CreditCard, ChevronLeft, ChevronRight, Users, X } from 'lucide-react';
import { format, addDays, parseISO, isToday } from 'date-fns';
import { useStudents } from '@/hooks/useStudents';
import { AddStudentDialog } from '@/components/AddStudentDialog';
import { SemesterSettings } from '@/components/SemesterSettings';
import { StudentCard } from '@/components/StudentCard';
import { PaymentsDashboard } from '@/components/PaymentsDashboard';
import { EmptyState } from '@/components/EmptyState';
import { StatsBar } from '@/components/StatsBar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DAY_NAMES_SHORT } from '@/types/student';
import { cn } from '@/lib/utils';

const Index = () => {
  const now = new Date();
  const [selectedDate, setSelectedDate] = useState(format(now, 'yyyy-MM-dd'));
  const [activeTab, setActiveTab] = useState('sessions');
  const [studentFilter, setStudentFilter] = useState<string>('all');

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

  const selectedDateObj = parseISO(selectedDate);
  const selectedDayOfWeek = selectedDateObj.getDay();
  const selectedMonth = selectedDateObj.getMonth();
  const selectedYear = selectedDateObj.getFullYear();

  // Get students who have a session on the selected date
  const getStudentsForDate = () => {
    return students.filter(student => {
      // Check if student has a session on this exact date
      const hasSessionOnDate = student.sessions.some(s => s.date === selectedDate);
      // Or if their schedule includes this day of week and the date is within their semester
      const isInSchedule = student.scheduleDays.some(d => d.dayOfWeek === selectedDayOfWeek) &&
        selectedDate >= student.semesterStart && selectedDate <= student.semesterEnd;
      
      return hasSessionOnDate || isInSchedule;
    });
  };

  const studentsForDate = getStudentsForDate();

  // Filter by selected student
  const filteredStudents = studentFilter === 'all' 
    ? studentsForDate 
    : studentsForDate.filter(s => s.id === studentFilter);

  // Navigation functions
  const goToPrevDay = () => {
    setSelectedDate(format(addDays(selectedDateObj, -1), 'yyyy-MM-dd'));
  };

  const goToNextDay = () => {
    setSelectedDate(format(addDays(selectedDateObj, 1), 'yyyy-MM-dd'));
  };

  const goToToday = () => {
    setSelectedDate(format(now, 'yyyy-MM-dd'));
  };

  // Quick day navigation (next 7 days)
  const getWeekDays = () => {
    const days = [];
    for (let i = -3; i <= 3; i++) {
      const date = addDays(now, i);
      const dateStr = format(date, 'yyyy-MM-dd');
      const dayOfWeek = date.getDay();
      const studentsOnDay = students.filter(student =>
        student.sessions.some(s => s.date === dateStr) ||
        (student.scheduleDays.some(d => d.dayOfWeek === dayOfWeek) &&
          dateStr >= student.semesterStart && dateStr <= student.semesterEnd)
      );
      days.push({
        date: dateStr,
        dayName: DAY_NAMES_SHORT[dayOfWeek],
        dayNum: format(date, 'd'),
        isToday: isToday(date),
        studentCount: studentsOnDay.length,
      });
    }
    return days;
  };

  const weekDays = getWeekDays();

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
                {/* Date Navigation */}
                <div className="space-y-3">
                  {/* Main date display */}
                  <div className="flex items-center justify-center gap-2">
                    <Button variant="ghost" size="icon" onClick={goToPrevDay} className="h-8 w-8">
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="text-center min-w-[180px]">
                      <p className="font-heading font-semibold text-lg">
                        {format(selectedDateObj, 'EEEE')}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {format(selectedDateObj, 'MMMM d, yyyy')}
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={goToNextDay} className="h-8 w-8">
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    {!isToday(selectedDateObj) && (
                      <Button variant="outline" size="sm" onClick={goToToday} className="ml-2">
                        Today
                      </Button>
                    )}
                  </div>

                  {/* Week day quick navigation */}
                  <div className="flex justify-center gap-1.5 overflow-x-auto pb-1">
                    {weekDays.map(day => (
                      <button
                        key={day.date}
                        onClick={() => setSelectedDate(day.date)}
                        className={cn(
                          "flex flex-col items-center px-3 py-2 rounded-lg transition-all min-w-[52px]",
                          selectedDate === day.date
                            ? "bg-primary text-primary-foreground shadow-md"
                            : day.isToday
                              ? "bg-primary/10 border-2 border-primary/30 hover:bg-primary/20"
                              : "bg-card border border-border hover:border-primary/50"
                        )}
                      >
                        <span className="text-xs font-medium">{day.dayName}</span>
                        <span className="text-lg font-bold">{day.dayNum}</span>
                        {day.studentCount > 0 && (
                          <span className={cn(
                            "text-[10px] px-1.5 rounded-full mt-0.5",
                            selectedDate === day.date
                              ? "bg-primary-foreground/20"
                              : "bg-muted"
                          )}>
                            {day.studentCount}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Student filter dropdown */}
                  <div className="flex items-center gap-2">
                    <Select value={studentFilter} onValueChange={setStudentFilter}>
                      <SelectTrigger className="w-full">
                        <Users className="h-4 w-4 mr-2 text-muted-foreground" />
                        <SelectValue placeholder="All Students" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover z-50">
                        <SelectItem value="all">All Students</SelectItem>
                        {students.map(student => (
                          <SelectItem key={student.id} value={student.id}>
                            <div className="flex items-center gap-2">
                              <span>{student.name}</span>
                              <span className="text-xs text-muted-foreground">
                                ({student.scheduleDays.map(d => DAY_NAMES_SHORT[d.dayOfWeek]).join(', ')})
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {studentFilter !== 'all' && (
                      <Button variant="ghost" size="icon" onClick={() => setStudentFilter('all')} className="h-10 w-10 shrink-0">
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Stats for selected date */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-card rounded-xl p-3 card-shadow text-center">
                    <p className="text-xl font-heading font-bold">{filteredStudents.length}</p>
                    <p className="text-xs text-muted-foreground">Students Today</p>
                  </div>
                  <div className="bg-success/10 rounded-xl p-3 card-shadow text-center">
                    <p className="text-xl font-heading font-bold text-success">
                      {filteredStudents.reduce((count, s) => {
                        const session = s.sessions.find(sess => sess.date === selectedDate);
                        return count + (session?.completed ? 1 : 0);
                      }, 0)}
                    </p>
                    <p className="text-xs text-success/80">Completed</p>
                  </div>
                  <div className="bg-warning/10 rounded-xl p-3 card-shadow text-center">
                    <p className="text-xl font-heading font-bold text-warning">
                      {filteredStudents.reduce((count, s) => {
                        const session = s.sessions.find(sess => sess.date === selectedDate);
                        return count + (session && !session.completed ? 1 : 0);
                      }, 0)}
                    </p>
                    <p className="text-xs text-warning/80">Pending</p>
                  </div>
                </div>

                {/* Students for selected date */}
                {filteredStudents.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {studentFilter !== 'all'
                      ? `${students.find(s => s.id === studentFilter)?.name} has no session on ${format(selectedDateObj, 'MMMM d')}`
                      : `No sessions scheduled for ${format(selectedDateObj, 'MMMM d')}`}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredStudents.map(student => (
                      <StudentCard
                        key={student.id}
                        student={student}
                        selectedDate={selectedDate}
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

          <TabsContent value="payments" className="mt-0 space-y-4">
            {/* Stats for payments */}
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
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Index;
