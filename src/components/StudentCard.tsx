import { useState } from 'react';
import { Trash2, Edit2, Check, X, Calendar, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
  selectedDate: string;
  selectedMonth: number;
  selectedYear: number;
  onRemove: () => void;
  onUpdateName: (name: string) => void;
  onUpdateTime: (time: string) => void;
  onUpdateSchedule: (days: number[], start?: string, end?: string) => void;
  onAddSession: (date: string) => void;
  onRemoveSession: (sessionId: string) => void;
  onToggleSession: (sessionId: string) => void;
}

export const StudentCard = ({
  student,
  selectedDate,
  selectedMonth,
  selectedYear,
  onRemove,
  onUpdateName,
  onUpdateTime,
  onUpdateSchedule,
  onAddSession,
  onRemoveSession,
  onToggleSession,
}: StudentCardProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(student.name);
  const [editTime, setEditTime] = useState(student.sessionTime || '16:00');
  const [showSettings, setShowSettings] = useState(false);

  // Find today's session
  const todaySession = student.sessions.find(s => s.date === selectedDate);
  
  // Get month sessions for progress
  const monthSessions = student.sessions.filter(s => {
    const sessionDate = parseISO(s.date);
    return sessionDate.getMonth() === selectedMonth && sessionDate.getFullYear() === selectedYear;
  });
  const completedCount = monthSessions.filter(s => s.completed).length;
  const totalSessions = monthSessions.length;
  const progress = totalSessions > 0 ? (completedCount / totalSessions) * 100 : 0;

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

  const handleToggleTodaySession = () => {
    if (todaySession) {
      onToggleSession(todaySession.id);
    } else {
      // Create session for today if it doesn't exist
      onAddSession(selectedDate);
    }
  };

  return (
    <Card className={cn(
      "card-shadow hover:card-shadow-hover transition-all duration-300 animate-scale-in overflow-hidden",
      todaySession?.completed && "ring-2 ring-success/50"
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-9"
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
                    className="h-8 w-28"
                  />
                  <Button size="icon" variant="ghost" onClick={handleSaveName} className="shrink-0 h-8 w-8 text-success">
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => { setEditName(student.name); setEditTime(student.sessionTime || '16:00'); setIsEditing(false); }} className="shrink-0 h-8 w-8 text-destructive">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-heading font-semibold text-lg truncate">{student.name}</h3>
                  <Button size="icon" variant="ghost" onClick={() => setIsEditing(true)} className="shrink-0 h-7 w-7">
                    <Edit2 className="h-3 w-3" />
                  </Button>
                </div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-sm font-medium px-2.5 py-1 bg-accent/20 text-foreground rounded-lg flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    {student.sessionTime || '16:00'}
                  </span>
                  {student.scheduleDays.map(d => (
                    <span key={d.dayOfWeek} className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">
                      {DAY_NAMES_SHORT[d.dayOfWeek]}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="icon" variant="ghost" className="shrink-0 h-8 w-8 text-muted-foreground hover:text-destructive">
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

      <CardContent className="pt-0 space-y-4">
        {/* Today's Session Status - Main Action */}
        <button
          onClick={handleToggleTodaySession}
          className={cn(
            "w-full p-4 rounded-xl border-2 transition-all flex items-center justify-between",
            todaySession?.completed
              ? "bg-success/10 border-success text-success"
              : "bg-card border-dashed border-muted-foreground/30 hover:border-primary hover:bg-primary/5"
          )}
        >
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center transition-all",
              todaySession?.completed
                ? "bg-success text-success-foreground"
                : "border-2 border-muted-foreground/30"
            )}>
              {todaySession?.completed && <Check className="h-5 w-5" />}
            </div>
            <div className="text-left">
              <p className={cn(
                "font-medium",
                todaySession?.completed ? "text-success" : "text-foreground"
              )}>
                {todaySession?.completed ? 'Session Completed' : 'Mark Session Complete'}
              </p>
              <p className="text-xs text-muted-foreground">
                {format(parseISO(selectedDate), 'EEEE, MMMM d')}
              </p>
            </div>
          </div>
          <span className={cn(
            "text-xs font-medium px-2 py-1 rounded-full",
            todaySession?.completed 
              ? "bg-success/20 text-success" 
              : "bg-muted text-muted-foreground"
          )}>
            {todaySession?.completed ? 'Done' : 'Tap to complete'}
          </span>
        </button>

        {/* Month Progress */}
        <div>
          <div className="flex items-center justify-between text-sm mb-1.5">
            <span className="text-muted-foreground text-xs">This Month</span>
            <span className="font-semibold text-sm">{completedCount}/{totalSessions}</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full gradient-primary transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Schedule settings collapsible */}
        <Collapsible open={showSettings} onOpenChange={setShowSettings}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between text-xs text-muted-foreground">
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
                    "px-2.5 py-1 rounded text-xs font-medium transition-all",
                    student.scheduleDays.some(d => d.dayOfWeek === index)
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
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
      </CardContent>
    </Card>
  );
};
