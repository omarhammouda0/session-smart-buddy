-- Enable the pg_cron and pg_net extensions (required for scheduled HTTP calls)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Drop existing job if it exists (for clean re-deployment)
SELECT cron.unschedule('auto-session-reminder-job')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'auto-session-reminder-job'
);

-- Schedule the auto-session-reminder function to run every 5 minutes
-- This ensures reminders are sent promptly for sessions that fall between checks
SELECT cron.schedule(
  'auto-session-reminder-job',  -- job name
  '*/5 * * * *',                -- every 5 minutes (at :00, :05, :10, :15, :20, :25, :30, :35, :40, :45, :50, :55)
  $$
  SELECT
    net.http_post(
      url := 'https://jguiqcroufwbxamfymnj.supabase.co/functions/v1/auto-session-reminder',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

