// Suggestion Queue Manager
// Handles priority-based queue with single-suggestion display and auto-removal

import { AISuggestion, DismissedSuggestion, PRIORITY_ORDER } from "@/types/suggestions";

const ACTIVE_STORAGE_KEY = "ai-suggestions-active";
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
 * Critical suggestions can interrupt lower priority ones.
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
   * Load state from localStorage
   */
  private loadFromStorage(): void {
    try {
      // Load active suggestions
      const activeData = localStorage.getItem(ACTIVE_STORAGE_KEY);
      if (activeData) {
        const parsed = JSON.parse(activeData);
        this.suggestions = parsed.suggestions || [];
      }

      // Load dismissed history
      const historyData = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (historyData) {
        this.dismissedHistory = JSON.parse(historyData) || [];
      }
    } catch (error) {
      console.warn("Error loading suggestion queue from storage:", error);
      this.suggestions = [];
      this.dismissedHistory = [];
    }
  }

  /**
   * Save state to localStorage
   */
  private saveToStorage(): void {
    try {
      localStorage.setItem(
        ACTIVE_STORAGE_KEY,
        JSON.stringify({
          suggestions: this.suggestions,
          lastUpdated: new Date().toISOString(),
        })
      );
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(this.dismissedHistory));
    } catch (error) {
      console.warn("Error saving suggestion queue to storage:", error);
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
   */
  public getCurrentSuggestion(): AISuggestion | null {
    const pending = this.suggestions
      .filter((s) => s.status === "pending")
      .sort((a, b) => {
        // Sort by priority score (higher = more urgent)
        if (b.priorityScore !== a.priorityScore) {
          return b.priorityScore - a.priorityScore;
        }
        // Then by creation time (older first)
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
   * Check if there's a critical suggestion that should interrupt
   */
  public hasCriticalInterrupt(): boolean {
    const current = this.getCurrentSuggestion();
    return current?.isCritical === true;
  }

  /**
   * Sync suggestions from engine - replaces active suggestions while preserving history
   * Returns true if a new critical suggestion was added (for notification)
   */
  public syncFromEngine(newSuggestions: AISuggestion[]): boolean {
    const previousCriticalIds = new Set(
      this.suggestions.filter((s) => s.isCritical && s.status === "pending").map((s) => s.id)
    );

    // Get dismissed IDs to filter out
    const dismissedIds = new Set(this.dismissedHistory.map((d) => d.id));

    // Filter out already dismissed suggestions
    const filteredNew = newSuggestions.filter((s) => !dismissedIds.has(s.id));

    // Merge: keep existing pending status if suggestion still exists
    const existingMap = new Map(this.suggestions.map((s) => [s.id, s]));

    this.suggestions = filteredNew.map((newSug) => {
      const existing = existingMap.get(newSug.id);
      if (existing && existing.status !== "pending") {
        // Keep actioned/dismissed status
        return { ...newSug, status: existing.status };
      }
      return newSug;
    });

    // Check for new critical suggestions
    const hasNewCritical = this.suggestions.some(
      (s) => s.isCritical && s.status === "pending" && !previousCriticalIds.has(s.id)
    );

    this.notifyChange();
    return hasNewCritical;
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
   * Called when underlying data changes (e.g., session confirmed)
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
   * Clear all suggestions (for testing/reset)
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

