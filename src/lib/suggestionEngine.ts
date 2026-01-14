// AI Suggestion Engine - Rule-based analysis
// Generates suggestions based on student data, payments, and session patterns
// Enhanced with priority scores, condition keys for auto-removal, and status tracking

import { Student, StudentPayments, Session } from "@/types/student";
import { AISuggestion, SuggestionType, SuggestionPriority, RelatedEntity, PRIORITY_SCORES } from "@/types/suggestions";
import { format, differenceInDays, subDays } from "date-fns";

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

// Helper to create suggestion with defaults
const createSuggestion = (
  params: Omit<AISuggestion, "status" | "isCritical"> & { isCritical?: boolean }
): AISuggestion => ({
  ...params,
  status: "pending",
  isCritical: params.isCritical ?? params.priority === "critical",
});

interface SessionWithStudent {
  session: Session;
  student: Student;
}

/**
 * Main suggestion generation function
 * Analyzes all data and returns up to 5 prioritized suggestions
 * Now includes priority scores and condition keys for auto-removal
 */
export function generateSuggestions(
  students: Student[],
  payments: StudentPayments[],
  currentTime: Date = new Date()
): AISuggestion[] {
  const suggestions: AISuggestion[] = [];
  const todayStr = format(currentTime, "yyyy-MM-dd");
  const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();

  // ============================================
  // 1. PRE-SESSION SUGGESTIONS (10 min before)
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

      // Check if session is 10 minutes away (within 10-15 min window)
      if (minutesUntil > 0 && minutesUntil <= 15) {
        // Find last session with notes
        const pastSessions = student.sessions
          .filter((s) => s.date < todayStr && (s.notes || s.topic || s.homework))
          .sort((a, b) => b.date.localeCompare(a.date));

        const lastSession = pastSessions[0];

        if (lastSession) {
          const topicText = lastSession.topic || lastSession.notes?.slice(0, 30) || "واجب";
          suggestions.push({
            id: generateId("pre_session", student.id, session.id),
            type: "pre_session",
            priority: "medium",
            message: `عند ${student.name} حصة كمان ${toArabicNumerals(minutesUntil)} دقيقة، آخر مرة: ${topicText}`,
            action: {
              label: "عرض الملاحظات",
              target: `open_session_notes:${student.id}:${lastSession.id}`,
            },
            studentId: student.id,
            sessionId: session.id,
            createdAt: currentTime.toISOString(),
          });
        }
      }
    });
  });

  // ============================================
  // 2. END OF DAY - Unconfirmed Sessions
  // ============================================
  const unconfirmedSessions: SessionWithStudent[] = [];

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
          unconfirmedSessions.push({ session, student });
        }
      });
  });

  if (unconfirmedSessions.length > 0) {
    const count = unconfirmedSessions.length;
    suggestions.push({
      id: generateId("end_of_day", "all", todayStr),
      type: "end_of_day",
      priority: "high",
      message: `${toArabicNumerals(count)} حصص خلصت ومحتاجة تأكيد`,
      action: {
        label: "عرض الحصص",
        target: "show_today_sessions",
      },
      createdAt: currentTime.toISOString(),
    });
  }

  // ============================================
  // 3. PATTERN - Cancellation Patterns (3+ in 30 days)
  // ============================================
  const thirtyDaysAgo = subDays(currentTime, 30);
  const thirtyDaysAgoStr = format(thirtyDaysAgo, "yyyy-MM-dd");

  students.forEach((student) => {
    const recentCancellations = student.sessions.filter(
      (s) => s.status === "cancelled" && s.date >= thirtyDaysAgoStr && s.date <= todayStr
    );

    if (recentCancellations.length >= 3) {
      suggestions.push({
        id: generateId("pattern", student.id, "cancellations"),
        type: "pattern",
        priority: "critical",
        message: `${student.name} لغى ${toArabicNumerals(recentCancellations.length)} مرات في آخر شهر`,
        action: {
          label: "عرض التفاصيل",
          target: `open_student:${student.id}`,
        },
        studentId: student.id,
        createdAt: currentTime.toISOString(),
      });
    }
  });

  // ============================================
  // 4. PAYMENT - Unpaid after month ends
  // ============================================
  const currentMonth = currentTime.getMonth();
  const currentYear = currentTime.getFullYear();

  // Check previous month's payments
  const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;

  students.forEach((student) => {
    const studentPayment = payments.find((p) => p.studentId === student.id);
    if (!studentPayment) return;

    // Check if previous month is unpaid
    const prevMonthPayment = studentPayment.payments.find(
      (p) => p.month === prevMonth && p.year === prevYear
    );

    const isUnpaid = !prevMonthPayment || !prevMonthPayment.isPaid;

    if (isUnpaid) {
      // Calculate days since month ended
      const monthEndDate = new Date(prevYear, prevMonth + 1, 0); // Last day of prev month
      const daysSinceMonthEnd = differenceInDays(currentTime, monthEndDate);

      if (daysSinceMonthEnd > 0) {
        suggestions.push({
          id: generateId("payment", student.id, `${prevYear}-${prevMonth}`),
          type: "payment",
          priority: "critical",
          message: `${student.name} مدفعش من ${toArabicNumerals(daysSinceMonthEnd)} يوم`,
          action: {
            label: "تسجيل دفعة",
            target: `open_payment:${student.id}`,
          },
          studentId: student.id,
          createdAt: currentTime.toISOString(),
        });
      }
    }
  });

  // ============================================
  // 5. SCHEDULE - Large gaps (≥2 hours) between sessions today
  // ============================================
  const todaySessions: SessionWithStudent[] = [];

  students.forEach((student) => {
    student.sessions
      .filter((s) => s.date === todayStr && s.status === "scheduled")
      .forEach((session) => {
        todaySessions.push({ session, student });
      });
  });

  // Sort by time
  todaySessions.sort((a, b) => {
    const timeA = a.session.time || a.student.sessionTime || "00:00";
    const timeB = b.session.time || b.student.sessionTime || "00:00";
    return timeA.localeCompare(timeB);
  });

  // Find gaps
  for (let i = 0; i < todaySessions.length - 1; i++) {
    const current = todaySessions[i];
    const next = todaySessions[i + 1];

    const currentTime1 = current.session.time || current.student.sessionTime || "16:00";
    const [h1, m1] = currentTime1.split(":").map(Number);
    const currentDuration = current.session.duration || current.student.sessionDuration || 60;
    const currentEndMinutes = h1 * 60 + m1 + currentDuration;

    const nextTime = next.session.time || next.student.sessionTime || "16:00";
    const [h2, m2] = nextTime.split(":").map(Number);
    const nextStartMinutes = h2 * 60 + m2;

    const gapMinutes = nextStartMinutes - currentEndMinutes;

    // Gap of 2 hours or more
    if (gapMinutes >= 120) {
      const gapHours = Math.floor(gapMinutes / 60);
      suggestions.push({
        id: generateId("schedule", "gap", `${current.session.id}-${next.session.id}`),
        type: "schedule",
        priority: "low",
        message: `فيه ${toArabicNumerals(gapHours)} ساعة فاضية بين حصة ${current.student.name} و${next.student.name}`,
        action: {
          label: "عرض الجدول",
          target: "show_calendar",
        },
        createdAt: currentTime.toISOString(),
      });
    }
  }

  // ============================================
  // SORT BY PRIORITY AND LIMIT TO 5
  // ============================================
  const priorityOrder: Record<SuggestionPriority, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };

  suggestions.sort((a, b) => {
    // First by priority
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityDiff !== 0) return priorityDiff;

    // Then by creation time (newest first)
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return suggestions.slice(0, 5);
}

