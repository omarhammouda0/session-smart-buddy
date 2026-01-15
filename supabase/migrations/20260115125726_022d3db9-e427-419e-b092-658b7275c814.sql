-- Create push_subscriptions table for storing FCM tokens
CREATE TABLE public.push_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'default',
  fcm_token TEXT NOT NULL UNIQUE,
  device_info JSONB DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Create policies for push_subscriptions (allow all access for now since we use default user_id)
CREATE POLICY "Allow all access to push_subscriptions"
ON public.push_subscriptions
FOR ALL
USING (true)
WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX idx_push_subscriptions_fcm_token ON public.push_subscriptions(fcm_token);
CREATE INDEX idx_push_subscriptions_is_active ON public.push_subscriptions(is_active);

-- Create trigger for updating updated_at
CREATE TRIGGER update_push_subscriptions_updated_at
BEFORE UPDATE ON public.push_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();