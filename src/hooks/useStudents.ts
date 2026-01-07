import { useState, useEffect } from 'react';
import { Student, StudentPayments, AppSettings, Session } from '@/types/student';
import { generateDefaultSemester, generateSessionsForSchedule, getMonthsInSemester } from '@/lib/dateUtils';

const STUDENTS_KEY = 'teacher-students-v2';
const PAYMENTS_KEY = 'teacher-payments-v2';
const SETTINGS_KEY = 'teacher-settings-v2';

const generateId = () => Math.random().toString(36).substr(2, 9);

export const useStudents = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [payments, setPayments] = useState<StudentPayments[]>([]);
  const [settings, setSettings] = useState<AppSettings>(() => {
    const { start, end } = generateDefaultSemester(4);
    return {
      defaultSemesterMonths: 4,
      defaultSemesterStart: start,
      defaultSemesterEnd: end,
    };
  });
  const [isLoaded, setIsLoaded] = useState(false);

  // Load data from localStorage
  useEffect(() => {
    const storedStudents = localStorage.getItem(STUDENTS_KEY);
    const storedPayments = localStorage.getItem(PAYMENTS_KEY);
    const storedSettings = localStorage.getItem(SETTINGS_KEY);

    if (storedStudents) setStudents(JSON.parse(storedStudents));
    if (storedPayments) setPayments(JSON.parse(storedPayments));
    if (storedSettings) setSettings(JSON.parse(storedSettings));
    
    setIsLoaded(true);
  }, []);

  // Save data to localStorage
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(STUDENTS_KEY, JSON.stringify(students));
    }
  }, [students, isLoaded]);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(PAYMENTS_KEY, JSON.stringify(payments));
    }
  }, [payments, isLoaded]);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    }
  }, [settings, isLoaded]);

  const updateSettings = (newSettings: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  const addStudent = (
    name: string,
    scheduleDays: number[],
    sessionTime: string = '16:00',
    customSemesterStart?: string,
    customSemesterEnd?: string
  ) => {
    const semesterStart = customSemesterStart || settings.defaultSemesterStart;
    const semesterEnd = customSemesterEnd || settings.defaultSemesterEnd;

    const sessionDates = generateSessionsForSchedule(scheduleDays, semesterStart, semesterEnd);
    const sessions: Session[] = sessionDates.map(date => ({
      id: generateId(),
      date,
      completed: false,
    }));

    const newStudent: Student = {
      id: generateId(),
      name,
      sessionTime,
      scheduleDays: scheduleDays.map(d => ({ dayOfWeek: d })),
      semesterStart,
      semesterEnd,
      sessions,
      createdAt: new Date().toISOString(),
    };

    setStudents(prev => [...prev, newStudent]);

    // Initialize payments for all months in semester
    const months = getMonthsInSemester(semesterStart, semesterEnd);
    const studentPayments: StudentPayments = {
      studentId: newStudent.id,
      payments: months.map(({ month, year }) => ({
        month,
        year,
        isPaid: false,
      })),
    };
    setPayments(prev => [...prev, studentPayments]);
  };

  const removeStudent = (studentId: string) => {
    setStudents(prev => prev.filter(s => s.id !== studentId));
    setPayments(prev => prev.filter(p => p.studentId !== studentId));
  };

  const updateStudentName = (studentId: string, name: string) => {
    setStudents(prev =>
      prev.map(s => (s.id === studentId ? { ...s, name } : s))
    );
  };

  const updateStudentTime = (studentId: string, sessionTime: string) => {
    setStudents(prev =>
      prev.map(s => (s.id === studentId ? { ...s, sessionTime } : s))
    );
  };

  const updateStudentSchedule = (
    studentId: string,
    scheduleDays: number[],
    semesterStart?: string,
    semesterEnd?: string
  ) => {
    setStudents(prev =>
      prev.map(s => {
        if (s.id !== studentId) return s;

        const newStart = semesterStart || s.semesterStart;
        const newEnd = semesterEnd || s.semesterEnd;

        // Regenerate sessions based on new schedule
        const sessionDates = generateSessionsForSchedule(scheduleDays, newStart, newEnd);
        
        // Preserve completion status for existing dates
        const existingCompletions = new Map(
          s.sessions.map(sess => [sess.date, sess.completed])
        );

        const newSessions: Session[] = sessionDates.map(date => ({
          id: generateId(),
          date,
          completed: existingCompletions.get(date) || false,
        }));

        return {
          ...s,
          scheduleDays: scheduleDays.map(d => ({ dayOfWeek: d })),
          semesterStart: newStart,
          semesterEnd: newEnd,
          sessions: newSessions,
        };
      })
    );

    // Update payments if semester changed
    if (semesterStart || semesterEnd) {
      const student = students.find(s => s.id === studentId);
      if (student) {
        const newStart = semesterStart || student.semesterStart;
        const newEnd = semesterEnd || student.semesterEnd;
        const months = getMonthsInSemester(newStart, newEnd);

        setPayments(prev =>
          prev.map(p => {
            if (p.studentId !== studentId) return p;
            
            // Preserve existing payment status
            const existingPayments = new Map(
              p.payments.map(pay => [`${pay.year}-${pay.month}`, pay.isPaid])
            );

            return {
              ...p,
              payments: months.map(({ month, year }) => ({
                month,
                year,
                isPaid: existingPayments.get(`${year}-${month}`) || false,
              })),
            };
          })
        );
      }
    }
  };

  const addExtraSession = (studentId: string, date: string) => {
    setStudents(prev =>
      prev.map(s => {
        if (s.id !== studentId) return s;
        // Check if session already exists
        if (s.sessions.some(sess => sess.date === date)) return s;
        
        const newSession: Session = {
          id: generateId(),
          date,
          completed: false,
        };
        
        // Insert in sorted order
        const newSessions = [...s.sessions, newSession].sort((a, b) => 
          a.date.localeCompare(b.date)
        );
        
        return { ...s, sessions: newSessions };
      })
    );
  };

  const removeSession = (studentId: string, sessionId: string) => {
    setStudents(prev =>
      prev.map(s => {
        if (s.id !== studentId) return s;
        return { ...s, sessions: s.sessions.filter(sess => sess.id !== sessionId) };
      })
    );
  };

  const toggleSessionComplete = (studentId: string, sessionId: string) => {
    setStudents(prev =>
      prev.map(s => {
        if (s.id !== studentId) return s;
        return {
          ...s,
          sessions: s.sessions.map(sess =>
            sess.id === sessionId ? { ...sess, completed: !sess.completed } : sess
          ),
        };
      })
    );
  };

  const togglePaymentStatus = (studentId: string, month: number, year: number) => {
    setPayments(prev =>
      prev.map(p => {
        if (p.studentId !== studentId) return p;
        return {
          ...p,
          payments: p.payments.map(pay => {
            if (pay.month !== month || pay.year !== year) return pay;
            return {
              ...pay,
              isPaid: !pay.isPaid,
              paidAt: !pay.isPaid ? new Date().toISOString() : undefined,
            };
          }),
        };
      })
    );
  };

  const getStudentPayments = (studentId: string): StudentPayments | undefined => {
    return payments.find(p => p.studentId === studentId);
  };

  const isStudentPaidForMonth = (studentId: string, month: number, year: number): boolean => {
    const studentPayments = getStudentPayments(studentId);
    if (!studentPayments) return false;
    const payment = studentPayments.payments.find(p => p.month === month && p.year === year);
    return payment?.isPaid || false;
  };

  return {
    students,
    payments,
    settings,
    isLoaded,
    updateSettings,
    addStudent,
    removeStudent,
    updateStudentName,
    updateStudentTime,
    updateStudentSchedule,
    addExtraSession,
    removeSession,
    toggleSessionComplete,
    togglePaymentStatus,
    getStudentPayments,
    isStudentPaidForMonth,
  };
};
