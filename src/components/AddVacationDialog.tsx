import { useState, useMemo } from 'react';
import { Palmtree, Calendar, Users, Send, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Student, Session } from '@/types/student';
import { format, parseISO, addDays, startOfWeek, endOfWeek, addWeeks, startOfMonth, endOfMonth, isWithinInterval, isBefore } from 'date-fns';
import { ar } from 'date-fns/locale';
import { MONTH_NAMES_AR, DAY_NAMES_AR, formatShortDateAr } from '@/lib/arabicConstants';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

interface AddVacationDialogProps {
  students: Student[];
  onBulkMarkAsVacation: (studentIds: string[], sessionIds: string[]) => void;
}

type PeriodType = 'this-week' | 'next-week' | 'custom';

interface SessionToMark {
  studentId: string;
  studentName: string;
  session: Session;
}

export const AddVacationDialog = ({
  students,
  onBulkMarkAsVacation,
}: AddVacationDialogProps) => {
  const [open, setOpen] = useState(false);
  const [periodType, setPeriodType] = useState<PeriodType>('this-week');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [reason, setReason] = useState('');
  const [notifyParents, setNotifyParents] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const today = new Date();

  // Calculate period date range based on selection
  const periodRange = useMemo(() => {
    const now = new Date();
    switch (periodType) {
      case 'this-week':
        return {
          start: startOfWeek(now, { weekStartsOn: 0 }),
          end: endOfWeek(now, { weekStartsOn: 0 }),
          label: 'هذا الأسبوع',
        };
      case 'next-week':
        const nextWeekStart = addWeeks(startOfWeek(now, { weekStartsOn: 0 }), 1);
        return {
          start: nextWeekStart,
          end: endOfWeek(nextWeekStart, { weekStartsOn: 0 }),
          label: 'الأسبوع القادم',
        };
      case 'custom':
        if (customStart && customEnd) {
          return {
            start: parseISO(customStart),
            end: parseISO(customEnd),
            label: 'نطاق مخصص',
          };
        }
        return null;
      default:
        return null;
    }
  }, [periodType, customStart, customEnd]);

  // Format period dates for display
  const periodLabel = useMemo(() => {
    if (!periodRange) return '';
    return `${format(periodRange.start, 'd', { locale: ar })} - ${format(periodRange.end, 'd MMMM yyyy', { locale: ar })}`;
  }, [periodRange]);

  // Find all scheduled sessions in the period
  const sessionsToMark = useMemo((): SessionToMark[] => {
    if (!periodRange) return [];

    const sessions: SessionToMark[] = [];
    
    students.forEach(student => {
      student.sessions.forEach(session => {
        if (session.status !== 'scheduled') return;
        
        const sessionDate = parseISO(session.date);
        
        // Check if session is in the selected period
        if (isWithinInterval(sessionDate, { start: periodRange.start, end: periodRange.end })) {
          sessions.push({
            studentId: student.id,
            studentName: student.name,
            session,
          });
        }
      });
    });

    // Sort by date
    return sessions.sort((a, b) => a.session.date.localeCompare(b.session.date));
  }, [students, periodRange]);

  // Count unique students affected
  const affectedStudents = useMemo(() => {
    const studentIds = new Set(sessionsToMark.map(s => s.studentId));
    return studentIds.size;
  }, [sessionsToMark]);

  // Group sessions by date for preview
  const sessionsByDate = useMemo(() => {
    const grouped: Record<string, SessionToMark[]> = {};
    sessionsToMark.forEach(s => {
      if (!grouped[s.session.date]) {
        grouped[s.session.date] = [];
      }
      grouped[s.session.date].push(s);
    });
    return grouped;
  }, [sessionsToMark]);

  const handleApply = () => {
    if (sessionsToMark.length === 0) {
      toast({
        title: "لا توجد جلسات",
        description: "لم يتم العثور على جلسات مجدولة في هذه الفترة",
        variant: "destructive",
      });
      return;
    }

    const studentIds = sessionsToMark.map(s => s.studentId);
    const sessionIds = sessionsToMark.map(s => s.session.id);

    onBulkMarkAsVacation(studentIds, sessionIds);

    toast({
      title: "تم تحديد الإجازة",
      description: `تم تحويل ${sessionsToMark.length} جلسة لـ ${affectedStudents} طالب إلى إجازة`,
    });

    // Reset and close
    setOpen(false);
    setShowPreview(false);
    setPeriodType('this-week');
    setReason('');
    setNotifyParents(false);
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setShowPreview(false);
      setPeriodType('this-week');
      setReason('');
      setNotifyParents(false);
      setCustomStart('');
      setCustomEnd('');
    }
    setOpen(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="gap-1.5 border-warning/50 text-warning hover:bg-warning/10 hover:text-warning"
        >
          <Palmtree className="h-4 w-4" />
          <span className="hidden sm:inline">إضافة إجازة</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-hidden flex flex-col" dir="rtl">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <Palmtree className="h-5 w-5 text-warning" />
            إضافة فترة إجازة
          </DialogTitle>
        </DialogHeader>

        {!showPreview ? (
          <div className="space-y-4 py-2">
            {/* Period Selection */}
            <div className="space-y-3">
              <Label className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                اختر الفترة
              </Label>
              
              <RadioGroup
                value={periodType}
                onValueChange={(v) => setPeriodType(v as PeriodType)}
                className="space-y-2"
              >
                <div className="flex items-center space-x-2 space-x-reverse">
                  <RadioGroupItem value="this-week" id="this-week" />
                  <Label htmlFor="this-week" className="cursor-pointer flex-1">
                    <div className="flex items-center justify-between">
                      <span>هذا الأسبوع</span>
                      <span className="text-xs text-muted-foreground">
                        {format(startOfWeek(today, { weekStartsOn: 0 }), 'd', { locale: ar })} - {format(endOfWeek(today, { weekStartsOn: 0 }), 'd MMMM', { locale: ar })}
                      </span>
                    </div>
                  </Label>
                </div>
                
                <div className="flex items-center space-x-2 space-x-reverse">
                  <RadioGroupItem value="next-week" id="next-week" />
                  <Label htmlFor="next-week" className="cursor-pointer flex-1">
                    <div className="flex items-center justify-between">
                      <span>الأسبوع القادم</span>
                      <span className="text-xs text-muted-foreground">
                        {format(addWeeks(startOfWeek(today, { weekStartsOn: 0 }), 1), 'd', { locale: ar })} - {format(endOfWeek(addWeeks(startOfWeek(today, { weekStartsOn: 0 }), 1)), 'd MMMM', { locale: ar })}
                      </span>
                    </div>
                  </Label>
                </div>
                
                <div className="flex items-center space-x-2 space-x-reverse">
                  <RadioGroupItem value="custom" id="custom" />
                  <Label htmlFor="custom" className="cursor-pointer">نطاق مخصص</Label>
                </div>
              </RadioGroup>

              {/* Custom date range inputs */}
              {periodType === 'custom' && (
                <div className="grid grid-cols-2 gap-3 mr-6">
                  <div className="space-y-1">
                    <Label htmlFor="custom-start" className="text-xs">من</Label>
                    <Input
                      id="custom-start"
                      type="date"
                      value={customStart}
                      onChange={(e) => setCustomStart(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="custom-end" className="text-xs">إلى</Label>
                    <Input
                      id="custom-end"
                      type="date"
                      value={customEnd}
                      onChange={(e) => setCustomEnd(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Reason (optional) */}
            <div className="space-y-2">
              <Label htmlFor="reason">السبب (اختياري)</Label>
              <Input
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="مثال: إجازة نصف العام"
              />
            </div>

            {/* Summary */}
            {periodRange && (
              <div className="p-3 rounded-lg bg-warning/10 border border-warning/30">
                <div className="flex items-center gap-2 text-warning mb-2">
                  <Palmtree className="h-4 w-4" />
                  <span className="font-medium">ملخص الإجازة</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">الفترة: </span>
                    <span className="font-medium">{periodLabel}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">الجلسات: </span>
                    <span className="font-medium">{sessionsToMark.length} جلسة</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">الطلاب: </span>
                    <span className="font-medium">{affectedStudents} طالب</span>
                  </div>
                </div>
              </div>
            )}

            {/* Notify parents option */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="notify"
                checked={notifyParents}
                onCheckedChange={(checked) => setNotifyParents(checked === true)}
              />
              <Label htmlFor="notify" className="cursor-pointer text-sm flex items-center gap-1.5">
                <Send className="h-3.5 w-3.5" />
                إرسال إشعار لأولياء الأمور
              </Label>
            </div>

            {sessionsToMark.length === 0 && periodRange && (
              <div className="p-3 rounded-lg bg-muted border flex items-center gap-2 text-sm">
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">لا توجد جلسات مجدولة في هذه الفترة</span>
              </div>
            )}
          </div>
        ) : (
          /* Preview View */
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <span className="font-medium">معاينة ({sessionsToMark.length} جلسة)</span>
              <Button variant="ghost" size="sm" onClick={() => setShowPreview(false)}>
                ← رجوع
              </Button>
            </div>
            
            <ScrollArea className="flex-1">
              <div className="space-y-3">
                {Object.entries(sessionsByDate)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([date, sessions]) => (
                    <div key={date} className="space-y-1">
                      <div className="text-sm font-medium text-muted-foreground">
                        {format(parseISO(date), 'EEEE d MMMM', { locale: ar })}
                      </div>
                      {sessions.map((s) => (
                        <div
                          key={s.session.id}
                          className="flex items-center justify-between p-2 rounded-lg bg-warning/10 border border-warning/20"
                        >
                          <div className="flex items-center gap-2">
                            <Palmtree className="h-4 w-4 text-warning" />
                            <span className="font-medium">{s.studentName}</span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {s.session.time || '16:00'}
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}
              </div>
            </ScrollArea>
          </div>
        )}

        <DialogFooter className="flex-row-reverse gap-2 pt-2">
          {!showPreview ? (
            <>
              <Button 
                variant="outline" 
                onClick={() => setOpen(false)}
              >
                إلغاء
              </Button>
              {sessionsToMark.length > 0 && (
                <Button 
                  variant="outline"
                  onClick={() => setShowPreview(true)}
                >
                  معاينة
                </Button>
              )}
              <Button
                onClick={handleApply}
                disabled={sessionsToMark.length === 0}
                className="bg-warning text-warning-foreground hover:bg-warning/90"
              >
                <Palmtree className="h-4 w-4 ml-1.5" />
                تطبيق الإجازة ({sessionsToMark.length})
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setShowPreview(false)}>
                رجوع
              </Button>
              <Button
                onClick={handleApply}
                className="bg-warning text-warning-foreground hover:bg-warning/90"
              >
                <Palmtree className="h-4 w-4 ml-1.5" />
                تأكيد الإجازة ({sessionsToMark.length})
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
