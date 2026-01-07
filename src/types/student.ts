export interface Session {
  id: string;
  date: string | null;
  completed: boolean;
}

export interface MonthlyRecord {
  month: number;
  year: number;
  sessions: Session[];
  sessionsPerMonth: number;
  isPaid: boolean;
}

export interface Student {
  id: string;
  name: string;
  sessionsPerMonth: number;
  monthlyRecords: MonthlyRecord[];
  createdAt: string;
}
