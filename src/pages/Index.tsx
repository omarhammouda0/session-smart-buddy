import { useState } from 'react';
import { GraduationCap, BookOpen, CreditCard, ChevronLeft, ChevronRight, Users, X, Trash2, Clock, Monitor, MapPin, History } from 'lucide-react';
import { format, addDays, parseISO, isToday } from 'date-fns';
import { useStudents } from '@/hooks/useStudents';
import { AddStudentDialog } from '@/components/AddStudentDialog';
import { SemesterSettings } from '@/components/SemesterSettings';
import { StudentCard } from '@/components/StudentCard';
import { PaymentsDashboard } from '@/components/PaymentsDashboard';
import { EmptyState } from '@/components/EmptyState';
import { StatsBar } from '@/components/StatsBar';
import { EndOfMonthReminder } from '@/components/EndOfMonthReminder';
import { SessionHistoryBar } from '@/components/SessionHistoryBar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DAY_NAMES_SHORT } from '@/types/student';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
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
} from '@/components/ui/alert-dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

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
    deleteSession,
    restoreSession,
    rescheduleSession,
    toggleSessionComplete,
    togglePaymentStatus,
  } = useStudents();

  // Wrapper functions with toast notifications
  const handleAddSession = (studentId: string, date: string) => {
    const student = students.find(s => s.id === studentId);
    addExtraSession(studentId, date);
    toast({
      title: "Session Added",
      description: `New session on ${format(parseISO(date), 'EEE, MMM d')}${student ? ` for ${student.name}` : ''}`,
    });
  };

  const handleCancelSession = (studentId: string, sessionId: string) => {
    removeSession(studentId, sessionId);
    toast({
      title: "Session Cancelled",
      description: "The session has been cancelled",
      variant: "destructive",
    });
  };

  const handleDeleteSession = (studentId: string, sessionId: string) => {
    deleteSession(studentId, sessionId);
    toast({
      title: "Session Deleted",
      description: "The session has been permanently removed",
    });
  };

  const handleRestoreSession = (studentId: string, sessionId: string) => {
    restoreSession(studentId, sessionId);
    toast({
      title: "Session Restored",
      description: "The session has been restored to scheduled",
    });
  };

  const handleToggleComplete = (studentId: string, sessionId: string) => {
    const student = students.find(s => s.id === studentId);
    const session = student?.sessions.find(s => s.id === sessionId);
    const wasCompleted = session?.status === 'completed';
    toggleSessionComplete(studentId, sessionId);
    toast({
      title: wasCompleted ? "Session Unmarked" : "Session Completed",
      description: wasCompleted ? "Session marked as scheduled" : "Great job! Session marked as complete",
    });
  };

  const selectedDateObj = parseISO(selectedDate);
  const selectedDayOfWeek = selectedDateObj.getDay();
  const selectedMonth = selectedDateObj.getMonth();
  const selectedYear = selectedDateObj.getFullYear();

  // Get students who have a session on the selected date
  const getStudentsForDate = () => {
    return students.filter(student => {
      const hasSessionOnDate = student.sessions.some(s => s.date === selectedDate);
      const isInSchedule = student.scheduleDays.some(d => d.dayOfWeek === selectedDayOfWeek) &&
        selectedDate >= student.semesterStart && selectedDate <= student.semesterEnd;
      
      return hasSessionOnDate || isInSchedule;
    });
  };

  const studentsForDate = getStudentsForDate();

  // Filter by selected student and sort by session time (ascending)
  const filteredStudents = studentsForDate
    .filter(s => studentFilter === 'all' || s.id === studentFilter)
    .sort((a, b) => {
      const timeA = a.sessionTime || '16:00';
      const timeB = b.sessionTime || '16:00';
      return timeA.localeCompare(timeB);
    });

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
      
      // Check if selected student has a session on this day
      const selectedStudentHasSession = studentFilter !== 'all' && students.some(student => 
        student.id === studentFilter && (
          student.sessions.some(s => s.date === dateStr && s.status === 'scheduled') ||
          (student.scheduleDays.some(d => d.dayOfWeek === dayOfWeek) &&
            dateStr >= student.semesterStart && dateStr <= student.semesterEnd)
        )
      );
      
      days.push({
        date: dateStr,
        dayName: DAY_NAMES_SHORT[dayOfWeek],
        dayNum: format(date, 'd'),
        isToday: isToday(date),
        studentCount: studentsOnDay.length,
        hasSelectedStudent: selectedStudentHasSession,
      });
    }
    return days;
  };

  const weekDays = getWeekDays();

  // Sort all students by time for the student list
  const allStudentsSortedByTime = [...students].sort((a, b) => {
    const timeA = a.sessionTime || '16:00';
    const timeB = b.sessionTime || '16:00';
    return timeA.localeCompare(timeB);
  });

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background safe-bottom">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-10 safe-top">
        <div className="px-3 py-2.5 sm:px-4 sm:py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl gradient-primary flex items-center justify-center shrink-0">
                <GraduationCap className="h-4 w-4 sm:h-5 sm:w-5 text-primary-foreground" />
              </div>
              <div className="min-w-0">
                <h1 className="font-heading font-bold text-base sm:text-lg leading-tight truncate">Student Tracker</h1>
                <p className="text-[10px] sm:text-xs text-muted-foreground hidden xs:block">Sessions & Payments</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* All Students Sheet */}
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 px-2.5 sm:px-3 gap-1.5">
                    <Users className="h-4 w-4" />
                    <span className="hidden sm:inline text-sm">Students</span>
                    <span className="bg-primary/10 text-primary text-xs px-1.5 rounded-full">{students.length}</span>
                  </Button>
                </SheetTrigger>
                <SheetContent className="w-full sm:max-w-md">
                  <SheetHeader>
                    <SheetTitle className="font-heading">All Students ({students.length})</SheetTitle>
                  </SheetHeader>
                  <div className="mt-4 space-y-2 max-h-[calc(100vh-120px)] overflow-y-auto">
                    {allStudentsSortedByTime.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">No students added yet</p>
                    ) : (
                      allStudentsSortedByTime.map(student => (
                        <div
                          key={student.id}
                          className="flex items-center justify-between p-3 rounded-lg border bg-card"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-medium truncate">{student.name}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {student.sessionTime || '16:00'}
                              </span>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                {(student.sessionType || 'onsite') === 'online' ? (
                                  <><Monitor className="h-3 w-3" /> Online</>
                                ) : (
                                  <><MapPin className="h-3 w-3" /> On-site</>
                                )}
                              </span>
                              <span>•</span>
                              <span>{student.scheduleDays.map(d => DAY_NAMES_SHORT[d.dayOfWeek]).join(', ')}</span>
                            </div>
                          </div>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remove Student</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to remove {student.name}? This will delete all their session and payment records.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={() => removeStudent(student.id)} 
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Remove
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      ))
                    )}
                  </div>
                </SheetContent>
              </Sheet>
              
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
      <main className="px-3 py-3 sm:px-4 sm:py-4 space-y-3 sm:space-y-4 max-w-4xl mx-auto">
        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full grid grid-cols-3 mb-3 sm:mb-4 h-11">
            <TabsTrigger value="sessions" className="gap-1.5 text-sm">
              <BookOpen className="h-4 w-4" />
              <span className="hidden xs:inline">Sessions</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1.5 text-sm">
              <History className="h-4 w-4" />
              <span className="hidden xs:inline">History</span>
            </TabsTrigger>
            <TabsTrigger value="payments" className="gap-1.5 text-sm">
              <CreditCard className="h-4 w-4" />
              <span className="hidden xs:inline">Payments</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sessions" className="mt-0 space-y-4">
            {students.length === 0 ? (
              <EmptyState />
            ) : (
              <>
                {/* Date Navigation */}
                <div className="space-y-2.5">
                  {/* Main date display */}
                  <div className="flex items-center justify-center gap-1">
                    <Button variant="ghost" size="icon" onClick={goToPrevDay} className="h-10 w-10">
                      <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <div className="text-center min-w-[140px] sm:min-w-[180px]">
                      <p className="font-heading font-semibold text-lg sm:text-xl">
                        {format(selectedDateObj, 'EEEE')}
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={goToNextDay} className="h-10 w-10">
                      <ChevronRight className="h-5 w-5" />
                    </Button>
                    {!isToday(selectedDateObj) && (
                      <Button variant="outline" size="sm" onClick={goToToday} className="ml-1 h-9">
                        Today
                      </Button>
                    )}
                  </div>

                  {/* Week day quick navigation */}
                  <div className="flex justify-start sm:justify-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide -mx-3 px-3 sm:mx-0 sm:px-0">
                    {weekDays.map(day => (
                      <button
                        key={day.date}
                        onClick={() => {
                          setSelectedDate(day.date);
                          setStudentFilter('all'); // Reset filter when selecting a day
                        }}
                        className={cn(
                          "flex flex-col items-center px-3 py-2 rounded-lg transition-all min-w-[52px] shrink-0 relative",
                          selectedDate === day.date
                            ? "bg-primary text-primary-foreground shadow-md"
                            : day.hasSelectedStudent
                              ? "bg-accent border-2 border-accent-foreground/20 ring-2 ring-primary/40"
                              : day.isToday
                                ? "bg-primary/10 border-2 border-primary/30 active:bg-primary/20"
                                : "bg-card border border-border active:border-primary/50"
                        )}
                      >
                        {day.hasSelectedStudent && selectedDate !== day.date && (
                          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-primary rounded-full" />
                        )}
                        <span className="text-sm font-semibold">{day.dayName}</span>
                        {day.studentCount > 0 && (
                          <span className={cn(
                            "text-[9px] px-1.5 rounded-full mt-1",
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
                      <Select value={studentFilter} onValueChange={(value) => {
                        setStudentFilter(value);
                        // Auto-navigate to student's next session day
                        if (value !== 'all') {
                          const student = students.find(s => s.id === value);
                          if (student) {
                            // Find next scheduled session for this student
                            const todayStr = format(now, 'yyyy-MM-dd');
                            const nextSession = student.sessions
                              .filter(s => s.date >= todayStr && s.status === 'scheduled')
                              .sort((a, b) => a.date.localeCompare(b.date))[0];
                            if (nextSession) {
                              setSelectedDate(nextSession.date);
                            }
                          }
                        }
                      }}>
                        <SelectTrigger className="w-full h-11">
                          <Users className="h-4 w-4 mr-2 text-muted-foreground shrink-0" />
                          <SelectValue placeholder="All Students" />
                        </SelectTrigger>
                        <SelectContent className="bg-popover z-50">
                          <SelectItem value="all">All Students</SelectItem>
                          {students.map(student => (
                            <SelectItem key={student.id} value={student.id}>
                              <div className="flex items-center gap-2">
                                <span>{student.name}</span>
                                <span className="text-xs text-muted-foreground hidden sm:inline">
                                  ({student.scheduleDays.map(d => DAY_NAMES_SHORT[d.dayOfWeek]).join(', ')})
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {studentFilter !== 'all' && (
                        <Button variant="ghost" size="icon" onClick={() => setStudentFilter('all')} className="h-11 w-11 shrink-0">
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                  </div>
                </div>

                {/* Stats for selected date */}
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  <div className="bg-card rounded-xl p-2.5 sm:p-3 card-shadow text-center">
                    <p className="text-lg sm:text-xl font-heading font-bold">{filteredStudents.length}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">Today</p>
                  </div>
                  <div className="bg-success/10 rounded-xl p-2.5 sm:p-3 card-shadow text-center">
                    <p className="text-lg sm:text-xl font-heading font-bold text-success">
                      {filteredStudents.reduce((count, s) => {
                        const session = s.sessions.find(sess => sess.date === selectedDate);
                        return count + (session?.completed ? 1 : 0);
                      }, 0)}
                    </p>
                    <p className="text-[10px] sm:text-xs text-success/80">Done</p>
                  </div>
                  <div className="bg-warning/10 rounded-xl p-2.5 sm:p-3 card-shadow text-center">
                    <p className="text-lg sm:text-xl font-heading font-bold text-warning">
                      {filteredStudents.reduce((count, s) => {
                        const session = s.sessions.find(sess => sess.date === selectedDate);
                        return count + (session && !session.completed ? 1 : 0);
                      }, 0)}
                    </p>
                    <p className="text-[10px] sm:text-xs text-warning/80">Pending</p>
                  </div>
                </div>

                {/* Students for selected date */}
                {filteredStudents.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    {studentFilter !== 'all'
                      ? `${students.find(s => s.id === studentFilter)?.name} has no session on ${format(selectedDateObj, 'MMM d')}`
                      : `No sessions scheduled for ${format(selectedDateObj, 'MMM d')}`}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:gap-4">
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
                        onAddSession={(date) => handleAddSession(student.id, date)}
                        onRemoveSession={(sessionId) => handleCancelSession(student.id, sessionId)}
                        onDeleteSession={(sessionId) => handleDeleteSession(student.id, sessionId)}
                        onToggleSession={(sessionId) => handleToggleComplete(student.id, sessionId)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="history" className="mt-0">
            <SessionHistoryBar 
              students={students} 
              onCancelSession={handleCancelSession}
              onDeleteSession={handleDeleteSession}
              onRestoreSession={handleRestoreSession}
              onToggleComplete={handleToggleComplete}
              onRescheduleSession={rescheduleSession}
              onAddSession={handleAddSession}
            />
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

        {/* End of Month Payment Reminder */}
        <EndOfMonthReminder
          students={students}
          payments={payments}
          onTogglePayment={togglePaymentStatus}
        />
      </main>
    </div>
  );
};

export default Index;
