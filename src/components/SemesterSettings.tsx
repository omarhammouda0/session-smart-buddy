import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Settings, Clock } from 'lucide-react';
import { AppSettings, DURATION_OPTIONS, DEFAULT_DURATION } from '@/types/student';
import { format, addMonths, parseISO } from 'date-fns';
import { formatDurationAr } from '@/lib/arabicConstants';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface SemesterSettingsProps {
  settings: AppSettings;
  onUpdate: (settings: Partial<AppSettings>) => void;
}

export const SemesterSettings = ({ settings, onUpdate }: SemesterSettingsProps) => {
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState(settings.defaultSemesterStart);
  const [end, setEnd] = useState(settings.defaultSemesterEnd);
  const [duration, setDuration] = useState(settings.defaultSessionDuration || DEFAULT_DURATION);

  const handleSave = () => {
    onUpdate({
      defaultSemesterStart: start,
      defaultSemesterEnd: end,
      defaultSessionDuration: duration,
    });
    setOpen(false);
  };

  const handleMonthsChange = (months: number) => {
    const newEnd = format(addMonths(parseISO(start), months), 'yyyy-MM-dd');
    setEnd(newEnd);
    onUpdate({ defaultSemesterMonths: months });
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setStart(settings.defaultSemesterStart);
      setEnd(settings.defaultSemesterEnd);
      setDuration(settings.defaultSessionDuration || DEFAULT_DURATION);
    }
    setOpen(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" className="shrink-0">
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">إعدادات الفصل الدراسي</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 pt-4">
          <p className="text-sm text-muted-foreground">
            حدد الفترة الافتراضية للفصل الدراسي للطلاب الجدد. الطلاب الحاليون لن يتأثروا.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="start">تاريخ البداية</Label>
              <Input
                id="start"
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end">تاريخ النهاية</Label>
              <Input
                id="end"
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>مدة سريعة</Label>
            <div className="flex gap-2">
              {[3, 4, 6].map(m => (
                <Button
                  key={m}
                  type="button"
                  variant={settings.defaultSemesterMonths === m ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleMonthsChange(m)}
                >
                  {m} أشهر
                </Button>
              ))}
            </div>
          </div>

          {/* Default Session Duration */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              المدة الافتراضية للجلسة
            </Label>
            <Select value={String(duration)} onValueChange={(v) => setDuration(parseInt(v, 10))}>
              <SelectTrigger>
                <SelectValue placeholder="اختر المدة" />
              </SelectTrigger>
              <SelectContent className="bg-popover z-50">
                {DURATION_OPTIONS.map((opt) => (
                  <SelectItem key={opt} value={String(opt)}>
                    {formatDurationAr(opt)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              ستُطبق هذه المدة على الطلاب الجدد افتراضياً
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)} className="flex-1">
              إلغاء
            </Button>
            <Button onClick={handleSave} className="flex-1 gradient-primary">
              حفظ الإعدادات
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
