import { useState } from 'react';
import { Trash2, Edit2, Check, X, Minus, Plus, CreditCard, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SessionItem } from './SessionItem';
import { Student, MonthlyRecord } from '@/types/student';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface StudentCardProps {
  student: Student;
  monthlyRecord: MonthlyRecord;
  month: number;
  year: number;
  onRemove: () => void;
  onUpdateName: (name: string) => void;
  onUpdateSessionsCount: (count: number) => void;
  onToggleSession: (sessionId: string) => void;
  onUpdateSessionDate: (sessionId: string, date: string | null) => void;
  onTogglePayment: () => void;
}

export const StudentCard = ({
  student,
  monthlyRecord,
  month,
  year,
  onRemove,
  onUpdateName,
  onUpdateSessionsCount,
  onToggleSession,
  onUpdateSessionDate,
  onTogglePayment,
}: StudentCardProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(student.name);

  const completedCount = monthlyRecord.sessions.filter(s => s.completed).length;
  const totalSessions = monthlyRecord.sessions.length;
  const progress = totalSessions > 0 ? (completedCount / totalSessions) * 100 : 0;

  const handleSaveName = () => {
    if (editName.trim()) {
      onUpdateName(editName.trim());
      setIsEditing(false);
    }
  };

  const handleCancelEdit = () => {
    setEditName(student.name);
    setIsEditing(false);
  };

  return (
    <Card className="card-shadow hover:card-shadow-hover transition-all duration-300 animate-scale-in overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <div className="flex items-center gap-2">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="h-9"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveName();
                    if (e.key === 'Escape') handleCancelEdit();
                  }}
                />
                <Button size="icon" variant="ghost" onClick={handleSaveName} className="shrink-0 h-9 w-9 text-success">
                  <Check className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={handleCancelEdit} className="shrink-0 h-9 w-9 text-destructive">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h3 className="font-heading font-semibold text-xl truncate">{student.name}</h3>
                <Button size="icon" variant="ghost" onClick={() => setIsEditing(true)} className="shrink-0 h-8 w-8">
                  <Edit2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
          
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="icon" variant="ghost" className="shrink-0 h-8 w-8 text-muted-foreground hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove Student</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to remove {student.name}? This will delete all their session and payment records.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onRemove} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Remove
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {/* Progress Bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-muted-foreground">Sessions Completed</span>
            <span className="font-semibold">{completedCount}/{totalSessions}</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full gradient-primary transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <Tabs defaultValue="sessions" className="w-full">
          <TabsList className="w-full grid grid-cols-2 mb-4">
            <TabsTrigger value="sessions" className="gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Sessions
            </TabsTrigger>
            <TabsTrigger value="payment" className="gap-2">
              <CreditCard className="h-4 w-4" />
              Payment
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sessions" className="space-y-3">
            {/* Sessions Count Control */}
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg mb-4">
              <span className="text-sm font-medium">Sessions this month</span>
              <div className="flex items-center gap-2">
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8"
                  onClick={() => onUpdateSessionsCount(Math.max(1, totalSessions - 1))}
                  disabled={totalSessions <= 1}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="w-8 text-center font-semibold">{totalSessions}</span>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8"
                  onClick={() => onUpdateSessionsCount(Math.min(31, totalSessions + 1))}
                  disabled={totalSessions >= 31}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Sessions List */}
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
              {monthlyRecord.sessions.map((session, index) => (
                <SessionItem
                  key={session.id}
                  session={session}
                  index={index}
                  onToggleComplete={() => onToggleSession(session.id)}
                  onDateChange={(date) => onUpdateSessionDate(session.id, date)}
                />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="payment" className="pt-2">
            <div className="text-center space-y-4 py-6">
              <div className={cn(
                "w-20 h-20 rounded-full mx-auto flex items-center justify-center transition-all",
                monthlyRecord.isPaid 
                  ? "bg-success/20 text-success" 
                  : "bg-warning/20 text-warning"
              )}>
                <CreditCard className="h-10 w-10" />
              </div>
              <div>
                <p className="font-heading font-semibold text-lg">
                  {monthlyRecord.isPaid ? 'Payment Received' : 'Payment Pending'}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {new Date(year, month).toLocaleString('default', { month: 'long', year: 'numeric' })}
                </p>
              </div>
              <Button 
                onClick={onTogglePayment}
                variant={monthlyRecord.isPaid ? "outline" : "default"}
                className={cn(
                  "gap-2",
                  !monthlyRecord.isPaid && "gradient-accent"
                )}
              >
                {monthlyRecord.isPaid ? (
                  <>
                    <X className="h-4 w-4" />
                    Mark as Unpaid
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Mark as Paid
                  </>
                )}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
