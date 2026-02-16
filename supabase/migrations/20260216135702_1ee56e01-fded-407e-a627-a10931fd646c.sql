
-- Create push_notification_log table for deduplication
CREATE TABLE public.push_notification_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'system',
  suggestion_type TEXT NOT NULL DEFAULT 'general',
  priority INTEGER NOT NULL DEFAULT 0,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  condition_key TEXT,
  fcm_response JSONB,
  status TEXT NOT NULL DEFAULT 'sent',
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index on condition_key + status + sent_at for fast dedup queries
CREATE INDEX idx_push_notification_log_dedup ON public.push_notification_log (condition_key, status, sent_at);

-- Enable RLS
ALTER TABLE public.push_notification_log ENABLE ROW LEVEL SECURITY;

-- Service role needs full access (edge functions use service role key)
-- Allow all for now since edge functions use service_role_key which bypasses RLS
CREATE POLICY "Allow all operations on push_notification_log"
ON public.push_notification_log
FOR ALL
USING (true)
WITH CHECK (true);
