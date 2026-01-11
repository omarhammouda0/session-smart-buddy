import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useReminderSettings } from './useReminderSettings';
import { Student } from '@/types/student';
import { format, addHours, parseISO, getDaysInMonth, differenceInHours } from 'date-fns';
import { ar } from 'date-fns/locale';

interface UseAutoRemindersProps {
  students: Student[];
  payments: { studentId: string; payments: { month: number; year: number; isPaid: boolean; amountDue?: number }[] }[];
  settings: { defaultPriceOnsite?: number; defaultPriceOnline?: number };
}

export const useAutoReminders = ({ students, payments, settings: appSettings }: UseAutoRemindersProps) => {
  const { settings, logReminder, checkReminderSent } = useReminderSettings();
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastCheckRef = useRef<string>('');

  // Format message with template variables
  const formatMessage = useCallback((template: string, variables: Record<string, string>) => {
    let message = template;
    Object.entries(variables).forEach(([key, value]) => {
      message = message.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
    });
    return message;
  }, []);

  // Send WhatsApp reminder via edge function
  const sendReminder = useCallback(async (
    phone: string,
    message: string,
    studentName: string,
    type: 'session' | 'payment' | 'cancellation'
  ) => {
    try {
      const { data, error } = await supabase.functions.invoke('send-whatsapp-reminder', {
        body: { phone, message, studentName, type },
      });

      if (error) throw error;

      return { success: true, messageSid: data?.messageSid };
    } catch (error) {
      console.error('Error sending reminder:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }, []);

  // Check and send session reminders (1 hour before session)
  const checkSessionReminders = useCallback(async () => {
    if (!settings.session_reminders_enabled) return;

    const now = new Date();
    const reminderHours = settings.session_reminder_hours || 1; // Default 1 hour
    const targetTime = addHours(now, reminderHours);
    const targetDateStr = format(targetTime, 'yyyy-MM-dd');
    const targetTimeStr = format(targetTime, 'HH:mm');
    const currentTimeStr = format(now, 'HH:mm');

    for (const student of students) {
      if (!student.phone) continue;

      // Find sessions that need reminders
      const upcomingSessions = student.sessions.filter(session => {
        if (session.status !== 'scheduled') return false;
        if (session.date !== targetDateStr) return false;

        const sessionTime = session.time || student.sessionTime || '16:00';
        const sessionHour = parseInt(sessionTime.split(':')[0]);
        const targetHour = parseInt(targetTimeStr.split(':')[0]);
        const currentHour = parseInt(currentTimeStr.split(':')[0]);

        // Check if session is within the reminder window (1 hour before)
        const hoursUntilSession = sessionHour - currentHour;
        return hoursUntilSession > 0 && hoursUntilSession <= reminderHours;
      });

      for (const session of upcomingSessions) {
        // Check if reminder already sent
        const alreadySent = await checkReminderSent('session', student.id, session.id);
        if (alreadySent) continue;

        const sessionTime = session.time || student.sessionTime || '16:00';
        const sessionDate = parseISO(session.date);

        const message = formatMessage(settings.session_reminder_template, {
          student_name: student.name,
          date: format(sessionDate, 'EEEE، d MMMM', { locale: ar }),
          time: sessionTime,
          day: format(sessionDate, 'EEEE', { locale: ar }),
        });

        const result = await sendReminder(student.phone, message, student.name, 'session');

        // Log the reminder
        await logReminder({
          type: 'session',
          student_id: student.id,
          student_name: student.name,
          phone_number: student.phone,
          message_text: message,
          status: result.success ? 'sent' : 'failed',
          twilio_message_sid: result.messageSid,
          error_message: result.error,
          session_id: session.id,
          session_date: session.date,
        });

        console.log(`Session reminder ${result.success ? 'sent' : 'failed'} for ${student.name}`);
      }
    }
  }, [students, settings, checkReminderSent, formatMessage, sendReminder, logReminder]);

  // Check and send payment reminders (3 days before end of month)
  const checkPaymentReminders = useCallback(async () => {
    if (!settings.payment_reminders_enabled) return;

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const daysInMonth = getDaysInMonth(now);
    const currentDay = now.getDate();
    const daysBeforeEnd = settings.payment_reminder_days_before || 3;

    // Check if we're at the reminder day (e.g., 3 days before month end)
    const reminderDay = daysInMonth - daysBeforeEnd;
    if (currentDay !== reminderDay) return;

    // Only send once per day
    const todayKey = format(now, 'yyyy-MM-dd');
    const lastPaymentCheck = localStorage.getItem('lastPaymentReminderCheck');
    if (lastPaymentCheck === todayKey) return;

    for (const student of students) {
      const parentPhone = student.parentPhone;
      if (!parentPhone) continue;

      // Check if already paid this month
      const studentPayment = payments.find(p => p.studentId === student.id);
      const monthlyPayment = studentPayment?.payments.find(
        p => p.month === currentMonth && p.year === currentYear
      );

      if (monthlyPayment?.isPaid) continue;

      // Check if reminder already sent
      const alreadySent = await checkReminderSent('payment', student.id, undefined, currentMonth, currentYear);
      if (alreadySent) continue;

      // Calculate amount due
      const sessionPrice = student.sessionType === 'online'
        ? (student.customPriceOnline || appSettings.defaultPriceOnline || 120)
        : (student.customPriceOnsite || appSettings.defaultPriceOnsite || 150);

      const monthSessions = student.sessions.filter(s => {
        const sessionDate = parseISO(s.date);
        return sessionDate.getMonth() === currentMonth &&
               sessionDate.getFullYear() === currentYear &&
               (s.status === 'scheduled' || s.status === 'completed');
      });

      const amountDue = monthSessions.length * sessionPrice;

      const monthNames = [
        'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
        'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
      ];

      const message = formatMessage(settings.payment_reminder_template, {
        student_name: student.name,
        month: monthNames[currentMonth],
        sessions: String(monthSessions.length),
        amount: String(amountDue),
      });

      const result = await sendReminder(parentPhone, message, student.name, 'payment');

      // Log the reminder
      await logReminder({
        type: 'payment',
        student_id: student.id,
        student_name: student.name,
        phone_number: parentPhone,
        message_text: message,
        status: result.success ? 'sent' : 'failed',
        twilio_message_sid: result.messageSid,
        error_message: result.error,
        month: currentMonth,
        year: currentYear,
      });

      console.log(`Payment reminder ${result.success ? 'sent' : 'failed'} for ${student.name}'s parent`);
    }

    localStorage.setItem('lastPaymentReminderCheck', todayKey);
  }, [students, payments, settings, appSettings, checkReminderSent, formatMessage, sendReminder, logReminder]);

  // Main check function
  const runChecks = useCallback(async () => {
    const now = new Date();
    const checkKey = format(now, 'yyyy-MM-dd-HH');

    // Avoid checking more than once per hour
    if (lastCheckRef.current === checkKey) return;
    lastCheckRef.current = checkKey;

    console.log('Running auto reminder checks...');

    try {
      await checkSessionReminders();
      await checkPaymentReminders();
    } catch (error) {
      console.error('Error in auto reminder checks:', error);
    }
  }, [checkSessionReminders, checkPaymentReminders]);

  // Set up interval to check reminders
  useEffect(() => {
    // Run initial check after a short delay
    const initialTimeout = setTimeout(() => {
      runChecks();
    }, 5000);

    // Set up interval to check every 15 minutes
    checkIntervalRef.current = setInterval(() => {
      runChecks();
    }, 15 * 60 * 1000); // 15 minutes

    return () => {
      clearTimeout(initialTimeout);
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, [runChecks]);

  // Manual trigger for testing
  const triggerSessionReminders = useCallback(async () => {
    await checkSessionReminders();
  }, [checkSessionReminders]);

  const triggerPaymentReminders = useCallback(async () => {
    await checkPaymentReminders();
  }, [checkPaymentReminders]);

  return {
    triggerSessionReminders,
    triggerPaymentReminders,
    runChecks,
  };
};
