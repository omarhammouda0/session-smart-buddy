import { useState, useMemo } from 'react';
import { Palmtree, Calendar, Users, Send, AlertTriangle, Plus, X, Check, ChevronDown, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogBody,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Student, Session } from '@/types/student';
import { format, parseISO, addDays, startOfWeek, endOfWeek, addWeeks, startOfMonth, endOfMonth, addMonths, isWithinInterval, isBefore, isAfter } from 'date-fns';
import { ar } from 'date-fns/locale';
import { MONTH_NAMES_AR, DAY_NAMES_AR, formatShortDateAr } from '@/lib/arabicConstants';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

interface AddVacationDialogProps {
  students: Student[];
  onBulkMarkAsVacation: (studentIds: string[], sessionIds: string[]) => void;
}

interface PeriodOption {
  id: string;
  label: string;
  dateRange: string;
  start: Date;
  end: Date;
  type: 'week' | 'month' | 'custom';
}

interface SelectedPeriod {
  id: string;
  label: string;
  dateRange: string;
  start: Date;
  end: Date;
  type: 'week' | 'month' | 'custom';
}

interface SessionToMark {
  studentId: string;
  studentName: string;
  session: Session;
  periodId: string;
}

export const AddVacationDialog = ({
  students,
  onBulkMarkAsVacation,
}: AddVacationDialogProps) => {
  const [open, setOpen] = useState(false);
  const [periodPopoverOpen, setPeriodPopoverOpen] = useState(false);
  const [selectedPeriods, setSelectedPeriods] = useState<SelectedPeriod[]>([]);
  const [tempSelectedPeriodIds, setTempSelectedPeriodIds] = useState<Set<string>>(new Set());
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [useCustomRange, setUseCustomRange] = useState(false);
  const [reason, setReason] = useState('');
  const [notifyParents, setNotifyParents] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  
  // Collapsible section states
  const [weeksOpen, setWeeksOpen] = useState(true);
  const [monthsOpen, setMonthsOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);

  const today = new Date();

  // Generate predefined period options
  const periodOptions = useMemo((): PeriodOption[] => {
    const options: PeriodOption[] = [];
    const now = new Date();

    // Generate next 4 weeks
    for (let i = 0; i < 4; i++) {
      const weekStart = addWeeks(startOfWeek(now, { weekStartsOn: 0 }), i);
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 0 });
      
      let label = '';
      if (i === 0) label = 'هذا الأسبوع';
      else if (i === 1) label = 'الأسبوع القادم';
      else if (i === 2) label = 'الأسبوع الثالث';
      else label = 'الأسبوع الرابع';

      const startMonth = MONTH_NAMES_AR[weekStart.getMonth()];
      const endMonth = MONTH_NAMES_AR[weekEnd.getMonth()];
      const dateRange = startMonth === endMonth 
        ? `${format(weekStart, 'd', { locale: ar })}-${format(weekEnd, 'd', { locale: ar })} ${startMonth}`
        : `${format(weekStart, 'd', { locale: ar })} ${startMonth} - ${format(weekEnd, 'd', { locale: ar })} ${endMonth}`;
      
      options.push({
        id: `week-${i}`,
        label,
        dateRange,
        start: weekStart,
        end: weekEnd,
        type: 'week',
      });
    }

    // Generate next 6 full months
    for (let i = 0; i < 6; i++) {
      const monthDate = addMonths(now, i);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);
      const monthName = MONTH_NAMES_AR[monthDate.getMonth()];
      const year = monthDate.getFullYear();
      const daysInMonth = monthEnd.getDate();
      
      options.push({
        id: `month-${i}`,
        label: `${monthName} ${year}`,
        dateRange: `1-${daysInMonth} ${monthName}`,
        start: monthStart,
        end: monthEnd,
        type: 'month',
      });
    }

    return options;
  }, []);

  const weekOptions = periodOptions.filter(p => p.type === 'week');
  const monthOptions = periodOptions.filter(p => p.type === 'month');

  // Handle period selection in popover
  const togglePeriodInTemp = (periodId: string) => {
    setTempSelectedPeriodIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(periodId)) {
        newSet.delete(periodId);
      } else {
        newSet.add(periodId);
      }
      return newSet;
    });
  };

  const selectAllPeriods = () => {
    const allIds = new Set(periodOptions.map(p => p.id));
    setTempSelectedPeriodIds(allIds);
  };

  const deselectAllPeriods = () => {
    setTempSelectedPeriodIds(new Set());
    setUseCustomRange(false);
  };

  const addSelectedPeriods = () => {
    const newPeriods: SelectedPeriod[] = [];
    
    // Add predefined periods
    tempSelectedPeriodIds.forEach(id => {
      const option = periodOptions.find(p => p.id === id);
      if (option && !selectedPeriods.some(p => p.id === id)) {
        newPeriods.push({
          id: option.id,
          label: option.label,
          dateRange: option.dateRange,
          start: option.start,
          end: option.end,
          type: option.type,
        });
      }
    });

    // Add custom range if enabled
    if (useCustomRange && customStart && customEnd) {
      const customId = `custom-${customStart}-${customEnd}`;
      if (!selectedPeriods.some(p => p.id === customId)) {
        const start = parseISO(customStart);
        const end = parseISO(customEnd);
        newPeriods.push({
          id: customId,
          label: 'نطاق مخصص',
          dateRange: `${format(start, 'd MMMM', { locale: ar })} - ${format(end, 'd MMMM', { locale: ar })}`,
          start,
          end,
          type: 'custom',
        });
      }
    }

    setSelectedPeriods(prev => [...prev, ...newPeriods]);
    setPeriodPopoverOpen(false);
    setTempSelectedPeriodIds(new Set());
    setUseCustomRange(false);
    setCustomStart('');
    setCustomEnd('');
  };

  const removePeriod = (periodId: string) => {
    setSelectedPeriods(prev => prev.filter(p => p.id !== periodId));
  };

  // Find all scheduled sessions in all selected periods
  const sessionsToMark = useMemo((): SessionToMark[] => {
    if (selectedPeriods.length === 0) return [];

    const sessions: SessionToMark[] = [];
    const addedSessionIds = new Set<string>();
    
    students.forEach(student => {
      student.sessions.forEach(session => {
        if (session.status !== 'scheduled') return;
        if (addedSessionIds.has(session.id)) return; // Avoid duplicates from overlapping periods
        
        const sessionDate = parseISO(session.date);
        
        // Check if session is in any selected period
        for (const period of selectedPeriods) {
          if (isWithinInterval(sessionDate, { start: period.start, end: period.end })) {
            sessions.push({
              studentId: student.id,
              studentName: student.name,
              session,
              periodId: period.id,
            });
            addedSessionIds.add(session.id);
            break; // Don't add same session multiple times
          }
        }
      });
    });

    // Sort by date
    return sessions.sort((a, b) => a.session.date.localeCompare(b.session.date));
  }, [students, selectedPeriods]);

  // Count unique students affected
  const affectedStudents = useMemo(() => {
    const studentIds = new Set(sessionsToMark.map(s => s.studentId));
    return studentIds.size;
  }, [sessionsToMark]);

  // Group sessions by period for preview
  const sessionsByPeriod = useMemo(() => {
    const grouped: Record<string, SessionToMark[]> = {};
    selectedPeriods.forEach(period => {
      grouped[period.id] = sessionsToMark.filter(s => {
        const sessionDate = parseISO(s.session.date);
        return isWithinInterval(sessionDate, { start: period.start, end: period.end });
      });
    });
    return grouped;
  }, [sessionsToMark, selectedPeriods]);

  // Count sessions per period for summary
  const periodSessionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    selectedPeriods.forEach(period => {
      counts[period.id] = (sessionsByPeriod[period.id] || []).length;
    });
    return counts;
  }, [sessionsByPeriod, selectedPeriods]);

  const selectedCount = tempSelectedPeriodIds.size + (useCustomRange && customStart && customEnd ? 1 : 0);

  const handleApply = () => {
    if (sessionsToMark.length === 0) {
      toast({
        title: "لا توجد جلسات",
        description: "لم يتم العثور على جلسات مجدولة في الفترات المختارة",
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
    handleOpenChange(false);
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setShowPreview(false);
      setSelectedPeriods([]);
      setTempSelectedPeriodIds(new Set());
      setReason('');
      setNotifyParents(false);
      setCustomStart('');
      setCustomEnd('');
      setUseCustomRange(false);
    }
    setOpen(isOpen);
  };

  const handlePopoverOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      // Pre-select already added periods
      setTempSelectedPeriodIds(new Set(selectedPeriods.filter(p => p.type !== 'custom').map(p => p.id)));
    }
    setPeriodPopoverOpen(isOpen);
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
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col" dir="rtl">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <Palmtree className="h-5 w-5 text-warning" />
            إضافة فترة إجازة
          </DialogTitle>
        </DialogHeader>

        {!showPreview ? (
          <DialogBody>
            <div className="space-y-4 py-2">
            {/* Period Selection */}
            <div className="space-y-3">
              <Label className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                اختر الفترات (يمكن اختيار أكثر من واحدة)
              </Label>
              
              {/* Add Period Button */}
              <Popover open={periodPopoverOpen} onOpenChange={handlePopoverOpenChange}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full gap-2 justify-start">
                    <Plus className="h-4 w-4" />
                    إضافة فترة
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0 bg-popover z-50 max-h-[80vh] overflow-hidden flex flex-col" align="start">
                  <div className="p-2.5 border-b">
                    <h4 className="font-medium text-sm">اختر فترة الإجازة</h4>
                  </div>
                  
                  <ScrollArea className="flex-1 min-h-0">
                    <div className="p-2 space-y-1">
                      {/* Week Options - Collapsible */}
                      <Collapsible open={weeksOpen} onOpenChange={setWeeksOpen}>
                        <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded-md hover:bg-muted/50 transition-colors">
                          <span className="text-sm font-medium flex items-center gap-1.5">
                            📅 الأسابيع
                            {weekOptions.filter(o => tempSelectedPeriodIds.has(o.id)).length > 0 && (
                              <Badge variant="secondary" className="text-[10px] h-4 px-1">
                                {weekOptions.filter(o => tempSelectedPeriodIds.has(o.id)).length}
                              </Badge>
                            )}
                          </span>
                          {weeksOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                        </CollapsibleTrigger>
                        <CollapsibleContent className="space-y-1 pr-2 pt-1">
                          {weekOptions.map(option => (
                            <label
                              key={option.id}
                              className={cn(
                                "flex items-center gap-2 p-1.5 rounded-md border cursor-pointer transition-colors text-sm",
                                tempSelectedPeriodIds.has(option.id)
                                  ? "bg-warning/10 border-warning"
                                  : "hover:bg-muted/50 border-transparent"
                              )}
                            >
                              <Checkbox
                                checked={tempSelectedPeriodIds.has(option.id)}
                                onCheckedChange={() => togglePeriodInTemp(option.id)}
                                className="h-4 w-4"
                              />
                              <span className="flex-1 truncate">
                                {option.label} <span className="text-muted-foreground text-xs">({option.dateRange})</span>
                              </span>
                            </label>
                          ))}
                        </CollapsibleContent>
                      </Collapsible>

                      <Separator className="my-1" />

                      {/* Month Options - Collapsible */}
                      <Collapsible open={monthsOpen} onOpenChange={setMonthsOpen}>
                        <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded-md hover:bg-muted/50 transition-colors">
                          <span className="text-sm font-medium flex items-center gap-1.5">
                            📆 الأشهر الكاملة
                            {monthOptions.filter(o => tempSelectedPeriodIds.has(o.id)).length > 0 && (
                              <Badge variant="secondary" className="text-[10px] h-4 px-1">
                                {monthOptions.filter(o => tempSelectedPeriodIds.has(o.id)).length}
                              </Badge>
                            )}
                          </span>
                          {monthsOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                        </CollapsibleTrigger>
                        <CollapsibleContent className="space-y-1 pr-2 pt-1">
                          {monthOptions.map(option => (
                            <label
                              key={option.id}
                              className={cn(
                                "flex items-center gap-2 p-1.5 rounded-md border cursor-pointer transition-colors text-sm",
                                tempSelectedPeriodIds.has(option.id)
                                  ? "bg-warning/10 border-warning"
                                  : "hover:bg-muted/50 border-transparent"
                              )}
                            >
                              <Checkbox
                                checked={tempSelectedPeriodIds.has(option.id)}
                                onCheckedChange={() => togglePeriodInTemp(option.id)}
                                className="h-4 w-4"
                              />
                              <span className="flex-1 truncate">
                                {option.label} <span className="text-muted-foreground text-xs">({option.dateRange})</span>
                              </span>
                            </label>
                          ))}
                        </CollapsibleContent>
                      </Collapsible>

                      <Separator className="my-1" />

                      {/* Custom Range - Collapsible */}
                      <Collapsible open={customOpen} onOpenChange={setCustomOpen}>
                        <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded-md hover:bg-muted/50 transition-colors">
                          <span className="text-sm font-medium flex items-center gap-1.5">
                            📋 نطاق مخصص
                            {useCustomRange && customStart && customEnd && (
                              <Badge variant="secondary" className="text-[10px] h-4 px-1">1</Badge>
                            )}
                          </span>
                          {customOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                        </CollapsibleTrigger>
                        <CollapsibleContent className="pr-2 pt-1 space-y-2">
                          <label
                            className={cn(
                              "flex items-center gap-2 p-1.5 rounded-md border cursor-pointer transition-colors text-sm",
                              useCustomRange
                                ? "bg-warning/10 border-warning"
                                : "hover:bg-muted/50 border-transparent"
                            )}
                          >
                            <Checkbox
                              checked={useCustomRange}
                              onCheckedChange={(checked) => setUseCustomRange(checked === true)}
                              className="h-4 w-4"
                            />
                            <span>تحديد تواريخ مخصصة</span>
                          </label>
                          
                          {useCustomRange && (
                            <div className="grid grid-cols-2 gap-2 pr-6">
                              <div className="space-y-0.5">
                                <Label className="text-xs">من</Label>
                                <Input
                                  type="date"
                                  value={customStart}
                                  onChange={(e) => setCustomStart(e.target.value)}
                                  className="h-8 text-sm"
                                />
                              </div>
                              <div className="space-y-0.5">
                                <Label className="text-xs">إلى</Label>
                                <Input
                                  type="date"
                                  value={customEnd}
                                  onChange={(e) => setCustomEnd(e.target.value)}
                                  className="h-8 text-sm"
                                />
                              </div>
                            </div>
                          )}
                        </CollapsibleContent>
                      </Collapsible>
                    </div>
                  </ScrollArea>

                  <div className="p-2 border-t space-y-1.5 bg-background">
                    <div className="flex gap-1.5">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={selectAllPeriods}
                        className="flex-1 text-xs h-7"
                      >
                        تحديد الكل
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={deselectAllPeriods}
                        className="flex-1 text-xs h-7"
                      >
                        إلغاء التحديد
                      </Button>
                    </div>
                    <div className="flex gap-1.5">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setPeriodPopoverOpen(false)}
                        className="flex-1 h-8"
                      >
                        إلغاء
                      </Button>
                      <Button 
                        size="sm" 
                        onClick={addSelectedPeriods}
                        disabled={selectedCount === 0}
                        className="flex-1 h-8 bg-warning text-warning-foreground hover:bg-warning/90"
                      >
                        إضافة ({selectedCount})
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              {/* Selected Periods as Chips */}
              {selectedPeriods.length > 0 && (
                <div className="space-y-2">
                  {selectedPeriods.map(period => {
                    const chipLabel = period.type === 'month' 
                      ? `${period.label} (شهر كامل)`
                      : period.type === 'custom'
                        ? `${period.dateRange} (مخصص)`
                        : `${period.label} (${period.dateRange})`;
                    
                    return (
                      <div
                        key={period.id}
                        className="flex items-center justify-between p-2.5 rounded-lg bg-warning/10 border border-warning/30"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Palmtree className="h-4 w-4 text-warning shrink-0" />
                          <p className="text-sm font-medium truncate">{chipLabel}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="secondary" className="text-xs">
                            {periodSessionCounts[period.id] || 0} جلسة
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                            onClick={() => removePeriod(period.id)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
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
            {selectedPeriods.length > 0 && (
              <div className="p-3 rounded-lg bg-warning/10 border border-warning/30">
                <div className="flex items-center gap-2 text-warning mb-2">
                  <Palmtree className="h-4 w-4" />
                  <span className="font-medium">ملخص الإجازة</span>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">الفترات:</span>
                    <span className="font-medium">{selectedPeriods.length} فترة</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">الجلسات:</span>
                    <span className="font-medium">{sessionsToMark.length} جلسة</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">الطلاب:</span>
                    <span className="font-medium">{affectedStudents} طالب</span>
                  </div>
                </div>
                
                {/* Breakdown by period */}
                {selectedPeriods.length > 1 && (
                  <div className="mt-2 pt-2 border-t border-warning/20">
                    <p className="text-xs text-muted-foreground mb-1">التوزيع:</p>
                    <div className="space-y-0.5">
                      {selectedPeriods.map(period => (
                        <div key={period.id} className="flex justify-between text-xs">
                          <span>{period.label}</span>
                          <span>{periodSessionCounts[period.id] || 0} جلسة</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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

            {selectedPeriods.length > 0 && sessionsToMark.length === 0 && (
              <div className="p-3 rounded-lg bg-muted border flex items-center gap-2 text-sm">
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">لا توجد جلسات مجدولة في الفترات المختارة</span>
              </div>
            )}
            </div>
          </DialogBody>
        ) : (
          /* Preview View */
          <DialogBody>
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="font-medium">معاينة ({sessionsToMark.length} جلسة)</span>
                <Button variant="ghost" size="sm" onClick={() => setShowPreview(false)}>
                  ← رجوع
                </Button>
              </div>
              
              <div className="space-y-4">
                {selectedPeriods.map(period => {
                  const periodSessions = sessionsByPeriod[period.id] || [];
                  if (periodSessions.length === 0) return null;
                  
                  return (
                    <div key={period.id} className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium text-warning">
                        <Palmtree className="h-4 w-4" />
                        <span>{period.label}</span>
                        <span className="text-muted-foreground">({period.dateRange})</span>
                      </div>
                      <div className="space-y-1 mr-6">
                        {periodSessions.map((s) => (
                          <div
                            key={s.session.id}
                            className="flex items-center justify-between p-2 rounded-lg bg-warning/10 border border-warning/20"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">
                                {format(parseISO(s.session.date), 'EEEE d MMMM', { locale: ar })}
                              </span>
                              <span className="font-medium">{s.studentName}</span>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {s.session.time || '16:00'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </DialogBody>
        )}

        <DialogFooter className="flex-row-reverse gap-2 pt-2">
          {!showPreview ? (
            <>
              <Button 
                variant="outline" 
                onClick={() => handleOpenChange(false)}
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
                disabled={sessionsToMark.length === 0 || selectedPeriods.length === 0}
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
