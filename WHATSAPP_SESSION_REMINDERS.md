# WhatsApp Session Reminder - Current Behavior

## Overview

The system automatically sends WhatsApp reminders to students (or their parents) before their scheduled sessions. This works **even when the app is closed** because it runs server-side via Supabase.

---

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│  pg_cron (every 5 minutes)                                  │
│    └── auto-session-reminder edge function                  │
│          ├── Checks reminder_settings table                 │
│          ├── Finds sessions within reminder window          │
│          ├── Checks reminder_log for duplicates             │
│          └── Sends WhatsApp via send-whatsapp-reminder      │
└─────────────────────────────────────────────────────────────┘
```

---

## Dual Reminder System

The system sends **TWO reminders** per session at configurable intervals:

| Reminder | Default | Example |
|----------|---------|---------|
| **Reminder 1** (longer) | 24 hours before | "تذكير: لديك جلسة غداً..." |
| **Reminder 2** (shorter) | 1 hour before | "جلستك تبدأ خلال ساعة واحدة..." |

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

- Uses **Germany timezone** (CET/CEST)
- Automatically adjusts for daylight saving time
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

- ✅ Twilio account configured (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM)
- ✅ pg_cron extension enabled
- ✅ pg_net extension enabled
- ✅ Edge functions deployed
- ✅ Cron job scheduled

