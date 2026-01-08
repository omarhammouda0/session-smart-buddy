import { useState, useRef } from 'react';
import { FileText, Mic, Paperclip, Trash2, Edit2, Download, Play, Pause, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { SessionNote, NOTE_CATEGORY_LABELS, NOTE_CATEGORY_COLORS } from '@/types/notes';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';

interface NoteCardProps {
  note: SessionNote;
  onDelete: (noteId: string) => void;
  onEdit?: (note: SessionNote) => void;
}

export function NoteCard({ note, onDelete, onEdit }: NoteCardProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const timeAgo = formatDistanceToNow(new Date(note.created_at), { addSuffix: true, locale: ar });
  const colors = NOTE_CATEGORY_COLORS[note.category];

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

  const handleAudioEnded = () => {
    setIsPlaying(false);
  };

  // Text note
  if (note.type === 'text') {
    return (
      <div className={cn("border rounded-lg p-3 space-y-2", colors.border, colors.bg)}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className={cn("h-4 w-4 shrink-0", colors.text)} />
            {note.title && (
              <span className="font-medium truncate">{note.title}</span>
            )}
          </div>
          <Badge variant="outline" className={cn("shrink-0 text-[10px]", colors.text, colors.border)}>
            {NOTE_CATEGORY_LABELS[note.category]}
            {note.category === 'achievement' && ' ⭐'}
          </Badge>
        </div>

        {note.content && (
          <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-4">
            {note.content}
          </p>
        )}

        <div className="flex items-center justify-between pt-1">
          <span className="text-[10px] text-muted-foreground">{timeAgo}</span>
          <div className="flex items-center gap-1">
            {onEdit && (
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onEdit(note)}>
                <Edit2 className="h-3 w-3" />
              </Button>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive">
                  <Trash2 className="h-3 w-3" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent dir="rtl">
                <AlertDialogHeader>
                  <AlertDialogTitle>حذف الملاحظة؟</AlertDialogTitle>
                  <AlertDialogDescription>
                    لا يمكن التراجع عن هذا الإجراء.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex-row-reverse gap-2">
                  <AlertDialogCancel>إلغاء</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onDelete(note.id)} className="bg-destructive text-destructive-foreground">
                    حذف
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>
    );
  }

  // Voice note
  if (note.type === 'voice') {
    return (
      <div className="border rounded-lg p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Mic className="h-4 w-4 text-primary shrink-0" />
            <span className="font-medium truncate">
              {note.title || 'تسجيل صوتي'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={togglePlay}
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <div className="flex-1 bg-muted rounded-full h-2">
            <div className="bg-primary h-full rounded-full w-0" />
          </div>
          <span className="text-xs text-muted-foreground shrink-0">
            {note.duration ? formatDuration(note.duration) : '0:00'}
          </span>
        </div>

        {note.file_url && (
          <audio
            ref={audioRef}
            src={note.file_url}
            onEnded={handleAudioEnded}
            className="hidden"
          />
        )}

        <div className="flex items-center justify-between pt-1">
          <span className="text-[10px] text-muted-foreground">
            {timeAgo} • {formatFileSize(note.file_size)}
          </span>
          <div className="flex items-center gap-1">
            {note.file_url && (
              <Button variant="ghost" size="icon" className="h-6 w-6" asChild>
                <a href={note.file_url} download>
                  <Download className="h-3 w-3" />
                </a>
              </Button>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive">
                  <Trash2 className="h-3 w-3" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent dir="rtl">
                <AlertDialogHeader>
                  <AlertDialogTitle>حذف التسجيل الصوتي؟</AlertDialogTitle>
                  <AlertDialogDescription>
                    لا يمكن التراجع عن هذا الإجراء.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex-row-reverse gap-2">
                  <AlertDialogCancel>إلغاء</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onDelete(note.id)} className="bg-destructive text-destructive-foreground">
                    حذف
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>
    );
  }

  // File attachment
  return (
    <div className="border rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded bg-muted flex items-center justify-center shrink-0">
          <Paperclip className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{note.file_name || 'ملف مرفق'}</p>
          <p className="text-xs text-muted-foreground">
            {formatFileSize(note.file_size)} • {note.file_type || 'ملف'}
          </p>
        </div>
      </div>

      {note.title && (
        <p className="text-sm text-muted-foreground">{note.title}</p>
      )}

      <div className="flex items-center justify-between pt-1">
        <span className="text-[10px] text-muted-foreground">{timeAgo}</span>
        <div className="flex items-center gap-1">
          {note.file_url && (
            <>
              <Button variant="ghost" size="icon" className="h-6 w-6" asChild>
                <a href={note.file_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3 w-3" />
                </a>
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6" asChild>
                <a href={note.file_url} download>
                  <Download className="h-3 w-3" />
                </a>
              </Button>
            </>
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive">
                <Trash2 className="h-3 w-3" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent dir="rtl">
              <AlertDialogHeader>
                <AlertDialogTitle>حذف الملف؟</AlertDialogTitle>
                <AlertDialogDescription>
                  لا يمكن التراجع عن هذا الإجراء.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="flex-row-reverse gap-2">
                <AlertDialogCancel>إلغاء</AlertDialogCancel>
                <AlertDialogAction onClick={() => onDelete(note.id)} className="bg-destructive text-destructive-foreground">
                  حذف
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}
