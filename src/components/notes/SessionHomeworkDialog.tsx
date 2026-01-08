import { useState } from 'react';
import { BookOpen, Loader2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Session } from '@/types/student';
import { useSessionNotes } from '@/hooks/useSessionNotes';
import { formatShortDateAr } from '@/lib/arabicConstants';
import { HomeworkEditor } from './HomeworkEditor';
import { HomeworkCard } from './HomeworkCard';

interface SessionHomeworkDialogProps {
  session: Session;
  studentId: string;
  studentName: string;
  trigger?: React.ReactNode;
}

export function SessionHomeworkDialog({ session, studentId, studentName, trigger }: SessionHomeworkDialogProps) {
  const [open, setOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  const {
    homework,
    isLoading,
    addHomework,
    updateHomeworkStatus,
    deleteHomework,
  } = useSessionNotes(studentId, session.id);

  const handleAddHomework = async (params: any) => {
    const result = await addHomework({
      studentId,
      sessionId: session.id,
      sessionDate: session.date,
      ...params,
    });
    if (result) setIsAdding(false);
    return result;
  };

  // Check homework status for badge
  const hasHomework = homework.length > 0;
  const pendingCount = homework.filter(hw => hw.status === 'pending').length;
  const completedCount = homework.filter(hw => hw.status === 'completed').length;
  const allCompleted = hasHomework && pendingCount === 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button
            variant={hasHomework ? "secondary" : "ghost"}
            size="sm"
            className="h-7 px-2 text-xs gap-1"
          >
            <BookOpen className="h-3 w-3" />
            واجب
            {hasHomework && (
              allCompleted ? (
                <CheckCircle className="h-3 w-3 text-success mr-0.5" />
              ) : (
                <Badge variant="secondary" className="mr-0.5 text-[10px] h-4 px-1 min-w-[16px]">
                  {pendingCount}
                </Badge>
              )
            )}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col" dir="rtl">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            الواجب المنزلي
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {studentName} - {formatShortDateAr(session.date)}
          </p>
        </DialogHeader>

        {isAdding ? (
          <div className="border rounded-lg bg-muted/30">
            <HomeworkEditor
              onSave={handleAddHomework}
              onCancel={() => setIsAdding(false)}
            />
          </div>
        ) : (
          <>
            {/* Add homework button */}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className="gap-1" onClick={() => setIsAdding(true)}>
                <BookOpen className="h-3.5 w-3.5" />
                إضافة واجب منزلي
              </Button>
            </div>

            {/* Homework list */}
            <ScrollArea className="h-[350px] flex-1">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : homework.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">لا يوجد واجب لهذه الجلسة</p>
                  <p className="text-xs mt-1">أضف واجب منزلي جديد</p>
                </div>
              ) : (
                <div className="space-y-2 pr-2">
                  {homework.map((hw) => (
                    <HomeworkCard
                      key={hw.id}
                      homework={hw}
                      onUpdateStatus={(status) => updateHomeworkStatus(hw.id, status)}
                      onDelete={() => deleteHomework(hw.id)}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>

            {/* Summary stats */}
            {hasHomework && (
              <div className="flex items-center justify-center gap-4 pt-2 border-t text-xs text-muted-foreground">
                <span>الإجمالي: {homework.length}</span>
                <span className="text-success">مكتمل: {completedCount}</span>
                <span className="text-warning">معلق: {pendingCount}</span>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
