import { useState, useRef } from 'react';
import { BookOpen, Calendar, Save, Loader2, Mic, Paperclip, AlertCircle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { HomeworkPriority, HOMEWORK_PRIORITY_LABELS, HOMEWORK_PRIORITY_COLORS } from '@/types/notes';
import { formatShortDateAr } from '@/lib/arabicConstants';
import { format, addDays, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { VoiceRecorder } from './VoiceRecorder';

interface HomeworkEditorProps {
  onSave: (params: {
    description: string;
    dueDate: string;
    priority: HomeworkPriority;
    voiceBlob?: Blob;
    voiceDuration?: number;
    files?: File[];
  }) => Promise<boolean>;
  onCancel: () => void;
  defaultDueDate?: string;
}

const MAX_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function HomeworkEditor({ onSave, onCancel, defaultDueDate }: HomeworkEditorProps) {
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState<Date | undefined>(
    defaultDueDate ? parseISO(defaultDueDate) : addDays(new Date(), 7)
  );
  const [priority, setPriority] = useState<HomeworkPriority>('normal');
  const [isSaving, setIsSaving] = useState(false);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [voiceData, setVoiceData] = useState<{ blob: Blob; duration: number } | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    setFileError(null);

    if (files.length + selectedFiles.length > MAX_FILES) {
      setFileError(`الحد الأقصى ${MAX_FILES} ملفات`);
      return;
    }

    const validFiles = selectedFiles.filter(file => {
      if (file.size > MAX_FILE_SIZE) {
        setFileError(`${file.name} كبير جداً (الحد الأقصى 10 MB)`);
        return false;
      }
      return true;
    });

    setFiles(prev => [...prev, ...validFiles]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleVoiceSave = async (blob: Blob, duration: number) => {
    setVoiceData({ blob, duration });
    setShowVoiceRecorder(false);
    return true;
  };

  const handleSave = async () => {
    if (!description.trim() || !dueDate) return;

    setIsSaving(true);
    const success = await onSave({
      description: description.trim(),
      dueDate: format(dueDate, 'yyyy-MM-dd'),
      priority,
      voiceBlob: voiceData?.blob,
      voiceDuration: voiceData?.duration,
      files: files.length > 0 ? files : undefined,
    });
    setIsSaving(false);

    if (success) {
      onCancel();
    }
  };

  if (showVoiceRecorder) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between px-4 pt-4">
          <p className="text-sm font-medium">تسجيل تعليمات صوتية</p>
          <Button variant="ghost" size="sm" onClick={() => setShowVoiceRecorder(false)}>
            رجوع
          </Button>
        </div>
        <VoiceRecorder
          onSave={handleVoiceSave}
          onCancel={() => setShowVoiceRecorder(false)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <BookOpen className="h-4 w-4" />
          إضافة واجب منزلي
        </div>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          رجوع
        </Button>
      </div>

      <div className="space-y-2">
        <Label htmlFor="hw-description">الوصف</Label>
        <Textarea
          id="hw-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="حل التمارين 1-10 من الفصل 3..."
          className="text-right min-h-[80px]"
          maxLength={1000}
        />
      </div>

      <div className="space-y-2">
        <Label>تاريخ التسليم</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full justify-start gap-2">
              <Calendar className="h-4 w-4" />
              {dueDate ? formatShortDateAr(format(dueDate, 'yyyy-MM-dd')) : 'اختر التاريخ'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <CalendarPicker
              mode="single"
              selected={dueDate}
              onSelect={setDueDate}
              disabled={(date) => date < new Date()}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="space-y-2">
        <Label>الأولوية</Label>
        <RadioGroup
          value={priority}
          onValueChange={(v) => setPriority(v as HomeworkPriority)}
          className="flex gap-2"
        >
          {(Object.keys(HOMEWORK_PRIORITY_LABELS) as HomeworkPriority[]).map((p) => {
            const colors = HOMEWORK_PRIORITY_COLORS[p];
            return (
              <div key={p} className="flex items-center">
                <RadioGroupItem value={p} id={`priority-${p}`} className="peer sr-only" />
                <Label
                  htmlFor={`priority-${p}`}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs cursor-pointer border transition-all",
                    priority === p
                      ? `${colors.bg} ${colors.text} ${colors.border} ring-2 ring-offset-2 ring-offset-background ring-primary/30`
                      : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
                  )}
                >
                  {HOMEWORK_PRIORITY_LABELS[p]}
                </Label>
              </div>
            );
          })}
        </RadioGroup>
      </div>

      {/* Voice instruction */}
      <div className="space-y-2">
        <Label>تعليمات صوتية (اختياري)</Label>
        {voiceData ? (
          <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
            <Mic className="h-4 w-4 text-primary" />
            <span className="text-sm flex-1">
              تسجيل صوتي ({Math.floor(voiceData.duration / 60)}:{(voiceData.duration % 60).toString().padStart(2, '0')})
            </span>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setVoiceData(null)}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-1"
            onClick={() => setShowVoiceRecorder(true)}
          >
            <Mic className="h-4 w-4" />
            تسجيل التعليمات
          </Button>
        )}
      </div>

      {/* File attachments */}
      <div className="space-y-2">
        <Label>ملفات مرفقة (اختياري)</Label>
        {fileError && (
          <div className="text-destructive text-xs flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            {fileError}
          </div>
        )}
        {files.length > 0 && (
          <div className="space-y-1">
            {files.map((file, idx) => (
              <div key={idx} className="flex items-center gap-2 p-2 bg-muted rounded-lg text-sm">
                <Paperclip className="h-4 w-4" />
                <span className="truncate flex-1">{file.name}</span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {(file.size / 1024).toFixed(0)} KB
                </span>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeFile(idx)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
        {files.length < MAX_FILES && (
          <>
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-1"
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip className="h-4 w-4" />
              إرفاق ملف
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileSelect}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
            />
          </>
        )}
      </div>

      <div className="flex justify-between gap-2 pt-2">
        <Button variant="outline" size="sm" onClick={onCancel}>
          إلغاء
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!description.trim() || !dueDate || isSaving}
          className="gap-1"
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              جاري الحفظ...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              حفظ
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
