# Push Notifications Setup Guide

## Overview

This guide explains how to enable push notifications that work even when the browser is closed or you're offline.

## What Works Offline?

| Feature | Browser Open | Browser Closed | Completely Offline |
|---------|-------------|----------------|-------------------|
| WhatsApp Reminders | ✅ | ✅ | ✅ (server-side) |
| Push Notifications | ✅ | ✅ | ❌ (needs internet for delivery) |
| In-App Sounds | ✅ | ❌ | ❌ |
| In-App Suggestions | ✅ | ❌ | ❌ |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Server Side (Supabase)                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  pg_cron (every 5 minutes)                          │   │
│  │    ├── auto-session-reminder → WhatsApp via Twilio  │   │
│  │    └── check-critical-alerts → Push via FCM         │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Firebase Cloud Messaging                   │
│                    (Delivers to devices)                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      User's Device                           │
│  ┌──────────────────────────────────���──────────────────┐   │
│  │  Service Worker (firebase-messaging-sw.js)          │   │
│  │    └── Shows notification even if browser closed    │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Setup Steps

### Step 1: Firebase Configuration

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `session-smart-buddy`
3. Go to Project Settings → General
4. Find "Your apps" section and get:
   - `apiKey`
   - `messagingSenderId`
   - `appId`

5. Update `src/lib/firebaseConfig.ts` with these values

### Step 2: Supabase Secrets

Add these secrets in **Supabase Dashboard → Settings → Edge Functions → Secrets**:

| Secret Name | Description |
|-------------|-------------|
| `FIREBASE_PROJECT_ID` | `session-smart-buddy` |
| `FIREBASE_CLIENT_EMAIL` | Service account email |
| `FIREBASE_PRIVATE_KEY` | Service account private key |
| `FIREBASE_VAPID_KEY` | Web Push certificate key |

### Step 3: Deploy Migrations

Run the migrations to create required tables:

```bash
cd supabase
supabase db push
```

This creates:
- `push_subscriptions` table - stores FCM tokens
- `push_notification_log` table - tracks sent notifications
- `check-critical-alerts-job` cron job

### Step 4: Deploy Edge Functions

Deploy the new edge functions:

```bash
supabase functions deploy send-push-notification
supabase functions deploy check-critical-alerts
```

### Step 5: Enable in App

1. Open the app
2. Click the notification bell icon
3. Enable "إشعارات الخلفية" (Background Notifications)
4. Allow browser notification permission when prompted

## Priority 100 Alerts (Sent via Push)

These alerts will be sent as push notifications even when the app is closed:

| Alert | Trigger | Message Example |
|-------|---------|-----------------|
| Session Unconfirmed | Session ended but not marked complete | `حصة أحمد خلصت ومحتاجة تأكيد` |
| Payment Overdue | 30+ days since last payment | `⚠️ أحمد لم يدفع منذ ٣٠ يوم` |
| Pre-Session Reminder | 25-35 minutes before session | `📚 حصة أحمد كمان ٣٠ دقيقة` |

## Testing

### Test Push Notifications

1. Enable push notifications in the app
2. Close the browser completely
3. Wait for a Priority 100 condition:
   - Or manually trigger via Supabase Dashboard:
     ```sql
     SELECT net.http_post(
       url := 'https://jguiqcroufwbxamfymnj.supabase.co/functions/v1/check-critical-alerts',
       headers := '{"Content-Type": "application/json"}'::jsonb,
       body := '{}'::jsonb
     );
     ```
4. You should receive a push notification

### Check Cron Jobs

```sql
SELECT * FROM cron.job;
```

Should show:
- `auto-session-reminder-job` (WhatsApp)
- `check-critical-alerts-job` (Push)

### View Sent Notifications

```sql
SELECT * FROM push_notification_log 
ORDER BY sent_at DESC 
LIMIT 10;
```

## Troubleshooting

### Push notifications not working?

1. **Check browser support**: Chrome, Firefox, Edge support. Safari has limited support.
2. **Check permission**: Browser must have notification permission granted
3. **Check FCM token**: Look in localStorage for `fcm_token`
4. **Check subscriptions table**:
   ```sql
   SELECT * FROM push_subscriptions WHERE is_active = true;
   ```

### Duplicate notifications?

The system prevents duplicates by:
- Checking `condition_key` in `push_notification_log`
- Same condition won't send again within 1 hour

### Cron job not running?

1. Check if pg_cron extension is enabled:
   ```sql
   SELECT * FROM pg_extension WHERE extname = 'pg_cron';
   ```
2. Check job status:
   ```sql
   SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
   ```

## Files Created

| File | Purpose |
|------|---------|
| `public/firebase-messaging-sw.js` | Service worker for background push |
| `src/lib/firebaseConfig.ts` | Firebase configuration |
| `src/hooks/usePushNotifications.ts` | React hook for push management |
| `src/components/PushNotificationSettings.tsx` | UI for enabling push |
| `supabase/functions/send-push-notification/index.ts` | Edge function to send via FCM |
| `supabase/functions/check-critical-alerts/index.ts` | Edge function to check conditions |
| `supabase/migrations/20260115_push_notifications.sql` | Database tables |
| `supabase/migrations/20260115_check_critical_alerts_cron.sql` | Cron job |

## Security Notes

- FCM tokens are unique per device/browser
- Tokens are stored server-side in `push_subscriptions`
- Private key should NEVER be exposed in frontend code
- Service account credentials are stored as Supabase secrets only

