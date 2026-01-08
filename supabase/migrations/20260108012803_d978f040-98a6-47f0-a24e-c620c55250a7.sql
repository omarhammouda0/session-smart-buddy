-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create reminder_settings table for storing Twilio and reminder configuration
CREATE TABLE public.reminder_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'default',
  
  -- Session reminder settings
  session_reminders_enabled BOOLEAN NOT NULL DEFAULT false,
  session_reminder_hours INTEGER NOT NULL DEFAULT 24,
  session_reminder_send_time TEXT NOT NULL DEFAULT '09:00',
  session_reminder_template TEXT NOT NULL DEFAULT 'مرحباً {student_name}،
تذكير بموعد جلستك غداً {date} الساعة {time}
نراك قريباً!',
  
  -- Payment reminder settings
  payment_reminders_enabled BOOLEAN NOT NULL DEFAULT false,
  payment_reminder_days_before INTEGER NOT NULL DEFAULT 3,
  payment_reminder_template TEXT NOT NULL DEFAULT 'عزيزي ولي الأمر،
تذكير بدفع رسوم شهر {month} لـ {student_name}
عدد الجلسات: {sessions}
المبلغ المستحق: {amount} جنيه
شكراً لتعاونكم',
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  UNIQUE(user_id)
);

-- Create reminder_log table for tracking sent reminders
CREATE TABLE public.reminder_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'default',
  type TEXT NOT NULL CHECK (type IN ('session', 'payment')),
  student_id TEXT NOT NULL,
  student_name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  message_text TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
  twilio_message_sid TEXT,
  error_message TEXT,
  session_id TEXT,
  session_date TEXT,
  month INTEGER,
  year INTEGER,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.reminder_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminder_log ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (since no auth is implemented)
CREATE POLICY "Allow all operations on reminder_settings" 
ON public.reminder_settings 
FOR ALL 
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow all operations on reminder_log" 
ON public.reminder_log 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Create indexes for better query performance
CREATE INDEX idx_reminder_log_type ON public.reminder_log(type);
CREATE INDEX idx_reminder_log_student ON public.reminder_log(student_id);
CREATE INDEX idx_reminder_log_status ON public.reminder_log(status);
CREATE INDEX idx_reminder_log_sent_at ON public.reminder_log(sent_at);
CREATE INDEX idx_reminder_log_session ON public.reminder_log(session_id);

-- Create trigger for updated_at
CREATE TRIGGER update_reminder_settings_updated_at
BEFORE UPDATE ON public.reminder_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();