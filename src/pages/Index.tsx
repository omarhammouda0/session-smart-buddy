import { useState, useMemo } from "react";
import {
  GraduationCap,
  BookOpen,
  CreditCard,
  Users,
  Trash2,
  Clock,
  Monitor,
  MapPin,
  History,
  CalendarDays,
  Sparkles,
  CheckCircle2,
  XCircle,
  DollarSign,
  Timer,
  ChevronDown,
  ChevronUp,
  Check,
  Phone,
  MoreVertical,
  Pencil,
  Plus,
  User,
  FileText,
  Sunrise,
  Sun,
  Moon,
} from "lucide-react";
import { format, parseISO, differenceInMinutes } from "date-fns";
import { ar } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useStudents } from "@/hooks/useStudents";
import { useCancellationTracking } from "@/hooks/useCancellationTracking";
import { useConflictDetection, ConflictResult } from "@/hooks/useConflictDetection";
import { AddStudentDialog } from "@/components/AddStudentDialog";
import { SemesterSettings } from "@/components/SemesterSettings";
import { EditStudentDialog } from "@/components/EditStudentDialog";
import { PaymentsDashboard } from "@/components/PaymentsDashboard";
import { QuickPaymentDialog } from "@/components/QuickPaymentDialog";
import { EmptyState } from "@/components/EmptyState";
import { StudentSearchCombobox } from "@/components/StudentSearchCombobox";
import { StatsBar } from "@/components/StatsBar";
import { EndOfMonthReminder } from "@/components/EndOfMonthReminder";
import { SessionHistoryBar } from "@/components/SessionHistoryBar";
import { BulkEditSessionsDialog } from "@/components/BulkEditSessionsDialog";
import { AddVacationDialog } from "@/components/AddVacationDialog";
import { RestoreConflictDialog } from "@/components/RestoreConflictDialog";
import { ReminderSettingsDialog } from "@/components/ReminderSettingsDialog";
import { ReminderHistoryDialog } from "@/components/ReminderHistoryDialog";
import { NotificationSettingsDialog } from "@/components/NotificationSettingsDialog";
import { MonthlyReportDialog } from "@/components/MonthlyReportDialog";
import { CalendarView } from "@/components/CalendarView";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { DAY_NAMES_SHORT_AR, formatShortDateAr } from "@/lib/arabicConstants";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Student, PaymentMethod, Session } from "@/types/student";
import { SessionNotesDialog } from "@/components/SessionNotesDialog";
import { useSessionNotifications } from "@/hooks/useSessionNotifications";
import { SessionNotificationBanner } from "@/components/SessionNotificationBanner";
import { SessionCompletionDialog } from "@/components/SessionCompletionDialog";
import { useStudentMaterials } from "@/hooks/useStudentMaterials";
import { StudentMaterialsDialog } from "@/components/StudentMaterialsDialog";
import { TodaySessionsStats } from "@/components/TodaySessionsStats";
import { EndOfDayChecker } from "@/components/EndOfDayChecker";
import { useAISuggestions } from "@/hooks/useAISuggestions";
import { AISuggestionsWidget } from "@/components/AISuggestionsWidget";
import { ActionHandlers } from "@/lib/suggestionActions";

const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

// Helper function to open WhatsApp
const openWhatsApp = (phone: string) => {
  if (!phone) return;
  let cleaned = phone.replace(/[^\d+]/g, "");
  if (cleaned.startsWith("0")) {
    cleaned = "966" + cleaned.substring(1);
  }
  cleaned = cleaned.replace("+", "");
  window.open(`https://wa.me/${cleaned}`, "_blank");
};

interface SessionWithStudent {
  session: Session;
  student: Student;
}

// Helper function to check if a session has ended
const isSessionEnded = (sessionDate: string, sessionTime: string, sessionDuration: number = 60): boolean => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sessionDateObj = new Date(sessionDate);

  // If session is in the past (before today), it has ended
  if (sessionDateObj < today) {
    return true;
  }

  // If session is in the future (after today), it has NOT ended
  if (sessionDateObj > today) {
    return false;
  }

  // Session is today - check if current time is past the session end time
  if (!sessionTime) return false;

  const [sessionHour, sessionMin] = sessionTime.split(":").map(Number);
  const sessionEndMinutes = sessionHour * 60 + sessionMin + sessionDuration;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  return currentMinutes >= sessionEndMinutes;
};

// Helper function to check if a session is currently in progress
const isSessionInProgress = (sessionDate: string, sessionTime: string, sessionDuration: number = 60): boolean => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sessionDateObj = new Date(sessionDate);

  // Session must be today
  if (sessionDateObj.getTime() !== today.getTime()) {
    return false;
  }

  if (!sessionTime) return false;

  const [sessionHour, sessionMin] = sessionTime.split(":").map(Number);
  const sessionStartMinutes = sessionHour * 60 + sessionMin;
  const sessionEndMinutes = sessionStartMinutes + sessionDuration;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  // In progress = current time is between start and end
  return currentMinutes >= sessionStartMinutes && currentMinutes < sessionEndMinutes;
};

// Helper function to get the last session with notes for a student (excluding today)
// Prioritizes sessions with content, then falls back to completed sessions
const getLastSessionWithNotes = (student: Student, todayStr: string): Session | null => {
  // First, try to find the most recent past session with notes/topic/homework
  const pastSessionsWithContent = student.sessions
    .filter(s => s.date < todayStr && (s.notes || s.homework || s.topic))
    .sort((a, b) => b.date.localeCompare(a.date));

  if (pastSessionsWithContent.length > 0) {
    return pastSessionsWithContent[0];
  }

  // If no sessions with content, return the most recent completed session
  const pastCompletedSessions = student.sessions
    .filter(s => s.date < todayStr && s.status === "completed")
    .sort((a, b) => b.date.localeCompare(a.date));

  return pastCompletedSessions[0] || null;
};

