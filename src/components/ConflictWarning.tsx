import { AlertTriangle, XCircle, CheckCircle2, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ConflictResult, formatTimeAr } from '@/hooks/useConflictDetection';

interface ConflictWarningProps {
  result: ConflictResult;
  onSelectSuggestion?: (time: string) => void;
  className?: string;
  compact?: boolean;
}

export const ConflictWarning = ({
  result,
  onSelectSuggestion,
  className,
  compact = false,
}: ConflictWarningProps) => {
  const [expanded, setExpanded] = useState(false);

  if (result.severity === 'none') {
    return (
      <div className={cn(
        "flex items-center gap-2 text-success text-sm p-2 rounded-lg bg-success/10 border border-success/20",
        className
      )}>
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        <span>✓ الوقت متاح</span>
      </div>
    );
  }

  const isError = result.severity === 'error';
  const Icon = isError ? XCircle : AlertTriangle;
  const bgColor = isError ? 'bg-destructive/10' : 'bg-warning/10';
  const borderColor = isError ? 'border-destructive/30' : 'border-warning/30';
  const textColor = isError ? 'text-destructive' : 'text-warning';
  const iconColor = isError ? 'text-destructive' : 'text-warning';

  const mainConflict = result.conflicts[0];
  const hasMultiple = result.conflicts.length > 1;

  return (
    <div className={cn(
      "rounded-lg border p-3 space-y-2",
      bgColor,
      borderColor,
      className
    )} dir="rtl">
      {/* Header */}
      <div className="flex items-start gap-2">
        <Icon className={cn("h-5 w-5 shrink-0 mt-0.5", iconColor)} />
        <div className="flex-1 min-w-0">
          <p className={cn("font-semibold text-sm", textColor)}>
            {isError ? '❌ تعارض مع جلسة موجودة' : '⚠️ قريب من جلسة أخرى'}
          </p>
          {mainConflict && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {mainConflict.student.name}: {formatTimeAr(mainConflict.session.time || mainConflict.student.sessionTime || '16:00')}
              {mainConflict.type === 'close' && mainConflict.gap !== undefined && (
                <span className="mr-1">(فاصل {mainConflict.gap} دقيقة فقط)</span>
              )}
            </p>
          )}
          {hasMultiple && !expanded && (
            <button
              onClick={() => setExpanded(true)}
              className="text-xs text-muted-foreground hover:underline mt-1 flex items-center gap-1"
            >
              +{result.conflicts.length - 1} تعارضات أخرى
              <ChevronDown className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Expanded conflicts */}
      {expanded && hasMultiple && (
        <div className="space-y-1.5 pt-2 border-t border-border/50">
          {result.conflicts.slice(1).map((conflict, idx) => (
            <div key={idx} className="text-xs text-muted-foreground flex items-center gap-2">
              <Clock className="h-3 w-3" />
              <span>
                {conflict.student.name}: {formatTimeAr(conflict.session.time || conflict.student.sessionTime || '16:00')}
                {conflict.type === 'close' && conflict.gap !== undefined && (
                  <span className="mr-1">(فاصل {conflict.gap} دقيقة)</span>
                )}
              </span>
            </div>
          ))}
          <button
            onClick={() => setExpanded(false)}
            className="text-xs text-muted-foreground hover:underline flex items-center gap-1"
          >
            إخفاء
            <ChevronUp className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Suggestions */}
      {!compact && result.suggestions.length > 0 && (
        <div className="pt-2 border-t border-border/50">
          <p className="text-xs text-muted-foreground mb-1.5">💡 أوقات متاحة:</p>
          <div className="flex flex-wrap gap-1.5">
            {result.suggestions.map((suggestion, idx) => (
              <Button
                key={idx}
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => onSelectSuggestion?.(suggestion.time)}
              >
                {suggestion.labelAr}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
