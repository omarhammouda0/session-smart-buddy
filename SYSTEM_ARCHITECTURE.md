# Dual Session Reminders - System Architecture

## System Overview Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                     TUTORING SESSION REMINDER SYSTEM                      │
└──────────────────────────────────────────────────────────────────────────┘

                          ┌─────────────────────┐
                          │   User Interface    │
                          │  (React Component)  │
                          └──────────┬──────────┘
                                     │
                  ┌──────────────────┴──────────────────┐
                  │ ReminderSettingsDialog.tsx         │
                  │ ────────────────────────────────   │
                  │ • Enable/Disable reminders         │
                  │ • Set Interval 1 (hours)           │
                  │ • Set Interval 2 (hours)           │
                  │ • Configure message template       │
                  │ • Test Twilio connection           │
                  └──────────────────┬──────────────────┘
                                     │
                                     ▼
                  ┌──────────────────────────────────┐
                  │  useReminderSettings Hook        │
                  │ ────────────────────────────────  │
                  │ • Fetch settings from DB         │
                  │ • Save settings to DB            │
                  │ • Fetch reminder logs            │
                  └──────────────────┬───────────────┘
                                     │
                  ┌──────────────────┴───────────────┐
                  │                                  │
                  ▼                                  ▼
      ┌─────────────────────┐      ┌─────────────────────┐
      │  Supabase Auth      │      │  Supabase DB        │
      │  (Future)           │      │  (PostgreSQL)       │
      └─────────────────────┘      └─────────────────────┘
                                   │ Tables:
                                   ├─ reminder_settings
                                   ├─ reminder_log
                                   ├─ sessions
                                   └─ students
```

---

## Reminder Processing Flow

```
Every hour (or configured schedule):

   ┌─────────────────────────────────────────────────────────┐
   │  auto-session-reminder Edge Function (Deno)            │
   │  ├─ Version: 2.0                                         │
   │  └─ Trigger: Scheduled (cron-like)                       │
   └──────────────────────┬──────────────────────────────────┘
                          │
    ┌─────────────────────┴─────────────────────┐
    │ FOR EACH REMINDER INTERVAL:               │
    │ (interval 1: 24h, interval 2: 1h)        │
    └─────────────────────┬─────────────────────┘
                          │
        ┌─────────────────┴──────────────────┐
        ▼                                    ▼
    ╔═════════════════════╗           ╔═════════════════════╗
    ║ INTERVAL 1 LOGIC    ║           ║ INTERVAL 2 LOGIC    ║
    ║ (24 hours before)   ║           ║ (1 hour before)     ║
    ╚═════════════════════╝           ╚═════════════════════╝
        │                                 │
        ├─ Calculate target time      ├─ Calculate target time
        │  (now + 24 hours)           │  (now + 1 hour)
        │                             │
        ├─ Query sessions on          ├─ Query sessions on
        │  target date                │  target date
        │                             │
        ├─ For each session:          ├─ For each session:
        │  │                          │  │
        │  ├─ Has phone? → NO skip    │  ├─ Has phone? → NO skip
        │  │                          │  │
        │  ├─ Check dedup log:        │  ├─ Check dedup log:
        │  │  WHERE                   │  │  WHERE
        │  │  session_id=X AND        │  │  session_id=X AND
        │  │  reminder_interval=1 AND │  │  reminder_interval=2 AND
        │  │  status='sent'           │  │  status='sent'
        │  │                          │  │
        │  ├─ Found? → SKIP           │  ├─ Found? → SKIP
        │  │  Not found? → BUILD MSG  │  │  Not found? → BUILD MSG
        │  │                          │  │
        │  └─ SEND WHATSAPP           │  └─ SEND WHATSAPP
        │     │                       │     │
        │     ├─ Success? →           │     ├─ Success? →
        │     │  INSERT with          │     │  INSERT with
        │     │  reminder_interval=1  │     │  reminder_interval=2
        │     │  status='sent'        │     │  status='sent'
        │     │                       │     │
        │     └─ Failed? →            │     └─ Failed? →
        │        INSERT with          │        INSERT with
        │        reminder_interval=1  │        reminder_interval=2
        │        status='failed'      │        status='failed'
        │                             │
        └────────┬──────────────────────────┬────────┘
                 │                          │
                 └──────────┬───────────────┘
                            │
                            ▼
                ┌─────────────────────────┐
                │  reminder_log table     │
                │  ───────────────────    │
                │  Stores all attempts:   │
                │  • session_id           │
                │  • reminder_interval    │
                │  • status (sent/failed) │
                │  • message_text         │
                │  • error_message (if)   │
                │  • timestamp            │
                └─────────────────────────┘
