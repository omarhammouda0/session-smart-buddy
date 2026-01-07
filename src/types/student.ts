export interface Session {
  id: string;
  date: string; // YYYY-MM-DD format
  completed: boolean;
}

export interface ScheduleDay {
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, etc.
}

export interface Student {
  id: string;
  name: string;
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
