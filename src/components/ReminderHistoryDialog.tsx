import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { History, CheckCircle, XCircle, Clock, RefreshCw, Loader2, MessageCircle, Banknote, AlertTriangle } from 'lucide-react';
import { useReminderSettings } from '@/hooks/useReminderSettings';
import { ReminderLog } from '@/types/reminder';
import { format, parseISO, isWithinInterval, subDays, subWeeks, subMonths } from 'date-fns';
import { ar } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

type FilterType = 'session' | 'payment' | 'cancellation';
type FilterStatus = 'sent' | 'failed';
type FilterTime = 'week' | 'month';

export const ReminderHistoryDialog = () => {
  const { logs, fetchLogs, retryFailedReminders } = useReminderSettings();
  const [open, setOpen] = useState(false);
  const [filterTypes, setFilterTypes] = useState<FilterType[]>([]);
  const [filterStatuses, setFilterStatuses] = useState<FilterStatus[]>([]);
  const [filterTime, setFilterTime] = useState<FilterTime | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [selectedLog, setSelectedLog] = useState<ReminderLog | null>(null);

  const handleRetryFailed = async () => {
    setRetrying(true);
    try {
      const result = await retryFailedReminders();
      toast({
        title: "تمت إعادة المحاولة",
        description: `تم إرسال ${result.success} من ${result.total}`,
      });
    } catch (error) {
      toast({
        title: "خطأ",
        description: "فشلت إعادة المحاولة",
        variant: "destructive",
      });
    } finally {
      setRetrying(false);
    }
  };

  const filteredLogs = logs.filter(log => {
    // Type filter - if any selected, log must match one
    if (filterTypes.length > 0 && !filterTypes.includes(log.type as FilterType)) return false;
    
    // Status filter - if any selected, log must match one
    if (filterStatuses.length > 0 && !filterStatuses.includes(log.status as FilterStatus)) return false;
    
    // Time filter
    if (filterTime) {
      const logDate = parseISO(log.sent_at);
      const now = new Date();
      
      if (filterTime === 'week') {
        if (!isWithinInterval(logDate, { start: subWeeks(now, 1), end: now })) return false;
      } else if (filterTime === 'month') {
        if (!isWithinInterval(logDate, { start: subMonths(now, 1), end: now })) return false;
      }
    }
    
    return true;
  });

  const toggleTypeFilter = (type: FilterType) => {
    setFilterTypes(prev => 
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const toggleStatusFilter = (status: FilterStatus) => {
    setFilterStatuses(prev => 
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    );
  };

  const toggleTimeFilter = (time: FilterTime) => {
    setFilterTime(prev => prev === time ? null : time);
  };

  const clearFilters = () => {
    setFilterTypes([]);
    setFilterStatuses([]);
    setFilterTime(null);
  };

  const hasActiveFilters = filterTypes.length > 0 || filterStatuses.length > 0 || filterTime !== null;

  const failedCount = logs.filter(l => l.status === 'failed').length;

  const formatDateTime = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), 'dd MMM yyyy، h:mm a', { locale: ar });
    } catch {
      return dateStr;
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <History className="h-4 w-4" />
          <span className="hidden sm:inline">السجل</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-hidden flex flex-col" dir="rtl">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl flex items-center gap-2">
            <History className="h-5 w-5" />
            سجل التذكيرات
          </DialogTitle>
        </DialogHeader>

        {/* Filters */}
        <div className="space-y-2 py-2">
          <div className="flex flex-wrap gap-1.5">
            {/* Type Filters */}
            <button
              onClick={() => toggleTypeFilter('session')}
              className={cn(
                "px-2.5 py-1 rounded-full text-xs font-medium border transition-all",
                filterTypes.includes('session')
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card border-border hover:border-primary/50"
              )}
            >
              <MessageCircle className="h-3 w-3 inline ml-1" />
              جلسات
            </button>
            <button
              onClick={() => toggleTypeFilter('payment')}
              className={cn(
                "px-2.5 py-1 rounded-full text-xs font-medium border transition-all",
                filterTypes.includes('payment')
                  ? "bg-warning text-warning-foreground border-warning"
                  : "bg-card border-border hover:border-warning/50"
              )}
            >
              <Banknote className="h-3 w-3 inline ml-1" />
              دفع
            </button>
            <button
              onClick={() => toggleTypeFilter('cancellation')}
              className={cn(
                "px-2.5 py-1 rounded-full text-xs font-medium border transition-all",
                filterTypes.includes('cancellation')
                  ? "bg-destructive text-destructive-foreground border-destructive"
                  : "bg-card border-border hover:border-destructive/50"
              )}
            >
              <AlertTriangle className="h-3 w-3 inline ml-1" />
              إلغاء
            </button>

            <div className="w-px bg-border mx-1" />

            {/* Status Filters */}
            <button
              onClick={() => toggleStatusFilter('sent')}
              className={cn(
                "px-2.5 py-1 rounded-full text-xs font-medium border transition-all",
                filterStatuses.includes('sent')
                  ? "bg-success text-success-foreground border-success"
                  : "bg-card border-border hover:border-success/50"
              )}
            >
              <CheckCircle className="h-3 w-3 inline ml-1" />
              نجح
            </button>
            <button
              onClick={() => toggleStatusFilter('failed')}
              className={cn(
                "px-2.5 py-1 rounded-full text-xs font-medium border transition-all",
                filterStatuses.includes('failed')
                  ? "bg-destructive text-destructive-foreground border-destructive"
                  : "bg-card border-border hover:border-destructive/50"
              )}
            >
              <XCircle className="h-3 w-3 inline ml-1" />
              فشل
            </button>

            <div className="w-px bg-border mx-1" />

            {/* Time Filters */}
            <button
              onClick={() => toggleTimeFilter('week')}
              className={cn(
                "px-2.5 py-1 rounded-full text-xs font-medium border transition-all",
                filterTime === 'week'
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card border-border hover:border-primary/50"
              )}
            >
              <Clock className="h-3 w-3 inline ml-1" />
              أسبوع
            </button>
            <button
              onClick={() => toggleTimeFilter('month')}
              className={cn(
                "px-2.5 py-1 rounded-full text-xs font-medium border transition-all",
                filterTime === 'month'
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card border-border hover:border-primary/50"
              )}
            >
              <Clock className="h-3 w-3 inline ml-1" />
              شهر
            </button>
          </div>

          <div className="flex items-center justify-between">
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground"
                onClick={clearFilters}
              >
                مسح الفلاتر
              </Button>
            )}
            {failedCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1 text-xs border-warning text-warning hover:bg-warning/10 mr-auto"
                onClick={handleRetryFailed}
                disabled={retrying}
              >
                {retrying ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
                إعادة ({failedCount})
              </Button>
            )}
          </div>
        </div>

        {/* Log List */}
        <ScrollArea className="flex-1 -mx-6 px-6">
          {filteredLogs.length === 0 ? (
            <div className="py-12 text-center">
              <History className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">لا توجد تذكيرات مسجلة</p>
            </div>
          ) : (
            <div className="space-y-2 pb-4">
              {filteredLogs.map(log => (
                <button
                  key={log.id}
                  onClick={() => setSelectedLog(log)}
                  className={cn(
                    "w-full text-right p-3 rounded-lg border transition-all hover:bg-accent",
                    log.status === 'sent' ? "bg-success/5 border-success/20" : "bg-destructive/5 border-destructive/20"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {log.status === 'sent' ? (
                        <CheckCircle className="h-4 w-4 text-success shrink-0" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{log.student_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(log.sent_at)}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className={cn(
                      "shrink-0 text-[10px]",
                      log.type === 'session' ? "border-primary/50 text-primary" : 
                      log.type === 'cancellation' ? "border-destructive/50 text-destructive" :
                      "border-warning/50 text-warning"
                    )}>
                      {log.type === 'session' ? (
                        <><MessageCircle className="h-3 w-3 ml-1" />جلسة</>
                      ) : log.type === 'cancellation' ? (
                        <><AlertTriangle className="h-3 w-3 ml-1" />إلغاء</>
                      ) : (
                        <><Banknote className="h-3 w-3 ml-1" />دفع</>
                      )}
                    </Badge>
                  </div>
                  {log.status === 'failed' && log.error_message && (
                    <p className="text-xs text-destructive mt-1 truncate">
                      {log.error_message}
                    </p>
                  )}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Detail Modal */}
        {selectedLog && (
          <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
            <DialogContent className="sm:max-w-md" dir="rtl">
              <DialogHeader>
                <DialogTitle className="font-heading">تفاصيل التذكير</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">النوع</p>
                    <p className="font-medium">{selectedLog.type === 'session' ? 'تذكير جلسة' : selectedLog.type === 'cancellation' ? 'إشعار إلغاء' : 'تذكير دفع'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">الحالة</p>
                    <p className={cn("font-medium", selectedLog.status === 'sent' ? "text-success" : "text-destructive")}>
                      {selectedLog.status === 'sent' ? '✓ تم الإرسال' : '❌ فشل'}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">الطالب</p>
                    <p className="font-medium">{selectedLog.student_name}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">الرقم</p>
                    <p className="font-medium" dir="ltr">{selectedLog.phone_number}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-muted-foreground text-xs">التاريخ</p>
                    <p className="font-medium">{formatDateTime(selectedLog.sent_at)}</p>
                  </div>
                </div>

                <div>
                  <p className="text-muted-foreground text-xs mb-1">الرسالة المرسلة:</p>
                  <div className="p-3 rounded-lg bg-muted/50 border text-sm whitespace-pre-wrap">
                    {selectedLog.message_text}
                  </div>
                </div>

                {selectedLog.twilio_message_sid && (
                  <div>
                    <p className="text-muted-foreground text-xs">Twilio Message SID</p>
                    <p className="text-xs font-mono">{selectedLog.twilio_message_sid}</p>
                  </div>
                )}

                {selectedLog.error_message && (
                  <div>
                    <p className="text-muted-foreground text-xs">سبب الفشل</p>
                    <p className="text-sm text-destructive">{selectedLog.error_message}</p>
                  </div>
                )}

                <Button variant="outline" onClick={() => setSelectedLog(null)} className="w-full">
                  إغلاق
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
};
