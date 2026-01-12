# Dual Session Reminders - Implementation Complete ✅

## What Was Changed

Your tutoring session reminder system now supports **two configurable reminders** per session:
- **Reminder 1**: Configurable interval (default: 24 hours before)
- **Reminder 2**: Configurable interval (default: 1 hour before)
- Both reminders use the **same message template**
- Triggered automatically by the scheduled edge function

---

## Quick Setup Guide

### 1. Apply Database Migration
```bash
cd supabase
supabase db push
```
This will add two columns:
- `session_reminder_hours_2` to `reminder_settings` table
- `reminder_interval` to `reminder_log` table

### 2. Deploy Updated Edge Function
The edge function (`supabase/functions/auto-session-reminder/index.ts`) has been completely rewritten (v2.0) to:
- Support dual reminders at separate intervals
- Track which reminder (1st or 2nd) was sent
- Prevent duplicate reminders using the new `reminder_interval` field

Deploy it to your Supabase project.

### 3. Configure Reminders in UI
1. Open your app and click "التذكيرات" (Reminders) button
2. Enable "تذكيرات الجلسات" (Session Reminders)
3. Set two intervals:
   - التذكير الأول (First Reminder): e.g., 24 hours
   - التذكير الثاني (Second Reminder): e.g., 1 hour
4. Write your message template (applies to both reminders)
5. Click "حفظ الإعدادات" (Save Settings)

---

## How It Works

### Automatic Process
1. Edge function runs on schedule (hourly by default)
2. For **each reminder interval**:
   - Calculates when reminders should be sent
   - Fetches scheduled sessions for that time window
   - Checks if reminder already sent (using `session_id + reminder_interval`)
   - Sends WhatsApp message via Twilio if not previously sent
   - Logs result with `reminder_interval` field

### Deduplication
- Each reminder log entry now includes `reminder_interval` (1 or 2)
- Query: `session_id + type='session' + reminder_interval + status='sent'`
- Prevents duplicate reminders for the same session at the same interval
- Allows both reminders to be sent for the same session

---

## Database Changes

### reminder_settings table
```sql
ALTER TABLE public.reminder_settings
ADD COLUMN session_reminder_hours_2 INTEGER NOT NULL DEFAULT 1;
```

### reminder_log table
```sql
ALTER TABLE public.reminder_log
ADD COLUMN reminder_interval INTEGER DEFAULT 1;
```

---

## Files Modified

1. ✅ `supabase/migrations/20260112_add_second_reminder_hours.sql` - New migration file
2. ✅ `src/types/reminder.ts` - Added types for dual reminders
3. ✅ `src/hooks/useReminderSettings.ts` - Updated default settings
4. ✅ `src/components/ReminderSettingsDialog.tsx` - Updated UI with two interval pickers
5. ✅ `supabase/functions/auto-session-reminder/index.ts` - Rewritten for dual reminders

---

## Testing Checklist

- [ ] Run database migration (`supabase db push`)
- [ ] Deploy updated edge function
- [ ] Enable session reminders in UI settings
- [ ] Configure both reminder intervals (e.g., 24h and 1h)
- [ ] Set a message template
- [ ] Create a test session 25 hours from now
- [ ] Wait for scheduled function to run (or manually test)
- [ ] Check logs:
  ```sql
  SELECT * FROM reminder_log 
  WHERE type = 'session' 
  ORDER BY sent_at DESC 
  LIMIT 10;
  ```
- [ ] Verify:
  - First reminder sent with `reminder_interval = 1`
  - Second reminder sent with `reminder_interval = 2`
  - No duplicate reminders for same session/interval
  - Message text is the same for both reminders

---

## Default Configuration

| Setting | Default Value |
|---------|---------------|
| First Reminder | 24 hours before |
| Second Reminder | 1 hour before |
| Message Template | Shared between both |
| Status | Disabled (user must enable) |

---

## Troubleshooting

### No reminders being sent?
1. Check if reminders are enabled in UI settings
2. Verify edge function is deployed
3. Check `reminder_log` table for any failed attempts
4. Ensure students have phone numbers in database

### Duplicate reminders for same session?
1. Check `reminder_interval` field in logs
2. If duplicates have different `reminder_interval` values, that's correct (two separate reminders)
3. If same `reminder_interval`, check database for duplicate log entries

### Function not running?
1. Verify schedule in `supabase/config.toml`
2. Check Supabase project logs for function execution
3. Test by manually invoking the function via Supabase dashboard

---

## Questions?

Refer to the main implementation document: `IMPLEMENTATION_SUMMARY.md`

