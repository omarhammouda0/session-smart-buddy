export type SessionStatus = 'scheduled' | 'completed' | 'cancelled';

export interface SessionHistory {
  status: SessionStatus;
  timestamp: string;
  note?: string;
}

export interface Session {
  id: string;
  date: string; // YYYY-MM-DD format
  time?: string; // HH:mm format - overrides student's default sessionTime
  completed: boolean;
  status: SessionStatus;
  history: SessionHistory[];
  cancelledAt?: string;
  completedAt?: string;
}

export interface ScheduleDay {
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, etc.
}

export type SessionType = 'online' | 'onsite';

export interface Student {
  id: string;
  sessionTime: string; // HH:mm format like "16:30"
  name: string;
  phone?: string; // WhatsApp contact number
  sessionType: SessionType; // online or on-site
  scheduleDays: ScheduleDay[]; // Which days of the week they have sessions
  semesterStart: string; // YYYY-MM-DD
  semesterEnd: string; // YYYY-MM-DD
  sessions: Session[];
  createdAt: string;
}

export interface MonthlyPayment {
  month: number; // 0-11
  year: number;
  isPaid: boolean;
  paidAt?: string;
}

export interface StudentPayments {
  studentId: string;
  payments: MonthlyPayment[];
}

export interface AppSettings {
  defaultSemesterMonths: number;
  defaultSemesterStart: string;
  defaultSemesterEnd: string;
}

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
