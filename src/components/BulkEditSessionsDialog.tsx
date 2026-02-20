import { useState, useMemo, useEffect } from "react";
import {
  format,
  startOfDay,
  startOfWeek,
  endOfWeek,
  addWeeks,
  endOfMonth,
  startOfMonth,
  addMonths,
  parseISO,
  getDay,
  addDays,
  isWithinInterval,
} from "date-fns";
import { Calendar, Clock, User, Users, Undo2, CheckCircle2, XCircle, AlertCircle, ArrowDown, Plus, X } from "lucide-react";
import { Student, Session, StudentGroup } from "@/types/student";
import { formatShortDateAr, MONTH_NAMES_AR } from "@/lib/arabicConstants";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";


import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";

interface BulkEditSessionsDialogProps {
  students: Student[];
  groups?: StudentGroup[];
  onBulkUpdateTime: (
    studentIds: string[],
    sessionIds: string[],
    newTime: string,
  ) => { success: boolean; updatedCount: number; conflicts: ConflictInfo[] };
  onUpdateSessionDate?: (studentId: string, sessionId: string, newDate: string, newTime: string) => void;
  onBulkMarkAsVacation?: (studentIds: string[], sessionIds: string[]) => { success: boolean; updatedCount: number };
  onUpdateGroupSessionDateTime?: (groupId: string, sessionId: string, newDate: string, newTime: string) => void;
}

interface SessionWithStudent {
  session: Session;
  student: Student;
  group?: StudentGroup;
  isGroup?: boolean;
  originalTime: string;
  newTime: string;
  originalDate: string;
  newDate: string;
  weekLabel?: string;
}

interface ConflictInfo {
  session: Session;
  student: Student;
  conflictsWith: {
    session: Session;
    student: Student;
  };
  type: "exact" | "partial" | "close";
  gap?: number;
}

interface CategorizedSessions {
  safe: SessionWithStudent[];
  warnings: SessionWithStudent[];
  conflicts: SessionWithStudent[];
}

interface DayChangeRule {
  id: string;
  originalDay: number;
  originalTime: string;
  newDay: number;
  newTime: string;
  enabled: boolean;
  sessionCount: number;
}

interface UndoData {
  sessionUpdates: { sessionId: string; studentId: string; groupId?: string; isGroup?: boolean; originalTime: string; originalDate: string }[];
  timestamp: number;
  count: number;
  studentName: string;
}

interface PeriodOption {
  id: string;
  type: "week" | "month" | "custom";
  label: string;
  dateRange: string;
  startDate: Date;
  endDate: Date;
}

const UNDO_STORAGE_KEY = "bulk-edit-undo-data";
const UNDO_TIMEOUT_MS = 10 * 60 * 1000;

