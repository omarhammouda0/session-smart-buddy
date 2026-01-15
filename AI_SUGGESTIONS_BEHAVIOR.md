# AI Suggestions System - Complete Behavior Documentation

> **Last Updated:** January 15, 2026  
> **Version:** 2.0 (Strict Priority System)

---

## Overview

The AI Suggestions system proactively surfaces critical issues to the tutor, reducing mental load without being noisy or annoying. It is **NOT** a chatbot - it generates short suggestions based on app data and user behavior.

---

## Core Principles

| Principle | Implementation |
|-----------|---------------|
| **Single Display** | Only ONE suggestion shown at a time |
| **Priority Queue** | Higher score = shown first |
| **Auto-Show Threshold** | Priority ≥ 70 auto-shows |
| **Interrupt Threshold** | Priority = 100 always interrupts |
| **Memory-Only Active** | Active suggestions reset on page refresh |
| **Persistent History** | Dismissed items stored for 30 days |

---

## Priority Levels (DO NOT MODIFY)

```typescript
PRIORITY_LEVELS = {
  // PRIORITY 100 - BLOCKING / IMMEDIATE
  SESSION_UNCONFIRMED: 100,
  PAYMENT_OVERDUE_30_DAYS: 100,
  PRE_SESSION_30_MIN: 100,

  // PRIORITY 90
  END_OF_DAY_UNCONFIRMED: 90,

  // PRIORITY 80
  PRE_SESSION_HOMEWORK: 80,
  PRE_SESSION_IMPORTANT_NOTES: 80,
  PRE_SESSION_FREQUENT_CANCEL: 80,

  // PRIORITY 70
  PATTERN_FREQUENT_CANCEL: 70,
  PATTERN_IRREGULAR: 70,

  // PRIORITY 50
  SCHEDULE_GAP: 50,

  // PRIORITY 30
  GENERAL_AWARENESS: 30,
}
```

---

## Suggestion Types

| Type | Icon | Arabic Label | Description |
|------|------|--------------|-------------|
| `pre_session` | 📚 | قبل الحصة | Before a specific session |
| `end_of_day` | ✅ | نهاية اليوم | Unfinished confirmations |
| `pattern` | ⚠️ | نمط سلوك | Student behavior patterns |
| `payment` | 💰 | مدفوعات | Late or unpaid balances |
| `schedule` | ⏰ | الجدول | Large gaps in the day |

---

## Detailed Trigger Rules

### Priority 100 - BLOCKING / IMMEDIATE

These suggestions **MUST** interrupt any current view and auto-show immediately.

#### 1. Session Ended, Not Confirmed
- **Trigger:** Session has ended (current time > session end time) AND status = "scheduled"
- **Message:** `حصة {studentName} خلصت ومحتاجة تأكيد`
- **Action:** `تأكيد الحصة` → marks session as completed
- **Auto-Removal:** When session is confirmed

#### 2. Payment Overdue 30+ Days
- **Trigger:** Days since last payment ≥ 30
- **Message:** `⚠️ {studentName} لم يدفع منذ {days} يوم`
- **Primary Action:** `تسجيل دفعة` → opens payment dialog
- **Secondary Action:** `تذكير واتساب` → sends WhatsApp via edge function (only if phone exists)
- **Auto-Removal:** When payment is recorded

#### 3. 30 Minutes Before Session
- **Trigger:** 25-35 minutes before session start time
- **Behavior:** Shows **ONCE per session** (resets on page refresh)
- **Message includes:**
  - Student name
  - Minutes until session
  - Last session notes (if any, max 50 chars)
  - Homework status: `لا يوجد واجب` | `واجب لم يُراجع` | `واجب مكتمل ✓` | `واجب غير مكتمل ✗`
- **Action (if notes exist):** `عرض الملاحظات` → opens session notes
- **Action (if no notes):** `عرض تفاصيل الحصة` → opens student details
- **Auto-Removal:** When session time passes

```
Example Message:
📚 حصة أحمد كمان ٣٠ دقيقة
آخر ملاحظة: راجعنا الجبر والمعادلات التربيعية...
الواجب: واجب لم يُراجع
```

---

### Priority 90

#### End of Day Summary
- **Trigger:** Multiple (>1) unconfirmed sessions that have ended
- **Message:** `{count} حصص خلصت ومحتاجة تأكيد`
- **Action:** `عرض الحصص` → switches to sessions tab
- **Note:** Individual session suggestions (priority 100) take precedence

---

### Priority 80

#### Pre-Session with Homework Not Reviewed
- **Trigger:** 35-60 minutes before session AND homework status = "assigned" (not reviewed)
- **Message:** `{studentName} عنده واجب محتاج مراجعة - الحصة كمان {minutes} دقيقة`
- **Action:** `عرض الملاحظات` → opens session notes

