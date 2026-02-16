# WhatsApp Session Reminder - Current Behavior

## Overview

The system automatically sends WhatsApp reminders to students (or their parents) before their scheduled sessions. This works **even when the app is closed** because it runs server-side via Supabase Edge Functions + pg_cron.

**Version 6.0**: 
- Added **Meta WhatsApp Cloud API** support (FREE - 1000 conversations/month)
- Multi-provider support: Meta (default) or Twilio
- More reliable and cost-effective than Twilio sandbox

**Version 5.0**: 
- Added **GROUP SESSION reminders** - sends to all active group members
- Changed timezone from Germany to **Egypt (UTC+2)**
- Improved template handling for group sessions

---

## WhatsApp Providers

| Provider | Cost | Setup | Best For |
|----------|------|-------|----------|
| **Meta Cloud API** (Default) | FREE (1000 conv/month) | Facebook Developer Account | Production use |
| **Twilio** | Paid / Sandbox limits | Twilio Account | Legacy/backup |

### Meta WhatsApp Cloud API Setup

1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Create an App → Select "Business" type
3. Add WhatsApp product
4. Get your **Phone Number ID** and **Access Token**
5. Add to Supabase secrets:
   - `WHATSAPP_PROVIDER=meta`
   - `META_WHATSAPP_TOKEN=your_token`
   - `META_WHATSAPP_PHONE_ID=your_phone_id`

---

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│  pg_cron (every 5 minutes)                                  │
│    └── auto-session-reminder edge function                  │
│          ├── Checks reminder_settings table                 │
│          ├── Finds PRIVATE sessions within reminder window  │
│          ├── Finds GROUP sessions within reminder window    │
│          ├── Checks reminder_log for duplicates             │
│          └── Sends WhatsApp via Meta API or Twilio          │
└─────────────────────────────────────────────────────────────┘
```

---

## Session Types Supported

| Type | Description | Recipients |
|------|-------------|------------|
| **Private Sessions** | Individual student sessions | Student or parent phone |
| **Group Sessions** | Group class sessions (v5.0+) | All active group members |

---

## Dual Reminder System

The system sends **TWO reminders** per session at configurable intervals:

| Reminder | Default | Example |
|----------|---------|---------|
| **Reminder 1** (longer) | 24 hours before | "تذكير: لديك جلسة غداً..." |
| **Reminder 2** (shorter) | 1 hour before | "جلستك تبدأ خلال ساعة واحدة..." |

---

## Time Window Logic (v3.1)

Each reminder fires within a **specific time window** around its target time:

### For short reminders (≤ 2 hours):
- Window: `(0, hours]`
- Example: 1-hour reminder fires when session is 0-1 hours away

### For longer reminders (> 2 hours):
- Window: `(hours - tolerance, hours + tolerance]`
- Tolerance = min(2 hours, 20% of the interval)
- Example: 24-hour reminder with 2h tolerance fires when session is 22-26 hours away

### Window Examples:

| Settings | 24h Reminder Window | 1h Reminder Window |
|----------|--------------------|--------------------|
| 24h & 1h | (22, 26] hours | (0, 1] hours |
| 12h & 1h | (10, 14] hours | (0, 1] hours |
| 2h & 1h | (1, 2] hours | (0, 1] hours |

This prevents the wrong template from being sent (e.g., "tomorrow" message for a session 1.5 hours away).

---

## Configuration (reminder_settings table)

| Setting | Description | Default |
|---------|-------------|---------|
| `session_reminders_enabled` | Master on/off switch | `true` |
| `session_reminder_hours` | Hours before for 1st reminder | `24` |
| `session_reminder_hours_2` | Hours before for 2nd reminder | `1` |
| `session_reminder_template_1` | Message template for 1st reminder | Arabic template |
| `session_reminder_template_2` | Message template for 2nd reminder | Arabic template |

---

## Message Templates

### Template Variables
- `{student_name}` - Student's name
- `{date}` - Session date (YYYY-MM-DD)
- `{time}` - Session time (HH:MM)

### Default Template 1 (24h before)
```
مرحباً {student_name}،
تذكير: لديك جلسة غداً بتاريخ {date} الساعة {time}.
نراك قريباً!
```

### Default Template 2 (1h before)
```
مرحباً {student_name}،
جلستك تبدأ خلال ساعة واحدة الساعة {time}!
الرجاء الاستعداد.
```

---

## Execution Flow

1. **pg_cron triggers** `auto-session-reminder` every 5 minutes
2. **Check settings**: Is `session_reminders_enabled` = true?
3. **For each reminder interval** (24h, 1h):
   - Calculate time window (now to now + hours)
   - Query sessions with `status = 'scheduled'` in that window
   - For each session:
     - Get student phone (or parent_phone if no student phone)
     - Check `reminder_log` if this interval was already sent
     - If not sent → Send WhatsApp via Twilio
     - Log result to `reminder_log`

---

## Deduplication Logic

Each reminder is tracked in `reminder_log` with:
- `session_id` - Which session
- `reminder_interval` - Which reminder (1 or 2)
- `status` - 'sent' or 'failed'

**A reminder is skipped if:**
- Same `session_id` + `reminder_interval` + `status='sent'` exists in log

---

## Phone Number Priority

1. First tries `student.phone`
2. Falls back to `student.parent_phone`
3. Skips if neither exists

---

## Timezone Handling

- Uses **Egypt timezone** (EET, UTC+2)
- Egypt does not observe daylight saving time
- Sessions are scheduled in local time

---

## Cron Schedule

```sql
'*/5 * * * *'  -- Every 5 minutes
```

Runs at: :00, :05, :10, :15, :20, :25, :30, :35, :40, :45, :50, :55

---

## Example Timeline

**Session: January 16, 2026 at 10:00 AM**

| Time | Action |
|------|--------|
| Jan 15, 10:00 AM | 1st reminder sent (24h before) ✉️ |
| Jan 16, 9:00 AM | 2nd reminder sent (1h before) ✉️ |
| Jan 16, 10:00 AM | Session starts ⏰ |

---

## Monitoring

### View sent reminders
```sql
SELECT * FROM reminder_log 
WHERE type = 'session' 
ORDER BY sent_at DESC 
LIMIT 20;
```

### Check for failures
```sql
SELECT * FROM reminder_log 
WHERE type = 'session' 
  AND status = 'failed' 
