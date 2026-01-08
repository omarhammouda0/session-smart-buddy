import { useState, useRef } from 'react';
import { BookOpen, Calendar, Check, X, Play, Pause, Download, Paperclip, Trash2, AlertTriangle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Homework, HomeworkStatusType, HOMEWORK_PRIORITY_LABELS, HOMEWORK_PRIORITY_COLORS, HOMEWORK_STATUS_LABELS } from '@/types/notes';
import { formatShortDateAr } from '@/lib/arabicConstants';
import { cn } from '@/lib/utils';
import { differenceInDays, parseISO, isAfter, startOfToday } from 'date-fns';

interface HomeworkCardProps {
  homework: Homework;
  onUpdateStatus: (status: HomeworkStatusType) => void;
  onDelete: () => void;
}

export function HomeworkCard({ homework, onUpdateStatus, onDelete }: HomeworkCardProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const today = startOfToday();
  const dueDate = parseISO(homework.due_date);
  const daysUntilDue = differenceInDays(dueDate, today);
  const isOverdue = homework.status === 'pending' && daysUntilDue < 0;
  const isDueSoon = homework.status === 'pending' && daysUntilDue >= 0 && daysUntilDue <= 2;

  const priorityColors = HOMEWORK_PRIORITY_COLORS[homework.priority];

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getDaysText = () => {
    if (daysUntilDue === 0) return 'اليوم';
    if (daysUntilDue === 1) return 'غداً';
    if (daysUntilDue < 0) return `متأخر ${Math.abs(daysUntilDue)} يوم`;
    return `${daysUntilDue} أيام`;
  };

  const handleStatusToggle = () => {
    if (homework.status === 'completed') {
      onUpdateStatus('pending');
    } else {
      onUpdateStatus('completed');
    }
  };

  return (
    <div className={cn(
      "border rounded-lg p-3 space-y-2",
      homework.status === 'completed' && "bg-success/5 border-success/30",
      homework.status === 'not_completed' && "bg-destructive/5 border-destructive/30",
      homework.status === 'pending' && isOverdue && "bg-destructive/5 border-destructive/30",
      homework.status === 'pending' && isDueSoon && !isOverdue && "bg-warning/5 border-warning/30",
      homework.status === 'pending' && !isOverdue && !isDueSoon && "bg-card border-border"
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Checkbox
            checked={homework.status === 'completed'}
            onCheckedChange={handleStatusToggle}
            className={cn(
              homework.status === 'completed' && "border-success data-[state=checked]:bg-success"
            )}
          />
          <BookOpen className={cn(
            "h-4 w-4 shrink-0",
            homework.status === 'completed' ? "text-success" : "text-primary"
          )} />
        </div>
        <div className="flex items-center gap-1">
          {homework.priority !== 'normal' && (
            <Badge variant="outline" className={cn("text-[10px]", priorityColors.text, priorityColors.border)}>
              {HOMEWORK_PRIORITY_LABELS[homework.priority]}
            </Badge>
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive">
                <Trash2 className="h-3 w-3" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent dir="rtl">
              <AlertDialogHeader>
                <AlertDialogTitle>حذف الواجب؟</AlertDialogTitle>
                <AlertDialogDescription>
                  لا يمكن التراجع عن هذا الإجراء.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="flex-row-reverse gap-2">
                <AlertDialogCancel>إلغاء</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground">
                  حذف
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <p className={cn(
        "text-sm",
        homework.status === 'completed' && "line-through text-muted-foreground"
      )}>
        {homework.description}
      </p>

      {/* Due date */}
      <div className={cn(
        "flex items-center gap-1 text-xs",
        homework.status === 'completed' && "text-success",
        homework.status === 'not_completed' && "text-destructive",
        homework.status === 'pending' && isOverdue && "text-destructive",
        homework.status === 'pending' && isDueSoon && !isOverdue && "text-warning",
        homework.status === 'pending' && !isOverdue && !isDueSoon && "text-muted-foreground"
      )}>
        {homework.status === 'completed' ? (
          <>
            <Check className="h-3 w-3" />
            تم الإكمال
          </>
        ) : homework.status === 'not_completed' ? (
          <>
            <X className="h-3 w-3" />
            لم يكتمل
          </>
        ) : isOverdue ? (
          <>
            <AlertTriangle className="h-3 w-3" />
            متأخر {Math.abs(daysUntilDue)} يوم
          </>
        ) : (
          <>
            <Calendar className="h-3 w-3" />
            التسليم: {formatShortDateAr(homework.due_date)} ({getDaysText()})
          </>
        )}
      </div>

      {/* Voice instruction */}
      {homework.voice_instruction_url && (
        <div className="flex items-center gap-2 pt-1">
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={togglePlay}
          >
            {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
          </Button>
          <span className="text-xs text-muted-foreground">
            تعليمات صوتية ({formatDuration(homework.voice_instruction_duration)})
          </span>
          <audio
            ref={audioRef}
            src={homework.voice_instruction_url}
            onEnded={() => setIsPlaying(false)}
            className="hidden"
          />
        </div>
      )}

      {/* Attachments */}
      {homework.attachments && homework.attachments.length > 0 && (
        <div className="space-y-1 pt-1">
          <p className="text-xs text-muted-foreground">المرفقات:</p>
          {homework.attachments.map((att) => (
            <div key={att.id} className="flex items-center gap-2 text-xs">
              <Paperclip className="h-3 w-3" />
              <a
                href={att.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate hover:underline text-primary"
              >
                {att.file_name}
              </a>
              <span className="text-muted-foreground shrink-0">
                ({(att.file_size || 0) / 1024 > 1024
                  ? `${((att.file_size || 0) / 1024 / 1024).toFixed(1)} MB`
                  : `${((att.file_size || 0) / 1024).toFixed(0)} KB`})
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Mark as not completed for overdue pending homework */}
      {homework.status === 'pending' && isOverdue && (
        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-success border-success/30 hover:bg-success/10"
            onClick={() => onUpdateStatus('completed')}
          >
            <Check className="h-3 w-3 ml-1" />
            تم الإكمال
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-destructive border-destructive/30 hover:bg-destructive/10"
            onClick={() => onUpdateStatus('not_completed')}
          >
            <X className="h-3 w-3 ml-1" />
            لم يكتمل
          </Button>
        </div>
      )}
    </div>
  );
}
