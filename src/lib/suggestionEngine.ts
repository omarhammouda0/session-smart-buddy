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
  params: Omit<AISuggestion, "status" | "isCritical" | "priority"> & { priorityScore: number }
): AISuggestion => ({
  ...params,
  priority: getPriorityFromScore(params.priorityScore),
  status: "pending",
  // Auto-show only for priority >= 70
  isCritical: params.priorityScore >= AUTO_SHOW_THRESHOLD,
});

interface SessionWithStudent {
  session: Session;
  student: Student;
}

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
    // "assigned" or undefined means not reviewed
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

// Calculate days since last payment or month end (whichever is more recent)
const getDaysSincePaymentDue = (
  student: Student,
  payments: StudentPayments[],
  currentTime: Date
): number => {
  const studentPayment = payments.find((p) => p.studentId === student.id);

  // Check for last payment record date
  if (studentPayment && studentPayment.payments.length > 0) {
    const sortedPayments = [...studentPayment.payments]
      .filter(p => p.isPaid && p.paidAt)
      .sort((a, b) => new Date(b.paidAt!).getTime() - new Date(a.paidAt!).getTime());

    if (sortedPayments.length > 0) {
      const lastPaidAt = new Date(sortedPayments[0].paidAt!);
      return differenceInDays(currentTime, lastPaidAt);
    }
  }

  // If no payment records, check if previous month is unpaid
  const currentMonth = currentTime.getMonth();
  const currentYear = currentTime.getFullYear();
  const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;

  const prevMonthPayment = studentPayment?.payments.find(
    (p) => p.month === prevMonth && p.year === prevYear
  );

  // If previous month not paid, calculate days since that month ended
  if (!prevMonthPayment || !prevMonthPayment.isPaid) {
    const monthEndDate = new Date(prevYear, prevMonth + 1, 0);
    return differenceInDays(currentTime, monthEndDate);
  }

  return 0;
};

/**
 * Main suggestion generation function
 * Implements STRICT priority rules - DO NOT modify priority values
 */
