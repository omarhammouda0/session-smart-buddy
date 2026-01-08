import { useState, useMemo } from 'react';
import { Check, X, CreditCard, Clock, Users, ChevronLeft, ChevronRight, Calendar, Bell, History, MessageCircle, Loader2, Palmtree, Coins, Send, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Student, StudentPayments, AppSettings } from '@/types/student';
import { formatMonthYearAr, DAY_NAMES_SHORT_AR, MONTH_NAMES_AR } from '@/lib/arabicConstants';
import { cn } from '@/lib/utils';
import { subMonths } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const CURRENCY = 'جنيه';

// Helper to count session stats for a student in a given month
const getStudentMonthStats = (student: Student, month: number, year: number) => {
  const sessions = student.sessions.filter(s => {
    const sessionDate = new Date(s.date);
    return sessionDate.getMonth() === month && sessionDate.getFullYear() === year;
  });
  
  const completed = sessions.filter(s => s.status === 'completed').length;
  const vacation = sessions.filter(s => s.status === 'vacation').length;
  const cancelled = sessions.filter(s => s.status === 'cancelled').length;
  const scheduled = sessions.filter(s => s.status === 'scheduled').length;
  
  return { completed, vacation, cancelled, scheduled, total: sessions.length };
};

// Helper to get session price for a student
const getStudentSessionPrice = (student: Student, settings?: AppSettings): number => {
  if (student.useCustomSettings) {
    return student.sessionType === 'online' 
      ? (student.customPriceOnline ?? 0)
      : (student.customPriceOnsite ?? 0);
  }
  return student.sessionType === 'online'
    ? (settings?.defaultPriceOnline ?? 0)
    : (settings?.defaultPriceOnsite ?? 0);
};

// Helper to calculate total price for a student in a month
const getStudentMonthTotal = (student: Student, month: number, year: number, settings?: AppSettings): number => {
  const stats = getStudentMonthStats(student, month, year);
  const pricePerSession = getStudentSessionPrice(student, settings);
  return stats.completed * pricePerSession;
};

interface PaymentsDashboardProps {
  students: Student[];
  payments: StudentPayments[];
  selectedMonth: number;
  selectedYear: number;
  onTogglePayment: (studentId: string, month: number, year: number) => void;
  settings?: AppSettings;
}

type PaymentFilter = 'all' | 'paid' | 'unpaid';

