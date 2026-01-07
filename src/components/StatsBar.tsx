import { Users, CheckCircle, Clock, CreditCard } from 'lucide-react';
import { Student, MonthlyRecord } from '@/types/student';

interface StatsBarProps {
  students: Student[];
  getMonthlyRecord: (student: Student) => MonthlyRecord;
}

export const StatsBar = ({ students, getMonthlyRecord }: StatsBarProps) => {
  const totalStudents = students.length;
  
  const stats = students.reduce(
    (acc, student) => {
      const record = getMonthlyRecord(student);
      const completed = record.sessions.filter(s => s.completed).length;
      const total = record.sessions.length;
      return {
        completedSessions: acc.completedSessions + completed,
        totalSessions: acc.totalSessions + total,
        paidCount: acc.paidCount + (record.isPaid ? 1 : 0),
      };
    },
    { completedSessions: 0, totalSessions: 0, paidCount: 0 }
  );

  const statItems = [
    {
      label: 'Total Students',
      value: totalStudents,
      icon: Users,
      color: 'text-primary bg-primary/10',
    },
    {
      label: 'Sessions Done',
      value: `${stats.completedSessions}/${stats.totalSessions}`,
      icon: CheckCircle,
      color: 'text-success bg-success/10',
    },
    {
      label: 'Pending Sessions',
      value: stats.totalSessions - stats.completedSessions,
      icon: Clock,
      color: 'text-warning bg-warning/10',
    },
    {
      label: 'Payments Received',
      value: `${stats.paidCount}/${totalStudents}`,
      icon: CreditCard,
      color: 'text-accent bg-accent/10',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {statItems.map((stat, index) => (
        <div
          key={stat.label}
          className="bg-card rounded-xl p-4 card-shadow animate-fade-in"
          style={{ animationDelay: `${index * 100}ms` }}
        >
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${stat.color}`}>
              <stat.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-heading font-bold">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
