import { format, addMonths, eachDayOfInterval, getDay, parseISO, startOfMonth, endOfMonth, isSameMonth } from 'date-fns';

export const generateDefaultSemester = (months: number = 4): { start: string; end: string } => {
  const today = new Date();
  const start = format(today, 'yyyy-MM-dd');
  const end = format(addMonths(today, months), 'yyyy-MM-dd');
  return { start, end };
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
