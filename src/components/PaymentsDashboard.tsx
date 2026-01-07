import { useState } from 'react';
import { Check, X, CreditCard, Clock, Users, ChevronLeft, ChevronRight, Calendar, Bell, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Student, StudentPayments, DAY_NAMES_SHORT } from '@/types/student';
import { formatMonthYear } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';
import { format, subMonths } from 'date-fns';
import { toast } from '@/hooks/use-toast';

interface PaymentsDashboardProps {
  students: Student[];
  payments: StudentPayments[];
  selectedMonth: number;
  selectedYear: number;
  onTogglePayment: (studentId: string, month: number, year: number) => void;
}

type PaymentFilter = 'all' | 'paid' | 'unpaid';

const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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
    return studentPayments.payments
      .sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return b.month - a.month;
      });
  };

  const paidCount = students.filter(s => getPaymentStatus(s.id)).length;
  const unpaidCount = students.length - paidCount;
  const unpaidStudents = students.filter(s => !getPaymentStatus(s.id));

  // Generate last 6 months for quick selection
  const getRecentMonths = () => {
    const months = [];
    for (let i = 2; i >= -3; i--) {
      const date = subMonths(now, i);
      months.push({
        month: date.getMonth(),
        year: date.getFullYear(),
        label: MONTH_NAMES_SHORT[date.getMonth()],
        fullLabel: format(date, 'MMMM yyyy'),
        isCurrent: date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear(),
      });
    }
    return months;
  };

  const recentMonths = getRecentMonths();

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

  const sendPaymentReminder = () => {
    if (unpaidStudents.length === 0) {
      toast({
        title: "All Paid!",
        description: "All students have paid for this month.",
      });
      return;
    }

    toast({
      title: "Payment Reminders",
      description: `${unpaidStudents.length} student(s) haven't paid for ${formatMonthYear(selectedMonth, selectedYear)}: ${unpaidStudents.map(s => s.name).join(', ')}`,
      duration: 8000,
    });
  };

  // Apply filters
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
      <Card className="card-shadow">
        <CardContent className="py-12 text-center">
          <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Add students to track payments</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Month Filter */}
      <div className="space-y-3">
        {/* Month navigation */}
        <div className="flex items-center justify-center gap-2">
          <Button variant="ghost" size="icon" onClick={goToPrevMonth} className="h-8 w-8">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-center min-w-[140px]">
            <p className="font-heading font-semibold text-lg">
              {formatMonthYear(selectedMonth, selectedYear)}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={goToNextMonth} className="h-8 w-8">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Quick month selection */}
        <div className="flex justify-center gap-1.5 overflow-x-auto pb-1">
          {recentMonths.map(m => (
            <button
              key={`${m.year}-${m.month}`}
              onClick={() => {
                setSelectedMonth(m.month);
                setSelectedYear(m.year);
              }}
              className={cn(
                "flex flex-col items-center px-3 py-2 rounded-lg transition-all min-w-[56px]",
                selectedMonth === m.month && selectedYear === m.year
                  ? "bg-primary text-primary-foreground shadow-md"
                  : m.isCurrent
                    ? "bg-primary/10 border-2 border-primary/30 hover:bg-primary/20"
                    : "bg-card border border-border hover:border-primary/50"
              )}
            >
              <span className="text-xs font-medium">{m.label}</span>
              <span className="text-[10px] opacity-70">{m.year}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Payment Status Filter */}
      <div className="flex gap-2">
        <button
          onClick={() => setPaymentFilter('all')}
          className={cn(
            "flex-1 rounded-lg p-3 card-shadow transition-all text-center",
            paymentFilter === 'all'
              ? "ring-2 ring-primary bg-card"
              : "bg-card hover:bg-muted/50"
          )}
        >
          <p className="text-xl font-heading font-bold">{students.length}</p>
          <p className="text-xs text-muted-foreground">Total Students</p>
        </button>
        <button
          onClick={() => setPaymentFilter('paid')}
          className={cn(
            "flex-1 rounded-lg p-3 card-shadow transition-all text-center",
            paymentFilter === 'paid'
              ? "ring-2 ring-success bg-success/10"
              : "bg-success/10 hover:bg-success/20"
          )}
        >
          <p className="text-xl font-heading font-bold text-success">{paidCount}</p>
          <p className="text-xs text-success/80">Students Paid</p>
        </button>
        <button
          onClick={() => setPaymentFilter('unpaid')}
          className={cn(
            "flex-1 rounded-lg p-3 card-shadow transition-all text-center",
            paymentFilter === 'unpaid'
              ? "ring-2 ring-warning bg-warning/10"
              : "bg-warning/10 hover:bg-warning/20"
          )}
        >
          <p className="text-xl font-heading font-bold text-warning">{unpaidCount}</p>
          <p className="text-xs text-warning/80">Students Unpaid</p>
        </button>
      </div>

      {/* Payment Reminder Button */}
      <Button 
        variant="outline" 
        className="w-full gap-2 border-warning/50 text-warning hover:bg-warning/10"
        onClick={sendPaymentReminder}
      >
        <Bell className="h-4 w-4" />
        Send Payment Reminder ({unpaidCount} unpaid)
      </Button>

      {/* Student Filter with History */}
      <div className="flex gap-2">
        <Select value={studentFilter} onValueChange={setStudentFilter}>
          <SelectTrigger className="flex-1">
            <Users className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="All Students" />
          </SelectTrigger>
          <SelectContent className="bg-popover z-50">
            <SelectItem value="all">All Students</SelectItem>
            {students.map(student => (
              <SelectItem key={student.id} value={student.id}>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "w-2 h-2 rounded-full",
                    getPaymentStatus(student.id) ? "bg-success" : "bg-warning"
                  )} />
                  <span>{student.name}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Payment History Dialog */}
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="icon" className="shrink-0">
              <History className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Payment History
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Select value={selectedStudentHistory || ''} onValueChange={setSelectedStudentHistory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a student" />
                </SelectTrigger>
                <SelectContent>
                  {students.map(student => (
                    <SelectItem key={student.id} value={student.id}>
                      {student.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedStudent && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{selectedStudent.name}</span>
                    <Badge variant="outline">
                      {getPaymentHistory(selectedStudent.id).filter(p => p.isPaid).length} paid
                    </Badge>
                  </div>
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-2 pr-2">
                      {getPaymentHistory(selectedStudent.id).length === 0 ? (
                        <p className="text-center text-muted-foreground py-8 text-sm">
                          No payment history yet
                        </p>
                      ) : (
                        getPaymentHistory(selectedStudent.id).map((payment, idx) => (
                          <div
                            key={idx}
                            className={cn(
                              "flex items-center justify-between p-3 rounded-lg border",
                              payment.isPaid
                                ? "bg-success/10 border-success/30"
                                : "bg-warning/10 border-warning/30"
                            )}
                          >
                            <div className="flex items-center gap-2">
                              {payment.isPaid ? (
                                <Check className="h-4 w-4 text-success" />
                              ) : (
                                <X className="h-4 w-4 text-warning" />
                              )}
                              <span className="font-medium">
                                {formatMonthYear(payment.month, payment.year)}
                              </span>
                            </div>
                            <Badge className={cn(
                              "text-xs",
                              payment.isPaid
                                ? "bg-success/20 text-success border-success/30"
                                : "bg-warning/20 text-warning border-warning/30"
                            )}>
                              {payment.isPaid ? 'Paid' : 'Unpaid'}
                            </Badge>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {!selectedStudentHistory && (
                <p className="text-center text-muted-foreground py-8 text-sm">
                  Select a student to view payment history
                </p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Payment List */}
      <Card className="card-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="font-heading text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              {formatMonthYear(selectedMonth, selectedYear)}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {filteredStudents.length === 0 ? (
            <p className="text-center text-muted-foreground py-4 text-sm">
              No students match the current filters
            </p>
          ) : (
            filteredStudents.map(student => {
              const isPaid = getPaymentStatus(student.id);
              return (
                <div
                  key={student.id}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-lg border transition-all",
                    isPaid
                      ? "bg-success/10 border-success/30"
                      : "bg-card border-border"
                  )}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                      isPaid ? "bg-success text-success-foreground" : "bg-muted"
                    )}>
                      {isPaid ? <Check className="h-4 w-4" /> : <X className="h-4 w-4 text-muted-foreground" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="font-medium block truncate">{student.name}</span>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {student.sessionTime || '16:00'}
                        </span>
                        <span>•</span>
                        <span>{student.scheduleDays.map(d => DAY_NAMES_SHORT[d.dayOfWeek]).join(', ')}</span>
                      </div>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant={isPaid ? "outline" : "default"}
                    className={cn(!isPaid && "gradient-accent")}
                    onClick={() => onTogglePayment(student.id, selectedMonth, selectedYear)}
                  >
                    {isPaid ? 'Mark Unpaid' : 'Mark Paid'}
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
