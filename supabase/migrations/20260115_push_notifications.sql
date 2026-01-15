-- Push Subscriptions Table for FCM tokens
-- Stores device tokens for sending push notifications when app is closed

-- Create push_subscriptions table
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'default',
  fcm_token TEXT NOT NULL UNIQUE,
  device_info JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ DEFAULT now(),
  is_active BOOLEAN DEFAULT true
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_active ON public.push_subscriptions(is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies (allow all for now since we use 'default' user)
CREATE POLICY "Allow all operations on push_subscriptions"
  ON public.push_subscriptions
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Push Notification Log for tracking sent notifications
CREATE TABLE IF NOT EXISTS public.push_notification_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'default',
  suggestion_type TEXT NOT NULL,
  priority INTEGER NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  related_entity_type TEXT,
  related_entity_id TEXT,
  condition_key TEXT,
  fcm_response JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending', -- pending, sent, failed
  error_message TEXT,
  sent_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for deduplication and querying
CREATE INDEX IF NOT EXISTS idx_push_notification_log_condition ON public.push_notification_log(condition_key, sent_at);
CREATE INDEX IF NOT EXISTS idx_push_notification_log_status ON public.push_notification_log(status);
CREATE INDEX IF NOT EXISTS idx_push_notification_log_sent_at ON public.push_notification_log(sent_at DESC);

-- Enable RLS
ALTER TABLE public.push_notification_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow all operations on push_notification_log"
  ON public.push_notification_log
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_push_subscription_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS push_subscriptions_updated_at ON public.push_subscriptions;
CREATE TRIGGER push_subscriptions_updated_at
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_push_subscription_timestamp();

-- Comment for documentation
COMMENT ON TABLE public.push_subscriptions IS 'Stores FCM tokens for push notifications when app is closed';
COMMENT ON TABLE public.push_notification_log IS 'Tracks sent push notifications for deduplication and debugging';

