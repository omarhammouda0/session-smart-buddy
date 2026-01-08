import { useState } from 'react';
import { format, addWeeks, addMonths, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, eachWeekOfInterval, isSameDay, isSameWeek, isSameMonth } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, X, Calendar, Users, Check, Monitor, MapPin } from 'lucide-react';
import { Student, DAY_NAMES_SHORT } from '@/types/student';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
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

interface UpcomingSessionsManagerProps {
  students: Student[];
  onAddSession: (studentId: string, date: string) => void;
  onRemoveSession: (studentId: string, sessionId: string) => void;
}

type ViewMode = 'week' | 'month';

export const UpcomingSessionsManager = ({
  students,
  onAddSession,
  onRemoveSession,
}: UpcomingSessionsManagerProps) => {
  const now = new Date();
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('all');

  // Week view dates
  const currentWeekStart = startOfWeek(addWeeks(now, weekOffset), { weekStartsOn: 1 });
  const currentWeekEnd = endOfWeek(addWeeks(now, weekOffset), { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: currentWeekStart, end: currentWeekEnd });

  // Month view dates
  const currentMonthStart = startOfMonth(addMonths(now, monthOffset));
  const currentMonthEnd = endOfMonth(addMonths(now, monthOffset));
  const monthWeeks = eachWeekOfInterval(
    { start: currentMonthStart, end: currentMonthEnd },
    { weekStartsOn: 1 }
  );

  // Get days to display based on view mode
  const daysToDisplay = viewMode === 'week' ? weekDays : eachDayOfInterval({ start: currentMonthStart, end: currentMonthEnd });

  // Filter students
  const filteredStudents = selectedStudentId === 'all'
    ? students
    : students.filter(s => s.id === selectedStudentId);

  // Get sessions for a specific student on a specific date
  const getStudentSessionForDate = (student: Student, date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return student.sessions.find(s => s.date === dateStr && s.status !== 'cancelled');
  };

  // Get cancelled session for restore
  const getCancelledSessionForDate = (student: Student, date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return student.sessions.find(s => s.date === dateStr && s.status === 'cancelled');
  };

  // Check if the student normally has a session on this day of week
  const isScheduledDay = (student: Student, date: Date) => {
    const dayOfWeek = date.getDay();
    return student.scheduleDays.some(d => d.dayOfWeek === dayOfWeek);
  };

  // Check if date is within semester
  const isWithinSemester = (student: Student, date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return dateStr >= student.semesterStart && dateStr <= student.semesterEnd;
  };

  // Navigation
  const goToPrev = () => {
    if (viewMode === 'week') {
      setWeekOffset(prev => prev - 1);
    } else {
      setMonthOffset(prev => prev - 1);
    }
  };

  const goToNext = () => {
    if (viewMode === 'week') {
      setWeekOffset(prev => prev + 1);
    } else {
      setMonthOffset(prev => prev + 1);
    }
  };

  const goToToday = () => {
    setWeekOffset(0);
    setMonthOffset(0);
  };

  const isCurrentPeriod = viewMode === 'week' ? weekOffset === 0 : monthOffset === 0;

  // Sort students by time
  const sortedStudents = [...filteredStudents].sort((a, b) => {
    const timeA = a.sessionTime || '16:00';
    const timeB = b.sessionTime || '16:00';
    return timeA.localeCompare(timeB);
  });

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base font-heading flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Manage Sessions
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* View mode toggle */}
        <div className="flex rounded-lg border border-border overflow-hidden w-full">
          <button
            onClick={() => setViewMode('week')}
            className={cn(
              "flex-1 px-3 py-2 text-xs sm:text-sm font-medium transition-colors",
              viewMode === 'week'
                ? "bg-primary text-primary-foreground"
                : "bg-card active:bg-muted"
            )}
          >
            Week
          </button>
          <button
            onClick={() => setViewMode('month')}
            className={cn(
              "flex-1 px-3 py-2 text-xs sm:text-sm font-medium transition-colors border-l border-border",
              viewMode === 'month'
                ? "bg-primary text-primary-foreground"
                : "bg-card active:bg-muted"
            )}
          >
            Month
          </button>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-center gap-2">
          <Button variant="ghost" size="icon" onClick={goToPrev} className="h-9 w-9">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-center min-w-[160px]">
            {viewMode === 'week' ? (
              <>
                <p className="text-sm font-medium">
                  {format(currentWeekStart, 'MMM d')} - {format(currentWeekEnd, 'MMM d, yyyy')}
                </p>
                {weekOffset === 0 && (
                  <Badge variant="secondary" className="text-[10px] mt-1">This Week</Badge>
                )}
                {weekOffset === 1 && (
                  <Badge variant="outline" className="text-[10px] mt-1">Next Week</Badge>
                )}
                {weekOffset > 1 && (
                  <Badge variant="outline" className="text-[10px] mt-1">+{weekOffset} weeks</Badge>
                )}
                {weekOffset < 0 && (
                  <Badge variant="outline" className="text-[10px] mt-1">{weekOffset} weeks</Badge>
                )}
              </>
            ) : (
              <>
                <p className="text-sm font-medium">
                  {format(currentMonthStart, 'MMMM yyyy')}
                </p>
                {monthOffset === 0 && (
                  <Badge variant="secondary" className="text-[10px] mt-1">This Month</Badge>
                )}
                {monthOffset !== 0 && (
                  <Badge variant="outline" className="text-[10px] mt-1">
                    {monthOffset > 0 ? `+${monthOffset}` : monthOffset} months
                  </Badge>
                )}
              </>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={goToNext} className="h-9 w-9">
            <ChevronRight className="h-4 w-4" />
          </Button>
          {!isCurrentPeriod && (
            <Button variant="outline" size="sm" onClick={goToToday} className="h-8 text-xs">
              Today
            </Button>
          )}
        </div>

        {/* Student filter */}
        <div className="flex items-center gap-2">
          <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
            <SelectTrigger className="w-full h-10">
              <Users className="h-4 w-4 mr-2 text-muted-foreground shrink-0" />
              <SelectValue placeholder="All Students" />
            </SelectTrigger>
            <SelectContent className="bg-popover z-50">
              <SelectItem value="all">All Students</SelectItem>
              {students.map(student => (
                <SelectItem key={student.id} value={student.id}>
                  <div className="flex items-center gap-2">
                    <span>{student.name}</span>
                    <span className="text-xs text-muted-foreground">
                      ({student.sessionTime || '16:00'})
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedStudentId !== 'all' && (
            <Button variant="ghost" size="icon" onClick={() => setSelectedStudentId('all')} className="h-10 w-10 shrink-0">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Days grid */}
        <div className="overflow-x-auto -mx-4 px-4 scrollbar-hide">
          <div className={cn(
            "pb-2",
            viewMode === 'week' ? "flex gap-2 min-w-max" : "grid grid-cols-7 gap-1"
          )}>
            {/* Month view: show day headers */}
            {viewMode === 'month' && DAY_NAMES_SHORT.map(day => (
              <div key={day} className="text-center text-[10px] font-medium text-muted-foreground py-1">
                {day}
              </div>
            ))}
            {/* Month view: add empty cells for days before month starts */}
            {viewMode === 'month' && Array.from({ length: (currentMonthStart.getDay() + 6) % 7 }).map((_, i) => (
              <div key={`empty-${i}`} className="min-h-[60px]" />
            ))}
            {daysToDisplay.map(day => {
              const isToday = isSameDay(day, now);
              const dayStr = format(day, 'yyyy-MM-dd');

              return (
                <div
                  key={dayStr}
                  className={cn(
                    "flex flex-col rounded-lg border p-2",
                    viewMode === 'week' ? "min-w-[100px] sm:min-w-[120px]" : "min-h-[60px]",
                    isToday ? "border-primary bg-primary/5" : "bg-card"
                  )}
                >
                  {/* Day header */}
                  <div className={cn(
                    "text-center border-b",
                    viewMode === 'week' ? "mb-2 pb-2" : "mb-1 pb-1"
                  )}>
                    {viewMode === 'week' && (
                      <p className={cn(
                        "text-xs font-medium",
                        isToday && "text-primary"
                      )}>
                        {DAY_NAMES_SHORT[day.getDay()]}
                      </p>
                    )}
                    <p className={cn(
                      viewMode === 'week' ? "text-lg font-bold" : "text-sm font-semibold",
                      isToday && "text-primary"
                    )}>
                      {format(day, 'd')}
                    </p>
                  </div>

                  {/* Students sessions for this day */}
                  <div className="space-y-1.5 flex-1">
                    {sortedStudents.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-2">No students</p>
                    ) : (
                      sortedStudents.map(student => {
                        const session = getStudentSessionForDate(student, day);
                        const cancelledSession = getCancelledSessionForDate(student, day);
                        const scheduled = isScheduledDay(student, day);
                        const inSemester = isWithinSemester(student, day);
                        const hasActiveSession = !!session;
                        const isCancelled = !!cancelledSession;

                        // Only show if relevant to this day
                        if (!hasActiveSession && !scheduled && !isCancelled) return null;
                        if (!inSemester) return null;

                        return (
                          <div
                            key={student.id}
                            className={cn(
                              "flex items-center justify-between gap-1 rounded text-xs",
                              viewMode === 'week' ? "p-1.5" : "p-1",
                              hasActiveSession && session?.status === 'completed' && "bg-success/10 border border-success/20 text-success",
                              hasActiveSession && session?.status !== 'completed' && "bg-primary/10 border border-primary/20",
                              isCancelled && "bg-destructive/10 border border-destructive/20 text-destructive"
                            )}
                          >
                            <div className="truncate flex-1 min-w-0">
                              {viewMode === 'week' ? (
                                <>
                                  <div className="flex items-center gap-1">
                                    <span className={cn(
                                      "font-medium truncate",
                                      session?.status === 'completed' && "line-through opacity-70"
                                    )}>{student.name}</span>
                                    {(student.sessionType || 'onsite') === 'online' ? (
                                      <Monitor className="h-3 w-3 text-blue-500 shrink-0" />
                                    ) : (
                                      <MapPin className="h-3 w-3 text-orange-500 shrink-0" />
                                    )}
                                  </div>
                                  <span className="text-[10px] text-muted-foreground">{student.sessionTime}</span>
                                </>
                              ) : (
                                <div className="flex flex-col">
                                  <div className="flex items-center gap-0.5">
                                    <span className={cn(
                                      "font-medium truncate text-[10px]",
                                      session?.status === 'completed' && "line-through opacity-70"
                                    )}>{student.name.split(' ')[0]}</span>
                                    {(student.sessionType || 'onsite') === 'online' ? (
                                      <Monitor className="h-2.5 w-2.5 text-blue-500 shrink-0" />
                                    ) : (
                                      <MapPin className="h-2.5 w-2.5 text-orange-500 shrink-0" />
                                    )}
                                  </div>
                                  <span className="text-[9px] text-muted-foreground">{student.sessionTime}</span>
                                </div>
                              )}
                            </div>
                            
                            {/* Re-add cancelled session */}
                            {isCancelled && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 shrink-0"
                                onClick={() => onAddSession(student.id, dayStr)}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            )}

                            {/* Cancel session button - hide in month view for space */}
                            {viewMode === 'week' && hasActiveSession && session?.status !== 'completed' && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Cancel Session</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Cancel {student.name}'s session on {format(day, 'EEEE, MMM d')}?
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Keep</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => onRemoveSession(student.id, session!.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Cancel Session
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}

                            {/* Completed indicator */}
                            {hasActiveSession && session?.status === 'completed' && (
                              <Check className={cn("text-success shrink-0", viewMode === 'week' ? "h-3.5 w-3.5" : "h-2.5 w-2.5")} />
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground pt-2 border-t">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-primary/10 border border-primary/20" />
            <span>Scheduled</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-destructive/10 border border-destructive/20" />
            <span>Cancelled</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-muted" />
            <span>Completed</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
