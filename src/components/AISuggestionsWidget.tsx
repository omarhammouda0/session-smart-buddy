// AI Suggestions Widget
// Floating header icon with dropdown for suggestions

import { useState, useRef, useEffect } from "react";
import { Lightbulb, X, ChevronDown, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AISuggestion, SUGGESTION_ICONS } from "@/types/suggestions";
import { executeAction, ActionHandlers } from "@/lib/suggestionActions";

interface AISuggestionsWidgetProps {
  suggestions: AISuggestion[];
  hasNewCritical: boolean;
  onDismiss: (id: string) => void;
  onMarkAsRead: () => void;
  actionHandlers: ActionHandlers;
}

export function AISuggestionsWidget({
  suggestions,
  hasNewCritical,
  onDismiss,
  onMarkAsRead,
  actionHandlers,
}: AISuggestionsWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Hide widget if no suggestions
  if (suggestions.length === 0) {
    return null;
  }

  const handleToggle = () => {
    setIsOpen(!isOpen);
    if (!isOpen && hasNewCritical) {
      onMarkAsRead();
    }
  };

  const handleAction = (suggestion: AISuggestion) => {
    executeAction(suggestion.action.target, actionHandlers);
    setIsOpen(false);
  };

  const getPriorityColor = (priority: AISuggestion["priority"]) => {
    switch (priority) {
      case "critical":
        return "border-r-red-500 bg-red-500/5";
      case "high":
        return "border-r-orange-500 bg-orange-500/5";
      case "medium":
        return "border-r-blue-500 bg-blue-500/5";
      case "low":
        return "border-r-gray-400 bg-gray-400/5";
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={handleToggle}
        className={cn(
          "relative h-9 w-9 rounded-lg transition-all",
          isOpen && "bg-primary/10",
          hasNewCritical && "animate-pulse"
        )}
        title="خلي بالك"
      >
        <Lightbulb
          className={cn(
            "h-5 w-5 transition-colors",
            hasNewCritical ? "text-amber-500" : "text-muted-foreground"
          )}
        />

        {/* Badge Count */}
        <Badge
          className={cn(
            "absolute -top-1 -right-1 h-5 min-w-[20px] px-1.5 text-[10px] font-bold",
            hasNewCritical
              ? "bg-red-500 text-white animate-bounce"
              : "bg-primary text-primary-foreground"
          )}
        >
          {suggestions.length}
        </Badge>
      </Button>

      {/* Dropdown */}
      {isOpen && (
        <Card
          className={cn(
            "absolute top-full left-0 mt-2 w-80 sm:w-96 z-50",
            "shadow-2xl border-2 animate-in fade-in slide-in-from-top-2 duration-200",
            "max-h-[70vh] overflow-hidden flex flex-col"
          )}
          dir="rtl"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b bg-muted/30">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="font-bold text-sm">اقتراحات ذكية</span>
              <Badge variant="secondary" className="text-[10px]">
                {suggestions.length}
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Suggestions List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {suggestions.map((suggestion) => (
              <div
                key={suggestion.id}
                className={cn(
                  "relative rounded-lg border-2 border-r-4 p-3 transition-all hover:shadow-md",
                  getPriorityColor(suggestion.priority)
                )}
              >
                {/* Dismiss Button */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-1 left-1 h-6 w-6 opacity-50 hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDismiss(suggestion.id);
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>

                {/* Content */}
                <div className="flex gap-3">
                  {/* Icon */}
                  <span className="text-xl shrink-0">
                    {SUGGESTION_ICONS[suggestion.type]}
                  </span>

                  {/* Message & Action */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-relaxed mb-2">
                      {suggestion.message}
                    </p>

                    {/* Action Link */}
                    <button
                      onClick={() => handleAction(suggestion)}
                      className="text-xs text-primary hover:text-primary/80 hover:underline font-medium flex items-center gap-1"
                    >
                      {suggestion.action.label}
                      <ChevronDown className="h-3 w-3 rotate-[-90deg]" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="p-2 border-t bg-muted/20">
            <p className="text-[10px] text-muted-foreground text-center">
              يتم تحديث الاقتراحات كل ساعة
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}

