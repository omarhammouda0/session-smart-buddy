import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { History, Users, Check, X, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { Student, DAY_NAMES_SHORT } from '@/types/student';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface SessionHistoryBarProps {
  students: Student[];
}

export const SessionHistoryBar = ({ students }: SessionHistoryBarProps) => {
  const [selectedStudentId, setSelectedStudentId] = useState<string>('all');
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  // Filter students
  const filteredStudents = selectedStudentId === 'all'
    ? students
    : students.filter(s => s.id === selectedStudentId);

  // Get selected student
  const selectedStudent = students.find(s => s.id === selectedStudentId);

  // Calculate stats for filtered students
  const getMonthlyStats = (month: number, year: number) => {
    let completed = 0;
    let cancelled = 0;
    let scheduled = 0;

    filteredStudents.forEach(student => {
      student.sessions.forEach(session => {
        const sessionDate = parseISO(session.date);
        if (sessionDate.getMonth() === month && sessionDate.getFullYear() === year) {
          if (session.status === 'completed') completed++;
          else if (session.status === 'cancelled') cancelled++;
          else if (session.status === 'scheduled') scheduled++;
        }
      });
    });

    return { completed, cancelled, scheduled, total: completed + cancelled + scheduled };
  };

  // Get all-time stats
  const getAllTimeStats = () => {
    let completed = 0;
    let cancelled = 0;
    let scheduled = 0;

    filteredStudents.forEach(student => {
      student.sessions.forEach(session => {
        if (session.status === 'completed') completed++;
        else if (session.status === 'cancelled') cancelled++;
        else if (session.status === 'scheduled') scheduled++;
      });
    });

    return { completed, cancelled, scheduled, total: completed + cancelled + scheduled };
  };

  // Get sessions for the selected month
  const getSessionsForMonth = () => {
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
      student.sessions.forEach(session => {
        const sessionDate = parseISO(session.date);
        if (sessionDate.getMonth() === selectedMonth && sessionDate.getFullYear() === selectedYear) {
          sessions.push({
            ...session,
            studentName: student.name,
            studentId: student.id,
          });
        }
      });
    });

    return sessions.sort((a, b) => a.date.localeCompare(b.date));
  };

  const monthlyStats = getMonthlyStats(selectedMonth, selectedYear);
  const allTimeStats = getAllTimeStats();
  const monthSessions = getSessionsForMonth();

  // Month navigation
  const goToPrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear(y => y - 1);
    } else {
      setSelectedMonth(m => m - 1);
    }
  };

  const goToNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear(y => y + 1);
    } else {
      setSelectedMonth(m => m + 1);
    }
  };

  const goToCurrentMonth = () => {
    setSelectedMonth(now.getMonth());
    setSelectedYear(now.getFullYear());
  };

  const isCurrentMonth = selectedMonth === now.getMonth() && selectedYear === now.getFullYear();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-heading flex items-center gap-2">
          <History className="h-4 w-4" />
          Session History
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

        {/* All-time stats */}
        <div className="p-3 rounded-lg bg-muted/50 border">
          <p className="text-xs text-muted-foreground mb-2 font-medium">
            {selectedStudent ? `${selectedStudent.name} - All Time` : 'All Students - All Time'}
          </p>
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center">
              <p className="text-xl font-bold">{allTimeStats.total}</p>
              <p className="text-[10px] text-muted-foreground">Total</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-success">{allTimeStats.completed}</p>
              <p className="text-[10px] text-success/80">Completed</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-destructive">{allTimeStats.cancelled}</p>
              <p className="text-[10px] text-destructive/80">Cancelled</p>
            </div>
          </div>
        </div>

        {/* Month navigation */}
        <div className="flex items-center justify-center gap-2">
          <Button variant="ghost" size="icon" onClick={goToPrevMonth} className="h-8 w-8">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-center min-w-[120px]">
            <p className="text-sm font-medium">
              {format(new Date(selectedYear, selectedMonth, 1), 'MMMM yyyy')}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={goToNextMonth} className="h-8 w-8">
            <ChevronRight className="h-4 w-4" />
          </Button>
          {!isCurrentMonth && (
            <Button variant="outline" size="sm" onClick={goToCurrentMonth} className="h-8 text-xs">
              Today
            </Button>
          )}
        </div>

        {/* Monthly stats */}
        <div className="grid grid-cols-4 gap-2">
          <div className="text-center p-2 rounded-lg bg-card border">
            <p className="text-lg font-bold">{monthlyStats.total}</p>
            <p className="text-[10px] text-muted-foreground">Total</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-primary/10">
            <p className="text-lg font-bold text-primary">{monthlyStats.scheduled}</p>
            <p className="text-[10px] text-primary/80">Scheduled</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-success/10">
            <p className="text-lg font-bold text-success">{monthlyStats.completed}</p>
            <p className="text-[10px] text-success/80">Done</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-destructive/10">
            <p className="text-lg font-bold text-destructive">{monthlyStats.cancelled}</p>
            <p className="text-[10px] text-destructive/80">Cancelled</p>
          </div>
        </div>

        {/* Session list for month */}
        <div>
          <p className="text-xs text-muted-foreground mb-2 font-medium flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            Sessions in {format(new Date(selectedYear, selectedMonth, 1), 'MMMM')}
          </p>
          <ScrollArea className="h-[200px]">
            <div className="space-y-1.5 pr-2">
              {monthSessions.length === 0 ? (
                <p className="text-center text-muted-foreground py-6 text-xs">
                  No sessions for this month
                </p>
              ) : (
                monthSessions.map(session => (
                  <div
                    key={session.id}
                    className={cn(
                      "flex items-center justify-between p-2 rounded text-xs border",
                      session.status === 'completed' && "bg-success/5 border-success/20",
                      session.status === 'cancelled' && "bg-destructive/5 border-destructive/20",
                      session.status === 'scheduled' && "bg-card"
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className={cn(
                        "w-5 h-5 rounded-full flex items-center justify-center shrink-0",
                        session.status === 'completed' && "bg-success/20 text-success",
                        session.status === 'cancelled' && "bg-destructive/20 text-destructive",
                        session.status === 'scheduled' && "bg-primary/20 text-primary"
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
                        session.status === 'scheduled' && "border-primary/30 text-primary"
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
      </CardContent>
    </Card>
  );
};
