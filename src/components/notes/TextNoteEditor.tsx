import { useState } from 'react';
import { FileText, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { NoteCategory, NOTE_CATEGORY_LABELS, NOTE_CATEGORY_COLORS } from '@/types/notes';
import { cn } from '@/lib/utils';

interface TextNoteEditorProps {
  onSave: (params: { title?: string; content: string; category: NoteCategory }) => Promise<boolean>;
  onCancel: () => void;
  initialTitle?: string;
  initialContent?: string;
  initialCategory?: NoteCategory;
}

const MAX_CONTENT_LENGTH = 2000;

export function TextNoteEditor({
  onSave,
  onCancel,
  initialTitle = '',
  initialContent = '',
  initialCategory = 'general',
}: TextNoteEditorProps) {
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [category, setCategory] = useState<NoteCategory>(initialCategory);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!content.trim()) return;
    setIsSaving(true);
    const success = await onSave({
      title: title.trim() || undefined,
      content: content.trim(),
      category,
    });
    setIsSaving(false);
    if (success) {
      onCancel();
    }
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <FileText className="h-4 w-4" />
        ملاحظة نصية جديدة
      </div>

      <div className="space-y-2">
        <Label htmlFor="note-title">العنوان (اختياري)</Label>
        <Input
          id="note-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="عنوان مختصر..."
          className="text-right"
          maxLength={100}
        />
      </div>

      <div className="space-y-2">
        <div className="flex justify-between">
          <Label htmlFor="note-content">الملاحظة</Label>
          <span className="text-xs text-muted-foreground">
            {content.length}/{MAX_CONTENT_LENGTH}
          </span>
        </div>
        <Textarea
          id="note-content"
          value={content}
          onChange={(e) => setContent(e.target.value.slice(0, MAX_CONTENT_LENGTH))}
          placeholder="اكتب ملاحظاتك هنا..."
          className="text-right min-h-[120px]"
          maxLength={MAX_CONTENT_LENGTH}
        />
      </div>

      <div className="space-y-2">
        <Label>التصنيف</Label>
        <RadioGroup
          value={category}
          onValueChange={(v) => setCategory(v as NoteCategory)}
          className="flex flex-wrap gap-2"
        >
          {(Object.keys(NOTE_CATEGORY_LABELS) as NoteCategory[]).map((cat) => {
            const colors = NOTE_CATEGORY_COLORS[cat];
            return (
              <div key={cat} className="flex items-center">
                <RadioGroupItem value={cat} id={`cat-${cat}`} className="peer sr-only" />
                <Label
                  htmlFor={`cat-${cat}`}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs cursor-pointer border transition-all",
                    category === cat
                      ? `${colors.bg} ${colors.text} ${colors.border} ring-2 ring-offset-2 ring-offset-background ring-primary/30`
                      : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
                  )}
                >
                  {NOTE_CATEGORY_LABELS[cat]}
                  {cat === 'achievement' && ' ⭐'}
                </Label>
              </div>
            );
          })}
        </RadioGroup>
      </div>

      <div className="flex justify-between gap-2 pt-2">
        <Button variant="outline" size="sm" onClick={onCancel}>
          إلغاء
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!content.trim() || isSaving}
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