```

---

## Database Schema

### reminder_settings Table
```sql
┌─────────────────────────────────────────────────────────────┐
│ reminder_settings                                           │
├─────────────────────────────────────────────────────────────┤
│ id                          UUID PRIMARY KEY                │
│ user_id                     TEXT (DEFAULT: 'default')       │
│ session_reminders_enabled   BOOLEAN (DEFAULT: false)        │
│ session_reminder_hours      INT (DEFAULT: 24) ◄─ NEW        │
│ session_reminder_hours_2    INT (DEFAULT: 1)  ◄─ ADDED      │
│ session_reminder_send_time  TEXT (DEFAULT: '09:00')         │
│ session_reminder_template   TEXT (Arabic default)           │
│ payment_reminders_enabled   BOOLEAN (DEFAULT: false)        │
│ payment_reminder_days_...   INT (DEFAULT: 3)                │
│ payment_reminder_template   TEXT (Arabic default)           │
│ cancellation_reminders_...  BOOLEAN (DEFAULT: false)        │
│ cancellation_reminder_...   TEXT (Arabic default)           │
│ created_at                  TIMESTAMP (DEFAULT: now())       │
│ updated_at                  TIMESTAMP (DEFAULT: now())       │
└─────────────────────────────────────────────────────────────┘
```

### reminder_log Table
```sql
┌─────────────────────────────────────────────────────────────┐
│ reminder_log                                                │
├─────────────────────────────────────────────────────────────┤
│ id                      UUID PRIMARY KEY                    │
│ user_id                 TEXT (DEFAULT: 'default')           │
│ type                    TEXT ('session'|'payment'|...)      │
│ student_id              TEXT                                │
│ student_name            TEXT                                │
│ phone_number            TEXT                                │
│ message_text            TEXT                                │
│ status                  TEXT ('sent'|'failed'|'skipped')   │
│ twilio_message_sid      TEXT (nullable)                     │
│ error_message           TEXT (nullable)                     │
│ session_id              TEXT (nullable)                     │
│ session_date            TEXT (nullable)                     │
│ reminder_interval       INT (1 or 2) ◄─ ADDED              │
│ month                   INT (nullable)                      │
│ year                    INT (nullable)                      │
│ sent_at                 TIMESTAMP (DEFAULT: now())          │
│ created_at              TIMESTAMP (DEFAULT: now())          │
└─────────────────────────────────────────────────────────────┘
```

---

## Deduplication Logic

### Old Logic (Single Reminder)
```
Query Dedup:
  SELECT * FROM reminder_log
  WHERE session_id = X
    AND type = 'session'
    AND status = 'sent'
  
Result: If found → SKIP, else → SEND
Problem: Only one reminder per session possible
```

### New Logic (Dual Reminders)
```
Query Dedup for Interval 1:
  SELECT * FROM reminder_log
  WHERE session_id = X
    AND type = 'session'
    AND reminder_interval = 1    ◄─ KEY DIFFERENCE
    AND status = 'sent'
  
Result: If found → SKIP, else → SEND

Query Dedup for Interval 2:
  SELECT * FROM reminder_log
  WHERE session_id = X
    AND type = 'session'
    AND reminder_interval = 2    ◄─ DIFFERENT INTERVAL
    AND status = 'sent'
  
Result: If found → SKIP, else → SEND

Outcome: Both reminders can be sent without duplicates ✅
```

---

## Component Communication

```
┌────────────────────────────────────────────────────────────────┐
│ Reminder Settings Dialog Component (React)                    │
│ ─────────────────────────────────────────────────────────────  │
│  State:                                                       │
│  • sessionEnabled: boolean                                   │
│  • sessionHours: number          ◄─ 1st interval            │
│  • sessionHours2: number         ◄─ 2nd interval (NEW)      │
│  • sessionTemplate: string                                   │
│  • ... (payment, cancellation)                              │
│                                                              │
│  Handlers:                                                   │
│  • handleSave() → calls saveSettings()                      │
│  • handleOpenChange() → syncs state from DB                │
│                                                              │
│  UI Elements:                                                │
│  • Toggle for reminders on/off                             │
│  • Select for "التذكير الأول (قبل):"                        │
│  • Select for "التذكير الثاني (قبل):" ◄─ NEW UI           │
│  • Textarea for message template                           │
│  • Button to save                                          │
└─────────────────────┬──────────────────────────────────────┘
                      │
                      │ calls
                      ▼
┌────────────────────────────────────────────────────────────────┐
│ useReminderSettings Hook                                      │
│ ─────────────────────────────────────────────────────────────  │
│  State:                                                       │
│  • settings: ReminderSettings ◄─ includes new field         │
│  • logs: ReminderLog[]          ◄─ includes reminder_interval│
│  • isLoading: boolean                                        │
│  • isSaving: boolean                                         │
│                                                              │
│  Methods:                                                    │
│  • fetchSettings() → queries reminder_settings table       │
│  • fetchLogs() → queries reminder_log table                │
│  • saveSettings() → upserts reminder_settings table        │
└─────────────────────┬──────────────────────────────────────┘
                      │
                      │ queries/updates
                      ▼
