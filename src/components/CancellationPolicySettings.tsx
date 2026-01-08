import { useState, useEffect } from 'react';
import { AlertTriangle, Bell, MessageSquare, Save, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Student, CancellationPolicy } from '@/types/student';
import { cn } from '@/lib/utils';

interface CancellationPolicySettingsProps {
  student: Student;
  currentCount: number;
  onSave: (policy: CancellationPolicy) => void;
}

const LIMIT_OPTIONS = [
  { value: '1', label: '1 جلسة' },
  { value: '2', label: '2 جلسة' },
  { value: '3', label: '3 جلسات' },
  { value: '4', label: '4 جلسات' },
  { value: '5', label: '5 جلسات' },
  { value: 'unlimited', label: 'غير محدود' },
];

export const CancellationPolicySettings = ({
  student,
  currentCount,
  onSave,
}: CancellationPolicySettingsProps) => {
  const [limit, setLimit] = useState<string>(
    student.cancellationPolicy?.monthlyLimit?.toString() ?? '3'
  );
  const [alertTutor, setAlertTutor] = useState(
    student.cancellationPolicy?.alertTutor ?? true
  );
  const [autoNotifyParent, setAutoNotifyParent] = useState(
    student.cancellationPolicy?.autoNotifyParent ?? false
  );
  const [saved, setSaved] = useState(false);

  const numericLimit = limit === 'unlimited' ? null : parseInt(limit, 10);
  const percentage = numericLimit ? Math.min((currentCount / numericLimit) * 100, 100) : 0;

  const getSeverityColor = () => {
    if (numericLimit === null) return 'bg-muted';
    if (percentage >= 100) return 'bg-destructive';
    if (percentage >= 75) return 'bg-orange-500';
    if (percentage >= 50) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  const getSeverityText = () => {
    if (numericLimit === null) return 'text-muted-foreground';
    if (percentage >= 100) return 'text-destructive';
    if (percentage >= 75) return 'text-orange-600 dark:text-orange-500';
    if (percentage >= 50) return 'text-amber-600 dark:text-amber-500';
    return 'text-emerald-600 dark:text-emerald-500';
  };

  const handleSave = () => {
    onSave({
      monthlyLimit: numericLimit,
      alertTutor,
      autoNotifyParent,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // Check if there are changes
  const hasChanges =
    (numericLimit !== (student.cancellationPolicy?.monthlyLimit ?? 3)) ||
    alertTutor !== (student.cancellationPolicy?.alertTutor ?? true) ||
    autoNotifyParent !== (student.cancellationPolicy?.autoNotifyParent ?? false);

  return (
    <div className="space-y-4 p-4 rounded-lg border bg-card" dir="rtl">
      <div className="flex items-center gap-2 text-sm font-medium">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        <span>سياسة الإلغاء</span>
      </div>

      {/* Limit Selection */}
      <div className="space-y-2">
        <Label className="text-sm">الحد الأقصى للإلغاءات شهرياً:</Label>
        <Select value={limit} onValueChange={setLimit}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LIMIT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Current Count Display */}
      <div className="space-y-2">
        <Label className="text-sm">الإلغاءات هذا الشهر:</Label>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className={cn('font-medium', getSeverityText())}>
              {currentCount} من {numericLimit ?? '∞'}
              {numericLimit && ` (${Math.round(percentage)}%)`}
            </span>
            {numericLimit && currentCount >= numericLimit && (
              <span className="text-xs text-destructive font-medium">
                وصل للحد الأقصى!
              </span>
            )}
          </div>
          {numericLimit && (
            <Progress
              value={percentage}
              className={cn('h-2', getSeverityColor())}
            />
          )}
        </div>
      </div>

      {/* Notification Settings */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center gap-2">
          <Checkbox
            id="alert-tutor"
            checked={alertTutor}
            onCheckedChange={(checked) => setAlertTutor(checked === true)}
          />
          <Label
            htmlFor="alert-tutor"
            className="text-sm cursor-pointer flex items-center gap-1.5"
          >
            <Bell className="h-3.5 w-3.5" />
            تنبيهي عند الوصول للحد
          </Label>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="auto-notify-parent"
            checked={autoNotifyParent}
            onCheckedChange={(checked) => setAutoNotifyParent(checked === true)}
          />
          <Label
            htmlFor="auto-notify-parent"
            className="text-sm cursor-pointer flex items-center gap-1.5"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            إبلاغ ولي الأمر تلقائياً
          </Label>
        </div>
      </div>

      {/* Save Button */}
      <Button
        onClick={handleSave}
        disabled={!hasChanges && !saved}
        className="w-full gap-2"
        variant={saved ? 'outline' : 'default'}
      >
        {saved ? (
          <>
            <Check className="h-4 w-4" />
            تم الحفظ
          </>
        ) : (
          <>
            <Save className="h-4 w-4" />
            حفظ الإعدادات
          </>
        )}
      </Button>
    </div>
  );
};