const timeToMinutes = (time: string): number => {
  if (!time) return 16 * 60;
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

const minutesToTime = (minutes: number): string => {
  const normalizedMinutes = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(normalizedMinutes / 60);
  const m = normalizedMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

const formatTimeAr = (time: string): string => {
  if (!time) return "4:00 م";
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "م" : "ص";
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
};

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const hour = Math.floor(i / 2);
  const min = (i % 2) * 30;
  return `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
});

const DAY_OPTIONS = [
  { value: 0, label: "الأحد" },
  { value: 1, label: "الاثنين" },
  { value: 2, label: "الثلاثاء" },
  { value: 3, label: "الأربعاء" },
  { value: 4, label: "الخميس" },
  { value: 5, label: "الجمعة" },
  { value: 6, label: "السبت" },
];

type ModificationType = "offset" | "day-change";

const calculateNewDate = (originalDate: string, originalDay: number, newDay: number): string => {
  const date = parseISO(originalDate);
  const currentDay = getDay(date);
  let dayDiff = newDay - currentDay;
  if (dayDiff === 0) return originalDate; // same day — keep original date
  if (dayDiff < 0) {
    dayDiff += 7;
  }
  const newDate = addDays(date, dayDiff);
  return format(newDate, "yyyy-MM-dd");
};

const formatDateRangeAr = (start: Date, end: Date): string => {
  const startDay = format(start, "d");
  const endDay = format(end, "d");
  const startMonth = MONTH_NAMES_AR[start.getMonth()];
  const endMonth = MONTH_NAMES_AR[end.getMonth()];

  if (startMonth === endMonth) {
    return `${startDay}-${endDay} ${startMonth}`;
  }
  return `${startDay} ${startMonth} - ${endDay} ${endMonth}`;
};

// Changed to 4 weeks only
const generateWeekOptions = (today: Date): PeriodOption[] => {
  const weeks: PeriodOption[] = [];
  const weekLabels = ["هذا الأسبوع", "الأسبوع القادم", "الأسبوع الثالث", "الأسبوع الرابع"];

  for (let i = 0; i < 4; i++) {
    const weekStart = i === 0 ? today : startOfWeek(addWeeks(today, i), { weekStartsOn: 0 });
    const weekEnd = endOfWeek(addWeeks(today, i), { weekStartsOn: 0 });

    weeks.push({
      id: `week-${i}`,
      type: "week",
      label: weekLabels[i],
      dateRange: formatDateRangeAr(weekStart, weekEnd),
      startDate: weekStart,
      endDate: weekEnd,
    });
  }

  return weeks;
};

const generateMonthOptions = (today: Date): PeriodOption[] => {
  const months: PeriodOption[] = [];

  for (let i = 0; i < 3; i++) {
    const monthDate = addMonths(today, i);
    const monthStart = i === 0 ? today : startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthDate);

    months.push({
      id: `month-${i}`,
      type: "month",
      label: `${MONTH_NAMES_AR[monthDate.getMonth()]} ${monthDate.getFullYear()}`,
      dateRange: formatDateRangeAr(monthStart, monthEnd),
      startDate: monthStart,
      endDate: monthEnd,
    });
  }

  return months;
};

export const BulkEditSessionsDialog = ({
  students,
  groups = [],
  onBulkUpdateTime,
  onUpdateSessionDate,
  onUpdateGroupSessionDateTime,
}: BulkEditSessionsDialogProps) => {
  const [open, setOpen] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [lastApplyResult, setLastApplyResult] = useState<{ safe: number; warnings: number; conflicts: number }>({
    safe: 0,
    warnings: 0,
    conflicts: 0,
  });

  const today = startOfDay(new Date());
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [selectedType, setSelectedType] = useState<"student" | "group">("student");
  const [selectedPeriods, setSelectedPeriods] = useState<PeriodOption[]>([]);
  const [showPeriodPicker, setShowPeriodPicker] = useState(false);
  const [checkedPeriodIds, setCheckedPeriodIds] = useState<Set<string>>(new Set());
  const [periodView, setPeriodView] = useState<"weeks" | "months" | "custom">("weeks");
  const [customDateFrom, setCustomDateFrom] = useState<Date | undefined>(today);
  const [customDateTo, setCustomDateTo] = useState<Date | undefined>(endOfMonth(today));

  const weekOptions = useMemo(() => generateWeekOptions(today), []);
  const monthOptions = useMemo(() => generateMonthOptions(today), []);

  const [modType, setModType] = useState<ModificationType>("offset");
  const [offsetDirection, setOffsetDirection] = useState<"+" | "-">("+");
  const [offsetHours, setOffsetHours] = useState<number>(4);
  const [offsetMinutes, setOffsetMinutes] = useState<number>(0);
  const [originalDay, setOriginalDay] = useState<number>(1);
  const [originalTime, setOriginalTime] = useState<string>("16:00");
  const [newDay, setNewDay] = useState<number>(5);
  const [newTime, setNewTime] = useState<string>("13:00");
  const [dayChangeRules, setDayChangeRules] = useState<DayChangeRule[]>([]);
  const [offsetDayFilter, setOffsetDayFilter] = useState<number[]>([]);
  const [undoData, setUndoData] = useState<UndoData | null>(null);
  const [undoTimeLeft, setUndoTimeLeft] = useState<number>(0);

  const togglePeriodCheck = (periodId: string) => {
    setCheckedPeriodIds((prev) => {
      const next = new Set(prev);
      if (next.has(periodId)) {
        next.delete(periodId);
      } else {
        next.add(periodId);
      }
      return next;
    });
  };

  const selectAllPeriods = () => {
    const allIds = [...weekOptions, ...monthOptions].map((p) => p.id);
    setCheckedPeriodIds(new Set(allIds));
  };

  const deselectAllPeriods = () => {
    setCheckedPeriodIds(new Set());
  };

  const addCheckedPeriods = () => {
    if (periodView === "custom" && customDateFrom && customDateTo) {
      if (customDateTo < customDateFrom) {
        toast({
          title: "تواريخ غير صحيحة",
          description: "تاريخ النهاية يجب أن يكون بعد تاريخ البداية",
          variant: "destructive",
        });
        return;
      }

      const customPeriod: PeriodOption = {
        id: `custom-${Date.now()}`,
        type: "custom",
        label: "نطاق مخصص",
        dateRange: formatDateRangeAr(customDateFrom, customDateTo),
        startDate: customDateFrom,
        endDate: customDateTo,
      };

      const exists = selectedPeriods.some(
        (p) =>
          p.type === "custom" &&
          format(p.startDate, "yyyy-MM-dd") === format(customDateFrom, "yyyy-MM-dd") &&
          format(p.endDate, "yyyy-MM-dd") === format(customDateTo, "yyyy-MM-dd"),
      );

      if (exists) {
        toast({
          title: "فترة مكررة",
          description: "هذه الفترة مضافة بالفعل",
          variant: "destructive",
        });
        return;
      }

      setSelectedPeriods([...selectedPeriods, customPeriod]);
      setShowPeriodPicker(false);
      setPeriodView("weeks");
      setCheckedPeriodIds(new Set());
      return;
    }

    if (checkedPeriodIds.size === 0) {
      toast({
        title: "اختر فترة",
        description: "الرجاء اختيار فترة واحدة على الأقل",
        variant: "destructive",
      });
      return;
    }

    const allOptions = [...weekOptions, ...monthOptions];
    const periodsToAdd = allOptions.filter(
      (p) => checkedPeriodIds.has(p.id) && !selectedPeriods.some((sp) => sp.id === p.id),
    );

    if (periodsToAdd.length === 0) {
      toast({
        title: "فترات مكررة",
        description: "جميع الفترات المختارة مضافة بالفعل",
        variant: "destructive",
      });
      return;
    }

    setSelectedPeriods([...selectedPeriods, ...periodsToAdd]);
    setShowPeriodPicker(false);
    setCheckedPeriodIds(new Set());
  };

  const removePeriod = (periodId: string) => {
    setSelectedPeriods(selectedPeriods.filter((p) => p.id !== periodId));
  };

  const isDateInSelectedPeriods = (dateStr: string): { inPeriod: boolean; weekLabel?: string } => {
    const date = parseISO(dateStr);

    for (const period of selectedPeriods) {
      if (isWithinInterval(date, { start: period.startDate, end: period.endDate })) {
        return { inPeriod: true, weekLabel: `${period.label} (${period.dateRange})` };
      }
    }

    return { inPeriod: false };
  };

  useEffect(() => {
    const stored = localStorage.getItem(UNDO_STORAGE_KEY);
    if (stored) {
      try {
        const data: UndoData = JSON.parse(stored);
        const elapsed = Date.now() - data.timestamp;
        if (elapsed < UNDO_TIMEOUT_MS) {
          setUndoData(data);
        } else {
          localStorage.removeItem(UNDO_STORAGE_KEY);
        }
      } catch {
        localStorage.removeItem(UNDO_STORAGE_KEY);
      }
    }
  }, []);

  useEffect(() => {
    if (!undoData) {
      setUndoTimeLeft(0);
      return;
    }

    const updateTimer = () => {
      const elapsed = Date.now() - undoData.timestamp;
      const remaining = Math.max(0, UNDO_TIMEOUT_MS - elapsed);
      setUndoTimeLeft(remaining);

      if (remaining === 0) {
        setUndoData(null);
        localStorage.removeItem(UNDO_STORAGE_KEY);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [undoData]);

  const calculateOffsetTime = (sessionTime: string): string => {
    const originalMinutes = timeToMinutes(sessionTime);
    const offsetTotalMinutes = offsetHours * 60 + offsetMinutes;
    const newMinutes =
      offsetDirection === "+" ? originalMinutes + offsetTotalMinutes : originalMinutes - offsetTotalMinutes;
    return minutesToTime(newMinutes);
  };

  const selectedStudent = useMemo(() => {
    if (selectedType !== "student") return undefined;
    return students.find((s) => s.id === selectedStudentId);
  }, [students, selectedStudentId, selectedType]);

  const selectedGroup = useMemo(() => {
    if (selectedType !== "group") return undefined;
    return groups.find((g) => g.id === selectedStudentId);
  }, [groups, selectedStudentId, selectedType]);

  const selectedName = selectedType === "group" ? selectedGroup?.name : selectedStudent?.name;

  const hasSelectedPeriod = selectedPeriods.length > 0;

  const availableDaysAndTimes = useMemo(() => {
    const dayCount: { [key: number]: number } = {};
    const timeCount: { [key: string]: number } = {};

    if ((!selectedStudent && !selectedGroup) || !hasSelectedPeriod) {
      return { days: [], times: [] };
    }

    const sessions = selectedType === "group" && selectedGroup
      ? selectedGroup.sessions
      : selectedStudent?.sessions || [];
    const defaultTime = selectedType === "group" && selectedGroup
      ? selectedGroup.sessionTime || "16:00"
      : selectedStudent?.sessionTime || "16:00";

    sessions.forEach((session) => {
      if (session.status !== "scheduled") return;

      const { inPeriod } = isDateInSelectedPeriods(session.date);
      if (!inPeriod) return;

      const sessionDay = getDay(parseISO(session.date));
      const sessionTime = session.time || defaultTime;

      dayCount[sessionDay] = (dayCount[sessionDay] || 0) + 1;
      timeCount[sessionTime] = (timeCount[sessionTime] || 0) + 1;
    });

    const days = Object.entries(dayCount)
      .map(([day, count]) => ({ day: Number(day), count }))
      .sort((a, b) => a.day - b.day);

    const times = Object.entries(timeCount)
      .map(([time, count]) => ({ time, count }))
      .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));

    return { days, times };
  }, [selectedStudent, selectedGroup, selectedType, hasSelectedPeriod, selectedPeriods]);

  useEffect(() => {
    if (modType === "day-change" && availableDaysAndTimes.days.length > 0) {
      const currentDayValid = availableDaysAndTimes.days.some((d) => d.day === originalDay);
      if (!currentDayValid) {
        setOriginalDay(availableDaysAndTimes.days[0].day);
      }
    }
  }, [availableDaysAndTimes.days, modType]);

  useEffect(() => {
    if (modType === "day-change" && availableDaysAndTimes.times.length > 0) {
      const currentTimeValid = availableDaysAndTimes.times.some((t) => t.time === originalTime);
      if (!currentTimeValid) {
        setOriginalTime(availableDaysAndTimes.times[0].time);
      }
    }
  }, [availableDaysAndTimes.times, modType]);

  // Detect unique (day, time) combos from scheduled sessions in selected periods
  const availableDayTimeCombos = useMemo(() => {
    if ((!selectedStudent && !selectedGroup) || !hasSelectedPeriod) return [];

    const comboMap = new Map<string, { day: number; time: string; count: number }>();

    const sessions = selectedType === "group" && selectedGroup
      ? selectedGroup.sessions
      : selectedStudent?.sessions || [];
    const defaultTime = selectedType === "group" && selectedGroup
      ? selectedGroup.sessionTime || "16:00"
      : selectedStudent?.sessionTime || "16:00";

    sessions.forEach((session) => {
      if (session.status !== "scheduled") return;
      const { inPeriod } = isDateInSelectedPeriods(session.date);
      if (!inPeriod) return;

      const sessionDay = getDay(parseISO(session.date));
      const sessionTime = session.time || defaultTime;
      const key = `${sessionDay}-${sessionTime}`;

      if (comboMap.has(key)) {
        comboMap.get(key)!.count++;
      } else {
        comboMap.set(key, { day: sessionDay, time: sessionTime, count: 1 });
      }
    });

    return Array.from(comboMap.values()).sort((a, b) =>
      a.day !== b.day ? a.day - b.day : timeToMinutes(a.time) - timeToMinutes(b.time),
    );
  }, [selectedStudent, selectedGroup, selectedType, hasSelectedPeriod, selectedPeriods]);

  // Auto-generate day-change rules from detected combos, preserving user edits
  useEffect(() => {
    if (modType !== "day-change") return;

    setDayChangeRules((prev) => {
      return availableDayTimeCombos.map((combo) => {
        const existing = prev.find(
          (r) => r.originalDay === combo.day && r.originalTime === combo.time,
        );
        if (existing) {
          return { ...existing, sessionCount: combo.count };
        }
        return {
          id: `rule-${combo.day}-${combo.time}`,
          originalDay: combo.day,
          originalTime: combo.time,
          newDay: combo.day,
          newTime: combo.time,
          enabled: true,
          sessionCount: combo.count,
        };
      });
    });
  }, [availableDayTimeCombos, modType]);

  const matchingSessions = useMemo(() => {
    const sessions: SessionWithStudent[] = [];

    if (!selectedStudentId || (!selectedStudent && !selectedGroup) || !hasSelectedPeriod) return sessions;

    const isGroupMode = selectedType === "group" && !!selectedGroup;
    const sourceSessions = isGroupMode ? selectedGroup!.sessions : selectedStudent?.sessions || [];
    const defaultTime = isGroupMode ? selectedGroup!.sessionTime || "16:00" : selectedStudent?.sessionTime || "16:00";
    const defaultDuration = isGroupMode ? selectedGroup!.sessionDuration || 60 : selectedStudent?.sessionDuration || 60;

    // Create a dummy student object for groups to keep the data structure consistent
    const entityAsStudent: Student = isGroupMode
      ? {
          id: selectedGroup!.id,
          name: selectedGroup!.name,
          phone: "",
          sessionTime: defaultTime,
          sessionDuration: defaultDuration,
          scheduleDays: selectedGroup!.scheduleDays,
          sessionType: selectedGroup!.sessionType,
          sessions: sourceSessions as Session[],
          sempiternityStart: "",
          semesterEnd: "",
          monthlyPrice: selectedGroup!.defaultPricePerStudent,
          isActive: selectedGroup!.isActive,
          createdAt: selectedGroup!.createdAt,
          updatedAt: selectedGroup!.updatedAt,
        } as Student
      : selectedStudent!;

    sourceSessions.forEach((session) => {
      if (session.status !== "scheduled") return;

      const { inPeriod, weekLabel } = isDateInSelectedPeriods(session.date);
      if (!inPeriod) return;

      const sessionTime = session.time || defaultTime;

      // Offset mode: optional day filter
      if (modType === "offset" && offsetDayFilter.length > 0) {
        const sessionDay = getDay(parseISO(session.date));
        if (!offsetDayFilter.includes(sessionDay)) return;
      }

      // Day-change mode: match against enabled rules
      let matchingRule: DayChangeRule | undefined;
      if (modType === "day-change") {
        const sessionDay = getDay(parseISO(session.date));
        matchingRule = dayChangeRules.find(
          (rule) => rule.enabled && rule.originalDay === sessionDay && sessionTime === rule.originalTime,
        );
        if (!matchingRule) return;
      }

      let calculatedNewTime: string;
      let calculatedNewDate: string = session.date;

      if (modType === "offset") {
        calculatedNewTime = calculateOffsetTime(sessionTime);
      } else if (matchingRule) {
        calculatedNewTime = matchingRule.newTime;
        calculatedNewDate = calculateNewDate(session.date, matchingRule.originalDay, matchingRule.newDay);
      } else {
        return;
      }

      sessions.push({
        session,
        student: entityAsStudent,
        group: isGroupMode ? selectedGroup : undefined,
        isGroup: isGroupMode,
        originalTime: sessionTime,
        newTime: calculatedNewTime,
        originalDate: session.date,
        newDate: calculatedNewDate,
        weekLabel,
      });
    });

    return sessions.sort((a, b) => a.session.date.localeCompare(b.session.date));
  }, [
    selectedStudent,
    selectedStudentId,
    hasSelectedPeriod,
    selectedPeriods,
    modType,
    offsetDirection,
    offsetHours,
    offsetMinutes,
    offsetDayFilter,
    dayChangeRules,
    originalDay,
    originalTime,
    newDay,
    newTime,
  ]);

  const sessionsByWeek = useMemo(() => {
    const groups: { [key: string]: SessionWithStudent[] } = {};

    matchingSessions.forEach((session) => {
      const key = session.weekLabel || "أخرى";
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(session);
    });

    return groups;
  }, [matchingSessions]);

  const categorizedSessions = useMemo((): CategorizedSessions => {
    const result: CategorizedSessions = { safe: [], warnings: [], conflicts: [] };
    const minGap = 30;

    // Helper to check overlap between two time ranges
    const checkOverlap = (
      startA: number, endA: number,
      startB: number, endB: number,
    ): "overlap" | "close" | "none" => {
      if (startA === startB) return "overlap";

      const overlaps =
        (startA >= startB && startA < endB) ||
        (endA > startB && endA <= endB) ||
        (startA <= startB && endA >= endB);

      if (overlaps) return "overlap";

      const gapBefore = Math.abs(startA - endB);
      const gapAfter = Math.abs(startB - endA);
      const gap = Math.min(gapBefore, gapAfter);

      if (gap > 0 && gap < minGap) return "close";
      return "none";
    };

    matchingSessions.forEach((sessionData) => {
      const { session, student, newTime: sessNewTime, newDate: sessNewDate } = sessionData;
      const newStartMinutes = timeToMinutes(sessNewTime);
      const sessionDuration = session.duration || student.sessionDuration || 60;
      const newEndMinutes = newStartMinutes + sessionDuration;

      let conflictType = "none" as "none" | "close" | "overlap";

      // 1. Check against OTHER students' sessions
      students.forEach((otherStudent) => {
        if (otherStudent.id === student.id) return;

        otherStudent.sessions.forEach((otherSession) => {
          if (otherSession.date !== sessNewDate) return;
          if (otherSession.status === "cancelled" || otherSession.status === "vacation") return;

          const otherTime = otherSession.time || otherStudent.sessionTime || "16:00";
          const otherStartMinutes = timeToMinutes(otherTime);
          const otherDuration = otherSession.duration || otherStudent.sessionDuration || 60;
          const otherEndMinutes = otherStartMinutes + otherDuration;

          const result = checkOverlap(newStartMinutes, newEndMinutes, otherStartMinutes, otherEndMinutes);
          if (result === "overlap") conflictType = "overlap";
          else if (result === "close" && conflictType !== "overlap") conflictType = "close";
        });
      });

      // 1b. Check against groups' sessions (cross-entity conflicts)
      if (conflictType !== "overlap") {
        groups.forEach((otherGroup) => {
          if (sessionData.isGroup && otherGroup.id === sessionData.group?.id) return;

          otherGroup.sessions.forEach((otherSession) => {
            if (otherSession.date !== sessNewDate) return;
            if (otherSession.status === "cancelled" || otherSession.status === "vacation") return;

            const otherTime = otherSession.time || otherGroup.sessionTime || "16:00";
            const otherStartMinutes = timeToMinutes(otherTime);
            const otherDuration = otherSession.duration || otherGroup.sessionDuration || 60;
            const otherEndMinutes = otherStartMinutes + otherDuration;

            const res = checkOverlap(newStartMinutes, newEndMinutes, otherStartMinutes, otherEndMinutes);
            if (res === "overlap") conflictType = "overlap";
            else if (res === "close" && conflictType !== "overlap") conflictType = "close";
          });
        });
      }

      // 2. Self-conflict: check same student's sessions that are NOT being modified
      if (conflictType !== "overlap") {
        student.sessions.forEach((otherSession) => {
          if (otherSession.id === session.id) return;
          // Skip sessions that are also being modified (checked separately below)
          if (matchingSessions.some((ms) => ms.session.id === otherSession.id)) return;
          if (otherSession.date !== sessNewDate) return;
          if (otherSession.status === "cancelled" || otherSession.status === "vacation") return;

          const otherTime = otherSession.time || student.sessionTime || "16:00";
          const otherStartMinutes = timeToMinutes(otherTime);
          const otherDuration = otherSession.duration || student.sessionDuration || 60;
          const otherEndMinutes = otherStartMinutes + otherDuration;

          const res = checkOverlap(newStartMinutes, newEndMinutes, otherStartMinutes, otherEndMinutes);
          if (res === "overlap") conflictType = "overlap";
          else if (res === "close" && conflictType !== "overlap") conflictType = "close";
        });
      }

      // 3. Self-conflict: check against OTHER modified sessions (same student, different session)
      if (conflictType !== "overlap") {
        matchingSessions.forEach((otherMs) => {
          if (otherMs.session.id === session.id) return;
          if (otherMs.student.id !== student.id) return;
          if (otherMs.newDate !== sessNewDate) return;

          const otherNewStart = timeToMinutes(otherMs.newTime);
          const otherDuration = otherMs.session.duration || otherMs.student.sessionDuration || 60;
          const otherNewEnd = otherNewStart + otherDuration;

          const res = checkOverlap(newStartMinutes, newEndMinutes, otherNewStart, otherNewEnd);
          if (res === "overlap") conflictType = "overlap";
          else if (res === "close" && conflictType !== "overlap") conflictType = "close";
        });
      }

      if (conflictType === "overlap") {
        result.conflicts.push(sessionData);
      } else if (conflictType === "close") {
        result.warnings.push(sessionData);
      } else {
        result.safe.push(sessionData);
      }
    });

    return result;
  }, [matchingSessions, students, groups]);

  const handleShowPreview = () => {
    if (!selectedStudentId) {
      toast({
        title: "اختر طالب أو مجموعة",
        description: "الرجاء اختيار طالب أو مجموعة أولاً",
        variant: "destructive",
      });
      return;
    }

    if (!hasSelectedPeriod) {
      toast({
        title: "اختر فترة زمنية",
        description: "يجب إضافة فترة واحدة على الأقل",
        variant: "destructive",
      });
      return;
    }

    if (modType === "day-change") {
      const enabledRules = dayChangeRules.filter((r) => r.enabled);
      if (enabledRules.length === 0) {
        toast({
          title: "لا توجد قواعد مفعّلة",
          description: "الرجاء تفعيل قاعدة واحدة على الأقل",
          variant: "destructive",
        });
        return;
      }

      const hasChange = enabledRules.some(
        (r) => r.originalDay !== r.newDay || r.originalTime !== r.newTime,
      );
      if (!hasChange) {
        toast({
          title: "لا يوجد تغيير",
          description: "لم تقم بتعديل أي يوم أو وقت",
          variant: "destructive",
        });
        return;
      }
    }

    if (matchingSessions.length === 0) {
      toast({
        title: "لا توجد جلسات",
        description: `لا توجد جلسات مجدولة لـ ${selectedName || "الطالب"} في الفترات المختارة`,
        variant: "destructive",
      });
      return;
    }

    if (modType === "offset" && offsetHours === 0 && offsetMinutes === 0) {
      toast({
        title: "خطأ",
        description: "الرجاء تحديد مقدار التعديل",
        variant: "destructive",
      });
      return;
    }

    if (modType === "offset") {
      const totalOffset = offsetHours * 60 + offsetMinutes;
      if (totalOffset > 12 * 60) {
        toast({
          title: "خطأ",
          description: "الحد الأقصى للتعديل 12 ساعة",
          variant: "destructive",
        });
        return;
      }
    }

    setShowPreview(true);
  };

  const applyChanges = (includeWarnings: boolean) => {
    const sessionsToApply = includeWarnings
      ? [...categorizedSessions.safe, ...categorizedSessions.warnings]
      : categorizedSessions.safe;

    if (sessionsToApply.length === 0) {
      toast({
        title: "لا توجد جلسات للتطبيق",
        description: "جميع الجلسات المحددة بها تعارضات",
        variant: "destructive",
      });
      return;
    }

    const isGroupMode = selectedType === "group";

    const undoInfo: UndoData = {
      sessionUpdates: sessionsToApply.map((s) => ({
        sessionId: s.session.id,
        studentId: s.student.id,
        groupId: s.group?.id,
        isGroup: s.isGroup,
        originalTime: s.originalTime,
        originalDate: s.originalDate,
      })),
      timestamp: Date.now(),
      count: sessionsToApply.length,
      studentName: selectedName || "",
    };

    const successfulUpdates: typeof undoInfo.sessionUpdates = [];

    try {
      sessionsToApply.forEach((s) => {
        if (isGroupMode && s.group && onUpdateGroupSessionDateTime) {
          // Group session update
          onUpdateGroupSessionDateTime(s.group.id, s.session.id, s.newDate, s.newTime);
        } else if (modType === "day-change" && onUpdateSessionDate) {
          onUpdateSessionDate(s.student.id, s.session.id, s.newDate, s.newTime);
        } else {
          onBulkUpdateTime([s.student.id], [s.session.id], s.newTime);
        }
        successfulUpdates.push({
          sessionId: s.session.id,
          studentId: s.student.id,
          groupId: s.group?.id,
          isGroup: s.isGroup,
          originalTime: s.originalTime,
          originalDate: s.originalDate,
        });
      });
    } catch (error) {
      console.error("Error applying bulk changes:", error);
      toast({
        title: "خطأ",
        description: `فشل تطبيق بعض التغييرات. تم تعديل ${successfulUpdates.length} من ${sessionsToApply.length} جلسة.`,
        variant: "destructive",
      });
    }

    // Only store undo data for successfully applied changes
    if (successfulUpdates.length > 0) {
      const actualUndo: UndoData = {
        ...undoInfo,
        sessionUpdates: successfulUpdates,
        count: successfulUpdates.length,
      };
      localStorage.setItem(UNDO_STORAGE_KEY, JSON.stringify(actualUndo));
      setUndoData(actualUndo);
    }

    setLastApplyResult({
      safe: categorizedSessions.safe.length,
      warnings: includeWarnings ? categorizedSessions.warnings.length : 0,
      conflicts: categorizedSessions.conflicts.length,
    });

    setShowPreview(false);
    setShowSuccessDialog(true);
  };

  const handleUndo = () => {
    if (!undoData) return;

    undoData.sessionUpdates.forEach((update) => {
      if (update.isGroup && update.groupId && onUpdateGroupSessionDateTime) {
        onUpdateGroupSessionDateTime(update.groupId, update.sessionId, update.originalDate, update.originalTime);
      } else if (onUpdateSessionDate) {
        onUpdateSessionDate(update.studentId, update.sessionId, update.originalDate, update.originalTime);
      } else {
        onBulkUpdateTime([update.studentId], [update.sessionId], update.originalTime);
      }
    });

    toast({
      title: "✓ تم التراجع",
      description: `تم استعادة ${undoData.count} جلسة إلى أوقاتها الأصلية`,
    });

    localStorage.removeItem(UNDO_STORAGE_KEY);
    setUndoData(null);
    setShowSuccessDialog(false);
  };

  const resetForm = () => {
    setSelectedStudentId("");
    setSelectedType("student");
    setSelectedPeriods([]);
    setShowPeriodPicker(false);
    setCheckedPeriodIds(new Set());
    setPeriodView("weeks");
    setCustomDateFrom(today);
    setCustomDateTo(endOfMonth(today));
    setModType("offset");
    setOffsetDirection("+");
    setOffsetHours(4);
    setOffsetMinutes(0);
    setOriginalDay(1);
    setOriginalTime("16:00");
    setNewDay(5);
    setNewTime("13:00");
    setDayChangeRules([]);
    setOffsetDayFilter([]);
    setShowPreview(false);
  };

  const formatUndoTimeLeft = () => {
    const minutes = Math.floor(undoTimeLeft / 60000);
    const seconds = Math.floor((undoTimeLeft % 60000) / 1000);
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  };

  const formatDateWithDay = (dateStr: string): string => {
    const date = parseISO(dateStr);
    const dayIndex = getDay(date);
    const dayName = DAY_OPTIONS.find((d) => d.value === dayIndex)?.label || "";
    return `${dayName} ${formatShortDateAr(dateStr)}`;
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(isOpen) => {
          setOpen(isOpen);
          if (!isOpen) {
            setShowPreview(false);
            setShowSuccessDialog(false);
          }
        }}
      >
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5 w-full justify-start">
            <Clock className="h-4 w-4 shrink-0" />
            <span>تعديل جماعي</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md max-h-[90vh] overflow-hidden flex flex-col" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-heading">
              <Clock className="h-5 w-5" />
              تعديل جماعي للجلسات
            </DialogTitle>
          </DialogHeader>

          {!showPreview && !showSuccessDialog && (
            <div
              className="flex-1 min-h-0 -mx-6 px-6 overflow-y-auto overflow-x-hidden"
              style={{
                overscrollBehavior: "contain",
                WebkitOverflowScrolling: "touch",
              }}
            >
              <div className="space-y-4 pb-2 pr-2">
                {undoData && undoTimeLeft > 0 && (
                  <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 flex items-center justify-between">
                    <div className="text-sm">
                      <p className="font-medium">يمكنك التراجع عن التعديل السابق</p>
                      <p className="text-muted-foreground text-xs">
                        {undoData.count} جلسة لـ {undoData.studentName} • متبقي {formatUndoTimeLeft()}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleUndo} className="gap-1">
                      <Undo2 className="h-3.5 w-3.5" />
                      تراجع
                    </Button>
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5 text-sm">
                    <User className="h-4 w-4" />
                    اختر الطالب أو المجموعة
                  </Label>
                  <Select
                    value={selectedStudentId ? `${selectedType}:${selectedStudentId}` : ""}
                    onValueChange={(v) => {
                      const [type, id] = v.split(":");
                      setSelectedType(type as "student" | "group");
                      setSelectedStudentId(id);
                    }}
                  >
                    <SelectTrigger className={cn(!selectedStudentId && "text-muted-foreground")}>
                      <SelectValue placeholder="اختر طالب أو مجموعة..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel className="flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5" />
                          الطلبة
                        </SelectLabel>
                        {students.map((student) => (
                          <SelectItem key={`student:${student.id}`} value={`student:${student.id}`}>
                            {student.name} ({formatTimeAr(student.sessionTime || "16:00")})
                          </SelectItem>
                        ))}
                      </SelectGroup>
                      {groups.length > 0 && (
                        <SelectGroup>
                          <SelectLabel className="flex items-center gap-1.5">
                            <Users className="h-3.5 w-3.5" />
                            المجموعات
                          </SelectLabel>
                          {groups.filter(g => g.isActive).map((group) => (
                            <SelectItem key={`group:${group.id}`} value={`group:${group.id}`}>
                              👥 {group.name} ({formatTimeAr(group.sessionTime || "16:00")} • {group.members.filter(m => m.isActive).length} طالب)
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5 text-sm">
                    <Calendar className="h-4 w-4" />
                    الفترة الزمنية
                  </Label>

                  <Popover open={showPeriodPicker} onOpenChange={setShowPeriodPicker}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-1 w-full">
                        <Plus className="h-4 w-4" />
                        إضافة فترة
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-[min(360px,88vw)] p-0 flex flex-col max-h-[70vh] bg-popover pointer-events-auto"
                      align="start"
                      dir="rtl"
                      onWheelCapture={(e) => e.stopPropagation()}
                    >
                      <div className="p-3 border-b bg-muted/30 shrink-0">
                        <p className="font-medium text-sm mb-2">اختر فترات</p>
                        {/* Tab buttons */}
                        <div className="flex gap-1">
                          <Button
                            variant={periodView === "weeks" ? "default" : "outline"}
                            size="sm"
                            className="flex-1 h-7 text-xs"
                            onClick={() => setPeriodView("weeks")}
                          >
                            📅 الأسابيع
                          </Button>
                          <Button
                            variant={periodView === "months" ? "default" : "outline"}
                            size="sm"
                            className="flex-1 h-7 text-xs"
                            onClick={() => setPeriodView("months")}
                          >
                            📆 الأشهر
                          </Button>
                          <Button
                            variant={periodView === "custom" ? "default" : "outline"}
                            size="sm"
                            className="flex-1 h-7 text-xs"
                            onClick={() => {
                              setPeriodView("custom");
                              setCheckedPeriodIds(new Set());
                            }}
                          >
                            📋 مخصص
                          </Button>
                        </div>
                      </div>

                      <div 
                        className="flex-1 overflow-y-auto overflow-x-hidden"
                        onWheelCapture={(e) => e.stopPropagation()}
                        style={{ 
                          overscrollBehavior: "contain",
                          WebkitOverflowScrolling: "touch"
                        }}
                      >
                        <div className="p-3 space-y-3 pb-6">
                          {periodView === "weeks" && (
                            <div className="space-y-2">
                              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                📅 الأسابيع
                                {weekOptions.filter(w => checkedPeriodIds.has(w.id)).length > 0 && (
                                  <Badge variant="secondary" className="text-[10px] h-4 px-1">
                                    {weekOptions.filter(w => checkedPeriodIds.has(w.id)).length}
                                  </Badge>
                                )}
                              </p>
                              <div className="space-y-1">
                                {weekOptions.map((week) => {
                                  const isAlreadyAdded = selectedPeriods.some((p) => p.id === week.id);
                                  return (
                                    <label
                                      key={week.id}
                                      className={cn(
                                        "flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors text-sm hover:bg-muted",
                                        checkedPeriodIds.has(week.id) && "bg-primary/10",
                                        isAlreadyAdded && "opacity-50 cursor-not-allowed",
                                      )}
                                    >
                                      <Checkbox
                                        checked={checkedPeriodIds.has(week.id) || isAlreadyAdded}
                                        disabled={isAlreadyAdded}
                                        onCheckedChange={() => !isAlreadyAdded && togglePeriodCheck(week.id)}
                                      />
                                      <span className="flex-1">{week.label}</span>
                                      <span className="text-xs text-muted-foreground">({week.dateRange})</span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {periodView === "months" && (
                            <div className="space-y-2">
                              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                📆 الأشهر
                                {monthOptions.filter(m => checkedPeriodIds.has(m.id)).length > 0 && (
                                  <Badge variant="secondary" className="text-[10px] h-4 px-1">
                                    {monthOptions.filter(m => checkedPeriodIds.has(m.id)).length}
                                  </Badge>
                                )}
                              </p>
                              <div className="space-y-1">
                                {monthOptions.map((month) => {
                                  const isAlreadyAdded = selectedPeriods.some((p) => p.id === month.id);
                                  return (
                                    <label
                                      key={month.id}
                                      className={cn(
                                        "flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors text-sm hover:bg-muted",
                                        checkedPeriodIds.has(month.id) && "bg-primary/10",
                                        isAlreadyAdded && "opacity-50 cursor-not-allowed",
                                      )}
                                    >
                                      <Checkbox
                                        checked={checkedPeriodIds.has(month.id) || isAlreadyAdded}
                                        disabled={isAlreadyAdded}
                                        onCheckedChange={() => !isAlreadyAdded && togglePeriodCheck(month.id)}
                                      />
                                      <span>{month.label}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {periodView === "custom" && (
                            <div className="space-y-3">
                              <p className="text-xs font-medium text-muted-foreground">📋 نطاق مخصص:</p>
                              <div className="space-y-2">
                                <Label className="text-xs">من:</Label>
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button
                                      variant="outline"
                                      className="w-full justify-start text-right font-normal text-sm"
                                    >
                                      {customDateFrom ? format(customDateFrom, "dd/MM/yyyy") : "اختر تاريخ"}
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-auto p-0 pointer-events-auto z-[100]" align="start">
                                    <CalendarPicker
                                      mode="single"
                                      selected={customDateFrom}
                                      onSelect={setCustomDateFrom}
                                      initialFocus
                                      className="pointer-events-auto"
                                    />
                                  </PopoverContent>
                                </Popover>
                              </div>
                              <div className="space-y-2">
                                <Label className="text-xs">إلى:</Label>
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button
                                      variant="outline"
                                      className="w-full justify-start text-right font-normal text-sm"
                                    >
                                      {customDateTo ? format(customDateTo, "dd/MM/yyyy") : "اختر تاريخ"}
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-auto p-0 pointer-events-auto z-[100]" align="start">
                                    <CalendarPicker
                                      mode="single"
                                      selected={customDateTo}
                                      onSelect={setCustomDateTo}
                                      initialFocus
                                      className="pointer-events-auto"
                                    />
                                  </PopoverContent>
                                </Popover>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="p-3 border-t bg-muted/30 space-y-2 shrink-0">
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => {
                              setShowPeriodPicker(false);
                              setPeriodView("weeks");
                              setCheckedPeriodIds(new Set());
                            }}
                          >
                            إلغاء
                          </Button>
                          <Button size="sm" className="flex-1" onClick={addCheckedPeriods}>
                            {periodView === "custom"
                              ? "إضافة"
                              : `إضافة${checkedPeriodIds.size > 0 ? ` (${checkedPeriodIds.size})` : ""}`}
                          </Button>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>

                  {selectedPeriods.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedPeriods.map((period) => (
                        <Badge key={period.id} variant="secondary" className="gap-1.5 py-1.5 px-3">
                          <span className="text-sm">{period.type === "custom" ? period.dateRange : period.label}</span>
                          {period.type !== "custom" && (
                            <span className="text-xs text-muted-foreground">({period.dateRange})</span>
                          )}
                          <button onClick={() => removePeriod(period.id)} className="mr-1 hover:text-destructive">
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}

                  {hasSelectedPeriod && selectedStudentId && (
                    <p className="text-sm text-muted-foreground mt-2">{matchingSessions.length} جلسة محددة</p>
                  )}
                </div>

                <Separator />

                <div className="space-y-3">
                  <Label className="text-sm">نوع التعديل</Label>

                  <Select value={modType} onValueChange={(v: ModificationType) => setModType(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="offset">تحويل بمقدار زمني</SelectItem>
                      <SelectItem value="day-change">تغيير اليوم والوقت</SelectItem>
                    </SelectContent>
                  </Select>

                  {modType === "offset" && (
                    <>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Select value={offsetDirection} onValueChange={(v: "+" | "-") => setOffsetDirection(v)}>
                        <SelectTrigger className="w-16">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="+">+</SelectItem>
                          <SelectItem value="-">-</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={String(offsetHours)} onValueChange={(v) => setOffsetHours(Number(v))}>
                        <SelectTrigger className="w-20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 13 }, (_, i) => (
                            <SelectItem key={i} value={String(i)}>
                              {i} ساعة
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={String(offsetMinutes)} onValueChange={(v) => setOffsetMinutes(Number(v))}>
                        <SelectTrigger className="w-20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[0, 15, 30, 45].map((m) => (
                            <SelectItem key={m} value={String(m)}>
                              {m} دقيقة
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Offset day filter */}
                    {selectedStudent && hasSelectedPeriod && availableDaysAndTimes.days.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-xs text-muted-foreground">تصفية حسب اليوم (اختياري):</p>
                        <div className="flex flex-wrap gap-1.5">
                          {availableDaysAndTimes.days.map(({ day, count }) => (
                            <Button
                              key={day}
                              variant={offsetDayFilter.includes(day) ? "default" : "outline"}
                              size="sm"
                              className="h-7 text-xs gap-1"
                              onClick={() => {
                                setOffsetDayFilter((prev) =>
                                  prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
                                );
                              }}
                            >
                              {DAY_OPTIONS.find((d) => d.value === day)?.label}
                              <span className="opacity-70">({count})</span>
                            </Button>
                          ))}
                        </div>
                        {offsetDayFilter.length > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs"
                            onClick={() => setOffsetDayFilter([])}
                          >
                            عرض الكل
                          </Button>
                        )}
                      </div>
                    )}
                    </>
                  )}

                  {modType === "day-change" && (
                    <div className="space-y-3">
                      {hasSelectedPeriod && selectedStudentId && availableDayTimeCombos.length === 0 && (
                        <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg text-center">
                          لا توجد جلسات مجدولة لـ {selectedName} في الفترات المختارة
                        </div>
                      )}

                      {availableDayTimeCombos.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground">
                            الجلسات المكتشفة ({availableDayTimeCombos.length} نوع):
                          </p>
                          <div className="space-y-3">
                            {dayChangeRules.map((rule) => (
                              <div
                                key={rule.id}
                                className={cn(
                                  "p-3 border rounded-lg space-y-2 transition-opacity",
                                  !rule.enabled && "opacity-50",
                                )}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                                    <Checkbox
                                      checked={rule.enabled}
                                      onCheckedChange={(checked) => {
                                        setDayChangeRules((prev) =>
                                          prev.map((r) => (r.id === rule.id ? { ...r, enabled: !!checked } : r)),
                                        );
                                      }}
                                    />
                                    {DAY_OPTIONS.find((d) => d.value === rule.originalDay)?.label}{" "}
                                    {formatTimeAr(rule.originalTime)}
                                  </label>
                                  <Badge variant="secondary" className="text-[10px]">
                                    {rule.sessionCount} جلسة
                                  </Badge>
                                </div>

                                {rule.enabled && (
                                  <>
                                    <div className="flex items-center justify-center">
                                      <ArrowDown className="h-3.5 w-3.5 text-muted-foreground" />
                                    </div>
                                    <div className="flex gap-2">
                                      <Select
                                        value={String(rule.newDay)}
                                        onValueChange={(v) => {
                                          setDayChangeRules((prev) =>
                                            prev.map((r) =>
                                              r.id === rule.id ? { ...r, newDay: Number(v) } : r,
                                            ),
                                          );
                                        }}
                                      >
                                        <SelectTrigger className="flex-1">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {DAY_OPTIONS.map((d) => (
                                            <SelectItem key={d.value} value={String(d.value)}>
                                              {d.label}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                      <span className="text-xs text-muted-foreground self-center">في</span>
                                      <Select
                                        value={rule.newTime}
                                        onValueChange={(v) => {
                                          setDayChangeRules((prev) =>
                                            prev.map((r) => (r.id === rule.id ? { ...r, newTime: v } : r)),
                                          );
                                        }}
                                      >
                                        <SelectTrigger className="w-28">
                                          <SelectValue>{formatTimeAr(rule.newTime)}</SelectValue>
                                        </SelectTrigger>
                                        <SelectContent>
                                          {TIME_OPTIONS.map((t) => (
                                            <SelectItem key={t} value={t}>
                                              {formatTimeAr(t)}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2 pt-4 border-t">
                <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>
                  إلغاء
                </Button>
                <Button className="flex-1 gap-1" onClick={handleShowPreview}>
                  معاينة
                  <ArrowDown className="h-4 w-4 -rotate-90" />
                </Button>
              </div>
            </div>
          )}

          {showPreview && !showSuccessDialog && (
            <>
              <div className="flex items-center gap-2 mb-3">
                <Button variant="ghost" size="sm" onClick={() => setShowPreview(false)}>
                  <ArrowDown className="h-4 w-4 rotate-90" />
                </Button>
                <span className="font-medium">المعاينة ({matchingSessions.length} جلسة)</span>
              </div>

              <div className="flex gap-3 mb-3 text-sm">
                <div className="flex items-center gap-1 text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>آمنة: {categorizedSessions.safe.length}</span>
                </div>
                <div className="flex items-center gap-1 text-yellow-600">
                  <AlertCircle className="h-4 w-4" />
                  <span>تحذيرات: {categorizedSessions.warnings.length}</span>
                </div>
                <div className="flex items-center gap-1 text-red-600">
                  <XCircle className="h-4 w-4" />
                  <span>تعارضات: {categorizedSessions.conflicts.length}</span>
                </div>
              </div>

              <div
                className="flex-1 min-h-0 -mx-6 px-6 overflow-y-auto overflow-x-hidden"
                style={{
                  overscrollBehavior: "contain",
                  WebkitOverflowScrolling: "touch",
                }}
              >
                <div className="space-y-4 pb-4">
                  {Object.entries(sessionsByWeek).map(([weekLabel, sessions]) => (
                    <div key={weekLabel} className="space-y-2">
                      <h4 className="text-sm font-medium text-muted-foreground border-b pb-1">{weekLabel}</h4>
                      <div className="space-y-2">
                        {sessions.map((sessionData) => {
                          const isConflict = categorizedSessions.conflicts.some(
                            (c) => c.session.id === sessionData.session.id,
                          );
                          const isWarning = categorizedSessions.warnings.some(
                            (w) => w.session.id === sessionData.session.id,
                          );

                          return (
                            <div
                              key={sessionData.session.id}
                              className={cn(
                                "p-3 rounded-lg border text-sm",
                                isConflict && "border-red-300 bg-red-50",
                                isWarning && "border-yellow-300 bg-yellow-50",
                                !isConflict && !isWarning && "border-green-300 bg-green-50",
                              )}
                            >
                              <div className="flex items-center gap-2 mb-1">
                                {isConflict ? (
                                  <XCircle className="h-4 w-4 text-red-600" />
                                ) : isWarning ? (
                                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                                ) : (
                                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                                )}
                                <span className="font-medium">{formatDateWithDay(sessionData.originalDate)}</span>
                              </div>

                              <div className="mr-6 text-muted-foreground">
                                {modType === "day-change" ? (
                                  <>
                                    <div>
                                      {formatDateWithDay(sessionData.originalDate)}،{" "}
                                      {formatTimeAr(sessionData.originalTime)}
                                    </div>
                                    <div className="my-1 text-primary">↓</div>
                                    <div>
                                      {formatDateWithDay(sessionData.newDate)}، {formatTimeAr(sessionData.newTime)}
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    {formatTimeAr(sessionData.originalTime)} → {formatTimeAr(sessionData.newTime)}
                                  </>
                                )}
                              </div>

                              {isWarning && (
                                <p className="text-xs text-yellow-700 mt-1 mr-6">تحذير: فاصل أقل من 30 دقيقة</p>
                              )}
                              {isConflict && (
                                <p className="text-xs text-red-700 mt-1 mr-6">تعارض: توجد جلسة أخرى في نفس الوقت</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-4 border-t">
                {categorizedSessions.conflicts.length > 0 && (
                  <p className="text-xs text-red-600 text-center">
                    لا يمكن تطبيق الجلسات المتعارضة ({categorizedSessions.conflicts.length})
                  </p>
                )}

                {categorizedSessions.warnings.length > 0 && categorizedSessions.safe.length > 0 && (
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => applyChanges(false)}>
                      تطبيق الآمنة فقط ({categorizedSessions.safe.length})
                    </Button>
                    <Button className="flex-1" onClick={() => applyChanges(true)}>
                      تطبيق الكل ({categorizedSessions.safe.length + categorizedSessions.warnings.length})
                    </Button>
                  </div>
                )}

                {categorizedSessions.warnings.length === 0 && categorizedSessions.safe.length > 0 && (
                  <Button className="w-full" onClick={() => applyChanges(false)}>
                    تطبيق التغييرات ({categorizedSessions.safe.length})
                  </Button>
                )}

                {categorizedSessions.safe.length === 0 && categorizedSessions.warnings.length > 0 && (
                  <Button className="w-full" onClick={() => applyChanges(true)}>
                    تطبيق مع التحذيرات ({categorizedSessions.warnings.length})
                  </Button>
                )}
              </div>
            </>
          )}

          {showSuccessDialog && (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>

              <div>
                <h3 className="text-lg font-medium">
                  ✓ تم تحديث {lastApplyResult.safe + lastApplyResult.warnings} جلسة
                </h3>
                <p className="text-sm text-muted-foreground mt-1">لـ {selectedName}</p>
              </div>

              {undoData && undoTimeLeft > 0 && (
                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="text-sm mb-2">يمكنك التراجع عن هذا التعديل</p>
                  <Button variant="outline" onClick={handleUndo} className="gap-1">
                    <Undo2 className="h-4 w-4" />
                    تراجع عن التغييرات
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2">متاح لمدة {formatUndoTimeLeft()}</p>
                </div>
              )}

              <Button
                variant="outline"
                onClick={() => {
                  resetForm();
                  setShowSuccessDialog(false);
                  setOpen(false);
                }}
              >
                إغلاق
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
