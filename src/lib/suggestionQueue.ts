// Suggestion Queue Manager
// Handles priority-based queue with single-suggestion display and auto-removal
// Active suggestions are MEMORY-ONLY (reset on refresh)
// Dismissed history persists for 30 days

import { AISuggestion, DismissedSuggestion, INTERRUPT_THRESHOLD } from "@/types/suggestions";

const HISTORY_STORAGE_KEY = "ai-suggestions-history";
const HISTORY_MAX_DAYS = 30;

export interface QueueState {
  suggestions: AISuggestion[];
  dismissedHistory: DismissedSuggestion[];
  lastUpdated: string;
}

/**
 * SuggestionQueueManager
 * Manages a priority-based queue where only one suggestion is shown at a time.
 * Priority 100 suggestions always interrupt lower priority ones.
 */
export class SuggestionQueueManager {
  private suggestions: AISuggestion[] = [];
  private dismissedHistory: DismissedSuggestion[] = [];
  private onChangeCallback?: (state: QueueState) => void;

  constructor() {
    this.loadFromStorage();
    this.cleanupOldHistory();
  }

  /**
   * Load state - MEMORY ONLY for active suggestions (reset on refresh)
   * Only dismissed history is loaded from localStorage
   */
  private loadFromStorage(): void {
    // Active suggestions are MEMORY-ONLY - start empty on refresh
    this.suggestions = [];

    // Load dismissed history from localStorage (persists 30 days)
    try {
      const historyData = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (historyData) {
        this.dismissedHistory = JSON.parse(historyData) || [];
      }
    } catch (error) {
      console.warn("Error loading suggestion history:", error);
      this.dismissedHistory = [];
    }
  }

