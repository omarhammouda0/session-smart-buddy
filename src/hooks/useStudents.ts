import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
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
  ScheduleDay,
  StudentMaterial,
  ScheduleMode,
} from "@/types/student";
import { generateDefaultSemester, generateSessionsForSchedule, getMonthsInSemester, getDistributedDays } from "@/lib/dateUtils";

// ============================================================================
// TYPES FOR DATABASE ROWS
// ============================================================================

interface DbStudent {
  id: string;
  user_id: string;
  name: string;
  phone: string | null;
  parent_phone: string | null;
  session_type: string;
  session_time: string;
  session_duration: number | null;
  custom_price_onsite: number | null;
  custom_price_online: number | null;
  use_custom_settings: boolean | null;
  schedule_days: { dayOfWeek: number }[] | null; // JSON array of schedule days
  schedule_mode: string | null; // 'days' or 'perWeek'
  sessions_per_week: number | null; // Number of sessions per week (1-7)
  semester_start: string;
  semester_end: string;
  cancellation_monthly_limit: number | null;
  cancellation_alert_tutor: boolean | null;
  cancellation_auto_notify_parent: boolean | null;
  created_at: string;
  updated_at: string;
}

interface DbSession {
  id: string;
  student_id: string;
  user_id: string;
  date: string;
  time: string | null;
  duration: number | null;
  status: string;
  completed_at: string | null;
  cancelled_at: string | null;
  vacation_at: string | null;
  topic: string | null;
  notes: string | null;
  homework: string | null;
  homework_status: string | null;
  created_at: string;
  updated_at: string;
}

interface DbMonthlyPayment {
  id: string;
  student_id: string;
  user_id: string;
  month: number;
  year: number;
  is_paid: boolean | null;
  amount_due: number | null;
  amount_paid: number | null;
  payment_status: string | null;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface DbPaymentRecord {
  id: string;
  monthly_payment_id: string;
  student_id: string;
  user_id: string;
  amount: number;
  method: string;
  paid_at: string;
  notes: string | null;
  created_at: string;
}

interface DbAppSettings {
  id: string;
  user_id: string;
  default_semester_months: number | null;
  default_semester_start: string | null;
  default_semester_end: string | null;
  default_session_duration: number | null;
  default_price_onsite: number | null;
  default_price_online: number | null;
  working_hours_start: string | null;
  working_hours_end: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const toYmdLocal = (d: Date) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

// Convert DB student row to app Student type
const dbStudentToStudent = (dbStudent: DbStudent, sessions: Session[]): Student => {
  // Parse schedule_days from JSON
  let scheduleDays: ScheduleDay[] = [];
  if (dbStudent.schedule_days) {
    if (Array.isArray(dbStudent.schedule_days)) {
      scheduleDays = dbStudent.schedule_days.map((d: { dayOfWeek?: number; day_of_week?: number } | number) => ({
        dayOfWeek: typeof d === "number" ? d : (d.dayOfWeek ?? d.day_of_week ?? 0),
      }));
    }
  }

  return {
    id: dbStudent.id,
    name: dbStudent.name,
    phone: dbStudent.phone || undefined,
    parentPhone: dbStudent.parent_phone || undefined,
    sessionType: (dbStudent.session_type as "online" | "onsite") || "onsite",
    sessionTime: dbStudent.session_time || "16:00",
    sessionDuration: dbStudent.session_duration || 60,
    customPriceOnsite: dbStudent.custom_price_onsite || undefined,
    customPriceOnline: dbStudent.custom_price_online || undefined,
    useCustomSettings: dbStudent.use_custom_settings || false,
    scheduleDays,
    scheduleMode: (dbStudent.schedule_mode as ScheduleMode) || "days",
    sessionsPerWeek: dbStudent.sessions_per_week || undefined,
    semesterStart: dbStudent.semester_start,
    semesterEnd: dbStudent.semester_end,
    sessions,
    createdAt: dbStudent.created_at,
    cancellationPolicy: {
      monthlyLimit: dbStudent.cancellation_monthly_limit ?? 3,
      alertTutor: dbStudent.cancellation_alert_tutor ?? true,
      autoNotifyParent: dbStudent.cancellation_auto_notify_parent ?? true,
    },
  };
};

// Convert DB session row to app Session type
const dbSessionToSession = (dbSession: DbSession): Session => {
  return {
    id: dbSession.id,
    date: dbSession.date,
    time: dbSession.time || undefined,
    duration: dbSession.duration || 60,
    completed: dbSession.status === "completed",
    status: (dbSession.status as SessionStatus) || "scheduled",
    completedAt: dbSession.completed_at || undefined,
    cancelledAt: dbSession.cancelled_at || undefined,
    vacationAt: dbSession.vacation_at || undefined,
    topic: dbSession.topic || undefined,
    notes: dbSession.notes || undefined,
    homework: dbSession.homework || undefined,
    homeworkStatus: (dbSession.homework_status as HomeworkStatus) || undefined,
    history: [], // History is not stored in DB for now
  };
};

// Convert DB payment records to app format
const dbPaymentsToStudentPayments = (
  studentId: string,
  monthlyPayments: DbMonthlyPayment[],
  paymentRecords: DbPaymentRecord[],
): StudentPayments => {
  const payments = monthlyPayments.map((mp) => {
    const records = paymentRecords
      .filter((pr) => pr.monthly_payment_id === mp.id)
      .map((pr) => ({
        id: pr.id,
        amount: pr.amount,
        method: pr.method as PaymentMethod,
        paidAt: pr.paid_at,
        notes: pr.notes || undefined,
      }));

    return {
      month: mp.month,
      year: mp.year,
      isPaid: mp.is_paid || false,
      amountDue: mp.amount_due || 0,
      amountPaid: mp.amount_paid || 0,
      paymentStatus: (mp.payment_status as PaymentStatus) || "unpaid",
      paidAt: mp.paid_at || undefined,
      notes: mp.notes || undefined,
      paymentRecords: records,
    };
  });

  return { studentId, payments };
};

// Convert DB settings to app format
const dbSettingsToAppSettings = (dbSettings: DbAppSettings | null): AppSettings => {
  const { start, end } = generateDefaultSemester(4);

  if (!dbSettings) {
    return {
      defaultSemesterMonths: 4,
      defaultSemesterStart: start,
      defaultSemesterEnd: end,
      defaultSessionDuration: 60,
      defaultPriceOnsite: 150,
      defaultPriceOnline: 120,
      workingHoursStart: "14:00",
      workingHoursEnd: "22:00",
    };
  }

  return {
    defaultSemesterMonths: dbSettings.default_semester_months || 4,
    defaultSemesterStart: dbSettings.default_semester_start || start,
    defaultSemesterEnd: dbSettings.default_semester_end || end,
    defaultSessionDuration: dbSettings.default_session_duration || 60,
    defaultPriceOnsite: dbSettings.default_price_onsite || 150,
    defaultPriceOnline: dbSettings.default_price_online || 120,
    workingHoursStart: dbSettings.working_hours_start || "14:00",
    workingHoursEnd: dbSettings.working_hours_end || "22:00",
  };
};

// Calculate amount due for a student in a month
const calculateMonthlyAmountDue = (student: Student, month: number, year: number, settings?: AppSettings): number => {
  const defaultOnsite = 150;
  const defaultOnline = 120;

  let sessionPrice: number;
  if (student.useCustomSettings) {
    if (student.sessionType === "online") {
      sessionPrice =
        typeof student.customPriceOnline === "number" && student.customPriceOnline > 0
          ? student.customPriceOnline
          : (settings?.defaultPriceOnline ?? defaultOnline);
    } else {
      sessionPrice =
        typeof student.customPriceOnsite === "number" && student.customPriceOnsite > 0
          ? student.customPriceOnsite
          : (settings?.defaultPriceOnsite ?? defaultOnsite);
    }
  } else {
    if (student.sessionType === "online") {
      sessionPrice =
        typeof settings?.defaultPriceOnline === "number" && settings.defaultPriceOnline > 0
          ? settings.defaultPriceOnline
          : defaultOnline;
    } else {
      sessionPrice =
        typeof settings?.defaultPriceOnsite === "number" && settings.defaultPriceOnsite > 0
          ? settings.defaultPriceOnsite
          : defaultOnsite;
    }
  }

  const billableSessions = student.sessions.filter((s) => {
    const sessionDate = new Date(s.date);
    return (
      sessionDate.getMonth() === month &&
      sessionDate.getFullYear() === year &&
      (s.status === "completed" || s.status === "scheduled")
    );
  });

  return billableSessions.length * sessionPrice;
};

// ============================================================================
// MAIN HOOK
// ============================================================================

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
  const [userId, setUserId] = useState<string | null>(null);

