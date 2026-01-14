// AI Suggestions Types
// Enhanced queue-based system with status tracking and history

export type SuggestionType =
  | "pre_session"   // Before a specific session
  | "end_of_day"    // Unfinished confirmations
  | "pattern"       // Student behavior patterns
  | "payment"       // Late or unpaid balances
  | "schedule";     // Large gaps in the day

export type SuggestionPriority = "critical" | "high" | "medium" | "low";

// Status for queue management
export type SuggestionStatus = "pending" | "actioned" | "dismissed";

export interface SuggestionAction {
  label: string;
  target: string; // e.g., "open_student:123", "open_payment:456"
}

// Related entity for auto-removal tracking
export interface RelatedEntity {
  type: "session" | "student" | "payment";
  id: string;
  // Condition key for auto-removal (e.g., "session_confirmed:abc123")
  conditionKey: string;
}

export interface AISuggestion {
  id: string;
  type: SuggestionType;
  priority: SuggestionPriority;
  // Numeric priority score (1-100, higher = more urgent)
  priorityScore: number;
  message: string;
  action: SuggestionAction;
  studentId?: string;
  sessionId?: string;
  // Related entity for condition-based auto-removal
  relatedEntity?: RelatedEntity;
  // Status for queue management
  status: SuggestionStatus;
  createdAt: string;
  // Whether this is a critical suggestion that should auto-show
  isCritical: boolean;
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

// Priority order for sorting (lower number = higher priority)
export const PRIORITY_ORDER: Record<SuggestionPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

// Priority scores for each level
export const PRIORITY_SCORES: Record<SuggestionPriority, number> = {
  critical: 90,
  high: 70,
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

