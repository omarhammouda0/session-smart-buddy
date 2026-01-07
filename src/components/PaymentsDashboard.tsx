import { useState } from 'react';
import { Check, X, CreditCard, Filter, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Student, StudentPayments, DAY_NAMES_SHORT } from '@/types/student';
import { formatMonthYear } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';

interface PaymentsDashboardProps {
  students: Student[];
  payments: StudentPayments[];
  selectedMonth: number;
  selectedYear: number;
  onTogglePayment: (studentId: string, month: number, year: number) => void;
  onSelectStudent: (studentId: string) => void;
}

type FilterType = 'all' | 'paid' | 'unpaid';

export const PaymentsDashboard = ({
  students,
  payments,
  selectedMonth,
  selectedYear,
  onTogglePayment,
  onSelectStudent,
}: PaymentsDashboardProps) => {
  const [filter, setFilter] = useState<FilterType>('all');

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

  const filteredStudents = students.filter(student => {
    const isPaid = getPaymentStatus(student.id);
    if (filter === 'paid') return isPaid;
    if (filter === 'unpaid') return !isPaid;
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
      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-3">
        <button
          onClick={() => setFilter('all')}
          className={cn(
            "rounded-xl p-3 card-shadow transition-all text-left",
            filter === 'all' 
              ? "ring-2 ring-primary bg-card" 
              : "bg-card hover:bg-muted/50"
          )}
        >
          <p className="text-2xl font-heading font-bold">{students.length}</p>
          <p className="text-xs text-muted-foreground">All Students</p>
        </button>
        <button
          onClick={() => setFilter('paid')}
          className={cn(
            "rounded-xl p-3 card-shadow transition-all text-left",
            filter === 'paid' 
              ? "ring-2 ring-success bg-success/10" 
              : "bg-success/10 hover:bg-success/20"
          )}
        >
          <p className="text-2xl font-heading font-bold text-success">{paidCount}</p>
          <p className="text-xs text-success/80">Paid</p>
        </button>
        <button
          onClick={() => setFilter('unpaid')}
          className={cn(
            "rounded-xl p-3 card-shadow transition-all text-left",
            filter === 'unpaid' 
              ? "ring-2 ring-warning bg-warning/10" 
              : "bg-warning/10 hover:bg-warning/20"
          )}
        >
          <p className="text-2xl font-heading font-bold text-warning">{unpaidCount}</p>
          <p className="text-xs text-warning/80">Pending</p>
        </button>
      </div>

      {/* Payment List */}
      <Card className="card-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="font-heading text-lg">
              {formatMonthYear(selectedMonth, selectedYear)}
            </CardTitle>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Filter className="h-3 w-3" />
              {filter === 'all' ? 'All' : filter === 'paid' ? 'Paid only' : 'Unpaid only'}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {filteredStudents.length === 0 ? (
            <p className="text-center text-muted-foreground py-4 text-sm">
              No {filter === 'paid' ? 'paid' : filter === 'unpaid' ? 'unpaid' : ''} students
            </p>
          ) : (
            filteredStudents.map(student => {
              const isPaid = getPaymentStatus(student.id);
              return (
                <div
                  key={student.id}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer",
                    isPaid 
                      ? "bg-success/10 border-success/30 hover:bg-success/15" 
                      : "bg-card border-border hover:bg-muted/50"
                  )}
                  onClick={() => onSelectStudent(student.id)}
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
                    onClick={(e) => {
                      e.stopPropagation();
                      onTogglePayment(student.id, selectedMonth, selectedYear);
                    }}
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