#### Pre-Session with Frequent Cancellations
- **Trigger:** 35-60 minutes before session AND student has ≥3 cancellations in last 30 days
- **Message:** `⚠️ {studentName} لغى {count} مرات - الحصة كمان {minutes} دقيقة`
- **Action:** `عرض التفاصيل` → opens student details

---

### Priority 70

#### Frequent Cancellation Pattern
- **Trigger:** Student has ≥3 cancellations in last 30 days AND no upcoming session today
- **Message:** `{studentName} لغى {count} مرات في آخر شهر`
- **Action:** `عرض التفاصيل` → opens student details
- **Note:** Only shows if no pre-session warning exists for this student

---

### Priority 50 (Does NOT Auto-Show)

#### Large Schedule Gap
- **Trigger:** ≥2 hours gap between consecutive sessions today
- **Message:** `فيه {hours} ساعة فاضية بين حصة {student1} و{student2}`
- **Action:** `عرض الجدول` → switches to calendar tab

---

## Queue Behavior

### Display Rules
1. Only ONE suggestion visible at a time
2. Highest priority score shows first
3. Same priority: older suggestions first (FIFO)
4. Maximum 5 suggestions generated per refresh

### Interrupt Rules
- Priority 100 suggestions **ALWAYS** interrupt lower priority ones
- When a new priority 100 suggestion appears:
  - Sound notification plays
  - Device vibrates (if supported)
  - Floating overlay card appears

### Removal Rules
A suggestion is removed from the queue ONLY when:
1. **Actioned:** User clicks the primary action button
2. **Dismissed:** User clicks "لاحقاً" or the X button
3. **Condition Resolved:** The underlying condition no longer exists (auto-removal)

---

## Auto-Removal Triggers

| Action in App | Removes Suggestions For |
|---------------|------------------------|
| Confirm session | That session's `end_of_day` suggestion |
| Record payment | That student's `payment` suggestion |
| Session time passes | `pre_session` suggestions for that session |
| Condition check (every 10s) | Any suggestion whose condition is invalid |

---

## Dismiss Behavior

### When Dismissed:
- Moved to history with reason: `manual` | `actioned` | `condition_resolved`
- Stored in localStorage for 30 days
- **Never auto-appears again** (same ID filtered out)
- Accessible via "السجل" (History) section in dropdown

### History Display:
- Shows up to 10 recent items
- Each item shows:
  - Icon + truncated message
  - Timestamp in Arabic format
  - Reason badge

---

## Persistence

| Data | Storage | Duration |
|------|---------|----------|
| Active suggestions | Memory only | Until page refresh |
| Dismissed history | localStorage | 30 days rolling |
| 30-min reminder tracking | Memory only | Until page refresh |

---

## UI Components

### 1. Header Widget (💡 Icon)
- Shows in header next to other action buttons
- Badge with pending count
- Red pulsing when priority 100 exists
- Dropdown on click

### 2. Dropdown Menu
```
┌─────────────────────────────────────┐
│ ✨ اقتراحات ذكية              [3]  │
├─────────────────────────────────────┤
│ [Current Suggestion - Prominent]    │
│ ┌─────────────────────────────────┐ │
│ │ 💰 أحمد لم يدفع منذ ٣٠ يوم    │ │
│ │ [تسجيل دفعة]                   │ │
│ │ [تذكير واتساب] (green)         │ │
│ └─────────────────────────────────┘ │
├─────────────────────────────────────┤
│ اقتراحات أخرى:                      │
│ • 📚 سارة عندها واجب...            │
│ • ⏰ فيه ٢ ساعة فاضية...           │
├─────────────────────────────────────┤
│ 📜 السجل [5]                   ▼   │
│ • تم التنفيذ - ١٥ يناير            │
│ • تم التجاهل - ١٤ يناير            │
└─────────────────────────────────────┘
```

### 3. Critical Interrupt Overlay
- Fixed position: top-20, right-4
- Red border, gradient background
- Pulsing warning icon
- "أولوية ١٠٠" badge
- Can be dismissed without actioning ("لاحقاً")
- Non-blocking: user can interact with app behind it

```
┌─────────────────────────────────────┐
│ ⚠️ تنبيه فوري    [أولوية ١٠٠]  [X] │
├─────────────────────────────────────┤
│ 📚 حصة أحمد كمان ٣٠ دقيقة          │
│    آخر ملاحظة: راجعنا الجبر...     │
│    الواجب: واجب لم يُراجع          │
│                                     │
│ [عرض الملاحظات] (red button)        │
│ [تذكير واتساب] (green, if payment)  │
│ [لاحقاً] (ghost button)             │
└─────────────────────────────────────┘
```

---

