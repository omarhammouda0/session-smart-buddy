// AI Suggestions Widget
// Floating header icon with dropdown and critical interrupt overlay
// Single suggestion display with queue management and history
// Supports secondary actions for payment suggestions

import { useState, useRef, useEffect } from "react";
import { Lightbulb, X, ChevronDown, Sparkles, History, ChevronUp, AlertTriangle, CheckCircle2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AISuggestion, DismissedSuggestion, SUGGESTION_ICONS, SUGGESTION_TYPE_LABELS, INTERRUPT_THRESHOLD } from "@/types/suggestions";
import { executeAction, ActionHandlers } from "@/lib/suggestionActions";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

interface AISuggestionsWidgetProps {
  currentSuggestion: AISuggestion | null;
  pendingCount: number;
  allPendingSuggestions: AISuggestion[];
  hasCriticalInterrupt: boolean;
  dismissedHistory: DismissedSuggestion[];
  onDismiss: (id: string) => void;
  onAction: (id: string) => void;
  onDismissCriticalOverlay: () => void;
  actionHandlers: ActionHandlers;
}

export function AISuggestionsWidget({
  currentSuggestion,
  pendingCount,
  allPendingSuggestions,
  hasCriticalInterrupt,
  dismissedHistory,
  onDismiss,
  onAction,
  onDismissCriticalOverlay,
  actionHandlers,
}: AISuggestionsWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
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

  // Handle primary action execution
  const handleAction = (suggestion: AISuggestion) => {
    executeAction(suggestion.action.target, actionHandlers);
    onAction(suggestion.id);
    setIsOpen(false);
  };

  // Handle secondary action execution (e.g., WhatsApp for payments)
  const handleSecondaryAction = (suggestion: AISuggestion) => {
    if (suggestion.secondaryAction) {
      executeAction(suggestion.secondaryAction.target, actionHandlers);
      // Don't mark as actioned - payment must still be recorded
    }
  };

  // Handle dismiss
  const handleDismiss = (suggestion: AISuggestion, e?: React.MouseEvent) => {
    e?.stopPropagation();
    onDismiss(suggestion.id);
  };

  const getPriorityColor = (priority: AISuggestion["priority"], priorityScore?: number) => {
    // Priority 100 gets special styling
    if (priorityScore && priorityScore >= INTERRUPT_THRESHOLD) {
      return "border-r-red-600 bg-red-500/10";
    }
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

  const getPriorityBadge = (priority: AISuggestion["priority"], priorityScore?: number) => {
    if (priorityScore && priorityScore >= INTERRUPT_THRESHOLD) {
      return <Badge variant="destructive" className="text-[9px] px-1.5 animate-pulse">فوري</Badge>;
    }
    switch (priority) {
      case "critical":
        return <Badge variant="destructive" className="text-[9px] px-1.5">عاجل</Badge>;
      case "high":
        return <Badge className="bg-orange-500 text-[9px] px-1.5">مهم</Badge>;
      case "medium":
        return <Badge variant="secondary" className="text-[9px] px-1.5">متوسط</Badge>;
      case "low":
        return <Badge variant="outline" className="text-[9px] px-1.5">عادي</Badge>;
    }
  };

  const getDismissReasonLabel = (reason: DismissedSuggestion["reason"]) => {
    switch (reason) {
      case "manual":
        return "تم التجاهل";
      case "actioned":
        return "تم التنفيذ";
      case "condition_resolved":
        return "تم الحل تلقائياً";
    }
  };

  // Check if current suggestion is priority 100 (must interrupt)
  const isInterrupting = currentSuggestion?.priorityScore && currentSuggestion.priorityScore >= INTERRUPT_THRESHOLD;

  // Hide widget trigger if no suggestions
  const showTrigger = pendingCount > 0 || dismissedHistory.length > 0;

  return (
    <>
      {/* Critical Interrupt Overlay - Priority 100 only */}
      {hasCriticalInterrupt && currentSuggestion && isInterrupting && (
        <div
          className="fixed top-20 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-[100] animate-in slide-in-from-top-4 duration-300"
          dir="rtl"
        >
          <Card className="border-2 border-red-500 shadow-2xl bg-gradient-to-br from-red-50 to-white dark:from-red-950/20 dark:to-background">
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-red-200 dark:border-red-800 bg-red-100/50 dark:bg-red-900/20 rounded-t-lg">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600 animate-pulse" />
                <span className="font-bold text-red-700 dark:text-red-400">تنبيه فوري</span>
                <Badge variant="destructive" className="text-[9px]">أولوية ١٠٠</Badge>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-red-600 hover:bg-red-200/50"
                onClick={onDismissCriticalOverlay}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Content */}
            <div className="p-4">
              <div className="flex gap-3">
                <span className="text-2xl shrink-0">
                  {SUGGESTION_ICONS[currentSuggestion.type]}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold leading-relaxed mb-3 whitespace-pre-line">
                    {currentSuggestion.message}
                  </p>

                  {/* Action buttons */}
                  <div className="flex flex-col gap-2">
                    <Button
                      size="sm"
                      className="w-full bg-red-600 hover:bg-red-700 text-white"
                      onClick={() => handleAction(currentSuggestion)}
                    >
                      {currentSuggestion.action.label}
                    </Button>

                    {/* Secondary action (e.g., WhatsApp) */}
                    {currentSuggestion.secondaryAction && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full border-green-500 text-green-700 hover:bg-green-50"
                        onClick={() => handleSecondaryAction(currentSuggestion)}
                      >
                        <MessageCircle className="h-4 w-4 ml-2" />
                        {currentSuggestion.secondaryAction.label}
                      </Button>
                    )}

                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => handleDismiss(currentSuggestion)}
                    >
                      لاحقاً
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Widget Trigger & Dropdown */}
      {showTrigger && (
        <div className="relative" ref={dropdownRef}>
          {/* Trigger Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsOpen(!isOpen)}
            className={cn(
              "relative h-9 w-9 rounded-lg transition-all",
              isOpen && "bg-primary/10",
              isInterrupting && "animate-pulse"
            )}
            title="اقتراحات ذكية"
          >
            <Lightbulb
              className={cn(
                "h-5 w-5 transition-colors",
                isInterrupting ? "text-red-500" : pendingCount > 0 ? "text-amber-500" : "text-muted-foreground"
              )}
            />

            {/* Badge Count */}
            {pendingCount > 0 && (
              <Badge
                className={cn(
                  "absolute -top-1 -right-1 h-5 min-w-[20px] px-1.5 text-[10px] font-bold",
                  isInterrupting
                    ? "bg-red-500 text-white animate-bounce"
                    : "bg-primary text-primary-foreground"
                )}
              >
                {pendingCount}
              </Badge>
            )}
          </Button>

          {/* Dropdown */}
          {isOpen && (
            <Card
              className={cn(
                "fixed left-2 right-2 top-14 z-50",
                "sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96",
                "shadow-2xl border-2 animate-in fade-in slide-in-from-top-2 duration-200",
                "max-h-[80vh] overflow-hidden flex flex-col"
              )}
              dir="rtl"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-3 border-b bg-muted/30">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="font-bold text-sm">اقتراحات ذكية</span>
                  {pendingCount > 0 && (
                    <Badge variant="secondary" className="text-[10px]">
                      {pendingCount}
                    </Badge>
                  )}
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

              {/* Current Suggestion (Prominent) */}
              {currentSuggestion && (
                <div className="p-3 border-b bg-primary/5">
                  <div
                    className={cn(
                      "rounded-lg border-2 border-r-4 p-3 transition-all",
                      getPriorityColor(currentSuggestion.priority, currentSuggestion.priorityScore)
                    )}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{SUGGESTION_ICONS[currentSuggestion.type]}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {SUGGESTION_TYPE_LABELS[currentSuggestion.type]}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {getPriorityBadge(currentSuggestion.priority, currentSuggestion.priorityScore)}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-50 hover:opacity-100"
                          onClick={(e) => handleDismiss(currentSuggestion, e)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-sm font-medium leading-relaxed mb-3 whitespace-pre-line">
                      {currentSuggestion.message}
                    </p>
                    <div className="flex flex-col gap-2">
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={() => handleAction(currentSuggestion)}
                      >
                        {currentSuggestion.action.label}
                        <ChevronDown className="h-3 w-3 mr-1 rotate-[-90deg]" />
                      </Button>

                      {/* Secondary action */}
                      {currentSuggestion.secondaryAction && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full border-green-500 text-green-700 hover:bg-green-50"
                          onClick={() => handleSecondaryAction(currentSuggestion)}
                        >
                          <MessageCircle className="h-3 w-3 ml-1" />
                          {currentSuggestion.secondaryAction.label}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Other Pending Suggestions */}
              {allPendingSuggestions.length > 1 && (
                <div className="flex-1 overflow-y-auto p-2 space-y-2 max-h-48">
                  <p className="text-[10px] text-muted-foreground px-1 mb-1">اقتراحات أخرى:</p>
                  {allPendingSuggestions.slice(1).map((suggestion) => (
                    <div
                      key={suggestion.id}
                      className={cn(
                        "relative rounded-lg border border-r-4 p-2.5 transition-all hover:shadow-sm text-sm",
                        getPriorityColor(suggestion.priority, suggestion.priorityScore)
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-base shrink-0">
                          {SUGGESTION_ICONS[suggestion.type]}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium leading-relaxed line-clamp-2">
                            {suggestion.message}
                          </p>
                          <div className="flex gap-2 mt-1">
                            <button
                              onClick={() => handleAction(suggestion)}
                              className="text-[10px] text-primary hover:underline font-medium"
                            >
                              {suggestion.action.label}
                            </button>
                            {suggestion.secondaryAction && (
                              <>
                                <span className="text-[10px] text-muted-foreground">|</span>
                                <button
                                  onClick={() => handleSecondaryAction(suggestion)}
                                  className="text-[10px] text-green-600 hover:underline font-medium"
                                >
                                  {suggestion.secondaryAction.label}
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 opacity-40 hover:opacity-100 shrink-0"
                          onClick={(e) => handleDismiss(suggestion, e)}
                        >
                          <X className="h-2.5 w-2.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Empty State */}
              {pendingCount === 0 && (
                <div className="p-6 text-center">
                  <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">مفيش اقتراحات جديدة</p>
                </div>
              )}

              {/* History Section (Collapsible) */}
              {dismissedHistory.length > 0 && (
                <div className="border-t">
                  <button
                    onClick={() => setShowHistory(!showHistory)}
                    className="w-full flex items-center justify-between p-2.5 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <History className="h-4 w-4" />
                      <span className="text-xs font-medium">السجل</span>
                      <Badge variant="outline" className="text-[9px]">
                        {dismissedHistory.length}
                      </Badge>
                    </div>
                    {showHistory ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>

                  {showHistory && (
                    <div className="max-h-40 overflow-y-auto p-2 pt-0 space-y-1.5 bg-muted/10">
                      {dismissedHistory.slice(0, 10).map((item) => (
                        <div
                          key={`${item.id}-${item.dismissedAt}`}
                          className="rounded border p-2 bg-background/50 opacity-70"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm">{SUGGESTION_ICONS[item.type]}</span>
                              <p className="text-[10px] text-muted-foreground line-clamp-1 flex-1">
                                {item.message}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-[9px] text-muted-foreground">
                              {format(new Date(item.dismissedAt), "d MMM، h:mm a", { locale: ar })}
                            </span>
                            <Badge variant="outline" className="text-[8px] px-1 py-0">
                              {getDismissReasonLabel(item.reason)}
                            </Badge>
                          </div>
                        </div>
                      ))}
                      {dismissedHistory.length > 10 && (
                        <p className="text-[9px] text-muted-foreground text-center py-1">
                          +{dismissedHistory.length - 10} أكثر
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Footer */}
              <div className="p-2 border-t bg-muted/20">
                <p className="text-[9px] text-muted-foreground text-center">
                  يتم تحديث الاقتراحات تلقائياً
                </p>
              </div>
            </Card>
          )}
        </div>
      )}
    </>
  );
}
