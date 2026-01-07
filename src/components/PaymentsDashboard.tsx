import { useState } from 'react';
import { Check, X, CreditCard, Clock, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Student, StudentPayments, DAY_NAMES_SHORT } from '@/types/student';
import { formatMonthYear } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';

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
  selectedMonth,
  selectedYear,
  onTogglePayment,
}: PaymentsDashboardProps) => {
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('all');
  const [studentFilter, setStudentFilter] = useState<string>('all');

  const getPaymentStatus = (studentId: string): boolean => {
    const studentPayments = payments.find(p => p.studentId === studentId);
    if (!studentPayments) return false;
    const payment = studentPayments.payments.find(
      p => p.month === selectedMonth && p.year === selectedYear
    );
    return payment?.isPaid || false;
  };

  const paidCount = students.filter(s => getPaymentStatus(s.id)).length;
  const unpaidCount = students.length - paidCount;

  // Apply filters
  const filteredStudents = students.filter(student => {
    // Payment status filter
    const isPaid = getPaymentStatus(student.id);
    if (paymentFilter === 'paid' && !isPaid) return false;
    if (paymentFilter === 'unpaid' && isPaid) return false;
    
    // Student filter
    if (studentFilter !== 'all' && student.id !== studentFilter) return false;
    
    return true;
  });

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
      {/* Filter Bars */}
      <div className="space-y-3">
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
            <p className="text-xs text-muted-foreground">All</p>
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
            <p className="text-xs text-success/80">Paid</p>
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
            <p className="text-xs text-warning/80">Pending</p>
          </button>
        </div>

        {/* Student Filter Dropdown */}
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground shrink-0" />
          <Select value={studentFilter} onValueChange={setStudentFilter}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Filter by student" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Students</SelectItem>
              {students.map(student => (
                <SelectItem key={student.id} value={student.id}>
                  <div className="flex items-center gap-2">
                    <span>{student.name}</span>
                    <span className={cn(
                      "text-xs px-1.5 py-0.5 rounded",
                      getPaymentStatus(student.id)
                        ? "bg-success/20 text-success"
                        : "bg-warning/20 text-warning"
                    )}>
                      {getPaymentStatus(student.id) ? 'Paid' : 'Unpaid'}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Payment List */}
      <Card className="card-shadow">
        <CardHeader className="pb-3">
          <CardTitle className="font-heading text-lg">
            {formatMonthYear(selectedMonth, selectedYear)}
          </CardTitle>
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