export const PaymentsDashboard = ({
  students,
  payments,
  selectedMonth: initialMonth,
  selectedYear: initialYear,
  onTogglePayment,
  settings,
}: PaymentsDashboardProps) => {
  const now = new Date();
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('all');
  const [studentFilter, setStudentFilter] = useState<string>('all');
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [selectedYear, setSelectedYear] = useState(initialYear);
  const [selectedStudentHistory, setSelectedStudentHistory] = useState<string | null>(null);
  const [sendingReminder, setSendingReminder] = useState<string | null>(null);
  const [confirmPaymentStudent, setConfirmPaymentStudent] = useState<Student | null>(null);
  const [bulkSendingReminders, setBulkSendingReminders] = useState(false);
  const [bulkSendProgress, setBulkSendProgress] = useState({ current: 0, total: 0, success: 0, failed: 0 });
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);

  const getPaymentStatus = (studentId: string, month?: number, year?: number): boolean => {
    const studentPayments = payments.find(p => p.studentId === studentId);
    if (!studentPayments) return false;
    const payment = studentPayments.payments.find(
      p => p.month === (month ?? selectedMonth) && p.year === (year ?? selectedYear)
    );
    return payment?.isPaid || false;
  };

  const getPaymentHistory = (studentId: string) => {
    const studentPayments = payments.find(p => p.studentId === studentId);
    if (!studentPayments) return [];
    return studentPayments.payments.sort((a, b) => b.year !== a.year ? b.year - a.year : b.month - a.month);
  };

  const paidCount = students.filter(s => getPaymentStatus(s.id)).length;
  const unpaidCount = students.length - paidCount;
  const unpaidStudents = students.filter(s => !getPaymentStatus(s.id));

  // Calculate totals
  const totalExpected = students.reduce((sum, student) => {
    return sum + getStudentMonthTotal(student, selectedMonth, selectedYear, settings);
  }, 0);
  
  const totalCollected = students
    .filter(s => getPaymentStatus(s.id))
    .reduce((sum, student) => {
      return sum + getStudentMonthTotal(student, selectedMonth, selectedYear, settings);
    }, 0);
  
  const totalPending = totalExpected - totalCollected;

  const getRecentMonths = () => {
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
  };

  const recentMonths = getRecentMonths();

  const goToPrevMonth = () => {
    if (selectedMonth === 0) { setSelectedMonth(11); setSelectedYear(selectedYear - 1); }
    else setSelectedMonth(selectedMonth - 1);
  };

  const goToNextMonth = () => {
    if (selectedMonth === 11) { setSelectedMonth(0); setSelectedYear(selectedYear + 1); }
    else setSelectedMonth(selectedMonth + 1);
  };

  const sendWhatsAppReminder = async (student: Student) => {
    if (!student.phone) {
      toast({ title: "خطأ", description: "لا يوجد رقم هاتف لهذا الطالب", variant: "destructive" });
      return;
    }

    setSendingReminder(student.id);
    try {
      const { data, error } = await supabase.functions.invoke('send-whatsapp-reminder', {
        body: {
          studentName: student.name,
          phoneNumber: student.phone,
          month: MONTH_NAMES_AR[selectedMonth],
          year: selectedYear,
        },
      });

      if (error) throw error;

      toast({ title: "تم الإرسال", description: `تم إرسال تذكير WhatsApp إلى ${student.name}` });
      setConfirmPaymentStudent(student);
    } catch (error: any) {
      console.error('WhatsApp error:', error);
      toast({ title: "خطأ", description: error.message || "فشل إرسال الرسالة", variant: "destructive" });
    } finally {
      setSendingReminder(null);
    }
  };

  const sendPaymentReminder = () => {
    if (unpaidStudents.length === 0) {
      toast({ title: "الكل دفعوا!", description: "جميع الطلاب دفعوا لهذا الشهر." });
      return;
    }
    // Show confirmation dialog for bulk send
    setShowBulkConfirm(true);
  };

  const sendBulkWhatsAppReminders = async () => {
    const studentsWithPhone = unpaidStudents.filter(s => s.phone);
    const studentsWithoutPhone = unpaidStudents.filter(s => !s.phone);
    
    if (studentsWithPhone.length === 0) {
      toast({ 
        title: "لا يوجد أرقام هاتف", 
        description: "لا يوجد أرقام هاتف مسجلة للطلاب الذين لم يدفعوا",
        variant: "destructive" 
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
      
      // Build custom message with student details
      const message = `عزيزي ولي الأمر،
تذكير بدفع رسوم شهر ${MONTH_NAMES_AR[selectedMonth]} لـ ${student.name}
عدد الجلسات: ${monthStats.completed}
المبلغ المستحق: ${studentTotal} ${CURRENCY}
شكراً لتعاونكم`;

      try {
        const { error } = await supabase.functions.invoke('send-whatsapp-reminder', {
          body: {
            studentName: student.name,
            phoneNumber: student.phone,
            customMessage: message,
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
        failed: failedCount 
      });

      // Small delay between messages to avoid rate limiting
      if (i < studentsWithPhone.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    setBulkSendingReminders(false);

    // Show results
    let description = `تم إرسال ${successCount} تذكير بنجاح`;
    if (failedCount > 0) {
      description += `، فشل ${failedCount}`;
    }
    if (studentsWithoutPhone.length > 0) {
      description += `\n${studentsWithoutPhone.length} طالب بدون رقم هاتف: ${studentsWithoutPhone.map(s => s.name).join('، ')}`;
    }

    toast({
      title: successCount > 0 ? "تم الإرسال" : "فشل الإرسال",
      description,
      duration: 8000,
      variant: failedCount > 0 && successCount === 0 ? "destructive" : "default",
    });
  };

  const handleConfirmPayment = () => {
    if (confirmPaymentStudent) {
      onTogglePayment(confirmPaymentStudent.id, selectedMonth, selectedYear);
      toast({ title: "تم التأكيد", description: `تم تسجيل دفع ${confirmPaymentStudent.name}` });
      setConfirmPaymentStudent(null);
    }
  };

  const filteredStudents = useMemo(() => {
    const searchLower = studentSearch.trim().toLowerCase();
    return students.filter(student => {
      const isPaid = getPaymentStatus(student.id);
      if (paymentFilter === 'paid' && !isPaid) return false;
      if (paymentFilter === 'unpaid' && isPaid) return false;
      if (studentFilter !== 'all' && student.id !== studentFilter) return false;
      if (searchLower && !student.name.toLowerCase().includes(searchLower)) return false;
      return true;
    });
  }, [students, paymentFilter, studentFilter, studentSearch, payments, selectedMonth, selectedYear]);

  const selectedStudent = students.find(s => s.id === selectedStudentHistory);

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

  return (
    <div className="space-y-4" dir="rtl">
      <div className="space-y-3">
        <div className="flex items-center justify-center gap-2">
          <Button variant="ghost" size="icon" onClick={goToNextMonth} className="h-8 w-8"><ChevronRight className="h-4 w-4" /></Button>
          <div className="text-center min-w-[140px]">
            <p className="font-heading font-semibold text-lg">{formatMonthYearAr(selectedMonth, selectedYear)}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={goToPrevMonth} className="h-8 w-8"><ChevronLeft className="h-4 w-4" /></Button>
        </div>
        <div className="flex justify-center gap-1.5 overflow-x-auto pb-1">
          {recentMonths.map(m => (
            <button
              key={`${m.year}-${m.month}`}
              onClick={() => { setSelectedMonth(m.month); setSelectedYear(m.year); }}
              className={cn("flex flex-col items-center px-3 py-2 rounded-lg transition-all min-w-[56px]",
                selectedMonth === m.month && selectedYear === m.year
                  ? "bg-primary text-primary-foreground shadow-md"
                  : m.isCurrent ? "bg-primary/10 border-2 border-primary/30" : "bg-card border border-border"
              )}
            >
              <span className="text-xs font-medium">{m.label}</span>
              <span className="text-[10px] opacity-70">{m.year}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Pricing Summary */}
      <Card className="card-shadow bg-gradient-to-br from-primary/5 to-primary/10">
        <CardContent className="py-4">
          <div className="flex items-center gap-2 mb-3">
            <Coins className="h-5 w-5 text-primary" />
            <span className="font-heading font-semibold">ملخص المدفوعات</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-card rounded-lg p-2">
              <p className="text-lg font-heading font-bold">{totalExpected.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground">{CURRENCY} متوقع</p>
            </div>
            <div className="bg-success/10 rounded-lg p-2">
              <p className="text-lg font-heading font-bold text-success">{totalCollected.toLocaleString()}</p>
              <p className="text-[10px] text-success/80">{CURRENCY} محصّل</p>
            </div>
            <div className="bg-warning/10 rounded-lg p-2">
              <p className="text-lg font-heading font-bold text-warning">{totalPending.toLocaleString()}</p>
              <p className="text-[10px] text-warning/80">{CURRENCY} متبقي</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <button onClick={() => setPaymentFilter('all')} className={cn("flex-1 rounded-lg p-3 card-shadow transition-all text-center", paymentFilter === 'all' ? "ring-2 ring-primary bg-card" : "bg-card")}>
          <p className="text-xl font-heading font-bold">{students.length}</p>
          <p className="text-xs text-muted-foreground">إجمالي الطلاب</p>
        </button>
        <button onClick={() => setPaymentFilter('paid')} className={cn("flex-1 rounded-lg p-3 card-shadow transition-all text-center", paymentFilter === 'paid' ? "ring-2 ring-success bg-success/10" : "bg-success/10")}>
          <p className="text-xl font-heading font-bold text-success">{paidCount}</p>
          <p className="text-xs text-success/80">دفعوا</p>
        </button>
        <button onClick={() => setPaymentFilter('unpaid')} className={cn("flex-1 rounded-lg p-3 card-shadow transition-all text-center", paymentFilter === 'unpaid' ? "ring-2 ring-warning bg-warning/10" : "bg-warning/10")}>
          <p className="text-xl font-heading font-bold text-warning">{unpaidCount}</p>
          <p className="text-xs text-warning/80">لم يدفعوا</p>
        </button>
      </div>

      {bulkSendingReminders ? (
        <div className="p-4 rounded-lg border bg-card space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              جاري إرسال التذكيرات...
            </span>
            <span className="text-muted-foreground">
              {bulkSendProgress.current} / {bulkSendProgress.total}
            </span>
          </div>
          <Progress value={(bulkSendProgress.current / bulkSendProgress.total) * 100} className="h-2" />
          <div className="flex gap-4 text-xs">
            <span className="text-success">✓ نجح: {bulkSendProgress.success}</span>
            {bulkSendProgress.failed > 0 && (
              <span className="text-destructive">✗ فشل: {bulkSendProgress.failed}</span>
            )}
          </div>
        </div>
      ) : (
        <Button 
          variant="outline" 
          className="w-full gap-2 border-green-500/50 text-green-600 hover:bg-green-500/10" 
          onClick={sendPaymentReminder}
          disabled={unpaidCount === 0}
        >
          <Send className="h-4 w-4" />
          إرسال تذكير WhatsApp للجميع ({unpaidCount} لم يدفعوا)
        </Button>
      )}

      <Card className="card-shadow">
        <CardHeader className="pb-3 space-y-3">
          <CardTitle className="font-heading text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            {formatMonthYearAr(selectedMonth, selectedYear)}
          </CardTitle>
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="ابحث عن طالب..."
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              className="pr-9 bg-background"
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {filteredStudents.length === 0 ? (
            <p className="text-center text-muted-foreground py-4 text-sm">
              {studentSearch.trim() ? 'لا يوجد نتائج' : 'لا يوجد طلاب تطابق الفلتر'}
            </p>
          ) : (
            filteredStudents.map(student => {
              const isPaid = getPaymentStatus(student.id);
              const isSending = sendingReminder === student.id;
              const monthStats = getStudentMonthStats(student, selectedMonth, selectedYear);
              const studentTotal = getStudentMonthTotal(student, selectedMonth, selectedYear, settings);
              const pricePerSession = getStudentSessionPrice(student, settings);
              return (
                <div key={student.id} className={cn("flex items-center justify-between p-3 rounded-lg border transition-all", isPaid ? "bg-success/10 border-success/30" : "bg-card border-border")}>
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0", isPaid ? "bg-success text-success-foreground" : "bg-muted")}>
                      {isPaid ? <Check className="h-4 w-4" /> : <X className="h-4 w-4 text-muted-foreground" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium truncate">{student.name}</span>
                        {studentTotal > 0 && (
                          <span className={cn("text-sm font-medium shrink-0", isPaid ? "text-success" : "text-foreground")}>
                            {studentTotal.toLocaleString()} {CURRENCY}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{student.sessionTime || '16:00'}</span>
                        <span>•</span>
                        <span>{student.scheduleDays.map(d => DAY_NAMES_SHORT_AR[d.dayOfWeek]).join('، ')}</span>
                        {monthStats.completed > 0 && (
                          <>
                            <span>•</span>
                            <span className="text-success">{monthStats.completed} × {pricePerSession} {CURRENCY}</span>
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
                  <div className="flex items-center gap-2">
                    {!isPaid && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 border-green-500/50 text-green-600 hover:bg-green-500/10"
                        onClick={() => sendWhatsAppReminder(student)}
                        disabled={isSending}
                      >
                        {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
                        تذكير
                      </Button>
                    )}
                    <Button size="sm" variant={isPaid ? "outline" : "default"} className={cn(!isPaid && "gradient-accent")} onClick={() => onTogglePayment(student.id, selectedMonth, selectedYear)}>
                      {isPaid ? 'إلغاء الدفع' : 'تسجيل دفع'}
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Payment Confirmation Dialog */}
      <Dialog open={!!confirmPaymentStudent} onOpenChange={(open) => !open && setConfirmPaymentStudent(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>تأكيد الدفع</DialogTitle>
            <DialogDescription>
              هل تم استلام الدفع من {confirmPaymentStudent?.name} لشهر {formatMonthYearAr(selectedMonth, selectedYear)}؟
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <DialogClose asChild>
              <Button variant="outline">لا، لاحقاً</Button>
            </DialogClose>
            <Button onClick={handleConfirmPayment} className="gradient-accent">
              نعم، تم الدفع
            </Button>
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
              سيتم إرسال رسالة WhatsApp تذكير بالدفع لـ {unpaidStudents.filter(s => s.phone).length} طالب لم يدفعوا لشهر {formatMonthYearAr(selectedMonth, selectedYear)}.
              {unpaidStudents.filter(s => !s.phone).length > 0 && (
                <span className="block mt-2 text-warning">
                  ⚠️ {unpaidStudents.filter(s => !s.phone).length} طالب بدون رقم هاتف لن يتم إرسال تذكير لهم.
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
