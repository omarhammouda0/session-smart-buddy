import { useState } from 'react';
import { Trash2, Edit2, Check, X, Calendar, Clock, Monitor, MapPin, Ban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Student } from '@/types/student';
import { cn } from '@/lib/utils';
import { parseISO, startOfToday, isBefore, isAfter, isSameDay } from 'date-fns';
import { DAY_NAMES_SHORT_AR, DAY_NAMES_AR, formatShortDateAr } from '@/lib/arabicConstants';
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
  onRemoveSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onToggleSession: (sessionId: string) => void;
}

export const StudentCard = ({
  student,
  selectedDayOfWeek,
  selectedMonth,
  selectedYear,
  onRemove,
  onUpdateName,
  onUpdateTime,
  onUpdateSchedule,
  onRemoveSession,
  onDeleteSession,
  onToggleSession,
}: StudentCardProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(student.name);
  const [editTime, setEditTime] = useState(student.sessionTime || '16:00');
  const today = startOfToday();

  // Get all sessions on this day of week (for display)
  const sessionsOnDay = student.sessions.filter(s => {
    const sessionDate = parseISO(s.date);
    return sessionDate.getDay() === selectedDayOfWeek;
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

  return (
    <Card className={cn(
      "card-shadow transition-all duration-300 overflow-hidden"
    )} dir="rtl">
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
                    placeholder="اسم الطالب"
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
                      <><Monitor className="h-3 w-3" /> أونلاين</>
                    ) : (
                      <><MapPin className="h-3 w-3" /> حضوري</>
                    )}
                  </Badge>
                  {student.scheduleDays.map(d => (
                    <span key={d.dayOfWeek} className={cn(
                      "text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full",
                      d.dayOfWeek === selectedDayOfWeek 
                        ? "bg-primary text-primary-foreground" 
                        : "bg-primary/10 text-primary"
                    )}>
                      {DAY_NAMES_SHORT_AR[d.dayOfWeek]}
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
            <AlertDialogContent dir="rtl">
              <AlertDialogHeader>
                <AlertDialogTitle>حذف الطالب</AlertDialogTitle>
                <AlertDialogDescription>
                  هل أنت متأكد من حذف {student.name}؟ سيتم حذف جميع سجلات الحصص والمدفوعات.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="flex-row-reverse gap-2">
                <AlertDialogCancel>إلغاء</AlertDialogCancel>
                <AlertDialogAction onClick={onRemove} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  حذف
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardHeader>

      <CardContent className="p-3 pt-0 space-y-3 sm:space-y-4">
        {/* Sessions on this day */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            حصص {DAY_NAMES_AR[selectedDayOfWeek]}
          </p>
          
          {sessionsOnDay.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3">لا توجد حصص</p>
          ) : (
            <div className="space-y-1.5">
              {sessionsOnDay.map(session => {
                const sessionDate = parseISO(session.date);
                const isPast = isBefore(sessionDate, today);
                const isToday = isSameDay(sessionDate, today);
                const isFuture = isAfter(sessionDate, today);
                
                return (
                  <div 
                    key={session.id}
                    className={cn(
                      "flex items-center justify-between p-2.5 rounded-lg text-xs border transition-colors",
                      session.status === 'completed' && "bg-success/5 border-success/20",
                      session.status === 'cancelled' && "bg-destructive/5 border-destructive/20",
                      session.status === 'scheduled' && "bg-card border-border"
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center shrink-0",
                        session.status === 'completed' && "bg-success/20 text-success",
                        session.status === 'cancelled' && "bg-destructive/20 text-destructive",
                        session.status === 'scheduled' && "bg-primary/20 text-primary"
                      )}>
                        {session.status === 'completed' ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : session.status === 'cancelled' ? (
                          <Ban className="h-3.5 w-3.5" />
                        ) : (
                          <Calendar className="h-3.5 w-3.5" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={cn(
                          "font-medium",
                          session.status === 'cancelled' && "line-through text-muted-foreground"
                        )}>
                          {formatShortDateAr(session.date)}
                        </p>
                        {isToday && session.status === 'scheduled' && (
                          <span className="text-[10px] text-primary font-medium">اليوم</span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1 shrink-0">
                      {session.status === 'cancelled' ? (
                        <>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7 text-success hover:text-success hover:bg-success/10"
                            onClick={() => onToggleSession(session.id)}
                            title="استعادة الحصة"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                title="حذف نهائي"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent dir="rtl">
                              <AlertDialogHeader>
                                <AlertDialogTitle>حذف الحصة نهائياً</AlertDialogTitle>
                                <AlertDialogDescription>
                                  سيتم حذف هذه الحصة نهائياً ولن تُحسب في الإحصائيات.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter className="flex-row-reverse gap-2">
                                <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={() => onDeleteSession(session.id)} 
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  حذف
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      ) : session.status === 'completed' ? (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 px-2 text-warning hover:text-warning hover:bg-warning/10"
                          onClick={() => onToggleSession(session.id)}
                        >
                          <X className="h-3.5 w-3.5 ml-1" />
                          تراجع
                        </Button>
                      ) : (
                        <>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7 text-success hover:text-success hover:bg-success/10"
                            onClick={() => onToggleSession(session.id)}
                            title="تم إكمال الحصة"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => onRemoveSession(session.id)}
                            title="إلغاء الحصة"
                          >
                            <Ban className="h-3.5 w-3.5" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                title="حذف نهائي"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent dir="rtl">
                              <AlertDialogHeader>
                                <AlertDialogTitle>حذف الحصة نهائياً</AlertDialogTitle>
                                <AlertDialogDescription>
                                  هل تريد حذف هذه الحصة نهائياً؟ لن تظهر في أي إحصائيات.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter className="flex-row-reverse gap-2">
                                <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={() => onDeleteSession(session.id)} 
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  حذف
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};