export function generateSuggestions(
  students: Student[],
  payments: StudentPayments[],
  currentTime: Date = new Date()
): AISuggestion[] {
  const suggestions: AISuggestion[] = [];
  const todayStr = format(currentTime, "yyyy-MM-dd");
  const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
  const thirtyDaysAgo = subDays(currentTime, 30);
  const thirtyDaysAgoStr = format(thirtyDaysAgo, "yyyy-MM-dd");

  // Track suggestions by key for deduplication
  // Rule: If two suggestions refer to same session/student, keep most recent
  const suggestionKeys = new Map<string, AISuggestion>();

  const addSuggestion = (suggestion: AISuggestion, key: string) => {
    const existing = suggestionKeys.get(key);
    if (!existing || new Date(suggestion.createdAt) >= new Date(existing.createdAt)) {
      suggestionKeys.set(key, suggestion);
    }
  };

  // ============================================
  // PRIORITY 100: Session ended, not confirmed
  // Must interrupt any current suggestion
  // ============================================
  students.forEach((student) => {
    student.sessions
      .filter((s) => s.date === todayStr && s.status === "scheduled")
      .forEach((session) => {
        const sessionTime = session.time || student.sessionTime || "16:00";
        const [hours, mins] = sessionTime.split(":").map(Number);
        const sessionDuration = session.duration || student.sessionDuration || 60;
        const sessionEndMinutes = hours * 60 + mins + sessionDuration;

        // Session has ended but not confirmed
        if (currentMinutes > sessionEndMinutes) {
          const suggestion = createSuggestion({
            id: generateId("end_of_day", student.id, session.id),
            type: "end_of_day",
            priorityScore: PRIORITY_LEVELS.SESSION_UNCONFIRMED, // 100
            message: `حصة ${student.name} خلصت ومحتاجة تأكيد`,
            action: {
              label: "تأكيد الحصة",
              target: `mark_complete:${student.id}:${session.id}`,
            },
            studentId: student.id,
            sessionId: session.id,
            relatedEntity: createRelatedEntity("session", session.id, "session_confirmed"),
            createdAt: currentTime.toISOString(),
          });
          addSuggestion(suggestion, `session:${session.id}`);
        }
      });
  });

  // ============================================
  // PRIORITY 100: Payment overdue 30+ days
  // Must interrupt any current suggestion
  // Actions: تسجيل دفعة OR تذكير واتساب
  // ============================================
  students.forEach((student) => {
    const daysSincePayment = getDaysSincePaymentDue(student, payments, currentTime);

    if (daysSincePayment >= 30) {
      const suggestion = createSuggestion({
        id: generateId("payment", student.id, "overdue-30"),
        type: "payment",
        priorityScore: PRIORITY_LEVELS.PAYMENT_OVERDUE_30_DAYS, // 100
        message: `⚠️ ${student.name} لم يدفع منذ ${toArabicNumerals(daysSincePayment)} يوم`,
        action: {
          label: "تسجيل دفعة",
          target: `open_payment:${student.id}`,
        },
        // Secondary action: WhatsApp reminder (only if phone exists)
        secondaryAction: student.phone ? {
          label: "تذكير واتساب",
          target: `send_whatsapp:${student.id}`,
        } : undefined,
        studentId: student.id,
        phone: student.phone,
        relatedEntity: createRelatedEntity("payment", student.id, "payment_received"),
        createdAt: currentTime.toISOString(),
      });
      addSuggestion(suggestion, `payment:${student.id}`);
    }
  });

  // ============================================
  // PRIORITY 100: 30 minutes before session
  // Shows ONCE per session (resets on page refresh)
  // Must include: student name, last note summary, homework status
  // Actions: عرض الملاحظات OR عرض تفاصيل الحصة
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

      // Window: 25-35 minutes before session (centered on 30 min)
      if (minutesUntil >= 25 && minutesUntil <= 35) {
        const reminderKey = `pre30:${session.id}`;

        // Only show ONCE per session - do NOT repeat if dismissed
        if (!shownPreSession30MinReminders.has(reminderKey)) {
          shownPreSession30MinReminders.add(reminderKey);

          const lastNote = getLastNote(student, todayStr);
          const homeworkInfo = getHomeworkStatus(student, todayStr);

          // Build message with student name, last note, and homework status
          let message = `📚 حصة ${student.name} كمان ${toArabicNumerals(minutesUntil)} دقيقة`;

          // Add last note summary if exists
          if (lastNote?.content) {
            const notePreview = lastNote.content.slice(0, 50);
            message += `\nآخر ملاحظة: ${notePreview}${lastNote.content.length > 50 ? "..." : ""}`;
          }

          // Add homework status
          const hwStatusText = {
            none: "لا يوجد واجب",
            assigned: "واجب لم يُراجع",
            completed: "واجب مكتمل ✓",
            not_completed: "واجب غير مكتمل ✗",
          }[homeworkInfo.status];
          message += `\nالواجب: ${hwStatusText}`;

          const suggestion = createSuggestion({
            id: generateId("pre_session", student.id, `30min-${session.id}`),
            type: "pre_session",
            priorityScore: PRIORITY_LEVELS.PRE_SESSION_30_MIN, // 100
            message,
            // Action based on whether we have notes
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
          });
          addSuggestion(suggestion, `pre30:${session.id}`);
        }
      }
    });
  });

  // ============================================
  // PRIORITY 90: End of day summary (multiple unconfirmed)
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

  // Only show summary if more than 1 unconfirmed (individual ones are priority 100)
  if (unconfirmedCount > 1) {
    const suggestion = createSuggestion({
      id: generateId("end_of_day", "all", todayStr),
      type: "end_of_day",
      priorityScore: PRIORITY_LEVELS.END_OF_DAY_UNCONFIRMED, // 90
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
  // - Homework not reviewed
  // - Important previous notes
  // - Student with frequent cancellations
  // ============================================
  students.forEach((student) => {
    const todaySessions = student.sessions.filter(
      (s) => s.date === todayStr && s.status === "scheduled"
    );

    // Check recent cancellations
    const recentCancellations = student.sessions.filter(
      (s) => s.status === "cancelled" && s.date >= thirtyDaysAgoStr && s.date <= todayStr
    );
    const hasFrequentCancellations = recentCancellations.length >= 3;

    todaySessions.forEach((session) => {
      const sessionTime = session.time || student.sessionTime || "16:00";
      const [hours, mins] = sessionTime.split(":").map(Number);
      const sessionMinutes = hours * 60 + mins;
      const minutesUntil = sessionMinutes - currentMinutes;

      // Within 60 minutes but NOT in 30-min window (that's priority 100)
      if (minutesUntil > 35 && minutesUntil <= 60) {
        const homeworkInfo = getHomeworkStatus(student, todayStr);

        // Homework not reviewed - Priority 80
        if (homeworkInfo.status === "assigned") {
          const suggestion = createSuggestion({
            id: generateId("pre_session", student.id, `hw-${session.id}`),
            type: "pre_session",
            priorityScore: PRIORITY_LEVELS.PRE_SESSION_HOMEWORK, // 80
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

        // Frequent cancellations - Priority 80
        if (hasFrequentCancellations) {
          const suggestion = createSuggestion({
            id: generateId("pre_session", student.id, `cancel-${session.id}`),
            type: "pre_session",
            priorityScore: PRIORITY_LEVELS.PRE_SESSION_FREQUENT_CANCEL, // 80
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
  // Only when no pre-session warning already exists
  // ============================================
  students.forEach((student) => {
    const recentCancellations = student.sessions.filter(
      (s) => s.status === "cancelled" && s.date >= thirtyDaysAgoStr && s.date <= todayStr
    );

    if (recentCancellations.length >= 3) {
      // Check if we already have a pre-session warning for this student
      const hasPreSessionWarning = Array.from(suggestionKeys.values()).some(
        (s) => s.type === "pre_session" && s.studentId === student.id
      );

      if (!hasPreSessionWarning) {
        const suggestion = createSuggestion({
          id: generateId("pattern", student.id, "cancellations"),
          type: "pattern",
          priorityScore: PRIORITY_LEVELS.PATTERN_FREQUENT_CANCEL, // 70
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
  // PRIORITY 50: Large schedule gaps (≥2 hours)
  // Does NOT auto-show (below threshold of 70)
  // ============================================
  const todaySessions: SessionWithStudent[] = [];
  students.forEach((student) => {
    student.sessions
      .filter((s) => s.date === todayStr && s.status === "scheduled")
      .forEach((session) => {
        todaySessions.push({ session, student });
      });
  });

  // Sort sessions by time
  todaySessions.sort((a, b) => {
    const timeA = a.session.time || a.student.sessionTime || "00:00";
    const timeB = b.session.time || b.student.sessionTime || "00:00";
    return timeA.localeCompare(timeB);
  });

  // Find gaps between consecutive sessions
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

    // Gap of 2+ hours
    if (gapMinutes >= 120) {
      const gapHours = Math.floor(gapMinutes / 60);
      const suggestion = createSuggestion({
        id: generateId("schedule", "gap", `${current.session.id}-${next.session.id}`),
        type: "schedule",
        priorityScore: PRIORITY_LEVELS.SCHEDULE_GAP, // 50
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
  // COLLECT, SORT BY PRIORITY, LIMIT TO 5
  // Higher priority = shown first
  // Priority 100 always interrupts
  // ============================================
  const allSuggestions = Array.from(suggestionKeys.values());

  allSuggestions.sort((a, b) => {
    // Higher priority score first
    if (b.priorityScore !== a.priorityScore) {
      return b.priorityScore - a.priorityScore;
    }
    // For same priority, older suggestions first (FIFO)
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  return allSuggestions.slice(0, 5);
}

/**
 * Check if a specific condition is still valid
 * Used for auto-removal when condition is resolved
 */
export function isConditionStillValid(
  conditionKey: string,
  students: Student[],
  payments: StudentPayments[]
): boolean {
  const [conditionType, entityId] = conditionKey.split(":");

  switch (conditionType) {
    case "session_confirmed": {
      // Valid if session is still unconfirmed
      for (const student of students) {
        const session = student.sessions.find((s) => s.id === entityId);
        if (session && session.status === "scheduled") {
          return true;
        }
      }
      return false;
    }

    case "session_started": {
      // Pre-session suggestions invalid once session time passes
      for (const student of students) {
        const session = student.sessions.find((s) => s.id === entityId);
        if (session && session.status === "scheduled") {
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
      // Valid if student still hasn't paid for 30+ days
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
