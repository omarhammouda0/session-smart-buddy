-- SECURITY FIX: Replace wide-open USING(true) RLS policies with user-scoped policies

-- ============================================================================
-- session_notes
-- ============================================================================
DROP POLICY IF EXISTS "Allow all operations on session_notes" ON public.session_notes;

CREATE POLICY "Users can view their own session notes"
ON public.session_notes FOR SELECT
USING (user_id = auth.uid()::text);

CREATE POLICY "Users can insert their own session notes"
ON public.session_notes FOR INSERT
WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users can update their own session notes"
ON public.session_notes FOR UPDATE
USING (user_id = auth.uid()::text)
WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users can delete their own session notes"
ON public.session_notes FOR DELETE
USING (user_id = auth.uid()::text);

-- ============================================================================
-- homework
-- ============================================================================
DROP POLICY IF EXISTS "Allow all operations on homework" ON public.homework;

CREATE POLICY "Users can view their own homework"
ON public.homework FOR SELECT
USING (user_id = auth.uid()::text);

CREATE POLICY "Users can insert their own homework"
ON public.homework FOR INSERT
WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users can update their own homework"
ON public.homework FOR UPDATE
USING (user_id = auth.uid()::text)
WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users can delete their own homework"
ON public.homework FOR DELETE
USING (user_id = auth.uid()::text);

-- ============================================================================
-- homework_attachments — add user_id column first since it doesn't have one
-- ============================================================================
DROP POLICY IF EXISTS "Allow all operations on homework_attachments" ON public.homework_attachments;

-- homework_attachments doesn't have a user_id column, so use a join to homework
CREATE POLICY "Users can view their own homework attachments"
ON public.homework_attachments FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.homework
  WHERE homework.id = homework_attachments.homework_id
  AND homework.user_id = auth.uid()::text
));

CREATE POLICY "Users can insert their own homework attachments"
ON public.homework_attachments FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.homework
  WHERE homework.id = homework_attachments.homework_id
  AND homework.user_id = auth.uid()::text
));

CREATE POLICY "Users can update their own homework attachments"
ON public.homework_attachments FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.homework
  WHERE homework.id = homework_attachments.homework_id
  AND homework.user_id = auth.uid()::text
));

CREATE POLICY "Users can delete their own homework attachments"
ON public.homework_attachments FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.homework
  WHERE homework.id = homework_attachments.homework_id
  AND homework.user_id = auth.uid()::text
));

-- ============================================================================
-- reminder_settings
-- ============================================================================
DROP POLICY IF EXISTS "Allow all operations on reminder_settings" ON public.reminder_settings;

CREATE POLICY "Users can view their own reminder settings"
ON public.reminder_settings FOR SELECT
USING (user_id = auth.uid()::text);

CREATE POLICY "Users can insert their own reminder settings"
ON public.reminder_settings FOR INSERT
WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users can update their own reminder settings"
ON public.reminder_settings FOR UPDATE
USING (user_id = auth.uid()::text)
WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users can delete their own reminder settings"
ON public.reminder_settings FOR DELETE
USING (user_id = auth.uid()::text);

-- ============================================================================
-- reminder_log
-- ============================================================================
DROP POLICY IF EXISTS "Allow all operations on reminder_log" ON public.reminder_log;

CREATE POLICY "Users can view their own reminder logs"
ON public.reminder_log FOR SELECT
USING (user_id = auth.uid()::text);

CREATE POLICY "Users can insert their own reminder logs"
ON public.reminder_log FOR INSERT
WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users can update their own reminder logs"
ON public.reminder_log FOR UPDATE
USING (user_id = auth.uid()::text)
WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users can delete their own reminder logs"
ON public.reminder_log FOR DELETE
USING (user_id = auth.uid()::text);

-- ============================================================================
-- push_subscriptions
-- ============================================================================
DROP POLICY IF EXISTS "Allow all operations on push_subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Allow all access to push_subscriptions" ON public.push_subscriptions;

CREATE POLICY "Users can view their own push subscriptions"
ON public.push_subscriptions FOR SELECT
USING (user_id = auth.uid()::text);

CREATE POLICY "Users can insert their own push subscriptions"
ON public.push_subscriptions FOR INSERT
WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users can update their own push subscriptions"
ON public.push_subscriptions FOR UPDATE
USING (user_id = auth.uid()::text)
WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users can delete their own push subscriptions"
ON public.push_subscriptions FOR DELETE
USING (user_id = auth.uid()::text);

-- ============================================================================
-- push_notification_log
-- ============================================================================
DROP POLICY IF EXISTS "Allow all operations on push_notification_log" ON public.push_notification_log;

CREATE POLICY "Users can view their own push notification logs"
ON public.push_notification_log FOR SELECT
USING (user_id = auth.uid()::text);

CREATE POLICY "Users can insert their own push notification logs"
ON public.push_notification_log FOR INSERT
WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users can update their own push notification logs"
ON public.push_notification_log FOR UPDATE
USING (user_id = auth.uid()::text)
WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users can delete their own push notification logs"
ON public.push_notification_log FOR DELETE
USING (user_id = auth.uid()::text);