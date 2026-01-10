-- Create students table
CREATE TABLE public.students (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  parent_phone TEXT,
  session_type TEXT NOT NULL DEFAULT 'onsite' CHECK (session_type IN ('online', 'onsite')),
  session_time TEXT NOT NULL DEFAULT '16:00',
  session_duration INTEGER DEFAULT 60,
  custom_price_onsite NUMERIC,
  custom_price_online NUMERIC,
  use_custom_settings BOOLEAN DEFAULT false,
  schedule_days JSONB NOT NULL DEFAULT '[]'::jsonb,
  semester_start DATE NOT NULL,
  semester_end DATE NOT NULL,
  -- Cancellation policy
  cancellation_monthly_limit INTEGER,
  cancellation_alert_tutor BOOLEAN DEFAULT true,
  cancellation_auto_notify_parent BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on students
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

-- Students RLS policies
CREATE POLICY "Users can view their own students"
  ON public.students FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own students"
  ON public.students FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own students"
  ON public.students FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own students"
  ON public.students FOR DELETE
  USING (auth.uid() = user_id);

-- Create sessions table
CREATE TABLE public.sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  time TEXT,
  duration INTEGER DEFAULT 60,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'vacation')),
  completed_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  vacation_at TIMESTAMP WITH TIME ZONE,
  -- Session notes
  topic TEXT,
  notes TEXT,
  homework TEXT,
  homework_status TEXT DEFAULT 'none' CHECK (homework_status IN ('none', 'assigned', 'completed', 'incomplete')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on sessions
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- Sessions RLS policies
CREATE POLICY "Users can view their own sessions"
  ON public.sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sessions"
  ON public.sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sessions"
  ON public.sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sessions"
  ON public.sessions FOR DELETE
  USING (auth.uid() = user_id);

-- Create monthly_payments table (for tracking monthly payment status per student)
CREATE TABLE public.monthly_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month INTEGER NOT NULL CHECK (month >= 0 AND month <= 11),
  year INTEGER NOT NULL CHECK (year >= 2020),
  is_paid BOOLEAN DEFAULT false,
  amount_due NUMERIC DEFAULT 0,
  amount_paid NUMERIC DEFAULT 0,
  payment_status TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'partial', 'paid')),
  paid_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(student_id, month, year)
);

-- Enable RLS on monthly_payments
ALTER TABLE public.monthly_payments ENABLE ROW LEVEL SECURITY;

-- Monthly payments RLS policies
CREATE POLICY "Users can view their own monthly payments"
  ON public.monthly_payments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own monthly payments"
  ON public.monthly_payments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own monthly payments"
  ON public.monthly_payments FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own monthly payments"
  ON public.monthly_payments FOR DELETE
  USING (auth.uid() = user_id);

-- Create payment_records table (for tracking individual payments/partial payments)
CREATE TABLE public.payment_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  monthly_payment_id UUID NOT NULL REFERENCES public.monthly_payments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  method TEXT NOT NULL DEFAULT 'cash' CHECK (method IN ('cash', 'bank', 'wallet')),
  paid_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on payment_records
ALTER TABLE public.payment_records ENABLE ROW LEVEL SECURITY;

-- Payment records RLS policies
CREATE POLICY "Users can view their own payment records"
  ON public.payment_records FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own payment records"
  ON public.payment_records FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own payment records"
  ON public.payment_records FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own payment records"
  ON public.payment_records FOR DELETE
  USING (auth.uid() = user_id);

-- Create app_settings table (for storing user-specific app settings)
CREATE TABLE public.app_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  default_semester_months INTEGER DEFAULT 4,
  default_semester_start DATE,
  default_semester_end DATE,
  default_session_duration INTEGER DEFAULT 60,
  default_price_onsite NUMERIC DEFAULT 150,
  default_price_online NUMERIC DEFAULT 120,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on app_settings
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- App settings RLS policies
CREATE POLICY "Users can view their own settings"
  ON public.app_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own settings"
  ON public.app_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings"
  ON public.app_settings FOR UPDATE
  USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX idx_students_user_id ON public.students(user_id);
CREATE INDEX idx_sessions_student_id ON public.sessions(student_id);
CREATE INDEX idx_sessions_user_id ON public.sessions(user_id);
CREATE INDEX idx_sessions_date ON public.sessions(date);
CREATE INDEX idx_monthly_payments_student_id ON public.monthly_payments(student_id);
CREATE INDEX idx_monthly_payments_user_id ON public.monthly_payments(user_id);
CREATE INDEX idx_monthly_payments_month_year ON public.monthly_payments(month, year);
CREATE INDEX idx_payment_records_monthly_payment_id ON public.payment_records(monthly_payment_id);
CREATE INDEX idx_payment_records_student_id ON public.payment_records(student_id);

-- Create trigger for updating updated_at columns
CREATE TRIGGER update_students_updated_at
  BEFORE UPDATE ON public.students
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sessions_updated_at
  BEFORE UPDATE ON public.sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_monthly_payments_updated_at
  BEFORE UPDATE ON public.monthly_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();