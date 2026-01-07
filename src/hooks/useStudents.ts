import { useState, useEffect } from 'react';
import { Student, MonthlyRecord, Session } from '@/types/student';

const STORAGE_KEY = 'teacher-students-data';

const generateId = () => Math.random().toString(36).substr(2, 9);

const createEmptySessions = (count: number): Session[] => {
  return Array.from({ length: count }, () => ({
    id: generateId(),
    date: null,
    completed: false,
  }));
};

const createMonthlyRecord = (month: number, year: number, sessionsPerMonth: number): MonthlyRecord => ({
  month,
  year,
  sessions: createEmptySessions(sessionsPerMonth),
  sessionsPerMonth,
  isPaid: false,
});

export const useStudents = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setStudents(JSON.parse(stored));
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(students));
    }
  }, [students, isLoaded]);

  const addStudent = (name: string, sessionsPerMonth: number = 8) => {
    const now = new Date();
    const newStudent: Student = {
      id: generateId(),
      name,
      sessionsPerMonth,
      monthlyRecords: [createMonthlyRecord(now.getMonth(), now.getFullYear(), sessionsPerMonth)],
      createdAt: new Date().toISOString(),
    };
    setStudents(prev => [...prev, newStudent]);
  };

  const removeStudent = (studentId: string) => {
    setStudents(prev => prev.filter(s => s.id !== studentId));
  };

  const updateStudentName = (studentId: string, name: string) => {
    setStudents(prev =>
      prev.map(s => (s.id === studentId ? { ...s, name } : s))
    );
  };

  const getOrCreateMonthlyRecord = (student: Student, month: number, year: number): MonthlyRecord => {
    const existing = student.monthlyRecords.find(r => r.month === month && r.year === year);
    if (existing) return existing;
    return createMonthlyRecord(month, year, student.sessionsPerMonth);
  };

  const ensureMonthlyRecord = (studentId: string, month: number, year: number) => {
    setStudents(prev =>
      prev.map(s => {
        if (s.id !== studentId) return s;
        const hasRecord = s.monthlyRecords.some(r => r.month === month && r.year === year);
        if (hasRecord) return s;
        return {
          ...s,
          monthlyRecords: [...s.monthlyRecords, createMonthlyRecord(month, year, s.sessionsPerMonth)],
        };
      })
    );
  };

  const updateSessionsPerMonth = (studentId: string, month: number, year: number, newCount: number) => {
    setStudents(prev =>
      prev.map(s => {
        if (s.id !== studentId) return s;
        const records = s.monthlyRecords.map(r => {
          if (r.month !== month || r.year !== year) return r;
          const currentSessions = r.sessions;
          let newSessions: Session[];
          if (newCount > currentSessions.length) {
            newSessions = [...currentSessions, ...createEmptySessions(newCount - currentSessions.length)];
          } else {
            newSessions = currentSessions.slice(0, newCount);
          }
          return { ...r, sessions: newSessions, sessionsPerMonth: newCount };
        });
        return { ...s, monthlyRecords: records, sessionsPerMonth: newCount };
      })
    );
  };

  const toggleSessionComplete = (studentId: string, month: number, year: number, sessionId: string) => {
    setStudents(prev =>
      prev.map(s => {
        if (s.id !== studentId) return s;
        const records = s.monthlyRecords.map(r => {
          if (r.month !== month || r.year !== year) return r;
          const sessions = r.sessions.map(sess =>
            sess.id === sessionId ? { ...sess, completed: !sess.completed } : sess
          );
          return { ...r, sessions };
        });
        return { ...s, monthlyRecords: records };
      })
    );
  };

  const updateSessionDate = (studentId: string, month: number, year: number, sessionId: string, date: string | null) => {
    setStudents(prev =>
      prev.map(s => {
        if (s.id !== studentId) return s;
        const records = s.monthlyRecords.map(r => {
          if (r.month !== month || r.year !== year) return r;
          const sessions = r.sessions.map(sess =>
            sess.id === sessionId ? { ...sess, date } : sess
          );
          return { ...r, sessions };
        });
        return { ...s, monthlyRecords: records };
      })
    );
  };

  const togglePaymentStatus = (studentId: string, month: number, year: number) => {
    setStudents(prev =>
      prev.map(s => {
        if (s.id !== studentId) return s;
        const records = s.monthlyRecords.map(r => {
          if (r.month !== month || r.year !== year) return r;
          return { ...r, isPaid: !r.isPaid };
        });
        return { ...s, monthlyRecords: records };
      })
    );
  };

  return {
    students,
    isLoaded,
    addStudent,
    removeStudent,
    updateStudentName,
    getOrCreateMonthlyRecord,
    ensureMonthlyRecord,
    updateSessionsPerMonth,
    toggleSessionComplete,
    updateSessionDate,
    togglePaymentStatus,
  };
};