  /**
   * Save state - ONLY history to localStorage
   * Active suggestions are not persisted (memory-only)
   */
  private saveToStorage(): void {
    try {
      // Only save history - active suggestions are memory-only
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(this.dismissedHistory));
    } catch (error) {
      console.warn("Error saving suggestion history:", error);
    }
  }

  /**
   * Clean up history entries older than 30 days
   */
  private cleanupOldHistory(): void {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - HISTORY_MAX_DAYS);
    const cutoffStr = cutoffDate.toISOString();

    const originalLength = this.dismissedHistory.length;
    this.dismissedHistory = this.dismissedHistory.filter(
      (item) => item.dismissedAt >= cutoffStr
    );

    if (this.dismissedHistory.length !== originalLength) {
      this.saveToStorage();
    }
  }

  /**
   * Notify subscribers of state change
   */
  private notifyChange(): void {
    this.saveToStorage();
    if (this.onChangeCallback) {
      this.onChangeCallback(this.getState());
    }
  }

  /**
   * Subscribe to queue changes
   */
  public onChange(callback: (state: QueueState) => void): void {
    this.onChangeCallback = callback;
  }

  /**
   * Get current queue state
   */
  public getState(): QueueState {
    return {
      suggestions: [...this.suggestions],
      dismissedHistory: [...this.dismissedHistory],
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Get the current (highest priority) pending suggestion
   * Priority 100 always shows first
   */
  public getCurrentSuggestion(): AISuggestion | null {
    const pending = this.suggestions
      .filter((s) => s.status === "pending")
      .sort((a, b) => {
        // Higher priority score first
        if (b.priorityScore !== a.priorityScore) {
          return b.priorityScore - a.priorityScore;
        }
        // Older suggestions first for same priority (FIFO)
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });

    return pending[0] || null;
  }

  /**
   * Get count of pending suggestions
   */
  public getPendingCount(): number {
    return this.suggestions.filter((s) => s.status === "pending").length;
  }

  /**
   * Check if there's a priority 100 suggestion that should interrupt
   */
  public hasInterruptingSuggestion(): boolean {
    const current = this.getCurrentSuggestion();
    return current !== null && current.priorityScore >= INTERRUPT_THRESHOLD;
  }

  /**
   * Sync suggestions from engine - replaces active suggestions
   * Returns true if a new interrupting (priority 100) suggestion was added
   */
  public syncFromEngine(newSuggestions: AISuggestion[]): boolean {
    const previousInterruptIds = new Set(
      this.suggestions
        .filter((s) => s.priorityScore >= INTERRUPT_THRESHOLD && s.status === "pending")
        .map((s) => s.id)
    );

    // Get dismissed IDs to filter out
    const dismissedIds = new Set(this.dismissedHistory.map((d) => d.id));

    // Filter out already dismissed suggestions
    const filteredNew = newSuggestions.filter((s) => !dismissedIds.has(s.id));

    // Replace suggestions entirely (memory-only)
    this.suggestions = filteredNew;

    // Check for new interrupting suggestions (priority 100)
    const hasNewInterrupt = this.suggestions.some(
      (s) => s.priorityScore >= INTERRUPT_THRESHOLD &&
             s.status === "pending" &&
             !previousInterruptIds.has(s.id)
    );

    this.notifyChange();
    return hasNewInterrupt;
  }

  /**
   * Mark a suggestion as actioned (auto-removes from queue)
   */
  public markActioned(suggestionId: string): void {
    const suggestion = this.suggestions.find((s) => s.id === suggestionId);
    if (!suggestion) return;

    // Add to history
    this.dismissedHistory.unshift({
      id: suggestion.id,
      type: suggestion.type,
      priority: suggestion.priority,
      message: suggestion.message,
      dismissedAt: new Date().toISOString(),
      reason: "actioned",
      studentId: suggestion.studentId,
    });

    // Remove from active
    this.suggestions = this.suggestions.filter((s) => s.id !== suggestionId);
    this.notifyChange();
  }

  /**
   * Mark a suggestion as dismissed (manual user action)
   */
  public markDismissed(suggestionId: string): void {
    const suggestion = this.suggestions.find((s) => s.id === suggestionId);
    if (!suggestion) return;

    // Add to history
    this.dismissedHistory.unshift({
      id: suggestion.id,
      type: suggestion.type,
      priority: suggestion.priority,
      message: suggestion.message,
      dismissedAt: new Date().toISOString(),
      reason: "manual",
      studentId: suggestion.studentId,
    });

    // Remove from active
    this.suggestions = this.suggestions.filter((s) => s.id !== suggestionId);
    this.notifyChange();
  }

  /**
   * Auto-remove suggestions when their condition is resolved
   */
  public resolveByCondition(conditionKey: string): void {
    const toResolve = this.suggestions.filter(
      (s) => s.relatedEntity?.conditionKey === conditionKey
    );

    toResolve.forEach((suggestion) => {
      this.dismissedHistory.unshift({
        id: suggestion.id,
        type: suggestion.type,
        priority: suggestion.priority,
        message: suggestion.message,
        dismissedAt: new Date().toISOString(),
        reason: "condition_resolved",
        studentId: suggestion.studentId,
      });
    });

    if (toResolve.length > 0) {
      this.suggestions = this.suggestions.filter(
        (s) => s.relatedEntity?.conditionKey !== conditionKey
      );
      this.notifyChange();
    }
  }

  /**
   * Resolve all suggestions related to a specific entity
   */
  public resolveByEntity(entityType: "session" | "student" | "payment", entityId: string): void {
    const toResolve = this.suggestions.filter(
      (s) =>
        s.relatedEntity?.type === entityType && s.relatedEntity?.id === entityId
    );

    toResolve.forEach((suggestion) => {
      this.dismissedHistory.unshift({
        id: suggestion.id,
        type: suggestion.type,
        priority: suggestion.priority,
        message: suggestion.message,
        dismissedAt: new Date().toISOString(),
        reason: "condition_resolved",
        studentId: suggestion.studentId,
      });
    });

    if (toResolve.length > 0) {
      this.suggestions = this.suggestions.filter(
        (s) =>
          !(s.relatedEntity?.type === entityType && s.relatedEntity?.id === entityId)
      );
      this.notifyChange();
    }
  }

  /**
   * Get dismissed history (read-only)
   */
  public getDismissedHistory(): DismissedSuggestion[] {
    return [...this.dismissedHistory];
  }

  /**
   * Clear all active suggestions (for testing/reset)
   */
  public clear(): void {
    this.suggestions = [];
    this.notifyChange();
  }
}

// Singleton instance
let queueManagerInstance: SuggestionQueueManager | null = null;

export function getSuggestionQueueManager(): SuggestionQueueManager {
  if (!queueManagerInstance) {
    queueManagerInstance = new SuggestionQueueManager();
  }
  return queueManagerInstance;
}
