import { useState, useCallback } from 'react';
import { Trash2, Edit2, Check, X, Calendar, ChevronDown, ChevronUp, Clock, Monitor, MapPin, History, Ban, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { Student, DAY_NAMES_SHORT } from '@/types/student';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
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

interface StudentCardProps {
  student: Student;
  selectedDayOfWeek: number;
  selectedMonth: number;
  selectedYear: number;
  onRemove: () => void;
  onUpdateName: (name: string) => void;
  onUpdateTime: (time: string) => void;
  onUpdateSchedule: (days: number[], start?: string, end?: string) => void;
  onAddSession: (date: string) => void;
  onRemoveSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onToggleSession: (sessionId: string) => void;
}

const DAY_NAMES_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const StudentCard = ({
  student,
  selectedDayOfWeek,
  selectedMonth,
  selectedYear,
  onRemove,
  onUpdateName,
  onUpdateTime,
  onUpdateSchedule,
  onAddSession,
  onRemoveSession,
  onDeleteSession,
  onToggleSession,
}: StudentCardProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(student.name);
  const [editTime, setEditTime] = useState(student.sessionTime || '16:00');
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Sessions on the selected day of week (all instances)
  const sessionsOnDay = student.sessions.filter(s => {
    const sessionDate = parseISO(s.date);
    return sessionDate.getDay() === selectedDayOfWeek && s.status !== 'cancelled';
  });
  
  // Get month sessions for progress (exclude cancelled)
  const monthSessions = student.sessions.filter(s => {
    if (s.status === 'cancelled') return false;
    const sessionDate = parseISO(s.date);
    return sessionDate.getMonth() === selectedMonth && sessionDate.getFullYear() === selectedYear;
  });
  const completedCount = monthSessions.filter(s => s.status === 'completed').length;
  const cancelledCount = student.sessions.filter(s => {
    if (s.status !== 'cancelled') return false;
    const sessionDate = parseISO(s.date);
    return sessionDate.getMonth() === selectedMonth && sessionDate.getFullYear() === selectedYear;
  }).length;
  const totalSessions = monthSessions.length;
  const progress = totalSessions > 0 ? (completedCount / totalSessions) * 100 : 0;

  // All-time stats
  const allTimeCompleted = student.sessions.filter(s => s.status === 'completed').length;
  const allTimeCancelled = student.sessions.filter(s => s.status === 'cancelled').length;
  const allTimeTotal = student.sessions.length;

  const handleSaveName = () => {
    if (editName.trim()) {
      onUpdateName(editName.trim());
      if (editTime !== student.sessionTime) {
        onUpdateTime(editTime);
      }
      setIsEditing(false);
    }
  };

  const toggleScheduleDay = (day: number) => {
    const currentDays = student.scheduleDays.map(d => d.dayOfWeek);
    const newDays = currentDays.includes(day)
      ? currentDays.filter(d => d !== day)
      : [...currentDays, day].sort();
    if (newDays.length > 0) {
      onUpdateSchedule(newDays);
    }
  };

  // Stats for sessions on this day of week
  const completedOnDay = sessionsOnDay.filter(s => s.status === 'completed').length;
  const scheduledOnDay = sessionsOnDay.filter(s => s.status === 'scheduled').length;

  return (
    <Card className={cn(
      "card-shadow transition-all duration-300 overflow-hidden"
    )}>
      <CardHeader className="p-3 sm:pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-10"
                    autoFocus
                    placeholder="Student name"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveName();
                      if (e.key === 'Escape') { setEditName(student.name); setEditTime(student.sessionTime || '16:00'); setIsEditing(false); }
                    }}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <Input
                    type="time"
                    value={editTime}
                    onChange={(e) => setEditTime(e.target.value)}
                    className="h-10 w-28"
                  />
                  <Button size="icon" variant="ghost" onClick={handleSaveName} className="shrink-0 h-10 w-10 text-success">
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => { setEditName(student.name); setEditTime(student.sessionTime || '16:00'); setIsEditing(false); }} className="shrink-0 h-10 w-10 text-destructive">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-heading font-semibold text-base sm:text-lg truncate">{student.name}</h3>
                  <Button size="icon" variant="ghost" onClick={() => setIsEditing(true)} className="shrink-0 h-8 w-8">
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2 mt-1 flex-wrap">
                  <span className="text-xs sm:text-sm font-medium px-2 py-0.5 sm:px-2.5 sm:py-1 bg-accent/20 text-foreground rounded-lg flex items-center gap-1">
                    <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                    {student.sessionTime || '16:00'}
                  </span>
                  <Badge variant="outline" className={cn(
                    "text-[10px] gap-1",
                    (student.sessionType || 'onsite') === 'online' 
                      ? "border-blue-500/30 text-blue-600 bg-blue-500/10"
                      : "border-orange-500/30 text-orange-600 bg-orange-500/10"
                  )}>
                    {(student.sessionType || 'onsite') === 'online' ? (
                      <><Monitor className="h-3 w-3" /> Online</>
                    ) : (
                      <><MapPin className="h-3 w-3" /> On-site</>
                    )}
                  </Badge>
                  {student.scheduleDays.map(d => (
                    <span key={d.dayOfWeek} className={cn(
                      "text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full",
                      d.dayOfWeek === selectedDayOfWeek 
                        ? "bg-primary text-primary-foreground" 
                        : "bg-primary/10 text-primary"
                    )}>
                      {DAY_NAMES_SHORT[d.dayOfWeek]}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="icon" variant="ghost" className="shrink-0 h-9 w-9 text-muted-foreground hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove Student</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to remove {student.name}? This will delete all their session records.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onRemove} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Remove
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardHeader>

      <CardContent className="p-3 pt-0 space-y-3 sm:space-y-4">
        {/* Day Session Stats */}
        <div className="flex gap-2">
          <div className="flex-1 p-3 sm:p-4 rounded-xl border bg-card">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center bg-primary/10 text-primary shrink-0">
                  <Calendar className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-sm sm:text-base text-foreground">
                    {DAY_NAMES_FULL[selectedDayOfWeek]} Sessions
                  </p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">
                    {sessionsOnDay.length} total sessions
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-1 rounded-full bg-success/10 text-success">
                  {completedOnDay} done
                </span>
                <span className="text-xs px-2 py-1 rounded-full bg-warning/10 text-warning">
                  {scheduledOnDay} pending
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Month Progress */}
        <div>
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-muted-foreground text-[10px] sm:text-xs">This Month</span>
            <div className="flex items-center gap-2">
              {cancelledCount > 0 && (
                <span className="text-[10px] text-destructive">-{cancelledCount}</span>
              )}
              <span className="font-semibold text-xs sm:text-sm">{completedCount}/{totalSessions}</span>
            </div>
          </div>
          <div className="h-1.5 sm:h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full gradient-primary transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Add Custom Session & Schedule settings */}
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 px-3 text-xs gap-1.5 flex-1">
                <Plus className="h-3.5 w-3.5" />
                Add Session
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarPicker
                mode="single"
                selected={undefined}
                onSelect={(date) => {
                  if (date) {
                    onAddSession(format(date, 'yyyy-MM-dd'));
                  }
                }}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Schedule settings collapsible */}
        <Collapsible open={showSettings} onOpenChange={setShowSettings}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between text-xs text-muted-foreground h-9">
              Schedule settings
              {showSettings ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2 space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {DAY_NAMES_SHORT.map((day, index) => (
                <button
                  key={day}
                  onClick={() => toggleScheduleDay(index)}
                  className={cn(
                    "px-2.5 py-1.5 rounded text-xs font-medium transition-all min-w-[40px]",
                    student.scheduleDays.some(d => d.dayOfWeek === index)
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground active:bg-muted/80"
                  )}
                >
                  {day}
                </button>
              ))}
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {student.semesterStart} → {student.semesterEnd}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Session History collapsible */}
        <Collapsible open={showHistory} onOpenChange={setShowHistory}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between text-xs text-muted-foreground h-9">
              <span className="flex items-center gap-1.5">
                <History className="h-3 w-3" />
                Session History
              </span>
              <div className="flex items-center gap-2">
                <span className="text-success">{allTimeCompleted} ✓</span>
                <span className="text-destructive">{allTimeCancelled} ✗</span>
                {showHistory ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </div>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="text-center p-2 rounded-lg bg-muted">
                <p className="text-sm font-bold">{allTimeTotal}</p>
                <p className="text-[10px] text-muted-foreground">Total</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-success/10">
                <p className="text-sm font-bold text-success">{allTimeCompleted}</p>
                <p className="text-[10px] text-success/80">Completed</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-destructive/10">
                <p className="text-sm font-bold text-destructive">{allTimeCancelled}</p>
                <p className="text-[10px] text-destructive/80">Cancelled</p>
              </div>
            </div>

            {/* Session list */}
            <ScrollArea className="h-[200px]">
              <div className="space-y-1.5 pr-2">
                {student.sessions
                  .filter(s => s.status !== 'scheduled')
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map(session => (
                    <div
                      key={session.id}
                      className={cn(
                        "flex items-center justify-between p-2 rounded text-xs",
                        session.status === 'completed' && "bg-success/10 text-success",
                        session.status === 'cancelled' && "bg-destructive/10 text-destructive"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        {session.status === 'completed' ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <X className="h-3 w-3" />
                        )}
                        <span>{format(parseISO(session.date), 'EEEE')}</span>
                      </div>
                      <Badge variant="outline" className={cn(
                        "text-[10px]",
                        session.status === 'completed' && "border-success/30",
                        session.status === 'cancelled' && "border-destructive/30"
                      )}>
                        {session.status}
                      </Badge>
                    </div>
                  ))}
                {student.sessions.filter(s => s.status !== 'scheduled').length === 0 && (
                  <p className="text-center text-muted-foreground py-4 text-xs">No session history yet</p>
                )}
              </div>
            </ScrollArea>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
};
