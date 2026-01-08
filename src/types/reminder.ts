export interface ReminderSettings {
  id?: string;
  user_id?: string;
  session_reminders_enabled: boolean;
  session_reminder_hours: number;
  session_reminder_send_time: string;
  session_reminder_template: string;
  payment_reminders_enabled: boolean;
  payment_reminder_days_before: number;
  payment_reminder_template: string;
  created_at?: string;
  updated_at?: string;
}

export interface ReminderLog {
  id: string;
  user_id: string;
  type: 'session' | 'payment' | 'cancellation';
  student_id: string;
  student_name: string;
  phone_number: string;
  message_text: string;
  status: 'sent' | 'failed' | 'skipped';
  twilio_message_sid?: string;
  error_message?: string;
  session_id?: string;
  session_date?: string;
  month?: number;
  year?: number;
  sent_at: string;
  created_at: string;
}

export const DEFAULT_SESSION_TEMPLATE = `مرحباً {student_name}،
تذكير بموعد جلستك غداً {date} الساعة {time}
نراك قريباً!`;

export const DEFAULT_PAYMENT_TEMPLATE = `عزيزي ولي الأمر،
تذكير بدفع رسوم شهر {month} لـ {student_name}
عدد الجلسات: {sessions}
المبلغ المستحق: {amount} جنيه
شكراً لتعاونكم`;

export const REMINDER_HOURS_OPTIONS = [1, 2, 6, 12, 24, 48];
export const PAYMENT_DAYS_OPTIONS = [1, 2, 3, 5, 7];
export const SEND_TIME_OPTIONS = [
  '06:00', '07:00', '08:00', '09:00', '10:00', '11:00',
  '12:00', '13:00', '14:00', '15:00', '16:00', '17:00',
  '18:00', '19:00', '20:00', '21:00', '22:00', '23:00'
];
