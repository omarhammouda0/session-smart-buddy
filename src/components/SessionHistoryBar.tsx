import { useState } from 'react';
import { format, parseISO, isAfter, isBefore, startOfToday } from 'date-fns';
import { History, Users, Check, X, Calendar, Ban, CalendarClock, TrendingUp, Plus } from 'lucide-react';
import { Student } from '@/types/student';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
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
  onRestoreSession?: (studentId: string, sessionId: string) => void;
  onToggleComplete?: (studentId: string, sessionId: string) => void;
  onRescheduleSession?: (studentId: string, sessionId: string, newDate: string) => void;
  onAddSession?: (studentId: string, date: string) => void;
}

export const SessionHistoryBar = ({ students, onCancelSession, onRestoreSession, onToggleComplete, onRescheduleSession, onAddSession }: SessionHistoryBarProps) => {
  const [selectedStudentId, setSelectedStudentId] = useState<string>('all');
  const [historyTab, setHistoryTab] = useState<'upcoming' | 'history'>('upcoming');
  const today = startOfToday();
  const todayStr = format(today, 'yyyy-MM-dd');
  const [rescheduleDate, setRescheduleDate] = useState<Date | undefined>(undefined);
  const [addSessionDate, setAddSessionDate] = useState<Date | undefined>(undefined);

  // Get selected student
  const selectedStudent = students.find(s => s.id === selectedStudentId);

  // Get today's sessions stats for all students
  const getTodayStats = () => {
    let total = 0;
    let completed = 0;
    let pending = 0;
    let cancelled = 0;

    students.forEach(student => {
      student.sessions.forEach(session => {
        if (session.date === todayStr) {
          total++;
          if (session.status === 'completed') completed++;
          else if (session.status === 'scheduled') pending++;
          else if (session.status === 'cancelled') cancelled++;
        }
      });
    });

    const completionRate = total > 0 ? Math.round((completed / (total - cancelled)) * 100) : 0;
    return { total, completed, pending, cancelled, completionRate };
  };

  // Get all scheduled and cancelled sessions for selected student (past and future)
  const getScheduledSessions = () => {
    if (!selectedStudent) return [];
    
    const semesterStart = parseISO(selectedStudent.semesterStart);
    const scheduledSessions = selectedStudent.sessions
      .filter(session => {
        const sessionDate = parseISO(session.date);
        // Show all scheduled and cancelled sessions from semester start
        // Completed sessions go directly to history
        return !isBefore(sessionDate, semesterStart) && session.status !== 'completed';
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    return scheduledSessions.map(session => ({
      id: session.id,
      date: session.date,
      status: session.status,
      studentName: selectedStudent.name,
      studentId: selectedStudent.id,
    }));
  };

  // Get history stats for selected student - ALL completed and cancelled sessions
  const getHistoryStats = () => {
    if (!selectedStudent) return { completed: 0, cancelled: 0, total: 0, completionRate: 0 };
    
    let completed = 0;
    let cancelled = 0;

    const semesterStart = parseISO(selectedStudent.semesterStart);
    selectedStudent.sessions.forEach(session => {
      const sessionDate = parseISO(session.date);
      // Include all completed/cancelled sessions from semester start (no end date restriction)
      if (!isBefore(sessionDate, semesterStart)) {
        if (session.status === 'completed') completed++;
        else if (session.status === 'cancelled') cancelled++;
      }
    });

    const total = completed + cancelled;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { completed, cancelled, total, completionRate };
  };

  // Get history sessions for selected student - ALL completed and cancelled
  const getHistorySessions = () => {
    if (!selectedStudent) return [];
    
    const sessions: Array<{
      id: string;
      date: string;
      status: string;
      studentName: string;
      studentId: string;
    }> = [];

    const semesterStart = parseISO(selectedStudent.semesterStart);
    selectedStudent.sessions.forEach(session => {
      const sessionDate = parseISO(session.date);
      // Include all completed or cancelled sessions from semester start (no end date restriction)
      if (!isBefore(sessionDate, semesterStart) && (session.status === 'completed' || session.status === 'cancelled')) {
        sessions.push({
          ...session,
          studentName: selectedStudent.name,
          studentId: selectedStudent.id,
        });
      }
    });

    return sessions.sort((a, b) => b.date.localeCompare(a.date));
  };

  const todayStats = getTodayStats();
  const scheduledSessions = getScheduledSessions();
  const historyStats = getHistoryStats();
  const historySessions = getHistorySessions();

  const handleCancelSession = (studentId: string, sessionId: string) => {
    onCancelSession?.(studentId, sessionId);
  };

  const handleRestoreSession = (studentId: string, sessionId: string) => {
    onRestoreSession?.(studentId, sessionId);
  };

  const handleToggleComplete = (studentId: string, sessionId: string) => {
    onToggleComplete?.(studentId, sessionId);
  };

  const handleReschedule = (studentId: string, sessionId: string, newDate: Date) => {
    const formattedDate = format(newDate, 'yyyy-MM-dd');
    onRescheduleSession?.(studentId, sessionId, formattedDate);
    setRescheduleDate(undefined);
  };

  const handleAddSession = (studentId: string, date: Date) => {
    const formattedDate = format(date, 'yyyy-MM-dd');
    onAddSession?.(studentId, formattedDate);
    setAddSessionDate(undefined);
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
              <SelectValue placeholder="Select a student to view details" />
            </SelectTrigger>
            <SelectContent className="bg-popover z-50">
              <SelectItem value="all" className="text-muted-foreground">
                Select a student...
              </SelectItem>
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

        {/* Student-specific content - only shown when student is selected */}
        {selectedStudentId !== 'all' && selectedStudent ? (
          <Tabs value={historyTab} onValueChange={(v) => setHistoryTab(v as 'upcoming' | 'history')}>
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger value="upcoming" className="gap-1.5 text-xs">
                <CalendarClock className="h-3.5 w-3.5" />
                Sessions
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-1.5 text-xs">
                <History className="h-3.5 w-3.5" />
                History
              </TabsTrigger>
            </TabsList>

            <TabsContent value="upcoming" className="mt-3 space-y-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                  <CalendarClock className="h-3 w-3" />
                  {selectedStudent.name}'s Sessions
                  <Badge variant="secondary" className="ml-2 text-[10px]">
                    {scheduledSessions.length}
                  </Badge>
                </p>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1">
                      <Plus className="h-3 w-3" />
                      Add Session
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 pointer-events-auto" align="end">
                    <CalendarPicker
                      mode="single"
                      selected={addSessionDate}
                      onSelect={(date) => {
                        if (date) {
                          handleAddSession(selectedStudent.id, date);
                        }
                      }}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <ScrollArea className="h-[280px]">
                  <div className="space-y-1.5 pr-2">
                    {scheduledSessions.length === 0 ? (
                      <p className="text-center text-muted-foreground py-6 text-xs">
                        No sessions scheduled
                      </p>
                    ) : (
                      scheduledSessions.map(session => (
                        <div
                          key={session.id}
                          className={cn(
                            "flex items-center justify-between p-2.5 rounded-lg text-xs border",
                            session.status === 'cancelled' && "bg-destructive/5 border-destructive/20",
                            session.status === 'completed' && "bg-success/5 border-success/20",
                            session.status === 'scheduled' && "bg-card"
                          )}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <div className={cn(
                              "w-5 h-5 rounded-full flex items-center justify-center shrink-0",
                              session.status === 'cancelled' && "bg-destructive/20 text-destructive",
                              session.status === 'completed' && "bg-success/20 text-success",
                              session.status === 'scheduled' && "bg-primary/20 text-primary"
                            )}>
                              {session.status === 'cancelled' && <Ban className="h-3 w-3" />}
                              {session.status === 'completed' && <Check className="h-3 w-3" />}
                              {session.status === 'scheduled' && <Calendar className="h-3 w-3" />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className={cn(
                                "font-medium truncate",
                                session.status === 'cancelled' && "line-through text-muted-foreground"
                              )}>
                                {format(parseISO(session.date), 'EEE, MMM d')}
                              </p>
                              {session.status === 'cancelled' && (
                                <span className="text-[10px] text-destructive">Cancelled</span>
                              )}
                              {session.status === 'completed' && (
                                <span className="text-[10px] text-success">Completed</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {session.status === 'cancelled' ? (
                              /* Restore button for cancelled sessions */
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-7 px-2 text-success hover:text-success hover:bg-success/10">
                                    <Check className="h-3.5 w-3.5 mr-1" />
                                    Restore
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Restore Session</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Restore the cancelled session on {format(parseISO(session.date), 'EEEE, MMMM d')}? It will be marked as scheduled again.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleRestoreSession(session.studentId, session.id)}
                                      className="bg-success text-success-foreground hover:bg-success/90"
                                    >
                                      Yes, restore
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            ) : session.status === 'completed' ? (
                              /* Undo completion button */
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-7 px-2 text-warning hover:text-warning hover:bg-warning/10"
                                onClick={() => handleToggleComplete(session.studentId, session.id)}
                              >
                                <X className="h-3.5 w-3.5 mr-1" />
                                Undo
                              </Button>
                            ) : (
                              /* Actions for scheduled sessions */
                              <>
                                {/* Mark Complete button */}
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-7 w-7 text-muted-foreground hover:text-success hover:bg-success/10"
                                  onClick={() => handleToggleComplete(session.studentId, session.id)}
                                >
                                  <Check className="h-3.5 w-3.5" />
                                </Button>

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
                                        Are you sure you want to cancel the session on {format(parseISO(session.date), 'EEEE, MMMM d')}?
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
                              </>
                            )}
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
                  {selectedStudent.name} - Semester to Date
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center">
                    <p className="text-lg font-bold">{historyStats.total}</p>
                    <p className="text-[10px] text-muted-foreground">Total</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-success">{historyStats.completed}</p>
                    <p className="text-[10px] text-success/80">Completed</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-destructive">{historyStats.cancelled}</p>
                    <p className="text-[10px] text-destructive/80">Cancelled</p>
                  </div>
                </div>
              </div>

              {historyStats.total > 0 && (
                <div className="p-2 rounded-lg bg-success/10 border border-success/20 text-center">
                  <p className="text-sm font-medium text-success">
                    {historyStats.completionRate}% Completion Rate
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
                <ScrollArea className="h-[180px]">
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
                            session.status === 'cancelled' && "bg-destructive/5 border-destructive/20"
                          )}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <div className={cn(
                              "w-5 h-5 rounded-full flex items-center justify-center shrink-0",
                              session.status === 'completed' && "bg-success/20 text-success",
                              session.status === 'cancelled' && "bg-destructive/20 text-destructive"
                            )}>
                              {session.status === 'completed' && <Check className="h-3 w-3" />}
                              {session.status === 'cancelled' && <X className="h-3 w-3" />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium truncate">
                                {format(parseISO(session.date), 'EEE, MMM d')}
                              </p>
                            </div>
                          </div>
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "shrink-0 text-[10px] capitalize",
                              session.status === 'completed' && "border-success/30 text-success",
                              session.status === 'cancelled' && "border-destructive/30 text-destructive"
                            )}
                          >
                            {session.status}
                          </Badge>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Select a student above to view their sessions and history</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};