## Timing

| Event | Interval |
|-------|----------|
| Full refresh from engine | Every 1 hour |
| Condition validity check | Every 10 seconds |
| History cleanup (30+ days) | On app load |

---

## Deduplication Rules

- If two suggestions refer to the **same session**: keep most recent
- If two suggestions refer to the **same student** (for same type): keep most recent
- Suggestions in dismissed history are filtered out on generation

---

## Actions Reference

| Action Target | Handler | Description |
|---------------|---------|-------------|
| `mark_complete:{studentId}:{sessionId}` | `toggleSessionComplete` | Confirms session as completed |
| `open_payment:{studentId}` | Opens `QuickPaymentDialog` | Payment entry |
| `send_whatsapp:{studentId}` | `sendWhatsAppReminder` | Sends WhatsApp via edge function |
| `open_session_notes:{studentId}:{sessionId}` | Opens notes dialog | View/edit session notes |
| `open_student:{studentId}` | Switches to history tab | View student details |
| `show_today_sessions` | `setActiveTab("sessions")` | Show today's sessions |
| `show_calendar` | `setActiveTab("calendar")` | Show calendar view |

---

## Edge Cases (Explicitly Defined Behavior)

### Edge Case 1: Multiple Priority 100 Suggestions at Same Time

**Scenario:** Session A ends unconfirmed, Student B is overdue 45 days, Session C starts in 30 minutes.

**Behavior:** Within Priority 100, use secondary ordering:

| Sub-Priority | Type | Rationale |
|--------------|------|-----------|
| 1 (highest) | Session ended unconfirmed | Data integrity |
| 2 | Pre-session 30 min | Teaching quality |
| 3 (lowest) | Payment overdue | Money reminder |

```typescript
const PRIORITY_100_SUB_ORDER = {
  SESSION_UNCONFIRMED: 1,
  PRE_SESSION_30_MIN: 2,
  PAYMENT_OVERDUE: 3,
};
```

---

### Edge Case 2: Session Canceled After Pre-Session Reminder Fired

**Scenario:** 30-min reminder fired, student cancels session 10 minutes later.

**Behavior:** All `pre_session` suggestions related to that session are **auto-removed immediately** on the next condition check (every 10 seconds).

**Implementation:** In `isConditionStillValid()`:
```typescript
case "session_started": {
  // Session canceled → condition invalid → auto-remove
  if (!session || session.status === "cancelled") {
    return false;
  }
}
```

---

### Edge Case 3: Overlapping Sessions (Pre-Session Reminders)

**Scenario:** Session A at 5:00, Session B at 5:30 — both generate pre-session reminders within the 30-min window.

**Behavior:** The **closest upcoming session** is shown first. Sessions are sorted by start time within the same priority level.

**Implementation:** Each pre-session suggestion stores `_sessionStartMinutes` and sorting uses:
```typescript
if (a._sessionStartMinutes !== undefined && b._sessionStartMinutes !== undefined) {
  return a._sessionStartMinutes - b._sessionStartMinutes;
}
```

---

### Edge Case 4: Payment Overdue for Inactive Student

**Scenario:** Student hasn't had sessions in 3+ months but still triggers payment overdue.

**Decision:** **Option B - Downgrade to priority 70 if inactive**

**Definition of "Active":**
- Has upcoming sessions (today or future), OR
- Has completed sessions within the last 60 days

**Behavior:**
| Student Status | Priority | Message Format |
|----------------|----------|----------------|
| Active | 100 (interrupts) | `⚠️ {name} لم يدفع منذ {days} يوم` |
| Inactive | 70 (no interrupt) | `💰 {name} (غير نشط) لم يدفع منذ {days} يوم` |

---

### Edge Case 5: Dismissed Priority 100 + Condition Still True

**Scenario:** Tutor dismisses "payment overdue", no payment recorded, condition still exists.

**Behavior:**

```
⚠️ EXPLICIT DESIGN DECISION

Dismissal is treated as an explicit user decision.
The system will NOT resurface the same critical suggestion
even if the condition remains unresolved.

The suggestion remains in history with reason "manual".
```

**Rationale:** This prevents notification fatigue and respects user agency. The tutor has consciously chosen to defer action.

---

### Edge Case 6: Page Refresh Re-triggers Suggestions

**Scenario:** User refreshes the page after dismissing a time-based suggestion.

**Behavior:**

```
⚠️ KNOWN AND ACCEPTABLE BEHAVIOR

Because active suggestions are memory-only,
page refresh MAY re-trigger time-based suggestions
(e.g., 30-min pre-session reminder).

This is acceptable and NOT considered a bug.

However:
- Dismissed history IS persisted to localStorage
- Manually dismissed suggestions with the same ID will NOT reappear
```

---

