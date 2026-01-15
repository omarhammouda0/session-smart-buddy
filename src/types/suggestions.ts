// AI Suggestions Types
// Enhanced queue-based system with strict priority rules

export type SuggestionType =
  | "pre_session"   // Before a specific session
  | "end_of_day"    // Unfinished confirmations
  | "pattern"       // Student behavior patterns
  | "payment"       // Late or unpaid balances
  | "schedule";     // Large gaps in the day

export type SuggestionPriority = "critical" | "high" | "medium" | "low";

// Status for queue management
export type SuggestionStatus = "pending" | "actioned" | "dismissed";

// ============================================
// STRICT PRIORITY CONSTANTS - DO NOT MODIFY
// ============================================
export const PRIORITY_LEVELS = {
  // PRIORITY 100 - BLOCKING / IMMEDIATE (must interrupt)
  SESSION_UNCONFIRMED: 100,        // Session ended, not confirmed
  PAYMENT_OVERDUE_30_DAYS: 100,    // Student hasn't paid for 30+ days
  PRE_SESSION_30_MIN: 100,         // 30 minutes before session

  // PRIORITY 90
  END_OF_DAY_UNCONFIRMED: 90,      // End of day with unconfirmed sessions

  // PRIORITY 80
  PRE_SESSION_HOMEWORK: 80,        // Upcoming session, homework not reviewed
  PRE_SESSION_IMPORTANT_NOTES: 80, // Upcoming session, important previous notes
  PRE_SESSION_FREQUENT_CANCEL: 80, // Upcoming session, student cancels frequently

  // PRIORITY 70
  PATTERN_FREQUENT_CANCEL: 70,     // Student behavior: frequent cancellations
  PATTERN_IRREGULAR: 70,           // Student behavior: irregular attendance

  // PRIORITY 50
  SCHEDULE_GAP: 50,                // Large schedule gaps

  // PRIORITY 30
  GENERAL_AWARENESS: 30,           // Non-critical patterns
} as const;

// Auto-show threshold: suggestions with priority >= 70 can auto-show
export const AUTO_SHOW_THRESHOLD = 70;

// Interrupt threshold: priority 100 always interrupts
export const INTERRUPT_THRESHOLD = 100;

export interface SuggestionAction {
  label: string;
  target: string;
}

// Related entity for auto-removal tracking
export interface RelatedEntity {
  type: "session" | "student" | "payment";
  id: string;
  conditionKey: string;
}

// Last note info for pre-session reminders
export interface LastNoteInfo {
  content?: string;
  date?: string;
}

// Homework status for pre-session reminders
export interface HomeworkInfo {
  status: "none" | "assigned" | "completed" | "not_completed";
  description?: string;
}

export interface AISuggestion {
  id: string;
  type: SuggestionType;
  priority: SuggestionPriority;
  priorityScore: number;
  message: string;
  action: SuggestionAction;
  secondaryAction?: SuggestionAction;
  studentId?: string;
  sessionId?: string;
  relatedEntity?: RelatedEntity;
  status: SuggestionStatus;
  createdAt: string;
  isCritical: boolean;
  lastNote?: LastNoteInfo;
  homeworkInfo?: HomeworkInfo;
  phone?: string;
}

// Dismissed suggestion with history tracking
export interface DismissedSuggestion {
  id: string;
  type: SuggestionType;
  priority: SuggestionPriority;
  message: string;
  dismissedAt: string;
  reason: "manual" | "actioned" | "condition_resolved";
  studentId?: string;
}

// Priority order for sorting
export const PRIORITY_ORDER: Record<SuggestionPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

// Legacy priority scores
export const PRIORITY_SCORES: Record<SuggestionPriority, number> = {
  critical: 100,
  high: 80,
  medium: 50,
  low: 30,
};

// Icons for each suggestion type
export const SUGGESTION_ICONS: Record<SuggestionType, string> = {
  pre_session: "📚",
  end_of_day: "✅",
  pattern: "⚠️",
  payment: "💰",
  schedule: "⏰",
};

// Arabic labels for suggestion types
export const SUGGESTION_TYPE_LABELS: Record<SuggestionType, string> = {
  pre_session: "قبل الحصة",
  end_of_day: "نهاية اليوم",
  pattern: "نمط سلوك",
  payment: "مدفوعات",
  schedule: "الجدول",
};
