import { Users, CheckCircle, Clock, CreditCard } from 'lucide-react';
import { Student, StudentPayments } from '@/types/student';
import { getSessionsForMonth } from '@/lib/dateUtils';

interface StatsBarProps {
  students: Student[];
  payments: StudentPayments[];
  selectedMonth: number;
  selectedYear: number;
}

export const StatsBar = ({ students, payments, selectedMonth, selectedYear }: StatsBarProps) => {
  const totalStudents = students.length;
  
  const sessionStats = students.reduce(
    (acc, student) => {
      const monthSessions = getSessionsForMonth(student.sessions, selectedMonth, selectedYear);
      const completed = monthSessions.filter(s => s.completed).length;
      return {
        completedSessions: acc.completedSessions + completed,
        totalSessions: acc.totalSessions + monthSessions.length,
      };
    },
    { completedSessions: 0, totalSessions: 0 }
  );

  const paidCount = students.reduce((count, student) => {
    const studentPayments = payments.find(p => p.studentId === student.id);
    if (!studentPayments) return count;
    const payment = studentPayments.payments.find(
      p => p.month === selectedMonth && p.year === selectedYear
    );
    return count + (payment?.isPaid ? 1 : 0);
  }, 0);

  const statItems = [
    {
      label: 'Students',
      value: totalStudents,
      icon: Users,
      color: 'text-primary bg-primary/10',
    },
    {
      label: 'Done',
      value: `${sessionStats.completedSessions}/${sessionStats.totalSessions}`,
      icon: CheckCircle,
      color: 'text-success bg-success/10',
    },
    {
      label: 'Pending',
      value: sessionStats.totalSessions - sessionStats.completedSessions,
      icon: Clock,
      color: 'text-warning bg-warning/10',
    },
    {
      label: 'Paid',
      value: `${paidCount}/${totalStudents}`,
      icon: CreditCard,
      color: 'text-accent bg-accent/10',
    },
  ];

  return (
    <div className="grid grid-cols-4 gap-3">
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
