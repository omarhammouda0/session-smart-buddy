import { useState, useMemo } from "react";
import {
  Check,
  X,
  CreditCard,
  Clock,
  Users,
  ChevronLeft,
  ChevronRight,
  Calendar,
  History,
  MessageCircle,
  Loader2,
  Palmtree,
  Coins,
  Send,
  Download,
  DollarSign,
  FileText,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { StudentSearchCombobox } from "@/components/StudentSearchCombobox";
import { Student, StudentPayments, AppSettings, PaymentMethod } from "@/types/student";
import { formatMonthYearAr, DAY_NAMES_SHORT_AR, MONTH_NAMES_AR } from "@/lib/arabicConstants";
import { cn } from "@/lib/utils";
import { subMonths, format } from "date-fns";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
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

const CURRENCY = "جنيه";

// ============================================
// HELPER FUNCTIONS
// ============================================

// Count session stats for a student in a given month
const getStudentMonthStats = (student: Student, month: number, year: number) => {
  const sessions = student.sessions.filter((s) => {
    const sessionDate = new Date(s.date);
    return sessionDate.getMonth() === month && sessionDate.getFullYear() === year;
  });

  const completed = sessions.filter((s) => s.status === "completed").length;
  const vacation = sessions.filter((s) => s.status === "vacation").length;
  const cancelled = sessions.filter((s) => s.status === "cancelled").length;
  const scheduled = sessions.filter((s) => s.status === "scheduled").length;

  return { completed, vacation, cancelled, scheduled, total: sessions.length };
};

// Get session price for a student
const getStudentSessionPrice = (student: Student, settings?: AppSettings): number => {
  const defaultOnsite = 150;
  const defaultOnline = 120;

  if (student.useCustomSettings) {
    if (student.sessionType === "online") {
      return typeof student.customPriceOnline === "number" && student.customPriceOnline > 0
        ? student.customPriceOnline
        : (settings?.defaultPriceOnline ?? defaultOnline);
    }
    return typeof student.customPriceOnsite === "number" && student.customPriceOnsite > 0
      ? student.customPriceOnsite
      : (settings?.defaultPriceOnsite ?? defaultOnsite);
  }

  if (student.sessionType === "online") {
    return typeof settings?.defaultPriceOnline === "number" && settings.defaultPriceOnline > 0
      ? settings.defaultPriceOnline
      : defaultOnline;
  }
  return typeof settings?.defaultPriceOnsite === "number" && settings.defaultPriceOnsite > 0
    ? settings.defaultPriceOnsite
    : defaultOnsite;
};

// Calculate total price (amount due) for a student in a month based on sessions
const getStudentMonthTotal = (student: Student, month: number, year: number, settings?: AppSettings): number => {
  const stats = getStudentMonthStats(student, month, year);
  const pricePerSession = getStudentSessionPrice(student, settings);
  const billableCount = stats.completed + stats.scheduled;
  return billableCount * pricePerSession;
};

// Get payment method label in Arabic
const getPaymentMethodLabel = (method?: PaymentMethod): string => {
  if (!method) return "غير محدد";
  switch (method) {
    case "cash":
      return "كاش";
    case "bank":
      return "تحويل بنكي";
    case "wallet":
      return "محفظة إلكترونية";
    default:
      return method;
  }
};

// Format date in Arabic
const formatDateAr = (dateStr?: string): string => {
  if (!dateStr) return "غير محدد";
  try {
    const date = new Date(dateStr);
    return format(date, "dd/MM/yyyy");
  } catch {
    return dateStr;
  }
};

// ============================================
// COMPONENT PROPS
// ============================================

interface PaymentsDashboardProps {
  students: Student[];
  payments: StudentPayments[];
  selectedMonth: number;
  selectedYear: number;
  onTogglePayment: (studentId: string, month: number, year: number) => void;
  onRecordPayment?: (
    studentId: string,
    paymentData: {
      month: number;
      year: number;
      amount: number;
      method: PaymentMethod;
      paidAt: string;
      notes?: string;
    },
  ) => void;
  onResetPayment?: (studentId: string, month: number, year: number) => void;
  settings?: AppSettings;
}

type PaymentFilter = "all" | "paid" | "partial" | "unpaid";
type WhatsAppTarget = "overdue" | "upcoming" | "all" | "custom";

// ============================================
// MAIN COMPONENT
// ============================================

export const PaymentsDashboard = ({
  students,
  payments,
  selectedMonth: initialMonth,
  selectedYear: initialYear,
  onTogglePayment,
  onRecordPayment,
  onResetPayment,
  settings,
}: PaymentsDashboardProps) => {
  const now = new Date();

  // State
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("all");
  const [studentSearch, setStudentSearch] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [selectedYear, setSelectedYear] = useState(initialYear);
  const [selectedStudentHistory, setSelectedStudentHistory] = useState<string | null>(null);
  const [sendingReminder, setSendingReminder] = useState<string | null>(null);
  const [bulkSendingReminders, setBulkSendingReminders] = useState(false);
  const [bulkSendProgress, setBulkSendProgress] = useState({ current: 0, total: 0, success: 0, failed: 0 });
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [whatsappTarget, setWhatsappTarget] = useState<WhatsAppTarget>("overdue");

  // Payment recording dialog state
  const [recordPaymentDialog, setRecordPaymentDialog] = useState<{
    open: boolean;
    student: Student | null;
    isAddingToPartial: boolean;
  }>({ open: false, student: null, isAddingToPartial: false });
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [paymentDate, setPaymentDate] = useState<string>(format(now, "yyyy-MM-dd"));
  const [paymentNotes, setPaymentNotes] = useState<string>("");

  // History dialog state
  const [historyDialog, setHistoryDialog] = useState<{
    open: boolean;
    view: "student" | "monthly";
  }>({ open: false, view: "student" });

  // ============================================
  // PAYMENT DATA HELPERS
  // ============================================

  // Get payment details for a student in a specific month
  const getPaymentDetails = (studentId: string, month?: number, year?: number) => {
    const studentPayments = payments.find((p) => p.studentId === studentId);
    if (!studentPayments) return null;
    return studentPayments.payments.find(
      (p) => p.month === (month ?? selectedMonth) && p.year === (year ?? selectedYear),
    );
  };

  // Get the actual amount paid by a student for a specific month
  const getAmountPaid = (studentId: string, month?: number, year?: number): number => {
    const payment = getPaymentDetails(studentId, month, year);
    if (!payment) return 0;
    return payment.amountPaid || payment.amount || 0;
  };

  // Get payment status for a student
  const getPaymentStatusLocal = (studentId: string, month?: number, year?: number): "paid" | "partial" | "unpaid" => {
    const student = students.find((s) => s.id === studentId);
    if (!student) return "unpaid";

    const m = month ?? selectedMonth;
    const y = year ?? selectedYear;

    const amountPaid = getAmountPaid(studentId, m, y);
    const amountDue = getStudentMonthTotal(student, m, y, settings);

    if (amountDue === 0) return "unpaid";
    if (amountPaid >= amountDue) return "paid";
    if (amountPaid > 0) return "partial";
    return "unpaid";
  };

  // Get payment history for a student (all months with payments)
  const getPaymentHistory = (studentId: string) => {
    const studentPayments = payments.find((p) => p.studentId === studentId);
    if (!studentPayments) return [];
    return studentPayments.payments
      .filter((p) => p.isPaid || (p.amountPaid && p.amountPaid > 0))
      .sort((a, b) => (b.year !== a.year ? b.year - a.year : b.month - a.month));
  };

  // ============================================
  // CALCULATED VALUES (MEMOIZED)
  // ============================================

  // Count students by payment status
  const { paidCount, partialCount, unpaidCount, unpaidStudents } = useMemo(() => {
    let paid = 0;
    let partial = 0;
    let unpaid = 0;
    const unpaidList: Student[] = [];

    students.forEach((student) => {
      const status = getPaymentStatusLocal(student.id);
      if (status === "paid") {
        paid++;
      } else if (status === "partial") {
        partial++;
        unpaidList.push(student);
      } else {
        unpaid++;
        unpaidList.push(student);
      }
    });

    return { paidCount: paid, partialCount: partial, unpaidCount: unpaid, unpaidStudents: unpaidList };
  }, [students, payments, selectedMonth, selectedYear, settings]);

  // Calculate total expected (amount due from all students)
  const totalExpected = useMemo(() => {
    return students.reduce((sum, student) => {
      return sum + getStudentMonthTotal(student, selectedMonth, selectedYear, settings);
    }, 0);
  }, [students, selectedMonth, selectedYear, settings]);

  // Calculate total collected (sum of ALL amountPaid including partial payments)
  const totalCollected = useMemo(() => {
    return students.reduce((sum, student) => {
      const amountPaid = getAmountPaid(student.id, selectedMonth, selectedYear);
      return sum + amountPaid;
    }, 0);
  }, [students, payments, selectedMonth, selectedYear]);

  // Calculate total pending
  const totalPending = totalExpected - totalCollected;

  // Collection percentage
  const collectionPercentage = totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0;

  // Get recent months for quick navigation
  const recentMonths = useMemo(() => {
    const months = [];
    for (let i = 2; i >= -3; i--) {
      const date = subMonths(now, i);
      months.push({
        month: date.getMonth(),
        year: date.getFullYear(),
        label: MONTH_NAMES_AR[date.getMonth()].slice(0, 3),
        isCurrent: date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear(),
      });
    }
    return months;
  }, []);

  // Filter students based on search and filter
  const filteredStudents = useMemo(() => {
    const searchLower = studentSearch.trim().toLowerCase();
    return students.filter((student) => {
      const paymentStatus = getPaymentStatusLocal(student.id);
      if (paymentFilter === "paid" && paymentStatus !== "paid") return false;
      if (paymentFilter === "partial" && paymentStatus !== "partial") return false;
      if (paymentFilter === "unpaid" && paymentStatus !== "unpaid") return false;
      if (searchLower && !student.name.toLowerCase().includes(searchLower)) return false;
      return true;
    });
  }, [students, paymentFilter, studentSearch, payments, selectedMonth, selectedYear, settings]);

  // Selected student for history view
  const selectedStudent = students.find((s) => s.id === selectedStudentHistory);

  // ============================================
  // NAVIGATION HANDLERS
  // ============================================

  const goToPrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  // ============================================
  // PAYMENT DIALOG HANDLERS
  // ============================================

  const openRecordPaymentDialog = (student: Student, isAddingToPartial: boolean = false) => {
    const monthTotal = getStudentMonthTotal(student, selectedMonth, selectedYear, settings);
    const alreadyPaid = getAmountPaid(student.id, selectedMonth, selectedYear);
    const remaining = monthTotal - alreadyPaid;

    // Default amount: remaining for partial, full amount for new
    setPaymentAmount(isAddingToPartial ? Math.max(0, remaining).toString() : monthTotal.toString());
    setPaymentMethod("cash");
    setPaymentDate(format(now, "yyyy-MM-dd"));
    setPaymentNotes("");
    setRecordPaymentDialog({ open: true, student, isAddingToPartial });
  };

  const handleRecordPayment = () => {
    if (!recordPaymentDialog.student) return;

    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "خطأ", description: "المبلغ غير صحيح", variant: "destructive" });
      return;
    }

    if (onRecordPayment) {
      onRecordPayment(recordPaymentDialog.student.id, {
        month: selectedMonth,
        year: selectedYear,
        amount,
        method: paymentMethod,
        paidAt: paymentDate,
        notes: paymentNotes.trim() || undefined,
      });

      toast({
        title: "✅ تم تسجيل الدفعة",
        description: `${recordPaymentDialog.student.name}: ${amount.toLocaleString()} ${CURRENCY}`,
      });
    } else {
      onTogglePayment(recordPaymentDialog.student.id, selectedMonth, selectedYear);
      toast({
        title: "✅ تم التأكيد",
        description: `تم تسجيل دفع ${recordPaymentDialog.student.name}`,
      });
    }

    setRecordPaymentDialog({ open: false, student: null, isAddingToPartial: false });
  };

  const handleResetPayment = (student: Student) => {
    if (onResetPayment) {
      onResetPayment(student.id, selectedMonth, selectedYear);
      toast({
        title: "تم إلغاء الدفع",
        description: `تم إلغاء جميع دفعات ${student.name} لهذا الشهر`,
      });
    } else {
      onTogglePayment(student.id, selectedMonth, selectedYear);
    }
  };

  // ============================================
  // WHATSAPP HANDLERS
  // ============================================

  const sendWhatsAppReminder = async (student: Student) => {
    if (!student.phone) {
      toast({ title: "خطأ", description: "لا يوجد رقم هاتف لهذا الطالب", variant: "destructive" });
      return;
    }

    setSendingReminder(student.id);
    try {
      // Calculate student stats for the message
      const monthSessions = student.sessions.filter((s) => {
        const d = new Date(s.date);
        return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
      });
      const completedCount = monthSessions.filter((s) => s.status === "completed").length;
      const scheduledCount = monthSessions.filter((s) => s.status === "scheduled").length;
      const totalSessions = completedCount + scheduledCount;

      // Calculate amount
      const pricePerSession = student.sessionType === "online"
        ? (student.customPriceOnline || settings.defaultPriceOnline || 100)
        : (student.customPriceOnsite || settings.defaultPriceOnsite || 150);
      const totalAmount = totalSessions * pricePerSession;

      // Build custom message
      const customMessage = `عزيزي ولي الأمر،\nتذكير بدفع رسوم شهر ${MONTH_NAMES_AR[selectedMonth]} لـ ${student.name}\nعدد الجلسات: ${totalSessions}\nالمبلغ المستحق: ${totalAmount} جنيه\nشكراً لتعاونكم`;

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
      toast({ title: "تم الإرسال", description: `تم إرسال تذكير WhatsApp إلى ${student.name}` });
    } catch (error: unknown) {
      console.error("WhatsApp error:", error);
      const errorMessage = error instanceof Error ? error.message : "فشل إرسال الرسالة";
      toast({ title: "خطأ", description: errorMessage, variant: "destructive" });
    } finally {
      setSendingReminder(null);
    }
  };

  const getWhatsAppTargetStudents = (target: WhatsAppTarget) => {
    switch (target) {
      case "overdue":
        return unpaidStudents;
      case "upcoming":
        return students.filter((s) => getPaymentStatusLocal(s.id) !== "paid");
      case "all":
        return students;
      case "custom":
        return [];
      default:
        return [];
    }
  };

  const getWhatsAppTargetLabel = (target: WhatsAppTarget): string => {
    const targetStudents = getWhatsAppTargetStudents(target);
    const count = targetStudents.filter((s) => s.phone).length;

    switch (target) {
      case "overdue":
        return `للمتأخرين (${count})`;
      case "upcoming":
        return `للمستحقين قريباً (${count})`;
      case "all":
        return `للجميع (${count})`;
      case "custom":
        return "رسالة مخصصة...";
      default:
        return "";
    }
  };

  const sendPaymentReminder = () => {
    const targetStudents = getWhatsAppTargetStudents(whatsappTarget);

    if (targetStudents.length === 0) {
      toast({ title: "لا يوجد طلاب", description: "لا يوجد طلاب لإرسال التذكير إليهم" });
      return;
    }

    if (whatsappTarget === "custom") {
      toast({ title: "قريباً", description: "ميزة الرسالة المخصصة قيد التطوير", variant: "default" });
      return;
    }

    setShowBulkConfirm(true);
  };

  const sendBulkWhatsAppReminders = async () => {
    const targetStudents = getWhatsAppTargetStudents(whatsappTarget);
    const studentsWithPhone = targetStudents.filter((s) => s.phone);
    const studentsWithoutPhone = targetStudents.filter((s) => !s.phone);

    if (studentsWithPhone.length === 0) {
      toast({
        title: "لا يوجد أرقام هاتف",
        description: "لا يوجد أرقام هاتف مسجلة للطلاب المحددين",
        variant: "destructive",
      });
      setShowBulkConfirm(false);
      return;
    }

    setBulkSendingReminders(true);
    setBulkSendProgress({ current: 0, total: studentsWithPhone.length, success: 0, failed: 0 });
    setShowBulkConfirm(false);

    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < studentsWithPhone.length; i++) {
      const student = studentsWithPhone[i];
      const monthStats = getStudentMonthStats(student, selectedMonth, selectedYear);
      const studentTotal = getStudentMonthTotal(student, selectedMonth, selectedYear, settings);
      const amountPaid = getAmountPaid(student.id, selectedMonth, selectedYear);
      const remaining = studentTotal - amountPaid;

      const messageText = `عزيزي ولي الأمر،
تذكير بدفع رسوم شهر ${MONTH_NAMES_AR[selectedMonth]} لـ ${student.name}
عدد الجلسات: ${monthStats.completed + monthStats.scheduled}
المبلغ المستحق: ${studentTotal} ${CURRENCY}${amountPaid > 0 ? `\nالمدفوع: ${amountPaid} ${CURRENCY}\nالمتبقي: ${remaining} ${CURRENCY}` : ""}
شكراً لتعاونكم`;

      try {
        const { error } = await supabase.functions.invoke("send-whatsapp-reminder", {
          body: {
            // Both old and new field names for compatibility
            phone: student.phone,
            message: messageText,
            phoneNumber: student.phone,
            customMessage: messageText,
            studentName: student.name,
          },
        });

        if (error) throw error;
        successCount++;
      } catch (error) {
        console.error(`Failed to send to ${student.name}:`, error);
        failedCount++;
      }

      setBulkSendProgress({
        current: i + 1,
        total: studentsWithPhone.length,
        success: successCount,
        failed: failedCount,
      });

      if (i < studentsWithPhone.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    setBulkSendingReminders(false);

    let description = `تم إرسال ${successCount} تذكير بنجاح`;
    if (failedCount > 0) description += `، فشل ${failedCount}`;
    if (studentsWithoutPhone.length > 0) {
      description += `\n${studentsWithoutPhone.length} طالب بدون رقم هاتف`;
    }

    toast({
      title: successCount > 0 ? "تم الإرسال" : "فشل الإرسال",
      description,
      duration: 8000,
      variant: failedCount > 0 && successCount === 0 ? "destructive" : "default",
    });
  };

  // ============================================
  // EXPORT HANDLER
  // ============================================

  const exportToPDF = () => {
    const reportLines: string[] = [];
    reportLines.push(`تقرير المدفوعات المفصل - ${formatMonthYearAr(selectedMonth, selectedYear)}`);
    reportLines.push("━".repeat(50));
    reportLines.push("");

    students.forEach((student) => {
      const paymentStatus = getPaymentStatusLocal(student.id);
      const paymentDetails = getPaymentDetails(student.id);
      const monthStats = getStudentMonthStats(student, selectedMonth, selectedYear);
      const billableCount = monthStats.completed + monthStats.scheduled;
      const studentTotal = getStudentMonthTotal(student, selectedMonth, selectedYear, settings);
      const pricePerSession = getStudentSessionPrice(student, settings);
      const amountPaid = getAmountPaid(student.id, selectedMonth, selectedYear);

      const statusIcon = paymentStatus === "paid" ? "✅" : paymentStatus === "partial" ? "🔶" : "⏳";
      const statusText = paymentStatus === "paid" ? "(مدفوع)" : paymentStatus === "partial" ? "(جزئي)" : "(غير مدفوع)";

      reportLines.push(`${statusIcon} ${student.name} ${statusText}`);

      if (billableCount > 0) {
        reportLines.push(`   ${billableCount} حصص × ${pricePerSession} ${CURRENCY} = ${studentTotal} ${CURRENCY}`);
      }

      if (paymentStatus === "partial") {
        reportLines.push(`   المدفوع: ${amountPaid} ${CURRENCY} | المتبقي: ${studentTotal - amountPaid} ${CURRENCY}`);
      }

      if (paymentStatus !== "unpaid" && paymentDetails) {
        if (paymentDetails.paidAt) reportLines.push(`   تاريخ الدفع: ${formatDateAr(paymentDetails.paidAt)}`);
        if (paymentDetails.method) reportLines.push(`   الطريقة: ${getPaymentMethodLabel(paymentDetails.method)}`);
        if (paymentDetails.notes) reportLines.push(`   ملاحظات: ${paymentDetails.notes}`);

        if (paymentDetails.paymentRecords && paymentDetails.paymentRecords.length > 1) {
          reportLines.push(`   سجل الدفعات (${paymentDetails.paymentRecords.length}):`);
          paymentDetails.paymentRecords.forEach((record, idx) => {
            reportLines.push(
              `      ${idx + 1}. ${record.amount} ${CURRENCY} - ${getPaymentMethodLabel(record.method)} - ${formatDateAr(record.paidAt)}`,
            );
          });
        }
      }

      reportLines.push("");
    });

    reportLines.push("━".repeat(50));
    reportLines.push("📊 الملخص:");
    reportLines.push(`   الإجمالي المتوقع: ${totalExpected.toLocaleString()} ${CURRENCY}`);
    reportLines.push(`   المحصّل: ${totalCollected.toLocaleString()} ${CURRENCY} (${collectionPercentage}%)`);
    reportLines.push(`   المتبقي: ${totalPending.toLocaleString()} ${CURRENCY}`);

    const reportText = reportLines.join("\n");

    const blob = new Blob([reportText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `تقرير-المدفوعات-${formatMonthYearAr(selectedMonth, selectedYear)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({ title: "تم التصدير", description: "تم تحميل التقرير بنجاح" });
  };

  // ============================================
  // RENDER: EMPTY STATE
  // ============================================

  if (students.length === 0) {
    return (
      <Card className="card-shadow" dir="rtl">
        <CardContent className="py-12 text-center">
          <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">أضف طلاب لتتبع المدفوعات</p>
        </CardContent>
      </Card>
    );
  }

  // ============================================
  // RENDER: MAIN COMPONENT
  // ============================================

  return (
    <div className="space-y-2 sm:space-y-4" dir="rtl">
      {/* Month Navigation - Compact */}
      <div className="space-y-2">
        <div className="flex items-center justify-center gap-1.5">
          <Button variant="ghost" size="icon" onClick={goToNextMonth} className="h-7 w-7 sm:h-8 sm:w-8">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <div className="text-center min-w-[100px] sm:min-w-[140px]">
            <p className="font-heading font-semibold text-sm sm:text-lg">{formatMonthYearAr(selectedMonth, selectedYear)}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={goToPrevMonth} className="h-7 w-7 sm:h-8 sm:w-8">
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>

        {/* Quick month buttons - scrollable */}
        <div className="flex justify-center gap-1 overflow-x-auto pb-1 -mx-1 px-1">
          {recentMonths.map((m) => (
            <button
              key={`${m.year}-${m.month}`}
              onClick={() => { setSelectedMonth(m.month); setSelectedYear(m.year); }}
              className={cn(
                "flex flex-col items-center px-2 py-1 sm:px-3 sm:py-2 rounded-lg transition-all min-w-[44px] sm:min-w-[56px]",
                selectedMonth === m.month && selectedYear === m.year
                  ? "bg-primary text-primary-foreground shadow-md"
                  : m.isCurrent ? "bg-primary/10 border-2 border-primary/30" : "bg-card border border-border"
              )}
            >
              <span className="text-[0.6rem] sm:text-xs font-medium">{m.label}</span>
              <span className="text-[0.5rem] sm:text-[10px] opacity-70">{m.year}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Payment Summary Card - Compact */}
      <Card className="card-shadow bg-gradient-to-br from-primary/5 to-primary/10">
        <CardContent className="py-2 sm:py-4 px-2 sm:px-4">
          <div className="flex items-center gap-1.5 mb-2">
            <Coins className="h-4 w-4 text-primary" />
            <span className="font-heading font-semibold text-xs sm:text-sm">ملخص المدفوعات</span>
          </div>

          <div className="grid grid-cols-3 gap-1.5 sm:gap-2 text-center">
            <div className="bg-card rounded-lg p-1.5 sm:p-2">
              <p className="text-sm sm:text-lg font-heading font-bold">{totalExpected.toLocaleString()}</p>
              <p className="text-[0.5rem] sm:text-[10px] text-muted-foreground">متوقع</p>
            </div>
            <div className="bg-success/10 rounded-lg p-1.5 sm:p-2">
              <p className="text-sm sm:text-lg font-heading font-bold text-success">{totalCollected.toLocaleString()}</p>
              <p className="text-[0.5rem] sm:text-[10px] text-success/80">محصّل</p>
            </div>
            <div className="bg-warning/10 rounded-lg p-1.5 sm:p-2">
              <p className="text-sm sm:text-lg font-heading font-bold text-warning">{totalPending.toLocaleString()}</p>
              <p className="text-[0.5rem] sm:text-[10px] text-warning/80">متبقي</p>
            </div>
          </div>

          {/* Collection Progress Bar */}
          {totalExpected > 0 && (
            <div className="mt-2">
              <div className="flex justify-between text-[0.6rem] sm:text-xs mb-0.5">
                <span>التحصيل</span>
                <span className="font-medium">{collectionPercentage}%</span>
              </div>
              <Progress value={collectionPercentage} className="h-1.5 sm:h-2" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Status Filter Cards - Compact */}
      <div className="grid grid-cols-4 gap-1 sm:gap-2">
        <button
          onClick={() => setPaymentFilter("all")}
          className={cn("rounded-lg p-1.5 sm:p-3 card-shadow transition-all text-center", paymentFilter === "all" ? "ring-2 ring-primary bg-card" : "bg-card")}
        >
          <Users className="h-3 w-3 sm:h-4 sm:w-4 mx-auto mb-0.5" />
          <p className="text-base sm:text-xl font-heading font-bold">{students.length}</p>
          <p className="text-[0.5rem] sm:text-[10px] text-muted-foreground">الكل</p>
        </button>

        <button
          onClick={() => setPaymentFilter("paid")}
          className={cn("rounded-lg p-1.5 sm:p-3 card-shadow transition-all text-center", paymentFilter === "paid" ? "ring-2 ring-success bg-success/10" : "bg-success/10")}
        >
          <Check className="h-3 w-3 sm:h-4 sm:w-4 mx-auto mb-0.5 text-success" />
          <p className="text-base sm:text-xl font-heading font-bold text-success">{paidCount}</p>
          <p className="text-[0.5rem] sm:text-[10px] text-success/80">دفع</p>
        </button>

        <button
          onClick={() => setPaymentFilter("partial")}
          className={cn("rounded-lg p-1.5 sm:p-3 card-shadow transition-all text-center", paymentFilter === "partial" ? "ring-2 ring-amber-500 bg-amber-500/10" : "bg-amber-500/10")}
        >
          <Clock className="h-3 w-3 sm:h-4 sm:w-4 mx-auto mb-0.5 text-amber-500" />
          <p className="text-base sm:text-xl font-heading font-bold text-amber-500">{partialCount}</p>
          <p className="text-[0.5rem] sm:text-[10px] text-amber-500/80">جزئي</p>
        </button>

        <button
          onClick={() => setPaymentFilter("unpaid")}
          className={cn("rounded-lg p-1.5 sm:p-3 card-shadow transition-all text-center", paymentFilter === "unpaid" ? "ring-2 ring-rose-500 bg-rose-500/10" : "bg-rose-500/10")}
        >
          <X className="h-3 w-3 sm:h-4 sm:w-4 mx-auto mb-0.5 text-rose-500" />
          <p className="text-base sm:text-xl font-heading font-bold text-rose-500">{unpaidCount}</p>
          <p className="text-[0.5rem] sm:text-[10px] text-rose-500/80">لا</p>
        </button>
      </div>

      {/* Action Buttons - Compact */}
      <div className="flex gap-1 sm:gap-2 flex-wrap">
        {bulkSendingReminders ? (
          <div className="flex-1 p-2 sm:p-4 rounded-lg border bg-card space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin text-primary" />إرسال...</span>
              <span className="text-muted-foreground">{bulkSendProgress.current}/{bulkSendProgress.total}</span>
            </div>
            <Progress value={(bulkSendProgress.current / bulkSendProgress.total) * 100} className="h-1.5" />
          </div>
        ) : (
          <>
            <Select value={whatsappTarget} onValueChange={(v) => setWhatsappTarget(v as WhatsAppTarget)}>
              <SelectTrigger className="flex-1 min-w-0 h-8 sm:h-9 text-xs sm:text-sm border-green-500/50 text-green-600">
                <MessageCircle className="h-3 w-3 sm:h-4 sm:w-4 ml-1 shrink-0" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="overdue">متأخرين ({unpaidStudents.filter((s) => s.phone).length})</SelectItem>
                <SelectItem value="upcoming">مستحقين ({unpaidStudents.filter((s) => s.phone).length})</SelectItem>
                <SelectItem value="all">الجميع ({students.filter((s) => s.phone).length})</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              className="h-8 sm:h-9 px-2 sm:px-3 gap-1 text-xs sm:text-sm border-green-500/50 text-green-600 hover:bg-green-500/10"
              onClick={sendPaymentReminder}
              disabled={getWhatsAppTargetStudents(whatsappTarget).length === 0}
            >
              <Send className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">تذكير</span>
            </Button>
          </>
        )}

        <Button variant="outline" size="icon" onClick={exportToPDF} className="h-8 w-8 sm:h-9 sm:w-9">
          <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </Button>

        <Button variant="outline" size="icon" onClick={() => setHistoryDialog({ open: true, view: "monthly" })} className="h-8 w-8 sm:h-9 sm:w-9">
          <History className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </Button>
      </div>

      {/* Students List - Compact */}
      <Card className="card-shadow">
        <CardHeader className="pb-2 sm:pb-3 space-y-2 p-2 sm:p-4">
          <CardTitle className="font-heading text-sm sm:text-lg flex items-center gap-1.5">
            <Calendar className="h-4 w-4 text-primary" />
            {formatMonthYearAr(selectedMonth, selectedYear)}
          </CardTitle>
          <StudentSearchCombobox students={students} value={studentSearch} onChange={setStudentSearch} placeholder="بحث..." />
        </CardHeader>

        <CardContent className="space-y-1.5 sm:space-y-2 p-2 sm:p-4 pt-0">
          {filteredStudents.length === 0 ? (
            <p className="text-center text-muted-foreground py-4 text-sm">
              {studentSearch.trim() ? "لا يوجد نتائج" : "لا يوجد طلاب تطابق الفلتر"}
            </p>
          ) : (
            filteredStudents.map((student) => {
              const paymentStatus = getPaymentStatusLocal(student.id);
              const isPaid = paymentStatus === "paid";
              const isPartial = paymentStatus === "partial";
              const isSending = sendingReminder === student.id;
              const monthStats = getStudentMonthStats(student, selectedMonth, selectedYear);
              const billableCount = monthStats.completed + monthStats.scheduled;
              const studentTotal = getStudentMonthTotal(student, selectedMonth, selectedYear, settings);
              const amountPaid = getAmountPaid(student.id, selectedMonth, selectedYear);
              const remaining = studentTotal - amountPaid;

              return (
                <div
                  key={student.id}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-lg border transition-all",
                    isPaid && "bg-success/10 border-success/30",
                    isPartial && "bg-amber-500/10 border-amber-500/30",
                    !isPaid && !isPartial && "bg-card border-border",
                  )}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {/* Status Icon */}
                    <div
                      className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                        isPaid && "bg-success text-success-foreground",
                        isPartial && "bg-amber-500 text-white",
                        !isPaid && !isPartial && "bg-muted",
                      )}
                    >
                      {isPaid ? (
                        <Check className="h-4 w-4" />
                      ) : isPartial ? (
                        <Clock className="h-4 w-4" />
                      ) : (
                        <X className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>

                    {/* Student Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium truncate">{student.name}</span>
                        {billableCount > 0 && (
                          <span
                            className={cn(
                              "text-sm font-medium shrink-0",
                              isPaid && "text-success",
                              isPartial && "text-amber-600",
                              !isPaid && !isPartial && "text-foreground",
                            )}
                          >
                            {isPartial ? (
                              <>
                                {amountPaid.toLocaleString()} / {studentTotal.toLocaleString()} {CURRENCY}
                              </>
                            ) : (
                              <>
                                {studentTotal.toLocaleString()} {CURRENCY}
                              </>
                            )}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                        <span>{student.scheduleDays.map((d) => DAY_NAMES_SHORT_AR[d.dayOfWeek]).join("، ")}</span>
                        {billableCount > 0 && (
                          <>
                            <span>•</span>
                            <span className="text-primary">{billableCount} جلسة</span>
                          </>
                        )}
                        {isPartial && (
                          <>
                            <span>•</span>
                            <span className="text-amber-600 font-medium">
                              متبقي: {remaining.toLocaleString()} {CURRENCY}
                            </span>
                          </>
                        )}
                        {monthStats.vacation > 0 && (
                          <>
                            <span>•</span>
                            <span className="text-warning flex items-center gap-0.5">
                              <Palmtree className="h-3 w-3" />
                              {monthStats.vacation} إجازة
                            </span>
                          </>
                        )}
                        {monthStats.cancelled > 0 && (
                          <>
                            <span>•</span>
                            <span className="text-destructive">{monthStats.cancelled} ملغاة</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2">
                    {/* History Button */}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setSelectedStudentHistory(student.id);
                        setHistoryDialog({ open: true, view: "student" });
                      }}
                      title="السجل"
                    >
                      <FileText className="h-4 w-4" />
                    </Button>

                    {/* WhatsApp Reminder (only for unpaid/partial) */}
                    {!isPaid && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 border-green-500/50 text-green-600 hover:bg-green-500/10"
                        onClick={() => sendWhatsAppReminder(student)}
                        disabled={isSending}
                      >
                        {isSending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <MessageCircle className="h-4 w-4" />
                        )}
                        تذكير
                      </Button>
                    )}

                    {/* Payment Action Button */}
                    {isPaid ? (
                      // PAID: Show cancel button with confirmation
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="outline">
                            إلغاء الدفع
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent dir="rtl">
                          <AlertDialogHeader>
                            <AlertDialogTitle>إلغاء الدفع</AlertDialogTitle>
                            <AlertDialogDescription>
                              هل تريد إلغاء جميع دفعات {student.name} لشهر{" "}
                              {formatMonthYearAr(selectedMonth, selectedYear)}؟
                              <br />
                              <span className="text-amber-600 font-medium">
                                سيتم حذف {amountPaid.toLocaleString()} {CURRENCY}
                              </span>
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter className="flex-row-reverse gap-2">
                            <AlertDialogCancel>إلغاء</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleResetPayment(student)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              تأكيد الإلغاء
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    ) : isPartial ? (
                      // PARTIAL: Show add more button + reset option
                      <div className="flex gap-1">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="إلغاء الدفع">
                              <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent dir="rtl">
                            <AlertDialogHeader>
                              <AlertDialogTitle>إلغاء الدفع</AlertDialogTitle>
                              <AlertDialogDescription>
                                هل تريد إلغاء جميع دفعات {student.name}؟
                                <br />
                                <span className="text-amber-600 font-medium">
                                  سيتم حذف {amountPaid.toLocaleString()} {CURRENCY}
                                </span>
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="flex-row-reverse gap-2">
                              <AlertDialogCancel>إلغاء</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleResetPayment(student)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                تأكيد الإلغاء
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        <Button
                          size="sm"
                          className="gradient-accent"
                          onClick={() => openRecordPaymentDialog(student, true)}
                        >
                          أضف دفعة
                        </Button>
                      </div>
                    ) : (
                      // UNPAID: Show record payment button
                      <Button
                        size="sm"
                        className="gradient-accent"
                        onClick={() => openRecordPaymentDialog(student, false)}
                      >
                        سجل دفع
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Payment Recording Dialog */}
      <Dialog
        open={recordPaymentDialog.open}
        onOpenChange={(open) =>
          !open && setRecordPaymentDialog({ open: false, student: null, isAddingToPartial: false })
        }
      >
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-success" />
              {recordPaymentDialog.isAddingToPartial ? "إضافة دفعة" : "تسجيل دفعة"} -{" "}
              {recordPaymentDialog.student?.name}
            </DialogTitle>
            <DialogDescription>شهر {formatMonthYearAr(selectedMonth, selectedYear)}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Show current status for partial payments */}
            {recordPaymentDialog.isAddingToPartial && recordPaymentDialog.student && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                <div className="flex justify-between text-sm">
                  <span>المدفوع سابقاً:</span>
                  <span className="font-medium text-amber-600">
                    {getAmountPaid(recordPaymentDialog.student.id, selectedMonth, selectedYear).toLocaleString()}{" "}
                    {CURRENCY}
                  </span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span>المتبقي:</span>
                  <span className="font-medium">
                    {Math.max(
                      0,
                      getStudentMonthTotal(recordPaymentDialog.student, selectedMonth, selectedYear, settings) -
                        getAmountPaid(recordPaymentDialog.student.id, selectedMonth, selectedYear),
                    ).toLocaleString()}{" "}
                    {CURRENCY}
                  </span>
                </div>
              </div>
            )}

            {/* Amount Input */}
            <div className="space-y-2">
              <Label htmlFor="amount">المبلغ المدفوع</Label>
              <div className="flex gap-2">
                <Input
                  id="amount"
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="0"
                  className="text-left"
                  dir="ltr"
                />
                <span className="flex items-center px-3 rounded-md border bg-muted text-sm">{CURRENCY}</span>
              </div>
              {recordPaymentDialog.student && (
                <p className="text-xs text-muted-foreground">
                  الإجمالي المستحق:{" "}
                  {getStudentMonthTotal(
                    recordPaymentDialog.student,
                    selectedMonth,
                    selectedYear,
                    settings,
                  ).toLocaleString()}{" "}
                  {CURRENCY}
                </p>
              )}
            </div>

            {/* Payment Method */}
            <div className="space-y-2">
              <Label>طريقة الدفع</Label>
              <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}>
                <div className="flex items-center space-x-2 space-x-reverse">
                  <RadioGroupItem value="cash" id="cash" />
                  <Label htmlFor="cash" className="cursor-pointer">
                    💵 كاش
                  </Label>
                </div>
                <div className="flex items-center space-x-2 space-x-reverse">
                  <RadioGroupItem value="bank" id="bank" />
                  <Label htmlFor="bank" className="cursor-pointer">
                    🏦 تحويل بنكي
                  </Label>
                </div>
                <div className="flex items-center space-x-2 space-x-reverse">
                  <RadioGroupItem value="wallet" id="wallet" />
                  <Label htmlFor="wallet" className="cursor-pointer">
                    📱 محفظة إلكترونية
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Payment Date */}
            <div className="space-y-2">
              <Label htmlFor="date">تاريخ الدفع</Label>
              <Input
                id="date"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="text-left"
                dir="ltr"
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">ملاحظات (اختياري)</Label>
              <Textarea
                id="notes"
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                placeholder="أي ملاحظات إضافية..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <DialogClose asChild>
              <Button variant="outline">إلغاء</Button>
            </DialogClose>
            <Button onClick={handleRecordPayment} className="gradient-accent gap-2">
              <Check className="h-4 w-4" />
              حفظ الدفعة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment History Dialog */}
      <Dialog
        open={historyDialog.open}
        onOpenChange={(open) => !open && setHistoryDialog({ open: false, view: "monthly" })}
      >
        <DialogContent dir="rtl" className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              سجل المدفوعات
            </DialogTitle>
          </DialogHeader>

          <Tabs
            value={historyDialog.view}
            onValueChange={(v) => setHistoryDialog({ ...historyDialog, view: v as "student" | "monthly" })}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="monthly">📅 شهري لجميع الطلاب</TabsTrigger>
              <TabsTrigger value="student">👤 طالب واحد</TabsTrigger>
            </TabsList>

            {/* Monthly View */}
            <TabsContent value="monthly" className="space-y-3">
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <Calendar className="h-4 w-4 text-primary" />
                <span className="font-medium">{formatMonthYearAr(selectedMonth, selectedYear)}</span>
              </div>

              <ScrollArea className="h-[400px]">
                <div className="space-y-2 pr-2">
                  {students.map((student) => {
                    const paymentStatus = getPaymentStatusLocal(student.id);
                    const paymentDetails = getPaymentDetails(student.id);
                    const studentTotal = getStudentMonthTotal(student, selectedMonth, selectedYear, settings);
                    const monthStats = getStudentMonthStats(student, selectedMonth, selectedYear);
                    const billableCount = monthStats.completed + monthStats.scheduled;
                    const amountPaid = getAmountPaid(student.id, selectedMonth, selectedYear);

                    return (
                      <div
                        key={student.id}
                        className={cn(
                          "p-3 rounded-lg border",
                          paymentStatus === "paid" && "bg-success/5 border-success/30",
                          paymentStatus === "partial" && "bg-amber-500/5 border-amber-500/30",
                          paymentStatus === "unpaid" && "bg-muted/50 border-border",
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              {paymentStatus === "paid" ? (
                                <Check className="h-4 w-4 text-success" />
                              ) : paymentStatus === "partial" ? (
                                <Clock className="h-4 w-4 text-amber-500" />
                              ) : (
                                <X className="h-4 w-4 text-muted-foreground" />
                              )}
                              <span className="font-medium">{student.name}</span>
                            </div>
                            <div className="text-xs text-muted-foreground space-y-0.5">
                              {billableCount > 0 && (
                                <p>
                                  {billableCount} حصص × {getStudentSessionPrice(student, settings)} {CURRENCY} ={" "}
                                  {studentTotal.toLocaleString()} {CURRENCY}
                                </p>
                              )}
                              {paymentStatus === "partial" && (
                                <p className="text-amber-600 font-medium">
                                  المدفوع: {amountPaid.toLocaleString()} {CURRENCY} | المتبقي:{" "}
                                  {(studentTotal - amountPaid).toLocaleString()} {CURRENCY}
                                </p>
                              )}
                              {paymentStatus !== "unpaid" && paymentDetails?.paidAt && (
                                <p>آخر دفعة: {formatDateAr(paymentDetails.paidAt)}</p>
                              )}
                              {paymentDetails?.paymentRecords && paymentDetails.paymentRecords.length > 1 && (
                                <p className="text-primary font-medium">
                                  {paymentDetails.paymentRecords.length} دفعات مسجلة
                                </p>
                              )}
                            </div>
                          </div>
                          <Badge
                            className={cn(
                              paymentStatus === "paid" && "bg-success",
                              paymentStatus === "partial" && "bg-amber-500",
                              paymentStatus === "unpaid" && "bg-muted text-muted-foreground",
                            )}
                          >
                            {paymentStatus === "paid" ? "مدفوع" : paymentStatus === "partial" ? "جزئي" : "معلق"}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>

              {/* Monthly Summary */}
              <div className="p-3 bg-primary/5 rounded-lg border-2 border-primary/20">
                <div className="grid grid-cols-3 gap-2 text-center text-sm">
                  <div>
                    <p className="text-lg font-bold">{totalExpected.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">{CURRENCY} متوقع</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-success">{totalCollected.toLocaleString()}</p>
                    <p className="text-xs text-success/80">{CURRENCY} محصّل</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-warning">{totalPending.toLocaleString()}</p>
                    <p className="text-xs text-warning/80">{CURRENCY} متبقي</p>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Student View */}
            <TabsContent value="student" className="space-y-3">
              <Select value={selectedStudentHistory || ""} onValueChange={setSelectedStudentHistory}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر طالب..." />
                </SelectTrigger>
                <SelectContent>
                  {students.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedStudent ? (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2 pr-2">
                    {getPaymentHistory(selectedStudent.id).length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <History className="h-12 w-12 mx-auto mb-3 opacity-20" />
                        <p className="text-sm">لا يوجد سجل دفعات</p>
                      </div>
                    ) : (
                      getPaymentHistory(selectedStudent.id).map((payment) => {
                        const studentTotal = getStudentMonthTotal(
                          selectedStudent,
                          payment.month,
                          payment.year,
                          settings,
                        );
                        const monthStats = getStudentMonthStats(selectedStudent, payment.month, payment.year);
                        const billableCount = monthStats.completed + monthStats.scheduled;
                        const amountPaid = payment.amountPaid || payment.amount || 0;
                        const isFullyPaid = amountPaid >= studentTotal;

                        return (
                          <div
                            key={`${payment.year}-${payment.month}`}
                            className={cn(
                              "p-3 rounded-lg border",
                              isFullyPaid ? "bg-success/5 border-success/30" : "bg-amber-500/5 border-amber-500/30",
                            )}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  {isFullyPaid ? (
                                    <Check className="h-4 w-4 text-success" />
                                  ) : (
                                    <Clock className="h-4 w-4 text-amber-500" />
                                  )}
                                  <span className="font-medium">{formatMonthYearAr(payment.month, payment.year)}</span>
                                </div>
                                <div className="text-xs text-muted-foreground space-y-0.5">
                                  <p>
                                    {billableCount} حصص = {studentTotal.toLocaleString()} {CURRENCY}
                                  </p>
                                  <p
                                    className={isFullyPaid ? "text-success font-medium" : "text-amber-600 font-medium"}
                                  >
                                    المدفوع: {amountPaid.toLocaleString()} {CURRENCY}
                                    {!isFullyPaid &&
                                      ` | المتبقي: ${(studentTotal - amountPaid).toLocaleString()} ${CURRENCY}`}
                                  </p>
                                  {payment.paidAt && <p>آخر دفعة: {formatDateAr(payment.paidAt)}</p>}
                                  {payment.method && <p>الطريقة: {getPaymentMethodLabel(payment.method)}</p>}

                                  {/* Payment Records */}
                                  {payment.paymentRecords && payment.paymentRecords.length > 0 && (
                                    <div className="mt-2 pt-2 border-t border-border/50">
                                      <p className="font-medium text-foreground mb-1">
                                        سجل الدفعات ({payment.paymentRecords.length}):
                                      </p>
                                      {payment.paymentRecords.map((record, idx) => (
                                        <div key={record.id || idx} className="flex justify-between text-xs py-0.5">
                                          <span>
                                            {idx + 1}. {record.amount.toLocaleString()} {CURRENCY} (
                                            {getPaymentMethodLabel(record.method)})
                                          </span>
                                          <span>{formatDateAr(record.paidAt)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <Badge className={isFullyPaid ? "bg-success" : "bg-amber-500"}>
                                {isFullyPaid ? "مدفوع" : "جزئي"}
                              </Badge>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p className="text-sm">اختر طالب لعرض سجله</p>
                </div>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">إغلاق</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Send Confirmation Dialog */}
      <Dialog open={showBulkConfirm} onOpenChange={setShowBulkConfirm}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-green-600" />
              إرسال تذكيرات جماعية
            </DialogTitle>
            <DialogDescription>
              سيتم إرسال رسالة WhatsApp تذكير بالدفع لـ{" "}
              {getWhatsAppTargetStudents(whatsappTarget).filter((s) => s.phone).length} طالب (
              {getWhatsAppTargetLabel(whatsappTarget)}) لشهر {formatMonthYearAr(selectedMonth, selectedYear)}.
              {getWhatsAppTargetStudents(whatsappTarget).filter((s) => !s.phone).length > 0 && (
                <span className="block mt-2 text-warning">
                  ⚠️ {getWhatsAppTargetStudents(whatsappTarget).filter((s) => !s.phone).length} طالب بدون رقم هاتف
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <DialogClose asChild>
              <Button variant="outline">إلغاء</Button>
            </DialogClose>
            <Button onClick={sendBulkWhatsAppReminders} className="gap-2 bg-green-600 hover:bg-green-700">
              <Send className="h-4 w-4" />
              إرسال الآن
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
