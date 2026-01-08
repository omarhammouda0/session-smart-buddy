import { useState } from 'react';
import { FileText, Mic, Paperclip, Loader2 } from 'lucide-react';
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
import { TextNoteEditor } from './TextNoteEditor';
import { VoiceRecorder } from './VoiceRecorder';
import { FileUploader } from './FileUploader';
import { NoteCard } from './NoteCard';

interface SessionNotesDialogProps {
  session: Session;
  studentId: string;
  studentName: string;
  trigger?: React.ReactNode;
}

type NoteAddMode = 'none' | 'text' | 'voice' | 'file';

export function SessionNotesDialog({ session, studentId, studentName, trigger }: SessionNotesDialogProps) {
  const [open, setOpen] = useState(false);
  const [addMode, setAddMode] = useState<NoteAddMode>('none');

  const {
    notes,
    isLoading,
    addTextNote,
    addVoiceNote,
    addFileNote,
    deleteNote,
    updateNoteReportInclusion,
  } = useSessionNotes(studentId, session.id);

  const handleAddTextNote = async (params: { title?: string; content: string; category: any }) => {
    const result = await addTextNote({
      studentId,
      sessionId: session.id,
      sessionDate: session.date,
      ...params,
    });
    if (result) setAddMode('none');
    return result;
  };

  const handleAddVoiceNote = async (blob: Blob, duration: number, title?: string) => {
    const result = await addVoiceNote({
      studentId,
      sessionId: session.id,
      sessionDate: session.date,
      audioBlob: blob,
      duration,
      title,
    });
    if (result) setAddMode('none');
    return result;
  };

  const handleAddFileNote = async (file: File, description?: string) => {
    const result = await addFileNote({
      studentId,
      sessionId: session.id,
      sessionDate: session.date,
      file,
      description,
    });
    if (result) setAddMode('none');
    return result;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button
            variant={notes.length > 0 ? "secondary" : "ghost"}
            size="sm"
            className="h-7 px-2 text-xs gap-1"
          >
            <FileText className="h-3 w-3" />
            ملاحظات
            {notes.length > 0 && (
              <Badge variant="secondary" className="mr-0.5 text-[10px] h-4 px-1 min-w-[16px]">
                {notes.length}
              </Badge>
            )}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col" dir="rtl">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <FileText className="h-5 w-5" />
            ملاحظات الجلسة
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {studentName} - {formatShortDateAr(session.date)}
          </p>
        </DialogHeader>

        {addMode !== 'none' ? (
          <div className="border rounded-lg bg-muted/30">
            {addMode === 'text' && (
              <TextNoteEditor
                onSave={handleAddTextNote}
                onCancel={() => setAddMode('none')}
              />
            )}
            {addMode === 'voice' && (
              <VoiceRecorder
                onSave={handleAddVoiceNote}
                onCancel={() => setAddMode('none')}
              />
            )}
            {addMode === 'file' && (
              <FileUploader
                onUpload={handleAddFileNote}
                onCancel={() => setAddMode('none')}
              />
            )}
          </div>
        ) : (
          <>
            {/* Add note buttons */}
            <div className="flex flex-wrap gap-2">
              <span className="text-xs text-muted-foreground w-full">إضافة ملاحظة:</span>
              <Button variant="outline" size="sm" className="gap-1" onClick={() => setAddMode('text')}>
                <FileText className="h-3.5 w-3.5" />
                نصية
              </Button>
              <Button variant="outline" size="sm" className="gap-1" onClick={() => setAddMode('voice')}>
                <Mic className="h-3.5 w-3.5" />
                صوتية
              </Button>
              <Button variant="outline" size="sm" className="gap-1" onClick={() => setAddMode('file')}>
                <Paperclip className="h-3.5 w-3.5" />
                ملف
              </Button>
            </div>

            {/* Notes list */}
            <ScrollArea className="h-[350px] flex-1">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : notes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">لا توجد ملاحظات بعد</p>
                  <p className="text-xs mt-1">أضف ملاحظة نصية أو صوتية أو ملف</p>
                </div>
              ) : (
                <div className="space-y-2 pr-2">
                  {notes.map((note) => (
                    <NoteCard
                      key={note.id}
                      note={note}
                      onDelete={deleteNote}
                      onToggleReportInclusion={updateNoteReportInclusion}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
