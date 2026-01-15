// AI Suggestion Engine - Rule-based analysis
// Strict priority system implementation
// DO NOT modify priority values - they are defined in types/suggestions.ts

import { Student, StudentPayments, Session } from "@/types/student";
import {
  AISuggestion,
  SuggestionType,
  SuggestionPriority,
  RelatedEntity,
  PRIORITY_LEVELS,
  AUTO_SHOW_THRESHOLD,
  HomeworkInfo,
  LastNoteInfo
} from "@/types/suggestions";
import { format, differenceInDays, subDays } from "date-fns";

// ============================================
// MEMORY-ONLY TRACKING (resets on page refresh)
// ============================================
// Track shown 30-min reminders to ensure they show ONCE per session
const shownPreSession30MinReminders = new Set<string>();

// ============================================
// EDGE CASE 1: SECONDARY ORDERING WITHIN PRIORITY 100
// ============================================
// When multiple priority 100 suggestions exist, use this sub-priority:
// 1. Session ended unconfirmed (data integrity)
// 2. Pre-session 30 min (teaching quality)
// 3. Payment overdue (money reminder)
const PRIORITY_100_SUB_ORDER = {
  SESSION_UNCONFIRMED: 1,  // Highest within P100
  PRE_SESSION_30_MIN: 2,
  PAYMENT_OVERDUE: 3,      // Lowest within P100
} as const;

// Generate unique ID for suggestions
const generateId = (type: SuggestionType, studentId?: string, extra?: string): string => {
  const base = `${type}-${studentId || "general"}-${extra || ""}`;
  return base.replace(/[^a-zA-Z0-9-]/g, "");
};

// Convert Arabic numerals for display
const toArabicNumerals = (num: number): string => {
  const arabicNumerals = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
  return num.toString().split("").map(d => arabicNumerals[parseInt(d)] || d).join("");
};

// Create a related entity with condition key for auto-removal
const createRelatedEntity = (
  type: "session" | "student" | "payment",
  id: string,
  conditionType: string
): RelatedEntity => ({
  type,
  id,
  conditionKey: `${conditionType}:${id}`,
});

// Determine priority label from score
const getPriorityFromScore = (score: number): SuggestionPriority => {
  if (score >= 100) return "critical";
  if (score >= 70) return "high";
  if (score >= 50) return "medium";
  return "low";
};

// Helper to create suggestion with defaults
const createSuggestion = (
  params: Omit<AISuggestion, "status" | "isCritical" | "priority"> & {
    priorityScore: number;
  }
): AISuggestion => ({
  ...params,
  priority: getPriorityFromScore(params.priorityScore),
  status: "pending",
  isCritical: params.priorityScore >= AUTO_SHOW_THRESHOLD,
});

interface SessionWithStudent {
  session: Session;
  student: Student;
}

// ============================================
// EDGE CASE 4: Check if student is "active"
// ============================================
// Active = has sessions in last 60 days OR has upcoming sessions
const isStudentActive = (student: Student, todayStr: string): boolean => {
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
  const sixtyDaysAgoStr = format(sixtyDaysAgo, "yyyy-MM-dd");

  // Has upcoming sessions
  const hasUpcoming = student.sessions.some(
    s => s.date >= todayStr && (s.status === "scheduled" || s.status === "completed")
  );

  // Has recent sessions (within 60 days)
  const hasRecent = student.sessions.some(
    s => s.date >= sixtyDaysAgoStr && s.date < todayStr && s.status === "completed"
  );

  return hasUpcoming || hasRecent;
};

// Get homework status for a student from their past sessions
const getHomeworkStatus = (student: Student, todayStr: string): HomeworkInfo => {
  const pastSessions = student.sessions
    .filter((s) => s.date < todayStr && s.homework)
    .sort((a, b) => b.date.localeCompare(a.date));

  if (pastSessions.length === 0) {
    return { status: "none" };
  }

  const lastSessionWithHomework = pastSessions[0];
  const hwStatus = lastSessionWithHomework.homeworkStatus;

  if (hwStatus === "completed") {
    return { status: "completed", description: lastSessionWithHomework.homework };
  } else if (hwStatus === "incomplete") {
    return { status: "not_completed", description: lastSessionWithHomework.homework };
  } else {
    return { status: "assigned", description: lastSessionWithHomework.homework };
  }
};