const Index = () => {
  const now = useMemo(() => new Date(), []);
  const [activeTab, setActiveTab] = useState("sessions");
  const [allStudentsSearch, setAllStudentsSearch] = useState("");
  const [showAllSessions, setShowAllSessions] = useState(false);
  const [addConflictDialog, setAddConflictDialog] = useState<{
    open: boolean;
    studentId: string;
    date: string;
    conflictResult: ConflictResult;
    sessionInfo: { studentName: string; date: string; time: string };
  } | null>(null);

  const [quickPaymentDialog, setQuickPaymentDialog] = useState<{
    open: boolean;
    student: Student | null;
    sessionId: string;
    sessionDate: string;
  }>({ open: false, student: null, sessionId: "", sessionDate: "" });

  const [completionDialog, setCompletionDialog] = useState<{
    open: boolean;
    student: Student | null;
    session: Session | null;
  }>({ open: false, student: null, session: null });

  // Time edit dialog for quick time changes
  const [timeEditDialog, setTimeEditDialog] = useState<{
    open: boolean;
    student: Student | null;
    session: Session | null;
    newTime: string;
  }>({ open: false, student: null, session: null, newTime: "" });

  // Add session for today dialog
  const [addTodaySessionDialog, setAddTodaySessionDialog] = useState<{
    open: boolean;
    selectedStudentId: string;
    time: string;
  }>({ open: false, selectedStudentId: "", time: "" });

  const {
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
    updateStudentSchedule,
    updateStudentDuration,
    updateStudentCustomSettings,
    updateStudentCancellationPolicy,
    addExtraSession,
    removeSession,
    deleteSession,
    restoreSession,
    rescheduleSession,
    updateSessionDateTime,
    toggleSessionComplete,
    togglePaymentStatus,
    recordPayment,
    resetMonthlyPayment,
    bulkUpdateSessionTime,
    markSessionAsVacation,
    bulkMarkAsVacation,
    updateSessionDetails,
  } = useStudents();

  const {
    getCancellationCount,
    getAllStudentCancellations,
    recordCancellation,
    removeCancellation,
    clearMonthCancellations,
  } = useCancellationTracking(students);

  const { checkConflict, getSuggestedSlots } = useConflictDetection(students);

  // Session Notifications
  const {
    settings: notificationSettings,
    updateSettings: updateNotificationSettings,
    upcomingNotification,
    dismissNotification,
    endedSessionNotification,
    dismissEndedNotification,
  } = useSessionNotifications(students);

  // Student Materials
  const { getMaterials, addMaterials, addMaterial, removeMaterial } = useStudentMaterials();

  // AI Suggestions (Queue-based)
  const {
    currentSuggestion: aiCurrentSuggestion,
    pendingCount: aiPendingCount,
    allPendingSuggestions: aiAllPending,
    hasCriticalInterrupt: aiHasCriticalInterrupt,
    dismissedHistory: aiDismissedHistory,
    dismissSuggestion: dismissAISuggestion,
    actionSuggestion: actionAISuggestion,
    refreshSuggestions: refreshAISuggestions,
    resolveByEntity: resolveAIByEntity,
    dismissCriticalOverlay: dismissAICriticalOverlay,
  } = useAISuggestions(students, payments);

  // Handle adding a new student with materials
  const handleAddStudent = async (
    name: string,
    scheduleDays: number[],
    sessionTime: string,
    sessionType: "online" | "onsite",
    phone?: string,
    parentPhone?: string,
    customStart?: string,
    customEnd?: string,
    sessionDuration?: number,
    materials?: import("@/types/student").StudentMaterial[],
    useCustomPrices?: boolean,
    customPriceOnsite?: number,
    customPriceOnline?: number
  ) => {
    // First add the student to the database
    await addStudent(name, scheduleDays, sessionTime, sessionType, phone, parentPhone, customStart, customEnd, sessionDuration, materials, useCustomPrices, customPriceOnsite, customPriceOnline);

    // If materials were added, save them
    // We need to find the newly created student by name (since we don't have the ID yet)
    // The student will be in the students array after loadData is called
    if (materials && materials.length > 0) {
      // Wait a bit for the students list to update
      setTimeout(() => {
        const newStudent = students.find(s => s.name === name);
        if (newStudent) {
          addMaterials(newStudent.id, materials);
        }
      }, 1000);
    }
  };

  // Session Handlers
  const handleAddSession = (studentId: string, date: string, customTime?: string) => {
    const student = students.find((s) => s.id === studentId);
    if (!student) return;
    const sessionTime = customTime || student.sessionTime;
    const conflictResult = checkConflict({ date, startTime: sessionTime }, undefined, studentId);
    if (conflictResult.severity === "error" || conflictResult.severity === "warning") {
      setAddConflictDialog({
        open: true,
        studentId,
        date,
        conflictResult,
        sessionInfo: { studentName: student.name, date: formatShortDateAr(date), time: sessionTime },
      });
      return;
    }
    addExtraSession(studentId, date, sessionTime);
    toast({
      title: "تمت إضافة الحصة",
      description: `حصة جديدة بتاريخ ${format(parseISO(date), "dd/MM/yyyy")} الساعة ${sessionTime} لـ ${student.name}`,
    });
  };

  const handleForceAddSession = () => {
    if (!addConflictDialog) return;
    const { studentId, date } = addConflictDialog;
    const student = students.find((s) => s.id === studentId);
    addExtraSession(studentId, date);
    toast({
      title: "تمت إضافة الحصة",
      description: `حصة جديدة بتاريخ ${format(parseISO(date), "dd/MM/yyyy")}${student ? ` لـ ${student.name}` : ""}`,
    });
    setAddConflictDialog(null);
  };

  const handleCancelSession = async (studentId: string, sessionId: string, reason?: string) => {
    const student = students.find((s) => s.id === studentId);
    const session = student?.sessions.find((s) => s.id === sessionId);
    if (session) {
      const result = await recordCancellation(studentId, session.date, session.time, reason);
      removeSession(studentId, sessionId);
      if (result.success) {
        if (result.autoNotificationSent) {
          toast({
            title: "تم إلغاء الحصة وإرسال تنبيه",
            description: `تم إرسال رسالة WhatsApp تلقائياً لولي الأمر (${result.newCount}/${result.limit} إلغاءات)`,
          });
        } else if (result.limitReached || result.limitExceeded) {
          toast({
            title: "⚠️ تم الوصول للحد الأقصى",
            description: `${student?.name} وصل لـ ${result.newCount}/${result.limit} إلغاء هذا الشهر`,
            variant: "destructive",
          });
        } else {
          toast({
            title: "تم إلغاء الحصة",
            description: reason
              ? `السبب: ${reason}`
              : `إلغاء ${result.newCount}${result.limit ? `/${result.limit}` : ""} هذا الشهر`,
          });
        }
      }
    } else {
      toast({ title: "تم إلغاء الحصة", description: reason ? `السبب: ${reason}` : "تم إلغاء الحصة بنجاح" });
    }
  };

  const handleDeleteSession = (studentId: string, sessionId: string) => {
    deleteSession(studentId, sessionId);
    toast({ title: "تم حذف الحصة", description: "تم حذف الحصة نهائياً" });
  };

  // Handle quick time edit
  const handleQuickTimeEdit = (student: Student, session: Session) => {
    const currentTime = session.time || student.sessionTime || "16:00";
    setTimeEditDialog({
      open: true,
      student,
      session,
      newTime: currentTime,
    });
  };

  // Check for time conflict when editing session time
  const getTimeEditConflict = () => {
    if (!timeEditDialog.student || !timeEditDialog.session || !timeEditDialog.newTime) return null;
    return checkConflict(
      { date: timeEditDialog.session.date, startTime: timeEditDialog.newTime },
      timeEditDialog.session.id,
      timeEditDialog.student.id
    );
  };

  const confirmTimeEdit = () => {
    if (!timeEditDialog.student || !timeEditDialog.session || !timeEditDialog.newTime) return;

    const conflict = getTimeEditConflict();
    if (conflict?.severity === "error") {
      const firstConflict = conflict.conflicts[0];
      toast({
        title: "⚠️ تعارض في الوقت",
        description: firstConflict ? `لا يمكن تغيير الوقت - يوجد تعارض مع ${firstConflict.student.name}` : "يوجد تعارض في الوقت",
        variant: "destructive",
      });
      return;
    }

    updateSessionDateTime(
      timeEditDialog.student.id,
      timeEditDialog.session.id,
      timeEditDialog.session.date,
      timeEditDialog.newTime
    );
    toast({
      title: "✓ تم تعديل الوقت",
      description: `تم تغيير وقت حصة ${timeEditDialog.student.name} إلى ${timeEditDialog.newTime}`,
    });
    setTimeEditDialog({ open: false, student: null, session: null, newTime: "" });
  };

  // Add session for today handlers
  const getAddTodaySessionConflict = () => {
    if (!addTodaySessionDialog.selectedStudentId || !addTodaySessionDialog.time) return null;
    return checkConflict(
      { date: todayStr, startTime: addTodaySessionDialog.time },
      undefined,
      addTodaySessionDialog.selectedStudentId
    );
  };

  const handleAddTodaySession = () => {
    if (!addTodaySessionDialog.selectedStudentId || !addTodaySessionDialog.time) return;

    const conflict = getAddTodaySessionConflict();
    if (conflict?.severity === "error") {
      const firstConflict = conflict.conflicts[0];
      toast({
        title: "⚠️ تعارض في الوقت",
        description: firstConflict ? `لا يمكن إضافة الحصة - يوجد تعارض مع ${firstConflict.student.name}` : "يوجد تعارض في الوقت",
        variant: "destructive",
      });
      return;
    }

    const student = students.find(s => s.id === addTodaySessionDialog.selectedStudentId);
    addExtraSession(addTodaySessionDialog.selectedStudentId, todayStr, addTodaySessionDialog.time);
    toast({
      title: "✓ تمت إضافة الحصة",
      description: `تمت إضافة حصة لـ ${student?.name} اليوم الساعة ${addTodaySessionDialog.time}`,
    });
    setAddTodaySessionDialog({ open: false, selectedStudentId: "", time: "" });
  };

  const handleRestoreSession = async (studentId: string, sessionId: string) => {
    const student = students.find((s) => s.id === studentId);
    const session = student?.sessions.find((s) => s.id === sessionId);
    if (session?.status === "cancelled") await removeCancellation(studentId, session.date);
    restoreSession(studentId, sessionId);
    toast({ title: "تم استعادة الحصة", description: "تم استعادة الحصة وتحديث عداد الإلغاءات" });
  };

  const handleToggleComplete = (studentId: string, sessionId: string) => {
    const student = students.find((s) => s.id === studentId);
    const session = student?.sessions.find((s) => s.id === sessionId);
    const wasCompleted = session?.status === "completed";
    toggleSessionComplete(studentId, sessionId);
    // Auto-resolve AI suggestions when session is completed
    if (!wasCompleted) {
      resolveAIByEntity("session", sessionId);
    }
    toast({
      title: wasCompleted ? "تم إلغاء الإكمال" : "تم إكمال الحصة",
      description: wasCompleted ? "تم إرجاع الحصة إلى مجدولة" : "أحسنت! تم تسجيل الحصة كمكتملة",
    });
  };

  const handleMarkAsVacation = (studentId: string, sessionId: string) => {
    markSessionAsVacation(studentId, sessionId);
    toast({ title: "تم تحديد الحصة كإجازة", description: "لن يتم احتساب هذه الحصة في المدفوعات" });
  };

  // Payment Handlers
  const handleQuickPayment = (studentId: string, sessionId: string, sessionDate: string) => {
    const student = students.find((s) => s.id === studentId);
    if (!student) return;
    setQuickPaymentDialog({ open: true, student, sessionId, sessionDate });
  };

  const handleQuickPaymentConfirm = (amount: number, method: PaymentMethod) => {
    if (!quickPaymentDialog.student || !quickPaymentDialog.sessionId) return;
    const sessionDate = new Date(quickPaymentDialog.sessionDate);
    recordPayment(quickPaymentDialog.student.id, {
      month: sessionDate.getMonth(),
      year: sessionDate.getFullYear(),
      amount,
      method,
      paidAt: new Date().toISOString(),
      notes: `session:${quickPaymentDialog.sessionId}|date:${quickPaymentDialog.sessionDate}`,
    });
    // Auto-resolve payment-related AI suggestions
    resolveAIByEntity("payment", `${quickPaymentDialog.student.id}-${sessionDate.getFullYear()}-${sessionDate.getMonth()}`);
    const methodLabel = method === "cash" ? "كاش" : method === "bank" ? "تحويل بنكي" : "محفظة إلكترونية";
    toast({
      title: "✅ تم تسجيل الدفعة",
      description: `${quickPaymentDialog.student.name}: ${amount.toLocaleString()} جنيه (${methodLabel})`,
    });
    setQuickPaymentDialog({ open: false, student: null, sessionId: "", sessionDate: "" });
  };

  const handleRecordPayment = (
    studentId: string,
    paymentData: { month: number; year: number; amount: number; method: PaymentMethod; paidAt: string; notes?: string },
  ) => {
    const student = students.find((s) => s.id === studentId);
    if (!student) return;
    recordPayment(studentId, paymentData);
    // Auto-resolve payment-related AI suggestions
    resolveAIByEntity("payment", `${studentId}-${paymentData.year}-${paymentData.month}`);
    const methodLabel =
      paymentData.method === "cash" ? "كاش" : paymentData.method === "bank" ? "تحويل بنكي" : "محفظة إلكترونية";
    toast({
      title: "✅ تم تسجيل الدفعة",
      description: `${student.name}: ${paymentData.amount.toLocaleString()} جنيه (${methodLabel})`,
    });
  };

  // AI Suggestions Action Handlers
  const [sessionNotesDialogOpen, setSessionNotesDialogOpen] = useState<{
    open: boolean;
    studentId: string;
    sessionId: string;
  } | null>(null);

  const aiSuggestionHandlers: ActionHandlers = {
    openStudent: (studentId: string) => {
      // Switch to history tab and scroll to student
      setActiveTab("history");
      // Could also open edit dialog
    },
    openPayment: (studentId: string) => {
      const student = students.find((s) => s.id === studentId);
      if (student) {
        // Find most recent session for context
        const recentSession = student.sessions
          .filter((s) => s.status === "completed")
          .sort((a, b) => b.date.localeCompare(a.date))[0];

        setQuickPaymentDialog({
          open: true,
          student,
          sessionId: recentSession?.id || "",
          sessionDate: recentSession?.date || format(now, "yyyy-MM-dd"),
        });
      }
    },
    openSessionNotes: (studentId: string, sessionId: string) => {
      setSessionNotesDialogOpen({ open: true, studentId, sessionId });
    },
    showTodaySessions: () => {
      setActiveTab("sessions");
    },
    showCalendar: () => {
      setActiveTab("calendar");
    },
    markComplete: (studentId: string, sessionId: string) => {
      toggleSessionComplete(studentId, sessionId);
      // Auto-resolve AI suggestions related to this session
      resolveAIByEntity("session", sessionId);
      toast({
        title: "✅ تم تحديث الحصة",
        description: "تم تسجيل الحصة كمكتملة",
      });
    },
    sendWhatsAppReminder: async (studentId: string) => {
      const student = students.find((s) => s.id === studentId);
      if (!student || !student.phone) {
        toast({
          title: "خطأ",
          description: "لا يوجد رقم هاتف مسجل لهذا الطالب",
          variant: "destructive",
        });
        return;
      }

      try {
        // Build payment reminder message
        const customMessage = `عزيزي ولي الأمر،\nتذكير بدفع المستحقات المتأخرة لـ ${student.name}\nبرجاء التواصل معنا لتسوية المبلغ المستحق.\nشكراً لتعاونكم`;

        const { error } = await supabase.functions.invoke("send-whatsapp-reminder", {
          body: {
            phone: student.phone,
            message: customMessage,
            studentName: student.name,
            phoneNumber: student.phone,
            customMessage: customMessage,
          },
        });

        if (error) throw error;

        toast({
          title: "✅ تم الإرسال",
          description: `تم إرسال تذكير WhatsApp إلى ${student.name}`,
        });
      } catch (error: unknown) {
        console.error("WhatsApp error:", error);
        const errorMessage = error instanceof Error ? error.message : "فشل إرسال الرسالة";
        toast({
          title: "خطأ",
          description: errorMessage,
          variant: "destructive",
        });
      }
    },
  };

  // Computed Values
  const selectedMonth = now.getMonth();
  const selectedYear = now.getFullYear();
  const todayStr = format(now, "yyyy-MM-dd");
  const currentTimeStr = format(now, "HH:mm");

  const allTodaySessions = useMemo((): SessionWithStudent[] => {
    const sessions: SessionWithStudent[] = [];
    students.forEach((student) => {
      student.sessions
        .filter((s) => s.date === todayStr)
        .forEach((session) => {
          sessions.push({ session, student });
        });
    });
    return sessions.sort((a, b) => {
      const timeA = a.session.time || a.student.sessionTime || "00:00";
      const timeB = b.session.time || b.student.sessionTime || "00:00";
      return timeA.localeCompare(timeB);
    });
  }, [students, todayStr]);

  const todayStats = useMemo(() => {
    const total = allTodaySessions.length;
    const completed = allTodaySessions.filter((s) => s.session.status === "completed").length;
    const scheduled = allTodaySessions.filter((s) => s.session.status === "scheduled").length;
    const cancelled = allTodaySessions.filter((s) => s.session.status === "cancelled").length;
    const vacation = allTodaySessions.filter((s) => s.session.status === "vacation").length;
    const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, scheduled, cancelled, vacation, progressPercent };
  }, [allTodaySessions]);

  const nextSession = useMemo((): SessionWithStudent | null => {
    return (
      allTodaySessions.find((item) => {
        if (item.session.status !== "scheduled") return false;
        const sessionTime = item.session.time || item.student.sessionTime || "00:00";
        return sessionTime >= currentTimeStr;
      }) || null
    );
  }, [allTodaySessions, currentTimeStr]);

  const timeUntilNext = useMemo(() => {
    if (!nextSession) return null;
    const sessionTime = nextSession.session.time || nextSession.student.sessionTime || "16:00";
    const [hours, minutes] = sessionTime.split(":").map(Number);
    const sessionDateTime = new Date(now);
    sessionDateTime.setHours(hours, minutes, 0, 0);
    const diffMinutes = differenceInMinutes(sessionDateTime, now);
    if (diffMinutes <= 0) return "الآن";
    if (diffMinutes < 60) return `بعد ${diffMinutes} دقيقة`;
    const diffHours = Math.floor(diffMinutes / 60);
    const remainingMinutes = diffMinutes % 60;
    if (remainingMinutes === 0) return `بعد ${diffHours} ساعة`;
    return `بعد ${diffHours} ساعة و ${remainingMinutes} دقيقة`;
  }, [nextSession, now]);

  const allStudentsSortedByTime = useMemo(() => {
    const searchLower = allStudentsSearch.trim().toLowerCase();
    return [...students]
      .filter((s) => searchLower === "" || s.name.toLowerCase().includes(searchLower))
      .sort((a, b) => (a.sessionTime || "").localeCompare(b.sessionTime || ""));
  }, [students, allStudentsSearch]);

  const visibleSessions = showAllSessions ? allTodaySessions : allTodaySessions.slice(0, 5);
  const hasMoreSessions = allTodaySessions.length > 5;

  const getGreeting = () => {
    const hour = now.getHours();
    if (hour < 12) return "صباح الخير";
    if (hour < 18) return "مساءً سعيداً";
    return "مساء الخير";
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
        {/* Dynamic Background - Navy & Ivory */}
        <div className="fixed inset-0 -z-20">
          <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-primary/5 dark:from-background dark:via-background dark:to-primary/10" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,hsl(var(--primary)/0.08),rgba(255,255,255,0))]" />
          <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-gradient-to-br from-primary/15 via-primary/10 to-primary/5 rounded-full blur-3xl animate-blob" />
          <div className="absolute top-1/3 -left-40 w-[400px] h-[400px] bg-gradient-to-tr from-primary/10 via-primary/8 to-primary/5 rounded-full blur-3xl animate-blob animation-delay-2000" />
          <div className="absolute -bottom-40 right-1/4 w-[450px] h-[450px] bg-gradient-to-r from-primary/10 via-primary/8 to-primary/5 rounded-full blur-3xl animate-blob animation-delay-4000" />
        </div>

        {/* Loading content */}
        <div className="relative text-center space-y-6 z-10">
          {/* Animated logo */}
          <div className="relative">
            <div className="w-24 h-24 mx-auto rounded-3xl bg-gradient-to-br from-primary via-primary/80 to-primary/60 shadow-2xl shadow-primary/40 flex items-center justify-center">
              <GraduationCap className="h-12 w-12 text-primary-foreground animate-pulse" />
            </div>
            {/* Glow ring */}
            <div className="absolute inset-0 w-24 h-24 mx-auto rounded-3xl border-4 border-primary/30 animate-ping" />
            {/* Orbiting dots - Navy blue theme */}
            <div className="absolute inset-0 w-32 h-32 mx-auto -mt-4 animate-spin-slow" style={{ marginRight: '-1rem' }}>
              <div className="absolute top-0 left-1/2 w-2 h-2 bg-primary rounded-full" />
              <div className="absolute bottom-0 left-1/2 w-2 h-2 bg-primary/80 rounded-full" />
              <div className="absolute left-0 top-1/2 w-2 h-2 bg-primary/60 rounded-full" />
              <div className="absolute right-0 top-1/2 w-2 h-2 bg-primary/70 rounded-full" />
            </div>
          </div>

          {/* Loading text */}
          <div className="space-y-2">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
              متابعة الطلاب
            </h2>
            <p className="text-sm text-muted-foreground">جاري تحميل بياناتك...</p>
          </div>

          {/* Loading bar */}
          <div className="w-48 mx-auto">
            <div className="h-1.5 bg-primary/10 dark:bg-primary/20 rounded-full overflow-hidden">
              <div className="h-full w-1/3 bg-gradient-to-r from-primary via-primary/80 to-primary/60 rounded-full animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      dir="rtl"
      className="min-h-screen safe-bottom relative overflow-x-hidden"
    >
      {/* Dynamic Background - Navy & Ivory Theme */}
      <div className="fixed inset-0 -z-20">
        {/* Base gradient - Ivory to subtle navy tint */}
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-primary/5 dark:from-background dark:via-background dark:to-primary/10" />

        {/* Mesh gradient overlay - Navy tint */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,hsl(var(--primary)/0.06),rgba(255,255,255,0))]" />

        {/* Animated gradient orbs - Navy variations */}
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-gradient-to-br from-primary/12 via-primary/8 to-primary/4 rounded-full blur-3xl animate-blob" />
        <div className="absolute top-1/3 -left-40 w-[400px] h-[400px] bg-gradient-to-tr from-primary/10 via-primary/6 to-primary/3 rounded-full blur-3xl animate-blob animation-delay-2000" />
        <div className="absolute -bottom-40 right-1/4 w-[450px] h-[450px] bg-gradient-to-r from-primary/8 via-primary/5 to-primary/3 rounded-full blur-3xl animate-blob animation-delay-4000" />
        <div className="absolute bottom-1/4 left-1/3 w-[300px] h-[300px] bg-gradient-to-tl from-primary/10 via-primary/6 to-primary/3 rounded-full blur-3xl animate-blob animation-delay-3000" />

        {/* Subtle noise texture */}
        <div className="absolute inset-0 opacity-[0.015] dark:opacity-[0.03]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.65\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")' }} />

        {/* Grid pattern - Navy lines */}
        <div className="absolute inset-0 bg-[linear-gradient(hsl(var(--primary)/0.03)_1.5px,transparent_1.5px),linear-gradient(90deg,hsl(var(--primary)/0.03)_1.5px,transparent_1.5px)] bg-[size:50px_50px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,black_40%,transparent_100%)]" />
      </div>

      {/* Floating particles layer - Navy */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        {/* Animated dots - All navy */}
        <div className="absolute top-20 right-[10%] w-2 h-2 bg-primary/30 rounded-full animate-float" />
        <div className="absolute top-[30%] left-[5%] w-3 h-3 bg-primary/20 rounded-full animate-float animation-delay-1000" />
        <div className="absolute top-[60%] right-[15%] w-2 h-2 bg-primary/25 rounded-full animate-float animation-delay-2000" />
        <div className="absolute top-[45%] left-[20%] w-1.5 h-1.5 bg-primary/30 rounded-full animate-float animation-delay-3000" />
        <div className="absolute bottom-[25%] right-[25%] w-2 h-2 bg-primary/20 rounded-full animate-float animation-delay-1500" />
        <div className="absolute bottom-[40%] left-[10%] w-2.5 h-2.5 bg-primary/20 rounded-full animate-float animation-delay-2500" />

        {/* Sparkle effects */}
        <div className="absolute top-[15%] right-[30%] animate-pulse">
          <svg className="w-4 h-4 text-primary/20" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
          </svg>
        </div>
        <div className="absolute top-[50%] left-[15%] animate-pulse animation-delay-2000">
          <svg className="w-3 h-3 text-primary/25" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
          </svg>
        </div>
        <div className="absolute bottom-[30%] right-[8%] animate-pulse animation-delay-1000">
          <svg className="w-3.5 h-3.5 text-primary/20" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
          </svg>
        </div>

        {/* Light rays effect */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-to-b from-primary/5 via-transparent to-transparent [mask-image:linear-gradient(to_bottom,white,transparent)] opacity-50" />
      </div>

      {/* Session Notification Banner */}
      {upcomingNotification && (
        <SessionNotificationBanner
          student={upcomingNotification.student}
          session={upcomingNotification.session}
          minutesUntil={upcomingNotification.minutesUntil}
          onDismiss={dismissNotification}
        />
      )}

      <header className="bg-card/70 backdrop-blur-xl border-b border-border/50 sticky top-0 z-10 safe-top shadow-sm">
        <div className="px-2 py-1.5 sm:px-5 sm:py-3">
          <div className="flex items-center justify-between gap-1.5 sm:gap-3">
            {/* Logo and Title */}
            <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-gradient-to-br from-primary via-primary to-primary/80 shadow-md shadow-primary/25 flex items-center justify-center shrink-0">
                <GraduationCap className="h-4 w-4 sm:h-5 sm:w-5 text-primary-foreground" />
              </div>
              <div className="min-w-0 hidden xs:block">
                <h1 className="font-display font-bold text-sm sm:text-lg leading-tight truncate">متابعة الطلاب</h1>
                <p className="text-[0.6rem] sm:text-xs text-muted-foreground font-medium">
                  {format(now, "EEEE، d MMM", { locale: ar })}
                </p>
              </div>
            </div>

            {/* Action buttons - Desktop */}
            <div className="hidden sm:flex items-center gap-1.5">
              <AISuggestionsWidget
                currentSuggestion={aiCurrentSuggestion}
                pendingCount={aiPendingCount}
                allPendingSuggestions={aiAllPending}
                hasCriticalInterrupt={aiHasCriticalInterrupt}
                dismissedHistory={aiDismissedHistory}
                onDismiss={dismissAISuggestion}
                onAction={actionAISuggestion}
                onDismissCriticalOverlay={dismissAICriticalOverlay}
                actionHandlers={aiSuggestionHandlers}
              />
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 gap-2 rounded-lg border-2">
                    <Users className="h-4 w-4" />
                    <span className="text-sm font-semibold">الطلاب</span>
                    <Badge variant="secondary" className="h-5 px-2 text-xs font-bold">{students.length}</Badge>
                  </Button>
                </SheetTrigger>
                <SheetContent className="w-full sm:max-w-md" side="left">
                  <SheetHeader>
                    <SheetTitle className="font-heading text-right">جميع الطلاب ({students.length})</SheetTitle>
                  </SheetHeader>
                  <div className="mt-4">
                    <StudentSearchCombobox students={students} value={allStudentsSearch} onChange={setAllStudentsSearch} placeholder="ابحث عن طالب..." />
                  </div>
                  <div className="mt-3 space-y-2 max-h-[calc(100vh-180px)] overflow-y-auto" dir="rtl">
                    {allStudentsSortedByTime.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">{allStudentsSearch.trim() ? "لا يوجد نتائج" : "لا يوجد طلاب حتى الآن"}</p>
                    ) : (
                      allStudentsSortedByTime.map((student) => (
                        <div key={student.id} className="flex items-center justify-between p-2 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium truncate text-sm">{student.name}</p>
                            <div className="flex items-center gap-1.5 text-[0.65rem] text-muted-foreground mt-0.5">
                              <span className="flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" />{student.sessionTime}</span>
                              <span>•</span>
                              <span>{(student.sessionType || "onsite") === "online" ? "أونلاين" : "حضوري"}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-0.5">
                            <EditStudentDialog student={student} students={students} appSettings={settings} currentCancellationCount={getCancellationCount(student.id)} allCancellations={getAllStudentCancellations(student.id)} onRestoreSession={handleRestoreSession} onClearMonthCancellations={clearMonthCancellations} onUpdateName={(name) => updateStudentName(student.id, name)} onUpdateTime={(time) => updateStudentTime(student.id, time)} onUpdatePhone={(phone) => updateStudentPhone(student.id, phone)} onUpdateParentPhone={(parentPhone) => updateStudentParentPhone(student.id, parentPhone)} onUpdateSessionType={(type) => updateStudentSessionType(student.id, type)} onUpdateSchedule={(days, start, end) => updateStudentSchedule(student.id, days, start, end)} onUpdateDuration={(duration) => updateStudentDuration(student.id, duration)} onUpdateCustomSettings={(settings) => updateStudentCustomSettings(student.id, settings)} onUpdateCancellationPolicy={(policy) => updateStudentCancellationPolicy(student.id, policy)} />
                            {student.phone && (
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-primary" onClick={() => openWhatsApp(student.phone!)}><WhatsAppIcon className="h-3.5 w-3.5" /></Button>
                            )}
                            <AlertDialog>
                              <AlertDialogTrigger asChild><Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button></AlertDialogTrigger>
                              <AlertDialogContent dir="rtl">
                                <AlertDialogHeader><AlertDialogTitle>حذف الطالب</AlertDialogTitle><AlertDialogDescription>هل أنت متأكد من حذف {student.name}؟</AlertDialogDescription></AlertDialogHeader>
                                <AlertDialogFooter className="flex-row-reverse gap-2"><AlertDialogCancel>إلغاء</AlertDialogCancel><AlertDialogAction onClick={() => removeStudent(student.id)} className="bg-destructive text-destructive-foreground">حذف</AlertDialogAction></AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </SheetContent>
              </Sheet>
              <AddVacationDialog students={students} onBulkMarkAsVacation={bulkMarkAsVacation} />
              <BulkEditSessionsDialog students={students} onBulkUpdateTime={bulkUpdateSessionTime as (studentIds: string[], sessionIds: string[], newTime: string) => { success: boolean; updatedCount: number; conflicts: [] }} onUpdateSessionDate={updateSessionDateTime} onBulkMarkAsVacation={bulkMarkAsVacation} />
              <MonthlyReportDialog students={students} payments={payments} settings={settings} />
              <ReminderHistoryDialog />
              <ReminderSettingsDialog />
              <NotificationSettingsDialog settings={notificationSettings} onSave={updateNotificationSettings} />
              <SemesterSettings settings={settings} onUpdate={updateSettings} />
              <AddStudentDialog onAdd={handleAddStudent} defaultStart={settings.defaultSemesterStart} defaultEnd={settings.defaultSemesterEnd} students={students} settings={settings} defaultDuration={settings.defaultSessionDuration} defaultPriceOnsite={settings.defaultPriceOnsite} defaultPriceOnline={settings.defaultPriceOnline} />
            </div>

            {/* Mobile action buttons - simplified */}
            <div className="flex sm:hidden items-center gap-0.5">
              <AISuggestionsWidget
                currentSuggestion={aiCurrentSuggestion}
                pendingCount={aiPendingCount}
                allPendingSuggestions={aiAllPending}
                hasCriticalInterrupt={aiHasCriticalInterrupt}
                dismissedHistory={aiDismissedHistory}
                onDismiss={dismissAISuggestion}
                onAction={actionAISuggestion}
                onDismissCriticalOverlay={dismissAICriticalOverlay}
                actionHandlers={aiSuggestionHandlers}
              />
              {/* Students Sheet - Mobile */}
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
                    <Users className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent className="w-full p-3" side="left">
                  <SheetHeader className="pb-2">
                    <SheetTitle className="text-sm text-right">الطلاب ({students.length})</SheetTitle>
                  </SheetHeader>
                  <StudentSearchCombobox students={students} value={allStudentsSearch} onChange={setAllStudentsSearch} placeholder="بحث..." />
                  <div className="mt-2 space-y-1.5 max-h-[calc(100vh-140px)] overflow-y-auto" dir="rtl">
                    {allStudentsSortedByTime.map((student) => (
                      <div key={student.id} className="flex items-center justify-between p-2 rounded-lg border bg-card">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate text-xs">{student.name}</p>
                          <p className="text-[0.6rem] text-muted-foreground">{student.sessionTime} • {(student.sessionType || "onsite") === "online" ? "أونلاين" : "حضوري"}</p>
                        </div>
                        <div className="flex items-center gap-0.5">
                          <EditStudentDialog student={student} students={students} appSettings={settings} currentCancellationCount={getCancellationCount(student.id)} allCancellations={getAllStudentCancellations(student.id)} onRestoreSession={handleRestoreSession} onClearMonthCancellations={clearMonthCancellations} onUpdateName={(name) => updateStudentName(student.id, name)} onUpdateTime={(time) => updateStudentTime(student.id, time)} onUpdatePhone={(phone) => updateStudentPhone(student.id, phone)} onUpdateParentPhone={(parentPhone) => updateStudentParentPhone(student.id, parentPhone)} onUpdateSessionType={(type) => updateStudentSessionType(student.id, type)} onUpdateSchedule={(days, start, end) => updateStudentSchedule(student.id, days, start, end)} onUpdateDuration={(duration) => updateStudentDuration(student.id, duration)} onUpdateCustomSettings={(settings) => updateStudentCustomSettings(student.id, settings)} onUpdateCancellationPolicy={(policy) => updateStudentCancellationPolicy(student.id, policy)} />
                          {student.phone && <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => openWhatsApp(student.phone!)}><WhatsAppIcon className="h-3 w-3" /></Button>}
                        </div>
                      </div>
                    ))}
                  </div>
                </SheetContent>
              </Sheet>
              {/* Add Student - Mobile */}
              <AddStudentDialog onAdd={handleAddStudent} defaultStart={settings.defaultSemesterStart} defaultEnd={settings.defaultSemesterEnd} students={students} settings={settings} defaultDuration={settings.defaultSessionDuration} defaultPriceOnsite={settings.defaultPriceOnsite} defaultPriceOnline={settings.defaultPriceOnline} />
              {/* More Menu - Mobile */}
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent className="w-full p-3" side="left">
                  <SheetHeader className="pb-2">
                    <SheetTitle className="text-sm text-right">المزيد</SheetTitle>
                  </SheetHeader>
                  <div className="space-y-1 mt-2">
                    <div className="grid grid-cols-2 gap-2">
                      <AddVacationDialog students={students} onBulkMarkAsVacation={bulkMarkAsVacation} />
                      <BulkEditSessionsDialog students={students} onBulkUpdateTime={bulkUpdateSessionTime as (studentIds: string[], sessionIds: string[], newTime: string) => { success: boolean; updatedCount: number; conflicts: [] }} onUpdateSessionDate={updateSessionDateTime} onBulkMarkAsVacation={bulkMarkAsVacation} />
                      <MonthlyReportDialog students={students} payments={payments} settings={settings} />
                      <ReminderHistoryDialog />
                      <ReminderSettingsDialog />
                      <NotificationSettingsDialog settings={notificationSettings} onSave={updateNotificationSettings} />
                      <SemesterSettings settings={settings} onUpdate={updateSettings} />
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </header>

      <main className="px-1.5 py-2 sm:px-4 sm:py-4 space-y-2 sm:space-y-4 max-w-5xl mx-auto">
        {/* Compact greeting bar - hidden on very small screens */}
        {students.length > 0 && activeTab === "sessions" && (
          <div className="hidden xs:flex items-center justify-between gap-2 p-2 sm:p-3 bg-card rounded-lg border shadow-sm">
            <div className="flex items-center gap-2 min-w-0">
              <Sparkles className="h-4 w-4 text-primary shrink-0" />
              <span className="font-semibold text-foreground text-sm">{getGreeting()} عمر!</span>
              <div className="flex items-center gap-1.5 text-xs">
                <Badge variant="outline" className="gap-1 bg-primary/10 text-primary border-primary/30 text-xs px-1.5 py-0">
                  {todayStats.total} حصص
                </Badge>
                {todayStats.completed > 0 && (
                  <Badge variant="outline" className="gap-1 bg-primary/20 text-primary border-primary/40 text-xs px-1.5 py-0">
                    {todayStats.completed} ✓
                  </Badge>
                )}
              </div>
            </div>
            {todayStats.total > 0 && (
              <div className="flex items-center gap-2">
                <div className="hidden sm:block w-24 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-500"
                    style={{ width: `${todayStats.progressPercent}%` }}
                  />
                </div>
                <span className="text-sm font-bold text-primary">{todayStats.progressPercent}%</span>
              </div>
            )}
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full grid grid-cols-4 mb-3 sm:mb-4 h-auto min-h-[2.75rem] sm:h-12 bg-muted/50 p-0.5 sm:p-1 rounded-lg sm:rounded-xl gap-0.5 sm:gap-1">
            <TabsTrigger
              value="sessions"
              className="flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 text-[0.6rem] sm:text-sm rounded-md sm:rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all font-medium py-1.5 sm:py-2 px-1 sm:px-3"
            >
              <BookOpen className="h-4 w-4 sm:h-4 sm:w-4 shrink-0" />
              <span className="leading-tight">الحصص</span>
            </TabsTrigger>
            <TabsTrigger
              value="calendar"
              className="flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 text-[0.6rem] sm:text-sm rounded-md sm:rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all font-medium py-1.5 sm:py-2 px-1 sm:px-3"
            >
              <CalendarDays className="h-4 w-4 sm:h-4 sm:w-4 shrink-0" />
              <span className="leading-tight">التقويم</span>
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 text-[0.6rem] sm:text-sm rounded-md sm:rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all font-medium py-1.5 sm:py-2 px-1 sm:px-3"
            >
              <History className="h-4 w-4 sm:h-4 sm:w-4 shrink-0" />
              <span className="leading-tight hidden xs:inline sm:inline">الطلبة</span>
              <span className="leading-tight xs:hidden">طلبة</span>
            </TabsTrigger>
            <TabsTrigger
              value="payments"
              className="flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 text-[0.6rem] sm:text-sm rounded-md sm:rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all font-medium py-1.5 sm:py-2 px-1 sm:px-3"
            >
              <CreditCard className="h-4 w-4 sm:h-4 sm:w-4 shrink-0" />
              <span className="leading-tight hidden xs:inline sm:inline">المدفوعات</span>
              <span className="leading-tight xs:hidden">دفع</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sessions" className="mt-0 space-y-4">
            {students.length === 0 ? (
              <EmptyState />
            ) : allTodaySessions.length === 0 ? (
              <Card className="border-2 border-dashed bg-gradient-to-br from-muted/30 to-muted/10">
                <CardContent className="p-10 text-center">
                  <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                    <CalendarDays className="h-10 w-10 text-primary/60" />
                  </div>
                  <h3 className="font-display font-bold text-xl mb-2">لا توجد حصص اليوم 🎉</h3>
                  <p className="text-sm text-muted-foreground mb-1">{format(now, "EEEE، d MMMM yyyy", { locale: ar })}</p>
                  <p className="text-xs text-muted-foreground">استمتع بيوم إجازة! أو أضف حصصاً جديدة من التقويم</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {/* Today's Stats Dashboard */}
                <TodaySessionsStats students={students} settings={settings} payments={payments} />

                {/* End of Day Checker - Floating button that appears after all sessions end */}
                <EndOfDayChecker students={students} onToggleComplete={handleToggleComplete} />

                {nextSession && (
                  <Card className="border-2 border-primary/30 bg-gradient-to-r from-primary/5 via-primary/3 to-transparent overflow-hidden shadow-lg shadow-primary/5">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative">
                            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shrink-0 shadow-lg">
                              <Timer className="h-7 w-7 text-primary-foreground" />
                            </div>
                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full border-2 border-white animate-pulse" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs text-muted-foreground mb-0.5 font-medium">⏰ الحصة القادمة</p>
                            <div className="flex items-center gap-2">
                              <p className="font-display font-bold text-lg truncate">{nextSession.student.name}</p>
                              {/* Contact Buttons for Next Session */}
                              {nextSession.student.phone && (
                                <div className="flex items-center gap-1">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7 text-primary hover:text-primary hover:bg-primary/10"
                                    onClick={() => openWhatsApp(nextSession.student.phone!)}
                                    title="رسالة واتساب"
                                  >
                                    <WhatsAppIcon className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7 text-primary hover:text-primary hover:bg-primary/10"
                                    onClick={() => window.open(`tel:${nextSession.student.phone}`, "_self")}
                                    title="اتصال هاتفي"
                                  >
                                    <Phone className="h-4 w-4" />
                                  </Button>
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Clock className="h-3.5 w-3.5" />
                              <span className="font-medium">{nextSession.session.time || nextSession.student.sessionTime}</span>
                              {timeUntilNext && (
                                <>
                                  <span>•</span>
                                  <span className="text-primary font-bold">{timeUntilNext}</span>
                                </>
                              )}
                              <span>•</span>
                              <span className={nextSession.student.sessionType === "online" ? "text-primary" : "text-primary/80"}>
                                {nextSession.student.sessionType === "online" ? "أونلاين" : "حضوري"}
                              </span>
                            </div>

                            {/* Last Session Notes for Next Session */}
                            {(() => {
                              const todayStr = format(now, "yyyy-MM-dd");
                              const lastSession = getLastSessionWithNotes(nextSession.student, todayStr);

                              // If no past completed sessions, don't show anything
                              if (!lastSession) return null;

                              const hasContent = lastSession.notes || lastSession.homework || lastSession.topic;

                              return (
                                <div className="mt-2 p-2 rounded-lg bg-primary/10 border border-primary/20 text-xs space-y-1">
                                  <div className="flex items-center gap-1.5 text-primary dark:text-primary font-medium">
                                    <FileText className="h-3 w-3" />
                                    <span>الحصة السابقة ({format(parseISO(lastSession.date), "d/M", { locale: ar })})</span>
                                  </div>
                                  {!hasContent && (
                                    <p className="text-muted-foreground italic">لا توجد ملاحظات مسجلة</p>
                                  )}
                                  {lastSession.topic && (
                                    <p className="text-muted-foreground flex items-center gap-1">
                                      <BookOpen className="h-3 w-3 text-primary" />
                                      <span className="font-medium">{lastSession.topic}</span>
                                    </p>
                                  )}
                                  {lastSession.notes && (
                                    <p className="text-muted-foreground line-clamp-2">{lastSession.notes}</p>
                                  )}
                                  {lastSession.homework && (
                                    <div className="flex items-center gap-1 p-1.5 rounded bg-primary/10 text-primary">
                                      <BookOpen className="h-3 w-3" />
                                      <span className="font-medium">واجب:</span>
                                      <span className="line-clamp-1">{lastSession.homework}</span>
                                      {lastSession.homeworkStatus === "completed" && (
                                        <Badge className="h-4 px-1 text-[10px] bg-primary/20 text-primary">✓</Badge>
                                      )}
                                      {lastSession.homeworkStatus === "incomplete" && (
                                        <Badge className="h-4 px-1 text-[10px] bg-muted text-muted-foreground">✗</Badge>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {/* Session Notes for Next Session */}
                          <SessionNotesDialog
                            session={nextSession.session}
                            studentName={nextSession.student.name}
                            onSave={(details) => updateSessionDetails(nextSession.student.id, nextSession.session.id, details)}
                          />
                          {/* Complete button - only show if session has ended */}
                          {isSessionEnded(
                            nextSession.session.date,
                            nextSession.session.time || nextSession.student.sessionTime || "16:00",
                            nextSession.session.duration || nextSession.student.sessionDuration || 60
                          ) ? (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="sm"
                                  className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 h-9 px-4"
                                >
                                  <Check className="h-4 w-4" />
                                  <span className="hidden sm:inline">إكمال</span>
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent dir="rtl">
                                <AlertDialogHeader>
                                  <AlertDialogTitle>تأكيد إكمال الحصة</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    هل تريد تسجيل حصة <strong>{nextSession.student.name}</strong> كمكتملة؟
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter className="flex-row-reverse gap-2">
                                  <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleToggleComplete(nextSession.student.id, nextSession.session.id)}
                                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                                  >
                                    تأكيد الإكمال
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          ) : isSessionInProgress(
                            nextSession.session.date,
                            nextSession.session.time || nextSession.student.sessionTime || "16:00",
                            nextSession.session.duration || nextSession.student.sessionDuration || 60
                          ) ? (
                            <div className="flex items-center gap-1.5 h-9 px-3 rounded-md bg-primary/10 text-primary text-sm font-medium">
                              <Clock className="h-4 w-4 animate-pulse" />
                              <span className="hidden sm:inline">جارية</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 h-9 px-3 rounded-md bg-primary/10 text-primary text-sm font-medium">
                              <Clock className="h-4 w-4" />
                              <span className="hidden sm:inline">مجدولة</span>
                            </div>
                          )}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-muted-foreground/50 text-muted-foreground hover:bg-muted gap-1.5 h-9 px-4"
                              >
                                <XCircle className="h-4 w-4" />
                                <span className="hidden sm:inline">إلغاء</span>
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent dir="rtl">
                              <AlertDialogHeader>
                                <AlertDialogTitle>تأكيد إلغاء الحصة</AlertDialogTitle>
                                <AlertDialogDescription>
                                  هل تريد إلغاء حصة <strong>{nextSession.student.name}</strong>؟
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter className="flex-row-reverse gap-2">
                                <AlertDialogCancel>رجوع</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => {
                                    const reason = prompt("سبب الإلغاء (اختياري):");
                                    handleCancelSession(
                                      nextSession.student.id,
                                      nextSession.session.id,
                                      reason || undefined,
                                    );
                                  }}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  تأكيد الإلغاء
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 h-9 px-3"
                            onClick={() => setCompletionDialog({ open: true, student: nextSession.student, session: nextSession.session })}
                            title="خيارات الحصة"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Card className="border overflow-hidden shadow-lg">
                  <CardHeader className="pb-3 border-b bg-gradient-to-r from-muted/50 to-muted/30">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base font-display font-bold flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-primary/10">
                          <Clock className="h-4 w-4 text-primary" />
                        </div>
                        جدول اليوم
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        {/* Add Session Button */}
                        <Button
                          size="sm"
                          onClick={() => setAddTodaySessionDialog({ open: true, selectedStudentId: "", time: "" })}
                          className="h-8 gap-1.5 bg-gradient-to-r from-primary to-blue-500 text-xs"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          إضافة حصة
                        </Button>
                        <div className="flex items-center gap-1.5 text-xs">
                          {todayStats.scheduled > 0 && (
                            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 font-semibold">
                              {todayStats.scheduled} مجدولة
                            </Badge>
                          )}
                          {todayStats.completed > 0 && (
                            <Badge variant="outline" className="bg-primary/20 text-primary border-primary/40 font-semibold">
                              {todayStats.completed} مكتملة
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y">
                      {visibleSessions.map((item, index) => {
                        const { session, student } = item;
                        const sessionTime = session.time || student.sessionTime || "16:00";
                        const sessionDuration = session.duration || student.sessionDuration || 60;
                        const isCompleted = session.status === "completed";
                        const isCancelled = session.status === "cancelled";
                        const isVacation = session.status === "vacation";
                        const isScheduled = session.status === "scheduled";
                        const isNextSession = nextSession?.session.id === session.id;
                        const isOnline = student.sessionType === "online";
                        return (
                          <div
                            key={session.id}
                            className={cn(
                              "flex gap-3 sm:gap-4 p-3 sm:p-4 transition-all group",
                              isCompleted && "bg-primary/5",
                              isCancelled && "bg-muted/50 opacity-60",
                              isVacation && "bg-muted/30",
                              isScheduled && !isNextSession && "hover:bg-muted/50",
                              isNextSession && "bg-gradient-to-r from-primary/10 to-transparent ring-1 ring-primary/20",
                            )}
                          >
                            <div className="flex flex-col items-center">
                              <div
                                className={cn(
                                  "w-14 h-14 rounded-xl flex flex-col items-center justify-center font-bold text-sm border-2 shadow-sm relative overflow-hidden",
                                  isCompleted && "bg-primary text-primary-foreground border-primary",
                                  isCancelled && "bg-muted text-muted-foreground border-border",
                                  isVacation && "bg-secondary text-secondary-foreground border-border",
                                  isScheduled && "bg-primary/90 text-primary-foreground border-primary",
                                  isScheduled && "cursor-pointer hover:scale-105 transition-transform",
                                )}
                                onClick={() => isScheduled && handleQuickTimeEdit(student, session)}
                                title={isScheduled ? "اضغط لتعديل الوقت" : undefined}
                              >
                                <span className="text-base font-bold">{sessionTime.substring(0, 5)}</span>
                                <span className="text-[9px] opacity-80">{sessionDuration}د</span>
                                {isScheduled && (
                                  <div className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Pencil className="h-2.5 w-2.5" />
                                  </div>
                                )}
                                {isNextSession && (
                                  <div className="absolute inset-0 bg-gradient-to-t from-white/20 to-transparent animate-pulse" />
                                )}
                              </div>
                              {index < visibleSessions.length - 1 && (
                                <div
                                  className={cn(
                                    "w-0.5 flex-1 mt-2 min-h-[16px]",
                                    isCompleted && "bg-primary/40",
                                    isCancelled && "bg-muted-foreground/30",
                                    isVacation && "bg-muted-foreground/30",
                                    isScheduled && "bg-primary/30",
                                  )}
                                />
                              )}
                            </div>
                            <div className="flex-1 min-w-0 py-1">
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className={cn(
                                    "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                                    isOnline ? "bg-primary/10" : "bg-primary/15"
                                  )}>
                                    {isOnline ? (
                                      <Monitor className="h-4 w-4 text-primary" />
                                    ) : (
                                      <MapPin className="h-4 w-4 text-primary" />
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <h4 className="font-bold text-base truncate">{student.name}</h4>
                                    <p className="text-xs text-muted-foreground">
                                      {isOnline ? "أونلاين" : "حضوري"} • {sessionDuration} دقيقة
                                    </p>
                                  </div>
                                  {/* Contact Buttons */}
                                  {student.phone && (
                                    <div className="flex items-center gap-1 mr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-7 w-7 text-primary hover:text-primary hover:bg-primary/10"
                                        onClick={() => openWhatsApp(student.phone!)}
                                        title="رسالة واتساب"
                                      >
                                        <WhatsAppIcon className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-7 w-7 text-primary hover:text-primary hover:bg-primary/10"
                                        onClick={() => window.open(`tel:${student.phone}`, "_self")}
                                        title="اتصال هاتفي"
                                      >
                                        <Phone className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5">
                                  {/* Session Notes Button */}
                                  <SessionNotesDialog
                                    session={session}
                                    studentName={student.name}
                                    onSave={(details) => updateSessionDetails(student.id, session.id, details)}
                                  />
                                  <Badge
                                    className={cn(
                                      "shrink-0 text-xs font-semibold",
                                      isCompleted && "bg-primary text-primary-foreground",
                                      isCancelled && "bg-muted text-muted-foreground",
                                      isVacation && "bg-secondary text-secondary-foreground",
                                      isScheduled && "bg-primary/80 text-primary-foreground",
                                    )}
                                  >
                                    {isCompleted && "✓ مكتملة"}
                                    {isCancelled && "✕ ملغاة"}
                                    {isVacation && "🏖 إجازة"}
                                    {isScheduled && "◉ مجدولة"}
                                  </Badge>
                                </div>
                              </div>

                              {/* Last Session Notes - Show notes from the student's previous session */}
                              {(() => {
                                const todayStr = format(now, "yyyy-MM-dd");
                                const lastSession = getLastSessionWithNotes(student, todayStr);

                                // If no past completed sessions, don't show anything
                                if (!lastSession) return null;

                                const hasContent = lastSession.notes || lastSession.homework || lastSession.topic;

                                return (
                                  <div className="mt-2 p-2 rounded-lg bg-primary/5 border border-primary/20 text-xs space-y-1">
                                    <div className="flex items-center gap-1.5 text-primary dark:text-primary font-medium">
                                      <FileText className="h-3 w-3" />
                                      <span>الحصة السابقة ({format(parseISO(lastSession.date), "d/M", { locale: ar })})</span>
                                    </div>
                                    {!hasContent && (
                                      <p className="text-muted-foreground italic">لا توجد ملاحظات مسجلة</p>
                                    )}
                                    {lastSession.topic && (
                                      <p className="text-muted-foreground flex items-center gap-1">
                                        <BookOpen className="h-3 w-3 text-primary" />
                                        <span className="font-medium">{lastSession.topic}</span>
                                      </p>
                                    )}
                                    {lastSession.notes && (
                                      <p className="text-muted-foreground line-clamp-2">{lastSession.notes}</p>
                                    )}
                                    {lastSession.homework && (
                                      <div className="flex items-center gap-1 p-1.5 rounded bg-primary/10 text-primary">
                                        <BookOpen className="h-3 w-3" />
                                        <span className="font-medium">واجب:</span>
                                        <span className="line-clamp-1">{lastSession.homework}</span>
                                        {lastSession.homeworkStatus === "completed" && (
                                          <Badge className="h-4 px-1 text-[10px] bg-primary/20 text-primary">✓</Badge>
                                        )}
                                        {lastSession.homeworkStatus === "incomplete" && (
                                          <Badge className="h-4 px-1 text-[10px] bg-muted text-muted-foreground">✗</Badge>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}

                              {isScheduled && !isNextSession && (
                                <div className="flex items-center gap-2 flex-wrap">
                                  {/* Status/Complete button based on session timing */}
                                  {isSessionEnded(
                                    session.date,
                                    sessionTime,
                                    session.duration || student.sessionDuration || 60
                                  ) ? (
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button
                                          size="sm"
                                          className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 h-9 px-4"
                                        >
                                          <CheckCircle2 className="h-4 w-4" />
                                          إكمال
                                        </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent dir="rtl">
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>تأكيد إكمال الحصة</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            هل تريد تسجيل حصة <strong>{student.name}</strong> في{" "}
                                            <strong>{sessionTime}</strong> كمكتملة؟
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter className="flex-row-reverse gap-2">
                                          <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                          <AlertDialogAction
                                            onClick={() => handleToggleComplete(student.id, session.id)}
                                            className="bg-primary text-primary-foreground hover:bg-primary/90"
                                          >
                                            تأكيد الإكمال
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  ) : isSessionInProgress(
                                    session.date,
                                    sessionTime,
                                    session.duration || student.sessionDuration || 60
                                  ) ? (
                                    <div className="flex items-center gap-1.5 h-9 px-3 rounded-md bg-primary/10 text-primary text-sm font-medium">
                                      <Clock className="h-4 w-4 animate-pulse" />
                                      <span>جارية</span>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1.5 h-9 px-3 rounded-md bg-primary/10 text-primary text-sm font-medium">
                                      <Clock className="h-4 w-4" />
                                      <span>مجدولة</span>
                                    </div>
                                  )}
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="border-muted-foreground/50 text-muted-foreground hover:bg-muted gap-1.5 h-9 px-4"
                                      >
                                        <XCircle className="h-4 w-4" />
                                        إلغاء
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent dir="rtl">
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>تأكيد إلغاء الحصة</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          هل تريد إلغاء حصة <strong>{student.name}</strong> في{" "}
                                          <strong>{sessionTime}</strong>؟
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter className="flex-row-reverse gap-2">
                                        <AlertDialogCancel>رجوع</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => {
                                            const reason = prompt("سبب الإلغاء (اختياري):");
                                            handleCancelSession(student.id, session.id, reason || undefined);
                                          }}
                                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        >
                                          تأكيد الإلغاء
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="border-primary/50 text-primary hover:bg-primary/10 gap-1.5 h-9 px-4"
                                    onClick={() => handleQuickPayment(student.id, session.id, session.date)}
                                  >
                                    <DollarSign className="h-4 w-4" />
                                    دفع
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="gap-1.5 h-9 px-3"
                                    onClick={() => setCompletionDialog({ open: true, student, session })}
                                    title="خيارات الحصة"
                                  >
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </div>
                              )}
                              {isCompleted && (
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-primary font-medium">✓ تم إكمال الحصة</span>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="border-primary/50 text-primary hover:bg-primary/10 gap-1.5 h-8 px-3 text-xs"
                                    onClick={() => handleQuickPayment(student.id, session.id, session.date)}
                                  >
                                    <DollarSign className="h-3.5 w-3.5" />
                                    دفع
                                  </Button>
                                </div>
                              )}
                              {isCancelled && <span className="text-sm text-muted-foreground">تم إلغاء هذه الحصة</span>}
                              {isVacation && <span className="text-sm text-muted-foreground">إجازة</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {hasMoreSessions && (
                      <div className="border-t p-3 bg-muted/20">
                        <Button
                          variant="ghost"
                          className="w-full gap-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 font-medium"
                          onClick={() => setShowAllSessions(!showAllSessions)}
                        >
                          {showAllSessions ? (
                            <>
                              <ChevronUp className="h-4 w-4" />
                              عرض أقل
                            </>
                          ) : (
                            <>
                              <ChevronDown className="h-4 w-4" />
                              عرض {allTodaySessions.length - 5} حصص إضافية
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="calendar" className="mt-0">
            <CalendarView
              students={students}
              settings={settings}
              onRescheduleSession={rescheduleSession}
              onUpdateSessionDateTime={updateSessionDateTime}
              onToggleComplete={handleToggleComplete}
              onCancelSession={handleCancelSession}
              onDeleteSession={handleDeleteSession}
              onQuickPayment={handleQuickPayment}
              onAddSession={handleAddSession}
            />
          </TabsContent>
          <TabsContent value="history" className="mt-0">
            <SessionHistoryBar
              students={students}
              onCancelSession={handleCancelSession}
              onDeleteSession={handleDeleteSession}
              onRestoreSession={handleRestoreSession}
              onToggleComplete={handleToggleComplete}
              onRescheduleSession={rescheduleSession}
              onAddSession={handleAddSession}
              onMarkAsVacation={handleMarkAsVacation}
              onUpdateSessionDetails={updateSessionDetails}
              getCancellationCount={getCancellationCount}
              getAllStudentCancellations={getAllStudentCancellations}
              onClearMonthCancellations={clearMonthCancellations}
            />
          </TabsContent>
          <TabsContent value="payments" className="mt-0 space-y-4">
            {students.length > 0 && (
              <StatsBar
                students={students}
                payments={payments}
                selectedMonth={selectedMonth}
                selectedYear={selectedYear}
              />
            )}
            <PaymentsDashboard
              students={students}
              payments={payments}
              selectedMonth={selectedMonth}
              selectedYear={selectedYear}
              onTogglePayment={togglePaymentStatus}
              onRecordPayment={handleRecordPayment}
              onResetPayment={resetMonthlyPayment}
              settings={settings}
            />
          </TabsContent>
        </Tabs>

        <EndOfMonthReminder students={students} payments={payments} onTogglePayment={togglePaymentStatus} />
      </main>

      <QuickPaymentDialog
        open={quickPaymentDialog.open}
        onOpenChange={(open) =>
          !open && setQuickPaymentDialog({ open: false, student: null, sessionId: "", sessionDate: "" })
        }
        student={quickPaymentDialog.student}
        sessionId={quickPaymentDialog.sessionId}
        sessionDate={quickPaymentDialog.sessionDate}
        settings={settings}
        payments={payments}
        onConfirm={handleQuickPaymentConfirm}
      />
      {addConflictDialog && (
        <RestoreConflictDialog
          open={addConflictDialog.open}
          onOpenChange={(open) => !open && setAddConflictDialog(null)}
          conflictResult={addConflictDialog.conflictResult}
          sessionInfo={addConflictDialog.sessionInfo}
          onConfirm={addConflictDialog.conflictResult.severity === "warning" ? handleForceAddSession : undefined}
          title={
            addConflictDialog.conflictResult.severity === "error" ? "لا يمكن إضافة الحصة" : "تحذير: تعارض في الوقت"
          }
          confirmText={addConflictDialog.conflictResult.severity === "warning" ? "إضافة على أي حال" : undefined}
        />
      )}
      {completionDialog.student && completionDialog.session && (
        <SessionCompletionDialog
          open={completionDialog.open}
          onOpenChange={(open) => !open && setCompletionDialog({ open: false, student: null, session: null })}
          student={completionDialog.student}
          session={completionDialog.session}
          onComplete={() => {
            handleToggleComplete(completionDialog.student!.id, completionDialog.session!.id);
            setCompletionDialog({ open: false, student: null, session: null });
          }}
          onCancel={(reason) => {
            handleCancelSession(completionDialog.student!.id, completionDialog.session!.id, reason);
            setCompletionDialog({ open: false, student: null, session: null });
          }}
          onDelete={() => {
            handleDeleteSession(completionDialog.student!.id, completionDialog.session!.id);
            setCompletionDialog({ open: false, student: null, session: null });
          }}
        />
      )}
      {/* Auto-triggered completion dialog when session ends */}
      {endedSessionNotification && (
        <SessionCompletionDialog
          open={true}
          onOpenChange={(open) => {
            if (!open) {
              dismissEndedNotification();
            }
          }}
          student={endedSessionNotification.student}
          session={endedSessionNotification.session}
          isAutoTriggered={true}
          onComplete={() => {
            handleToggleComplete(endedSessionNotification.student.id, endedSessionNotification.session.id);
            dismissEndedNotification();
          }}
          onCancel={(reason) => {
            handleCancelSession(endedSessionNotification.student.id, endedSessionNotification.session.id, reason);
            dismissEndedNotification();
          }}
          onDelete={() => {
            handleDeleteSession(endedSessionNotification.student.id, endedSessionNotification.session.id);
            dismissEndedNotification();
          }}
        />
      )}

      {/* Quick Time Edit Dialog */}
      <Dialog
        open={timeEditDialog.open}
        onOpenChange={(open) => !open && setTimeEditDialog({ open: false, student: null, session: null, newTime: "" })}
      >
        <DialogContent dir="rtl" className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Clock className="h-5 w-5 text-primary" />
              تعديل وقت الحصة
            </DialogTitle>
            <DialogDescription>
              {timeEditDialog.student?.name} - {timeEditDialog.session && format(parseISO(timeEditDialog.session.date), "dd/MM/yyyy")}
            </DialogDescription>
          </DialogHeader>
          {(() => {
            const conflict = getTimeEditConflict();
            const hasError = conflict?.severity === "error";
            const hasWarning = conflict?.severity === "warning";
            return (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="session-time" className="text-sm font-medium">
                    الوقت الجديد
                  </Label>
                  <Input
                    id="session-time"
                    type="time"
                    value={timeEditDialog.newTime}
                    onChange={(e) => setTimeEditDialog({ ...timeEditDialog, newTime: e.target.value })}
                    className={cn(
                      "h-12 text-center text-xl font-bold rounded-xl border-2",
                      hasError && "border-destructive text-destructive",
                      hasWarning && "border-warning text-warning"
                    )}
                  />
                </div>

                {/* Conflict Warning */}
                {hasError && conflict && conflict.conflicts[0] && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-sm">
                    <XCircle className="h-4 w-4 text-destructive shrink-0" />
                    <span className="text-foreground">
                      تعارض مع حصة <span className="font-bold">{conflict.conflicts[0].student.name}</span> في الساعة {conflict.conflicts[0].session.time}
                    </span>
                  </div>
                )}
                {hasWarning && conflict && conflict.conflicts[0] && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/10 border border-warning/30 text-sm">
                    <Clock className="h-4 w-4 text-warning shrink-0" />
                    <span className="text-foreground">
                      قريب من حصة <span className="font-bold">{conflict.conflicts[0].student.name}</span> في الساعة {conflict.conflicts[0].session.time}
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    الوقت الحالي: <span className="font-bold text-foreground">{timeEditDialog.session?.time || timeEditDialog.student?.sessionTime}</span>
                  </span>
                </div>
              </div>
            );
          })()}
          {(() => {
            const conflict = getTimeEditConflict();
            const hasError = conflict?.severity === "error";
            return (
              <div className="flex gap-3 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setTimeEditDialog({ open: false, student: null, session: null, newTime: "" })}
                  className="rounded-xl"
                >
                  إلغاء
                </Button>
                <Button
                  onClick={confirmTimeEdit}
                  disabled={!timeEditDialog.newTime || hasError}
                  className={cn(
                    "rounded-xl",
                    hasError
                      ? "bg-muted text-muted-foreground cursor-not-allowed"
                      : "bg-gradient-to-r from-primary to-blue-500"
                  )}
                >
                  <Check className="h-4 w-4 ml-2" />
                  {hasError ? "غير متاح" : "حفظ"}
                </Button>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Add Session for Today Dialog */}
      <Dialog
        open={addTodaySessionDialog.open}
        onOpenChange={(open) => !open && setAddTodaySessionDialog({ open: false, selectedStudentId: "", time: "" })}
      >
        <DialogContent dir="rtl" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <div className="p-2 rounded-lg bg-gradient-to-br from-primary to-blue-500 text-white">
                <Plus className="h-5 w-5" />
              </div>
              إضافة حصة لليوم
            </DialogTitle>
            <DialogDescription>
              {format(now, "EEEE، d MMMM yyyy", { locale: ar })}
            </DialogDescription>
          </DialogHeader>
          {(() => {
            const conflict = getAddTodaySessionConflict();
            const hasError = conflict?.severity === "error";
            const hasWarning = conflict?.severity === "warning";
            const selectedStudent = students.find(s => s.id === addTodaySessionDialog.selectedStudentId);

            return (
              <>
                <div className="space-y-4 py-4">
                  {/* Student Selection */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">اختر الطالب</Label>
                    <Select
                      value={addTodaySessionDialog.selectedStudentId}
                      onValueChange={(value) => {
                        const student = students.find(s => s.id === value);
                        setAddTodaySessionDialog({
                          ...addTodaySessionDialog,
                          selectedStudentId: value,
                          time: student?.sessionTime || addTodaySessionDialog.time || "16:00",
                        });
                      }}
                    >
                      <SelectTrigger className="h-11 rounded-xl border-2">
                        <SelectValue placeholder="اختر طالب..." />
                      </SelectTrigger>
                      <SelectContent>
                        {students.map(student => (
                          <SelectItem key={student.id} value={student.id}>
                            <div className="flex items-center gap-2">
                              <User className="h-3.5 w-3.5" />
                              <span>{student.name}</span>
                              <span className="text-xs text-muted-foreground">({student.sessionTime})</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Time Input */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">وقت الحصة</Label>
                    <Input
                      type="time"
                      value={addTodaySessionDialog.time}
                      onChange={(e) => setAddTodaySessionDialog({ ...addTodaySessionDialog, time: e.target.value })}
                      className={cn(
                        "h-12 text-center text-xl font-bold rounded-xl border-2",
                        hasError && "border-rose-500 text-rose-600",
                        hasWarning && "border-amber-500 text-amber-600"
                      )}
                    />
                    {selectedStudent && (
                      <p className="text-xs text-muted-foreground">
                        💡 الوقت الافتراضي للطالب: {selectedStudent.sessionTime}
                      </p>
                    )}
                  </div>

                  {/* Available Time Slots */}
                  {(() => {
                    const todayStr = format(now, "yyyy-MM-dd");
                    const availableSlots = getSuggestedSlots(
                      todayStr,
                      selectedStudent?.sessionDuration || settings.defaultSessionDuration || 60,
                      settings.workingHoursStart || "08:00",
                      settings.workingHoursEnd || "22:00",
                      8
                    );

                    if (availableSlots.length === 0) return null;

                    return (
                      <div className="space-y-2">
                        <Label className="text-sm font-medium flex items-center gap-1.5 text-primary">
                          <Sparkles className="h-4 w-4" />
                          أوقات متاحة
                        </Label>
                        <div className="flex flex-wrap gap-2">
                          {availableSlots.map((slot) => (
                            <Button
                              key={slot.time}
                              type="button"
                              size="sm"
                              variant={addTodaySessionDialog.time === slot.time ? "default" : "outline"}
                              className={cn(
                                "gap-1.5 h-9 text-sm",
                                addTodaySessionDialog.time === slot.time && "ring-2 ring-primary ring-offset-1"
                              )}
                              onClick={() => setAddTodaySessionDialog({ ...addTodaySessionDialog, time: slot.time })}
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

                  {/* Conflict Warning */}
                  {hasError && conflict && conflict.conflicts[0] && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-sm">
                      <XCircle className="h-4 w-4 text-rose-500 shrink-0" />
                      <span className="text-rose-700">
                        تعارض مع حصة <span className="font-bold">{conflict.conflicts[0].student.name}</span> في الساعة {conflict.conflicts[0].session.time}
                      </span>
                    </div>
                  )}
                  {hasWarning && conflict && conflict.conflicts[0] && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-sm">
                      <Clock className="h-4 w-4 text-amber-500 shrink-0" />
                      <span className="text-amber-700">
                        قريب من حصة <span className="font-bold">{conflict.conflicts[0].student.name}</span> في الساعة {conflict.conflicts[0].session.time}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => setAddTodaySessionDialog({ open: false, selectedStudentId: "", time: "" })}
                    className="rounded-xl"
                  >
                    إلغاء
                  </Button>
                  <Button
                    onClick={handleAddTodaySession}
                    disabled={!addTodaySessionDialog.selectedStudentId || !addTodaySessionDialog.time || hasError}
                    className={cn(
                      "rounded-xl",
                      hasError
                        ? "bg-muted text-muted-foreground cursor-not-allowed"
                        : "bg-gradient-to-r from-primary to-blue-500"
                    )}
                  >
                    <Plus className="h-4 w-4 ml-2" />
                    {hasError ? "غير متاح" : "إضافة الحصة"}
                  </Button>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;
