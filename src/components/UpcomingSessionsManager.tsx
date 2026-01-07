import { useState } from 'react';
import { format, addWeeks, startOfWeek, endOfWeek, eachDayOfInterval, parseISO, isSameDay } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, X, Calendar, Users } from 'lucide-react';
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

export const UpcomingSessionsManager = ({
  students,
  onAddSession,
  onRemoveSession,
}: UpcomingSessionsManagerProps) => {
  const now = new Date();
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('all');

  // Get start and end of the selected week (Monday-based)
  const currentWeekStart = startOfWeek(addWeeks(now, weekOffset), { weekStartsOn: 1 });
  const currentWeekEnd = endOfWeek(addWeeks(now, weekOffset), { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: currentWeekStart, end: currentWeekEnd });

  // Filter students
  const filteredStudents = selectedStudentId === 'all'
    ? students
    : students.filter(s => s.id === selectedStudentId);

  // Get sessions for a specific student on a specific date
  const getStudentSessionForDate = (student: Student, date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return student.sessions.find(s => s.date === dateStr);
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

  const goToPrevWeek = () => setWeekOffset(prev => prev - 1);
  const goToNextWeek = () => setWeekOffset(prev => prev + 1);
  const goToThisWeek = () => setWeekOffset(0);

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
        {/* Week navigation */}
        <div className="flex items-center justify-center gap-2">
          <Button variant="ghost" size="icon" onClick={goToPrevWeek} className="h-9 w-9">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-center min-w-[160px]">
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
          </div>
          <Button variant="ghost" size="icon" onClick={goToNextWeek} className="h-9 w-9">
            <ChevronRight className="h-4 w-4" />
          </Button>
          {weekOffset !== 0 && (
            <Button variant="outline" size="sm" onClick={goToThisWeek} className="h-8 text-xs">
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

        {/* Week days grid */}
        <div className="overflow-x-auto -mx-4 px-4 scrollbar-hide">
          <div className="flex gap-2 min-w-max pb-2">
            {weekDays.map(day => {
              const isToday = isSameDay(day, now);
              const dayStr = format(day, 'yyyy-MM-dd');

              return (
                <div
                  key={dayStr}
                  className={cn(
                    "flex flex-col min-w-[100px] sm:min-w-[120px] rounded-lg border p-2",
                    isToday ? "border-primary bg-primary/5" : "bg-card"
                  )}
                >
                  {/* Day header */}
                  <div className="text-center mb-2 pb-2 border-b">
                    <p className={cn(
                      "text-xs font-medium",
                      isToday && "text-primary"
                    )}>
                      {DAY_NAMES_SHORT[day.getDay()]}
                    </p>
                    <p className={cn(
                      "text-lg font-bold",
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
                        const scheduled = isScheduledDay(student, day);
                        const inSemester = isWithinSemester(student, day);
                        const hasSession = !!session;
                        const isCancelled = scheduled && inSemester && !hasSession;

                        // Only show if relevant to this day
                        if (!hasSession && !scheduled) return null;
                        if (!inSemester) return null;

                        return (
                          <div
                            key={student.id}
                            className={cn(
                              "flex items-center justify-between gap-1 p-1.5 rounded text-xs",
                              hasSession && !session?.completed && "bg-primary/10 border border-primary/20",
                              hasSession && session?.completed && "bg-muted text-muted-foreground line-through",
                              isCancelled && "bg-destructive/10 border border-destructive/20 text-destructive"
                            )}
                          >
                            <div className="truncate flex-1">
                              <span className="font-medium truncate block">{student.name}</span>
                              <span className="text-[10px] text-muted-foreground">{student.sessionTime}</span>
                            </div>
                            
                            {/* Add session button (if cancelled/removed) */}
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

                            {/* Remove session button */}
                            {hasSession && !session?.completed && (
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
