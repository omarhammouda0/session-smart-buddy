# Multi-User Support Fixes

## Overview

This document describes all the changes made to support multiple authenticated users in the application. Previously, many features used hardcoded `user_id = 'default'` which caused data to be shared between all users.

## Changes Made

### 1. `src/hooks/useReminderSettings.ts`

**Before:** Used hardcoded `'default'` for user_id in all queries and inserts.

**After:**
- Added `getUserId()` function to get authenticated user's ID
- Added `userId` state variable
- All queries now filter by actual user ID
- Settings are saved with correct user ID
- Logs are filtered by user ID

### 2. `src/hooks/useSessionNotes.ts`

**Before:** Used `const USER_ID = 'default'` constant.

**After:**
- Removed hardcoded constant
- Added `getUserId()` function
- Added `userId` state variable
- All queries filter by actual user ID
- Notes and homework are saved with correct user ID

### 3. `src/hooks/usePushNotifications.ts`

**Before:** FCM tokens were saved with `user_id: "default"`.

**After:**
- Added `getCurrentUserId()` function
- Modified `saveFcmToken()` to accept userId parameter
- FCM tokens are now saved with actual user ID
- Users only receive push notifications for their own alerts

### 4. `supabase/functions/auto-session-reminder/index.ts` (v4.0)

**Before:** 
- Only fetched settings for `user_id = 'default'`
- Sent reminders for ALL users' sessions
- Logged with `user_id = 'default'`

**After:**
- Fetches ALL users who have `session_reminders_enabled = true`
- Processes each user separately in a loop
- Filters sessions by `students.user_id`
- Logs reminders with correct user_id

### 5. `supabase/functions/check-critical-alerts/index.ts` (v3.0)

**Before:**
- Sent push notifications to ALL active devices
- Logged with `user_id = 'default'`

**After:**
- Includes `userId` from students table in all alerts
- `sendPushNotification()` now filters subscriptions by user_id
- Logs notifications with correct user_id

### 6. `supabase/functions/send-push-notification/index.ts`

**Before:** 
- Logged with `user_id: 'default'`

**After:**
- Sends to all active subscriptions (backwards compatible for test notifications)
- Properly logs with user information

## Already Working (No Changes Needed)

These features already properly used `getUserId()` and filtered by user_id:

- `src/hooks/useStudents.ts` - Students, sessions, payments, app settings
- `src/hooks/useCancellationTracking.ts` - Cancellation tracking
- `src/hooks/useConflictDetection.ts` - Conflict detection
- `src/hooks/useStudentMaterials.ts` - Student materials

## Database Tables with user_id

All these tables have `user_id` columns and proper Row Level Security (RLS):

- `students`
- `sessions`
- `payments`
- `monthly_payments`
- `payment_records`
- `app_settings`
- `reminder_settings`
- `reminder_log`
- `session_notes`
- `homework`
- `push_subscriptions`
- `push_notification_log`
- `cancellation_notifications`
- `session_cancellations`

## Data Isolation

Now each tutor (authenticated user) will:

1. ✅ Only see their own students
2. ✅ Only see their own sessions
3. ✅ Only see their own payments
4. ✅ Have their own app settings
5. ✅ Have their own reminder settings
6. ✅ Only receive WhatsApp reminders for their students
7. ✅ Only receive push notifications for their students' alerts
8. ✅ Only see their own session notes and homework

## Migration Note

If you have existing data with `user_id = 'default'`, you may need to:

1. Update existing records to use actual user IDs, OR
2. Leave them as is (new data will use correct user IDs)

## Deployment

After pushing changes, deploy edge functions:

```bash
supabase functions deploy auto-session-reminder
supabase functions deploy check-critical-alerts
supabase functions deploy send-push-notification
```

## Testing

1. Create two test users
2. Add students to each user
3. Verify each user only sees their own data
4. Test push notifications - each user should only get their own alerts
5. Test WhatsApp reminders - sessions should only trigger for the correct user

