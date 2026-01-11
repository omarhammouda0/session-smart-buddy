import { useState, useEffect, useCallback } from "react";
import { Student, Session } from "@/types/student";
import { format, differenceInMinutes } from "date-fns";
import { toast } from "@/hooks/use-toast";

interface UpcomingSession {
  session: Session;
  student: Student;
  minutesUntil: number;
}

interface EndedSession {
  session: Session;
  student: Student;
  minutesSinceEnd: number;
}

interface NotificationSettings {
  enabled: boolean;
  minutesBefore: number; // Default 60 minutes (1 hour)
  soundEnabled: boolean;
}

const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: true,
  minutesBefore: 60,
  soundEnabled: true,
};

const NOTIFICATION_STORAGE_KEY = "session-notifications-settings";
const NOTIFIED_SESSIONS_KEY = "session-notifications-notified";
const ENDED_SESSIONS_KEY = "session-ended-notified";

export function useSessionNotifications(students: Student[]) {
  const [settings, setSettings] = useState<NotificationSettings>(() => {
    try {
      const stored = localStorage.getItem(NOTIFICATION_STORAGE_KEY);
      return stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  const [upcomingNotification, setUpcomingNotification] = useState<UpcomingSession | null>(null);
  const [endedSessionNotification, setEndedSessionNotification] = useState<EndedSession | null>(null);

  const [notifiedSessions, setNotifiedSessions] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(NOTIFIED_SESSIONS_KEY);
      const today = format(new Date(), "yyyy-MM-dd");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.date === today) {
          return new Set(parsed.sessions);
        }
      }
      return new Set();
    } catch {
      return new Set();
    }
  });

  const [endedNotifiedSessions, setEndedNotifiedSessions] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(ENDED_SESSIONS_KEY);
      const today = format(new Date(), "yyyy-MM-dd");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.date === today) {
          return new Set(parsed.sessions);
        }
      }
      return new Set();
    } catch {
      return new Set();
    }
  });


  // Request browser notification permission
  const requestNotificationPermission = useCallback(async () => {
    if ("Notification" in window && Notification.permission === "default") {
      await Notification.requestPermission();
    }
  }, []);

  // Update settings
  const updateSettings = useCallback((newSettings: Partial<NotificationSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Mark session as notified
  const markAsNotified = useCallback((sessionId: string) => {
    setNotifiedSessions((prev) => {
      const updated = new Set(prev);
      updated.add(sessionId);
      localStorage.setItem(
        NOTIFIED_SESSIONS_KEY,
        JSON.stringify({
          date: format(new Date(), "yyyy-MM-dd"),
          sessions: Array.from(updated),
        })
      );
      return updated;
    });
  }, []);

  // Mark ended session as notified
  const markEndedAsNotified = useCallback((sessionId: string) => {
    setEndedNotifiedSessions((prev) => {
      const updated = new Set(prev);
      updated.add(sessionId);
      localStorage.setItem(
        ENDED_SESSIONS_KEY,
        JSON.stringify({
          date: format(new Date(), "yyyy-MM-dd"),
          sessions: Array.from(updated),
        })
      );
      return updated;
    });
  }, []);

  // Dismiss notification
  const dismissNotification = useCallback(() => {
    if (upcomingNotification) {
      markAsNotified(upcomingNotification.session.id);
      setUpcomingNotification(null);
    }
  }, [upcomingNotification, markAsNotified]);

  // Dismiss ended session notification
  const dismissEndedNotification = useCallback(() => {
    if (endedSessionNotification) {
      markEndedAsNotified(endedSessionNotification.session.id);
      setEndedSessionNotification(null);
    }
  }, [endedSessionNotification, markEndedAsNotified]);

  // Play notification sound
  const playNotificationSound = useCallback(() => {
    if (settings.soundEnabled) {
      try {
        // Create a simple beep sound using Web Audio API
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const audioContext = new AudioContextClass();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = 800;
        oscillator.type = "sine";

        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
      } catch (e) {
        console.log("Could not play notification sound:", e);
      }
    }
  }, [settings.soundEnabled]);

  // Send browser notification
  const sendBrowserNotification = useCallback(
    (student: Student, session: Session, minutesUntil: number) => {
      if ("Notification" in window && Notification.permission === "granted") {
        const sessionTime = session.time || student.sessionTime || "16:00";
        const notification = new Notification("تذكير بالحصة القادمة 📚", {
          body: `حصة ${student.name} بعد ${minutesUntil < 60 ? `${minutesUntil} دقيقة` : "ساعة"} (${sessionTime})`,
          icon: "/favicon.ico",
          tag: `session-${session.id}`,
          requireInteraction: true,
        });

        notification.onclick = () => {
          window.focus();
          notification.close();
        };
      }
    },
    []
  );

  // Check for upcoming sessions
  useEffect(() => {
    if (!settings.enabled) return;

    const checkUpcomingSessions = () => {
      const now = new Date();
      const todayStr = format(now, "yyyy-MM-dd");

      // Get all today's scheduled sessions
      const todaySessions: UpcomingSession[] = [];

      students.forEach((student) => {
        student.sessions
          .filter((s) => s.date === todayStr && s.status === "scheduled")
          .forEach((session) => {
            const sessionTime = session.time || student.sessionTime || "16:00";
            const [hours, minutes] = sessionTime.split(":").map(Number);
            const sessionDateTime = new Date(now);
            sessionDateTime.setHours(hours, minutes, 0, 0);

            const minutesUntil = differenceInMinutes(sessionDateTime, now);

            // Check if within notification window and not already notified
            if (
              minutesUntil > 0 &&
              minutesUntil <= settings.minutesBefore &&
              !notifiedSessions.has(session.id)
            ) {
              todaySessions.push({ session, student, minutesUntil });
            }
          });
      });

      // Sort by time and get the closest one
      todaySessions.sort((a, b) => a.minutesUntil - b.minutesUntil);

      if (todaySessions.length > 0 && !upcomingNotification) {
        const closest = todaySessions[0];
        setUpcomingNotification(closest);
        playNotificationSound();
        sendBrowserNotification(closest.student, closest.session, closest.minutesUntil);

        // Show toast notification
        toast({
          title: "🔔 تذكير بالحصة القادمة",
          description: `حصة ${closest.student.name} بعد ${
            closest.minutesUntil < 60 ? `${closest.minutesUntil} دقيقة` : "ساعة"
          }`,
          duration: 10000,
        });
      }
    };

    // Check immediately
    checkUpcomingSessions();

    // Check every minute
    const interval = setInterval(checkUpcomingSessions, 60000);

    return () => clearInterval(interval);
  }, [
    students,
    settings.enabled,
    settings.minutesBefore,
    notifiedSessions,
    upcomingNotification,
    playNotificationSound,
    sendBrowserNotification,
  ]);

  // Check for ended sessions (session time + duration has passed)
  useEffect(() => {
    if (!settings.enabled) return;

    const checkEndedSessions = () => {
      const now = new Date();
      const todayStr = format(now, "yyyy-MM-dd");

      // Get all today's scheduled sessions that have ended
      const endedSessions: EndedSession[] = [];

      students.forEach((student) => {
        student.sessions
          .filter((s) => s.date === todayStr && s.status === "scheduled")
          .forEach((session) => {
            const sessionTime = session.time || student.sessionTime || "16:00";
            const [hours, minutes] = sessionTime.split(":").map(Number);
            const sessionStartTime = new Date(now);
            sessionStartTime.setHours(hours, minutes, 0, 0);

            // Calculate session end time (start time + duration)
            const sessionDuration = session.duration || student.sessionDuration || 60;
            const sessionEndTime = new Date(sessionStartTime.getTime() + sessionDuration * 60000);

            const minutesSinceEnd = differenceInMinutes(now, sessionEndTime);

            // Check if session has ended (0-30 minutes after end time) and not already notified
            if (
              minutesSinceEnd >= 0 &&
              minutesSinceEnd <= 30 &&
              !endedNotifiedSessions.has(session.id)
            ) {
              endedSessions.push({ session, student, minutesSinceEnd });
            }
          });
      });

      // Sort by end time and get the one that ended most recently
      endedSessions.sort((a, b) => a.minutesSinceEnd - b.minutesSinceEnd);

      if (endedSessions.length > 0 && !endedSessionNotification) {
        const ended = endedSessions[0];
        setEndedSessionNotification(ended);
        playNotificationSound();

        // Send browser notification
        if ("Notification" in window && Notification.permission === "granted") {
          const notification = new Notification("⏰ انتهت الحصة", {
            body: `حصة ${ended.student.name} انتهت. هل تريد تأكيد حالة الحصة؟`,
            icon: "/favicon.ico",
            tag: `session-ended-${ended.session.id}`,
            requireInteraction: true,
          });

          notification.onclick = () => {
            window.focus();
            notification.close();
          };
        }

        // Show toast notification
        toast({
          title: "⏰ انتهت الحصة",
          description: `حصة ${ended.student.name} انتهت. يرجى تأكيد حالة الحصة.`,
          duration: 15000,
        });
      }
    };

    // Check immediately
    checkEndedSessions();

    // Check every minute
    const interval = setInterval(checkEndedSessions, 60000);

    return () => clearInterval(interval);
  }, [
    students,
    settings.enabled,
    endedNotifiedSessions,
    endedSessionNotification,
    playNotificationSound,
  ]);

  // Request notification permission on mount
  useEffect(() => {
    requestNotificationPermission();
  }, [requestNotificationPermission]);

  return {
    settings,
    updateSettings,
    upcomingNotification,
    dismissNotification,
    endedSessionNotification,
    dismissEndedNotification,
    requestNotificationPermission,
  };
}

