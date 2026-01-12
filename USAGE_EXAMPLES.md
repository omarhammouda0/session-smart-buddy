# Dual Session Reminders - Usage Examples

## Example 1: Default Configuration (24h + 1h)

### Configuration
- **First Reminder**: 24 hours before session
- **Second Reminder**: 1 hour before session
- **Template**: 
```
مرحباً {student_name}،
تذكير بموعد جلستك غداً {date} الساعة {time}
نراك قريباً!
```

### Timeline for a Session Scheduled on Jan 15 at 3 PM

```
Jan 14, 2 PM UTC → First reminder sent (interval = 1)
  Student receives: "مرحباً محمد، تذكير بموعد جلستك غداً 2026-01-15 الساعة 15:00 نراك قريباً!"

Jan 15, 2 PM UTC → Second reminder sent (interval = 2)
  Student receives: Same message

Jan 15, 3 PM UTC → Session time
```

### Logs Created
```sql
-- Reminder 1 (24h before)
INSERT INTO reminder_log (..., session_id, reminder_interval, status, ...)
VALUES (..., 'session-123', 1, 'sent', ...);

-- Reminder 2 (1h before)
INSERT INTO reminder_log (..., session_id, reminder_interval, status, ...)
VALUES (..., 'session-123', 2, 'sent', ...);
```

---

## Example 2: Custom Configuration (48h + 12h)

### Configuration
- **First Reminder**: 48 hours before session
- **Second Reminder**: 12 hours before session

### Timeline for a Session Scheduled on Jan 15 at 8 PM

```
Jan 13, 8 PM UTC → First reminder sent (interval = 1)
  Student receives: "تذكيرك بموعد الجلسة يوم الثلاثاء الساعة 8 مساءً..."

Jan 15, 8 AM UTC → Second reminder sent (interval = 2)
  Student receives: Same message

Jan 15, 8 PM UTC → Session time
```

---

## Example 3: Custom Configuration (6h + 2h)

Useful for back-to-back reminders on the same day.

### Configuration
- **First Reminder**: 6 hours before session
- **Second Reminder**: 2 hours before session

### Timeline for a Session Scheduled on Jan 15 at 7 PM

```
Jan 15, 1 PM UTC → First reminder sent (interval = 1)
Jan 15, 5 PM UTC → Second reminder sent (interval = 2)
Jan 15, 7 PM UTC → Session time
```

---

## How Deduplication Works

### Scenario: Function runs twice before sending reminder

```
10:00 AM - Function runs (checking 1h reminders for 11 AM sessions)
  Session "S001" scheduled for 11:00 AM
  Reminder not in log → SEND ✅
  Log entry created: session_id=S001, reminder_interval=2, status=sent

10:30 AM - Function runs again (checking 1h reminders for 11:30 AM sessions)
  Session "S001" is NOT in this time window → SKIP

11:00 AM - Session time
```

### Scenario: Same session, different intervals

```
Jan 13, 10 AM - Function checks 24h reminders
  Session scheduled for Jan 14, 10 AM
  Query: SELECT * FROM reminder_log WHERE session_id='S001' AND reminder_interval=1 AND status='sent'
  Result: NOT FOUND → SEND ✅
  Log: session_id=S001, reminder_interval=1, status=sent

Jan 14, 9 AM - Function checks 1h reminders
  Session scheduled for Jan 14, 10 AM
  Query: SELECT * FROM reminder_log WHERE session_id='S001' AND reminder_interval=2 AND status='sent'
  Result: NOT FOUND → SEND ✅
  Log: session_id=S001, reminder_interval=2, status=sent

Result: Two separate reminders, no duplicates ✅
```

### Scenario: Reminder fails, retry

```
10:00 AM - Function tries to send reminder
  Twilio API returns error (network issue)
  Log entry created: session_id=S001, reminder_interval=1, status=failed

10:05 AM - Function runs again
  Query: SELECT * FROM reminder_log WHERE session_id='S001' AND reminder_interval=1 AND status=sent'
  Result: NOT FOUND (only 'failed' exists)
  Function RETRIES sending ✅
```

