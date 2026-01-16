// Session Notifications Hook - Database Synced Version
// Handles in-app session notifications with settings stored in database

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
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
  minutesBefore: number;
  soundEnabled: boolean;
}

const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: true,
  minutesBefore: 60,
  soundEnabled: true,
};

// Local storage keys for tracking notified sessions (resets daily)
const NOTIFIED_SESSIONS_KEY = "session-notifications-notified";
const ENDED_SESSIONS_KEY = "session-ended-notified";

export function useSessionNotifications(students: Student[]) {
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const [upcomingNotification, setUpcomingNotification] = useState<UpcomingSession | null>(null);
  const [endedSessionNotification, setEndedSessionNotification] = useState<EndedSession | null>(null);

  // Notified sessions tracking (stays in localStorage - resets daily)
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

  // Get current user ID
  const getUserId = useCallback(async (): Promise<string | null> => {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      console.error("Auth error:", error);
      return null;
    }
    return data.user?.id ?? null;
  }, []);

  // Load settings from database
  const loadSettings = useCallback(async (uid: string) => {
    try {
      const { data, error } = await supabase
        .from("notification_settings")
        .select("*")
        .eq("user_id", uid)
        .maybeSingle();

      if (error) {
        console.error("Error loading notification settings:", error);
        setIsLoadingSettings(false);
        return;
      }

      if (data) {
        setSettings({
          enabled: data.session_notifications_enabled ?? true,
          minutesBefore: data.session_notification_minutes_before ?? 60,
          soundEnabled: data.session_notification_sound_enabled ?? true,
        });
      }
    } catch (error) {
      console.error("Error loading notification settings:", error);
    } finally {
      setIsLoadingSettings(false);
    }
  }, []);

  // Initialize - load settings from database
  useEffect(() => {
    const init = async () => {
      const uid = await getUserId();
      if (uid) {
        setUserId(uid);
        await loadSettings(uid);
      } else {
        setIsLoadingSettings(false);
      }
    };
    init();
  }, [getUserId, loadSettings]);

  // Request browser notification permission
  const requestNotificationPermission = useCallback(async () => {
    if ("Notification" in window && Notification.permission === "default") {
      await Notification.requestPermission();
    }
  }, []);

  // Update settings (save to database)
  const updateSettings = useCallback(async (newSettings: Partial<NotificationSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);

    // Save to database if we have userId
    const currentUserId = userId || await getUserId();
    if (currentUserId) {
      try {
        const { error } = await supabase
          .from("notification_settings")
          .upsert({
            user_id: currentUserId,
            session_notifications_enabled: updated.enabled,
            session_notification_minutes_before: updated.minutesBefore,
            session_notification_sound_enabled: updated.soundEnabled,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: "user_id",
          });

        if (error) {
          console.error("Error saving notification settings:", error);
          toast({
            title: "خطأ",
            description: "فشل حفظ الإعدادات",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("Error saving notification settings:", error);
        toast({
          title: "خطأ",
          description: "فشل حفظ الإعدادات",
          variant: "destructive",
        });
      }
    }
  }, [settings, userId, getUserId]);

  // Mark session as notified (stays in localStorage)
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

  // Mark ended session as notified (stays in localStorage)
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
    if (!settings.enabled || isLoadingSettings) return;

    const checkUpcomingSessions = () => {
      const now = new Date();
      const todayStr = format(now, "yyyy-MM-dd");

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

            if (
              minutesUntil > 0 &&
              minutesUntil <= settings.minutesBefore &&
              !notifiedSessions.has(session.id)
            ) {
              todaySessions.push({ session, student, minutesUntil });
            }
          });
      });

      todaySessions.sort((a, b) => a.minutesUntil - b.minutesUntil);

      if (todaySessions.length > 0 && !upcomingNotification) {
        const closest = todaySessions[0];
        setUpcomingNotification(closest);
        playNotificationSound();
        sendBrowserNotification(closest.student, closest.session, closest.minutesUntil);

        toast({
          title: "🔔 تذكير بالحصة القادمة",
          description: `حصة ${closest.student.name} بعد ${
            closest.minutesUntil < 60 ? `${closest.minutesUntil} دقيقة` : "ساعة"
          }`,
          duration: 10000,
        });
      }
    };

    checkUpcomingSessions();
    const interval = setInterval(checkUpcomingSessions, 60000);
    return () => clearInterval(interval);
  }, [
    students,
    settings.enabled,
    settings.minutesBefore,
    isLoadingSettings,
    notifiedSessions,
    upcomingNotification,
    playNotificationSound,
    sendBrowserNotification,
  ]);

  // Check for ended sessions
  useEffect(() => {
    if (!settings.enabled || isLoadingSettings) return;

    const checkEndedSessions = () => {
      const now = new Date();
      const todayStr = format(now, "yyyy-MM-dd");

      const endedSessions: EndedSession[] = [];

      students.forEach((student) => {
        student.sessions
          .filter((s) => s.date === todayStr && s.status === "scheduled")
          .forEach((session) => {
            const sessionTime = session.time || student.sessionTime || "16:00";
            const [hours, minutes] = sessionTime.split(":").map(Number);
            const sessionStartTime = new Date(now);
            sessionStartTime.setHours(hours, minutes, 0, 0);

            const sessionDuration = session.duration || student.sessionDuration || 60;
            const sessionEndTime = new Date(sessionStartTime.getTime() + sessionDuration * 60000);

            const minutesSinceEnd = differenceInMinutes(now, sessionEndTime);

            if (
              minutesSinceEnd >= 0 &&
              minutesSinceEnd <= 30 &&
              !endedNotifiedSessions.has(session.id)
            ) {
              endedSessions.push({ session, student, minutesSinceEnd });
            }
          });
      });

      endedSessions.sort((a, b) => a.minutesSinceEnd - b.minutesSinceEnd);

      if (endedSessions.length > 0 && !endedSessionNotification) {
        const ended = endedSessions[0];
        setEndedSessionNotification(ended);
        playNotificationSound();

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

        toast({
          title: "⏰ انتهت الحصة",
          description: `حصة ${ended.student.name} انتهت. يرجى تأكيد حالة الحصة.`,
          duration: 15000,
        });
      }
    };

    checkEndedSessions();
    const interval = setInterval(checkEndedSessions, 60000);
    return () => clearInterval(interval);
  }, [
    students,
    settings.enabled,
    isLoadingSettings,
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
    isLoadingSettings,
  };
}