// Get last note for a student from their past sessions
const getLastNote = (student: Student, todayStr: string): LastNoteInfo | undefined => {
  const pastSessions = student.sessions
    .filter((s) => s.date < todayStr && (s.notes || s.topic))
    .sort((a, b) => b.date.localeCompare(a.date));

  if (pastSessions.length === 0) return undefined;

  const lastSession = pastSessions[0];
  return {
    content: lastSession.notes || lastSession.topic,
    date: lastSession.date,
  };
};

// Calculate days since last payment or month end
const getDaysSincePaymentDue = (
  student: Student,
  payments: StudentPayments[],
  currentTime: Date
): number => {
  const studentPayment = payments.find((p) => p.studentId === student.id);

  if (studentPayment && studentPayment.payments.length > 0) {
    const sortedPayments = [...studentPayment.payments]
      .filter(p => p.isPaid && p.paidAt)
      .sort((a, b) => new Date(b.paidAt!).getTime() - new Date(a.paidAt!).getTime());

    if (sortedPayments.length > 0) {
      const lastPaidAt = new Date(sortedPayments[0].paidAt!);
      return differenceInDays(currentTime, lastPaidAt);
    }
  }

  const currentMonth = currentTime.getMonth();
  const currentYear = currentTime.getFullYear();
  const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;

  const prevMonthPayment = studentPayment?.payments.find(
    (p) => p.month === prevMonth && p.year === prevYear
  );

  if (!prevMonthPayment || !prevMonthPayment.isPaid) {
    const monthEndDate = new Date(prevYear, prevMonth + 1, 0);
    return differenceInDays(currentTime, monthEndDate);
  }

  return 0;
};

/**
 * Extended suggestion interface for internal sorting
 */
interface SuggestionWithMeta extends AISuggestion {
  _subPriority?: number;
  _sessionStartMinutes?: number;
}

/**
 * Main suggestion generation function
 *
 * EDGE CASES HANDLED:
 * 1. Multiple P100: Uses sub-priority (unconfirmed > pre-session > payment)
 * 2. Canceled sessions: Auto-removed via condition check in isConditionStillValid
 * 3. Overlapping pre-sessions: Closest session shown first (_sessionStartMinutes)
 * 4. Inactive student payments: Downgraded to P70 if no upcoming sessions
 * 5. Dismissed P100: Stays dismissed (explicit user decision) - handled by queue
 * 6. Page refresh: May re-trigger (acceptable, documented)
 */
