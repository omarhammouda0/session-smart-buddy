import { useState, useEffect } from 'react';
import { GraduationCap } from 'lucide-react';
import { useStudents } from '@/hooks/useStudents';
import { AddStudentDialog } from '@/components/AddStudentDialog';
import { MonthSelector } from '@/components/MonthSelector';
import { StudentCard } from '@/components/StudentCard';
import { EmptyState } from '@/components/EmptyState';
import { StatsBar } from '@/components/StatsBar';

const Index = () => {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  const {
    students,
    isLoaded,
    addStudent,
    removeStudent,
    updateStudentName,
    getOrCreateMonthlyRecord,
    ensureMonthlyRecord,
    updateSessionsPerMonth,
    toggleSessionComplete,
    updateSessionDate,
    togglePaymentStatus,
  } = useStudents();

  // Ensure all students have a record for the selected month
  useEffect(() => {
    if (isLoaded) {
      students.forEach(student => {
        ensureMonthlyRecord(student.id, selectedMonth, selectedYear);
      });
    }
  }, [selectedMonth, selectedYear, students.length, isLoaded]);

  const getStudentMonthlyRecord = (studentId: string) => {
    const student = students.find(s => s.id === studentId);
    if (!student) return null;
    return getOrCreateMonthlyRecord(student, selectedMonth, selectedYear);
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
                <GraduationCap className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="font-heading font-bold text-xl">Student Tracker</h1>
                <p className="text-sm text-muted-foreground">Manage sessions & payments</p>
              </div>
            </div>
            <AddStudentDialog onAdd={addStudent} />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Month Selector */}
        <div className="flex justify-center">
          <MonthSelector
            month={selectedMonth}
            year={selectedYear}
            onChange={(m, y) => {
              setSelectedMonth(m);
              setSelectedYear(y);
            }}
          />
        </div>

        {/* Stats */}
        {students.length > 0 && (
          <StatsBar
            students={students}
            getMonthlyRecord={(student) => getOrCreateMonthlyRecord(student, selectedMonth, selectedYear)}
          />
        )}

        {/* Students Grid */}
        {students.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {students.map(student => {
              const monthlyRecord = getStudentMonthlyRecord(student.id);
              if (!monthlyRecord) return null;
              
              return (
                <StudentCard
                  key={student.id}
                  student={student}
                  monthlyRecord={monthlyRecord}
                  month={selectedMonth}
                  year={selectedYear}
                  onRemove={() => removeStudent(student.id)}
                  onUpdateName={(name) => updateStudentName(student.id, name)}
                  onUpdateSessionsCount={(count) => updateSessionsPerMonth(student.id, selectedMonth, selectedYear, count)}
                  onToggleSession={(sessionId) => toggleSessionComplete(student.id, selectedMonth, selectedYear, sessionId)}
                  onUpdateSessionDate={(sessionId, date) => updateSessionDate(student.id, selectedMonth, selectedYear, sessionId, date)}
                  onTogglePayment={() => togglePaymentStatus(student.id, selectedMonth, selectedYear)}
                />
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default Index;
