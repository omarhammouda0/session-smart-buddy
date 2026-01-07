import { useState } from 'react';
import { Trash2, Edit2, Check, X, Plus, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Student, DAY_NAMES_SHORT } from '@/types/student';
import { formatDayMonth, getSessionsForMonth } from '@/lib/dateUtils';
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

interface StudentCardProps {
  student: Student;
  selectedMonth: number;
  selectedYear: number;
  onRemove: () => void;
  onUpdateName: (name: string) => void;
  onUpdateSchedule: (days: number[], start?: string, end?: string) => void;
  onAddSession: (date: string) => void;
  onRemoveSession: (sessionId: string) => void;
  onToggleSession: (sessionId: string) => void;
}

export const StudentCard = ({
  student,
  selectedMonth,
  selectedYear,
  onRemove,
  onUpdateName,
  onUpdateSchedule,
  onAddSession,
  onRemoveSession,
  onToggleSession,
}: StudentCardProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(student.name);
  const [showSettings, setShowSettings] = useState(false);
  const [addingSession, setAddingSession] = useState(false);
  const [newSessionDate, setNewSessionDate] = useState('');

  const monthSessions = getSessionsForMonth(student.sessions, selectedMonth, selectedYear);
  const completedCount = monthSessions.filter(s => s.completed).length;
  const totalSessions = monthSessions.length;
  const progress = totalSessions > 0 ? (completedCount / totalSessions) * 100 : 0;

  const handleSaveName = () => {
    if (editName.trim()) {
      onUpdateName(editName.trim());
      setIsEditing(false);
    }
  };

  const handleAddSession = () => {
    if (newSessionDate) {
      onAddSession(newSessionDate);
      setNewSessionDate('');
      setAddingSession(false);
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

  return (
    <Card className="card-shadow hover:card-shadow-hover transition-all duration-300 animate-scale-in overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <div className="flex items-center gap-2">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="h-9"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveName();
                    if (e.key === 'Escape') { setEditName(student.name); setIsEditing(false); }
                  }}
                />
                <Button size="icon" variant="ghost" onClick={handleSaveName} className="shrink-0 h-9 w-9 text-success">
                  <Check className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => { setEditName(student.name); setIsEditing(false); }} className="shrink-0 h-9 w-9 text-destructive">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h3 className="font-heading font-semibold text-lg truncate">{student.name}</h3>
                <Button size="icon" variant="ghost" onClick={() => setIsEditing(true)} className="shrink-0 h-7 w-7">
                  <Edit2 className="h-3 w-3" />
                </Button>
              </div>
            )}
            <div className="flex flex-wrap gap-1 mt-1">
              {student.scheduleDays.map(d => (
                <span key={d.dayOfWeek} className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">
                  {DAY_NAMES_SHORT[d.dayOfWeek]}
                </span>
              ))}
            </div>
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

        {/* Progress Bar */}
        <div className="mt-3">
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
      </CardHeader>

      <CardContent className="pt-0 space-y-3">
        {/* Sessions for selected month */}
        {monthSessions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No sessions this month</p>
        ) : (
          <div className="space-y-1.5 max-h-[200px] overflow-y-auto pr-1">
            {monthSessions.map((session) => (
              <div
                key={session.id}
                className={cn(
                  "flex items-center gap-3 p-2.5 rounded-lg border transition-all",
                  session.completed 
                    ? "bg-success/10 border-success/30" 
                    : "bg-card border-border hover:border-primary/30"
                )}
              >
                <button
                  onClick={() => onToggleSession(session.id)}
                  className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center transition-all shrink-0",
                    session.completed
                      ? "bg-success text-success-foreground"
                      : "border-2 border-muted-foreground/30 hover:border-primary"
                  )}
                >
                  {session.completed && <Check className="h-3 w-3" />}
                </button>
                
                <span className="text-sm flex-1">{formatDayMonth(session.date)}</span>
                
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                  onClick={() => onRemoveSession(session.id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Add extra session */}
        {addingSession ? (
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={newSessionDate}
              onChange={(e) => setNewSessionDate(e.target.value)}
              className="h-8 text-sm flex-1"
            />
            <Button size="sm" variant="ghost" onClick={handleAddSession} disabled={!newSessionDate}>
              <Check className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setAddingSession(false); setNewSessionDate(''); }}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-muted-foreground"
            onClick={() => setAddingSession(true)}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add extra session
          </Button>
        )}

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
