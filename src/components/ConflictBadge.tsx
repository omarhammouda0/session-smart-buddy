import { AlertTriangle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ConflictResult, formatTimeAr } from '@/hooks/useConflictDetection';

interface ConflictBadgeProps {
  result: ConflictResult;
  onClick?: () => void;
  className?: string;
}

export const ConflictBadge = ({
  result,
  onClick,
  className,
}: ConflictBadgeProps) => {
  if (result.severity === 'none') return null;

  const isError = result.severity === 'error';
  const Icon = isError ? XCircle : AlertTriangle;
  const bgColor = isError ? 'border-destructive bg-card' : 'border-warning bg-card';
  const iconColor = isError ? 'text-destructive' : 'text-warning';

  const mainConflict = result.conflicts[0];

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onClick}
            className={cn(
              "absolute top-1 left-1 w-6 h-6 rounded-full border-2 flex items-center justify-center shadow-sm hover:scale-110 transition-transform z-10",
              bgColor,
              className
            )}
          >
            <Icon className={cn("h-3.5 w-3.5", iconColor)} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs" dir="rtl">
          <div className="text-sm space-y-1">
            <p className="font-medium">
              {isError ? 'تعارض:' : 'تحذير:'}
            </p>
            {mainConflict && (
              <p className="text-muted-foreground">
                {isError ? 'يتداخل مع جلسة' : 'قريب جداً من جلسة'} {mainConflict.student.name}
                <br />
                {formatTimeAr(mainConflict.session.time || mainConflict.student.sessionTime || '16:00')}
              </p>
            )}
            {onClick && (
              <p className="text-xs text-muted-foreground mt-1">انقر لعرض التفاصيل</p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
