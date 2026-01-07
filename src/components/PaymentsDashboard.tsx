import { useState } from 'react';
import { Check, X, CreditCard, Clock, Users, ChevronLeft, ChevronRight, Calendar, Bell, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Student, StudentPayments } from '@/types/student';
import { formatMonthYearAr, DAY_NAMES_SHORT_AR, MONTH_NAMES_AR } from '@/lib/arabicConstants';
import { cn } from '@/lib/utils';
import { subMonths } from 'date-fns';
import { toast } from '@/hooks/use-toast';

interface PaymentsDashboardProps {
  students: Student[];
  payments: StudentPayments[];
  selectedMonth: number;
  selectedYear: number;
  onTogglePayment: (studentId: string, month: number, year: number) => void;
}

type PaymentFilter = 'all' | 'paid' | 'unpaid';

export const PaymentsDashboard = ({
  students,
  payments,
  selectedMonth: initialMonth,
  selectedYear: initialYear,
  onTogglePayment,
}: PaymentsDashboardProps) => {
  const now = new Date();
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('all');
  const [studentFilter, setStudentFilter] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [selectedYear, setSelectedYear] = useState(initialYear);
  const [selectedStudentHistory, setSelectedStudentHistory] = useState<string | null>(null);

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

  const sendPaymentReminder = () => {
    if (unpaidStudents.length === 0) {
      toast({ title: "الكل دفعوا!", description: "جميع الطلاب دفعوا لهذا الشهر." });
      return;
    }
    toast({
      title: "تذكير بالدفع",
      description: `${unpaidStudents.length} طالب لم يدفعوا لشهر ${formatMonthYearAr(selectedMonth, selectedYear)}: ${unpaidStudents.map(s => s.name).join('، ')}`,
      duration: 8000,
    });
  };

  const filteredStudents = students.filter(student => {
    const isPaid = getPaymentStatus(student.id);
    if (paymentFilter === 'paid' && !isPaid) return false;
    if (paymentFilter === 'unpaid' && isPaid) return false;
    if (studentFilter !== 'all' && student.id !== studentFilter) return false;
    return true;
  });

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

      <Button variant="outline" className="w-full gap-2 border-warning/50 text-warning hover:bg-warning/10" onClick={sendPaymentReminder}>
        <Bell className="h-4 w-4" />
        تذكير بالدفع ({unpaidCount} لم يدفعوا)
      </Button>

      <Card className="card-shadow">
        <CardHeader className="pb-3">
          <CardTitle className="font-heading text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            {formatMonthYearAr(selectedMonth, selectedYear)}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {filteredStudents.length === 0 ? (
            <p className="text-center text-muted-foreground py-4 text-sm">لا يوجد طلاب تطابق الفلتر</p>
          ) : (
            filteredStudents.map(student => {
              const isPaid = getPaymentStatus(student.id);
              return (
                <div key={student.id} className={cn("flex items-center justify-between p-3 rounded-lg border transition-all", isPaid ? "bg-success/10 border-success/30" : "bg-card border-border")}>
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0", isPaid ? "bg-success text-success-foreground" : "bg-muted")}>
                      {isPaid ? <Check className="h-4 w-4" /> : <X className="h-4 w-4 text-muted-foreground" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="font-medium block truncate">{student.name}</span>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{student.sessionTime || '16:00'}</span>
                        <span>•</span>
                        <span>{student.scheduleDays.map(d => DAY_NAMES_SHORT_AR[d.dayOfWeek]).join('، ')}</span>
                      </div>
                    </div>
                  </div>
                  <Button size="sm" variant={isPaid ? "outline" : "default"} className={cn(!isPaid && "gradient-accent")} onClick={() => onTogglePayment(student.id, selectedMonth, selectedYear)}>
                    {isPaid ? 'إلغاء الدفع' : 'تسجيل دفع'}
                  </Button>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
};
