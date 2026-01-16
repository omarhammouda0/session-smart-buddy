import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ReminderSettings, ReminderLog, DEFAULT_SESSION_TEMPLATE, DEFAULT_SESSION_TEMPLATE_1, DEFAULT_SESSION_TEMPLATE_2, DEFAULT_PAYMENT_TEMPLATE, DEFAULT_CANCELLATION_TEMPLATE } from '@/types/reminder';
import { toast } from '@/hooks/use-toast';

const DEFAULT_SETTINGS: ReminderSettings = {
  session_reminders_enabled: false,
  session_reminder_hours: 24,
  session_reminder_hours_2: 1,
  session_reminder_send_time: '09:00',
  session_reminder_template: DEFAULT_SESSION_TEMPLATE,
  session_reminder_template_1: DEFAULT_SESSION_TEMPLATE_1,
  session_reminder_template_2: DEFAULT_SESSION_TEMPLATE_2,
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
  const [userId, setUserId] = useState<string | null>(null);

  // Get current user ID
  const getUserId = useCallback(async (): Promise<string | null> => {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      console.error("Auth error:", error);
      return null;
    }
    return data.user?.id ?? null;
  }, []);

  const fetchSettings = useCallback(async (uid: string) => {
    try {
      const { data, error } = await supabase
        .from('reminder_settings')
        .select('*')
        .eq('user_id', uid)
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
  }, []);

  const fetchLogs = useCallback(async (uid: string, limit = 50) => {
    try {
      const { data, error } = await supabase
        .from('reminder_log')
        .select('*')
        .eq('user_id', uid)
        .order('sent_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      setLogs((data as ReminderLog[]) || []);
    } catch (error) {
      console.error('Error fetching reminder logs:', error);
    }
  }, []);

  // Fetch settings on mount
  useEffect(() => {
    const init = async () => {
      const currentUserId = await getUserId();
      if (currentUserId) {
        setUserId(currentUserId);
        await fetchSettings(currentUserId);
        await fetchLogs(currentUserId);
      } else {
        setIsLoading(false);
      }
    };
    init();
  }, [getUserId, fetchSettings, fetchLogs]);

  const saveSettings = async (newSettings: Partial<ReminderSettings>) => {
    let currentUserId = userId;
    if (!currentUserId) {
      currentUserId = await getUserId();
      if (!currentUserId) {
        toast({
          title: "خطأ",
          description: "يجب تسجيل الدخول أولاً",
          variant: "destructive",
        });
        return false;
      }
      setUserId(currentUserId);
    }

    setIsSaving(true);
    try {
      const updatedSettings = { ...settings, ...newSettings };

      const { error } = await supabase
        .from('reminder_settings')
        .upsert({
          user_id: currentUserId,
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
    if (!userId) return;

    try {
      const { error } = await supabase
        .from('reminder_log')
        .insert({
          ...log,
          user_id: userId,
        });

      if (error) throw error;
      await fetchLogs(userId);
    } catch (error) {
      console.error('Error logging reminder:', error);
    }
  };

  const checkReminderSent = async (type: 'session' | 'payment', studentId: string, sessionId?: string, month?: number, year?: number): Promise<boolean> => {
    if (!userId) return false;

    try {
      let query = supabase
        .from('reminder_log')
        .select('id')
        .eq('user_id', userId)
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

    if (userId) {
      await fetchLogs(userId);
    }
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