  // Get current user ID
  const getUserId = useCallback(async (): Promise<string | null> => {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      console.error("Auth error:", error);
      return null;
    }
    return data.user?.id ?? null;
  }, []);

  // ============================================================================
  // LOAD DATA FROM SUPABASE
  // ============================================================================

  const loadData = useCallback(async () => {
    try {
      const currentUserId = await getUserId();
      if (!currentUserId) {
        console.log("No authenticated user, skipping data load");
        setStudents([]);
        setPayments([]);
        setIsLoaded(true);
        return;
      }
      setUserId(currentUserId);

      // Load students
      const { data: studentsData, error: studentsError } = await supabase
        .from("students")
        .select("*")
        .eq("user_id", currentUserId)
        .order("created_at", { ascending: true });

      if (studentsError) {
        console.error("Error loading students:", studentsError);
        return;
      }

      // Load all sessions for this user
      const { data: sessionsData, error: sessionsError } = await supabase
        .from("sessions")
        .select("*")
        .eq("user_id", currentUserId)
        .order("date", { ascending: true });

      if (sessionsError) {
        console.error("Error loading sessions:", sessionsError);
        return;
      }

      // Load all monthly payments
      const { data: monthlyPaymentsData, error: mpError } = await supabase
        .from("monthly_payments")
        .select("*")
        .eq("user_id", currentUserId);

      if (mpError) {
        console.error("Error loading monthly payments:", mpError);
      }

      // Load all payment records
      const { data: paymentRecordsData, error: prError } = await supabase
        .from("payment_records")
        .select("*")
        .eq("user_id", currentUserId);

      if (prError) {
        console.error("Error loading payment records:", prError);
      }

      // Load settings
      const { data: settingsData, error: settingsError } = await supabase
        .from("app_settings")
        .select("*")
        .eq("user_id", currentUserId)
        .maybeSingle();

      if (settingsError) {
        console.error("Error loading settings:", settingsError);
      }

      // Group sessions by student
      const sessionsByStudent = new Map<string, Session[]>();
      (sessionsData || []).forEach((dbSession: DbSession) => {
        const session = dbSessionToSession(dbSession);
        const existing = sessionsByStudent.get(dbSession.student_id) || [];
        existing.push(session);
        sessionsByStudent.set(dbSession.student_id, existing);
      });

      // Convert students with their sessions
      const convertedStudents = (studentsData || []).map((dbStudent: DbStudent) => {
        const studentSessions = sessionsByStudent.get(dbStudent.id) || [];
        return dbStudentToStudent(dbStudent, studentSessions);
      });

      // Convert payments
      const convertedPayments = convertedStudents.map((student) => {
        const studentMonthlyPayments = (monthlyPaymentsData || []).filter(
          (mp: DbMonthlyPayment) => mp.student_id === student.id,
        );
        const studentPaymentRecords = (paymentRecordsData || []).filter(
          (pr: DbPaymentRecord) => pr.student_id === student.id,
        );
        return dbPaymentsToStudentPayments(student.id, studentMonthlyPayments, studentPaymentRecords);
      });

      // Convert settings
      const convertedSettings = dbSettingsToAppSettings(settingsData as DbAppSettings | null);

      setStudents(convertedStudents);
      setPayments(convertedPayments);
      setSettings(convertedSettings);
      setIsLoaded(true);
    } catch (error) {
      console.error("Error loading data:", error);
      setIsLoaded(true);
    }
  }, [getUserId]);

