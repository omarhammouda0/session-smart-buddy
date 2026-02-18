import { Users, CreditCard, XCircle, Palmtree } from 'lucide-react';
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

  // Count vacation sessions for this month across all students
  const vacationCount = students.reduce((count, student) => {
    return count + student.sessions.filter(s => {
      if (s.status !== 'vacation') return false;
      const sessionDate = new Date(s.date);
      return sessionDate.getMonth() === selectedMonth && sessionDate.getFullYear() === selectedYear;
    }).length;
  }, 0);

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
      color: 'text-destructive bg-destructive/10',
    },
    {
      label: 'إجازات الشهر',
      value: vacationCount,
      icon: Palmtree,
      color: 'text-warning bg-warning/10',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" dir="rtl">
      {statItems.map((stat, index) => (
        <div
          key={stat.label}
          className="bg-card rounded-xl p-2.5 card-shadow animate-fade-in"
          style={{ animationDelay: `${index * 50}ms` }}
        >
          <div className="flex flex-col items-center gap-1">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${stat.color}`}>
              <stat.icon className="h-3.5 w-3.5" />
            </div>
            <div className="text-center">
              <p className="text-base font-heading font-bold leading-none">{stat.value}</p>
              <p className="text-[10px] sm:text-[9px] text-muted-foreground mt-0.5">{stat.label}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
