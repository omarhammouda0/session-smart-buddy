import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Settings, Clock, Banknote, Monitor, MapPin } from 'lucide-react';
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
import { Separator } from '@/components/ui/separator';

interface SemesterSettingsProps {
  settings: AppSettings;
  onUpdate: (settings: Partial<AppSettings>) => void;
}

export const SemesterSettings = ({ settings, onUpdate }: SemesterSettingsProps) => {
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState(settings.defaultSemesterStart);
  const [end, setEnd] = useState(settings.defaultSemesterEnd);
  const [duration, setDuration] = useState(settings.defaultSessionDuration || DEFAULT_DURATION);
  const [priceOnsite, setPriceOnsite] = useState<string>(settings.defaultPriceOnsite?.toString() || '');
  const [priceOnline, setPriceOnline] = useState<string>(settings.defaultPriceOnline?.toString() || '');

  const handleSave = () => {
    const onsitePrice = priceOnsite ? parseFloat(priceOnsite) : undefined;
    const onlinePrice = priceOnline ? parseFloat(priceOnline) : undefined;
    
    // Validate prices
    if (onsitePrice !== undefined && onsitePrice < 0) {
      return;
    }
    if (onlinePrice !== undefined && onlinePrice < 0) {
      return;
    }
    
    onUpdate({
      defaultSemesterStart: start,
      defaultSemesterEnd: end,
      defaultSessionDuration: duration,
      defaultPriceOnsite: onsitePrice,
      defaultPriceOnline: onlinePrice,
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
      setPriceOnsite(settings.defaultPriceOnsite?.toString() || '');
      setPriceOnline(settings.defaultPriceOnline?.toString() || '');
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
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">الإعدادات الافتراضية</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 pt-4">
          {/* Semester Settings */}
          <div className="space-y-3">
            <h3 className="font-medium text-sm flex items-center gap-2">
              <Settings className="h-4 w-4" />
              إعدادات الفصل الدراسي
            </h3>
            <p className="text-xs text-muted-foreground">
              حدد الفترة الافتراضية للفصل الدراسي للطلاب الجدد.
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
          </div>

          <Separator />

          {/* Session Settings */}
          <div className="space-y-3">
            <h3 className="font-medium text-sm flex items-center gap-2">
              <Clock className="h-4 w-4" />
              إعدادات الجلسات
            </h3>

            {/* Default Session Duration */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                المدة الافتراضية
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
            </div>
          </div>

          <Separator />

          {/* Pricing Settings */}
          <div className="space-y-3">
            <h3 className="font-medium text-sm flex items-center gap-2">
              <Banknote className="h-4 w-4" />
              الأسعار الافتراضية
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="price-onsite" className="flex items-center gap-1.5 text-xs">
                  <MapPin className="h-3 w-3" />
                  حضوري
                </Label>
                <div className="relative">
                  <Input
                    id="price-onsite"
                    type="number"
                    min="0"
                    step="0.5"
                    value={priceOnsite}
                    onChange={(e) => setPriceOnsite(e.target.value)}
                    placeholder="100"
                    className="pl-12"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    ريال
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="price-online" className="flex items-center gap-1.5 text-xs">
                  <Monitor className="h-3 w-3" />
                  أونلاين
                </Label>
                <div className="relative">
                  <Input
                    id="price-online"
                    type="number"
                    min="0"
                    step="0.5"
                    value={priceOnline}
                    onChange={(e) => setPriceOnline(e.target.value)}
                    placeholder="80"
                    className="pl-12"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    ريال
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Info Note */}
          <div className="p-3 rounded-lg bg-muted/50 border">
            <p className="text-xs text-muted-foreground">
              ℹ️ هذه القيم الافتراضية لجميع الطلاب الجدد. يمكنك تخصيص قيم مختلفة لكل طالب من صفحة تعديل الطالب.
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
