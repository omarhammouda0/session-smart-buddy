-- Enable the pg_cron and pg_net extensions (required for scheduled HTTP calls)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Drop existing job if it exists (for clean re-deployment)
SELECT cron.unschedule('auto-session-reminder-job')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'auto-session-reminder-job'
);

-- Schedule the auto-session-reminder function to run every 15 minutes
-- This ensures reminders are sent within the 30-minute window for both 24h and 1h intervals
SELECT cron.schedule(
  'auto-session-reminder-job',  -- job name
  '*/15 * * * *',               -- every 15 minutes (at :00, :15, :30, :45)
  $$
  SELECT
    net.http_post(
      url := 'https://jguiqcroufwbxamfymnj.supabase.co/functions/v1/auto-session-reminder',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

