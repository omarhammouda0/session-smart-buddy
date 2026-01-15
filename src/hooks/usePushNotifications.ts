// Push Notifications Hook
// Manages FCM token registration and foreground message handling
// Uses dynamic imports to handle cases where Firebase is not configured

import { useState, useEffect, useCallback } from "react";
import { firebaseConfig, vapidKey, isFirebaseConfigured } from "@/lib/firebaseConfig";
import { toast } from "@/hooks/use-toast";

// Get Supabase URL and key from environment
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

interface PushNotificationState {
  isSupported: boolean;
  isEnabled: boolean;
  token: string | null;
  permission: NotificationPermission;
  isConfigured: boolean;
}

// Helper to save FCM token to database via REST API
async function saveFcmToken(token: string, deviceInfo: object): Promise<boolean> {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Prefer": "resolution=merge-duplicates"
      },
      body: JSON.stringify({
        user_id: "default",
        fcm_token: token,
        device_info: deviceInfo,
        is_active: true,
        last_used_at: new Date().toISOString()
      })
    });
    return response.ok;
  } catch (error) {
    console.error("Failed to save FCM token:", error);
    return false;
  }
}

// Helper to deactivate FCM token
async function deactivateFcmToken(token: string): Promise<boolean> {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/push_subscriptions?fcm_token=eq.${encodeURIComponent(token)}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_KEY,
          "Authorization": `Bearer ${SUPABASE_KEY}`
        },
        body: JSON.stringify({ is_active: false })
      }
    );
    return response.ok;
  } catch (error) {
    console.error("Failed to deactivate FCM token:", error);
    return false;
  }
}

// Helper function to play notification sound
function playNotificationSound() {
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
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  } catch (e) {
    console.warn("Could not play notification sound:", e);
  }
}

export function usePushNotifications() {
  const [state, setState] = useState<PushNotificationState>({
    isSupported: false,
    isEnabled: false,
    token: null,
    permission: "default",
    isConfigured: false
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [messaging, setMessaging] = useState<any>(null);

  // Check if push notifications are supported and Firebase is configured
  useEffect(() => {
    const checkSupport = async () => {
      const browserSupported =
        "Notification" in window &&
        "serviceWorker" in navigator &&
        "PushManager" in window;

      const firebaseReady = isFirebaseConfigured();

      setState(prev => ({
        ...prev,
        isSupported: browserSupported,
        isConfigured: firebaseReady,
        permission: browserSupported ? Notification.permission : "denied"
      }));

      if (browserSupported && firebaseReady) {
        try {
          // Dynamic import Firebase to avoid errors when not configured
          const { initializeApp, getApps, getApp } = await import("firebase/app");
          const { getMessaging, onMessage } = await import("firebase/messaging");
          
          // Initialize Firebase
          const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
          const messagingInstance = getMessaging(app);
          setMessaging(messagingInstance);

          // Set up foreground message handler
          onMessage(messagingInstance, (payload) => {
            console.log("Foreground message received:", payload);
            
            // Show toast for foreground messages
            toast({
              title: payload.notification?.title || "تنبيه جديد",
              description: payload.notification?.body || "",
              duration: payload.data?.priority === "100" ? 10000 : 5000,
            });

            // Play sound for priority 100
            if (payload.data?.priority === "100") {
              playNotificationSound();
            }
          });

          // Check if already has permission and token
          if (Notification.permission === "granted") {
            const existingToken = localStorage.getItem("fcm_token");
            if (existingToken) {
              setState(prev => ({
                ...prev,
                isEnabled: true,
                token: existingToken,
                permission: "granted"
              }));
            }
          }
        } catch (error) {
          console.error("Failed to initialize Firebase:", error);
          setState(prev => ({ ...prev, isConfigured: false }));
        }
      }
    };

    checkSupport();
  }, []);

  // Handle messages from service worker (notification clicks)
  useEffect(() => {
    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type === "NOTIFICATION_CLICK") {
        console.log("Notification clicked:", event.data);
        const { targetUrl } = event.data;
        if (targetUrl && targetUrl !== "/") {
          window.location.href = targetUrl;
        }
      }
    };

    navigator.serviceWorker?.addEventListener("message", handleServiceWorkerMessage);
    return () => {
      navigator.serviceWorker?.removeEventListener("message", handleServiceWorkerMessage);
    };
  }, []);

  // Request permission and get token
  const enableNotifications = useCallback(async (): Promise<boolean> => {
    // Check if Firebase is configured
    if (!state.isConfigured) {
      toast({
        title: "غير مُهيأ",
        description: "إعدادات Firebase غير مكتملة. يرجى إضافة VITE_FIREBASE_API_KEY و VITE_FIREBASE_MESSAGING_SENDER_ID و VITE_FIREBASE_APP_ID",
        variant: "destructive",
        duration: 10000
      });
      console.error("Firebase not configured. Required env vars: VITE_FIREBASE_API_KEY, VITE_FIREBASE_MESSAGING_SENDER_ID, VITE_FIREBASE_APP_ID");
      return false;
    }

    if (!state.isSupported) {
      toast({
        title: "غير مدعوم",
        description: "الإشعارات غير مدعومة في هذا المتصفح",
        variant: "destructive"
      });
      return false;
    }

    if (!messaging) {
      toast({
        title: "خطأ",
        description: "Firebase لم يتم تهيئته بشكل صحيح",
        variant: "destructive"
      });
      return false;
    }

    try {
      // Request permission
      const permission = await Notification.requestPermission();

      if (permission !== "granted") {
        setState(prev => ({ ...prev, permission }));
        toast({
          title: "تم الرفض",
          description: "لم يتم السماح بالإشعارات",
          variant: "destructive"
        });
        return false;
      }

      // Register service worker
      const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
      console.log("Service Worker registered:", registration);

      // Dynamic import getToken
      const { getToken } = await import("firebase/messaging");
      
      // Get FCM token
      const token = await getToken(messaging, {
        vapidKey,
        serviceWorkerRegistration: registration
      });

      if (!token) {
        toast({
          title: "خطأ",
          description: "فشل في الحصول على رمز الإشعارات",
          variant: "destructive"
        });
        return false;
      }

      console.log("FCM Token obtained:", token.substring(0, 20) + "...");

      // Save token to database
      const deviceInfo = {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        timestamp: new Date().toISOString()
      };

      await saveFcmToken(token, deviceInfo);

      // Save to localStorage for quick access
      localStorage.setItem("fcm_token", token);

      setState(prev => ({
        ...prev,
        isEnabled: true,
        token,
        permission: "granted"
      }));

      toast({
        title: "تم التفعيل ✓",
        description: "سيتم إرسال إشعارات حتى عند إغلاق التطبيق"
      });

      return true;
    } catch (error) {
      console.error("Failed to enable notifications:", error);
      toast({
        title: "خطأ",
        description: `فشل في تفعيل الإشعارات: ${error instanceof Error ? error.message : 'خطأ غير معروف'}`,
        variant: "destructive"
      });
      return false;
    }
  }, [state.isSupported, state.isConfigured, messaging]);

  // Disable notifications
  const disableNotifications = useCallback(async () => {
    const token = state.token || localStorage.getItem("fcm_token");

    if (token) {
      await deactivateFcmToken(token);
      localStorage.removeItem("fcm_token");
    }

    setState(prev => ({
      ...prev,
      isEnabled: false,
      token: null
    }));

    toast({
      title: "تم الإيقاف",
      description: "لن تتلقى إشعارات عند إغلاق التطبيق"
    });
  }, [state.token]);

  return {
    ...state,
    enableNotifications,
    disableNotifications
  };
}

