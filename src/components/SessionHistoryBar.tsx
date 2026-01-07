import { useState } from 'react';
import { format, parseISO, isBefore, isAfter, startOfToday } from 'date-fns';
import { History, Users, Check, X, Calendar, Ban, CalendarClock, Plus, Trash2 } from 'lucide-react';
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
import { formatShortDateAr } from '@/lib/arabicConstants';

interface SessionHistoryBarProps {
  students: Student[];
  onCancelSession?: (studentId: string, sessionId: string) => void;
  onDeleteSession?: (studentId: string, sessionId: string) => void;
  onRestoreSession?: (studentId: string, sessionId: string) => void;
  onToggleComplete?: (studentId: string, sessionId: string) => void;
  onRescheduleSession?: (studentId: string, sessionId: string, newDate: string) => void;
  onAddSession?: (studentId: string, date: string) => void;
}

export const SessionHistoryBar = ({ students, onCancelSession, onDeleteSession, onRestoreSession, onToggleComplete, onRescheduleSession, onAddSession }: SessionHistoryBarProps) => {
  const [selectedStudentId, setSelectedStudentId] = useState<string>('all');
  const [historyTab, setHistoryTab] = useState<'upcoming' | 'history'>('upcoming');
  const today = startOfToday();
  const [rescheduleDate, setRescheduleDate] = useState<Date | undefined>(undefined);
  const [addSessionDate, setAddSessionDate] = useState<Date | undefined>(undefined);

  const selectedStudent = students.find(s => s.id === selectedStudentId);

  const getScheduledSessions = () => {
    if (!selectedStudent) return [];
    const semesterStart = parseISO(selectedStudent.semesterStart);
    return selectedStudent.sessions
      .filter(session => {
        const sessionDate = parseISO(session.date);
        return !isBefore(sessionDate, semesterStart) && session.status !== 'completed';
      })
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(session => ({ ...session, studentName: selectedStudent.name, studentId: selectedStudent.id }));
  };

  const getHistoryStats = () => {
    if (!selectedStudent) return { completed: 0, cancelled: 0, total: 0, completionRate: 0 };
    let completed = 0, cancelled = 0;
    selectedStudent.sessions.forEach(session => {
      if (session.status === 'completed') completed++;
      else if (session.status === 'cancelled') cancelled++;
    });
    const total = completed + cancelled;
    return { completed, cancelled, total, completionRate: total > 0 ? Math.round((completed / total) * 100) : 0 };
  };

  const getHistorySessions = () => {
    if (!selectedStudent) return [];
    return selectedStudent.sessions
      .filter(s => s.status === 'completed' || s.status === 'cancelled')
      .sort((a, b) => b.date.localeCompare(a.date))
      .map(s => ({ ...s, studentName: selectedStudent.name, studentId: selectedStudent.id }));
  };

  const scheduledSessions = getScheduledSessions();
  const historyStats = getHistoryStats();
  const historySessions = getHistorySessions();

  const handleAddSession = (studentId: string, date: Date) => {
    onAddSession?.(studentId, format(date, 'yyyy-MM-dd'));
    setAddSessionDate(undefined);
  };

  return (
    <Card dir="rtl">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-heading flex items-center gap-2">
          <History className="h-4 w-4" />
          إدارة الحصص
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">اختر طالب لإضافة حصص جديدة أو عرض السجل</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
            <SelectTrigger className="w-full h-10">
              <Users className="h-4 w-4 ml-2 text-muted-foreground shrink-0" />
              <SelectValue placeholder="اختر طالب لعرض التفاصيل" />
            </SelectTrigger>
            <SelectContent className="bg-popover z-50">
              <SelectItem value="all" className="text-muted-foreground">اختر طالب...</SelectItem>
              {students.map(student => (
                <SelectItem key={student.id} value={student.id}>
                  <div className="flex items-center gap-2">
                    <span>{student.name}</span>
                    <span className="text-xs text-muted-foreground">({student.sessionTime || '16:00'})</span>
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

        {selectedStudentId !== 'all' && selectedStudent ? (
          <Tabs value={historyTab} onValueChange={(v) => setHistoryTab(v as 'upcoming' | 'history')}>
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger value="upcoming" className="gap-1.5 text-xs"><CalendarClock className="h-3.5 w-3.5" />الحصص</TabsTrigger>
              <TabsTrigger value="history" className="gap-1.5 text-xs"><History className="h-3.5 w-3.5" />السجل</TabsTrigger>
            </TabsList>

            <TabsContent value="upcoming" className="mt-3 space-y-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                  <CalendarClock className="h-3 w-3" />
                  حصص {selectedStudent.name}
                  <Badge variant="secondary" className="mr-2 text-[10px]">{scheduledSessions.length}</Badge>
                </p>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1">
                      <Plus className="h-3 w-3" />
                      إضافة حصة
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
                    <CalendarPicker
                      mode="single"
                      selected={addSessionDate}
                      onSelect={(date) => date && handleAddSession(selectedStudent.id, date)}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded-lg">
                💡 اختر تاريخ من التقويم لإضافة حصة. الحصص السابقة تُسجل تلقائياً كمكتملة.
              </p>
              <ScrollArea className="h-[250px]">
                <div className="space-y-1.5 pl-2">
                  {scheduledSessions.length === 0 ? (
                    <p className="text-center text-muted-foreground py-6 text-xs">لا توجد حصص مجدولة</p>
                  ) : (
                    scheduledSessions.map(session => (
                      <div key={session.id} className={cn("flex items-center justify-between p-2.5 rounded-lg text-xs border",
                        session.status === 'cancelled' && "bg-destructive/5 border-destructive/20",
                        session.status === 'scheduled' && "bg-card"
                      )}>
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <div className={cn("w-5 h-5 rounded-full flex items-center justify-center shrink-0",
                            session.status === 'cancelled' && "bg-destructive/20 text-destructive",
                            session.status === 'scheduled' && "bg-primary/20 text-primary"
                          )}>
                            {session.status === 'cancelled' ? <Ban className="h-3 w-3" /> : <Calendar className="h-3 w-3" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className={cn("font-medium truncate", session.status === 'cancelled' && "line-through text-muted-foreground")}>
                              {formatShortDateAr(session.date)}
                            </p>
                            {session.status === 'cancelled' && <span className="text-[10px] text-destructive">ملغاة</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {session.status === 'cancelled' ? (
                            <>
                              <Button variant="ghost" size="sm" className="h-7 px-2 text-success" onClick={() => onRestoreSession?.(session.studentId, session.id)}>
                                <Check className="h-3.5 w-3.5 ml-1" />استعادة
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDeleteSession?.(session.studentId, session.id)} title="حذف نهائي">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-success" onClick={() => onToggleComplete?.(session.studentId, session.id)} title="إكمال">
                                <Check className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onCancelSession?.(session.studentId, session.id)} title="إلغاء">
                                <Ban className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => onDeleteSession?.(session.studentId, session.id)} title="حذف نهائي">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="history" className="mt-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground font-medium">إضافة حصة سابقة</p>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1">
                      <Plus className="h-3 w-3" />
                      إضافة
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
                    <CalendarPicker
                      mode="single"
                      selected={addSessionDate}
                      disabled={(date) => isAfter(date, today)}
                      onSelect={(date) => date && handleAddSession(selectedStudent.id, date)}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded-lg">
                💡 اختر تاريخًا سابقًا لإضافة حصة، وستُسجل تلقائياً كمكتملة وتظهر هنا في السجل.
              </p>

              <div className="p-3 rounded-lg bg-muted/50 border">
                <p className="text-xs text-muted-foreground mb-2 font-medium">{selectedStudent.name} - إحصائيات الفصل</p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center"><p className="text-lg font-bold">{historyStats.total}</p><p className="text-[10px] text-muted-foreground">الإجمالي</p></div>
                  <div className="text-center"><p className="text-lg font-bold text-success">{historyStats.completed}</p><p className="text-[10px] text-success/80">مكتملة</p></div>
                  <div className="text-center"><p className="text-lg font-bold text-destructive">{historyStats.cancelled}</p><p className="text-[10px] text-destructive/80">ملغاة</p></div>
                </div>
              </div>
              {historyStats.total > 0 && (
                <div className="p-2 rounded-lg bg-success/10 border border-success/20 text-center">
                  <p className="text-sm font-medium text-success">نسبة الإنجاز: {historyStats.completionRate}%</p>
                </div>
              )}
              <ScrollArea className="h-[180px]">
                <div className="space-y-1.5 pl-2">
                  {historySessions.length === 0 ? (
                    <p className="text-center text-muted-foreground py-6 text-xs">لا توجد حصص سابقة</p>
                  ) : (
                    historySessions.map(session => (
                      <div key={session.id} className={cn("flex items-center justify-between p-2 rounded text-xs border",
                        session.status === 'completed' && "bg-success/5 border-success/20",
                        session.status === 'cancelled' && "bg-destructive/5 border-destructive/20"
                      )}>
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <div className={cn("w-5 h-5 rounded-full flex items-center justify-center shrink-0",
                            session.status === 'completed' && "bg-success/20 text-success",
                            session.status === 'cancelled' && "bg-destructive/20 text-destructive"
                          )}>
                            {session.status === 'completed' ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                          </div>
                          <p className="font-medium truncate">{formatShortDateAr(session.date)}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {session.status === 'completed' ? (
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-warning" onClick={() => onToggleComplete?.(session.studentId, session.id)}>
                              <X className="h-3.5 w-3.5 ml-1" />تراجع
                            </Button>
                          ) : (
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-success" onClick={() => onRestoreSession?.(session.studentId, session.id)}>
                              <Check className="h-3.5 w-3.5 ml-1" />استعادة
                            </Button>
                          )}
                          <Badge variant="outline" className={cn("text-[10px]",
                            session.status === 'completed' && "border-success/30 text-success",
                            session.status === 'cancelled' && "border-destructive/30 text-destructive"
                          )}>{session.status === 'completed' ? 'مكتملة' : 'ملغاة'}</Badge>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">اختر طالب من القائمة أعلاه لعرض حصصه وسجله</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
