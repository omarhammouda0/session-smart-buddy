export type SessionStatus = "scheduled" | "completed" | "cancelled" | "vacation";

export interface SessionHistory {
  status: SessionStatus;
  timestamp: string;
  note?: string;
}

export type HomeworkStatus = "none" | "assigned" | "completed" | "incomplete";

export interface Session {
  id: string;
  date: string; // YYYY-MM-DD format
  time?: string; // HH:mm format - overrides student's default sessionTime
  duration?: number; // Session duration in minutes (default: 60)
  completed: boolean;
  status: SessionStatus;
  history: SessionHistory[];
  cancelledAt?: string;
  completedAt?: string;
  vacationAt?: string;
  // Session notes and homework tracking
  topic?: string; // Session topic/subject
  notes?: string; // Tutor notes about the session
  homework?: string; // Homework description
  homeworkStatus?: HomeworkStatus; // Homework completion status
}

export interface ScheduleDay {
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, etc.
}

export type SessionType = "online" | "onsite";

// Cancellation policy settings per student
export interface CancellationPolicy {
  monthlyLimit: number | null; // null = unlimited
  alertTutor: boolean; // Notify tutor when limit reached
  autoNotifyParent: boolean; // Auto-send WhatsApp to parent
}

export interface Student {
  id: string;
  sessionTime: string; // HH:mm format like "16:30"
  sessionDuration?: number; // Default session duration in minutes for this student
  customPriceOnsite?: number; // Custom on-site price for this student
  customPriceOnline?: number; // Custom online price for this student
  useCustomSettings?: boolean; // Whether to use custom settings or global defaults
  name: string;
  phone?: string; // Student's WhatsApp contact number
  parentPhone?: string; // Parent's WhatsApp number for notifications
  sessionType: SessionType; // online or on-site
  scheduleDays: ScheduleDay[]; // Which days of the week they have sessions
  semesterStart: string; // YYYY-MM-DD
  semesterEnd: string; // YYYY-MM-DD
  sessions: Session[];
  createdAt: string;
  // Cancellation policy
  cancellationPolicy?: CancellationPolicy;
}

// ✅ ADD THIS TYPE (NEW!)
export type PaymentMethod = "cash" | "bank" | "wallet";

// ✅ MODIFIED MonthlyPayment interface with NEW fields
export interface MonthlyPayment {
  month: number; // 0-11
  year: number;
  isPaid: boolean;
  paidAt?: string;
  amount?: number; // ← NEW: Payment amount
  method?: PaymentMethod; // ← NEW: Payment method (cash/bank/wallet)
  notes?: string; // ← NEW: Payment notes
}

export interface StudentPayments {
  studentId: string;
  payments: MonthlyPayment[];
}

export interface AppSettings {
  defaultSemesterMonths: number;
  defaultSemesterStart: string;
  defaultSemesterEnd: string;
  defaultSessionDuration: number; // Default session duration in minutes (default: 60)
  defaultPriceOnsite?: number; // Default on-site session price
  defaultPriceOnline?: number; // Default online session price
}

// Duration constants
export const DURATION_OPTIONS = [30, 45, 60, 90, 120] as const;
export const DEFAULT_DURATION = 60;
export const MIN_DURATION = 15;
export const MAX_DURATION = 240;

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const DAY_NAMES_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
