import { useState, useEffect } from "react";
import {
  Student,
  StudentPayments,
  AppSettings,
  Session,
  SessionStatus,
  HomeworkStatus,
  CancellationPolicy,
  PaymentMethod,
  PaymentRecord,
  PaymentStatus,
} from "@/types/student";
import { generateDefaultSemester, generateSessionsForSchedule, getMonthsInSemester } from "@/lib/dateUtils";

const STUDENTS_KEY = "teacher-students-v2";
const PAYMENTS_KEY = "teacher-payments-v2";
const SETTINGS_KEY = "teacher-settings-v2";

const generateId = () => Math.random().toString(36).substr(2, 9);

const toYmdLocal = (d: Date) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

export const useStudents = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [payments, setPayments] = useState<StudentPayments[]>([]);
  const [settings, setSettings] = useState<AppSettings>(() => {
    const { start, end } = generateDefaultSemester(4);
    return {
      defaultSemesterMonths: 4,
      defaultSemesterStart: start,
      defaultSemesterEnd: end,
      defaultSessionDuration: 60,
      defaultPriceOnsite: 150,
      defaultPriceOnline: 120,
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
    if (storedSettings) {
      const parsed = JSON.parse(storedSettings);
      const onsite = Number(parsed.defaultPriceOnsite);
      const online = Number(parsed.defaultPriceOnline);

      setSettings({
        ...parsed,
        defaultPriceOnsite: Number.isFinite(onsite) && onsite > 0 ? onsite : 150,
        defaultPriceOnline: Number.isFinite(online) && online > 0 ? online : 120,
      });
    }

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
    setSettings((prev) => {
      const next: AppSettings = { ...prev };
      (Object.keys(newSettings) as (keyof AppSettings)[]).forEach((key) => {
        const value = newSettings[key];
        if (value !== undefined) {
          (next as any)[key] = value;
        }
      });

      const onsite = Number((next as any).defaultPriceOnsite);
      const online = Number((next as any).defaultPriceOnline);
      next.defaultPriceOnsite = Number.isFinite(onsite) && onsite > 0 ? onsite : 150;
      next.defaultPriceOnline = Number.isFinite(online) && online > 0 ? online : 120;

      return next;
    });
  };

  const addStudent = (
    name: string,
    scheduleDays: number[],
    sessionTime: string = "16:00",
    sessionType: "online" | "onsite" = "onsite",
    phone?: string,
    parentPhone?: string,
    customSemesterStart?: string,
    customSemesterEnd?: string,
    sessionDuration?: number,
  ) => {
    const semesterStart = customSemesterStart || settings.defaultSemesterStart;
    const semesterEnd = customSemesterEnd || settings.defaultSemesterEnd;
    const duration = sessionDuration || settings.defaultSessionDuration || 60;

    const sessionDates = generateSessionsForSchedule(scheduleDays, semesterStart, semesterEnd);
    const sessions: Session[] = sessionDates.map((date) => ({
      id: generateId(),
      date,
      duration,
      completed: false,
      status: "scheduled" as SessionStatus,
      history: [{ status: "scheduled" as SessionStatus, timestamp: new Date().toISOString() }],
    }));

    const newStudent: Student = {
      id: generateId(),
      name,
      phone,
      parentPhone,
      sessionTime,
      sessionDuration: duration,
      sessionType,
      useCustomSettings: false,
      scheduleDays: scheduleDays.map((d) => ({ dayOfWeek: d })),
      semesterStart,
      semesterEnd,
      sessions,
      createdAt: new Date().toISOString(),
      cancellationPolicy: {
        monthlyLimit: 3,
        alertTutor: true,
        autoNotifyParent: true,
      },
    };

    setStudents((prev) => [...prev, newStudent]);

    const months = getMonthsInSemester(semesterStart, semesterEnd);
    const studentPayments: StudentPayments = {
      studentId: newStudent.id,
      payments: months.map(({ month, year }) => ({
        month,
        year,
        isPaid: false,
        amountDue: 0,
        amountPaid: 0,
        paymentStatus: "unpaid" as PaymentStatus,
        paymentRecords: [],
      })),
    };
    setPayments((prev) => [...prev, studentPayments]);
  };

  const updateStudentPhone = (studentId: string, phone: string) => {
    setStudents((prev) => prev.map((s) => (s.id === studentId ? { ...s, phone } : s)));
  };

  const updateStudentParentPhone = (studentId: string, parentPhone: string) => {
    setStudents((prev) => prev.map((s) => (s.id === studentId ? { ...s, parentPhone } : s)));
  };

  const updateStudentSessionType = (studentId: string, sessionType: "online" | "onsite") => {
    setStudents((prev) => prev.map((s) => (s.id === studentId ? { ...s, sessionType } : s)));
  };

  const updateStudentDuration = (studentId: string, sessionDuration: number) => {
    setStudents((prev) => prev.map((s) => (s.id === studentId ? { ...s, sessionDuration } : s)));
  };

  const updateStudentCustomSettings = (
    studentId: string,
    customSettings: {
      useCustomSettings?: boolean;
      sessionDuration?: number;
      customPriceOnsite?: number;
      customPriceOnline?: number;
    },
  ) => {
    setStudents((prev) =>
      prev.map((s) => {
        if (s.id !== studentId) return s;
        const next = { ...s };
        if (customSettings.useCustomSettings !== undefined) {
          next.useCustomSettings = customSettings.useCustomSettings;
        }
        if (customSettings.sessionDuration !== undefined) {
          next.sessionDuration = customSettings.sessionDuration;
        }
        if (customSettings.customPriceOnsite !== undefined) {
          next.customPriceOnsite = customSettings.customPriceOnsite;
        }
        if (customSettings.customPriceOnline !== undefined) {
          next.customPriceOnline = customSettings.customPriceOnline;
        }
        return next;
      }),
    );
  };

  const updateStudentCancellationPolicy = (studentId: string, policy: CancellationPolicy) => {
    setStudents((prev) =>
      prev.map((s) => {
        if (s.id !== studentId) return s;
        return { ...s, cancellationPolicy: policy };
      }),
    );
  };

  const removeStudent = (studentId: string) => {
    setStudents((prev) => prev.filter((s) => s.id !== studentId));
    setPayments((prev) => prev.filter((p) => p.studentId !== studentId));
  };

  const updateStudentName = (studentId: string, name: string) => {
    setStudents((prev) => prev.map((s) => (s.id === studentId ? { ...s, name } : s)));
  };

  const updateStudentTime = (studentId: string, sessionTime: string) => {
    setStudents((prev) => prev.map((s) => (s.id === studentId ? { ...s, sessionTime } : s)));
  };

  const updateStudentSchedule = (
    studentId: string,
    scheduleDays: number[],
    semesterStart?: string,
    semesterEnd?: string,
  ) => {
    setStudents((prev) =>
      prev.map((s) => {
        if (s.id !== studentId) return s;

        const newStart = semesterStart || s.semesterStart;
        const newEnd = semesterEnd || s.semesterEnd;
        const sessionDates = generateSessionsForSchedule(scheduleDays, newStart, newEnd);

        const newSessions: Session[] = sessionDates.map((date) => {
          const existing = s.sessions.find((sess) => sess.date === date);
          if (existing) {
            return existing;
          }
          return {
            id: generateId(),
            date,
            completed: false,
            status: "scheduled" as SessionStatus,
            history: [{ status: "scheduled" as SessionStatus, timestamp: new Date().toISOString() }],
          };
        });

        return {
          ...s,
          scheduleDays: scheduleDays.map((d) => ({ dayOfWeek: d })),
          semesterStart: newStart,
          semesterEnd: newEnd,
          sessions: newSessions,
        };
      }),
    );

    if (semesterStart || semesterEnd) {
      const student = students.find((s) => s.id === studentId);
      if (student) {
        const newStart = semesterStart || student.semesterStart;
        const newEnd = semesterEnd || student.semesterEnd;
        const months = getMonthsInSemester(newStart, newEnd);

        setPayments((prev) =>
          prev.map((p) => {
            if (p.studentId !== studentId) return p;
            const existingPayments = new Map(p.payments.map((pay) => [`${pay.year}-${pay.month}`, pay]));

            return {
              ...p,
              payments: months.map(({ month, year }) => {
                const existing = existingPayments.get(`${year}-${month}`);
                return (
                  existing || {
                    month,
                    year,
                    isPaid: false,
                    amountDue: 0,
                    amountPaid: 0,
                    paymentStatus: "unpaid" as PaymentStatus,
                    paymentRecords: [],
                  }
                );
              }),
            };
          }),
        );
      }
    }
  };

  const addExtraSession = (studentId: string, date: string, customTime?: string) => {
    setStudents((prev) =>
      prev.map((s) => {
        if (s.id !== studentId) return s;

        const now = new Date().toISOString();
        const today = toYmdLocal(new Date());
        const isPastDate = date < today;

        const newSession: Session = {
          id: generateId(),
          date,
          time: customTime,
          duration: s.sessionDuration,
          completed: isPastDate,
          status: isPastDate ? ("completed" as SessionStatus) : ("scheduled" as SessionStatus),
          completedAt: isPastDate ? now : undefined,
          history: [
            {
              status: isPastDate ? ("completed" as SessionStatus) : ("scheduled" as SessionStatus),
              timestamp: now,
              note: isPastDate ? "Added as past session" : undefined,
            },
          ],
        };

        const newSessions = [...s.sessions, newSession].sort((a, b) => a.date.localeCompare(b.date));
        return { ...s, sessions: newSessions };
      }),
    );
  };

  const removeSession = (studentId: string, sessionId: string) => {
    setStudents((prev) =>
      prev.map((s) => {
        if (s.id !== studentId) return s;
        return {
          ...s,
          sessions: s.sessions.map((sess) => {
            if (sess.id !== sessionId) return sess;
            const now = new Date().toISOString();
            return {
              ...sess,
              status: "cancelled" as SessionStatus,
              cancelledAt: now,
              history: [...(sess.history || []), { status: "cancelled" as SessionStatus, timestamp: now }],
            };
          }),
        };
      }),
    );
  };

  const deleteSession = (studentId: string, sessionId: string) => {
    setStudents((prev) =>
      prev.map((s) => {
        if (s.id !== studentId) return s;
        return {
          ...s,
          sessions: s.sessions.filter((sess) => sess.id !== sessionId),
        };
      }),
    );
  };

  const restoreSession = (studentId: string, sessionId: string) => {
    setStudents((prev) =>
      prev.map((s) => {
        if (s.id !== studentId) return s;
        return {
          ...s,
          sessions: s.sessions.map((sess) => {
            if (sess.id !== sessionId) return sess;
            const now = new Date().toISOString();
            const previousStatus = sess.status;
            return {
              ...sess,
              status: "scheduled" as SessionStatus,
              completed: false,
              cancelledAt: undefined,
              vacationAt: undefined,
              history: [
                ...(sess.history || []),
                { status: "scheduled" as SessionStatus, timestamp: now, note: `Restored from ${previousStatus}` },
              ],
            };
          }),
        };
      }),
    );
  };

  const markSessionAsVacation = (studentId: string, sessionId: string) => {
    setStudents((prev) =>
      prev.map((s) => {
        if (s.id !== studentId) return s;
        return {
          ...s,
          sessions: s.sessions.map((sess) => {
            if (sess.id !== sessionId) return sess;
            if (sess.status !== "scheduled") return sess;
            const now = new Date().toISOString();
            return {
              ...sess,
              status: "vacation" as SessionStatus,
              completed: false,
              vacationAt: now,
              history: [...(sess.history || []), { status: "vacation" as SessionStatus, timestamp: now }],
            };
          }),
        };
      }),
    );
  };

  const bulkMarkAsVacation = (
    studentIds: string[],
    sessionIds: string[],
  ): { success: boolean; updatedCount: number } => {
    let updatedCount = 0;
    const now = new Date().toISOString();

    setStudents((prev) =>
      prev.map((student) => {
        if (!studentIds.includes(student.id)) return student;

        const updatedSessions = student.sessions.map((session) => {
          if (!sessionIds.includes(session.id)) return session;
          if (session.status !== "scheduled") return session;
          updatedCount++;
          return {
            ...session,
            status: "vacation" as SessionStatus,
            completed: false,
            vacationAt: now,
            history: [
              ...(session.history || []),
              { status: "vacation" as SessionStatus, timestamp: now, note: "Bulk vacation" },
            ],
          };
        });

        return {
          ...student,
          sessions: updatedSessions,
        };
      }),
    );

    return { success: true, updatedCount };
  };

  const rescheduleSession = (studentId: string, sessionId: string, newDate: string) => {
    setStudents((prev) =>
      prev.map((s) => {
        if (s.id !== studentId) return s;

        const existingSession = s.sessions.find((sess) => sess.date === newDate);
        if (existingSession) return s;

        const now = new Date().toISOString();
        const updatedSessions = s.sessions.map((sess) => {
          if (sess.id !== sessionId) return sess;
          return {
            ...sess,
            date: newDate,
            history: [
              ...(sess.history || []),
              {
                status: "scheduled" as SessionStatus,
                timestamp: now,
                note: `Rescheduled from ${sess.date}`,
              },
            ],
          };
        });

        return {
          ...s,
          sessions: updatedSessions.sort((a, b) => a.date.localeCompare(b.date)),
        };
      }),
    );
  };

  const updateSessionDateTime = (studentId: string, sessionId: string, newDate: string, newTime: string) => {
    setStudents((prev) =>
      prev.map((s) => {
        if (s.id !== studentId) return s;

        const now = new Date().toISOString();
        const updatedSessions = s.sessions.map((sess) => {
          if (sess.id !== sessionId) return sess;
          const oldDate = sess.date;
          const oldTime = sess.time || s.sessionTime || "16:00";
          return {
            ...sess,
            date: newDate,
            time: newTime,
            history: [
              ...(sess.history || []),
              {
                status: sess.status as SessionStatus,
                timestamp: now,
                note: `Moved from ${oldDate} ${oldTime} to ${newDate} ${newTime}`,
              },
            ],
          };
        });

        return {
          ...s,
          sessions: updatedSessions.sort((a, b) => a.date.localeCompare(b.date)),
        };
      }),
    );
  };

  const toggleSessionComplete = (studentId: string, sessionId: string) => {
    setStudents((prev) =>
      prev.map((s) => {
        if (s.id !== studentId) return s;
        return {
          ...s,
          sessions: s.sessions.map((sess) => {
            if (sess.id !== sessionId) return sess;
            const now = new Date().toISOString();
            const newCompleted = !sess.completed;
            const newStatus: SessionStatus = newCompleted ? "completed" : "scheduled";
            return {
              ...sess,
              completed: newCompleted,
              status: newStatus,
              completedAt: newCompleted ? now : undefined,
              history: [...(sess.history || []), { status: newStatus, timestamp: now }],
            };
          }),
        };
      }),
    );
  };

  const bulkUpdateSessionTime = (
    studentIds: string[],
    sessionIds: string[],
    newTime: string,
  ): { success: boolean; updatedCount: number; conflicts: any[] } => {
    let updatedCount = 0;

    setStudents((prev) =>
      prev.map((student) => {
        if (!studentIds.includes(student.id)) return student;

        const updatedSessions = student.sessions.map((session) => {
          if (!sessionIds.includes(session.id)) return session;
          updatedCount++;
          return {
            ...session,
            time: newTime,
          };
        });

        return {
          ...student,
          sessions: updatedSessions,
        };
      }),
    );

    return { success: true, updatedCount, conflicts: [] };
  };

  const updateSessionDetails = (
    studentId: string,
    sessionId: string,
    details: {
      topic?: string;
      notes?: string;
      homework?: string;
      homeworkStatus?: HomeworkStatus;
    },
  ) => {
    setStudents((prev) =>
      prev.map((s) => {
        if (s.id !== studentId) return s;
        return {
          ...s,
          sessions: s.sessions.map((sess) => {
            if (sess.id !== sessionId) return sess;
            return {
              ...sess,
              topic: details.topic !== undefined ? details.topic : sess.topic,
              notes: details.notes !== undefined ? details.notes : sess.notes,
              homework: details.homework !== undefined ? details.homework : sess.homework,
              homeworkStatus: details.homeworkStatus !== undefined ? details.homeworkStatus : sess.homeworkStatus,
            };
          }),
        };
      }),
    );
  };

  const togglePaymentStatus = (studentId: string, month: number, year: number) => {
    setPayments((prev) =>
      prev.map((p) => {
        if (p.studentId !== studentId) return p;
        return {
          ...p,
          payments: p.payments.map((pay) => {
            if (pay.month !== month || pay.year !== year) return pay;
            return {
              ...pay,
              isPaid: !pay.isPaid,
              paidAt: !pay.isPaid ? new Date().toISOString() : undefined,
            };
          }),
        };
      }),
    );
  };

  // ✅ NEW: Add partial payment
  const addPartialPayment = (
    studentId: string,
    month: number,
    year: number,
    amount: number,
    method: PaymentMethod,
    notes?: string,
  ) => {
    const now = new Date().toISOString();

    setPayments((prev) => {
      const updated = [...prev];
      const studentPaymentIndex = updated.findIndex((p) => p.studentId === studentId);

      if (studentPaymentIndex === -1) {
        // Create new payment record
        updated.push({
          studentId,
          payments: [
            {
              month,
              year,
              isPaid: false,
              amountDue: 0,
              amountPaid: amount,
              paymentStatus: "partial" as PaymentStatus,
              paymentRecords: [
                {
                  id: generateId(),
                  amount,
                  method,
                  paidAt: now,
                  notes,
                },
              ],
            },
          ],
        });
      } else {
        const studentPayments = updated[studentPaymentIndex];
        const paymentIndex = studentPayments.payments.findIndex((p) => p.month === month && p.year === year);

        if (paymentIndex === -1) {
          // Add new month payment
          studentPayments.payments.push({
            month,
            year,
            isPaid: false,
            amountDue: 0,
            amountPaid: amount,
            paymentStatus: "partial" as PaymentStatus,
            paymentRecords: [
              {
                id: generateId(),
                amount,
                method,
                paidAt: now,
                notes,
              },
            ],
          });
        } else {
          // Add to existing month
          const payment = studentPayments.payments[paymentIndex];
          const newAmountPaid = (payment.amountPaid || 0) + amount;
          const amountDue = payment.amountDue || 0;

          const newStatus: PaymentStatus =
            newAmountPaid >= amountDue && amountDue > 0 ? "paid" : newAmountPaid > 0 ? "partial" : "unpaid";

          studentPayments.payments[paymentIndex] = {
            ...payment,
            amountPaid: newAmountPaid,
            paymentStatus: newStatus,
            isPaid: newStatus === "paid",
            paidAt: newStatus === "paid" ? now : payment.paidAt,
            paymentRecords: [
              ...(payment.paymentRecords || []),
              {
                id: generateId(),
                amount,
                method,
                paidAt: now,
                notes,
              },
            ],
          };
        }
      }

      return updated;
    });
  };

  // ✅ NEW: Update monthly amount due (called when calculating from sessions)
  const updateMonthlyAmountDue = (studentId: string, month: number, year: number, amountDue: number) => {
    setPayments((prev) =>
      prev.map((p) => {
        if (p.studentId !== studentId) return p;
        return {
          ...p,
          payments: p.payments.map((pay) => {
            if (pay.month !== month || pay.year !== year) return pay;

            const currentAmountPaid = pay.amountPaid || 0;
            const newStatus: PaymentStatus =
              currentAmountPaid >= amountDue && amountDue > 0 ? "paid" : currentAmountPaid > 0 ? "partial" : "unpaid";

            return {
              ...pay,
              amountDue,
              paymentStatus: newStatus,
              isPaid: newStatus === "paid",
            };
          }),
        };
      }),
    );
  };

  const recordPayment = (
    studentId: string,
    paymentData: {
      month: number;
      year: number;
      amount: number;
      method: PaymentMethod;
      paidAt: string;
      notes?: string;
    },
  ) => {
    setPayments((prev) => {
      const updated = [...prev];
      const studentPaymentIndex = updated.findIndex((p) => p.studentId === studentId);

      if (studentPaymentIndex === -1) {
        updated.push({
          studentId,
          payments: [
            {
              month: paymentData.month,
              year: paymentData.year,
              isPaid: true,
              paidAt: paymentData.paidAt,
              amount: paymentData.amount,
              method: paymentData.method,
              notes: paymentData.notes,
              amountDue: paymentData.amount,
              amountPaid: paymentData.amount,
              paymentStatus: "paid" as PaymentStatus,
              paymentRecords: [
                {
                  id: generateId(),
                  amount: paymentData.amount,
                  method: paymentData.method,
                  paidAt: paymentData.paidAt,
                  notes: paymentData.notes,
                },
              ],
            },
          ],
        });
      } else {
        const studentPayments = updated[studentPaymentIndex];
        const paymentIndex = studentPayments.payments.findIndex(
          (p) => p.month === paymentData.month && p.year === paymentData.year,
        );

        if (paymentIndex === -1) {
          studentPayments.payments.push({
            month: paymentData.month,
            year: paymentData.year,
            isPaid: true,
            paidAt: paymentData.paidAt,
            amount: paymentData.amount,
            method: paymentData.method,
            notes: paymentData.notes,
            amountDue: paymentData.amount,
            amountPaid: paymentData.amount,
            paymentStatus: "paid" as PaymentStatus,
            paymentRecords: [
              {
                id: generateId(),
                amount: paymentData.amount,
                method: paymentData.method,
                paidAt: paymentData.paidAt,
                notes: paymentData.notes,
              },
            ],
          });
        } else {
          studentPayments.payments[paymentIndex] = {
            ...studentPayments.payments[paymentIndex],
            isPaid: true,
            paidAt: paymentData.paidAt,
            amount: paymentData.amount,
            method: paymentData.method,
            notes: paymentData.notes,
            amountPaid: paymentData.amount,
            paymentStatus: "paid" as PaymentStatus,
            paymentRecords: [
              {
                id: generateId(),
                amount: paymentData.amount,
                method: paymentData.method,
                paidAt: paymentData.paidAt,
                notes: paymentData.notes,
              },
            ],
          };
        }
      }

      return updated;
    });
  };

  const getStudentPayments = (studentId: string): StudentPayments | undefined => {
    return payments.find((p) => p.studentId === studentId);
  };

  const isStudentPaidForMonth = (studentId: string, month: number, year: number): boolean => {
    const studentPayments = getStudentPayments(studentId);
    if (!studentPayments) return false;
    const payment = studentPayments.payments.find((p) => p.month === month && p.year === year);
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
    updateStudentPhone,
    updateStudentParentPhone,
    updateStudentSessionType,
    updateStudentDuration,
    updateStudentCustomSettings,
    updateStudentCancellationPolicy,
    updateStudentSchedule,
    addExtraSession,
    removeSession,
    deleteSession,
    restoreSession,
    rescheduleSession,
    updateSessionDateTime,
    toggleSessionComplete,
    togglePaymentStatus,
    recordPayment,
    addPartialPayment, // ✅ NEW
    updateMonthlyAmountDue, // ✅ NEW
    getStudentPayments,
    isStudentPaidForMonth,
    bulkUpdateSessionTime,
    markSessionAsVacation,
    bulkMarkAsVacation,
    updateSessionDetails,
  };
};
