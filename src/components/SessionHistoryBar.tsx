import { useState } from 'react';
import { format, parseISO, isAfter, isBefore, startOfToday } from 'date-fns';
import { History, Users, Check, X, Calendar, Ban, CalendarClock } from 'lucide-react';
import { Student } from '@/types/student';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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
import { cn } from '@/lib/utils';

interface SessionHistoryBarProps {
  students: Student[];
  onCancelSession?: (studentId: string, sessionId: string) => void;
  onRescheduleSession?: (studentId: string, sessionId: string, newDate: string) => void;
}

export const SessionHistoryBar = ({ students, onCancelSession, onRescheduleSession }: SessionHistoryBarProps) => {
  const [selectedStudentId, setSelectedStudentId] = useState<string>('all');
  const [historyTab, setHistoryTab] = useState<'upcoming' | 'history'>('upcoming');
  const today = startOfToday();
  const [rescheduleDate, setRescheduleDate] = useState<Date | undefined>(undefined);

  // Filter students
  const filteredStudents = selectedStudentId === 'all'
    ? students
    : students.filter(s => s.id === selectedStudentId);

  // Get selected student
  const selectedStudent = students.find(s => s.id === selectedStudentId);

  // Get next 4 sessions for each student
  const getUpcomingSessions = () => {
    const sessions: Array<{
      id: string;
      date: string;
      status: string;
      studentName: string;
      studentId: string;
    }> = [];

    filteredStudents.forEach(student => {
      // Get all future scheduled sessions for this student
      const futureScheduled = student.sessions
        .filter(session => {
          const sessionDate = parseISO(session.date);
          return session.status === 'scheduled' && !isBefore(sessionDate, today);
        })
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 4); // Take only next 4

      futureScheduled.forEach(session => {
        sessions.push({
          id: session.id,
          date: session.date,
          status: session.status,
          studentName: student.name,
          studentId: student.id,
        });
      });
    });

    return sessions.sort((a, b) => a.date.localeCompare(b.date));
  };

  // Get history stats (from semester start until today, plus all cancelled)
  const getHistoryStats = () => {
    let completed = 0;
    let cancelled = 0;
    let scheduled = 0;

    filteredStudents.forEach(student => {
      const semesterStart = parseISO(student.semesterStart);
      student.sessions.forEach(session => {
        const sessionDate = parseISO(session.date);
        // Include cancelled sessions regardless of date
        if (session.status === 'cancelled') {
          cancelled++;
        } else if (!isBefore(sessionDate, semesterStart) && !isAfter(sessionDate, today)) {
          // Only include completed/scheduled from semester start until today
          if (session.status === 'completed') completed++;
          else if (session.status === 'scheduled') scheduled++;
        }
      });
    });

    return { completed, cancelled, scheduled, total: completed + cancelled + scheduled };
  };

  // Get history sessions (from semester start until today, plus all cancelled)
  const getHistorySessions = () => {
    const sessions: Array<{
      id: string;
      date: string;
      status: string;
      studentName: string;
      studentId: string;
      completedAt?: string;
      cancelledAt?: string;
    }> = [];

    filteredStudents.forEach(student => {
      const semesterStart = parseISO(student.semesterStart);
      student.sessions.forEach(session => {
        const sessionDate = parseISO(session.date);
        // Include cancelled sessions regardless of date, or sessions within semester until today
        const isInHistoryRange = !isBefore(sessionDate, semesterStart) && !isAfter(sessionDate, today);
        if (session.status === 'cancelled' || isInHistoryRange) {
          sessions.push({
            ...session,
            studentName: student.name,
            studentId: student.id,
          });
        }
      });
    });

    // Sort by date descending (most recent first)
    return sessions.sort((a, b) => b.date.localeCompare(a.date));
  };

  const upcomingSessions = getUpcomingSessions();
  const historyStats = getHistoryStats();
  const historySessions = getHistorySessions();

  const handleCancelSession = (studentId: string, sessionId: string) => {
    onCancelSession?.(studentId, sessionId);
  };

  const handleReschedule = (studentId: string, sessionId: string, newDate: Date) => {
    const formattedDate = format(newDate, 'yyyy-MM-dd');
    onRescheduleSession?.(studentId, sessionId, formattedDate);
    setRescheduleDate(undefined);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-heading flex items-center gap-2">
          <History className="h-4 w-4" />
          Session Management
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
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

        {/* Tabs for Upcoming vs History */}
        <Tabs value={historyTab} onValueChange={(v) => setHistoryTab(v as 'upcoming' | 'history')}>
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="upcoming" className="gap-1.5 text-xs">
              <CalendarClock className="h-3.5 w-3.5" />
              Next Sessions
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1.5 text-xs">
              <History className="h-3.5 w-3.5" />
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming" className="mt-3 space-y-3">
            <div>
              <p className="text-xs text-muted-foreground mb-2 font-medium flex items-center gap-1">
                <CalendarClock className="h-3 w-3" />
                {selectedStudent ? `${selectedStudent.name}'s Next 4 Sessions` : 'Next 4 Sessions Per Student'}
                <Badge variant="secondary" className="ml-auto text-[10px]">
                  {upcomingSessions.length}
                </Badge>
              </p>
              <ScrollArea className="h-[320px]">
                <div className="space-y-1.5 pr-2">
                  {upcomingSessions.length === 0 ? (
                    <p className="text-center text-muted-foreground py-6 text-xs">
                      No upcoming sessions
                    </p>
                  ) : (
                    upcomingSessions.map(session => (
                      <div
                        key={session.id}
                        className="flex items-center justify-between p-2.5 rounded-lg text-xs border bg-card"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 bg-primary/20 text-primary">
                            <Calendar className="h-3 w-3" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium truncate">
                              {format(parseISO(session.date), 'EEE, MMM d')}
                            </p>
                            {selectedStudentId === 'all' && (
                              <p className="text-[10px] text-muted-foreground truncate">
                                {session.studentName}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary">
                                <CalendarClock className="h-3.5 w-3.5" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="end">
                              <CalendarPicker
                                mode="single"
                                selected={rescheduleDate}
                                onSelect={(date) => {
                                  if (date) {
                                    handleReschedule(session.studentId, session.id, date);
                                  }
                                }}
                                disabled={(date) => date < today}
                                initialFocus
                                className="pointer-events-auto"
                              />
                            </PopoverContent>
                          </Popover>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive">
                                <Ban className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Cancel Session</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to cancel the session for {session.studentName} on {format(parseISO(session.date), 'EEEE, MMMM d')}?
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>No, keep it</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleCancelSession(session.studentId, session.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Yes, cancel
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          </TabsContent>

          <TabsContent value="history" className="mt-3 space-y-3">
            <div className="p-3 rounded-lg bg-muted/50 border">
              <p className="text-xs text-muted-foreground mb-2 font-medium">
                {selectedStudent ? `${selectedStudent.name} - Semester to Date` : 'All Students - Semester to Date'}
              </p>
              <div className="grid grid-cols-4 gap-2">
                <div className="text-center">
                  <p className="text-lg font-bold">{historyStats.total}</p>
                  <p className="text-[10px] text-muted-foreground">Total</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-success">{historyStats.completed}</p>
                  <p className="text-[10px] text-success/80">Done</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-destructive">{historyStats.cancelled}</p>
                  <p className="text-[10px] text-destructive/80">Cancelled</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-warning">{historyStats.scheduled}</p>
                  <p className="text-[10px] text-warning/80">Pending</p>
                </div>
              </div>
            </div>

            {historyStats.total > 0 && (
              <div className="p-2 rounded-lg bg-success/10 border border-success/20 text-center">
                <p className="text-sm font-medium text-success">
                  {Math.round((historyStats.completed / historyStats.total) * 100)}% Completion Rate
                </p>
              </div>
            )}

            <div>
              <p className="text-xs text-muted-foreground mb-2 font-medium flex items-center gap-1">
                <History className="h-3 w-3" />
                Session History
                <Badge variant="secondary" className="ml-auto text-[10px]">
                  {historySessions.length}
                </Badge>
              </p>
              <ScrollArea className="h-[220px]">
                <div className="space-y-1.5 pr-2">
                  {historySessions.length === 0 ? (
                    <p className="text-center text-muted-foreground py-6 text-xs">
                      No past sessions
                    </p>
                  ) : (
                    historySessions.map(session => (
                      <div
                        key={session.id}
                        className={cn(
                          "flex items-center justify-between p-2 rounded text-xs border",
                          session.status === 'completed' && "bg-success/5 border-success/20",
                          session.status === 'cancelled' && "bg-destructive/5 border-destructive/20",
                          session.status === 'scheduled' && "bg-warning/5 border-warning/20"
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <div className={cn(
                            "w-5 h-5 rounded-full flex items-center justify-center shrink-0",
                            session.status === 'completed' && "bg-success/20 text-success",
                            session.status === 'cancelled' && "bg-destructive/20 text-destructive",
                            session.status === 'scheduled' && "bg-warning/20 text-warning"
                          )}>
                            {session.status === 'completed' && <Check className="h-3 w-3" />}
                            {session.status === 'cancelled' && <X className="h-3 w-3" />}
                            {session.status === 'scheduled' && <Calendar className="h-3 w-3" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium truncate">
                              {format(parseISO(session.date), 'EEE, MMM d')}
                            </p>
                            {selectedStudentId === 'all' && (
                              <p className="text-[10px] text-muted-foreground truncate">
                                {session.studentName}
                              </p>
                            )}
                          </div>
                        </div>
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "shrink-0 text-[10px] capitalize",
                            session.status === 'completed' && "border-success/30 text-success",
                            session.status === 'cancelled' && "border-destructive/30 text-destructive",
                            session.status === 'scheduled' && "border-warning/30 text-warning"
                          )}
                        >
                          {session.status === 'scheduled' ? 'pending' : session.status}
                        </Badge>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};