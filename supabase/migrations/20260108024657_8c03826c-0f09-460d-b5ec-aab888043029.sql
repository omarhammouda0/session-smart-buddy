-- Add cancellation policy fields to track limits per student (stored in localStorage with student data)
-- Create table for tracking monthly cancellation counts
CREATE TABLE public.student_cancellation_tracking (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id TEXT NOT NULL,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  month TEXT NOT NULL, -- format: YYYY-MM
  cancellation_count INTEGER NOT NULL DEFAULT 0,
  limit_at_time INTEGER, -- the limit that was set when tracking started
  limit_reached_date TIMESTAMP WITH TIME ZONE,
  parent_notified BOOLEAN NOT NULL DEFAULT false,
  parent_notified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(student_id, user_id, month)
);

-- Create table for individual cancellation records with reasons
CREATE TABLE public.session_cancellations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id TEXT NOT NULL,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  session_date DATE NOT NULL,
  session_time TEXT,
  reason TEXT,
  cancelled_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  month TEXT NOT NULL, -- format: YYYY-MM for easy querying
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for cancellation notification logs
CREATE TABLE public.cancellation_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id TEXT NOT NULL,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  month TEXT NOT NULL, -- format: YYYY-MM
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  message_text TEXT NOT NULL,
  twilio_message_sid TEXT,
  delivery_status TEXT NOT NULL DEFAULT 'pending', -- pending, sent, delivered, failed
  parent_phone TEXT NOT NULL,
  triggered_by TEXT NOT NULL DEFAULT 'manual', -- auto or manual
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.student_cancellation_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_cancellations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cancellation_notifications ENABLE ROW LEVEL SECURITY;

-- RLS policies for student_cancellation_tracking
CREATE POLICY "Users can view their own cancellation tracking"
ON public.student_cancellation_tracking
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own cancellation tracking"
ON public.student_cancellation_tracking
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own cancellation tracking"
ON public.student_cancellation_tracking
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own cancellation tracking"
ON public.student_cancellation_tracking
FOR DELETE
USING (auth.uid() = user_id);

-- RLS policies for session_cancellations
CREATE POLICY "Users can view their own session cancellations"
ON public.session_cancellations
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own session cancellations"
ON public.session_cancellations
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own session cancellations"
ON public.session_cancellations
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own session cancellations"
ON public.session_cancellations
FOR DELETE
USING (auth.uid() = user_id);

-- RLS policies for cancellation_notifications
CREATE POLICY "Users can view their own cancellation notifications"
ON public.cancellation_notifications
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own cancellation notifications"
ON public.cancellation_notifications
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own cancellation notifications"
ON public.cancellation_notifications
FOR UPDATE
USING (auth.uid() = user_id);

-- Add triggers for updated_at
CREATE TRIGGER update_student_cancellation_tracking_updated_at
BEFORE UPDATE ON public.student_cancellation_tracking
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();