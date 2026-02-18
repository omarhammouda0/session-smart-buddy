import { useState, useMemo } from 'react';
import { FileText, BookOpen, Search, Filter, Calendar, ChevronDown } from 'lucide-react';
import { format, parseISO, isAfter, isBefore } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useSessionNotes } from '@/hooks/useSessionNotes';
import { NoteCard } from '@/components/notes/NoteCard';
import { HomeworkCard } from '@/components/notes/HomeworkCard';
import { 
  NOTE_CATEGORY_LABELS, 
  HOMEWORK_STATUS_LABELS,
  NoteCategory,
  HomeworkStatusType 
} from '@/types/notes';
import { cn } from '@/lib/utils';

interface StudentNotesHistoryProps {
  studentId: string;
  studentName: string;
}

type NoteFilter = 'all' | 'text' | 'voice' | 'file';
type HomeworkFilter = 'all' | 'pending' | 'completed' | 'not_completed' | 'overdue';

export function StudentNotesHistory({ studentId, studentName }: StudentNotesHistoryProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'notes' | 'homework'>('notes');
  const [searchQuery, setSearchQuery] = useState('');
  const [noteFilter, setNoteFilter] = useState<NoteFilter>('all');
  const [noteCategory, setNoteCategory] = useState<NoteCategory | 'all'>('all');
  const [homeworkFilter, setHomeworkFilter] = useState<HomeworkFilter>('all');

  const { notes, homework, isLoading, updateHomeworkStatus, deleteNote, deleteHomework } = useSessionNotes(studentId);

  // Filter notes
  const filteredNotes = useMemo(() => {
    let result = notes;

    // Filter by type
    if (noteFilter !== 'all') {
      result = result.filter(note => note.type === noteFilter);
    }

    // Filter by category
    if (noteCategory !== 'all') {
      result = result.filter(note => note.category === noteCategory);
    }

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(note => 
        note.title?.toLowerCase().includes(query) ||
        note.content?.toLowerCase().includes(query) ||
        note.file_name?.toLowerCase().includes(query)
      );
    }

    return result;
  }, [notes, noteFilter, noteCategory, searchQuery]);

  // Filter homework
  const filteredHomework = useMemo(() => {
    let result = homework;
    const now = new Date();

    // Filter by status
    if (homeworkFilter === 'pending') {
      result = result.filter(hw => hw.status === 'pending');
    } else if (homeworkFilter === 'completed') {
      result = result.filter(hw => hw.status === 'completed');
    } else if (homeworkFilter === 'not_completed') {
      result = result.filter(hw => hw.status === 'not_completed');
    } else if (homeworkFilter === 'overdue') {
      result = result.filter(hw => 
        hw.status === 'pending' && isBefore(parseISO(hw.due_date), now)
      );
    }

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(hw => 
        hw.description.toLowerCase().includes(query)
      );
    }

    return result;
  }, [homework, homeworkFilter, searchQuery]);

  // Group notes by session date
  const groupedNotes = useMemo(() => {
    const groups: Record<string, typeof notes> = {};
    filteredNotes.forEach(note => {
      const date = note.session_date;
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(note);
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredNotes]);

  // Group homework by status
  const groupedHomework = useMemo(() => {
    const pending = filteredHomework.filter(hw => hw.status === 'pending');
    const completed = filteredHomework.filter(hw => hw.status === 'completed');
    const notCompleted = filteredHomework.filter(hw => hw.status === 'not_completed');
    
    // Sort pending by due date (urgent first)
    pending.sort((a, b) => a.due_date.localeCompare(b.due_date));
    
    return { pending, completed, notCompleted };
  }, [filteredHomework]);

  const formatSessionDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), 'EEEE d MMMM yyyy', { locale: ar });
    } catch {
      return dateStr;
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-primary">
          <FileText className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col" dir="rtl">
        <DialogHeader className="pb-2 border-b">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            سجل ملاحظات {studentName}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'notes' | 'homework')} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid grid-cols-2 mb-3 mobile-keep">
            <TabsTrigger value="notes" className="gap-1.5">
              <FileText className="h-4 w-4" />
              الملاحظات
              {notes.length > 0 && (
                <Badge variant="secondary" className="mr-1 h-5 px-1.5 text-xs">
                  {notes.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="homework" className="gap-1.5">
              <BookOpen className="h-4 w-4" />
              الواجبات
              {homework.length > 0 && (
                <Badge variant="secondary" className="mr-1 h-5 px-1.5 text-xs">
                  {homework.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Search and Filters */}
          <div className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="بحث..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-9"
              />
            </div>
            
            {activeTab === 'notes' ? (
              <>
                <Select value={noteFilter} onValueChange={(v) => setNoteFilter(v as NoteFilter)}>
                  <SelectTrigger className="w-28">
                    <SelectValue placeholder="النوع" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">الكل</SelectItem>
                    <SelectItem value="text">نصية</SelectItem>
                    <SelectItem value="voice">صوتية</SelectItem>
                    <SelectItem value="file">ملفات</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={noteCategory} onValueChange={(v) => setNoteCategory(v as NoteCategory | 'all')}>
                  <SelectTrigger className="w-28">
                    <SelectValue placeholder="التصنيف" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">الكل</SelectItem>
                    {Object.entries(NOTE_CATEGORY_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            ) : (
              <Select value={homeworkFilter} onValueChange={(v) => setHomeworkFilter(v as HomeworkFilter)}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="الحالة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  <SelectItem value="pending">قيد الانتظار</SelectItem>
                  <SelectItem value="completed">مكتمل</SelectItem>
                  <SelectItem value="not_completed">لم يكمل</SelectItem>
                  <SelectItem value="overdue">متأخر</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Notes Tab */}
          <TabsContent value="notes" className="flex-1 m-0 overflow-hidden">
            <ScrollArea className="h-[calc(85vh-220px)]">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-pulse text-muted-foreground">جاري التحميل...</div>
                </div>
              ) : groupedNotes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <FileText className="h-12 w-12 mb-3 opacity-20" />
                  <p>لا توجد ملاحظات</p>
                  {(noteFilter !== 'all' || noteCategory !== 'all' || searchQuery) && (
                    <Button 
                      variant="link" 
                      size="sm" 
                      onClick={() => {
                        setNoteFilter('all');
                        setNoteCategory('all');
                        setSearchQuery('');
                      }}
                    >
                      مسح الفلاتر
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-4 pl-2">
                  {groupedNotes.map(([date, dateNotes]) => (
                    <div key={date}>
                      <div className="flex items-center gap-2 mb-2 sticky top-0 bg-background py-1 z-10">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium text-muted-foreground">
                          {formatSessionDate(date)}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {dateNotes.length} ملاحظة
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        {dateNotes.map(note => (
                          <NoteCard
                            key={note.id}
                            note={note}
                            onDelete={() => deleteNote(note.id)}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          {/* Homework Tab */}
          <TabsContent value="homework" className="flex-1 m-0 overflow-hidden">
            <ScrollArea className="h-[calc(85vh-220px)]">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-pulse text-muted-foreground">جاري التحميل...</div>
                </div>
              ) : filteredHomework.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <BookOpen className="h-12 w-12 mb-3 opacity-20" />
                  <p>لا توجد واجبات</p>
                  {(homeworkFilter !== 'all' || searchQuery) && (
                    <Button 
                      variant="link" 
                      size="sm" 
                      onClick={() => {
                        setHomeworkFilter('all');
                        setSearchQuery('');
                      }}
                    >
                      مسح الفلاتر
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-4 pl-2">
                  {/* Pending */}
                  {groupedHomework.pending.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2 sticky top-0 bg-background py-1 z-10">
                        <span className="text-sm font-medium text-warning">قيد الانتظار</span>
                        <Badge variant="outline" className="text-xs border-warning/30 text-warning">
                          {groupedHomework.pending.length}
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        {groupedHomework.pending.map(hw => (
                          <HomeworkCard
                            key={hw.id}
                            homework={hw}
                            onUpdateStatus={(status) => updateHomeworkStatus(hw.id, status)}
                            onDelete={() => deleteHomework(hw.id)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Completed */}
                  {groupedHomework.completed.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2 sticky top-0 bg-background py-1 z-10">
                        <span className="text-sm font-medium text-success">مكتمل</span>
                        <Badge variant="outline" className="text-xs border-success/30 text-success">
                          {groupedHomework.completed.length}
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        {groupedHomework.completed.map(hw => (
                          <HomeworkCard
                            key={hw.id}
                            homework={hw}
                            onUpdateStatus={(status) => updateHomeworkStatus(hw.id, status)}
                            onDelete={() => deleteHomework(hw.id)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Not Completed */}
                  {groupedHomework.notCompleted.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2 sticky top-0 bg-background py-1 z-10">
                        <span className="text-sm font-medium text-destructive">لم يكمل</span>
                        <Badge variant="outline" className="text-xs border-destructive/30 text-destructive">
                          {groupedHomework.notCompleted.length}
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        {groupedHomework.notCompleted.map(hw => (
                          <HomeworkCard
                            key={hw.id}
                            homework={hw}
                            onUpdateStatus={(status) => updateHomeworkStatus(hw.id, status)}
                            onDelete={() => deleteHomework(hw.id)}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
