import { Check, X, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Student, StudentPayments } from '@/types/student';
import { formatMonthYear } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';

interface PaymentsDashboardProps {
  students: Student[];
  payments: StudentPayments[];
  selectedMonth: number;
  selectedYear: number;
  onTogglePayment: (studentId: string, month: number, year: number) => void;
}

export const PaymentsDashboard = ({
  students,
  payments,
  selectedMonth,
  selectedYear,
  onTogglePayment,
}: PaymentsDashboardProps) => {
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
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="card-shadow bg-success/10 border-success/20">
          <CardContent className="py-4 text-center">
            <p className="text-3xl font-heading font-bold text-success">{paidCount}</p>
            <p className="text-sm text-success/80">Paid</p>
          </CardContent>
        </Card>
        <Card className="card-shadow bg-warning/10 border-warning/20">
          <CardContent className="py-4 text-center">
            <p className="text-3xl font-heading font-bold text-warning">{unpaidCount}</p>
            <p className="text-sm text-warning/80">Pending</p>
          </CardContent>
        </Card>
      </div>

      {/* Payment List */}
      <Card className="card-shadow">
        <CardHeader className="pb-3">
          <CardTitle className="font-heading text-lg">
            {formatMonthYear(selectedMonth, selectedYear)}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {students.map(student => {
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
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center",
                    isPaid ? "bg-success text-success-foreground" : "bg-muted"
                  )}>
                    {isPaid ? <Check className="h-4 w-4" /> : <X className="h-4 w-4 text-muted-foreground" />}
                  </div>
                  <span className="font-medium">{student.name}</span>
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
          })}
        </CardContent>
      </Card>
    </div>
  );
};
