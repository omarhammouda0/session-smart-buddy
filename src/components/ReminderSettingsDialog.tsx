import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Bell, Clock, Banknote, MessageCircle, Loader2, CheckCircle, XCircle, Info, AlertTriangle } from 'lucide-react';
import { useReminderSettings } from '@/hooks/useReminderSettings';
import { REMINDER_HOURS_OPTIONS, PAYMENT_DAYS_OPTIONS, SEND_TIME_OPTIONS } from '@/types/reminder';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export const ReminderSettingsDialog = () => {
  const { settings, isLoading, isSaving, saveSettings } = useReminderSettings();
  const [open, setOpen] = useState(false);
  const [testing, setTesting] = useState(false);
  
  // Local state for editing
  const [sessionEnabled, setSessionEnabled] = useState(false);
  const [sessionHours, setSessionHours] = useState(24);
  const [sessionHours2, setSessionHours2] = useState(1);
  const [sessionSendTime, setSessionSendTime] = useState('09:00');
  const [sessionTemplate, setSessionTemplate] = useState('');
  const [paymentEnabled, setPaymentEnabled] = useState(false);
  const [paymentDays, setPaymentDays] = useState(3);
  const [paymentTemplate, setPaymentTemplate] = useState('');
  const [cancellationEnabled, setCancellationEnabled] = useState(false);
  const [cancellationTemplate, setCancellationTemplate] = useState('');

  // Sync local state with fetched settings
  useEffect(() => {
    if (settings) {
      setSessionEnabled(settings.session_reminders_enabled);
      setSessionHours(settings.session_reminder_hours);
      setSessionHours2(settings.session_reminder_hours_2 || 1);
      setSessionSendTime(settings.session_reminder_send_time);
      setSessionTemplate(settings.session_reminder_template);
      setPaymentEnabled(settings.payment_reminders_enabled);
      setPaymentDays(settings.payment_reminder_days_before);
      setPaymentTemplate(settings.payment_reminder_template);
      setCancellationEnabled(settings.cancellation_reminders_enabled);
      setCancellationTemplate(settings.cancellation_reminder_template);
    }
  }, [settings]);

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen && settings) {
      setSessionEnabled(settings.session_reminders_enabled);
      setSessionHours(settings.session_reminder_hours);
      setSessionHours2(settings.session_reminder_hours_2 || 1);
      setSessionSendTime(settings.session_reminder_send_time);
      setSessionTemplate(settings.session_reminder_template);
      setPaymentEnabled(settings.payment_reminders_enabled);
      setPaymentDays(settings.payment_reminder_days_before);
      setPaymentTemplate(settings.payment_reminder_template);
      setCancellationEnabled(settings.cancellation_reminders_enabled);
      setCancellationTemplate(settings.cancellation_reminder_template);
    }
    setOpen(isOpen);
  };

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      const testMessage = 'رسالة تجريبية من تطبيق متابعة الطلاب\nTwilio configured successfully!';
      const { data, error } = await supabase.functions.invoke('send-whatsapp-reminder', {
        body: {
          // Both old and new field names for compatibility
          phone: '+201000000000',
          message: testMessage,
          phoneNumber: '+201000000000',
          customMessage: testMessage,
          studentName: 'اختبار',
          testMode: true,
        },
      });

      if (error) throw error;

      toast({
        title: "✓ الاتصال ناجح",
        description: "Twilio مكوّن بشكل صحيح",
      });
    } catch (error: any) {
      console.error('Test connection error:', error);
      toast({
        title: "❌ فشل الاتصال",
        description: error.message || "تحقق من إعدادات Twilio",
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    const success = await saveSettings({
      session_reminders_enabled: sessionEnabled,
      session_reminder_hours: sessionHours,
      session_reminder_hours_2: sessionHours2,
      session_reminder_send_time: sessionSendTime,
      session_reminder_template: sessionTemplate,
      payment_reminders_enabled: paymentEnabled,
      payment_reminder_days_before: paymentDays,
      payment_reminder_template: paymentTemplate,
      cancellation_reminders_enabled: cancellationEnabled,
      cancellation_reminder_template: cancellationTemplate,
    });

    if (success) {
      setOpen(false);
    }
  };

  const formatTimeDisplay = (time: string) => {
    const [hours] = time.split(':');
    const hour = parseInt(hours);
    if (hour === 0) return '12:00 ص';
    if (hour === 12) return '12:00 م';
    if (hour > 12) return `${hour - 12}:00 م`;
    return `${hour}:00 ص`;
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Bell className="h-4 w-4" />
          <span className="hidden sm:inline">التذكيرات</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col" dir="rtl">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl flex items-center gap-2">
            <Bell className="h-5 w-5" />
            إعدادات التذكيرات التلقائية
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="mt-2 text-muted-foreground">جاري التحميل...</p>
          </div>
        ) : (
          <>
          <DialogBody>
            <div className="space-y-5 pt-4">
            {/* Twilio Connection Test */}
            <div className="p-4 rounded-lg bg-muted/50 border space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-green-600" />
                  <span className="font-medium text-sm">Twilio WhatsApp</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTestConnection}
                  disabled={testing}
                >
                  {testing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'اختبار الاتصال'
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                تم تكوين Twilio مسبقاً. اضغط لاختبار الاتصال.
              </p>
            </div>

            <Separator />

            {/* Session Reminders */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span className="font-medium">تذكيرات الجلسات</span>
                </div>
                <Switch
                  checked={sessionEnabled}
                  onCheckedChange={setSessionEnabled}
                />
              </div>

              {sessionEnabled && (
                <div className="space-y-4 pr-6 border-r-2 border-primary/20">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs">التذكير الأول (قبل):</Label>
                      <Select value={String(sessionHours)} onValueChange={(v) => setSessionHours(parseInt(v))}>
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {REMINDER_HOURS_OPTIONS.map((h) => (
                            <SelectItem key={h} value={String(h)}>
                              {h} ساعة
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">التذكير الثاني (قبل):</Label>
                      <Select value={String(sessionHours2)} onValueChange={(v) => setSessionHours2(parseInt(v))}>
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {REMINDER_HOURS_OPTIONS.map((h) => (
                            <SelectItem key={h} value={String(h)}>
                              {h} ساعة
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">نص الرسالة (للتذكيرين):</Label>
                    <Textarea
                      value={sessionTemplate}
                      onChange={(e) => setSessionTemplate(e.target.value)}
                      rows={4}
                      className="text-sm resize-none"
                      maxLength={1600}
                    />
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>المتغيرات: {'{student_name}'}, {'{date}'}, {'{time}'}, {'{day}'}</span>
                      <span>{sessionTemplate.length} / 1600</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Payment Reminders */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Banknote className="h-4 w-4" />
                  <span className="font-medium">تذكيرات الدفع</span>
                </div>
                <Switch
                  checked={paymentEnabled}
                  onCheckedChange={setPaymentEnabled}
                />
              </div>

              {paymentEnabled && (
                <div className="space-y-4 pr-6 border-r-2 border-primary/20">
                  <div className="space-y-2">
                    <Label className="text-xs">إرسال قبل نهاية الشهر:</Label>
                    <Select value={String(paymentDays)} onValueChange={(v) => setPaymentDays(parseInt(v))}>
                      <SelectTrigger className="h-9 w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAYMENT_DAYS_OPTIONS.map((d) => (
                          <SelectItem key={d} value={String(d)}>
                            {d} {d === 1 ? 'يوم' : 'أيام'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">نص الرسالة:</Label>
                    <Textarea
                      value={paymentTemplate}
                      onChange={(e) => setPaymentTemplate(e.target.value)}
                      rows={5}
                      className="text-sm resize-none"
                      maxLength={1600}
                    />
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>المتغيرات: {'{student_name}'}, {'{month}'}, {'{sessions}'}, {'{amount}'}</span>
                      <span>{paymentTemplate.length} / 1600</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Cancellation Reminders */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="font-medium">تذكيرات الإلغاء</span>
                </div>
                <Switch
                  checked={cancellationEnabled}
                  onCheckedChange={setCancellationEnabled}
                />
              </div>

              {cancellationEnabled && (
                <div className="space-y-4 pr-6 border-r-2 border-primary/20">
                  <div className="space-y-2">
                    <Label className="text-xs">نص الرسالة:</Label>
                    <Textarea
                      value={cancellationTemplate}
                      onChange={(e) => setCancellationTemplate(e.target.value)}
                      rows={5}
                      className="text-sm resize-none"
                      maxLength={1600}
                    />
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>المتغيرات: {'{student_name}'}, {'{month}'}, {'{limit}'}</span>
                      <span>{cancellationTemplate.length} / 1600</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Info Note */}
            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <div className="flex gap-2">
                <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">
                  التذكيرات التلقائية تُرسل في الوقت المحدد يومياً. يمكنك أيضاً إرسال تذكيرات يدوية من صفحة المدفوعات.
                </p>
              </div>
            </div>
            </div>
          </DialogBody>

          <DialogFooter className="flex-row-reverse gap-3 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)} className="flex-1">
              إلغاء
            </Button>
            <Button onClick={handleSave} disabled={isSaving} className="flex-1 gradient-primary">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'حفظ الإعدادات'}
            </Button>
          </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
