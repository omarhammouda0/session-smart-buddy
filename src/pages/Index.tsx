import { useState } from 'react';
import { GraduationCap, BookOpen, CreditCard, Search, X } from 'lucide-react';
import { useStudents } from '@/hooks/useStudents';
import { AddStudentDialog } from '@/components/AddStudentDialog';
import { SemesterSettings } from '@/components/SemesterSettings';
import { MonthSelector } from '@/components/MonthSelector';
import { StudentCard } from '@/components/StudentCard';
import { PaymentsDashboard } from '@/components/PaymentsDashboard';
import { EmptyState } from '@/components/EmptyState';
import { StatsBar } from '@/components/StatsBar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const Index = () => {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [activeTab, setActiveTab] = useState('sessions');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  const {
    students,
    payments,
    settings,
    isLoaded,
    updateSettings,
    addStudent,
    removeStudent,
    updateStudentName,
    updateStudentTime,
    updateStudentSchedule,
    addExtraSession,
    removeSession,
    toggleSessionComplete,
    togglePaymentStatus,
  } = useStudents();

  const filteredStudents = students.filter(student =>
    student.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectStudent = (studentId: string) => {
    setSelectedStudentId(studentId);
    setActiveTab('sessions');
    setSearchQuery('');
  };

  const clearSelection = () => {
    setSelectedStudentId(null);
    setSearchQuery('');
  };

  const displayedStudents = selectedStudentId
    ? filteredStudents.filter(s => s.id === selectedStudentId)
    : filteredStudents;

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
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center">
                <GraduationCap className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="font-heading font-bold text-lg leading-tight">Student Tracker</h1>
                <p className="text-xs text-muted-foreground">Sessions & Payments</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <SemesterSettings settings={settings} onUpdate={updateSettings} />
              <AddStudentDialog
                onAdd={addStudent}
                defaultStart={settings.defaultSemesterStart}
                defaultEnd={settings.defaultSemesterEnd}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-4 space-y-4">
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
            payments={payments}
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
          />
        )}

        {/* Search & Filter */}
        {students.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search students..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            {(selectedStudentId || searchQuery) && (
              <Button variant="ghost" size="sm" onClick={clearSelection} className="gap-1">
                <X className="h-4 w-4" />
                Clear
              </Button>
            )}
          </div>
        )}

        {/* Selected student indicator */}
        {selectedStudentId && (
          <div className="bg-primary/10 border border-primary/20 rounded-lg px-4 py-2 flex items-center justify-between">
            <span className="text-sm">
              Viewing: <strong>{students.find(s => s.id === selectedStudentId)?.name}</strong>
            </span>
            <Button variant="ghost" size="sm" onClick={clearSelection}>
              View all students
            </Button>
          </div>
        )}

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full grid grid-cols-2 mb-4">
            <TabsTrigger value="sessions" className="gap-2">
              <BookOpen className="h-4 w-4" />
              Sessions
            </TabsTrigger>
            <TabsTrigger value="payments" className="gap-2">
              <CreditCard className="h-4 w-4" />
              Payments
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sessions" className="mt-0">
            {students.length === 0 ? (
              <EmptyState />
            ) : displayedStudents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No students found matching "{searchQuery}"
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {displayedStudents.map(student => (
                  <StudentCard
                    key={student.id}
                    student={student}
                    selectedMonth={selectedMonth}
                    selectedYear={selectedYear}
                    onRemove={() => removeStudent(student.id)}
                    onUpdateName={(name) => updateStudentName(student.id, name)}
                    onUpdateTime={(time) => updateStudentTime(student.id, time)}
                    onUpdateSchedule={(days, start, end) => updateStudentSchedule(student.id, days, start, end)}
                    onAddSession={(date) => addExtraSession(student.id, date)}
                    onRemoveSession={(sessionId) => removeSession(student.id, sessionId)}
                    onToggleSession={(sessionId) => toggleSessionComplete(student.id, sessionId)}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="payments" className="mt-0">
            <PaymentsDashboard
              students={selectedStudentId ? students.filter(s => s.id === selectedStudentId) : filteredStudents}
              payments={payments}
              selectedMonth={selectedMonth}
              selectedYear={selectedYear}
              onTogglePayment={togglePaymentStatus}
              onSelectStudent={handleSelectStudent}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Index;
