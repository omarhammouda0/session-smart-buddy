import { cn } from '@/lib/utils';

interface GapIndicatorProps {
  gapMinutes: number | null;
  className?: string;
}

export const GapIndicator = ({ gapMinutes, className }: GapIndicatorProps) => {
  if (gapMinutes === null) return null;

  let severity: 'good' | 'warning' | 'critical';
  let label: string;
  let bgColor: string;
  let textColor: string;
  let borderColor: string;

  if (gapMinutes < 0) {
    severity = 'critical';
    label = `❌ تداخل ${Math.abs(gapMinutes)} دقيقة`;
    bgColor = 'bg-destructive/10';
    textColor = 'text-destructive';
    borderColor = 'border-destructive/30';
  } else if (gapMinutes === 0) {
    severity = 'critical';
    label = '❌ بدون فاصل';
    bgColor = 'bg-destructive/10';
    textColor = 'text-destructive';
    borderColor = 'border-destructive/30';
  } else if (gapMinutes < 15) {
    severity = 'warning';
    label = `⚠️ ${gapMinutes} دقيقة فقط`;
    bgColor = 'bg-warning/10';
    textColor = 'text-warning';
    borderColor = 'border-warning/30';
  } else {
    severity = 'good';
    label = `✓ ${gapMinutes} دقيقة راحة`;
    bgColor = 'bg-success/10';
    textColor = 'text-success';
    borderColor = 'border-success/30';
  }

  return (
    <div
      className={cn(
        "text-center py-1 px-3 mx-auto w-fit rounded-full text-[11px] font-medium border",
        bgColor,
        textColor,
        borderColor,
        className
      )}
      dir="rtl"
    >
      {label}
    </div>
  );
};
