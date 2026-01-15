// AI Suggestions Hook
// Queue-based management with auto-removal, history tracking, and critical interrupts

import { useState, useEffect, useCallback, useRef } from "react";
import { Student, StudentPayments } from "@/types/student";
import { AISuggestion, DismissedSuggestion } from "@/types/suggestions";
import { generateSuggestions, isConditionStillValid } from "@/lib/suggestionEngine";
import { getSuggestionQueueManager, SuggestionQueueManager } from "@/lib/suggestionQueue";

const REFRESH_INTERVAL = 60 * 60 * 1000; // 1 hour in milliseconds
const CONDITION_CHECK_INTERVAL = 10 * 1000; // 10 seconds for condition checks

// Web Audio API beep for notifications
const playNotificationSound = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const audioContext = new AudioContextClass();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800; // Hz
    oscillator.type = "sine";

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  } catch (e) {
    console.warn("Could not play notification sound:", e);
  }
};

// Vibration for mobile
const triggerVibration = () => {
  try {
    if (navigator.vibrate) {
      navigator.vibrate([100, 50, 100]); // Short pattern
    }
  } catch (e) {
    console.warn("Vibration not supported:", e);
  }
};

export interface UseAISuggestionsReturn {
  // Current suggestion to display (highest priority pending)
  currentSuggestion: AISuggestion | null;
  // All pending suggestions count
  pendingCount: number;
  // All pending suggestions (for dropdown list)
  allPendingSuggestions: AISuggestion[];
  // Whether there's a critical suggestion that should interrupt
  hasCriticalInterrupt: boolean;
  // Dismissed suggestions history (read-only)
  dismissedHistory: DismissedSuggestion[];
  // Dismiss current suggestion manually
  dismissSuggestion: (id: string) => void;
  // Mark suggestion as actioned (auto-removes)
  actionSuggestion: (id: string) => void;
  // Force refresh suggestions from engine
  refreshSuggestions: () => void;
  // Resolve suggestions by entity (called when session confirmed, payment made, etc.)
  resolveByEntity: (entityType: "session" | "student" | "payment", entityId: string) => void;
  // Mark critical interrupt as seen (hides the overlay)
  dismissCriticalOverlay: () => void;
}

export function useAISuggestions(
  students: Student[],
  payments: StudentPayments[]
): UseAISuggestionsReturn {
  const queueManagerRef = useRef<SuggestionQueueManager>(getSuggestionQueueManager());

  const [currentSuggestion, setCurrentSuggestion] = useState<AISuggestion | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [allPendingSuggestions, setAllPendingSuggestions] = useState<AISuggestion[]>([]);
  const [dismissedHistory, setDismissedHistory] = useState<DismissedSuggestion[]>([]);
  const [hasCriticalInterrupt, setHasCriticalInterrupt] = useState(false);

  const isInitialLoadRef = useRef(true);
  const studentsRef = useRef(students);
  const paymentsRef = useRef(payments);

  // Keep refs updated
  useEffect(() => {
    studentsRef.current = students;
    paymentsRef.current = payments;
  }, [students, payments]);

  // Sync state from queue manager
  const syncFromQueue = useCallback(() => {
    const manager = queueManagerRef.current;
    const current = manager.getCurrentSuggestion();
    const state = manager.getState();

    setCurrentSuggestion(current);
    setPendingCount(manager.getPendingCount());
    setAllPendingSuggestions(
      state.suggestions
        .filter((s) => s.status === "pending")
        .sort((a, b) => b.priorityScore - a.priorityScore)
    );
    setDismissedHistory(manager.getDismissedHistory());

    // Check for critical interrupt
    if (current?.isCritical && !isInitialLoadRef.current) {
      setHasCriticalInterrupt(true);
    }
  }, []);

  // Generate and sync suggestions from engine
  const refreshSuggestions = useCallback(() => {
    if (studentsRef.current.length === 0) {
      setCurrentSuggestion(null);
      setPendingCount(0);
      setAllPendingSuggestions([]);
      return;
    }

    const rawSuggestions = generateSuggestions(
      studentsRef.current,
      paymentsRef.current,
      new Date()
    );

    const hasNewCritical = queueManagerRef.current.syncFromEngine(rawSuggestions);

    // Notify for new critical suggestions
    if (hasNewCritical && !isInitialLoadRef.current) {
      playNotificationSound();
      triggerVibration();
      setHasCriticalInterrupt(true);
    }

    isInitialLoadRef.current = false;
    syncFromQueue();
  }, [syncFromQueue]);

  // Check conditions and auto-remove resolved suggestions
  const checkConditions = useCallback(() => {
    const manager = queueManagerRef.current;
    const state = manager.getState();

    state.suggestions.forEach((suggestion) => {
      if (suggestion.relatedEntity && suggestion.status === "pending") {
        const isValid = isConditionStillValid(
          suggestion.relatedEntity.conditionKey,
          studentsRef.current,
          paymentsRef.current
        );

        if (!isValid) {
          manager.resolveByCondition(suggestion.relatedEntity.conditionKey);
        }
      }
    });

    syncFromQueue();
  }, [syncFromQueue]);

  // Dismiss suggestion manually
  const dismissSuggestion = useCallback((id: string) => {
    queueManagerRef.current.markDismissed(id);
    syncFromQueue();

    // Hide critical overlay if we dismissed the critical suggestion
    const current = queueManagerRef.current.getCurrentSuggestion();
    if (!current?.isCritical) {
      setHasCriticalInterrupt(false);
    }
  }, [syncFromQueue]);

  // Mark suggestion as actioned
  const actionSuggestion = useCallback((id: string) => {
    queueManagerRef.current.markActioned(id);
    syncFromQueue();

    // Hide critical overlay
    const current = queueManagerRef.current.getCurrentSuggestion();
    if (!current?.isCritical) {
      setHasCriticalInterrupt(false);
    }
  }, [syncFromQueue]);

  // Resolve by entity type
  const resolveByEntity = useCallback((
    entityType: "session" | "student" | "payment",
    entityId: string
  ) => {
    queueManagerRef.current.resolveByEntity(entityType, entityId);
    syncFromQueue();
  }, [syncFromQueue]);

  // Dismiss critical overlay without dismissing the suggestion
  const dismissCriticalOverlay = useCallback(() => {
    setHasCriticalInterrupt(false);
  }, []);

  // Subscribe to queue changes
  useEffect(() => {
    queueManagerRef.current.onChange(syncFromQueue);
  }, [syncFromQueue]);

  // Initial load and data change trigger
  useEffect(() => {
    refreshSuggestions();
  }, [students, payments, refreshSuggestions]);

  // Periodic refresh every 1 hour
  useEffect(() => {
    const intervalId = setInterval(() => {
      refreshSuggestions();
    }, REFRESH_INTERVAL);

    return () => clearInterval(intervalId);
  }, [refreshSuggestions]);

  // Condition check every 10 seconds
  useEffect(() => {
    const intervalId = setInterval(() => {
      checkConditions();
    }, CONDITION_CHECK_INTERVAL);

    return () => clearInterval(intervalId);
  }, [checkConditions]);

  return {
    currentSuggestion,
    pendingCount,
    allPendingSuggestions,
    hasCriticalInterrupt,
    dismissedHistory,
    dismissSuggestion,
    actionSuggestion,
    refreshSuggestions,
    resolveByEntity,
    dismissCriticalOverlay,
  };
}

