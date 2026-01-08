import { useState, useEffect } from 'react';
import { Clock, Edit2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DURATION_OPTIONS, DEFAULT_DURATION, MIN_DURATION, MAX_DURATION } from '@/types/student';
import { calculateEndTime, formatDurationAr } from '@/lib/arabicConstants';
import { formatTimeAr } from '@/hooks/useConflictDetection';
import { cn } from '@/lib/utils';

interface DurationPickerProps {
  startTime: string;
  duration: number;
  onDurationChange: (duration: number) => void;
  onEndTimeOverride?: (endTime: string) => void;
  className?: string;
  showEndTime?: boolean;
}

export const DurationPicker = ({
  startTime,
  duration,
  onDurationChange,
  onEndTimeOverride,
  className,
  showEndTime = true,
}: DurationPickerProps) => {
  const [isCustom, setIsCustom] = useState(!DURATION_OPTIONS.includes(duration as any));
  const [customValue, setCustomValue] = useState(isCustom ? String(duration) : '');
  const [isEditingEndTime, setIsEditingEndTime] = useState(false);
  const [manualEndTime, setManualEndTime] = useState('');

  // Calculate end time
  const { endTime, crossesMidnight } = calculateEndTime(startTime, duration);

  // Handle preset selection
  const handlePresetChange = (value: string) => {
    if (value === 'custom') {
      setIsCustom(true);
      setCustomValue(String(duration));
    } else {
      setIsCustom(false);
      const newDuration = parseInt(value, 10);
      onDurationChange(newDuration);
    }
  };

  // Handle custom duration input
  const handleCustomChange = (value: string) => {
    setCustomValue(value);
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && numValue >= MIN_DURATION && numValue <= MAX_DURATION) {
      onDurationChange(numValue);
    }
  };

  // Handle manual end time edit
  const handleEndTimeEdit = () => {
    setManualEndTime(endTime);
    setIsEditingEndTime(true);
  };

  const handleEndTimeConfirm = () => {
    if (onEndTimeOverride) {
      onEndTimeOverride(manualEndTime);
    }
    setIsEditingEndTime(false);
  };

  // Validate custom duration
  const isCustomValid = !isCustom || (parseInt(customValue, 10) >= MIN_DURATION && parseInt(customValue, 10) <= MAX_DURATION);
  const durationWarning = duration < MIN_DURATION ? 'المدة قصيرة جداً' : duration > 180 ? 'المدة طويلة جداً' : null;

  return (
    <div className={cn("space-y-3", className)}>
      {/* Duration Selector */}
      <div className="space-y-2">
        <Label className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          المدة
        </Label>
        <div className="flex gap-2">
          <Select
            value={isCustom ? 'custom' : String(duration)}
            onValueChange={handlePresetChange}
          >
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="اختر المدة" />
            </SelectTrigger>
            <SelectContent className="bg-popover z-50">
              {DURATION_OPTIONS.map((opt) => (
                <SelectItem key={opt} value={String(opt)}>
                  {formatDurationAr(opt)}
                </SelectItem>
              ))}
              <SelectItem value="custom">مخصص</SelectItem>
            </SelectContent>
          </Select>
          
          {isCustom && (
            <div className="flex items-center gap-1">
              <Input
                type="number"
                min={MIN_DURATION}
                max={MAX_DURATION}
                value={customValue}
                onChange={(e) => handleCustomChange(e.target.value)}
                className={cn("w-20", !isCustomValid && "border-destructive")}
                placeholder="60"
              />
              <span className="text-sm text-muted-foreground">دقيقة</span>
            </div>
          )}
        </div>
        
        {!isCustomValid && (
          <p className="text-xs text-destructive">
            المدة يجب أن تكون بين {MIN_DURATION} و {MAX_DURATION} دقيقة
          </p>
        )}
        
        {durationWarning && isCustomValid && (
          <p className="text-xs text-warning">
            ⚠️ {durationWarning}
          </p>
        )}
      </div>

      {/* End Time Display */}
      {showEndTime && (
        <div className="space-y-2">
          <Label className="text-muted-foreground text-xs">وقت النهاية (محسوب تلقائياً)</Label>
          <div className={cn(
            "flex items-center justify-between p-2.5 rounded-lg border bg-muted/50",
            crossesMidnight && "border-warning/50 bg-warning/5"
          )}>
            {isEditingEndTime ? (
              <div className="flex items-center gap-2">
                <Input
                  type="time"
                  value={manualEndTime}
                  onChange={(e) => setManualEndTime(e.target.value)}
                  className="w-28"
                />
                <Button size="sm" variant="ghost" onClick={handleEndTimeConfirm}>
                  تأكيد
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setIsEditingEndTime(false)}>
                  إلغاء
                </Button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{formatTimeAr(endTime)}</span>
                  {crossesMidnight && (
                    <span className="text-xs text-warning bg-warning/20 px-1.5 py-0.5 rounded">
                      (الغد)
                    </span>
                  )}
                </div>
                {onEndTimeOverride && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={handleEndTimeEdit}
                    title="تعديل وقت النهاية"
                  >
                    <Edit2 className="h-3 w-3" />
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};