import { useState, useEffect } from 'react';
import { FileText, BookOpen, ClipboardCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Session, HomeworkStatus } from '@/types/student';
import { formatShortDateAr } from '@/lib/arabicConstants';

interface SessionNotesDialogProps {
  session: Session;
  studentName: string;
  onSave: (details: {
    topic?: string;
    notes?: string;
    homework?: string;
    homeworkStatus?: HomeworkStatus;
  }) => void;
  trigger?: React.ReactNode;
}

const HOMEWORK_STATUS_OPTIONS: { value: HomeworkStatus; label: string }[] = [
  { value: 'none', label: 'لا يوجد واجب' },
  { value: 'assigned', label: 'تم التكليف' },
  { value: 'completed', label: 'تم الإكمال ✓' },
  { value: 'incomplete', label: 'لم يكتمل ✗' },
];

export const SessionNotesDialog = ({
  session,
  studentName,
  onSave,
  trigger,
}: SessionNotesDialogProps) => {
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState(session.topic || '');
  const [notes, setNotes] = useState(session.notes || '');
  const [homework, setHomework] = useState(session.homework || '');
  const [homeworkStatus, setHomeworkStatus] = useState<HomeworkStatus>(session.homeworkStatus || 'none');

  useEffect(() => {
    if (open) {
      setTopic(session.topic || '');
      setNotes(session.notes || '');
      setHomework(session.homework || '');
      setHomeworkStatus(session.homeworkStatus || 'none');
    }
  }, [open, session]);

  const handleSave = () => {
    onSave({
      topic: topic.trim() || undefined,
      notes: notes.trim() || undefined,
      homework: homework.trim() || undefined,
      homeworkStatus,
    });
    setOpen(false);
  };

  const hasNotes = session.topic || session.notes || session.homework;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button 
            variant={hasNotes ? "secondary" : "ghost"} 
            size="sm" 
            className="h-7 px-2 text-xs gap-1"
          >
            <FileText className="h-3 w-3" />
            {hasNotes ? 'ملاحظات' : 'إضافة ملاحظات'}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <FileText className="h-5 w-5" />
            ملاحظات الحصة
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {studentName} - {formatShortDateAr(session.date)}
          </p>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Topic */}
          <div className="space-y-2">
            <Label htmlFor="topic" className="flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5" />
              الموضوع
            </Label>
            <Input
              id="topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="مثال: الجبر - المعادلات التربيعية"
              className="text-right"
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes" className="flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              ملاحظات المعلم
            </Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="ملاحظات عن أداء الطالب، التقدم، النقاط التي تحتاج تحسين..."
              className="text-right min-h-[80px]"
            />
          </div>

          {/* Homework */}
          <div className="space-y-2">
            <Label htmlFor="homework" className="flex items-center gap-1.5">
              <ClipboardCheck className="h-3.5 w-3.5" />
              الواجب المنزلي
            </Label>
            <Input
              id="homework"
              value={homework}
              onChange={(e) => setHomework(e.target.value)}
              placeholder="مثال: تمارين 1-10 من الفصل 3"
              className="text-right"
            />
          </div>

          {/* Homework Status */}
          <div className="space-y-2">
            <Label htmlFor="homeworkStatus">حالة الواجب</Label>
            <Select value={homeworkStatus} onValueChange={(v) => setHomeworkStatus(v as HomeworkStatus)}>
              <SelectTrigger id="homeworkStatus">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HOMEWORK_STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row-reverse gap-2">
          <Button onClick={handleSave} className="w-full sm:w-auto">
            حفظ
          </Button>
          <Button variant="outline" onClick={() => setOpen(false)} className="w-full sm:w-auto">
            إلغاء
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
