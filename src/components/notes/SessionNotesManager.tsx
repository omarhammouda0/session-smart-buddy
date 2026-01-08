import { useState } from 'react';
import { FileText, Mic, Paperclip, BookOpen, Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Session } from '@/types/student';
import { useSessionNotes } from '@/hooks/useSessionNotes';
import { formatShortDateAr } from '@/lib/arabicConstants';
import { TextNoteEditor } from './TextNoteEditor';
import { VoiceRecorder } from './VoiceRecorder';
import { FileUploader } from './FileUploader';
import { HomeworkEditor } from './HomeworkEditor';
import { NoteCard } from './NoteCard';
import { HomeworkCard } from './HomeworkCard';

interface SessionNotesManagerProps {
  session: Session;
  studentId: string;
  studentName: string;
  trigger?: React.ReactNode;
}

type AddMode = 'none' | 'text' | 'voice' | 'file' | 'homework';

export function SessionNotesManager({ session, studentId, studentName, trigger }: SessionNotesManagerProps) {
  const [open, setOpen] = useState(false);
  const [addMode, setAddMode] = useState<AddMode>('none');
  const [activeTab, setActiveTab] = useState<'notes' | 'homework'>('notes');

  const {
    notes,
    homework,
    isLoading,
    addTextNote,
    addVoiceNote,
    addFileNote,
    deleteNote,
    addHomework,
    updateHomeworkStatus,
    deleteHomework,
  } = useSessionNotes(studentId, session.id);

  const handleAddTextNote = async (params: { title?: string; content: string; category: any }) => {
    return addTextNote({
      studentId,
      sessionId: session.id,
      sessionDate: session.date,
      ...params,
    });
  };

  const handleAddVoiceNote = async (blob: Blob, duration: number, title?: string) => {
    return addVoiceNote({
      studentId,
      sessionId: session.id,
      sessionDate: session.date,
      audioBlob: blob,
      duration,
      title,
    });
  };

  const handleAddFileNote = async (file: File, description?: string) => {
    return addFileNote({
      studentId,
      sessionId: session.id,
      sessionDate: session.date,
      file,
      description,
    });
  };

  const handleAddHomework = async (params: any) => {
    return addHomework({
      studentId,
      sessionId: session.id,
      sessionDate: session.date,
      ...params,
    });
  };

  const hasContent = notes.length > 0 || homework.length > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button
            variant={hasContent ? "secondary" : "ghost"}
            size="sm"
            className="h-7 px-2 text-xs gap-1"
          >
            <FileText className="h-3 w-3" />
            {hasContent ? `${notes.length + homework.length}` : 'ملاحظات'}
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
            {addMode === 'homework' && (
              <HomeworkEditor
                onSave={handleAddHomework}
                onCancel={() => setAddMode('none')}
              />
            )}
          </div>
        ) : (
          <>
            {/* Add buttons */}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className="gap-1" onClick={() => setAddMode('text')}>
                <FileText className="h-3.5 w-3.5" />
                ملاحظة نصية
              </Button>
              <Button variant="outline" size="sm" className="gap-1" onClick={() => setAddMode('voice')}>
                <Mic className="h-3.5 w-3.5" />
                تسجيل صوتي
              </Button>
              <Button variant="outline" size="sm" className="gap-1" onClick={() => setAddMode('file')}>
                <Paperclip className="h-3.5 w-3.5" />
                إرفاق ملف
              </Button>
              <Button variant="outline" size="sm" className="gap-1" onClick={() => setAddMode('homework')}>
                <BookOpen className="h-3.5 w-3.5" />
                واجب منزلي
              </Button>
            </div>

            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'notes' | 'homework')} className="flex-1 flex flex-col min-h-0">
              <TabsList className="w-full grid grid-cols-2">
                <TabsTrigger value="notes" className="gap-1">
                  <FileText className="h-3.5 w-3.5" />
                  الملاحظات
                  {notes.length > 0 && (
                    <Badge variant="secondary" className="mr-1 text-[10px] h-4 px-1">
                      {notes.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="homework" className="gap-1">
                  <BookOpen className="h-3.5 w-3.5" />
                  الواجبات
                  {homework.length > 0 && (
                    <Badge variant="secondary" className="mr-1 text-[10px] h-4 px-1">
                      {homework.length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="notes" className="flex-1 mt-3">
                <ScrollArea className="h-[300px]">
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
                        />
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>

              <TabsContent value="homework" className="flex-1 mt-3">
                <ScrollArea className="h-[300px]">
                  {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : homework.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">لا توجد واجبات بعد</p>
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
              </TabsContent>
            </Tabs>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
