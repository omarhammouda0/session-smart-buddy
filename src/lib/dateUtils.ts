import { format, addMonths, eachDayOfInterval, getDay, parseISO, startOfMonth, endOfMonth, isSameMonth, startOfWeek } from 'date-fns';

export const generateDefaultSemester = (months: number = 4): { start: string; end: string } => {
  const today = new Date();
  // Start from the beginning of the current week (Sunday) to include past days like Monday
  const weekStart = startOfWeek(today, { weekStartsOn: 0 });
  const start = format(weekStart, 'yyyy-MM-dd');
  const end = format(addMonths(today, months), 'yyyy-MM-dd');
  return { start, end };
};

/**
 * Get evenly distributed days of the week based on sessions per week count.
 * Days are distributed starting from Sunday (0) to maximize spacing.
 *
 * @param sessionsPerWeek - Number of sessions per week (1-7)
 * @returns Array of day indices (0 = Sunday, 1 = Monday, etc.)
 *
 * Examples:
 * - 1 session  → [0] (Sunday)
 * - 2 sessions → [0, 3] (Sunday, Wednesday)
 * - 3 sessions → [0, 2, 4] (Sunday, Tuesday, Thursday)
 * - 4 sessions → [0, 2, 4, 6] (Sunday, Tuesday, Thursday, Saturday)
 * - 5 sessions → [0, 1, 3, 4, 6] (Sunday, Monday, Wednesday, Thursday, Saturday)
 * - 6 sessions → [0, 1, 2, 4, 5, 6] (Sunday, Monday, Tuesday, Thursday, Friday, Saturday)
 * - 7 sessions → [0, 1, 2, 3, 4, 5, 6] (All days)
 */
export const getDistributedDays = (sessionsPerWeek: number): number[] => {
  if (sessionsPerWeek <= 0) return [];
  if (sessionsPerWeek >= 7) return [0, 1, 2, 3, 4, 5, 6];

  const days: number[] = [];
  const interval = 7 / sessionsPerWeek;

  for (let i = 0; i < sessionsPerWeek; i++) {
    const day = Math.round(i * interval) % 7;
    days.push(day);
  }

  // Sort and remove duplicates
  return [...new Set(days)].sort((a, b) => a - b);
};

export const generateSessionsForSchedule = (
  scheduleDays: number[],
  semesterStart: string,
  semesterEnd: string
): string[] => {
  if (scheduleDays.length === 0) return [];
  
  const startDate = parseISO(semesterStart);
  const endDate = parseISO(semesterEnd);
  
  const allDays = eachDayOfInterval({ start: startDate, end: endDate });
  
  const sessionDates = allDays
    .filter(date => scheduleDays.includes(getDay(date)))
    .map(date => format(date, 'yyyy-MM-dd'));
  
  return sessionDates;
};

export const getSessionsForMonth = <T extends { date: string }>(
  sessions: T[],
  month: number,
  year: number
): T[] => {
  return sessions.filter(session => {
    const sessionDate = parseISO(session.date);
    return sessionDate.getMonth() === month && sessionDate.getFullYear() === year;
  });
};

export const getMonthsInSemester = (semesterStart: string, semesterEnd: string): { month: number; year: number }[] => {
  const startDate = parseISO(semesterStart);
  const endDate = parseISO(semesterEnd);
  
  const months: { month: number; year: number }[] = [];
  let current = startOfMonth(startDate);
  
  while (current <= endDate) {
    months.push({ month: current.getMonth(), year: current.getFullYear() });
    current = addMonths(current, 1);
  }
  
  return months;
};

export const formatMonthYear = (month: number, year: number): string => {
  const date = new Date(year, month, 1);
  return format(date, 'MMMM yyyy');
};

export const formatShortDate = (dateStr: string): string => {
  return format(parseISO(dateStr), 'MMM d');
};

export const formatDayMonth = (dateStr: string): string => {
  return format(parseISO(dateStr), 'EEE, MMM d');
};
