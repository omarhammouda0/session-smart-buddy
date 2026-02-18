import { SmartSlot, DayTip, SlotTier } from '@/hooks/useSmartTimeRecommendations';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Sparkles,
  Sunrise,
  Sun,
  Moon,
  Lightbulb,
  Star,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { useState } from 'react';

// ── Props ──────────────────────────────────────────────────

interface SmartSlotChipsProps {
  slots: SmartSlot[];
  tips: DayTip[];
  selectedTime: string;
  onSelectTime: (time: string) => void;
  compact?: boolean;     // fewer slots, smaller chips
}

// ── Tier styling ───────────────────────────────────────────

const tierStyles: Record<SlotTier, {
  bg: string;
  bgActive: string;
  border: string;
  text: string;
  badge: string;
}> = {
  gold: {
    bg: 'bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-950/50',
    bgActive: 'bg-amber-200 dark:bg-amber-800 ring-2 ring-amber-400 ring-offset-1',
    border: 'border-amber-200 dark:border-amber-700',
    text: 'text-amber-800 dark:text-amber-200',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  },
  green: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-950/50',
    bgActive: 'bg-emerald-200 dark:bg-emerald-800 ring-2 ring-emerald-400 ring-offset-1',
    border: 'border-emerald-200 dark:border-emerald-700',
    text: 'text-emerald-800 dark:text-emerald-200',
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
  },
  neutral: {
    bg: 'bg-gray-50 dark:bg-gray-900/30 hover:bg-gray-100 dark:hover:bg-gray-900/50',
    bgActive: 'bg-gray-200 dark:bg-gray-700 ring-2 ring-gray-400 ring-offset-1',
    border: 'border-gray-200 dark:border-gray-700',
    text: 'text-gray-700 dark:text-gray-300',
    badge: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  },
};

const periodIcon = (period: string) => {
  switch (period) {
    case 'morning':   return <Sunrise className="h-3 w-3" />;
    case 'afternoon': return <Sun className="h-3 w-3" />;
    case 'evening':   return <Moon className="h-3 w-3" />;
    default:          return null;
  }
};

const tierIcon = (tier: SlotTier) => {
  switch (tier) {
    case 'gold':  return <Star className="h-3 w-3 text-amber-500" />;
    case 'green': return <TrendingUp className="h-3 w-3 text-emerald-500" />;
    default:      return null;
  }
};

const tipTypeStyles: Record<DayTip['type'], string> = {
  success: 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200/50 dark:border-emerald-800/50',
  info: 'bg-blue-50/60 dark:bg-blue-950/20 border-blue-200/50 dark:border-blue-800/50',
  warning: 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-200/50 dark:border-amber-800/50',
};

// ── Component ──────────────────────────────────────────────

export function SmartSlotChips({
  slots,
  tips,
  selectedTime,
  onSelectTime,
  compact = false,
}: SmartSlotChipsProps) {
  const [expanded, setExpanded] = useState(false);

  if (slots.length === 0 && tips.length === 0) return null;

  const visibleSlots = compact
    ? slots.slice(0, 4)
    : expanded
      ? slots
      : slots.slice(0, 6);

  const hasMore = !compact && !expanded && slots.length > 6;

  return (
    <div className="space-y-2.5">
      {/* Day Tips */}
      {tips.length > 0 && (
        <div className="space-y-1.5">
          {tips.slice(0, 3).map((tip, i) => (
            <div
              key={i}
              className={cn(
                'flex items-start gap-2 px-2.5 py-1.5 rounded-lg border text-xs',
                tipTypeStyles[tip.type],
              )}
            >
              <span className="shrink-0 mt-0.5">{tip.icon}</span>
              <span className={cn(
                tip.type === 'success' && 'text-emerald-700 dark:text-emerald-400',
                tip.type === 'info' && 'text-blue-700 dark:text-blue-400',
                tip.type === 'warning' && 'text-amber-700 dark:text-amber-400',
              )}>
                {tip.text}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Smart Slots */}
      {visibleSlots.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium flex items-center gap-1.5 text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            توصيات ذكية
            {slots.filter(s => s.tier === 'gold').length > 0 && (
              <Badge variant="outline" className="text-[10px] h-4 px-1 bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700">
                <Star className="h-2.5 w-2.5 ml-0.5" />
                أفضل
              </Badge>
            )}
          </p>

          <div className="flex flex-wrap gap-1.5">
            {visibleSlots.map((slot) => {
              const isSelected = selectedTime === slot.time;
              const style = tierStyles[slot.tier];

              return (
                <button
                  key={slot.time}
                  type="button"
                  onClick={() => onSelectTime(slot.time)}
                  className={cn(
                    'group relative inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all duration-150',
                    isSelected ? style.bgActive : style.bg,
                    style.border,
                    style.text,
                    'cursor-pointer',
                  )}
                  title={slot.reasons.slice(0, 2).join(' • ')}
                >
                  {tierIcon(slot.tier)}
                  {periodIcon(slot.period)}
                  <span className="font-bold">{slot.timeAr}</span>
                  {slot.tags.length > 0 && !compact && (
                    <span className={cn(
                      'text-[10px] px-1 py-0.5 rounded',
                      style.badge,
                    )}>
                      {slot.tags[0]}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Expand button */}
          {hasMore && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="text-[11px] text-muted-foreground hover:text-primary transition-colors"
            >
              + {slots.length - 6} أوقات أخرى
            </button>
          )}

          {/* Reasons for selected slot */}
          {selectedTime && (() => {
            const selected = slots.find(s => s.time === selectedTime);
            if (!selected || selected.reasons.length === 0) return null;

            return (
              <div className="mt-1.5 p-2 rounded-lg bg-muted/50 border border-border/50">
                <p className="text-[10px] font-medium text-muted-foreground mb-1 flex items-center gap-1">
                  <Lightbulb className="h-3 w-3" />
                  لماذا هذا الوقت؟
                </p>
                <div className="flex flex-wrap gap-1">
                  {selected.reasons.slice(0, 4).map((reason, i) => (
                    <span key={i} className="text-[10px] text-muted-foreground">
                      {reason}
                      {i < Math.min(selected.reasons.length, 4) - 1 && ' •'}
                    </span>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
