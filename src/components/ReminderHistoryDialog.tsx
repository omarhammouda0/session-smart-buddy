import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { History, CheckCircle, XCircle, Clock, RefreshCw, Loader2, MessageCircle, Banknote, AlertTriangle } from 'lucide-react';
import { useReminderSettings } from '@/hooks/useReminderSettings';
import { ReminderLog } from '@/types/reminder';
import { format, parseISO, isWithinInterval, subDays, subWeeks, subMonths } from 'date-fns';
import { ar } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

type FilterType = 'all' | 'session' | 'payment' | 'cancellation';
type FilterStatus = 'all' | 'sent' | 'failed';
type FilterTime = 'all' | 'week' | 'month';

export const ReminderHistoryDialog = () => {
  const { logs, fetchLogs, retryFailedReminders } = useReminderSettings();
  const [open, setOpen] = useState(false);
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [filterTime, setFilterTime] = useState<FilterTime>('all');
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
    if (filterType !== 'all' && log.type !== filterType) return false;
    if (filterStatus !== 'all' && log.status !== filterStatus) return false;
    
    if (filterTime !== 'all') {
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
        <div className="flex flex-wrap gap-2 py-2">
          <Select value={filterType} onValueChange={(v) => setFilterType(v as FilterType)}>
            <SelectTrigger className="w-28 h-8 text-xs">
              <SelectValue placeholder="النوع" />
            </SelectTrigger>
            <SelectContent className="bg-popover z-50">
              <SelectItem value="all">الكل</SelectItem>
              <SelectItem value="session">جلسات</SelectItem>
              <SelectItem value="payment">دفع</SelectItem>
              <SelectItem value="cancellation">إلغاء</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as FilterStatus)}>
            <SelectTrigger className="w-28 h-8 text-xs">
              <SelectValue placeholder="الحالة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">الكل</SelectItem>
              <SelectItem value="sent">تم الإرسال</SelectItem>
              <SelectItem value="failed">فشل</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterTime} onValueChange={(v) => setFilterTime(v as FilterTime)}>
            <SelectTrigger className="w-28 h-8 text-xs">
              <SelectValue placeholder="الفترة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">الكل</SelectItem>
              <SelectItem value="week">آخر أسبوع</SelectItem>
              <SelectItem value="month">آخر شهر</SelectItem>
            </SelectContent>
          </Select>

          {failedCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1 text-xs border-warning text-warning hover:bg-warning/10"
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