  // Load data on mount
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Set up real-time subscriptions for multi-device sync
  useEffect(() => {
    if (!userId) return;

    const studentsChannel = supabase
      .channel("students-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "students", filter: `user_id=eq.${userId}` }, () =>
        loadData(),
      )
      .subscribe();

    const sessionsChannel = supabase
      .channel("sessions-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "sessions", filter: `user_id=eq.${userId}` }, () =>
        loadData(),
      )
      .subscribe();

    const paymentsChannel = supabase
      .channel("payments-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "monthly_payments", filter: `user_id=eq.${userId}` },
        () => loadData(),
      )
      .subscribe();

    const settingsChannel = supabase
      .channel("settings-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "app_settings", filter: `user_id=eq.${userId}` },
        () => loadData(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(studentsChannel);
      supabase.removeChannel(sessionsChannel);
      supabase.removeChannel(paymentsChannel);
      supabase.removeChannel(settingsChannel);
    };
  }, [userId, loadData]);

  // ============================================================================
  // SETTINGS OPERATIONS
  // ============================================================================

  const updateSettings = useCallback(
    async (newSettings: Partial<AppSettings>) => {
      const currentUserId = await getUserId();
      if (!currentUserId) return;

      const updatedSettings = { ...settings, ...newSettings };

      // Validate prices
      const onsite = Number(updatedSettings.defaultPriceOnsite);
      const online = Number(updatedSettings.defaultPriceOnline);
      updatedSettings.defaultPriceOnsite = Number.isFinite(onsite) && onsite > 0 ? onsite : 150;
      updatedSettings.defaultPriceOnline = Number.isFinite(online) && online > 0 ? online : 120;

      // Optimistic update
      setSettings(updatedSettings);

      // Upsert to database
      const { error } = await supabase.from("app_settings").upsert(
        {
          user_id: currentUserId,
          default_semester_months: updatedSettings.defaultSemesterMonths,
          default_semester_start: updatedSettings.defaultSemesterStart,
          default_semester_end: updatedSettings.defaultSemesterEnd,
          default_session_duration: updatedSettings.defaultSessionDuration,
          default_price_onsite: updatedSettings.defaultPriceOnsite,
          default_price_online: updatedSettings.defaultPriceOnline,
          working_hours_start: updatedSettings.workingHoursStart || "14:00",
          working_hours_end: updatedSettings.workingHoursEnd || "22:00",
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id",
        },
      );

      if (error) {
        console.error("Error updating settings:", error);
        // Reload to get correct state
        loadData();
      }
    },
    [getUserId, settings, loadData],
  );

  // ============================================================================
  // STUDENT OPERATIONS
  // ============================================================================

  const addStudent = useCallback(
    async (
      name: string,
      scheduleDays: number[],
      sessionTime: string = "16:00",
      sessionType: "online" | "onsite" = "onsite",
      phone?: string,
      parentPhone?: string,
      customSemesterStart?: string,
      customSemesterEnd?: string,
      sessionDuration?: number,
      _materials?: StudentMaterial[], // Materials will be stored when we implement student_materials table
      useCustomPrices?: boolean,
      customPriceOnsite?: number,
      customPriceOnline?: number,
      scheduleMode: ScheduleMode = "days",
      sessionsPerWeek?: number,
    ) => {
      const currentUserId = await getUserId();
      if (!currentUserId) return;

      const semesterStart = customSemesterStart || settings.defaultSemesterStart;
      const semesterEnd = customSemesterEnd || settings.defaultSemesterEnd;
      const duration = sessionDuration || settings.defaultSessionDuration || 60;

      // Determine actual schedule days based on mode
      const actualScheduleDays = scheduleMode === "perWeek" && sessionsPerWeek
        ? getDistributedDays(sessionsPerWeek)
        : scheduleDays;

      // Insert student
      const { data: studentData, error: studentError } = await supabase
        .from("students")
        .insert({
          user_id: currentUserId,
          name,
          phone: phone || null,
          parent_phone: parentPhone || null,
          session_type: sessionType,
          session_time: sessionTime,
          session_duration: duration,
          use_custom_settings: useCustomPrices || false,
          custom_price_onsite: useCustomPrices ? customPriceOnsite : null,
          custom_price_online: useCustomPrices ? customPriceOnline : null,
          schedule_days: actualScheduleDays.map((d) => ({ dayOfWeek: d })),
          schedule_mode: scheduleMode,
          sessions_per_week: scheduleMode === "perWeek" ? sessionsPerWeek : null,
          semester_start: semesterStart,
          semester_end: semesterEnd,
          cancellation_monthly_limit: 3,
          cancellation_alert_tutor: true,
          cancellation_auto_notify_parent: true,
        })
        .select()
        .single();

      if (studentError) {
        console.error("Error adding student:", studentError);
        return;
      }

      // Generate sessions
      const sessionDates = generateSessionsForSchedule(actualScheduleDays, semesterStart, semesterEnd);
      const sessionsToInsert = sessionDates.map((date) => ({
        student_id: studentData.id,
        user_id: currentUserId,
        date,
        duration,
        status: "scheduled",
      }));

      if (sessionsToInsert.length > 0) {
        const { error: sessionsError } = await supabase.from("sessions").insert(sessionsToInsert);

        if (sessionsError) {
          console.error("Error adding sessions:", sessionsError);
        }
      }

      // Create monthly payment records
      const months = getMonthsInSemester(semesterStart, semesterEnd);
      const paymentsToInsert = months.map(({ month, year }) => ({
        student_id: studentData.id,
        user_id: currentUserId,
        month,
        year,
        is_paid: false,
        amount_due: 0,
        amount_paid: 0,
        payment_status: "unpaid",
      }));

      if (paymentsToInsert.length > 0) {
        const { error: paymentsError } = await supabase.from("monthly_payments").insert(paymentsToInsert);

        if (paymentsError) {
          console.error("Error adding payments:", paymentsError);
        }
      }

      // Reload data
      await loadData();
    },
    [getUserId, settings, loadData],
  );

  const removeStudent = useCallback(
    async (studentId: string) => {
      const currentUserId = await getUserId();
      if (!currentUserId) return;

      // Optimistic update
      setStudents((prev) => prev.filter((s) => s.id !== studentId));
      setPayments((prev) => prev.filter((p) => p.studentId !== studentId));

      // Delete from database (cascades will handle sessions and payments)
      const { error } = await supabase.from("students").delete().eq("id", studentId).eq("user_id", currentUserId);

      if (error) {
        console.error("Error removing student:", error);
        loadData();
      }
    },
    [getUserId, loadData],
  );

  const updateStudentName = useCallback(
    async (studentId: string, name: string) => {
      const currentUserId = await getUserId();
      if (!currentUserId) return;

      // Optimistic update
      setStudents((prev) => prev.map((s) => (s.id === studentId ? { ...s, name } : s)));

      const { error } = await supabase
        .from("students")
        .update({ name, updated_at: new Date().toISOString() })
        .eq("id", studentId)
        .eq("user_id", currentUserId);

      if (error) {
        console.error("Error updating student name:", error);
        loadData();
      }
    },
    [getUserId, loadData],
  );

  const updateStudentTime = useCallback(
    async (studentId: string, sessionTime: string) => {
      const currentUserId = await getUserId();
      if (!currentUserId) return;

      setStudents((prev) => prev.map((s) => (s.id === studentId ? { ...s, sessionTime } : s)));

      const { error } = await supabase
        .from("students")
        .update({ session_time: sessionTime, updated_at: new Date().toISOString() })
        .eq("id", studentId)
        .eq("user_id", currentUserId);

      if (error) {
        console.error("Error updating session time:", error);
        loadData();
      }
    },
    [getUserId, loadData],
  );

  const updateStudentPhone = useCallback(
    async (studentId: string, phone: string) => {
      const currentUserId = await getUserId();
      if (!currentUserId) return;

      setStudents((prev) => prev.map((s) => (s.id === studentId ? { ...s, phone } : s)));

      const { error } = await supabase
        .from("students")
        .update({ phone: phone || null, updated_at: new Date().toISOString() })
        .eq("id", studentId)
        .eq("user_id", currentUserId);

      if (error) {
        console.error("Error updating phone:", error);
        loadData();
      }
    },
    [getUserId, loadData],
  );

  const updateStudentParentPhone = useCallback(
    async (studentId: string, parentPhone: string) => {
      const currentUserId = await getUserId();
      if (!currentUserId) return;

      setStudents((prev) => prev.map((s) => (s.id === studentId ? { ...s, parentPhone } : s)));

      const { error } = await supabase
        .from("students")
        .update({ parent_phone: parentPhone || null, updated_at: new Date().toISOString() })
        .eq("id", studentId)
        .eq("user_id", currentUserId);

      if (error) {
        console.error("Error updating parent phone:", error);
        loadData();
      }
    },
    [getUserId, loadData],
  );

  const updateStudentSessionType = useCallback(
    async (studentId: string, sessionType: "online" | "onsite") => {
      const currentUserId = await getUserId();
      if (!currentUserId) return;

      setStudents((prev) => prev.map((s) => (s.id === studentId ? { ...s, sessionType } : s)));

      const { error } = await supabase
        .from("students")
        .update({ session_type: sessionType, updated_at: new Date().toISOString() })
        .eq("id", studentId)
        .eq("user_id", currentUserId);

      if (error) {
        console.error("Error updating session type:", error);
        loadData();
      }
    },
    [getUserId, loadData],
  );

  const updateStudentDuration = useCallback(
    async (studentId: string, sessionDuration: number) => {
      const currentUserId = await getUserId();
      if (!currentUserId) return;

      setStudents((prev) => prev.map((s) => (s.id === studentId ? { ...s, sessionDuration } : s)));

      const { error } = await supabase
        .from("students")
        .update({ session_duration: sessionDuration, updated_at: new Date().toISOString() })
        .eq("id", studentId)
        .eq("user_id", currentUserId);

      if (error) {
        console.error("Error updating duration:", error);
        loadData();
      }
    },
    [getUserId, loadData],
  );

  const updateStudentCustomSettings = useCallback(
    async (
      studentId: string,
      customSettings: {
        useCustomSettings?: boolean;
        sessionDuration?: number;
        customPriceOnsite?: number;
        customPriceOnline?: number;
      },
    ) => {
      const currentUserId = await getUserId();
      if (!currentUserId) return;

      setStudents((prev) =>
        prev.map((s) => {
          if (s.id !== studentId) return s;
          return {
            ...s,
            useCustomSettings: customSettings.useCustomSettings ?? s.useCustomSettings,
            sessionDuration: customSettings.sessionDuration ?? s.sessionDuration,
            customPriceOnsite: customSettings.customPriceOnsite ?? s.customPriceOnsite,
            customPriceOnline: customSettings.customPriceOnline ?? s.customPriceOnline,
          };
        }),
      );

      const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (customSettings.useCustomSettings !== undefined) {
        updateData.use_custom_settings = customSettings.useCustomSettings;
      }
      if (customSettings.sessionDuration !== undefined) {
        updateData.session_duration = customSettings.sessionDuration;
      }
      if (customSettings.customPriceOnsite !== undefined) {
        updateData.custom_price_onsite = customSettings.customPriceOnsite;
      }
      if (customSettings.customPriceOnline !== undefined) {
        updateData.custom_price_online = customSettings.customPriceOnline;
      }

      const { error } = await supabase
        .from("students")
        .update(updateData)
        .eq("id", studentId)
        .eq("user_id", currentUserId);

      if (error) {
        console.error("Error updating custom settings:", error);
        loadData();
      }
    },
    [getUserId, loadData],
  );

  const updateStudentCancellationPolicy = useCallback(
    async (studentId: string, policy: CancellationPolicy) => {
      const currentUserId = await getUserId();
      if (!currentUserId) return;

      setStudents((prev) => prev.map((s) => (s.id === studentId ? { ...s, cancellationPolicy: policy } : s)));

      const { error } = await supabase
        .from("students")
        .update({
          cancellation_monthly_limit: policy.monthlyLimit,
          cancellation_alert_tutor: policy.alertTutor,
          cancellation_auto_notify_parent: policy.autoNotifyParent,
          updated_at: new Date().toISOString(),
        })
        .eq("id", studentId)
        .eq("user_id", currentUserId);

      if (error) {
        console.error("Error updating cancellation policy:", error);
        loadData();
      }
    },
    [getUserId, loadData],
  );

  const updateStudentSchedule = useCallback(
    async (studentId: string, scheduleDays: number[], semesterStart?: string, semesterEnd?: string) => {
      const currentUserId = await getUserId();
      if (!currentUserId) return;

      const student = students.find((s) => s.id === studentId);
      if (!student) return;

      const newStart = semesterStart || student.semesterStart;
      const newEnd = semesterEnd || student.semesterEnd;
      const sessionDates = generateSessionsForSchedule(scheduleDays, newStart, newEnd);

      // Get existing sessions
      const { data: existingSessions } = await supabase
        .from("sessions")
        .select("*")
        .eq("student_id", studentId)
        .eq("user_id", currentUserId);

      const existingDates = new Map((existingSessions || []).map((s: { date: string }) => [s.date, s]));

      // Sessions to add (new dates)
      const sessionsToAdd = sessionDates
        .filter((date) => !existingDates.has(date))
        .map((date) => ({
          student_id: studentId,
          user_id: currentUserId,
          date,
          duration: student.sessionDuration || 60,
          status: "scheduled",
        }));

      // Update student record
      const { error: updateError } = await supabase
        .from("students")
        .update({
          schedule_days: scheduleDays.map((d) => ({ dayOfWeek: d })),
          semester_start: newStart,
          semester_end: newEnd,
          updated_at: new Date().toISOString(),
        })
        .eq("id", studentId)
        .eq("user_id", currentUserId);

      if (updateError) {
        console.error("Error updating schedule:", updateError);
      }

      // Add new sessions
      if (sessionsToAdd.length > 0) {
        const { error: insertError } = await supabase.from("sessions").insert(sessionsToAdd);

        if (insertError) {
          console.error("Error adding new sessions:", insertError);
        }
      }

      // Update payment months if semester changed
      if (semesterStart || semesterEnd) {
        const months = getMonthsInSemester(newStart, newEnd);

        // Get existing payments
        const { data: existingPayments } = await supabase
          .from("monthly_payments")
          .select("*")
          .eq("student_id", studentId)
          .eq("user_id", currentUserId);

        const existingPaymentKeys = new Set((existingPayments || []).map((p: { year: number; month: number }) => `${p.year}-${p.month}`));

        // Add missing payment months
        const paymentsToAdd = months
          .filter(({ month, year }) => !existingPaymentKeys.has(`${year}-${month}`))
          .map(({ month, year }) => ({
            student_id: studentId,
            user_id: currentUserId,
            month,
            year,
            is_paid: false,
            amount_due: 0,
            amount_paid: 0,
            payment_status: "unpaid",
          }));

        if (paymentsToAdd.length > 0) {
          await supabase.from("monthly_payments").insert(paymentsToAdd);
        }
      }

      await loadData();
    },
    [getUserId, students, loadData],
  );

  // ============================================================================
  // SESSION OPERATIONS
  // ============================================================================

  const addExtraSession = useCallback(
    async (studentId: string, date: string, customTime?: string) => {
      const currentUserId = await getUserId();
      if (!currentUserId) return;

      const student = students.find((s) => s.id === studentId);
      if (!student) return;

      const now = new Date().toISOString();
      const today = toYmdLocal(new Date());
      const isPastDate = date < today;

      const { error } = await supabase.from("sessions").insert({
        student_id: studentId,
        user_id: currentUserId,
        date,
        time: customTime || null,
        duration: student.sessionDuration || 60,
        status: isPastDate ? "completed" : "scheduled",
        completed_at: isPastDate ? now : null,
      });

      if (error) {
        console.error("Error adding extra session:", error);
      } else {
        await loadData();
      }
    },
    [getUserId, students, loadData],
  );

  const removeSession = useCallback(
    async (studentId: string, sessionId: string) => {
      const currentUserId = await getUserId();
      if (!currentUserId) return;

      const now = new Date().toISOString();

      // Optimistic update
      setStudents((prev) =>
        prev.map((s) => {
          if (s.id !== studentId) return s;
          return {
            ...s,
            sessions: s.sessions.map((sess) =>
              sess.id === sessionId ? { ...sess, status: "cancelled" as SessionStatus, cancelledAt: now } : sess,
            ),
          };
        }),
      );

      const { error } = await supabase
        .from("sessions")
        .update({
          status: "cancelled",
          cancelled_at: now,
          updated_at: now,
        })
        .eq("id", sessionId)
        .eq("user_id", currentUserId);

      if (error) {
        console.error("Error removing session:", error);
        loadData();
      }
    },
    [getUserId, loadData],
  );

  const deleteSession = useCallback(
    async (studentId: string, sessionId: string) => {
      const currentUserId = await getUserId();
      if (!currentUserId) return;

      // Optimistic update
      setStudents((prev) =>
        prev.map((s) => {
          if (s.id !== studentId) return s;
          return {
            ...s,
            sessions: s.sessions.filter((sess) => sess.id !== sessionId),
          };
        }),
      );

      const { error } = await supabase.from("sessions").delete().eq("id", sessionId).eq("user_id", currentUserId);

      if (error) {
        console.error("Error deleting session:", error);
        loadData();
      }
    },
    [getUserId, loadData],
  );

  const restoreSession = useCallback(
    async (studentId: string, sessionId: string) => {
      const currentUserId = await getUserId();
      if (!currentUserId) return;

      const now = new Date().toISOString();

      // Optimistic update
      setStudents((prev) =>
        prev.map((s) => {
          if (s.id !== studentId) return s;
          return {
            ...s,
            sessions: s.sessions.map((sess) =>
              sess.id === sessionId
                ? {
                    ...sess,
                    status: "scheduled" as SessionStatus,
                    completed: false,
                    cancelledAt: undefined,
                    vacationAt: undefined,
                  }
                : sess,
            ),
          };
        }),
      );

      const { error } = await supabase
        .from("sessions")
        .update({
          status: "scheduled",
          completed_at: null,
          cancelled_at: null,
          vacation_at: null,
          updated_at: now,
        })
        .eq("id", sessionId)
        .eq("user_id", currentUserId);

      if (error) {
        console.error("Error restoring session:", error);
        loadData();
      }
    },
    [getUserId, loadData],
  );

  const markSessionAsVacation = useCallback(
    async (studentId: string, sessionId: string) => {
      const currentUserId = await getUserId();
      if (!currentUserId) return;

      const now = new Date().toISOString();

      // Optimistic update
      setStudents((prev) =>
        prev.map((s) => {
          if (s.id !== studentId) return s;
          return {
            ...s,
            sessions: s.sessions.map((sess) =>
              sess.id === sessionId && sess.status === "scheduled"
                ? { ...sess, status: "vacation" as SessionStatus, completed: false, vacationAt: now }
                : sess,
            ),
          };
        }),
      );

      const { error } = await supabase
        .from("sessions")
        .update({
          status: "vacation",
          vacation_at: now,
          updated_at: now,
        })
        .eq("id", sessionId)
        .eq("user_id", currentUserId);

      if (error) {
        console.error("Error marking as vacation:", error);
        loadData();
      }
    },
    [getUserId, loadData],
  );

  const bulkMarkAsVacation = useCallback(
    (studentIds: string[], sessionIds: string[]): { success: boolean; updatedCount: number } => {
      const now = new Date().toISOString();
      let updatedCount = 0;

      // Optimistic update (synchronous)
      setStudents((prev) =>
        prev.map((student) => {
          if (!studentIds.includes(student.id)) return student;
          return {
            ...student,
            sessions: student.sessions.map((session) => {
              if (!sessionIds.includes(session.id) || session.status !== "scheduled") {
                return session;
              }
              updatedCount++;
              return {
                ...session,
                status: "vacation" as SessionStatus,
                completed: false,
                vacationAt: now,
              };
            }),
          };
        }),
      );

      // Async database update (fire and forget)
      (async () => {
        const currentUserId = await getUserId();
        if (!currentUserId) return;

        const { error } = await supabase
          .from("sessions")
          .update({
            status: "vacation",
            vacation_at: now,
            updated_at: now,
          })
          .in("id", sessionIds)
          .eq("user_id", currentUserId)
          .eq("status", "scheduled");

        if (error) {
          console.error("Error bulk marking as vacation:", error);
          loadData();
        }
      })();

      return { success: true, updatedCount };
    },
    [getUserId, loadData],
  );

  const rescheduleSession = useCallback(
    async (studentId: string, sessionId: string, newDate: string) => {
      const currentUserId = await getUserId();
      if (!currentUserId) return;

      const now = new Date().toISOString();

      // Optimistic update
      setStudents((prev) =>
        prev.map((s) => {
          if (s.id !== studentId) return s;
          const updatedSessions = s.sessions.map((sess) => (sess.id === sessionId ? { ...sess, date: newDate } : sess));
          return {
            ...s,
            sessions: updatedSessions.sort((a, b) => a.date.localeCompare(b.date)),
          };
        }),
      );

      const { error } = await supabase
        .from("sessions")
        .update({
          date: newDate,
          updated_at: now,
        })
        .eq("id", sessionId)
        .eq("user_id", currentUserId);

      if (error) {
        console.error("Error rescheduling session:", error);
        loadData();
      }
    },
    [getUserId, loadData],
  );

  const updateSessionDateTime = useCallback(
    async (studentId: string, sessionId: string, newDate: string, newTime: string) => {
      const currentUserId = await getUserId();
      if (!currentUserId) return;

      const now = new Date().toISOString();

      // Optimistic update
      setStudents((prev) =>
        prev.map((s) => {
          if (s.id !== studentId) return s;
          const updatedSessions = s.sessions.map((sess) =>
            sess.id === sessionId ? { ...sess, date: newDate, time: newTime } : sess,
          );
          return {
            ...s,
            sessions: updatedSessions.sort((a, b) => a.date.localeCompare(b.date)),
          };
        }),
      );

      const { error } = await supabase
        .from("sessions")
        .update({
          date: newDate,
          time: newTime,
          updated_at: now,
        })
        .eq("id", sessionId)
        .eq("user_id", currentUserId);

      if (error) {
        console.error("Error updating session date/time:", error);
        loadData();
      }
    },
    [getUserId, loadData],
  );

  const toggleSessionComplete = useCallback(
    async (studentId: string, sessionId: string) => {
      const currentUserId = await getUserId();
      if (!currentUserId) return;

      const student = students.find((s) => s.id === studentId);
      const session = student?.sessions.find((sess) => sess.id === sessionId);
      if (!session) return;

      const now = new Date().toISOString();
      const newCompleted = !session.completed;
      const newStatus: SessionStatus = newCompleted ? "completed" : "scheduled";

      // Optimistic update
      setStudents((prev) =>
        prev.map((s) => {
          if (s.id !== studentId) return s;
          return {
            ...s,
            sessions: s.sessions.map((sess) =>
              sess.id === sessionId
                ? {
                    ...sess,
                    completed: newCompleted,
                    status: newStatus,
                    completedAt: newCompleted ? now : undefined,
                  }
                : sess,
            ),
          };
        }),
      );

      const { error } = await supabase
        .from("sessions")
        .update({
          status: newStatus,
          completed_at: newCompleted ? now : null,
          updated_at: now,
        })
        .eq("id", sessionId)
        .eq("user_id", currentUserId);

      if (error) {
        console.error("Error toggling session complete:", error);
        loadData();
      }
    },
    [getUserId, students, loadData],
  );

  const bulkUpdateSessionTime = useCallback(
    (
      studentIds: string[],
      sessionIds: string[],
      newTime: string,
    ): { success: boolean; updatedCount: number; conflicts: never[] } => {
      let updatedCount = 0;

      // Optimistic update (synchronous)
      setStudents((prev) =>
        prev.map((student) => {
          if (!studentIds.includes(student.id)) return student;
          return {
            ...student,
            sessions: student.sessions.map((session) => {
              if (!sessionIds.includes(session.id)) return session;
              updatedCount++;
              return { ...session, time: newTime };
            }),
          };
        }),
      );

      // Async database update (fire and forget)
      (async () => {
        const currentUserId = await getUserId();
        if (!currentUserId) return;

        const { error } = await supabase
          .from("sessions")
          .update({
            time: newTime,
            updated_at: new Date().toISOString(),
          })
          .in("id", sessionIds)
          .eq("user_id", currentUserId);

        if (error) {
          console.error("Error bulk updating session time:", error);
          loadData();
        }
      })();

      return { success: true, updatedCount, conflicts: [] };
    },
    [getUserId, loadData],
  );

  const updateSessionDetails = useCallback(
    async (
      studentId: string,
      sessionId: string,
      details: {
        topic?: string;
        notes?: string;
        homework?: string;
        homeworkStatus?: HomeworkStatus;
      },
    ) => {
      const currentUserId = await getUserId();
      if (!currentUserId) return;

      // Optimistic update
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

      const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (details.topic !== undefined) updateData.topic = details.topic || null;
      if (details.notes !== undefined) updateData.notes = details.notes || null;
      if (details.homework !== undefined) updateData.homework = details.homework || null;
      if (details.homeworkStatus !== undefined) updateData.homework_status = details.homeworkStatus || null;

      const { error } = await supabase
        .from("sessions")
        .update(updateData)
        .eq("id", sessionId)
        .eq("user_id", currentUserId);

      if (error) {
        console.error("Error updating session details:", error);
        loadData();
      }
    },
    [getUserId, loadData],
  );

  // ============================================================================
  // PAYMENT OPERATIONS
  // ============================================================================

  const togglePaymentStatus = useCallback(
    async (studentId: string, month: number, year: number) => {
      const currentUserId = await getUserId();
      if (!currentUserId) return;

      const studentPayments = payments.find((p) => p.studentId === studentId);
      const monthPayment = studentPayments?.payments.find((p) => p.month === month && p.year === year);
      const wasFullyPaid = monthPayment?.isPaid || false;

      if (wasFullyPaid) {
        // Reset payment
        // First get the monthly_payment record
        const { data: mpData } = await supabase
          .from("monthly_payments")
          .select("id")
          .eq("student_id", studentId)
          .eq("user_id", currentUserId)
          .eq("month", month)
          .eq("year", year)
          .single();

        if (mpData) {
          // Delete all payment records for this month
          await supabase
            .from("payment_records")
            .delete()
            .eq("monthly_payment_id", mpData.id)
            .eq("user_id", currentUserId);

          // Reset monthly payment
          await supabase
            .from("monthly_payments")
            .update({
              is_paid: false,
              amount_paid: 0,
              payment_status: "unpaid",
              paid_at: null,
              notes: null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", mpData.id)
            .eq("user_id", currentUserId);
        }
      } else {
        // Mark as paid (simple toggle - prefer recordPayment for actual payments)
        await supabase
          .from("monthly_payments")
          .update({
            is_paid: true,
            paid_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("student_id", studentId)
          .eq("user_id", currentUserId)
          .eq("month", month)
          .eq("year", year);
      }

      await loadData();
    },
    [getUserId, payments, loadData],
  );

  const recordPayment = useCallback(
    async (
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
      const currentUserId = await getUserId();
      if (!currentUserId) return;

      const student = students.find((s) => s.id === studentId);
      if (!student) {
        console.error("Student not found:", studentId);
        return;
      }

      const amountDue = calculateMonthlyAmountDue(student, paymentData.month, paymentData.year, settings);

      // Get or create monthly payment record
      let { data: mpData } = await supabase
        .from("monthly_payments")
        .select("*")
        .eq("student_id", studentId)
        .eq("user_id", currentUserId)
        .eq("month", paymentData.month)
        .eq("year", paymentData.year)
        .maybeSingle();

      if (!mpData) {
        // Create monthly payment record
        const { data: newMp, error: createError } = await supabase
          .from("monthly_payments")
          .insert({
            student_id: studentId,
            user_id: currentUserId,
            month: paymentData.month,
            year: paymentData.year,
            is_paid: false,
            amount_due: amountDue,
            amount_paid: 0,
            payment_status: "unpaid",
          })
          .select()
          .single();

        if (createError) {
          console.error("Error creating monthly payment:", createError);
          return;
        }
        mpData = newMp;
      }

      // Insert payment record
      const { error: prError } = await supabase.from("payment_records").insert({
        monthly_payment_id: mpData.id,
        student_id: studentId,
        user_id: currentUserId,
        amount: paymentData.amount,
        method: paymentData.method,
        paid_at: paymentData.paidAt,
        notes: paymentData.notes || null,
      });

      if (prError) {
        console.error("Error inserting payment record:", prError);
        return;
      }

      // Calculate new totals
      const existingAmountPaid = mpData.amount_paid || 0;
      const newTotalAmountPaid = existingAmountPaid + paymentData.amount;
      const newPaymentStatus: PaymentStatus =
        newTotalAmountPaid >= amountDue ? "paid" : newTotalAmountPaid > 0 ? "partial" : "unpaid";

      // Update monthly payment
      const { error: updateError } = await supabase
        .from("monthly_payments")
        .update({
          amount_due: amountDue,
          amount_paid: newTotalAmountPaid,
          is_paid: newPaymentStatus === "paid",
          payment_status: newPaymentStatus,
          paid_at: paymentData.paidAt,
          notes: paymentData.notes || mpData.notes,
          updated_at: new Date().toISOString(),
        })
        .eq("id", mpData.id)
        .eq("user_id", currentUserId);

      if (updateError) {
        console.error("Error updating monthly payment:", updateError);
      }

      await loadData();
    },
    [getUserId, students, settings, loadData],
  );

  const addPartialPayment = useCallback(
    (studentId: string, month: number, year: number, amount: number, method: PaymentMethod, notes?: string) => {
      recordPayment(studentId, {
        month,
        year,
        amount,
        method,
        paidAt: new Date().toISOString(),
        notes,
      });
    },
    [recordPayment],
  );

  const resetMonthlyPayment = useCallback(
    async (studentId: string, month: number, year: number) => {
      const currentUserId = await getUserId();
      if (!currentUserId) return;

      // Get monthly payment record
      const { data: mpData } = await supabase
        .from("monthly_payments")
        .select("id")
        .eq("student_id", studentId)
        .eq("user_id", currentUserId)
        .eq("month", month)
        .eq("year", year)
        .single();

      if (mpData) {
        // Delete all payment records
        await supabase
          .from("payment_records")
          .delete()
          .eq("monthly_payment_id", mpData.id)
          .eq("user_id", currentUserId);

        // Reset monthly payment
        await supabase
          .from("monthly_payments")
          .update({
            is_paid: false,
            amount_paid: 0,
            payment_status: "unpaid",
            paid_at: null,
            notes: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", mpData.id)
          .eq("user_id", currentUserId);
      }

      await loadData();
    },
    [getUserId, loadData],
  );

  const updateMonthlyAmountDue = useCallback(
    async (studentId: string, month: number, year: number, amountDue: number) => {
      const currentUserId = await getUserId();
      if (!currentUserId) return;

      // Get current payment
      const { data: mpData } = await supabase
        .from("monthly_payments")
        .select("*")
        .eq("student_id", studentId)
        .eq("user_id", currentUserId)
        .eq("month", month)
        .eq("year", year)
        .maybeSingle();

      const currentAmountPaid = mpData?.amount_paid || 0;
      const newStatus: PaymentStatus =
        currentAmountPaid >= amountDue && amountDue > 0 ? "paid" : currentAmountPaid > 0 ? "partial" : "unpaid";

      if (mpData) {
        await supabase
          .from("monthly_payments")
          .update({
            amount_due: amountDue,
            payment_status: newStatus,
            is_paid: newStatus === "paid",
            updated_at: new Date().toISOString(),
          })
          .eq("id", mpData.id)
          .eq("user_id", currentUserId);
      } else {
        await supabase.from("monthly_payments").insert({
          student_id: studentId,
          user_id: currentUserId,
          month,
          year,
          amount_due: amountDue,
          amount_paid: 0,
          is_paid: false,
          payment_status: "unpaid",
        });
      }

      await loadData();
    },
    [getUserId, loadData],
  );

  const getStudentPayments = useCallback(
    (studentId: string): StudentPayments | undefined => {
      return payments.find((p) => p.studentId === studentId);
    },
    [payments],
  );

  const isStudentPaidForMonth = useCallback(
    (studentId: string, month: number, year: number): boolean => {
      const studentPayments = getStudentPayments(studentId);
      if (!studentPayments) return false;
      const payment = studentPayments.payments.find((p) => p.month === month && p.year === year);
      return payment?.isPaid || false;
    },
    [getStudentPayments],
  );

  // ============================================================================
  // RETURN
  // ============================================================================

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
    addPartialPayment,
    resetMonthlyPayment,
    updateMonthlyAmountDue,
    getStudentPayments,
    isStudentPaidForMonth,
    bulkUpdateSessionTime,
    markSessionAsVacation,
    bulkMarkAsVacation,
    updateSessionDetails,
  };
};
