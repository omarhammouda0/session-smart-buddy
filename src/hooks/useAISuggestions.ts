// AI Suggestions Hook
// Manages suggestion generation, dismissal, and notifications

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Student, StudentPayments } from "@/types/student";
import { AISuggestion, PRIORITY_ORDER } from "@/types/suggestions";
import { generateSuggestions } from "@/lib/suggestionEngine";
import { format } from "date-fns";

const STORAGE_KEY = "ai-suggestions-dismissed";
const LAST_RUN_KEY = "ai-suggestions-last-run";
const REFRESH_INTERVAL = 60 * 60 * 1000; // 1 hour in milliseconds

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

interface UseAISuggestionsReturn {
  suggestions: AISuggestion[];
  hasNewCritical: boolean;
  dismissSuggestion: (id: string) => void;
  refreshSuggestions: () => void;
  markAllAsRead: () => void;
}

export function useAISuggestions(
  students: Student[],
  payments: StudentPayments[]
): UseAISuggestionsReturn {
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: { date: string; ids: string[] } = JSON.parse(stored);
        const today = format(new Date(), "yyyy-MM-dd");
        // Clear dismissed list if it's a new day
        if (parsed.date === today) {
          return new Set(parsed.ids);
        }
      }
      return new Set();
    } catch {
      return new Set();
    }
  });

  const [hasNewCritical, setHasNewCritical] = useState(false);
  const previousSuggestionsRef = useRef<string[]>([]);
  const isInitialLoadRef = useRef(true);

  // Save dismissed IDs to localStorage
  const saveDismissed = useCallback((ids: Set<string>) => {
    const today = format(new Date(), "yyyy-MM-dd");
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: today, ids: Array.from(ids) }));
  }, []);

  // Dismiss a suggestion
  const dismissSuggestion = useCallback((id: string) => {
    setDismissedIds((prev) => {
      const updated = new Set(prev);
      updated.add(id);
      saveDismissed(updated);
      return updated;
    });
  }, [saveDismissed]);

  // Generate and filter suggestions
  const refreshSuggestions = useCallback(() => {
    if (students.length === 0) {
      setSuggestions([]);
      return;
    }

    const currentTime = new Date();
    const rawSuggestions = generateSuggestions(students, payments, currentTime);

    // Filter out dismissed suggestions
    const filtered = rawSuggestions.filter((s) => !dismissedIds.has(s.id));

    // Check for new critical/high priority suggestions
    const newIds = filtered.map((s) => s.id);
    const previousIds = previousSuggestionsRef.current;

    if (!isInitialLoadRef.current) {
      const newCriticalSuggestions = filtered.filter(
        (s) =>
          (s.priority === "critical" || s.priority === "high") &&
          !previousIds.includes(s.id)
      );

      if (newCriticalSuggestions.length > 0) {
        setHasNewCritical(true);
        playNotificationSound();
        triggerVibration();
      }
    }

    isInitialLoadRef.current = false;
    previousSuggestionsRef.current = newIds;
    setSuggestions(filtered);

    // Save last run time
    localStorage.setItem(LAST_RUN_KEY, currentTime.toISOString());
  }, [students, payments, dismissedIds]);

  // Mark all as read (clears the "new" indicator)
  const markAllAsRead = useCallback(() => {
    setHasNewCritical(false);
  }, []);

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

  // Sort suggestions by priority
  const sortedSuggestions = useMemo(() => {
    return [...suggestions].sort((a, b) => {
      const priorityDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [suggestions]);

  return {
    suggestions: sortedSuggestions,
    hasNewCritical,
    dismissSuggestion,
    refreshSuggestions,
    markAllAsRead,
  };
}