## Runtime Behaviors

### When Priority 100 Appears:
1. Sound plays (800Hz beep, 0.3s)
2. Device vibrates (100ms-50ms-100ms pattern)
3. `hasCriticalInterrupt` becomes true
4. Floating overlay appears

### When All Suggestions Cleared:
- Empty state shown: "مفيش اقتراحات جديدة" with green checkmark
- History section still accessible if items exist

### WhatsApp Reminder (Payment):
- Only appears if student has phone number
- Uses existing `send-whatsapp-reminder` edge function
- Does NOT auto-remove suggestion (payment must be recorded)
- Shows toast on success/failure

---

## File Structure

```
src/
├── types/
│   └── suggestions.ts          # Types, priority constants, icons
├── lib/
│   ├── suggestionEngine.ts     # Rule-based generation logic
│   ├── suggestionQueue.ts      # Queue manager (singleton)
│   └── suggestionActions.ts    # Action router
├── hooks/
│   └── useAISuggestions.ts     # React hook for state management
└── components/
    └── AISuggestionsWidget.tsx # UI component
```

---

## Example Flow

```
1. App loads → students/payments fetched
2. generateSuggestions() called
3. Queue populated, sorted by priority
4. User sees: Widget badge shows "3"

5. Session ends (17:00)
6. 10-second condition check runs
7. New priority 100 suggestion created
8. Sound + vibration triggered
9. Overlay appears: "حصة أحمد خلصت ومحتاجة تأكيد"

10. User clicks "تأكيد الحصة"
11. Session marked complete
12. resolveByEntity("session", sessionId) called
13. Suggestion auto-removed
14. Next suggestion (if any) becomes current
```

---

## Configuration Constants

```typescript
// Thresholds
AUTO_SHOW_THRESHOLD = 70;     // Priority >= 70 auto-shows
INTERRUPT_THRESHOLD = 100;    // Priority = 100 interrupts

// Timing
REFRESH_INTERVAL = 60 * 60 * 1000;      // 1 hour
CONDITION_CHECK_INTERVAL = 10 * 1000;    // 10 seconds
HISTORY_MAX_DAYS = 30;                   // 30 days

// Limits
MAX_SUGGESTIONS = 5;          // Max suggestions per refresh
PRE_SESSION_WINDOW_MIN = 25;  // Minutes before session (min)
PRE_SESSION_WINDOW_MAX = 35;  // Minutes before session (max)
PAYMENT_OVERDUE_DAYS = 30;    // Days for critical payment alert
CANCELLATION_THRESHOLD = 3;   // Cancellations for pattern alert
SCHEDULE_GAP_MINUTES = 120;   // 2 hours for gap alert
```

---

## Arabic Numerals

All numbers in messages are displayed in Arabic numerals:
- ٠, ١, ٢, ٣, ٤, ٥, ٦, ٧, ٨, ٩

Example: "٣٠ دقيقة" instead of "30 دقيقة"

---

## Push Notifications (Background/Offline)

Priority 100 suggestions can also be delivered as **push notifications** when the browser is closed.

### How It Works

```
┌────────────────────────────────────────────────────────────┐
│  pg_cron (every 5 minutes)                                 │
│    └── check-critical-alerts edge function                 │
│          ├── Checks for Priority 100 conditions            │
│          └── Sends push via Firebase Cloud Messaging       │
└───────────────────────────────────────���────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────┐
│  Service Worker (firebase-messaging-sw.js)                 │
│    └── Shows notification even when browser is closed      │
└────────────────────────────────────────────────────────────┘
```

### Priority 100 Alerts Sent via Push

| Alert Type | Condition | Message |
|------------|-----------|---------|
| Session Unconfirmed | Session ended, status = scheduled | `حصة {name} خلصت ومحتاجة تأكيد` |
| Payment Overdue | 30+ days since last payment (active student) | `⚠️ {name} لم يدفع منذ {days} يوم` |
| Pre-Session 30min | 25-35 minutes before session | `📚 حصة {name} كمان ٣٠ دقيقة` |

### Deduplication

- Same `condition_key` won't trigger a new push within 1 hour
- Tracked in `push_notification_log` table

### Enabling Push Notifications

1. User must enable in Notification Settings dialog
2. Browser permission must be granted
3. FCM token stored in `push_subscriptions` table

### Related Files

- `src/hooks/usePushNotifications.ts` - Frontend hook
- `src/components/PushNotificationSettings.tsx` - Settings UI
- `supabase/functions/check-critical-alerts/index.ts` - Server-side checker
- `supabase/functions/send-push-notification/index.ts` - FCM sender
- `public/firebase-messaging-sw.js` - Service worker

See `PUSH_NOTIFICATIONS_SETUP.md` for full setup guide.

