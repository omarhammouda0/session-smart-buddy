import { format, parseISO } from 'date-fns';
import { History, Check, X, Calendar, Clock } from 'lucide-react';
import { Student, Session, SessionStatus, DAY_NAMES_SHORT } from '@/types/student';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

interface SessionHistorySheetProps {
  students: Student[];
}

const getStatusColor = (status: SessionStatus) => {
  switch (status) {
    case 'completed':
      return 'bg-success/10 text-success border-success/20';
    case 'cancelled':
      return 'bg-destructive/10 text-destructive border-destructive/20';
    default:
      return 'bg-primary/10 text-primary border-primary/20';
  }
};

const getStatusIcon = (status: SessionStatus) => {
  switch (status) {
    case 'completed':
      return <Check className="h-3 w-3" />;
    case 'cancelled':
      return <X className="h-3 w-3" />;
    default:
      return <Calendar className="h-3 w-3" />;
  }
};

export const SessionHistorySheet = ({ students }: SessionHistorySheetProps) => {
  // Collect all sessions with history from all students
  const allSessionsWithHistory = students.flatMap(student =>
    student.sessions
      .filter(s => s.status === 'completed' || s.status === 'cancelled')
      .map(session => ({
        ...session,
        studentName: student.name,
        studentId: student.id,
        sessionTime: student.sessionTime,
      }))
  );

  // Sort by latest activity
  const sortedSessions = allSessionsWithHistory.sort((a, b) => {
    const aTime = a.completedAt || a.cancelledAt || a.history?.[a.history.length - 1]?.timestamp || '';
    const bTime = b.completedAt || b.cancelledAt || b.history?.[b.history.length - 1]?.timestamp || '';
    return bTime.localeCompare(aTime);
  });

  // Group by status
  const completedSessions = sortedSessions.filter(s => s.status === 'completed');
  const cancelledSessions = sortedSessions.filter(s => s.status === 'cancelled');

  // Stats
  const stats = {
    total: students.reduce((sum, s) => sum + s.sessions.length, 0),
    completed: completedSessions.length,
    cancelled: cancelledSessions.length,
    scheduled: students.reduce((sum, s) => sum + s.sessions.filter(sess => sess.status === 'scheduled').length, 0),
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 px-2.5 sm:px-3 gap-1.5">
          <History className="h-4 w-4" />
          <span className="hidden sm:inline text-sm">History</span>
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-heading flex items-center gap-2">
            <History className="h-5 w-5" />
            Session History
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {/* Stats Summary */}
          <div className="grid grid-cols-4 gap-2">
            <div className="text-center p-2 rounded-lg bg-muted">
              <p className="text-lg font-bold">{stats.total}</p>
              <p className="text-[10px] text-muted-foreground">Total</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-primary/10">
              <p className="text-lg font-bold text-primary">{stats.scheduled}</p>
              <p className="text-[10px] text-primary/80">Scheduled</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-success/10">
              <p className="text-lg font-bold text-success">{stats.completed}</p>
              <p className="text-[10px] text-success/80">Done</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-destructive/10">
              <p className="text-lg font-bold text-destructive">{stats.cancelled}</p>
              <p className="text-[10px] text-destructive/80">Cancelled</p>
            </div>
          </div>

          <ScrollArea className="h-[calc(100vh-220px)]">
            <div className="space-y-4 pr-4">
              {/* Completed Sessions */}
              {completedSessions.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium flex items-center gap-2 mb-2 text-success">
                    <Check className="h-4 w-4" />
                    Completed ({completedSessions.length})
                  </h3>
                  <div className="space-y-2">
                    {completedSessions.slice(0, 20).map(session => (
                      <SessionCard key={session.id} session={session} />
                    ))}
                    {completedSessions.length > 20 && (
                      <p className="text-xs text-muted-foreground text-center py-2">
                        +{completedSessions.length - 20} more completed sessions
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Cancelled Sessions */}
              {cancelledSessions.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium flex items-center gap-2 mb-2 text-destructive">
                    <X className="h-4 w-4" />
                    Cancelled ({cancelledSessions.length})
                  </h3>
                  <div className="space-y-2">
                    {cancelledSessions.slice(0, 20).map(session => (
                      <SessionCard key={session.id} session={session} />
                    ))}
                    {cancelledSessions.length > 20 && (
                      <p className="text-xs text-muted-foreground text-center py-2">
                        +{cancelledSessions.length - 20} more cancelled sessions
                      </p>
                    )}
                  </div>
                </div>
              )}

              {sortedSessions.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <History className="h-12 w-12 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">No session history yet</p>
                  <p className="text-xs">Complete or cancel sessions to see them here</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
};

interface SessionCardProps {
  session: Session & { studentName: string; studentId: string; sessionTime?: string };
}

const SessionCard = ({ session }: SessionCardProps) => {
  const lastUpdate = session.completedAt || session.cancelledAt || session.history?.[session.history.length - 1]?.timestamp;

  return (
    <div className={cn(
      "p-2.5 rounded-lg border",
      getStatusColor(session.status)
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm truncate">{session.studentName}</p>
          <div className="flex items-center gap-2 text-xs opacity-80 mt-0.5">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {format(parseISO(session.date), 'EEE, MMM d')}
            </span>
            {session.sessionTime && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {session.sessionTime}
              </span>
            )}
          </div>
        </div>
        <Badge variant="outline" className={cn("shrink-0 text-[10px] gap-1", getStatusColor(session.status))}>
          {getStatusIcon(session.status)}
          {session.status}
        </Badge>
      </div>
      {lastUpdate && (
        <p className="text-[10px] opacity-60 mt-1.5">
          {format(parseISO(lastUpdate), 'MMM d, h:mm a')}
        </p>
      )}
    </div>
  );
};
