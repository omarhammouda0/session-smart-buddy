-- Schedule the check-critical-alerts function to run every 5 minutes
-- This sends push notifications for Priority 100 alerts even when app is closed

-- Drop existing job if it exists (for clean re-deployment)
SELECT cron.unschedule('check-critical-alerts-job')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'check-critical-alerts-job'
);

-- Schedule the check-critical-alerts function
SELECT cron.schedule(
  'check-critical-alerts-job',
  '*/5 * * * *',  -- Every 5 minutes
  $$
  SELECT
    net.http_post(
      url := 'https://jguiqcroufwbxamfymnj.supabase.co/functions/v1/check-critical-alerts',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

-- Comment for documentation
COMMENT ON EXTENSION pg_cron IS 'Scheduled jobs including: auto-session-reminder (WhatsApp), check-critical-alerts (Push notifications)';

