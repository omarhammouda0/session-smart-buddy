import { useState } from 'react';
import { Trash2, Edit2, Check, X, Calendar, Clock, Monitor, MapPin, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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

  // Sessions on the selected day of week (all instances)
  const sessionsOnDay = student.sessions.filter(s => {
    const sessionDate = parseISO(s.date);
    return sessionDate.getDay() === selectedDayOfWeek && s.status !== 'cancelled';
  });
  
  const handleSaveName = () => {
    if (editName.trim()) {
      onUpdateName(editName.trim());
      if (editTime !== student.sessionTime) {
        onUpdateTime(editTime);
      }
      setIsEditing(false);
    }
  };


  // Stats for sessions on this day of week
  const completedOnDay = sessionsOnDay.filter(s => s.status === 'completed').length;
  

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
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-1 rounded-full bg-success/10 text-success">
                  {completedOnDay} done
                </span>
              </div>
            </div>
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

      </CardContent>
    </Card>
  );
};