ORDER BY sent_at DESC;
```

### Verify cron job is running
```sql
SELECT * FROM cron.job WHERE jobname = 'auto-session-reminder-job';
```

---

## Files Involved

| File | Purpose |
|------|---------|
| `supabase/functions/auto-session-reminder/index.ts` | Main logic |
| `supabase/functions/send-whatsapp-reminder/index.ts` | Twilio integration |
| `supabase/migrations/20260113_auto_session_reminder_cron.sql` | Cron job setup |
| `src/components/ReminderSettingsDialog.tsx` | UI for configuration |

---

## Requirements

### For Meta WhatsApp Cloud API (Recommended):
- ✅ Meta WhatsApp configured (META_WHATSAPP_TOKEN, META_WHATSAPP_PHONE_ID)
- ✅ WHATSAPP_PROVIDER=meta (or not set, as meta is default)
- ✅ pg_cron extension enabled
- ✅ Edge functions deployed
- ✅ Cron job scheduled

### For Twilio (Legacy):
- ✅ Twilio account configured (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM)
- ✅ WHATSAPP_PROVIDER=twilio
- ✅ pg_cron extension enabled
- ✅ Edge functions deployed
- ✅ Cron job scheduled

---

## Supabase Secrets Configuration

Add these in **Supabase Dashboard → Settings → Edge Functions → Secrets**:

### Meta (Recommended):
```
WHATSAPP_PROVIDER=meta
META_WHATSAPP_TOKEN=EAAXhmf3dpvwBQ...
META_WHATSAPP_PHONE_ID=998582473338868
```

### Twilio (Alternative):
```
WHATSAPP_PROVIDER=twilio
TWILIO_ACCOUNT_SID=ACxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxx
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
```

