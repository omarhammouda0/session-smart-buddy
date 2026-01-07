import { Users, CreditCard, XCircle } from 'lucide-react';
import { Student, StudentPayments } from '@/types/student';

interface StatsBarProps {
  students: Student[];
  payments: StudentPayments[];
  selectedMonth: number;
  selectedYear: number;
}

export const StatsBar = ({ students, payments, selectedMonth, selectedYear }: StatsBarProps) => {
  const totalStudents = students.length;

  const paidCount = students.reduce((count, student) => {
    const studentPayments = payments.find(p => p.studentId === student.id);
    if (!studentPayments) return count;
    const payment = studentPayments.payments.find(
      p => p.month === selectedMonth && p.year === selectedYear
    );
    return count + (payment?.isPaid ? 1 : 0);
  }, 0);

  const unpaidCount = totalStudents - paidCount;

  const statItems = [
    {
      label: 'إجمالي الطلاب',
      value: totalStudents,
      icon: Users,
      color: 'text-primary bg-primary/10',
    },
    {
      label: 'دفعوا',
      value: paidCount,
      icon: CreditCard,
      color: 'text-success bg-success/10',
    },
    {
      label: 'لم يدفعوا',
      value: unpaidCount,
      icon: XCircle,
      color: 'text-warning bg-warning/10',
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-3" dir="rtl">
      {statItems.map((stat, index) => (
        <div
          key={stat.label}
          className="bg-card rounded-xl p-3 card-shadow animate-fade-in"
          style={{ animationDelay: `${index * 50}ms` }}
        >
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${stat.color}`}>
              <stat.icon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-lg font-heading font-bold leading-none">{stat.value}</p>
              <p className="text-[10px] text-muted-foreground">{stat.label}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