export function generateSuggestions(
  students: Student[],
  payments: StudentPayments[],
  currentTime: Date = new Date()
): AISuggestion[] {
  const todayStr = format(currentTime, "yyyy-MM-dd");
  const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
  const thirtyDaysAgo = subDays(currentTime, 30);
  const thirtyDaysAgoStr = format(thirtyDaysAgo, "yyyy-MM-dd");

  // Track suggestions with metadata for sorting
  const suggestionKeys = new Map<string, SuggestionWithMeta>();

  const addSuggestion = (suggestion: SuggestionWithMeta, key: string) => {
    const existing = suggestionKeys.get(key);
    if (!existing || new Date(suggestion.createdAt) >= new Date(existing.createdAt)) {
      suggestionKeys.set(key, suggestion);
    }
  };

  // ============================================
  // PRIORITY 100: Session ended, not confirmed
  // Sub-priority: 1 (highest within P100)
  // ============================================
  students.forEach((student) => {
    student.sessions
      .filter((s) => s.date === todayStr && s.status === "scheduled")
      .forEach((session) => {
        const sessionTime = session.time || student.sessionTime || "16:00";
        const [hours, mins] = sessionTime.split(":").map(Number);
        const sessionDuration = session.duration || student.sessionDuration || 60;
        const sessionEndMinutes = hours * 60 + mins + sessionDuration;

        if (currentMinutes > sessionEndMinutes) {
          const suggestion: SuggestionWithMeta = {
            ...createSuggestion({
              id: generateId("end_of_day", student.id, session.id),
              type: "end_of_day",
              priorityScore: PRIORITY_LEVELS.SESSION_UNCONFIRMED,
              message: `حصة ${student.name} خلصت ومحتاجة تأكيد`,
              action: {
                label: "تأكيد الحصة",
                target: `mark_complete:${student.id}:${session.id}`,
              },
              studentId: student.id,
              sessionId: session.id,
              relatedEntity: createRelatedEntity("session", session.id, "session_confirmed"),
              createdAt: currentTime.toISOString(),
            }),
            _subPriority: PRIORITY_100_SUB_ORDER.SESSION_UNCONFIRMED,
          };
          addSuggestion(suggestion, `session:${session.id}`);
        }
      });
  });

  // ============================================
  // PRIORITY 100 (or 70): Payment overdue 30+ days
  // Sub-priority: 3 (lowest within P100)
  //
  // EDGE CASE 4: Inactive student handling
  // If student has no upcoming sessions, downgrade to P70
  // ============================================
  students.forEach((student) => {
    const daysSincePayment = getDaysSincePaymentDue(student, payments, currentTime);

    if (daysSincePayment >= 30) {
      const isActive = isStudentActive(student, todayStr);

      // EDGE CASE 4: Downgrade to P70 if student is inactive
      const priorityScore = isActive
        ? PRIORITY_LEVELS.PAYMENT_OVERDUE_30_DAYS  // 100
        : PRIORITY_LEVELS.PATTERN_FREQUENT_CANCEL; // 70

      const suggestion: SuggestionWithMeta = {
        ...createSuggestion({
          id: generateId("payment", student.id, "overdue-30"),
          type: "payment",
          priorityScore,
          message: isActive
            ? `⚠️ ${student.name} لم يدفع منذ ${toArabicNumerals(daysSincePayment)} يوم`
            : `💰 ${student.name} (غير نشط) لم يدفع منذ ${toArabicNumerals(daysSincePayment)} يوم`,
          action: {
            label: "تسجيل دفعة",
            target: `open_payment:${student.id}`,
          },
          secondaryAction: student.phone ? {
            label: "تذكير واتساب",
            target: `send_whatsapp:${student.id}`,
          } : undefined,
          studentId: student.id,
          phone: student.phone,
          relatedEntity: createRelatedEntity("payment", student.id, "payment_received"),
          createdAt: currentTime.toISOString(),
        }),
        _subPriority: isActive ? PRIORITY_100_SUB_ORDER.PAYMENT_OVERDUE : undefined,
      };
      addSuggestion(suggestion, `payment:${student.id}`);
    }
  });

  // ============================================
  // PRIORITY 100: 30 minutes before session
  // Sub-priority: 2 (middle within P100)
  //
  // EDGE CASE 3: Overlapping sessions
  // Store session start time for sorting (closest first)
  // ============================================
  students.forEach((student) => {
    const todaySessions = student.sessions.filter(
      (s) => s.date === todayStr && s.status === "scheduled"
    );

    todaySessions.forEach((session) => {
      const sessionTime = session.time || student.sessionTime || "16:00";
      const [hours, mins] = sessionTime.split(":").map(Number);
      const sessionMinutes = hours * 60 + mins;
      const minutesUntil = sessionMinutes - currentMinutes;

      // Window: 25-35 minutes before session
      if (minutesUntil >= 25 && minutesUntil <= 35) {
        const reminderKey = `pre30:${session.id}`;

        if (!shownPreSession30MinReminders.has(reminderKey)) {
          shownPreSession30MinReminders.add(reminderKey);

          const lastNote = getLastNote(student, todayStr);
          const homeworkInfo = getHomeworkStatus(student, todayStr);

          let message = `📚 حصة ${student.name} كمان ${toArabicNumerals(minutesUntil)} دقيقة`;

          if (lastNote?.content) {
            const notePreview = lastNote.content.slice(0, 50);
            message += `\nآخر ملاحظة: ${notePreview}${lastNote.content.length > 50 ? "..." : ""}`;
          }

          const hwStatusText = {
            none: "لا يوجد واجب",
            assigned: "واجب لم يُراجع",
            completed: "واجب مكتمل ✓",
            not_completed: "واجب غير مكتمل ✗",
          }[homeworkInfo.status];
          message += `\nالواجب: ${hwStatusText}`;

          const suggestion: SuggestionWithMeta = {
            ...createSuggestion({
              id: generateId("pre_session", student.id, `30min-${session.id}`),
              type: "pre_session",
              priorityScore: PRIORITY_LEVELS.PRE_SESSION_30_MIN,
              message,
              action: lastNote ? {
                label: "عرض الملاحظات",
                target: `open_session_notes:${student.id}:${session.id}`,
              } : {
                label: "عرض تفاصيل الحصة",
                target: `open_student:${student.id}`,
              },
              studentId: student.id,
              sessionId: session.id,
              lastNote,
              homeworkInfo,
              relatedEntity: createRelatedEntity("session", session.id, "session_started"),
              createdAt: currentTime.toISOString(),
            }),
            _subPriority: PRIORITY_100_SUB_ORDER.PRE_SESSION_30_MIN,
            _sessionStartMinutes: sessionMinutes, // EDGE CASE 3: For closest-first sorting
          };
          addSuggestion(suggestion, `pre30:${session.id}`);
        }
      }
    });
  });

  // ============================================
  // PRIORITY 90: End of day summary
  // ============================================
  const unconfirmedCount = students.reduce((count, student) => {
    return count + student.sessions.filter((s) => {
      if (s.date !== todayStr || s.status !== "scheduled") return false;
      const sessionTime = s.time || student.sessionTime || "16:00";
      const [hours, mins] = sessionTime.split(":").map(Number);
      const sessionDuration = s.duration || student.sessionDuration || 60;
      const sessionEndMinutes = hours * 60 + mins + sessionDuration;
      return currentMinutes > sessionEndMinutes;
    }).length;
  }, 0);

  if (unconfirmedCount > 1) {
    const suggestion: SuggestionWithMeta = createSuggestion({
      id: generateId("end_of_day", "all", todayStr),
      type: "end_of_day",
      priorityScore: PRIORITY_LEVELS.END_OF_DAY_UNCONFIRMED,
      message: `${toArabicNumerals(unconfirmedCount)} حصص خلصت ومحتاجة تأكيد`,
      action: {
        label: "عرض الحصص",
        target: "show_today_sessions",
      },
      createdAt: currentTime.toISOString(),
    });
    addSuggestion(suggestion, "end_of_day_summary");
  }

  // ============================================
  // PRIORITY 80: Pre-session with issues
  // ============================================
  students.forEach((student) => {
    const todaySessions = student.sessions.filter(
      (s) => s.date === todayStr && s.status === "scheduled"
    );

    const recentCancellations = student.sessions.filter(
      (s) => s.status === "cancelled" && s.date >= thirtyDaysAgoStr && s.date <= todayStr
    );
    const hasFrequentCancellations = recentCancellations.length >= 3;

    todaySessions.forEach((session) => {
      const sessionTime = session.time || student.sessionTime || "16:00";
      const [hours, mins] = sessionTime.split(":").map(Number);
      const sessionMinutes = hours * 60 + mins;
      const minutesUntil = sessionMinutes - currentMinutes;

      // 35-60 minutes before (not in 30-min P100 window)
      if (minutesUntil > 35 && minutesUntil <= 60) {
        const homeworkInfo = getHomeworkStatus(student, todayStr);

        if (homeworkInfo.status === "assigned") {
          const suggestion: SuggestionWithMeta = createSuggestion({
            id: generateId("pre_session", student.id, `hw-${session.id}`),
            type: "pre_session",
            priorityScore: PRIORITY_LEVELS.PRE_SESSION_HOMEWORK,
            message: `${student.name} عنده واجب محتاج مراجعة - الحصة كمان ${toArabicNumerals(minutesUntil)} دقيقة`,
            action: {
              label: "عرض الملاحظات",
              target: `open_session_notes:${student.id}:${session.id}`,
            },
            studentId: student.id,
            sessionId: session.id,
            homeworkInfo,
            relatedEntity: createRelatedEntity("session", session.id, "session_started"),
            createdAt: currentTime.toISOString(),
          });
          addSuggestion(suggestion, `hw:${session.id}`);
        }

        if (hasFrequentCancellations) {
          const suggestion: SuggestionWithMeta = createSuggestion({
            id: generateId("pre_session", student.id, `cancel-${session.id}`),
            type: "pre_session",
            priorityScore: PRIORITY_LEVELS.PRE_SESSION_FREQUENT_CANCEL,
            message: `⚠️ ${student.name} لغى ${toArabicNumerals(recentCancellations.length)} مرات - الحصة كمان ${toArabicNumerals(minutesUntil)} دقيقة`,
            action: {
              label: "عرض التفاصيل",
              target: `open_student:${student.id}`,
            },
            studentId: student.id,
            sessionId: session.id,
            relatedEntity: createRelatedEntity("session", session.id, "session_started"),
            createdAt: currentTime.toISOString(),
          });
          addSuggestion(suggestion, `cancel:${session.id}`);
        }
      }
    });
  });

  // ============================================
  // PRIORITY 70: Frequent cancellation patterns
  // ============================================
  students.forEach((student) => {
    const recentCancellations = student.sessions.filter(
      (s) => s.status === "cancelled" && s.date >= thirtyDaysAgoStr && s.date <= todayStr
    );

    if (recentCancellations.length >= 3) {
      const hasPreSessionWarning = Array.from(suggestionKeys.values()).some(
        (s) => s.type === "pre_session" && s.studentId === student.id
      );

      if (!hasPreSessionWarning) {
        const suggestion: SuggestionWithMeta = createSuggestion({
          id: generateId("pattern", student.id, "cancellations"),
          type: "pattern",
          priorityScore: PRIORITY_LEVELS.PATTERN_FREQUENT_CANCEL,
          message: `${student.name} لغى ${toArabicNumerals(recentCancellations.length)} مرات في آخر شهر`,
          action: {
            label: "عرض التفاصيل",
            target: `open_student:${student.id}`,
          },
          studentId: student.id,
          relatedEntity: createRelatedEntity("student", student.id, "cancellation_pattern_reviewed"),
          createdAt: currentTime.toISOString(),
        });
        addSuggestion(suggestion, `pattern:${student.id}`);
      }
    }
  });

  // ============================================
  // PRIORITY 50: Large schedule gaps
  // ============================================
  const todaySessions: SessionWithStudent[] = [];
  students.forEach((student) => {
    student.sessions
      .filter((s) => s.date === todayStr && s.status === "scheduled")
      .forEach((session) => {
        todaySessions.push({ session, student });
      });
  });

  todaySessions.sort((a, b) => {
    const timeA = a.session.time || a.student.sessionTime || "00:00";
    const timeB = b.session.time || b.student.sessionTime || "00:00";
    return timeA.localeCompare(timeB);
  });

  for (let i = 0; i < todaySessions.length - 1; i++) {
    const current = todaySessions[i];
    const next = todaySessions[i + 1];

    const currentSessionTime = current.session.time || current.student.sessionTime || "16:00";
    const [h1, m1] = currentSessionTime.split(":").map(Number);
    const currentDuration = current.session.duration || current.student.sessionDuration || 60;
    const currentEndMinutes = h1 * 60 + m1 + currentDuration;

    const nextTime = next.session.time || next.student.sessionTime || "16:00";
    const [h2, m2] = nextTime.split(":").map(Number);
    const nextStartMinutes = h2 * 60 + m2;

    const gapMinutes = nextStartMinutes - currentEndMinutes;

    if (gapMinutes >= 120) {
      const gapHours = Math.floor(gapMinutes / 60);
      const suggestion: SuggestionWithMeta = createSuggestion({
        id: generateId("schedule", "gap", `${current.session.id}-${next.session.id}`),
        type: "schedule",
        priorityScore: PRIORITY_LEVELS.SCHEDULE_GAP,
        message: `فيه ${toArabicNumerals(gapHours)} ساعة فاضية بين حصة ${current.student.name} و${next.student.name}`,
        action: {
          label: "عرض الجدول",
          target: "show_calendar",
        },
        createdAt: currentTime.toISOString(),
      });
      addSuggestion(suggestion, `gap:${current.session.id}-${next.session.id}`);
    }
  }

  // ============================================
  // SORT WITH EDGE CASE HANDLING
  // ============================================
  const allSuggestions = Array.from(suggestionKeys.values());

  allSuggestions.sort((a, b) => {
    // 1. Higher priority score first
    if (b.priorityScore !== a.priorityScore) {
      return b.priorityScore - a.priorityScore;
    }

    // 2. EDGE CASE 1: Within Priority 100, use sub-priority
    if (a.priorityScore >= 100 && b.priorityScore >= 100) {
      const subA = a._subPriority ?? 99;
      const subB = b._subPriority ?? 99;
      if (subA !== subB) {
        return subA - subB; // Lower sub-priority = higher importance
      }

      // 3. EDGE CASE 3: For pre-session reminders, closest session first
      if (a._sessionStartMinutes !== undefined && b._sessionStartMinutes !== undefined) {
        return a._sessionStartMinutes - b._sessionStartMinutes;
      }
    }

    // 4. Default: older suggestions first (FIFO)
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  // Clean up internal metadata before returning
  return allSuggestions.slice(0, 5).map(s => {
    const { _subPriority, _sessionStartMinutes, ...suggestion } = s;
    void _subPriority; // Suppress unused variable warning
    void _sessionStartMinutes;
    return suggestion;
  });
}

/**
 * Check if a specific condition is still valid
 * Used for auto-removal when condition is resolved
 *
 * EDGE CASE 2: Session canceled → pre_session suggestions auto-removed
 */
export function isConditionStillValid(
  conditionKey: string,
  students: Student[],
  payments: StudentPayments[]
): boolean {
  const [conditionType, entityId] = conditionKey.split(":");

  switch (conditionType) {
    case "session_confirmed": {
      // Valid if session exists and is still unconfirmed
      for (const student of students) {
        const session = student.sessions.find((s) => s.id === entityId);
        if (session && session.status === "scheduled") {
          return true;
        }
      }
      return false;
    }

    case "session_started": {
      // EDGE CASE 2: Also check if session was canceled
      for (const student of students) {
        const session = student.sessions.find((s) => s.id === entityId);

        // Session doesn't exist or was canceled → condition invalid, auto-remove
        if (!session || session.status === "cancelled") {
          return false;
        }

        // Session is scheduled and hasn't started yet → condition valid
        if (session.status === "scheduled") {
          const sessionTime = session.time || student.sessionTime || "16:00";
          const [hours, mins] = sessionTime.split(":").map(Number);
          const sessionMinutes = hours * 60 + mins;
          const now = new Date();
          const currentMinutes = now.getHours() * 60 + now.getMinutes();
          const todayStr = format(now, "yyyy-MM-dd");

          if (session.date === todayStr && currentMinutes < sessionMinutes) {
            return true;
          }
        }
      }
      return false;
    }

    case "payment_received": {
      const student = students.find((s) => s.id === entityId);
      if (!student) return false;

      const daysSince = getDaysSincePaymentDue(student, payments, new Date());
      return daysSince >= 30;
    }

    case "cancellation_pattern_reviewed": {
      // Pattern suggestions stay valid until manually dismissed
      return true;
    }

    default:
      return true;
  }
}
