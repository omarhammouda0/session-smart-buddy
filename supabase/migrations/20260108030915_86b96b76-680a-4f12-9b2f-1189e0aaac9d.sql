-- SECURITY FIX: replace overly-permissive RLS policies with user-scoped policies

-- session_cancellations
DROP POLICY IF EXISTS "Allow all operations on session_cancellations" ON public.session_cancellations;

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
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own session cancellations"
ON public.session_cancellations
FOR DELETE
USING (auth.uid() = user_id);

-- student_cancellation_tracking
DROP POLICY IF EXISTS "Allow all operations on student_cancellation_tracking" ON public.student_cancellation_tracking;

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
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own cancellation tracking"
ON public.student_cancellation_tracking
FOR DELETE
USING (auth.uid() = user_id);

-- cancellation_notifications
DROP POLICY IF EXISTS "Allow all operations on cancellation_notifications" ON public.cancellation_notifications;

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
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own cancellation notifications"
ON public.cancellation_notifications
FOR DELETE
USING (auth.uid() = user_id);
