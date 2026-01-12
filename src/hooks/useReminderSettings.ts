import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ReminderSettings, ReminderLog, DEFAULT_SESSION_TEMPLATE, DEFAULT_PAYMENT_TEMPLATE, DEFAULT_CANCELLATION_TEMPLATE } from '@/types/reminder';
import { toast } from '@/hooks/use-toast';

const DEFAULT_SETTINGS: ReminderSettings = {
  session_reminders_enabled: false,
  session_reminder_hours: 24,
  session_reminder_hours_2: 1,
  session_reminder_send_time: '09:00',
  session_reminder_template: DEFAULT_SESSION_TEMPLATE,
  payment_reminders_enabled: false,
  payment_reminder_days_before: 3,
  payment_reminder_template: DEFAULT_PAYMENT_TEMPLATE,
  cancellation_reminders_enabled: false,
  cancellation_reminder_template: DEFAULT_CANCELLATION_TEMPLATE,
};

export const useReminderSettings = () => {
  const [settings, setSettings] = useState<ReminderSettings>(DEFAULT_SETTINGS);
  const [logs, setLogs] = useState<ReminderLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch settings on mount
  useEffect(() => {
    fetchSettings();
    fetchLogs();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('reminder_settings')
        .select('*')
        .eq('user_id', 'default')
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettings(data as ReminderSettings);
      }
    } catch (error) {
      console.error('Error fetching reminder settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLogs = async (limit = 50) => {
    try {
      const { data, error } = await supabase
        .from('reminder_log')
        .select('*')
        .eq('user_id', 'default')
        .order('sent_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      setLogs((data as ReminderLog[]) || []);
    } catch (error) {
      console.error('Error fetching reminder logs:', error);
    }
  };

  const saveSettings = async (newSettings: Partial<ReminderSettings>) => {
    setIsSaving(true);
    try {
      const updatedSettings = { ...settings, ...newSettings };

      const { error } = await supabase
        .from('reminder_settings')
        .upsert({
          user_id: 'default',
          ...updatedSettings,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id',
        });

      if (error) throw error;

      setSettings(updatedSettings);
      toast({
        title: "تم الحفظ",
        description: "تم حفظ إعدادات التذكيرات بنجاح",
      });
      return true;
    } catch (error) {
      console.error('Error saving reminder settings:', error);
      toast({
        title: "خطأ",
        description: "فشل حفظ الإعدادات",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const logReminder = async (log: Omit<ReminderLog, 'id' | 'created_at' | 'sent_at' | 'user_id'>) => {
    try {
      const { error } = await supabase
        .from('reminder_log')
        .insert({
          ...log,
          user_id: 'default',
        });

      if (error) throw error;
      await fetchLogs();
    } catch (error) {
      console.error('Error logging reminder:', error);
    }
  };

  const checkReminderSent = async (type: 'session' | 'payment', studentId: string, sessionId?: string, month?: number, year?: number): Promise<boolean> => {
    try {
      let query = supabase
        .from('reminder_log')
        .select('id')
        .eq('user_id', 'default')
        .eq('type', type)
        .eq('student_id', studentId)
        .eq('status', 'sent');

      if (type === 'session' && sessionId) {
        query = query.eq('session_id', sessionId);
      }

      if (type === 'payment' && month !== undefined && year !== undefined) {
        query = query.eq('month', month).eq('year', year);
      }

      const { data, error } = await query.maybeSingle();

      if (error) throw error;

      return !!data;
    } catch (error) {
      console.error('Error checking reminder status:', error);
      return false;
    }
  };

  const retryFailedReminders = async () => {
    const failedLogs = logs.filter(l => l.status === 'failed');
    let successCount = 0;

    for (const log of failedLogs) {
      try {
        const { data, error } = await supabase.functions.invoke('send-whatsapp-reminder', {
          body: {
            // Both old and new field names for compatibility
            phone: log.phone_number,
            message: log.message_text,
            phoneNumber: log.phone_number,
            customMessage: log.message_text,
            studentName: log.student_name,
          },
        });

        if (error) throw error;

        // Update log status
        await supabase
          .from('reminder_log')
          .update({
            status: 'sent',
            twilio_message_sid: data.messageSid,
            error_message: null,
          })
          .eq('id', log.id);

        successCount++;
      } catch (error) {
        console.error('Retry failed for log:', log.id, error);
      }
    }

    await fetchLogs();
    return { total: failedLogs.length, success: successCount };
  };

  return {
    settings,
    logs,
    isLoading,
    isSaving,
    saveSettings,
    logReminder,
    checkReminderSent,
    fetchLogs,
    retryFailedReminders,
  };
};