---

## SQL Queries for Monitoring

### View all reminders sent for a specific session
```sql
SELECT 
  session_id,
  student_name,
  reminder_interval,
  status,
  sent_at,
  error_message
FROM reminder_log
WHERE type = 'session' 
  AND session_id = 'your-session-id'
ORDER BY reminder_interval, sent_at;
```

### Count reminders by interval
```sql
SELECT 
  reminder_interval,
  status,
  COUNT(*) as count
FROM reminder_log
WHERE type = 'session'
  AND DATE(sent_at) = CURRENT_DATE
GROUP BY reminder_interval, status;
```

### Find duplicate reminders (should be empty)
```sql
SELECT 
  session_id,
  reminder_interval,
  COUNT(*) as count
FROM reminder_log
WHERE type = 'session'
  AND status = 'sent'
GROUP BY session_id, reminder_interval
HAVING COUNT(*) > 1;
```

### View failed reminders (for troubleshooting)
```sql
SELECT 
  session_id,
  student_name,
  phone_number,
  reminder_interval,
  error_message,
  sent_at
FROM reminder_log
WHERE type = 'session'
  AND status = 'failed'
ORDER BY sent_at DESC
LIMIT 20;
```

---

## Response Format from Edge Function

### Success Response
```json
{
  "success": true,
  "sent": 5,
  "skipped": 2,
  "errors": 0,
  "reminders": [
    { "hours": 24, "interval": 1 },
    { "hours": 1, "interval": 2 }
  ],
  "results": [
    {
      "sessionId": "s-123",
      "interval": 1,
      "status": "sent",
      "messageSid": "SM123..."
    },
    {
      "sessionId": "s-456",
      "interval": 2,
      "status": "sent",
      "messageSid": "SM456..."
    }
  ]
}
```

### Error Response
```json
{
  "success": false,
  "error": "Session reminders are disabled"
}
```

---

## Field Reference

### reminder_log Table Fields Related to Dual Reminders

| Field | Type | Description |
|-------|------|-------------|
| `session_id` | TEXT | ID of the session being reminded about |
| `reminder_interval` | INT | Which reminder this is (1 = first, 2 = second) |
| `status` | TEXT | 'sent', 'failed', or 'skipped' |
| `type` | TEXT | Always 'session' for session reminders |
| `student_id` | TEXT | Student receiving the reminder |
| `student_name` | TEXT | Student's name for message |
| `phone_number` | TEXT | WhatsApp number reminder sent to |
| `message_text` | TEXT | Actual message content sent |
| `twilio_message_sid` | TEXT | Twilio's message ID (if sent) |
| `error_message` | TEXT | Error details if failed |
| `sent_at` | TIMESTAMP | When the reminder was processed |

### reminder_settings Table Fields Related to Dual Reminders

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `session_reminders_enabled` | BOOLEAN | false | Master on/off toggle |
| `session_reminder_hours` | INT | 24 | First reminder interval in hours |
| `session_reminder_hours_2` | INT | 1 | Second reminder interval in hours |
| `session_reminder_template` | TEXT | Default Arabic text | Message template for both reminders |

---

## Best Practices

1. **Interval Ordering**: Always set first reminder with larger hours value than second
   - ✅ Good: 24h first, 1h second
   - ❌ Bad: 1h first, 24h second (confusing)

2. **Time Gaps**: Ensure intervals are meaningfully different
   - ✅ Good: 24h and 1h, 6h and 2h, 48h and 12h
   - ⚠️ Marginal: 2h and 1h, 3h and 2h (close together)

3. **Template Variables**: Use consistent variables in template
   - Available: `{student_name}`, `{date}`, `{time}`
   - Both reminders use same template, so content should make sense for both

4. **Monitoring**: Check logs regularly for failures
   - Failed reminders will have `status='failed'` and `error_message` populated
   - Investigate Twilio configuration if seeing many failures

5. **Time Zones**: Edge function uses UTC
   - Session times should be stored consistently
   - Verify your time zone handling is correct

