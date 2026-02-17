import React, { useState, useMemo, useCallback } from "react";
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  parseISO,
} from "date-fns";
import { ar } from "date-fns/locale";
import {
  ChevronRight,
  ChevronLeft,
  Calendar as CalendarIcon,
  GripVertical,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  DollarSign,
  User,
  Monitor,
  MapPin,
  Plus,
  Filter,
  Download,
  Printer,
  BarChart3,
  Users,
  X,
  Trash2,
  Sunrise,
  Sunset,
  Sun,
  Moon,
  TrendingUp,
  Zap,
  Coffee,
  Star,
  Phone,
  Pencil,
  Save,
  Sparkles,
  List,
  Grid3X3,
  Check,
  Ban,
  Lightbulb,
  Navigation2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Student, Session, AppSettings } from "@/types/student";
import { DAY_NAMES_SHORT_AR } from "@/lib/arabicConstants";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useConflictDetection } from "@/hooks/useConflictDetection";
import { useSchedulingSuggestions } from "@/hooks/useSchedulingSuggestions";
import { useGroups } from "@/hooks/useGroups";
import { StudentGroup, GroupSession } from "@/types/student";
import { GroupAttendanceDialog } from "@/components/GroupAttendanceDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface CalendarViewProps {
  students: Student[];
  settings?: AppSettings;
  onRescheduleSession: (studentId: string, sessionId: string, newDate: string) => void;
  onUpdateSessionDateTime?: (studentId: string, sessionId: string, newDate: string, newTime: string) => void;
  onToggleComplete?: (studentId: string, sessionId: string) => void;
  onCancelSession?: (studentId: string, sessionId: string, reason?: string) => void;
  onDeleteSession?: (studentId: string, sessionId: string) => void;
  onQuickPayment?: (studentId: string, sessionId: string, sessionDate: string) => void;
  onAddSession?: (studentId: string, date: string, time?: string) => void;
}

interface SessionWithStudent {
  session: Session;
  student: Student;
  // Group session fields
  isGroup?: boolean;
  group?: StudentGroup;
  groupSession?: GroupSession;
}
interface DragState {
  sessionId: string;
  studentId: string;
  studentName: string;
  originalDate: string;
  originalTime: string;
  isGroupSession?: boolean;
  groupId?: string;
}
interface ConflictInfo {
  hasConflict: boolean;
  conflictStudent?: string;
  conflictTime?: string;
  severity: "none" | "warning" | "error";
  gapMinutes?: number; // Gap in minutes between sessions
}

