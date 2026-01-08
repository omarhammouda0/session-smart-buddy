import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Student } from '@/types/student';
import { format } from 'date-fns';

export interface CancellationRecord {
  id: string;
  studentId: string;
  sessionDate: string;
  sessionTime?: string;
  reason?: string;
  cancelledAt: string;
  month: string; // YYYY-MM
}

export interface MonthlyTracking {
  id?: string;
  studentId: string;
  month: string; // YYYY-MM
  cancellationCount: number;
  limitAtTime?: number;
  limitReachedDate?: string;
  parentNotified: boolean;
  parentNotifiedAt?: string;
}

export interface CancellationNotification {
  id: string;
  studentId: string;
  month: string;
  sentAt: string;
  messageText: string;
  twilioMessageSid?: string;
  deliveryStatus: 'pending' | 'sent' | 'delivered' | 'failed';
  parentPhone: string;
  triggeredBy: 'auto' | 'manual';
  errorMessage?: string;
}

// Helper to get current month in YYYY-MM format
const getCurrentMonth = () => format(new Date(), 'yyyy-MM');

export const useCancellationTracking = (students: Student[]) => {
  const [cancellations, setCancellations] = useState<CancellationRecord[]>([]);
  const [monthlyTracking, setMonthlyTracking] = useState<MonthlyTracking[]>([]);
  const [notifications, setNotifications] = useState<CancellationNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load data from Supabase
  const loadData = useCallback(async () => {
    try {
      // Load cancellations
      const { data: cancellationData, error: cancellationError } = await supabase
        .from('session_cancellations')
        .select('*')
        .order('cancelled_at', { ascending: false });

      if (cancellationError) {
        console.error('Error loading cancellations:', cancellationError);
      } else {
        setCancellations(
          (cancellationData || []).map((c) => ({
            id: c.id,
            studentId: c.student_id,
            sessionDate: c.session_date,
            sessionTime: c.session_time || undefined,
            reason: c.reason || undefined,
            cancelledAt: c.cancelled_at,
            month: c.month,
          }))
        );
      }

      // Load monthly tracking
      const { data: trackingData, error: trackingError } = await supabase
        .from('student_cancellation_tracking')
        .select('*');

      if (trackingError) {
        console.error('Error loading tracking:', trackingError);
      } else {
        setMonthlyTracking(
          (trackingData || []).map((t) => ({
            id: t.id,
            studentId: t.student_id,
            month: t.month,
            cancellationCount: t.cancellation_count,
            limitAtTime: t.limit_at_time || undefined,
            limitReachedDate: t.limit_reached_date || undefined,
            parentNotified: t.parent_notified,
            parentNotifiedAt: t.parent_notified_at || undefined,
          }))
        );
      }

      // Load notifications
      const { data: notificationData, error: notificationError } = await supabase
        .from('cancellation_notifications')
        .select('*')
        .order('sent_at', { ascending: false });

      if (notificationError) {
        console.error('Error loading notifications:', notificationError);
      } else {
        setNotifications(
          (notificationData || []).map((n) => ({
            id: n.id,
            studentId: n.student_id,
            month: n.month,
            sentAt: n.sent_at,
            messageText: n.message_text,
            twilioMessageSid: n.twilio_message_sid || undefined,
            deliveryStatus: n.delivery_status as 'pending' | 'sent' | 'delivered' | 'failed',
            parentPhone: n.parent_phone,
            triggeredBy: n.triggered_by as 'auto' | 'manual',
            errorMessage: n.error_message || undefined,
          }))
        );
      }
    } catch (error) {
      console.error('Error loading cancellation data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Get cancellation count for a student in a specific month
  const getCancellationCount = useCallback(
    (studentId: string, month?: string) => {
      const targetMonth = month || getCurrentMonth();
      const tracking = monthlyTracking.find(
        (t) => t.studentId === studentId && t.month === targetMonth
      );
      return tracking?.cancellationCount || 0;
    },
    [monthlyTracking]
  );

  // Get cancellations for a student in a specific month
  const getStudentCancellations = useCallback(
    (studentId: string, month?: string) => {
      const targetMonth = month || getCurrentMonth();
      return cancellations.filter(
        (c) => c.studentId === studentId && c.month === targetMonth
      );
    },
    [cancellations]
  );

  // Check if parent was already notified this month
  const wasParentNotified = useCallback(
    (studentId: string, month?: string) => {
      const targetMonth = month || getCurrentMonth();
      const tracking = monthlyTracking.find(
        (t) => t.studentId === studentId && t.month === targetMonth
      );
      return tracking?.parentNotified || false;
    },
    [monthlyTracking]
  );

  // Record a cancellation
  const recordCancellation = useCallback(
    async (
      studentId: string,
      sessionDate: string,
      sessionTime?: string,
      reason?: string
    ): Promise<{
      success: boolean;
      newCount: number;
      limitReached: boolean;
      limitExceeded: boolean;
      limit: number | null;
      autoNotificationSent?: boolean;
    }> => {
      const month = format(new Date(sessionDate), 'yyyy-MM');
      const student = students.find((s) => s.id === studentId);
      const limit = student?.cancellationPolicy?.monthlyLimit ?? null;
      const autoNotifyParent = student?.cancellationPolicy?.autoNotifyParent ?? false;

      try {
        // Insert cancellation record
        const { error: insertError } = await supabase
          .from('session_cancellations')
          .insert({
            student_id: studentId,
            session_date: sessionDate,
            session_time: sessionTime,
            reason,
            month,
          });

        if (insertError) {
          console.error('Error inserting cancellation:', insertError);
          return { success: false, newCount: 0, limitReached: false, limitExceeded: false, limit };
        }

        // Upsert monthly tracking
        const currentCount = getCancellationCount(studentId, month);
        const newCount = currentCount + 1;
        const limitReached = limit !== null && newCount === limit;
        const limitExceeded = limit !== null && newCount > limit;

        const { error: upsertError } = await supabase
          .from('student_cancellation_tracking')
          .upsert(
            {
              student_id: studentId,
              month,
              cancellation_count: newCount,
              limit_at_time: limit,
              limit_reached_date: limitReached || limitExceeded ? new Date().toISOString() : null,
            },
            {
              onConflict: 'student_id,user_id,month',
            }
          );

        if (upsertError) {
          console.error('Error upserting tracking:', upsertError);
        }

        // Reload data to get fresh cancellation list
        await loadData();

        // Check if we should auto-notify parent
        let autoNotificationSent = false;
        if ((limitReached || limitExceeded) && autoNotifyParent && student?.phone) {
          // Check if parent was already notified this month
          const alreadyNotified = wasParentNotified(studentId, month);
          
          if (!alreadyNotified) {
            console.log('Auto-sending parent notification for:', student.name);
            
            // Get fresh cancellation list for this month
            const studentCancellations = cancellations.filter(
              (c) => c.studentId === studentId && c.month === month
            );
            
            // Add the current cancellation to the list for the message
            const allCancellations = [
              ...studentCancellations,
              {
                id: 'pending',
                studentId,
                sessionDate,
                sessionTime,
                reason,
                cancelledAt: new Date().toISOString(),
                month,
              },
            ];

            const result = await sendParentNotificationInternal(
              studentId,
              student.phone,
              student.name,
              newCount,
              limit!,
              allCancellations,
              'auto'
            );

            autoNotificationSent = result.success;
            if (result.success) {
              console.log('Auto-notification sent successfully');
            } else {
              console.error('Auto-notification failed:', result.error);
            }
          }
        }

        return { success: true, newCount, limitReached, limitExceeded, limit, autoNotificationSent };
      } catch (error) {
        console.error('Error recording cancellation:', error);
        return { success: false, newCount: 0, limitReached: false, limitExceeded: false, limit };
      }
    },
    [students, getCancellationCount, loadData, wasParentNotified, cancellations]
  );

  // Remove a cancellation (when restoring a session)
  const removeCancellation = useCallback(
    async (studentId: string, sessionDate: string): Promise<boolean> => {
      const month = format(new Date(sessionDate), 'yyyy-MM');

      try {
        // Delete the cancellation record
        const { error: deleteError } = await supabase
          .from('session_cancellations')
          .delete()
          .eq('student_id', studentId)
          .eq('session_date', sessionDate);

        if (deleteError) {
          console.error('Error deleting cancellation:', deleteError);
          return false;
        }

        // Update monthly tracking
        const currentCount = getCancellationCount(studentId, month);
        const newCount = Math.max(0, currentCount - 1);

        if (newCount === 0) {
          // Delete tracking record if count is 0
          await supabase
            .from('student_cancellation_tracking')
            .delete()
            .eq('student_id', studentId)
            .eq('month', month);
        } else {
          // Update count
          await supabase
            .from('student_cancellation_tracking')
            .update({ cancellation_count: newCount })
            .eq('student_id', studentId)
            .eq('month', month);
        }

        await loadData();
        return true;
      } catch (error) {
        console.error('Error removing cancellation:', error);
        return false;
      }
    },
    [getCancellationCount, loadData]
  );

  // Mark parent as notified
  const markParentNotified = useCallback(
    async (studentId: string, month?: string): Promise<boolean> => {
      const targetMonth = month || getCurrentMonth();

      try {
        const { error } = await supabase
          .from('student_cancellation_tracking')
          .update({
            parent_notified: true,
            parent_notified_at: new Date().toISOString(),
          })
          .eq('student_id', studentId)
          .eq('month', targetMonth);

        if (error) {
          console.error('Error marking parent notified:', error);
          return false;
        }

        await loadData();
        return true;
      } catch (error) {
        console.error('Error marking parent notified:', error);
        return false;
      }
    },
    [loadData]
  );

  // Log notification
  const logNotification = useCallback(
    async (
      studentId: string,
      parentPhone: string,
      messageText: string,
      triggeredBy: 'auto' | 'manual',
      twilioMessageSid?: string,
      deliveryStatus: 'pending' | 'sent' | 'delivered' | 'failed' = 'pending',
      errorMessage?: string
    ): Promise<boolean> => {
      const month = getCurrentMonth();

      try {
        const { error } = await supabase.from('cancellation_notifications').insert({
          student_id: studentId,
          month,
          message_text: messageText,
          twilio_message_sid: twilioMessageSid,
          delivery_status: deliveryStatus,
          parent_phone: parentPhone,
          triggered_by: triggeredBy,
          error_message: errorMessage,
        });

        if (error) {
          console.error('Error logging notification:', error);
          return false;
        }

        await loadData();
        return true;
      } catch (error) {
        console.error('Error logging notification:', error);
        return false;
      }
    },
    [loadData]
  );

  // Internal function to send WhatsApp notification (used by auto-notify and manual)
  const sendParentNotificationInternal = useCallback(
    async (
      studentId: string,
      parentPhone: string,
      studentName: string,
      count: number,
      limit: number,
      cancellationList: CancellationRecord[],
      triggeredBy: 'auto' | 'manual' = 'manual'
    ): Promise<{ success: boolean; error?: string }> => {
      const month = getCurrentMonth();
      const monthName = new Date().toLocaleDateString('ar-EG', { month: 'long' });

      // Build cancellation list text
      const cancellationsText = cancellationList
        .slice(0, 5)
        .map((c) => `• ${c.sessionDate}${c.reason ? ` - ${c.reason}` : ''}`)
        .join('\n');

      // Build message
      const message = `عزيزي ولي الأمر،

نود إعلامكم بأن ${studentName} قد ألغى ${count} جلسات هذا الشهر (${monthName})، وقد وصل للحد المسموح به (${limit} جلسات).

الجلسات الملغاة كانت:
${cancellationsText}

الإلغاءات المتكررة تؤثر على التقدم الدراسي. نأمل متابعة الأمر لضمان الاستفادة الكاملة من الجلسات.

للاستفسار، نحن في الخدمة.
شكراً لتعاونكم`;

      try {
        console.log('Sending cancellation alert to parent:', { studentName, parentPhone, triggeredBy });

        const { data, error } = await supabase.functions.invoke('send-whatsapp-reminder', {
          body: {
            studentName,
            phoneNumber: parentPhone,
            customMessage: message,
          },
        });

        if (error) {
          console.error('Error sending notification:', error);
          // Log failed notification
          await logNotification(
            studentId,
            parentPhone,
            message,
            triggeredBy,
            undefined,
            'failed',
            error.message
          );
          return { success: false, error: error.message };
        }

        // Log successful notification
        await logNotification(
          studentId,
          parentPhone,
          message,
          triggeredBy,
          data?.messageSid,
          'sent'
        );

        // Mark parent as notified
        await markParentNotified(studentId, month);

        return { success: true };
      } catch (error: any) {
        console.error('Error sending parent notification:', error);
        await logNotification(
          studentId,
          parentPhone,
          message,
          triggeredBy,
          undefined,
          'failed',
          error.message
        );
        return { success: false, error: error.message };
      }
    },
    [logNotification, markParentNotified]
  );

  // Public function for manual notifications
  const sendParentNotification = useCallback(
    (
      studentId: string,
      parentPhone: string,
      studentName: string,
      count: number,
      limit: number,
      cancellationList: CancellationRecord[]
    ) => sendParentNotificationInternal(studentId, parentPhone, studentName, count, limit, cancellationList, 'manual'),
    [sendParentNotificationInternal]
  );

  // Get students at or near limit for current month
  const studentsAtRisk = useMemo(() => {
    const currentMonth = getCurrentMonth();
    
    return students
      .map((student) => {
        const limit = student.cancellationPolicy?.monthlyLimit ?? null;
        if (limit === null) return null; // No limit set

        const count = getCancellationCount(student.id, currentMonth);
        if (count === 0) return null;

        const percentage = (count / limit) * 100;
        const severity: 'safe' | 'warning' | 'critical' | 'exceeded' =
          percentage >= 100 ? 'exceeded' :
          percentage >= 75 ? 'critical' :
          percentage >= 50 ? 'warning' : 'safe';

        return {
          student,
          count,
          limit,
          percentage,
          severity,
          parentNotified: wasParentNotified(student.id, currentMonth),
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null && item.count > 0)
      .sort((a, b) => b.percentage - a.percentage);
  }, [students, getCancellationCount, wasParentNotified]);

  return {
    cancellations,
    monthlyTracking,
    notifications,
    isLoading,
    getCancellationCount,
    getStudentCancellations,
    wasParentNotified,
    recordCancellation,
    removeCancellation,
    markParentNotified,
    logNotification,
    sendParentNotification,
    studentsAtRisk,
    reload: loadData,
  };
};
