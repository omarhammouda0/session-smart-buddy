import { useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Check, X } from 'lucide-react';

interface SwipeableCardProps {
  children: React.ReactNode;
  onSwipeLeft?: () => void;  // Cancel action
  onSwipeRight?: () => void; // Complete action
  leftAction?: {
    icon: React.ReactNode;
    color: string;
    label: string;
  };
  rightAction?: {
    icon: React.ReactNode;
    color: string;
    label: string;
  };
  disabled?: boolean;
  className?: string;
}

export const SwipeableCard = ({
  children,
  onSwipeLeft,
  onSwipeRight,
  leftAction = { icon: <X className="h-5 w-5" />, color: 'bg-muted', label: 'إلغاء' },
  rightAction = { icon: <Check className="h-5 w-5" />, color: 'bg-primary', label: 'إتمام' },
  disabled = false,
  className,
}: SwipeableCardProps) => {
  const [translateX, setTranslateX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const isHorizontalSwipe = useRef<boolean | null>(null);

  const SWIPE_THRESHOLD = 80;
  const MAX_SWIPE = 100;

  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled) return;
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    isHorizontalSwipe.current = null;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (disabled || !isDragging) return;

    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const diffX = currentX - startX.current;
    const diffY = currentY - startY.current;

    // Determine swipe direction on first significant move
    if (isHorizontalSwipe.current === null) {
      if (Math.abs(diffX) > 10 || Math.abs(diffY) > 10) {
        isHorizontalSwipe.current = Math.abs(diffX) > Math.abs(diffY);
      }
    }

    // Only handle horizontal swipes
    if (isHorizontalSwipe.current) {
      e.preventDefault();
      // Constrain the swipe range
      const constrainedX = Math.max(-MAX_SWIPE, Math.min(MAX_SWIPE, diffX));
      setTranslateX(constrainedX);
    }
  };

  const handleTouchEnd = () => {
    if (disabled) return;
    setIsDragging(false);

    if (translateX > SWIPE_THRESHOLD && onSwipeRight) {
      // Swipe right - complete action
      onSwipeRight();
    } else if (translateX < -SWIPE_THRESHOLD && onSwipeLeft) {
      // Swipe left - cancel action
      onSwipeLeft();
    }

    // Reset position
    setTranslateX(0);
    isHorizontalSwipe.current = null;
  };

  const swipeProgress = Math.abs(translateX) / SWIPE_THRESHOLD;
  const isSwipingRight = translateX > 0;
  const isSwipingLeft = translateX < 0;

  return (
    <div className={cn("relative overflow-hidden rounded-xl", className)}>
      {/* Background actions */}
      <div className="absolute inset-0 flex">
        {/* Right action (shown when swiping right) */}
        <div
          className={cn(
            "flex items-center justify-start pl-4 transition-opacity",
            rightAction.color,
            isSwipingRight ? "opacity-100" : "opacity-0"
          )}
          style={{ width: Math.abs(translateX) }}
        >
          <div className={cn(
            "flex flex-col items-center gap-0.5 text-primary-foreground transition-transform",
            swipeProgress > 0.5 ? "scale-110" : "scale-100"
          )}>
            {rightAction.icon}
            <span className="text-[10px] font-medium">{rightAction.label}</span>
          </div>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Left action (shown when swiping left) */}
        <div
          className={cn(
            "flex items-center justify-end pr-4 transition-opacity",
            leftAction.color,
            isSwipingLeft ? "opacity-100" : "opacity-0"
          )}
          style={{ width: Math.abs(translateX) }}
        >
          <div className={cn(
            "flex flex-col items-center gap-0.5 text-foreground transition-transform",
            swipeProgress > 0.5 ? "scale-110" : "scale-100"
          )}>
            {leftAction.icon}
            <span className="text-[10px] font-medium">{leftAction.label}</span>
          </div>
        </div>
      </div>

      {/* Card content */}
      <div
        className={cn(
          "relative bg-card transition-transform touch-manipulation",
          isDragging ? "transition-none" : "transition-transform duration-200"
        )}
        style={{ transform: `translateX(${translateX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </div>

      {/* Swipe hint indicator - shows on first render */}
      {!disabled && (onSwipeLeft || onSwipeRight) && (
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 sm:hidden">
          <div className="flex items-center gap-1 text-[9px] text-muted-foreground/50 bg-muted/30 px-2 py-0.5 rounded-full">
            {onSwipeRight && <span>← {rightAction.label}</span>}
            {onSwipeLeft && onSwipeRight && <span>|</span>}
            {onSwipeLeft && <span>{leftAction.label} →</span>}
          </div>
        </div>
      )}
    </div>
  );
};