┌────────────────────────────────────────────────────────────────┐
│ Supabase Database                                             │
│ ─────────────────────────────────────────────────────────────  │
│  reminder_settings:                                          │
│  • Stores config (session_reminder_hours_2 added)          │
│                                                              │
│  reminder_log:                                               │
│  • Stores logs (reminder_interval added)                   │
└────────────────────────────────────────────────────────────────┘
```

---

## Edge Function Execution

```
Scheduled Trigger (Every hour):
         │
         ▼
    Load Settings ─────┐
    (reminder_settings)│
         │             │
         ├─ Read:      ├─ session_reminder_hours
         │             ├─ session_reminder_hours_2
         │             ├─ session_reminder_template
         │             └─ session_reminders_enabled
         │
         ▼
    For Reminder 1 (24h):
    ├─ Calculate: now + 24 hours
    ├─ Query sessions on that date
    ├─ For each session:
    │  ├─ Check dedup: reminder_interval=1
    │  ├─ Send WhatsApp (via Twilio)
    │  └─ Log result: reminder_interval=1
    │
    └─ Stats: sent=X, skipped=Y, errors=Z
         │
         ▼
    For Reminder 2 (1h):
    ├─ Calculate: now + 1 hour
    ├─ Query sessions on that date
    ├─ For each session:
    │  ├─ Check dedup: reminder_interval=2
    │  ├─ Send WhatsApp (via Twilio)
    │  └─ Log result: reminder_interval=2
    │
    └─ Stats: sent=A, skipped=B, errors=C
         │
         ▼
    Return JSON Response:
    {
      "success": true,
      "sent": X+A,
      "skipped": Y+B,
      "errors": Z+C,
      "reminders": [
        {"hours": 24, "interval": 1},
        {"hours": 1, "interval": 2}
      ]
    }
```

---

## State Flow Timeline

### Example: Session on Jan 15, 10:00 AM

```
Jan 13, 10:00 AM
│
├─ User opens Reminder Settings
│  ├─ useReminderSettings fetches from DB:
│  │  • session_reminder_hours = 24
│  │  • session_reminder_hours_2 = 1
│  │  • session_reminder_template = "مرحباً..."
│  │
│  └─ UI shows:
│     ├─ First Reminder: 24 ساعة
│     ├─ Second Reminder: 1 ساعة
│     └─ Template: "مرحباً..."
│
├─ User clicks "حفظ الإعدادات"
│  └─ saveSettings() updates DB:
│     reminder_settings {
│       session_reminder_hours: 24,
│       session_reminder_hours_2: 1,
│       session_reminder_template: "مرحباً..."
│     }
│
└─ (Wait for scheduled function)

Jan 14, 10:00 AM
│
├─ auto-session-reminder function runs
│  ├─ Read settings (24 + 1)
│  ├─ Check Interval 1 (24h):
│  │  ├─ Target time: now + 24h = Jan 15, 10:00 AM
│  │  ├─ Query sessions for Jan 15
│  │  ├─ Find: Session S-001
│  │  ├─ Check dedup: reminder_interval=1 → NOT FOUND
│  │  ├─ Send WhatsApp
│  │  └─ INSERT reminder_log:
│  │     {session_id: S-001, reminder_interval: 1, status: 'sent'}
│  │
│  └─ Check Interval 2 (1h):
│     ├─ Target time: now + 1h = Jan 14, 11:00 AM
│     ├─ Query sessions for Jan 14
│     ├─ No sessions found (S-001 is Jan 15)
│     └─ Skip
│
└─ Return: {sent: 1, skipped: 0, errors: 0}

Jan 15, 9:00 AM
│
├─ auto-session-reminder function runs
│  ├─ Read settings (24 + 1)
│  ├─ Check Interval 1 (24h):
│  │  ├─ Target time: now + 24h = Jan 16, 9:00 AM
│  │  ├─ Query sessions for Jan 16
│  │  ├─ No sessions found
│  │  └─ Skip
│  │
│  └─ Check Interval 2 (1h):
│     ├─ Target time: now + 1h = Jan 15, 10:00 AM
│     ├─ Query sessions for Jan 15
│     ├─ Find: Session S-001
│     ├─ Check dedup: reminder_interval=2 → NOT FOUND
│     │  (interval 1 was already sent, but this is interval 2)
│     ├─ Send WhatsApp
│     └─ INSERT reminder_log:
│        {session_id: S-001, reminder_interval: 2, status: 'sent'}
│
└─ Return: {sent: 1, skipped: 0, errors: 0}

Jan 15, 10:00 AM
│
└─ Session time - Student has received 2 reminders ✅
   Reminder 1: At 10:00 AM on Jan 14 (24h before)
   Reminder 2: At 9:00 AM on Jan 15 (1h before)
```

---

## Error Handling

```
During reminder sending:

Success Path:
  Twilio API response OK
  └─ INSERT reminder_log:
     {status: 'sent', twilio_message_sid: 'SM...'}

Failure Path:
  Twilio API error or exception
  └─ INSERT reminder_log:
     {
       status: 'failed',
       error_message: 'Twilio error details',
       twilio_message_sid: null
     }

Next Execution:
  ├─ Checks dedup with status='sent'
  ├─ Failed (status='failed') is NOT considered sent
  ├─ Function CAN retry sending on next execution
  └─ This prevents lost reminders due to temporary failures
```

