Implementation Summary: Dual Configurable Session Reminders
===========================================================

## Overview
Successfully implemented dual configurable session reminders feature. Students will now receive two WhatsApp reminders at configurable intervals (default: 24 hours and 1 hour before sessions) using the same message template.

## Files Modified

### 1. Database Migration
**File**: `supabase/migrations/20260112_add_second_reminder_hours.sql`
- Added `session_reminder_hours_2` column to `reminder_settings` table (default: 1)
- Added `reminder_interval` column to `reminder_log` table to distinguish between first and second reminders

### 2. TypeScript Types
**File**: `src/types/reminder.ts`
- Added `session_reminder_hours_2: number` field to `ReminderSettings` interface
- Added `reminder_interval?: number` field to `ReminderLog` interface

### 3. Reminder Settings Hook
**File**: `src/hooks/useReminderSettings.ts`
- Updated `DEFAULT_SETTINGS` to include `session_reminder_hours_2: 1`

### 4. UI Settings Dialog
**File**: `src/components/ReminderSettingsDialog.tsx`
- Removed unused state variables (`sessionHours1`, `sessionHours2`, `useExactTiming`)
- Added `sessionHours2` state for the second reminder interval
- Updated `useEffect` hooks to sync `session_reminder_hours_2` from settings
- Updated `handleOpenChange` to load `session_reminder_hours_2`
- Updated `handleSave` to save `session_reminder_hours_2`
- Updated UI to show two reminder interval selectors:
  - "التذكير الأول (قبل):" for first reminder (24h default)
  - "التذكير الثاني (قبل):" for second reminder (1h default)
- Updated label to indicate template is shared: "نص الرسالة (للتذكيرين):" 

### 5. Auto-Session-Reminder Edge Function
**File**: `supabase/functions/auto-session-reminder/index.ts`
- Completely refactored to support dual reminders
- Updated version to v2.0
- Key changes:
  - Reads both `session_reminder_hours` and `session_reminder_hours_2` from settings
  - Loops through each reminder interval independently
  - For each interval, calculates the target datetime and fetches applicable sessions
  - Checks deduplication using `session_id + reminder_interval` to prevent duplicate sends
  - Logs `reminder_interval` field to track which reminder was sent (1 or 2)
  - Returns detailed results including reminder intervals processed and per-interval statistics

## How It Works

1. **User Configuration**
   - User opens "التذكيرات" (Reminders) settings
   - Configures two reminder intervals (e.g., 24 hours and 1 hour)
   - Provides one message template used for both reminders
   - Saves settings to database

2. **Automatic Trigger**
   - Edge function runs on schedule (configured in `supabase/config.toml`)
   - For each reminder interval:
     - Calculates target date/time (e.g., 24h from now, 1h from now)
     - Fetches sessions scheduled for that date
     - Checks if reminder already sent by querying `reminder_log` with session_id + reminder_interval
     - Sends message via WhatsApp if not previously sent
     - Logs the reminder with interval marker

3. **Deduplication**
   - Query: `session_id + type='session' + reminder_interval + status='sent'`
   - Prevents duplicate reminders for the same session at the same interval
   - Allows two separate reminders for the same session if intervals differ

4. **Data Tracking**
   - Each reminder log entry includes `reminder_interval` field
   - Allows tracking which reminder (1st or 2nd) was sent
   - Used by ReminderHistoryDialog to display reminder details

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

## Default Behavior
- First reminder: 24 hours before session
- Second reminder: 1 hour before session
- Both use the same message template
- Reminders are automatically sent by the scheduled edge function
- Each session can receive maximum 2 reminders (one per interval)

## Next Steps
1. Apply database migration: `supabase db push`
2. Deploy updated edge function
3. Test reminder sending with configured intervals
4. Monitor reminder_log table to verify dual reminders are being sent

## Testing Checklist
- [ ] Deploy migration to update reminder_settings and reminder_log tables
- [ ] Deploy updated edge function (v2.0)
- [ ] Enable reminders in UI settings
- [ ] Configure intervals (e.g., 24h and 1h)
- [ ] Set message template
- [ ] Create test session 25 hours in the future
- [ ] Wait for scheduled function or manually trigger
- [ ] Verify first reminder sent (~24h before)
- [ ] Wait for second reminder window
- [ ] Verify second reminder sent (~1h before)
- [ ] Check reminder_log has correct reminder_interval values
- [ ] Verify no duplicate reminders for same session/interval