export const CalendarView = ({
  students,
  settings,
  onRescheduleSession,
  onUpdateSessionDateTime,
  onToggleComplete,
  onCancelSession,
  onDeleteSession,
  onQuickPayment,
  onAddSession,
}: CalendarViewProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"week" | "month">("week");
  const [mobileViewMode, setMobileViewMode] = useState<"grid" | "agenda">("agenda"); // Mobile-specific view
  const [selectedStudentFilter, setSelectedStudentFilter] = useState<string>("all");
  const [showWeeklySummary, setShowWeeklySummary] = useState(false);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dropTargetDate, setDropTargetDate] = useState<string | null>(null);

  // Get groups for calendar display
  const { activeGroups, getGroupSessionsForDate, updateMemberAttendance, completeGroupSession, rescheduleGroupSession, addGroupSessionForToday } = useGroups();

  // Get available slots from conflict detection hook - now includes groups for proper conflict detection
  const { getSuggestedSlots, checkConflict } = useConflictDetection(students, activeGroups);

  // Get scheduling suggestions based on selected student/group for location and time recommendations
  const getSchedulingSuggestionsForSelection = useCallback((studentId: string | null, groupId: string | null) => {
    if (studentId) {
      const student = students.find(s => s.id === studentId);
      if (student) {
        return {
          sessionType: student.sessionType,
          location: student.location,
        };
      }
    }
    if (groupId) {
      const group = activeGroups.find(g => g.id === groupId);
      if (group) {
        return {
          sessionType: group.sessionType,
          location: group.location,
        };
      }
    }
    return null;
  }, [students, activeGroups]);

  // Add Session Dialog State - supports both students and groups
  const [addSessionDialog, setAddSessionDialog] = useState<{
    open: boolean;
    date: string;
    selectedStudentId: string;
    selectedGroupId: string;
    time: string;
    sessionType: 'student' | 'group';
  } | null>(null);

  const [touchDragState, setTouchDragState] = useState<{
    active: boolean;
    startX: number;
    startY: number;
    sessionId: string;
    studentId: string;
    studentName: string;
    originalDate: string;
    originalTime: string;
    isGroupSession?: boolean;
    groupId?: string;
  } | null>(null);
  const longPressTimer = React.useRef<NodeJS.Timeout | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    sessionId: string;
    studentId: string;
    studentName: string;
    originalDate: string;
    originalTime: string;
    newDate: string;
    newTime: string;
    conflictInfo: ConflictInfo;
    isGroupSession?: boolean;
    groupId?: string;
  } | null>(null);
  const [sessionActionDialog, setSessionActionDialog] = useState<{
    open: boolean;
    session: Session;
    student: Student;
    isEditing?: boolean;
    editedDate?: string;
    editedTime?: string;
  } | null>(null);
  const [cancelConfirmDialog, setCancelConfirmDialog] = useState<{
    open: boolean;
    session: Session;
    student: Student;
  } | null>(null);
  const [completeConfirmDialog, setCompleteConfirmDialog] = useState<{
    open: boolean;
    session: Session;
    student: Student;
  } | null>(null);
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState<{
    open: boolean;
    session: Session;
    student: Student;
  } | null>(null);

  // Day details dialog - shows all sessions for a specific day
  const [dayDetailsDialog, setDayDetailsDialog] = useState<{
    open: boolean;
    date: string;
    sessions: SessionWithStudent[];
  } | null>(null);

  // Group session dialog - for viewing/editing group session attendance
  const [groupSessionDialog, setGroupSessionDialog] = useState<{
    open: boolean;
    group: StudentGroup;
    session: GroupSession;
  } | null>(null);

  // Filter students based on selection
  const filteredStudents = useMemo(() => {
    if (selectedStudentFilter === "all") return students;
    return students.filter((s) => s.id === selectedStudentFilter);
  }, [students, selectedStudentFilter]);

  const sessionsByDate = useMemo(() => {
    const map = new Map<string, SessionWithStudent[]>();

    // Add individual student sessions
    filteredStudents.forEach((student) => {
      student.sessions.forEach((session) => {
        const existing = map.get(session.date) || [];
        existing.push({ session, student });
        map.set(session.date, existing);
      });
    });

    // Add group sessions (only if viewing all students)
    if (selectedStudentFilter === "all") {
      activeGroups.forEach((group) => {
        group.sessions.forEach((groupSession) => {
          const existing = map.get(groupSession.date) || [];
          // Create a pseudo-student and session for display
          const pseudoStudent: Student = {
            id: `group_${group.id}`,
            name: group.name,
            sessionTime: group.sessionTime,
            sessionDuration: group.sessionDuration,
            sessionType: group.sessionType,
            scheduleDays: group.scheduleDays,
            semesterStart: group.semesterStart,
            semesterEnd: group.semesterEnd,
            sessions: [],
            createdAt: group.createdAt,
          };
          existing.push({
            session: groupSession,
            student: pseudoStudent,
            isGroup: true,
            group,
            groupSession,
          });
          map.set(groupSession.date, existing);
        });
      });
    }

    // Sort all sessions by time
    map.forEach((sessions) => {
      sessions.sort((a, b) => {
        const timeA = a.session.time || a.student.sessionTime;
        const timeB = b.session.time || b.student.sessionTime;
        return (timeA || "").localeCompare(timeB || "");
      });
    });
    return map;
  }, [filteredStudents, selectedStudentFilter, activeGroups]);

  const days = useMemo(() => {
    if (viewMode === "week") {
      const start = startOfWeek(currentDate, { weekStartsOn: 0 });
      const end = endOfWeek(currentDate, { weekStartsOn: 0 });
      return eachDayOfInterval({ start, end });
    } else {
      const start = startOfMonth(currentDate);
      const end = endOfMonth(currentDate);
      const monthDays = eachDayOfInterval({ start, end });
      const firstDayOfWeek = start.getDay();
      const paddingStart = [];
      for (let i = firstDayOfWeek - 1; i >= 0; i--) {
        const date = new Date(start);
        date.setDate(date.getDate() - (i + 1));
        paddingStart.push(date);
      }
      const lastDayOfWeek = end.getDay();
      const paddingEnd = [];
      for (let i = 1; i <= 6 - lastDayOfWeek; i++) {
        const date = new Date(end);
        date.setDate(date.getDate() + i);
        paddingEnd.push(date);
      }
      return [...paddingStart, ...monthDays, ...paddingEnd];
    }
  }, [currentDate, viewMode]);

  // Weekly/Monthly Summary Calculation
  const periodSummary = useMemo(() => {
    let totalSessions = 0;
    let completedSessions = 0;
    let cancelledSessions = 0;
    let scheduledSessions = 0;
    let vacationSessions = 0;
    let totalMinutes = 0;

    // Separate tracking for groups
    let groupTotalMembers = 0;
    let groupCompletedMembers = 0;
    let groupScheduledMembers = 0;
    let groupCancelledMembers = 0;
    let groupVacationMembers = 0;

    const studentStats = new Map<string, { name: string; sessions: number; hours: number; isGroup?: boolean }>();

    days.forEach((day) => {
      const dateStr = format(day, "yyyy-MM-dd");
      const isInCurrentPeriod = viewMode === "month" ? isSameMonth(day, currentDate) : true;

      if (isInCurrentPeriod) {
        const daySessions = sessionsByDate.get(dateStr) || [];
        daySessions.forEach(({ session, student, isGroup, group }) => {
          const duration = session.duration || student.sessionDuration || 60;

          if (isGroup && group) {
            // For group sessions, count each active member
            const activeMembers = group.members.filter(m => m.isActive);
            const groupSession = group.sessions.find(gs => gs.date === dateStr);

            activeMembers.forEach(member => {
              groupTotalMembers++;

              // Check member's individual attendance status
              const attendance = groupSession?.memberAttendance?.find(
                a => a.memberId === member.studentId
              );
              const memberStatus = attendance?.status || session.status;

              if (memberStatus === "completed") {
                groupCompletedMembers++;
                totalMinutes += duration;
              } else if (memberStatus === "cancelled") {
                groupCancelledMembers++;
              } else if (memberStatus === "vacation") {
                groupVacationMembers++;
              } else if (memberStatus === "scheduled") {
                groupScheduledMembers++;
                totalMinutes += duration;
              }
            });

            // Track group stats (as a single entry)
            const existing = studentStats.get(student.id) || { name: student.name, sessions: 0, hours: 0, isGroup: true };
            existing.sessions++;
            if (session.status !== "cancelled" && session.status !== "vacation") {
              existing.hours += duration / 60;
            }
            studentStats.set(student.id, existing);
          } else {
            // Individual sessions
            totalSessions++;

            if (session.status === "completed") {
              completedSessions++;
              totalMinutes += duration;
            } else if (session.status === "cancelled") {
              cancelledSessions++;
            } else if (session.status === "vacation") {
              vacationSessions++;
            } else if (session.status === "scheduled") {
              scheduledSessions++;
              totalMinutes += duration;
            }

            // Track per-student stats
            const existing = studentStats.get(student.id) || { name: student.name, sessions: 0, hours: 0 };
            existing.sessions++;
            if (session.status !== "cancelled" && session.status !== "vacation") {
              existing.hours += duration / 60;
            }
            studentStats.set(student.id, existing);
          }
        });
      }
    });

    // Combined totals (individual + group members)
    const combinedTotal = totalSessions + groupTotalMembers;
    const combinedCompleted = completedSessions + groupCompletedMembers;
    const combinedCancelled = cancelledSessions + groupCancelledMembers;
    const combinedVacation = vacationSessions + groupVacationMembers;
    const combinedScheduled = scheduledSessions + groupScheduledMembers;

    const totalHours = Math.round((totalMinutes / 60) * 10) / 10;

    // Completion rate: completed / (completed + scheduled) - excludes cancelled/vacation for meaningful rate
    const billableSessions = combinedCompleted + combinedScheduled;
    const completionRate = billableSessions > 0 ? Math.round((combinedCompleted / billableSessions) * 100) : 0;

    // Additional insights
    // Find busiest day
    let busiestDay = { date: "", count: 0 };
    const dayOfWeekStats = new Array(7).fill(0);
    const timeSlotStats = { morning: 0, afternoon: 0, evening: 0 };

    days.forEach((day) => {
      const dateStr = format(day, "yyyy-MM-dd");
      const isInCurrentPeriod = viewMode === "month" ? isSameMonth(day, currentDate) : true;
      if (!isInCurrentPeriod) return;

      const daySessions = sessionsByDate.get(dateStr) || [];

      // Count including group members
      let daySessionCount = 0;
      daySessions.forEach(({ isGroup, group }) => {
        if (isGroup && group) {
          daySessionCount += group.members.filter(m => m.isActive).length;
        } else {
          daySessionCount++;
        }
      });

      if (daySessionCount > busiestDay.count) {
        busiestDay = { date: dateStr, count: daySessionCount };
      }

      // Day of week distribution
      dayOfWeekStats[day.getDay()] += daySessionCount;

      // Time slot distribution
      daySessions.forEach(({ session, student, isGroup, group }) => {
        const time = session.time || student.sessionTime || "12:00";
        const hour = parseInt(time.split(":")[0]);
        const count = isGroup && group ? group.members.filter(m => m.isActive).length : 1;

        if (hour < 12) timeSlotStats.morning += count;
        else if (hour < 17) timeSlotStats.afternoon += count;
        else timeSlotStats.evening += count;
      });
    });

    // Find most popular day of week
    const dayNames = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
    const busiestDayOfWeek = dayOfWeekStats.indexOf(Math.max(...dayOfWeekStats));

    // Calculate actual days with sessions for better average
    const daysWithSessions = days.filter(day => {
      const dateStr = format(day, "yyyy-MM-dd");
      const isInCurrentPeriod = viewMode === "month" ? isSameMonth(day, currentDate) : true;
      return isInCurrentPeriod && (sessionsByDate.get(dateStr)?.length || 0) > 0;
    }).length;

    return {
      totalSessions: combinedTotal,
      completedSessions: combinedCompleted,
      cancelledSessions: combinedCancelled,
      vacationSessions: combinedVacation,
      scheduledSessions: combinedScheduled,
      totalHours,
      completionRate,
      studentStats: Array.from(studentStats.values()).sort((a, b) => b.sessions - a.sessions),
      busiestDay,
      busiestDayOfWeek: dayNames[busiestDayOfWeek],
      busiestDayOfWeekCount: dayOfWeekStats[busiestDayOfWeek],
      timeSlotStats,
      averageSessionsPerDay: daysWithSessions > 0 ? Math.round((combinedTotal / daysWithSessions) * 10) / 10 : 0,
      // Keep separate counts for display if needed
      privateSessions: totalSessions,
      groupMemberSessions: groupTotalMembers,
    };
  }, [days, sessionsByDate, currentDate, viewMode]);

  // Check if a session has ended (for showing Complete button only after session time has passed)
  const isSessionEnded = useCallback((sessionDate: string, sessionTime: string, sessionDuration: number = 60): boolean => {
    const now = new Date();
    const sessionDateObj = parseISO(sessionDate);

    // If session is in the past (before today), it has ended
    if (sessionDateObj < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
      return true;
    }

    // If session is in the future (after today), it has NOT ended
    if (sessionDateObj > new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
      return false;
    }

    // Session is today - check if current time is past the session end time
    if (!sessionTime) return false;

    const [sessionHour, sessionMin] = sessionTime.split(":").map(Number);
    const sessionEndMinutes = sessionHour * 60 + sessionMin + sessionDuration;
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    return currentMinutes >= sessionEndMinutes;
  }, []);

  // Get time of day icon and color
  const getTimeOfDayInfo = (time: string) => {
    const hour = parseInt(time?.split(":")[0] || "12");
    if (hour < 12) return { icon: Sunrise, color: "text-amber-500", label: "صباحاً" };
    if (hour < 17) return { icon: Sunset, color: "text-orange-500", label: "ظهراً" };
    return { icon: Moon, color: "text-indigo-500", label: "مساءً" };
  };

  const checkTimeConflict = useCallback(
    (studentId: string, sessionId: string, newDate: string, newTime: string): ConflictInfo => {
      const sessionsOnDate = sessionsByDate.get(newDate) || [];
      const sessionDuration = 60;
      if (!newTime) return { hasConflict: false, severity: "none" };
      const [newHour, newMin] = newTime.split(":").map(Number);
      const newStartMinutes = newHour * 60 + newMin;
      const newEndMinutes = newStartMinutes + sessionDuration;
      for (const { session, student, isGroup } of sessionsOnDate) {
        // Skip the session being edited
        if (session.id === sessionId) continue;
        // Skip cancelled and vacation sessions - they don't block time slots
        if (session.status === "cancelled" || session.status === "vacation") continue;
        const otherTime = session.time || student.sessionTime;
        if (!otherTime) continue;
        const [otherHour, otherMin] = otherTime.split(":").map(Number);
        const otherStartMinutes = otherHour * 60 + otherMin;
        const otherDuration = session.duration || student.sessionDuration || sessionDuration;
        const otherEndMinutes = otherStartMinutes + otherDuration;

        // Check for overlap (error)
        const hasOverlap =
          (newStartMinutes >= otherStartMinutes && newStartMinutes < otherEndMinutes) ||
          (newEndMinutes > otherStartMinutes && newEndMinutes <= otherEndMinutes) ||
          (newStartMinutes <= otherStartMinutes && newEndMinutes >= otherEndMinutes);
        if (hasOverlap) {
          const isSameStudent = student.id === studentId;
          const displayName = isGroup ? `👥 ${student.name}` : student.name;
          return {
            hasConflict: true,
            conflictStudent: isSameStudent ? `${displayName} (نفس الطالب)` : displayName,
            conflictTime: otherTime,
            severity: "error",
          };
        }

        // Calculate actual gap between sessions (end of first to start of second)
        let gapMinutes: number;
        if (newStartMinutes >= otherEndMinutes) {
          // New session is after the other session
          gapMinutes = newStartMinutes - otherEndMinutes;
        } else if (otherStartMinutes >= newEndMinutes) {
          // New session is before the other session
          gapMinutes = otherStartMinutes - newEndMinutes;
        } else {
          gapMinutes = 0; // Overlapping (shouldn't reach here)
        }

        // Warning if gap is less than 30 minutes
        if (gapMinutes < 30 && gapMinutes >= 0) {
          const isSameStudent = student.id === studentId;
          const displayName = isGroup ? `👥 ${student.name}` : student.name;
          return {
            hasConflict: false,
            conflictStudent: isSameStudent ? `${displayName} (نفس الطالب)` : displayName,
            conflictTime: otherTime,
            severity: "warning",
            gapMinutes,
          };
        }
      }
      return { hasConflict: false, severity: "none" };
    },
    [sessionsByDate],
  );

  const getDropTargetConflict = useCallback(
    (targetDate: string): ConflictInfo => {
      if (!dragState && !touchDragState?.active) return { hasConflict: false, severity: "none" };
      const state = dragState || touchDragState;
      if (!state) return { hasConflict: false, severity: "none" };
      return checkTimeConflict(state.studentId, state.sessionId, targetDate, state.originalTime);
    },
    [dragState, touchDragState, checkTimeConflict],
  );

  const goToPrev = () => {
    if (viewMode === "week") setCurrentDate(subWeeks(currentDate, 1));
    else setCurrentDate(subMonths(currentDate, 1));
  };
  const goToNext = () => {
    if (viewMode === "week") setCurrentDate(addWeeks(currentDate, 1));
    else setCurrentDate(addMonths(currentDate, 1));
  };
  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const handleDragStart = (
    e: React.DragEvent,
    sessionId: string,
    studentId: string,
    studentName: string,
    date: string,
    time: string,
    isGroupSession?: boolean,
    groupId?: string,
  ) => {
    e.dataTransfer.effectAllowed = "move";
    setDragState({ sessionId, studentId, studentName, originalDate: date, originalTime: time, isGroupSession, groupId });
  };
  const handleDragEnd = () => {
    setDragState(null);
    setDropTargetDate(null);
  };
  const handleDragOver = (e: React.DragEvent, dateStr: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropTargetDate(dateStr);
  };
  const handleDragLeave = () => {
    setDropTargetDate(null);
  };

  const handleTouchStart = useCallback(
    (e: React.TouchEvent, sessionId: string, studentId: string, studentName: string, date: string, time: string, isGroupSession?: boolean, groupId?: string) => {
      const touch = e.touches[0];
      longPressTimer.current = setTimeout(() => {
        setTouchDragState({
          active: true,
          startX: touch.clientX,
          startY: touch.clientY,
          sessionId,
          studentId,
          studentName,
          originalDate: date,
          originalTime: time,
          isGroupSession,
          groupId,
        });
        if (navigator.vibrate) navigator.vibrate(50);
        toast({ title: "اسحب الحصة", description: "حرك إصبعك لنقل الحصة إلى يوم آخر" });
      }, 500);
    },
    [],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
      if (!touchDragState?.active) return;
      const touch = e.touches[0];
      const element = document.elementFromPoint(touch.clientX, touch.clientY);
      const dayCell = element?.closest("[data-date]");
      if (dayCell) {
        const dateStr = dayCell.getAttribute("data-date");
        if (dateStr && dateStr !== touchDragState.originalDate) setDropTargetDate(dateStr);
      } else setDropTargetDate(null);
    },
    [touchDragState],
  );

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (!touchDragState?.active) {
      setTouchDragState(null);
      return;
    }
    if (dropTargetDate && dropTargetDate !== touchDragState.originalDate) {
      const conflictInfo = checkTimeConflict(
        touchDragState.studentId,
        touchDragState.sessionId,
        dropTargetDate,
        touchDragState.originalTime,
      );
      setConfirmDialog({
        open: true,
        sessionId: touchDragState.sessionId,
        studentId: touchDragState.studentId,
        studentName: touchDragState.studentName,
        originalDate: touchDragState.originalDate,
        originalTime: touchDragState.originalTime,
        newDate: dropTargetDate,
        newTime: touchDragState.originalTime,
        conflictInfo,
        isGroupSession: touchDragState.isGroupSession,
        groupId: touchDragState.groupId,
      });
    }
    setTouchDragState(null);
    setDropTargetDate(null);
  }, [touchDragState, dropTargetDate, checkTimeConflict]);

  const handleDrop = (e: React.DragEvent, newDate: string) => {
    e.preventDefault();
    setDropTargetDate(null);
    if (!dragState) return;
    if (dragState.originalDate === newDate) {
      setDragState(null);
      return;
    }
    const conflictInfo = checkTimeConflict(dragState.studentId, dragState.sessionId, newDate, dragState.originalTime);
    setConfirmDialog({
      open: true,
      sessionId: dragState.sessionId,
      studentId: dragState.studentId,
      studentName: dragState.studentName,
      originalDate: dragState.originalDate,
      originalTime: dragState.originalTime,
      newDate,
      newTime: dragState.originalTime,
      conflictInfo,
      isGroupSession: dragState.isGroupSession,
      groupId: dragState.groupId,
    });
    setDragState(null);
  };

  const updateConfirmDialogTime = (newTime: string) => {
    if (!confirmDialog) return;
    const conflictInfo = checkTimeConflict(
      confirmDialog.studentId,
      confirmDialog.sessionId,
      confirmDialog.newDate,
      newTime,
    );
    setConfirmDialog({ ...confirmDialog, newTime, conflictInfo });
  };

  const confirmReschedule = () => {
    if (!confirmDialog) return;
    if (confirmDialog.conflictInfo.hasConflict) {
      toast({
        title: "❌ لا يمكن نقل الحصة",
        description: `يوجد تعارض مع حصة ${confirmDialog.conflictInfo.conflictStudent} في نفس الوقت`,
        variant: "destructive",
      });
      return;
    }

    // Handle group session reschedule
    if (confirmDialog.isGroupSession && confirmDialog.groupId) {
      rescheduleGroupSession(
        confirmDialog.groupId,
        confirmDialog.sessionId,
        confirmDialog.newDate,
        confirmDialog.newTime
      );
    } else {
      // Handle individual session reschedule
      if (onUpdateSessionDateTime)
        onUpdateSessionDateTime(
          confirmDialog.studentId,
          confirmDialog.sessionId,
          confirmDialog.newDate,
          confirmDialog.newTime,
        );
      else onRescheduleSession(confirmDialog.studentId, confirmDialog.sessionId, confirmDialog.newDate);
    }

    toast({
      title: "✓ تم تعديل موعد الحصة",
      description: `تم نقل حصة ${confirmDialog.studentName} من ${format(parseISO(confirmDialog.originalDate), "dd/MM")} الساعة ${confirmDialog.originalTime} إلى ${format(parseISO(confirmDialog.newDate), "dd/MM")} الساعة ${confirmDialog.newTime}`,
    });
    setConfirmDialog(null);
  };

  const handleSessionClick = (e: React.MouseEvent, session: Session, student: Student) => {
    if (dragState || touchDragState?.active) return;
    e.stopPropagation();
    setSessionActionDialog({ open: true, session, student });
  };

  const handleCompleteClick = () => {
    if (!sessionActionDialog) return;
    setSessionActionDialog(null);
    setCompleteConfirmDialog({
      open: true,
      session: sessionActionDialog.session,
      student: sessionActionDialog.student,
    });
  };

  const confirmComplete = () => {
    if (!completeConfirmDialog || !onToggleComplete) return;
    onToggleComplete(completeConfirmDialog.student.id, completeConfirmDialog.session.id);
    setCompleteConfirmDialog(null);
  };

  const handleCancelClick = () => {
    if (!sessionActionDialog) return;
    setSessionActionDialog(null);
    setCancelConfirmDialog({ open: true, session: sessionActionDialog.session, student: sessionActionDialog.student });
  };

  const confirmCancel = () => {
    if (!cancelConfirmDialog || !onCancelSession) return;
    const reason = prompt("سبب الإلغاء (اختياري):");
    onCancelSession(cancelConfirmDialog.student.id, cancelConfirmDialog.session.id, reason || undefined);
    setCancelConfirmDialog(null);
  };

  const handleDeleteClick = () => {
    if (!sessionActionDialog) return;
    setSessionActionDialog(null);
    setDeleteConfirmDialog({ open: true, session: sessionActionDialog.session, student: sessionActionDialog.student });
  };

  const confirmDelete = () => {
    if (!deleteConfirmDialog || !onDeleteSession) return;
    onDeleteSession(deleteConfirmDialog.student.id, deleteConfirmDialog.session.id);
    setDeleteConfirmDialog(null);
    toast({
      title: "✓ تم حذف الحصة",
      description: `تم حذف حصة ${deleteConfirmDialog.student.name} نهائياً`,
    });
  };

  const handlePaymentClick = () => {
    if (!sessionActionDialog || !onQuickPayment) return;
    const { session, student } = sessionActionDialog;
    setSessionActionDialog(null);
    onQuickPayment(student.id, session.id, session.date);
  };

  // Handle starting date/time edit in session action dialog
  const handleStartEdit = () => {
    if (!sessionActionDialog) return;
    const currentTime = sessionActionDialog.session.time || sessionActionDialog.student.sessionTime || "16:00";
    const currentDate = sessionActionDialog.session.date;
    setSessionActionDialog({
      ...sessionActionDialog,
      isEditing: true,
      editedDate: currentDate,
      editedTime: currentTime,
    });
  };

  const handleDateEditChange = (newDate: string) => {
    if (!sessionActionDialog) return;
    setSessionActionDialog({
      ...sessionActionDialog,
      editedDate: newDate,
    });
  };

  const handleTimeEditChange = (newTime: string) => {
    if (!sessionActionDialog) return;
    setSessionActionDialog({
      ...sessionActionDialog,
      editedTime: newTime,
    });
  };

  const handleSaveEdit = () => {
    if (!sessionActionDialog || !sessionActionDialog.editedTime || !sessionActionDialog.editedDate || !onUpdateSessionDateTime) return;

    const { session, student, editedTime, editedDate } = sessionActionDialog;
    const originalTime = session.time || student.sessionTime || "16:00";
    const originalDate = session.date;

    // Check for conflicts
    const conflictInfo = checkTimeConflict(student.id, session.id, editedDate, editedTime);

    if (conflictInfo.hasConflict) {
      toast({
        title: "❌ لا يمكن تغيير الموعد",
        description: `يوجد تعارض مع حصة ${conflictInfo.conflictStudent} في ${conflictInfo.conflictTime}`,
        variant: "destructive",
      });
      return;
    }

    if (conflictInfo.severity === "warning") {
      // Show warning but allow
      toast({
        title: "⚠️ تحذير",
        description: `الحصة قريبة جداً من حصة ${conflictInfo.conflictStudent} (${conflictInfo.conflictTime})`,
      });
    }

    // Save the new date and time
    onUpdateSessionDateTime(student.id, session.id, editedDate, editedTime);

    const dateChanged = originalDate !== editedDate;
    const timeChanged = originalTime !== editedTime;

    let description = "";
    if (dateChanged && timeChanged) {
      description = `تم تغيير موعد حصة ${student.name} من ${format(parseISO(originalDate), "dd/MM")} الساعة ${originalTime} إلى ${format(parseISO(editedDate), "dd/MM")} الساعة ${editedTime}`;
    } else if (dateChanged) {
      description = `تم تغيير تاريخ حصة ${student.name} من ${format(parseISO(originalDate), "dd/MM")} إلى ${format(parseISO(editedDate), "dd/MM")}`;
    } else if (timeChanged) {
      description = `تم تغيير وقت حصة ${student.name} من ${originalTime} إلى ${editedTime}`;
    } else {
      description = "لم يتم إجراء أي تغييرات";
    }

    toast({
      title: "✓ تم تعديل الموعد",
      description,
    });

    setSessionActionDialog(null);
  };

  const handleCancelEdit = () => {
    if (!sessionActionDialog) return;
    setSessionActionDialog({
      ...sessionActionDialog,
      isEditing: false,
      editedDate: undefined,
      editedTime: undefined,
    });
  };

  // Add new session with conflict check - supports both students and groups
  const handleAddNewSession = async () => {
    if (!addSessionDialog) return;

    const isGroupSession = addSessionDialog.sessionType === 'group';

    // Validate selection
    if (isGroupSession) {
      if (!addSessionDialog.selectedGroupId) {
        toast({ title: "❌ خطأ", description: "يرجى اختيار مجموعة", variant: "destructive" });
        return;
      }
    } else {
      if (!addSessionDialog.selectedStudentId || !onAddSession) {
        toast({ title: "❌ خطأ", description: "يرجى اختيار طالب", variant: "destructive" });
        return;
      }
    }

    // Check for conflicts before adding using the improved checkConflict
    if (addSessionDialog.time) {
      const sessionId = isGroupSession ? `group_${addSessionDialog.selectedGroupId}` : addSessionDialog.selectedStudentId;

      const conflict = checkConflict(
        { date: addSessionDialog.date, startTime: addSessionDialog.time },
        undefined, // No session to exclude
        sessionId
      );

      if (conflict.severity === "error") {
        const firstConflict = conflict.conflicts[0];
        toast({
          title: "❌ لا يمكن إضافة الحصة",
          description: firstConflict?.messageAr || "يوجد تعارض في الوقت",
          variant: "destructive",
        });
        return;
      }

      if (conflict.severity === "warning") {
        const firstConflict = conflict.conflicts[0];
        toast({
          title: "⚠️ تحذير",
          description: firstConflict?.messageAr || "الحصة قريبة من حصة أخرى",
        });
      }
    }

    // Add the session
    if (isGroupSession) {
      // Check if group already has a session on this date
      const group = activeGroups.find(g => g.id === addSessionDialog.selectedGroupId);
      if (group) {
        const existingSession = group.sessions.find(s => s.date === addSessionDialog.date);
        if (existingSession) {
          toast({
            title: "❌ لا يمكن إضافة الحصة",
            description: `يوجد حصة بالفعل لمجموعة ${group.name} في هذا اليوم`,
            variant: "destructive",
          });
          return;
        }

        await addGroupSessionForToday(addSessionDialog.selectedGroupId, addSessionDialog.time || undefined);
        toast({
          title: "✓ تمت إضافة حصة المجموعة",
          description: `تمت إضافة حصة لمجموعة ${group.name} في ${format(parseISO(addSessionDialog.date), "dd/MM/yyyy", { locale: ar })}`,
        });
      }
    } else {
      onAddSession(addSessionDialog.selectedStudentId, addSessionDialog.date, addSessionDialog.time || undefined);
      const student = students.find(s => s.id === addSessionDialog.selectedStudentId);
      toast({
        title: "✓ تمت إضافة الحصة",
        description: `تمت إضافة حصة ${student?.name || ''} في ${format(parseISO(addSessionDialog.date), "dd/MM/yyyy", { locale: ar })}`,
      });
    }

    setAddSessionDialog(null);
  };

  // Export to text/clipboard
  const handleExport = (type: "copy" | "print") => {
    const periodLabel =
      viewMode === "week"
        ? `${format(days[0], "dd MMM", { locale: ar })} - ${format(days[days.length - 1], "dd MMM yyyy", { locale: ar })}`
        : format(currentDate, "MMMM yyyy", { locale: ar });

    let exportText = `📅 تقرير التقويم - ${periodLabel}\n`;
    exportText += `${"═".repeat(40)}\n\n`;

    exportText += `📊 ملخص الفترة:\n`;
    exportText += `• إجمالي الحصص: ${periodSummary.totalSessions}\n`;
    exportText += `• المكتملة: ${periodSummary.completedSessions}\n`;
    exportText += `• الملغاة: ${periodSummary.cancelledSessions}\n`;
    exportText += `• الإجازات: ${periodSummary.vacationSessions}\n`;
    exportText += `• المجدولة: ${periodSummary.scheduledSessions}\n`;
    exportText += `• إجمالي الساعات: ${periodSummary.totalHours} ساعة\n`;
    exportText += `• نسبة الإنجاز: ${periodSummary.completionRate}%\n\n`;

    exportText += `📋 تفاصيل الحصص:\n`;
    exportText += `${"─".repeat(40)}\n`;

    days.forEach((day) => {
      const dateStr = format(day, "yyyy-MM-dd");
      const isInCurrentPeriod = viewMode === "month" ? isSameMonth(day, currentDate) : true;
      if (!isInCurrentPeriod) return;

      const daySessions = sessionsByDate.get(dateStr) || [];
      if (daySessions.length === 0) return;

      exportText += `\n📆 ${format(day, "EEEE dd/MM/yyyy", { locale: ar })}\n`;
      daySessions.forEach(({ session, student }) => {
        const time = session.time || student.sessionTime;
        const status = getStatusLabel(session.status);
        exportText += `   • ${time} - ${student.name} (${status})\n`;
      });
    });

    if (type === "copy") {
      navigator.clipboard.writeText(exportText);
      toast({
        title: "✓ تم النسخ",
        description: "تم نسخ التقرير إلى الحافظة",
      });
    } else {
      // Print
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(`
          <html dir="rtl" lang="ar">
            <head>
              <title>تقرير التقويم - ${periodLabel}</title>
              <style>
                body { font-family: 'Cairo', 'Tajawal', Arial, sans-serif; padding: 20px; line-height: 1.8; }
                pre { white-space: pre-wrap; font-family: inherit; }
              </style>
            </head>
            <body><pre>${exportText}</pre></body>
          </html>
        `);
        printWindow.document.close();
        printWindow.print();
      }
    }
  };

  const getStatusColor = (status: Session["status"]) => {
    switch (status) {
      case "completed":
        return "bg-primary/20 text-primary dark:text-primary border-primary/40 hover:bg-primary/30";
      case "cancelled":
        return "bg-muted text-muted-foreground dark:text-muted-foreground border-border hover:bg-muted/80";
      case "vacation":
        return "bg-secondary text-secondary-foreground dark:text-secondary-foreground border-border hover:bg-secondary/80";
      default:
        return "bg-primary/10 text-primary dark:text-primary border-primary/30 hover:bg-primary/20";
    }
  };

  const getStatusLabel = (status: Session["status"]) => {
    switch (status) {
      case "completed":
        return "مكتملة";
      case "cancelled":
        return "ملغاة";
      case "vacation":
        return "إجازة";
      default:
        return "مجدولة";
    }
  };

  const getStatusBadgeColor = (status: Session["status"]) => {
    switch (status) {
      case "completed":
        return "bg-primary text-primary-foreground";
      case "cancelled":
        return "bg-muted text-muted-foreground";
      case "vacation":
        return "bg-secondary text-secondary-foreground";
      default:
        return "bg-primary/80 text-primary-foreground";
    }
  };

  const today = new Date();

  // Handle day click to show all sessions
  const handleDayClick = (dateStr: string, sessions: SessionWithStudent[]) => {
    if (dragState || touchDragState?.active) return;
    setDayDetailsDialog({
      open: true,
      date: dateStr,
      sessions,
    });
  };

  return (
    <Card className="w-full border shadow-lg overflow-hidden">
      <CardHeader className="space-y-2 sm:space-y-4 p-2 sm:p-4 bg-gradient-to-br from-primary/5 via-background to-background border-b">
        {/* Header Row - Compact on mobile */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 sm:p-2 rounded-lg bg-gradient-to-br from-primary to-purple-500 text-white shadow-md">
              <CalendarIcon className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-xl font-display font-bold text-foreground">التقويم</h2>
              <p className="text-[0.6rem] sm:text-xs text-muted-foreground font-medium">
                {periodSummary.totalSessions} حصة
              </p>
            </div>
          </div>

          {/* Action Buttons - Minimal on mobile */}
          <div className="flex items-center gap-1">
            {/* Student Filter - Compact */}
            <Select value={selectedStudentFilter} onValueChange={setSelectedStudentFilter}>
              <SelectTrigger className="w-auto min-w-[80px] sm:w-[140px] h-7 sm:h-9 rounded-lg border text-xs sm:text-sm px-2">
                <Filter className="h-3 w-3 ml-1 text-muted-foreground hidden sm:block" />
                <SelectValue placeholder="الكل" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الكل</SelectItem>
                {students.map((student) => (
                  <SelectItem key={student.id} value={student.id}>{student.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Summary Toggle - Icon only on mobile */}
            <Button
              variant={showWeeklySummary ? "default" : "outline"}
              size="sm"
              onClick={() => setShowWeeklySummary(!showWeeklySummary)}
              className="h-7 sm:h-9 w-7 sm:w-auto sm:px-3 rounded-lg"
            >
              <BarChart3 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline mr-1">ملخص</span>
            </Button>
          </div>
        </div>

        {/* Weekly Summary Panel - Simplified on mobile */}
        {showWeeklySummary && (
          <div className="space-y-2 p-2 sm:p-4 rounded-lg bg-muted/30 border">
            {/* Main Stats Row - 4 cols on desktop, wrap on mobile */}
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5 sm:gap-3">
              <div className="text-center p-1.5 sm:p-3 rounded-lg bg-primary/10">
                <p className="text-base sm:text-2xl font-bold text-primary tabular-nums">{periodSummary.totalSessions}</p>
                <p className="text-[0.55rem] sm:text-xs text-muted-foreground">
                  حصص
                  {periodSummary.groupMemberSessions > 0 && (
                    <span className="text-violet-600 block text-[0.5rem]">
                      ({periodSummary.privateSessions}+{periodSummary.groupMemberSessions}👥)
                    </span>
                  )}
                </p>
              </div>
              <div className="text-center p-1.5 sm:p-3 rounded-lg bg-primary/15">
                <p className="text-base sm:text-2xl font-bold text-primary tabular-nums">{periodSummary.completedSessions}</p>
                <p className="text-[0.55rem] sm:text-xs text-muted-foreground">مكتملة</p>
              </div>
              <div className="text-center p-1.5 sm:p-3 rounded-lg bg-muted/50 hidden sm:block">
                <p className="text-base sm:text-2xl font-bold text-muted-foreground tabular-nums">{periodSummary.cancelledSessions}</p>
                <p className="text-[0.55rem] sm:text-xs text-muted-foreground">ملغاة</p>
              </div>
              <div className="text-center p-1.5 sm:p-3 rounded-lg bg-secondary/50 hidden sm:block">
                <p className="text-base sm:text-2xl font-bold text-secondary-foreground tabular-nums">{periodSummary.vacationSessions}</p>
                <p className="text-[0.55rem] sm:text-xs text-muted-foreground">إجازة</p>
              </div>
              <div className="text-center p-1.5 sm:p-3 rounded-lg bg-primary/8">
                <p className="text-base sm:text-2xl font-bold text-primary tabular-nums">{periodSummary.totalHours}</p>
                <p className="text-[0.55rem] sm:text-xs text-muted-foreground">ساعة</p>
              </div>
              <div className="text-center p-1.5 sm:p-3 rounded-lg bg-primary/5">
                <p className="text-base sm:text-2xl font-bold text-primary tabular-nums">{periodSummary.completionRate}%</p>
                <p className="text-[0.55rem] sm:text-xs text-muted-foreground">إنجاز</p>
              </div>
            </div>

            {/* Progress Bar */}
            {periodSummary.totalSessions > 0 && (
              <Progress value={periodSummary.completionRate} className="h-1.5 sm:h-2" />
            )}
          </div>
        )}

        {/* View Mode Toggle - Compact */}
        <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg w-fit">
          {[
            { value: "week", label: "أسبوع" },
            { value: "month", label: "شهر" },
          ].map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setViewMode(value as "week" | "month")}
              className={cn(
                "px-2 sm:px-4 py-1 sm:py-1.5 rounded-md text-xs sm:text-sm font-semibold transition-all",
                viewMode === value ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:bg-background/50"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Navigation Bar - Compact */}
        <div className="flex items-center justify-between bg-background/80 p-1.5 sm:p-3 rounded-lg border">
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={goToNext} className="h-7 w-7 sm:h-9 sm:w-9 p-0 rounded-lg">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={goToPrev} className="h-7 w-7 sm:h-9 sm:w-9 p-0 rounded-lg">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
          <h3 className="font-display font-bold text-xs sm:text-base text-center px-2 py-1 bg-primary/5 rounded-lg">
            {viewMode === "week"
              ? `${format(days[0], "dd/MM", { locale: ar })} - ${format(days[days.length - 1], "dd/MM", { locale: ar })}`
              : format(currentDate, "MMM yyyy", { locale: ar })}
          </h3>
          <Button variant="outline" size="sm" onClick={goToToday} className="h-7 sm:h-9 px-2 sm:px-3 rounded-lg text-xs sm:text-sm font-medium">
            اليوم
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-1.5 sm:p-4">
        {/* Filter indicator - compact */}
        {selectedStudentFilter !== "all" && (
          <div className="mb-2 p-1.5 sm:p-2 rounded-lg bg-primary/5 border border-primary/20 flex items-center justify-between text-xs">
            <span className="font-medium truncate">
              {students.find((s) => s.id === selectedStudentFilter)?.name}
            </span>
            <Button variant="ghost" size="sm" onClick={() => setSelectedStudentFilter("all")} className="h-5 px-1.5 text-[0.6rem]">
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}

        {/* Mobile View Toggle - Only visible on mobile */}
        <div className="flex sm:hidden items-center justify-between mb-3">
          <div className="flex items-center gap-1 bg-muted/50 p-0.5 rounded-lg">
            <button
              onClick={() => setMobileViewMode('agenda')}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all",
                mobileViewMode === 'agenda' ? "bg-background text-primary shadow-sm" : "text-muted-foreground"
              )}
            >
              <List className="h-3.5 w-3.5" />
              قائمة
            </button>
            <button
              onClick={() => setMobileViewMode('grid')}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all",
                mobileViewMode === 'grid' ? "bg-background text-primary shadow-sm" : "text-muted-foreground"
              )}
            >
              <Grid3X3 className="h-3.5 w-3.5" />
              شبكة
            </button>
          </div>
          <span className="text-xs text-muted-foreground">
            {days.filter(d => (sessionsByDate.get(format(d, "yyyy-MM-dd")) || []).length > 0).length} أيام بحصص
          </span>
        </div>

        {/* Mobile Agenda View - Better for small screens */}
        <div className={cn("sm:hidden", mobileViewMode === 'agenda' ? "block" : "hidden")}>
          <div className="space-y-3">
            {days.map((day) => {
              const dateStr = format(day, "yyyy-MM-dd");
              const daySessions = sessionsByDate.get(dateStr) || [];
              const isToday = isSameDay(day, today);
              const isCurrentMonth = viewMode === "month" ? isSameMonth(day, currentDate) : true;

              // Skip days with no sessions in agenda view (except today)
              if (daySessions.length === 0 && !isToday) return null;
              if (!isCurrentMonth) return null;

              return (
                <div
                  key={dateStr}
                  className={cn(
                    "rounded-xl border-2 overflow-hidden transition-all",
                    isToday && "ring-2 ring-primary border-primary shadow-lg"
                  )}
                >
                  {/* Day Header */}
                  <div
                    className={cn(
                      "flex items-center justify-between p-3 cursor-pointer",
                      isToday
                        ? "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground"
                        : "bg-muted/50 hover:bg-muted/70"
                    )}
                    onClick={() => handleDayClick(dateStr, daySessions)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-lg flex flex-col items-center justify-center font-bold",
                        isToday ? "bg-white/20" : "bg-background"
                      )}>
                        <span className="text-lg leading-none">{format(day, "d")}</span>
                        <span className="text-[10px] opacity-70">{format(day, "EEE", { locale: ar })}</span>
                      </div>
                      <div>
                        <p className={cn("font-bold text-sm", isToday && "text-primary-foreground")}>
                          {format(day, "EEEE", { locale: ar })}
                        </p>
                        <p className={cn("text-xs", isToday ? "text-primary-foreground/70" : "text-muted-foreground")}>
                          {format(day, "d MMMM", { locale: ar })}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant={isToday ? "secondary" : "outline"}
                      className={cn(
                        "font-bold",
                        isToday && "bg-white/20 text-white border-0",
                        daySessions.length === 0 && "opacity-50"
                      )}
                    >
                      {daySessions.length} {daySessions.length === 1 ? 'حصة' : 'حصص'}
                    </Badge>
                  </div>

                  {/* Sessions List */}
                  {daySessions.length > 0 ? (
                    <div className="divide-y divide-border/50">
                      {daySessions.map(({ session, student, isGroup, group, groupSession }) => {
                        const time = session.time || student.sessionTime;
                        const timeInfo = getTimeOfDayInfo(time || "12:00");
                        const TimeIcon = timeInfo.icon;
                        const isCompleted = session.status === "completed";
                        const isCancelled = session.status === "cancelled";
                        const isScheduled = session.status === "scheduled";
                        const canComplete = isScheduled && isSessionEnded(
                          session.date,
                          time || "16:00",
                          session.duration || student.sessionDuration || 60
                        );
                        const memberCount = isGroup && group ? group.members.filter(m => m.isActive).length : 0;

                        return (
                          <div
                            key={session.id}
                            className={cn(
                              "flex items-center gap-3 p-3 transition-all cursor-pointer",
                              isCompleted && "bg-primary/5",
                              isCancelled && "bg-muted/30 opacity-60",
                              isGroup && "bg-violet-50 dark:bg-violet-950/20 hover:bg-violet-100 dark:hover:bg-violet-950/40"
                            )}
                            onClick={() => {
                              if (isGroup && group && groupSession) {
                                setGroupSessionDialog({ open: true, group, session: groupSession });
                              } else {
                                setSessionActionDialog({ open: true, session, student });
                              }
                            }}
                          >
                            {/* Time Column */}
                            <div className={cn(
                              "min-w-[55px] text-center p-2 rounded-lg",
                              isCompleted ? "bg-primary/10" : isCancelled ? "bg-muted" : isGroup ? "bg-violet-100 dark:bg-violet-900/30" : "bg-primary/5"
                            )}>
                              {isGroup ? (
                                <Users className="h-4 w-4 mx-auto mb-0.5 text-violet-600 dark:text-violet-400" />
                              ) : (
                                <TimeIcon className={cn("h-4 w-4 mx-auto mb-0.5", timeInfo.color)} />
                              )}
                              <p className={cn(
                                "text-sm font-bold",
                                isCompleted ? "text-primary" : isCancelled ? "text-muted-foreground" : isGroup ? "text-violet-700 dark:text-violet-300" : "text-foreground"
                              )}>
                                {time}
                              </p>
                            </div>

                            {/* Student/Group Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className={cn(
                                  "font-semibold truncate",
                                  isCancelled && "line-through",
                                  isGroup && "text-violet-700 dark:text-violet-300"
                                )}>
                                  {isGroup ? `👥 ${student.name}` : student.name}
                                </p>
                                {isGroup ? (
                                  <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-violet-300 text-violet-600 bg-violet-50 dark:bg-violet-900/30 dark:border-violet-700 dark:text-violet-300">
                                    {memberCount} طالب
                                  </Badge>
                                ) : student.sessionType === "online" ? (
                                  <Monitor className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                ) : (
                                  <MapPin className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-[10px] h-5 px-1.5",
                                    isCompleted && "border-primary/30 text-primary bg-primary/5",
                                    isCancelled && "border-muted text-muted-foreground",
                                    isScheduled && !isGroup && "border-primary/20 text-primary/80",
                                    isScheduled && isGroup && "border-violet-300 text-violet-600 dark:border-violet-700 dark:text-violet-400"
                                  )}
                                >
                                  {isCompleted ? "✓ مكتملة" : isCancelled ? "✗ ملغاة" : isGroup ? "👥 مجموعة" : "⏰ مجدولة"}
                                </Badge>
                                <span className="text-[10px] text-muted-foreground">
                                  {session.duration || student.sessionDuration || 60} د
                                </span>
                                {isGroup && group && (
                                  <span className="text-[10px] text-violet-500">
                                    {group.sessionType === 'online' ? '💻' : '🏠'}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Quick Actions */}
                            {isScheduled && !isGroup && (
                              <div className="flex items-center gap-1 shrink-0">
                                {canComplete && onToggleComplete && (
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-primary hover:bg-primary/10"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setCompleteConfirmDialog({ open: true, session, student });
                                    }}
                                  >
                                    <Check className="h-4 w-4" />
                                  </Button>
                                )}
                                {onCancelSession && (
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-muted-foreground hover:bg-muted"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setCancelConfirmDialog({ open: true, session, student });
                                    }}
                                  >
                                    <Ban className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-4 text-center text-muted-foreground text-sm">
                      لا توجد حصص
                      {onAddSession && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="mt-2 w-full text-primary"
                          onClick={() => setAddSessionDialog({
                            open: true,
                            date: dateStr,
                            selectedStudentId: "",
                            selectedGroupId: "",
                            time: "",
                            sessionType: 'student',
                          })}
                        >
                          <Plus className="h-4 w-4 ml-1" />
                          إضافة حصة
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Show message if no days have sessions */}
            {days.filter(d => {
              const dateStr = format(d, "yyyy-MM-dd");
              const daySessions = sessionsByDate.get(dateStr) || [];
              const isToday = isSameDay(d, today);
              const isCurrentMonth = viewMode === "month" ? isSameMonth(d, currentDate) : true;
              return (daySessions.length > 0 || isToday) && isCurrentMonth;
            }).length === 0 && (
              <div className="py-12 text-center text-muted-foreground">
                <CalendarIcon className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">لا توجد حصص في هذه الفترة</p>
              </div>
            )}
          </div>
        </div>

        {/* Desktop Grid View & Mobile Grid View (when selected) */}
        <div className={cn("sm:block", mobileViewMode === 'grid' ? "block" : "hidden sm:block")}>
          <div className="grid gap-0.5 sm:gap-2 grid-cols-7">
            {DAY_NAMES_SHORT_AR.map((day, i) => (
              <div key={i} className="text-center text-[0.55rem] sm:text-xs font-bold text-muted-foreground py-1 sm:py-2 bg-muted/30 rounded-md">
                {day.slice(0, 1)}
              </div>
            ))}
            {days.map((day, index) => {
              const dateStr = format(day, "yyyy-MM-dd");
              const daySessions = sessionsByDate.get(dateStr) || [];
              const isCurrentMonth = viewMode === "month" ? isSameMonth(day, currentDate) : true;
              const isToday = isSameDay(day, today);
              const isDragging = dragState !== null || touchDragState?.active;
              const isDropTarget =
                dropTargetDate === dateStr &&
                dragState?.originalDate !== dateStr &&
                touchDragState?.originalDate !== dateStr;
              const dropConflict = isDropTarget ? getDropTargetConflict(dateStr) : null;
              const hasDropConflict = dropConflict?.hasConflict;
              const hasDropWarning = dropConflict?.severity === "warning";

              return (
                <div
                  key={index}
                  data-date={dateStr}
                  className={cn(
                    "border-2 rounded-xl p-2 sm:p-3 transition-all duration-200 touch-manipulation relative flex flex-col",
                    viewMode === "week"
                      ? "min-h-[160px] sm:min-h-[200px] max-h-[300px] sm:max-h-[400px]"
                      : "min-h-[100px] sm:min-h-[140px] max-h-[180px] sm:max-h-[220px]",
                    !isCurrentMonth && "opacity-40 bg-muted/20",
                    isToday && "ring-2 ring-primary shadow-lg bg-primary/5",
                    isDropTarget && hasDropConflict && "bg-rose-500/20 border-rose-500 border-dashed scale-105 shadow-xl",
                    isDropTarget &&
                      hasDropWarning &&
                      "bg-amber-500/20 border-amber-500 border-dashed scale-105 shadow-xl",
                    isDropTarget &&
                      !hasDropConflict &&
                      !hasDropWarning &&
                      "bg-gradient-to-br from-primary/20 to-primary/5 border-primary border-dashed scale-105 shadow-xl",
                    touchDragState?.active && "select-none",
                    !isDropTarget && !isToday && isDragging && "hover:border-primary/30 hover:shadow-md",
                  )}
                  onDragOver={(e) => handleDragOver(e, dateStr)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, dateStr)}
                >
                  {isDropTarget && dropConflict && (dropConflict.hasConflict || dropConflict.severity === "warning") && (
                    <div
                      className={cn(
                        "absolute top-1 left-1 right-1 px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 z-10",
                        hasDropConflict ? "bg-rose-500 text-white" : "bg-amber-500 text-white",
                      )}
                    >
                      {hasDropConflict ? (
                        <>
                          <XCircle className="h-3 w-3" />
                          تعارض مع {dropConflict.conflictStudent}
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="h-3 w-3" />
                          قريب من {dropConflict.conflictStudent}
                        </>
                      )}
                    </div>
                  )}
                  {/* Date header - clickable to see all sessions */}
                  <div
                    className={cn(
                      "flex items-center justify-between mb-2 sm:mb-3 pb-1 sm:pb-2 border-b-2 shrink-0 cursor-pointer hover:bg-muted/30 rounded-t-lg -mx-2 -mt-2 sm:-mx-3 sm:-mt-3 px-2 pt-2 sm:px-3 sm:pt-3 transition-colors",
                      isToday ? "border-primary" : "border-border/50",
                      isDropTarget && (hasDropConflict || hasDropWarning) && "mt-6",
                    )}
                    onClick={() => handleDayClick(dateStr, daySessions)}
                  >
                    <span
                      className={cn(
                        "text-base sm:text-lg font-bold",
                        isToday &&
                          "bg-primary text-primary-foreground px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg shadow-sm",
                      )}
                    >
                      {format(day, "d")}
                    </span>
                    {daySessions.length > 0 && (
                      <span className="text-[10px] sm:text-xs bg-primary text-primary-foreground px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full font-bold shadow-sm cursor-pointer hover:scale-110 transition-transform">
                        {daySessions.length}
                      </span>
                    )}
                  </div>
                  {/* Sessions - scrollable */}
                  <div className="space-y-1.5 sm:space-y-2 overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent">
                    {daySessions.map(({ session, student, isGroup, group }) => {
                      const time = session.time || student.sessionTime;
                      const canDrag = session.status === "scheduled"; // Allow both individual and group sessions to be dragged
                      const memberCount = isGroup && group ? group.members.filter(m => m.isActive).length : 0;

                      return (
                        <div
                          key={session.id}
                          draggable={canDrag}
                          onDragStart={(e) =>
                            canDrag && handleDragStart(e, session.id, student.id, student.name, session.date, time || "", isGroup, isGroup && group ? group.id.replace('group_', '') : undefined)
                          }
                          onDragEnd={handleDragEnd}
                          onTouchStart={(e) =>
                            canDrag && handleTouchStart(e, session.id, student.id, student.name, session.date, time || "", isGroup, isGroup && group ? group.id.replace('group_', '') : undefined)
                          }
                          onTouchMove={handleTouchMove}
                          onTouchEnd={handleTouchEnd}
                          onClick={(e) => {
                            if (isGroup && group) {
                              const groupSession = group.sessions.find(s => s.date === session.date);
                              if (groupSession) {
                                setGroupSessionDialog({ open: true, group, session: groupSession });
                              }
                            } else {
                              handleSessionClick(e, session, student);
                            }
                          }}
                          className={cn(
                            "text-xs sm:text-sm p-2 sm:p-3 rounded-lg border-2 flex items-start gap-1.5 sm:gap-2 transition-all duration-200 touch-manipulation select-none cursor-pointer",
                            isGroup
                              ? "bg-violet-100 dark:bg-violet-950/30 border-violet-300 dark:border-violet-700 hover:bg-violet-200 dark:hover:bg-violet-950/50"
                              : getStatusColor(session.status),
                            canDrag && "active:cursor-grabbing hover:shadow-lg active:scale-95",
                            touchDragState?.sessionId === session.id && touchDragState?.active && "opacity-50 scale-95",
                            dragState?.sessionId === session.id && "opacity-50 scale-95",
                          )}
                        >
                          {canDrag && <GripVertical className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 opacity-50 mt-0.5" />}
                          {isGroup && !canDrag && <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 text-violet-600 dark:text-violet-400 mt-0.5" />}
                          {isGroup && canDrag && <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 text-violet-600 dark:text-violet-400 mt-0.5 mr-[-4px]" />}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1">
                              <div className={cn(
                                "font-bold truncate text-xs sm:text-sm flex-1",
                                isGroup && "text-violet-700 dark:text-violet-300"
                              )}>
                                {isGroup ? `👥 ${student.name}` : student.name}
                              </div>
                              {/* Session type indicator */}
                              {isGroup ? (
                                <Badge variant="outline" className="text-[8px] h-4 px-1 border-violet-300 text-violet-600 dark:border-violet-700 dark:text-violet-400">
                                  {memberCount}
                                </Badge>
                              ) : student.sessionType === "online" ? (
                                <Monitor className="h-3 w-3 text-blue-500 shrink-0" />
                              ) : (
                                <MapPin className="h-3 w-3 text-emerald-500 shrink-0" />
                              )}
                            </div>
                            <div className="text-[10px] sm:text-xs opacity-80 flex items-center gap-1 sm:gap-1.5 mt-0.5 sm:mt-1">
                              {(() => {
                                const timeInfo = getTimeOfDayInfo(time || "12:00");
                                const TimeIcon = timeInfo.icon;
                                return <TimeIcon className={cn("h-3 w-3 sm:h-3.5 sm:w-3.5", isGroup ? "text-violet-500" : timeInfo.color)} />;
                              })()}
                              <span className="font-medium">{time}</span>
                              {isGroup && group && (
                                <span className="text-violet-500">
                                  {group.sessionType === 'online' ? '💻' : '🏠'}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Legend Footer */}
        <div className="flex flex-wrap items-center gap-4 mt-6 pt-4 border-t-2 text-sm bg-gradient-to-r from-muted/30 to-muted/10 p-4 rounded-xl">
          <span className="text-muted-foreground font-bold">الحالة:</span>
          {[
            { color: "bg-primary/30", label: "مجدولة", icon: CalendarIcon },
            { color: "bg-primary/50", label: "مكتملة", icon: CheckCircle2 },
            { color: "bg-muted", label: "ملغاة", icon: XCircle },
            { color: "bg-secondary", label: "إجازة", icon: Coffee },
            { color: "bg-violet-100 dark:bg-violet-900/30", label: "مجموعة", icon: Users },
          ].map(({ color, label, icon: Icon }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className={cn("w-4 h-4 rounded-md border-2 border-current flex items-center justify-center", color)}>
                <Icon className="h-2.5 w-2.5" />
              </div>
              <span className="font-medium">{label}</span>
            </div>
          ))}
          <div className="flex items-center gap-2 mr-auto text-muted-foreground">
            <GripVertical className="h-4 w-4" />
            <span className="hidden sm:inline font-medium">اسحب لتغيير الموعد</span>
            <span className="sm:hidden font-medium">اسحب</span>
          </div>
        </div>
      </CardContent>

      {/* Session Action Dialog */}
      <Dialog open={sessionActionDialog?.open || false} onOpenChange={(open) => !open && setSessionActionDialog(null)}>
        <DialogContent dir="rtl" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              {sessionActionDialog?.student.name}
            </DialogTitle>
            <DialogDescription>
              {sessionActionDialog &&
                format(parseISO(sessionActionDialog.session.date), "EEEE dd MMMM yyyy", { locale: ar })}
            </DialogDescription>
          </DialogHeader>
          {sessionActionDialog && (
            <div className="space-y-4 py-4">
              <div className="p-4 rounded-xl bg-muted/50 border-2 space-y-3">
                {/* Edit mode - shows date and time inputs */}
                {sessionActionDialog.isEditing ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium flex items-center gap-2">
                        <CalendarIcon className="h-4 w-4 text-primary" />
                        التاريخ الجديد
                      </Label>
                      <Input
                        type="date"
                        value={sessionActionDialog.editedDate || ""}
                        onChange={(e) => handleDateEditChange(e.target.value)}
                        className="h-11 text-center font-bold rounded-lg"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium flex items-center gap-2">
                        <Clock className="h-4 w-4 text-primary" />
                        الوقت الجديد
                      </Label>
                      <Input
                        type="time"
                        value={sessionActionDialog.editedTime || ""}
                        onChange={(e) => handleTimeEditChange(e.target.value)}
                        className="h-11 text-center font-bold rounded-lg"
                      />
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button
                        onClick={handleSaveEdit}
                        className="flex-1 h-11 bg-emerald-500 hover:bg-emerald-600 text-white gap-2"
                      >
                        <Save className="h-4 w-4" />
                        حفظ التغييرات
                      </Button>
                      <Button
                        variant="outline"
                        onClick={handleCancelEdit}
                        className="h-11 px-4"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Display mode - shows current date and time */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm">
                        <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                        <span className="font-bold">
                          {format(parseISO(sessionActionDialog.session.date), "dd/MM/yyyy", { locale: ar })}
                        </span>
                      </div>
                      <Badge className={getStatusBadgeColor(sessionActionDialog.session.status)}>
                        {getStatusLabel(sessionActionDialog.session.status)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="font-bold">
                        {sessionActionDialog.session.time || sessionActionDialog.student.sessionTime}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      {sessionActionDialog.student.sessionType === "online" ? (
                        <>
                          <Monitor className="h-4 w-4" />
                          <span>أونلاين</span>
                        </>
                      ) : (
                        <>
                          <MapPin className="h-4 w-4" />
                          <span>حضوري</span>
                        </>
                      )}
                    </div>
                    {/* Edit Button - only for scheduled sessions */}
                    {sessionActionDialog.session.status === "scheduled" && onUpdateSessionDateTime && (
                      <Button
                        onClick={handleStartEdit}
                        variant="outline"
                        className="w-full h-10 mt-2 gap-2 border-primary/50 text-primary hover:bg-primary/10"
                      >
                        <Pencil className="h-4 w-4" />
                        تعديل التاريخ والوقت
                      </Button>
                    )}
                  </>
                )}
              </div>
              {!sessionActionDialog.isEditing && (
              <div className="space-y-2">
                {sessionActionDialog.session.status === "scheduled" && (
                  <>
                    {onToggleComplete && isSessionEnded(
                      sessionActionDialog.session.date,
                      sessionActionDialog.session.time || sessionActionDialog.student.sessionTime || "16:00",
                      sessionActionDialog.session.duration || sessionActionDialog.student.sessionDuration || 60
                    ) && (
                      <Button
                        onClick={handleCompleteClick}
                        className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-white gap-2 text-base"
                      >
                        <CheckCircle2 className="h-5 w-5" />
                        تسجيل كمكتملة
                      </Button>
                    )}
                    {onToggleComplete && !isSessionEnded(
                      sessionActionDialog.session.date,
                      sessionActionDialog.session.time || sessionActionDialog.student.sessionTime || "16:00",
                      sessionActionDialog.session.duration || sessionActionDialog.student.sessionDuration || 60
                    ) && (
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-500/10 text-blue-700 text-sm font-medium">
                        <Clock className="h-4 w-4" />
                        الحصة لم تنتهِ بعد - يمكن تسجيلها كمكتملة بعد انتهاء الوقت
                      </div>
                    )}
                    {onCancelSession && (
                      <Button
                        onClick={handleCancelClick}
                        variant="outline"
                        className="w-full h-12 border-rose-500/50 text-rose-600 hover:bg-rose-500/10 gap-2 text-base"
                      >
                        <XCircle className="h-5 w-5" />
                        إلغاء الحصة
                      </Button>
                    )}
                    {onQuickPayment && (
                      <Button
                        onClick={handlePaymentClick}
                        variant="outline"
                        className="w-full h-12 border-amber-500/50 text-amber-600 hover:bg-amber-500/10 gap-2 text-base"
                      >
                        <DollarSign className="h-5 w-5" />
                        تسجيل دفع
                      </Button>
                    )}
                  </>
                )}
                {sessionActionDialog.session.status === "completed" && onQuickPayment && (
                  <>
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 text-emerald-700 text-sm font-medium">
                      <CheckCircle2 className="h-4 w-4" />
                      تم إكمال هذه الحصة
                    </div>
                    <Button
                      onClick={handlePaymentClick}
                      className="w-full h-12 bg-amber-500 hover:bg-amber-600 text-white gap-2 text-base"
                    >
                      <DollarSign className="h-5 w-5" />
                      تسجيل دفع
                    </Button>
                  </>
                )}
                {sessionActionDialog.session.status === "cancelled" && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-500/10 text-rose-700 text-sm font-medium">
                    <XCircle className="h-4 w-4" />
                    تم إلغاء هذه الحصة
                  </div>
                )}
                {sessionActionDialog.session.status === "vacation" && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 text-amber-700 text-sm font-medium">
                    <CalendarIcon className="h-4 w-4" />
                    هذه الحصة إجازة
                  </div>
                )}

                {/* Delete button - available for all session statuses */}
                {onDeleteSession && (
                  <div className="pt-3 mt-3 border-t">
                    <Button
                      onClick={handleDeleteClick}
                      variant="outline"
                      className="w-full h-10 border-slate-300 text-slate-600 hover:bg-slate-100 hover:text-slate-800 hover:border-slate-400 gap-2 text-sm"
                    >
                      <Trash2 className="h-4 w-4" />
                      حذف الحصة نهائياً
                    </Button>
                  </div>
                )}
              </div>
              )}
            </div>
          )}
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setSessionActionDialog(null)} className="rounded-xl">
              إغلاق
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Complete Confirmation Dialog */}
      <AlertDialog
        open={completeConfirmDialog?.open || false}
        onOpenChange={(open) => !open && setCompleteConfirmDialog(null)}
      >
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد إكمال الحصة</AlertDialogTitle>
            <AlertDialogDescription>
              هل تريد تسجيل حصة <strong>{completeConfirmDialog?.student.name}</strong> في{" "}
              <strong>{completeConfirmDialog?.session.time || completeConfirmDialog?.student.sessionTime}</strong>{" "}
              كمكتملة؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={confirmComplete} className="bg-emerald-600 text-white hover:bg-emerald-700">
              تأكيد الإكمال
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog
        open={cancelConfirmDialog?.open || false}
        onOpenChange={(open) => !open && setCancelConfirmDialog(null)}
      >
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد إلغاء الحصة</AlertDialogTitle>
            <AlertDialogDescription>
              هل تريد إلغاء حصة <strong>{cancelConfirmDialog?.student.name}</strong> في{" "}
              <strong>{cancelConfirmDialog?.session.time || cancelConfirmDialog?.student.sessionTime}</strong>؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>رجوع</AlertDialogCancel>
            <AlertDialogAction onClick={confirmCancel} className="bg-rose-600 text-white hover:bg-rose-700">
              تأكيد الإلغاء
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={deleteConfirmDialog?.open || false}
        onOpenChange={(open) => !open && setDeleteConfirmDialog(null)}
      >
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-slate-700">
              <Trash2 className="h-5 w-5" />
              تأكيد حذف الحصة
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                هل تريد حذف حصة <strong>{deleteConfirmDialog?.student.name}</strong> في{" "}
                <strong>{deleteConfirmDialog?.session.time || deleteConfirmDialog?.student.sessionTime}</strong>{" "}
                نهائياً؟
              </p>
              <p className="text-rose-600 text-sm font-medium">
                ⚠️ هذا الإجراء لا يمكن التراجع عنه. سيتم حذف الحصة من جميع السجلات.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-slate-700 text-white hover:bg-slate-800">
              <Trash2 className="h-4 w-4 ml-2" />
              حذف نهائياً
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reschedule Confirmation Dialog */}
      <Dialog open={confirmDialog?.open || false} onOpenChange={(open) => !open && setConfirmDialog(null)}>
        <DialogContent dir="rtl" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              {confirmDialog?.conflictInfo.hasConflict ? (
                <XCircle className="h-6 w-6 text-rose-500" />
              ) : confirmDialog?.conflictInfo.severity === "warning" ? (
                <AlertTriangle className="h-6 w-6 text-amber-500" />
              ) : (
                <CheckCircle2 className="h-6 w-6 text-primary" />
              )}
              تأكيد تغيير موعد الحصة
            </DialogTitle>
            <DialogDescription>
              حصة <span className="font-bold text-foreground">{confirmDialog?.studentName}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {confirmDialog?.conflictInfo.hasConflict && (
              <div className="p-4 rounded-xl bg-rose-500/10 border-2 border-rose-500/30 flex items-start gap-3">
                <XCircle className="h-5 w-5 text-rose-500 mt-0.5 shrink-0" />
                <div>
                  <p className="font-bold text-rose-700">لا يمكن نقل الحصة</p>
                  <p className="text-sm text-rose-600 mt-1">
                    يوجد تعارض مع حصة <span className="font-bold">{confirmDialog.conflictInfo.conflictStudent}</span> في
                    الساعة {confirmDialog.conflictInfo.conflictTime}
                  </p>
                </div>
              </div>
            )}
            {confirmDialog?.conflictInfo.severity === "warning" && !confirmDialog.conflictInfo.hasConflict && (
              <div className="p-4 rounded-xl bg-amber-500/10 border-2 border-amber-500/30 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                <div>
                  <p className="font-bold text-amber-700">تحذير: فاصل أقل من 30 دقيقة</p>
                  <p className="text-sm text-amber-600 mt-1">
                    {confirmDialog.conflictInfo.gapMinutes !== undefined
                      ? `فاصل ${confirmDialog.conflictInfo.gapMinutes} دقيقة فقط`
                      : 'حصة قريبة جداً'}
                    مع <span className="font-bold">{confirmDialog.conflictInfo.conflictStudent}</span> في
                    الساعة {confirmDialog.conflictInfo.conflictTime}
                  </p>
                  <p className="text-xs text-amber-500 mt-1">ننصح بفاصل 30 دقيقة على الأقل بين الحصص</p>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground font-medium">الموعد الحالي:</Label>
              <div className="p-3 bg-muted/50 rounded-xl border-2">
                <div className="text-sm font-bold">
                  {confirmDialog && format(parseISO(confirmDialog.originalDate), "EEEE dd/MM/yyyy", { locale: ar })}
                </div>
                <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  {confirmDialog?.originalTime}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground font-medium">الموعد الجديد:</Label>
              <div
                className={cn(
                  "p-3 border-2 rounded-xl",
                  confirmDialog?.conflictInfo.hasConflict
                    ? "bg-rose-500/10 border-rose-500/30"
                    : "bg-gradient-to-br from-primary/10 to-primary/5 border-primary/30",
                )}
              >
                <div
                  className={cn(
                    "text-sm font-bold",
                    confirmDialog?.conflictInfo.hasConflict ? "text-rose-700" : "text-primary",
                  )}
                >
                  {confirmDialog && format(parseISO(confirmDialog.newDate), "EEEE dd/MM/yyyy", { locale: ar })}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-time" className="text-sm font-medium">
                اختر الوقت الجديد:
              </Label>
              <div className="relative">
                <Input
                  id="new-time"
                  type="time"
                  value={confirmDialog?.newTime || ""}
                  onChange={(e) => updateConfirmDialogTime(e.target.value)}
                  className={cn(
                    "h-12 rounded-xl border-2 text-center text-lg font-bold",
                    confirmDialog?.conflictInfo.hasConflict && "border-rose-500/50 text-rose-600",
                    confirmDialog?.conflictInfo.severity === "warning" &&
                      !confirmDialog?.conflictInfo.hasConflict &&
                      "border-amber-500/50 text-amber-600",
                  )}
                />
                {confirmDialog?.conflictInfo.hasConflict && (
                  <div className="mt-2 p-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-600 text-xs flex items-center gap-1.5">
                    <XCircle className="h-3.5 w-3.5" />
                    تعارض مع {confirmDialog.conflictInfo.conflictStudent} في الساعة{" "}
                    {confirmDialog.conflictInfo.conflictTime}
                  </div>
                )}
                {confirmDialog?.conflictInfo.severity === "warning" && !confirmDialog?.conflictInfo.hasConflict && (
                  <div className="mt-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-600 text-xs flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    فاصل {confirmDialog.conflictInfo.gapMinutes !== undefined ? `${confirmDialog.conflictInfo.gapMinutes} دقيقة` : 'أقل من 30 دقيقة'} مع {confirmDialog.conflictInfo.conflictStudent}
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">💡 الوقت الحالي: {confirmDialog?.originalTime}</p>
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setConfirmDialog(null)} className="rounded-xl">
              إلغاء
            </Button>
            <Button
              onClick={confirmReschedule}
              disabled={!confirmDialog?.newTime || confirmDialog?.conflictInfo.hasConflict}
              className={cn(
                "rounded-xl shadow-lg hover:shadow-xl",
                confirmDialog?.conflictInfo.hasConflict
                  ? "bg-muted text-muted-foreground cursor-not-allowed"
                  : "bg-gradient-to-r from-primary to-primary/80",
              )}
            >
              {confirmDialog?.conflictInfo.hasConflict ? "غير متاح" : "تأكيد النقل"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Day Details Dialog - Shows all sessions for a specific day */}
      <Dialog open={dayDetailsDialog?.open || false} onOpenChange={(open) => !open && setDayDetailsDialog(null)}>
        <DialogContent dir="rtl" className="sm:max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl font-display font-bold flex items-center gap-2">
                <div className="p-2 rounded-lg bg-gradient-to-br from-primary to-purple-500 text-white">
                  <CalendarIcon className="h-5 w-5" />
                </div>
                <div>
                  <div>{dayDetailsDialog && format(parseISO(dayDetailsDialog.date), "EEEE", { locale: ar })}</div>
                  <div className="text-sm font-normal text-muted-foreground">
                    {dayDetailsDialog && format(parseISO(dayDetailsDialog.date), "dd MMMM yyyy", { locale: ar })}
                  </div>
                </div>
              </DialogTitle>
              {onAddSession && dayDetailsDialog && (
                <Button
                  size="sm"
                  onClick={() => {
                    setDayDetailsDialog(null);
                    setAddSessionDialog({
                      open: true,
                      date: dayDetailsDialog.date,
                      selectedStudentId: "",
                      selectedGroupId: "",
                      time: "",
                      sessionType: 'student',
                    });
                  }}
                  className="h-8 gap-1.5 rounded-lg bg-gradient-to-r from-primary to-purple-500"
                >
                  <Plus className="h-4 w-4" />
                  إضافة حصة
                </Button>
              )}
            </div>
            <DialogDescription>
              {dayDetailsDialog?.sessions.length === 0
                ? "لا توجد حصص في هذا اليوم"
                : `${dayDetailsDialog?.sessions.length} حصة مجدولة`}
            </DialogDescription>
          </DialogHeader>

          {dayDetailsDialog && dayDetailsDialog.sessions.length > 0 ? (
            <>
              {/* Day Summary Stats - Compact inline version */}
              <div className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-muted/30 border text-xs shrink-0">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <CalendarIcon className="h-3.5 w-3.5 text-blue-500" />
                    <span className="font-bold text-blue-600">{dayDetailsDialog.sessions.length}</span>
                    <span className="text-muted-foreground">حصص</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    <span className="font-bold text-emerald-600">
                      {dayDetailsDialog.sessions.filter((s) => s.session.status === "completed").length}
                    </span>
                    <span className="text-muted-foreground">مكتملة</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-purple-500" />
                    <span className="font-bold text-purple-600">
                      {Math.round(
                        (dayDetailsDialog.sessions.reduce(
                          (acc, { session, student }) =>
                            acc +
                            (session.status !== "cancelled" ? session.duration || student.sessionDuration || 60 : 0),
                          0,
                        ) /
                          60) *
                          10,
                      ) / 10}
                    </span>
                    <span className="text-muted-foreground">س</span>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto min-h-0 -mx-6 px-6">
                <div className="space-y-1.5 py-2">
                  {dayDetailsDialog.sessions.map(({ session, student }) => {
                    const time = session.time || student.sessionTime;
                    const timeInfo = getTimeOfDayInfo(time || "12:00");
                    const TimeIcon = timeInfo.icon;

                    return (
                      <div
                        key={session.id}
                        className={cn(
                          "p-2 rounded-lg border transition-all hover:shadow-sm cursor-pointer group",
                          getStatusColor(session.status),
                        )}
                        onClick={() => {
                          setDayDetailsDialog(null);
                          setSessionActionDialog({ open: true, session, student });
                        }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center shrink-0">
                              <User className="h-3 w-3" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="font-semibold text-xs truncate block">{student.name}</span>
                              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                <TimeIcon className={cn("h-2.5 w-2.5", timeInfo.color)} />
                                <span>{time}</span>
                                {student.sessionType === "online" ? (
                                  <Monitor className="h-2.5 w-2.5 text-blue-500" />
                                ) : (
                                  <MapPin className="h-2.5 w-2.5 text-emerald-500" />
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Badge className={cn("text-[9px] h-4 px-1.5", getStatusBadgeColor(session.status))}>
                              {getStatusLabel(session.status)}
                            </Badge>
                            {/* Inline action buttons - Complete only shows if session has ended */}
                            {session.status === "scheduled" && onToggleComplete && isSessionEnded(
                              session.date,
                              time || "16:00",
                              session.duration || student.sessionDuration || 60
                            ) && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-primary hover:bg-primary/10 opacity-0 group-hover:opacity-100"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDayDetailsDialog(null);
                                  setCompleteConfirmDialog({ open: true, session, student });
                                }}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                            )}
                            {onDeleteSession && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-slate-400 hover:bg-slate-500/10 hover:text-slate-600 opacity-0 group-hover:opacity-100"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDayDetailsDialog(null);
                                  setDeleteConfirmDialog({ open: true, session, student });
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <div className="py-12 text-center text-muted-foreground">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted/50 flex items-center justify-center">
                <CalendarIcon className="h-8 w-8 opacity-50" />
              </div>
              <p className="text-lg font-medium">لا توجد حصص</p>
              <p className="text-sm mb-4">هذا اليوم فارغ من الحصص</p>
              {onAddSession && dayDetailsDialog && (
                <Button
                  onClick={() => {
                    setDayDetailsDialog(null);
                    setAddSessionDialog({
                      open: true,
                      date: dayDetailsDialog.date,
                      selectedStudentId: "",
                      selectedGroupId: "",
                      time: "",
                      sessionType: 'student',
                    });
                  }}
                  className="gap-2 bg-gradient-to-r from-primary to-purple-500"
                >
                  <Plus className="h-4 w-4" />
                  إضافة حصة جديدة
                </Button>
              )}
            </div>
          )}

          <div className="flex justify-end pt-4 border-t shrink-0">
            <Button variant="outline" onClick={() => setDayDetailsDialog(null)} className="rounded-xl">
              إغلاق
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Session Dialog */}
      <Dialog open={addSessionDialog?.open || false} onOpenChange={(open) => !open && setAddSessionDialog(null)}>
        <DialogContent dir="rtl" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-display font-bold flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              إضافة حصة جديدة
            </DialogTitle>
            <DialogDescription>
              {addSessionDialog && format(parseISO(addSessionDialog.date), "EEEE dd MMMM yyyy", { locale: ar })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Session Type Toggle */}
            <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg w-full">
              <button
                onClick={() => addSessionDialog && setAddSessionDialog({
                  ...addSessionDialog,
                  sessionType: 'student',
                  selectedStudentId: '',
                  selectedGroupId: '',
                })}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-all",
                  addSessionDialog?.sessionType === 'student'
                    ? "bg-background text-primary shadow-sm"
                    : "text-muted-foreground hover:bg-background/50"
                )}
              >
                <User className="h-4 w-4" />
                طالب
              </button>
              <button
                onClick={() => addSessionDialog && setAddSessionDialog({
                  ...addSessionDialog,
                  sessionType: 'group',
                  selectedStudentId: '',
                  selectedGroupId: '',
                })}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-all",
                  addSessionDialog?.sessionType === 'group'
                    ? "bg-violet-100 text-violet-700 shadow-sm dark:bg-violet-950 dark:text-violet-300"
                    : "text-muted-foreground hover:bg-background/50"
                )}
              >
                <Users className="h-4 w-4" />
                مجموعة
              </button>
            </div>

            {/* Student Selection */}
            {addSessionDialog?.sessionType === 'student' && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">اختر الطالب</Label>
                <Select
                  value={addSessionDialog?.selectedStudentId || ""}
                  onValueChange={(value) => {
                    if (addSessionDialog) {
                      const student = students.find((s) => s.id === value);
                      setAddSessionDialog({
                        ...addSessionDialog,
                        selectedStudentId: value,
                        time: student?.sessionTime || addSessionDialog.time,
                      });
                    }
                  }}
                >
                  <SelectTrigger className="h-11 rounded-xl border-2">
                    <SelectValue placeholder="اختر طالب..." />
                  </SelectTrigger>
                  <SelectContent>
                    {students.map((student) => (
                      <SelectItem key={student.id} value={student.id}>
                        <div className="flex items-center gap-2">
                          {student.sessionType === 'online' ? (
                            <Monitor className="h-3.5 w-3.5 text-blue-500" />
                          ) : (
                            <MapPin className="h-3.5 w-3.5 text-emerald-500" />
                          )}
                          <span>{student.name}</span>
                          <span className="text-xs text-muted-foreground">({student.sessionTime})</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Group Selection */}
            {addSessionDialog?.sessionType === 'group' && (
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Users className="h-4 w-4 text-violet-500" />
                  اختر المجموعة
                </Label>
                <Select
                  value={addSessionDialog?.selectedGroupId || ""}
                  onValueChange={(value) => {
                    if (addSessionDialog) {
                      const group = activeGroups.find((g) => g.id === value);
                      setAddSessionDialog({
                        ...addSessionDialog,
                        selectedGroupId: value,
                        time: group?.sessionTime || addSessionDialog.time,
                      });
                    }
                  }}
                >
                  <SelectTrigger className="h-11 rounded-xl border-2 border-violet-200 dark:border-violet-800">
                    <SelectValue placeholder="اختر مجموعة..." />
                  </SelectTrigger>
                  <SelectContent>
                    {activeGroups.length === 0 ? (
                      <div className="p-3 text-center text-sm text-muted-foreground">
                        لا توجد مجموعات نشطة
                      </div>
                    ) : (
                      activeGroups.map((group) => {
                        // Check if group already has session on this date
                        const hasSessionToday = group.sessions.some(s => s.date === addSessionDialog.date);
                        return (
                          <SelectItem
                            key={group.id}
                            value={group.id}
                            disabled={hasSessionToday}
                          >
                            <div className="flex items-center gap-2">
                              <div className={cn(
                                "w-3 h-3 rounded-full",
                                `bg-${group.color || 'violet'}-500`
                              )} style={{ backgroundColor: group.color ? undefined : '#8b5cf6' }} />
                              <span>{group.name}</span>
                              <span className="text-xs text-muted-foreground">
                                ({group.members.filter(m => m.isActive).length} طالب)
                              </span>
                              {hasSessionToday && (
                                <span className="text-xs text-amber-500">لديها حصة</span>
                              )}
                            </div>
                          </SelectItem>
                        );
                      })
                    )}
                  </SelectContent>
                </Select>
                {addSessionDialog?.selectedGroupId && (() => {
                  const group = activeGroups.find(g => g.id === addSessionDialog.selectedGroupId);
                  return group && (
                    <p className="text-xs text-violet-600 dark:text-violet-400">
                      👥 {group.members.filter(m => m.isActive).length} طالب •
                      {group.sessionType === 'online' ? ' 💻 أونلاين' : ' 🏠 حضوري'} •
                      {group.sessionDuration} دقيقة
                    </p>
                  );
                })()}
              </div>
            )}

            {/* Time Input */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">وقت الحصة</Label>
              <Input
                type="time"
                value={addSessionDialog?.time || ""}
                onChange={(e) => {
                  if (addSessionDialog) {
                    setAddSessionDialog({
                      ...addSessionDialog,
                      time: e.target.value,
                    });
                  }
                }}
                className="h-11 rounded-xl border-2 text-center text-lg font-bold"
              />
              {addSessionDialog?.sessionType === 'student' && addSessionDialog?.selectedStudentId && (
                <p className="text-xs text-muted-foreground">
                  💡 الوقت الافتراضي للطالب:{" "}
                  {students.find((s) => s.id === addSessionDialog.selectedStudentId)?.sessionTime}
                </p>
              )}
              {addSessionDialog?.sessionType === 'group' && addSessionDialog?.selectedGroupId && (
                <p className="text-xs text-violet-600">
                  💡 الوقت الافتراضي للمجموعة:{" "}
                  {activeGroups.find((g) => g.id === addSessionDialog.selectedGroupId)?.sessionTime}
                </p>
              )}
            </div>

            {/* Available Time Slots */}
            {addSessionDialog && (() => {
              const selectedStudent = addSessionDialog.sessionType === 'student'
                ? students.find((s) => s.id === addSessionDialog.selectedStudentId)
                : null;
              const selectedGroup = addSessionDialog.sessionType === 'group'
                ? activeGroups.find((g) => g.id === addSessionDialog.selectedGroupId)
                : null;

              const duration = selectedStudent?.sessionDuration || selectedGroup?.sessionDuration || settings?.defaultSessionDuration || 60;

              const availableSlots = getSuggestedSlots(
                addSessionDialog.date,
                duration,
                settings?.workingHoursStart || "08:00",
                settings?.workingHoursEnd || "22:00",
                8
              );

              if (availableSlots.length === 0) return null;

              return (
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-1.5 text-emerald-700">
                    <Sparkles className="h-4 w-4" />
                    أوقات متاحة
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {availableSlots.map((slot) => (
                      <Button
                        key={slot.time}
                        type="button"
                        size="sm"
                        variant={addSessionDialog.time === slot.time ? "default" : "outline"}
                        className={cn(
                          "gap-1.5 h-9 text-sm",
                          addSessionDialog.time === slot.time && "ring-2 ring-primary ring-offset-1"
                        )}
                        onClick={() => setAddSessionDialog({ ...addSessionDialog, time: slot.time })}
                      >
                        {slot.type === "morning" && <Sunrise className="h-3.5 w-3.5" />}
                        {slot.type === "afternoon" && <Sun className="h-3.5 w-3.5" />}
                        {slot.type === "evening" && <Moon className="h-3.5 w-3.5" />}
                        {slot.timeAr}
                      </Button>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Smart Scheduling Suggestions - Location & Proximity Based */}
            {addSessionDialog && (addSessionDialog.selectedStudentId || addSessionDialog.selectedGroupId) && (() => {
              const selectedStudent = addSessionDialog.sessionType === 'student'
                ? students.find((s) => s.id === addSessionDialog.selectedStudentId)
                : null;
              const selectedGroup = addSessionDialog.sessionType === 'group'
                ? activeGroups.find((g) => g.id === addSessionDialog.selectedGroupId)
                : null;

              const sessionType = selectedStudent?.sessionType || selectedGroup?.sessionType;
              const location = selectedStudent?.location || selectedGroup?.location;
              const selectedDate = parseISO(addSessionDialog.date);
              const dayOfWeek = selectedDate.getDay();

              // Find sessions on the same date
              const sessionsOnDate = sessionsByDate.get(addSessionDialog.date) || [];

              // Find nearby students (for onsite sessions with location)
              const nearbyStudentSuggestions: Array<{
                studentName: string;
                time: string;
                timeAr: string;
                distanceKm: number;
                suggestedTime: string;
                suggestedTimeAr: string;
                placement: 'before' | 'after';
              }> = [];

              if (sessionType === 'onsite' && location) {
                // Find onsite sessions on same day with location
                sessionsOnDate.forEach(({ session, student, isGroup, group }) => {
                  const otherLocation = isGroup ? group?.location : student.location;
                  const otherSessionType = isGroup ? group?.sessionType : student.sessionType;

                  if (otherSessionType === 'onsite' && otherLocation && session.status === 'scheduled') {
                    // Calculate distance
                    const R = 6371; // Earth's radius in km
                    const dLat = (otherLocation.lat - location.lat) * Math.PI / 180;
                    const dLon = (otherLocation.lng - location.lng) * Math.PI / 180;
                    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                              Math.cos(location.lat * Math.PI / 180) * Math.cos(otherLocation.lat * Math.PI / 180) *
                              Math.sin(dLon / 2) * Math.sin(dLon / 2);
                    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                    const distanceKm = R * c;

                    // If within 10km, suggest scheduling before/after
                    if (distanceKm <= 10) {
                      const otherTime = session.time || student.sessionTime || "16:00";
                      const [h, m] = otherTime.split(':').map(Number);
                      const otherMinutes = h * 60 + m;
                      const duration = session.duration || student.sessionDuration || 60;

                      // Suggest 30 min gap for travel
                      const beforeTime = otherMinutes - duration - 30;
                      const afterTime = otherMinutes + duration + 30;

                      const formatTime = (mins: number) => {
                        const hours = Math.floor(mins / 60);
                        const minutes = mins % 60;
                        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
                      };

                      const formatTimeAr = (time: string) => {
                        const [hr, min] = time.split(':').map(Number);
                        const period = hr >= 12 ? 'م' : 'ص';
                        const hour12 = hr % 12 || 12;
                        return `${hour12}:${String(min).padStart(2, '0')} ${period}`;
                      };

                      const displayName = isGroup ? `👥 ${group?.name}` : student.name;

                      if (beforeTime >= 8 * 60) {
                        nearbyStudentSuggestions.push({
                          studentName: displayName,
                          time: otherTime,
                          timeAr: formatTimeAr(otherTime),
                          distanceKm,
                          suggestedTime: formatTime(beforeTime),
                          suggestedTimeAr: formatTimeAr(formatTime(beforeTime)),
                          placement: 'before',
                        });
                      }

                      if (afterTime <= 22 * 60) {
                        nearbyStudentSuggestions.push({
                          studentName: displayName,
                          time: otherTime,
                          timeAr: formatTimeAr(otherTime),
                          distanceKm,
                          suggestedTime: formatTime(afterTime),
                          suggestedTimeAr: formatTimeAr(formatTime(afterTime)),
                          placement: 'after',
                        });
                      }
                    }
                  }
                });
              }

              // Day analysis for smart tips
              const onsiteCount = sessionsOnDate.filter(s =>
                (s.isGroup ? s.group?.sessionType : s.student.sessionType) === 'onsite' &&
                s.session.status === 'scheduled'
              ).length;
              const onlineCount = sessionsOnDate.filter(s =>
                (s.isGroup ? s.group?.sessionType : s.student.sessionType) === 'online' &&
                s.session.status === 'scheduled'
              ).length;
              const totalOnDay = onsiteCount + onlineCount;

              const tips: string[] = [];

              // Day load tips
              if (totalOnDay >= 5) {
                tips.push('⚠️ هذا اليوم مزدحم - فكر في يوم آخر');
              } else if (totalOnDay === 0) {
                tips.push('✨ هذا اليوم فارغ - خيار ممتاز');
              }

              // Session type clustering tips
              if (sessionType === 'onsite') {
                if (onsiteCount >= 2 && onlineCount === 0) {
                  tips.push('🚗 يوم حضوري - مناسب لتجميع الجلسات الحضورية');
                } else if (onlineCount >= 2 && onsiteCount === 0) {
                  tips.push('💡 معظم الجلسات أونلاين - قد يكون من الأفضل اختيار يوم آخر للحضوري');
                }
              } else if (sessionType === 'online') {
                if (onlineCount >= 2 && onsiteCount === 0) {
                  tips.push('💻 يوم أونلاين - مناسب لتجميع الجلسات');
                } else if (onsiteCount >= 2 && onlineCount === 0) {
                  tips.push('💡 معظم الجلسات حضوري - قد يكون من الأفضل اختيار يوم آخر للأونلاين');
                }
              }

              // Location tip
              if (sessionType === 'onsite' && location) {
                tips.push(`📍 الموقع: ${location.address || location.name || 'محدد'}`);
              }

              const hasContent = nearbyStudentSuggestions.length > 0 || tips.length > 0;
              if (!hasContent) return null;

              return (
                <div className="space-y-3">
                  {/* Smart Tips */}
                  {tips.length > 0 && (
                    <div className="p-2.5 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-800/50">
                      <div className="flex items-start gap-2">
                        <Lightbulb className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                        <div className="space-y-0.5">
                          {tips.slice(0, 3).map((tip, i) => (
                            <p key={i} className="text-xs text-blue-600 dark:text-blue-400">{tip}</p>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Nearby Students / Location-Based Suggestions */}
                  {nearbyStudentSuggestions.length > 0 && (
                    <div className="p-2.5 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/50">
                      <p className="text-xs font-medium text-amber-700 dark:text-amber-300 mb-2 flex items-center gap-1.5">
                        <Navigation2 className="h-3.5 w-3.5" />
                        جلسات قريبة (وفر وقت التنقل)
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {nearbyStudentSuggestions.slice(0, 3).map((suggestion, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setAddSessionDialog({ ...addSessionDialog, time: suggestion.suggestedTime })}
                            className={cn(
                              "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors",
                              addSessionDialog.time === suggestion.suggestedTime
                                ? "bg-amber-200 text-amber-800 dark:bg-amber-800 dark:text-amber-200"
                                : "bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/50 dark:text-amber-300 dark:hover:bg-amber-900/70"
                            )}
                          >
                            <span>{suggestion.placement === 'before' ? 'قبل' : 'بعد'} {suggestion.studentName}</span>
                            <span className="text-amber-500">•</span>
                            <span>{suggestion.suggestedTimeAr}</span>
                            <span className="text-[10px] text-amber-500">({suggestion.distanceKm.toFixed(1)} كم)</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Conflict Warning - works for both students and groups */}
            {addSessionDialog?.time && (addSessionDialog.selectedStudentId || addSessionDialog.selectedGroupId) &&
              (() => {
                const sessionId = addSessionDialog.sessionType === 'group'
                  ? `group_${addSessionDialog.selectedGroupId}`
                  : addSessionDialog.selectedStudentId;

                const conflict = checkConflict(
                  { date: addSessionDialog.date, startTime: addSessionDialog.time },
                  undefined,
                  sessionId
                );

                if (conflict.severity === "error" && conflict.conflicts.length > 0) {
                  const firstConflict = conflict.conflicts[0];
                  return (
                    <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-600 text-sm flex items-center gap-2">
                      <XCircle className="h-4 w-4" />
                      {firstConflict.messageAr}
                    </div>
                  );
                }
                if (conflict.severity === "warning" && conflict.conflicts.length > 0) {
                  const firstConflict = conflict.conflicts[0];
                  return (
                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-600 text-sm flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      {firstConflict.messageAr}
                    </div>
                  );
                }
                return null;
              })()}
          </div>

          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setAddSessionDialog(null)} className="rounded-xl">
              إلغاء
            </Button>
            {(() => {
              const isStudent = addSessionDialog?.sessionType === 'student';
              const isGroup = addSessionDialog?.sessionType === 'group';
              const hasSelection = isStudent ? addSessionDialog?.selectedStudentId : addSessionDialog?.selectedGroupId;

              let hasConflict = false;
              if (addSessionDialog?.time && hasSelection) {
                const sessionId = isGroup
                  ? `group_${addSessionDialog.selectedGroupId}`
                  : addSessionDialog.selectedStudentId;
                const conflict = checkConflict(
                  { date: addSessionDialog.date, startTime: addSessionDialog.time },
                  undefined,
                  sessionId
                );
                hasConflict = conflict.severity === "error";
              }

              return (
                <Button
                  onClick={handleAddNewSession}
                  disabled={!hasSelection || hasConflict}
                  className={cn(
                    "rounded-xl",
                    hasConflict
                      ? "bg-muted text-muted-foreground cursor-not-allowed"
                      : isGroup
                        ? "bg-gradient-to-r from-violet-500 to-purple-600"
                        : "bg-gradient-to-r from-primary to-purple-500",
                  )}
                >
                  {isGroup ? <Users className="h-4 w-4 ml-2" /> : <Plus className="h-4 w-4 ml-2" />}
                  {isGroup ? "إضافة حصة المجموعة" : "إضافة الحصة"}
                </Button>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>

      {/* Group Session Attendance Dialog */}
      {groupSessionDialog && (
        <GroupAttendanceDialog
          open={groupSessionDialog.open}
          onOpenChange={(open) => !open && setGroupSessionDialog(null)}
          group={groupSessionDialog.group}
          session={groupSessionDialog.session}
          onUpdateAttendance={updateMemberAttendance}
          onCompleteSession={completeGroupSession}
        />
      )}
    </Card>
  );
};
