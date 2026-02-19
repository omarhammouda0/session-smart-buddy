// Push Notifications Hook
// Manages FCM token registration and foreground message handling
// Uses dynamic imports to handle cases where Firebase is not configured
// UPDATED: Now properly handles multi-user authentication

import { useState, useEffect, useCallback } from "react";
import { firebaseConfig, vapidKey, isFirebaseConfigured } from "@/lib/firebaseConfig";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

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

// Helper to get current user ID
async function getCurrentUserId(): Promise<string | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    console.error("Auth error:", error);
    return null;
  }
  return data.user?.id ?? null;
}

// Helper to get the current session's access token for authenticated API calls
async function getAccessToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || SUPABASE_KEY;
}

// Helper to save or reactivate FCM token in database
async function saveFcmToken(token: string, deviceInfo: object, userId: string): Promise<boolean> {
  try {
    console.log("Saving FCM token for user:", userId);
    console.log("Token (first 30 chars):", token.substring(0, 30));

    const accessToken = await getAccessToken();

    // Always update the token first to reactivate it if it exists
    const updateResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/push_subscriptions?fcm_token=eq.${encodeURIComponent(token)}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_KEY,
          "Authorization": `Bearer ${accessToken}`,
          "Prefer": "return=representation"
        },
        body: JSON.stringify({
          user_id: userId,
          device_info: deviceInfo,
          is_active: true,
          last_used_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
      }
    );

    const updateData = await updateResponse.json();
    console.log("Update response:", updateResponse.status, updateData);

    // If update returned data, the token was updated successfully
    if (Array.isArray(updateData) && updateData.length > 0) {
      console.log("FCM token reactivated successfully");
      return true;
    }

    // Token doesn't exist, try to insert
    console.log("Token not found, inserting new...");
    const insertResponse = await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${accessToken}`,
        "Prefer": "return=representation"
      },
      body: JSON.stringify({
        user_id: userId,
        fcm_token: token,
        device_info: deviceInfo,
        is_active: true,
        last_used_at: new Date().toISOString()
      })
    });

    const insertData = await insertResponse.json();
    console.log("Insert response:", insertResponse.status, insertData);

    if (insertResponse.ok || insertResponse.status === 201) {
      console.log("FCM token inserted successfully");
      return true;
    }

    // 409 conflict means token exists - try update again
    if (insertResponse.status === 409) {
      console.log("Token exists (conflict), forcing update...");
      const forceUpdate = await fetch(
        `${SUPABASE_URL}/rest/v1/push_subscriptions?fcm_token=eq.${encodeURIComponent(token)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "apikey": SUPABASE_KEY,
            "Authorization": `Bearer ${accessToken}`
          },
          body: JSON.stringify({
            is_active: true,
            updated_at: new Date().toISOString()
          })
        }
      );
      console.log("Force update response:", forceUpdate.status);
      return forceUpdate.ok;
    }

    console.error("Failed to save FCM token");
    return false;
  } catch (error) {
    console.error("Failed to save FCM token:", error);
    return false;
  }
}

// Helper to deactivate FCM token
async function deactivateFcmToken(token: string): Promise<boolean> {
  try {
    const accessToken = await getAccessToken();
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/push_subscriptions?fcm_token=eq.${encodeURIComponent(token)}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_KEY,
          "Authorization": `Bearer ${accessToken}`
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
    oscillator.onended = () => audioContext.close();
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
    let mounted = true;
    let unsubscribeOnMessage: (() => void) | null = null;
    
    const checkSupport = async () => {
      try {
        const browserSupported =
          "Notification" in window &&
          "serviceWorker" in navigator &&
          "PushManager" in window;

        const firebaseReady = isFirebaseConfigured();

        if (!mounted) return;

        setState(prev => ({
          ...prev,
          isSupported: browserSupported,
          isConfigured: firebaseReady,
          permission: browserSupported ? Notification.permission : "denied"
        }));

        if (browserSupported && firebaseReady) {
          // Delay Firebase initialization on mobile to prevent race conditions with auth
          const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
          if (isMobile) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }

          if (!mounted) return;

          try {
            // Dynamic import Firebase to avoid errors when not configured
            const { initializeApp, getApps, getApp } = await import("firebase/app");
            const { getMessaging, onMessage } = await import("firebase/messaging");

            if (!mounted) return;

            // Initialize Firebase
            const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
            const messagingInstance = getMessaging(app);

            if (!mounted) return;
            setMessaging(messagingInstance);

            // Foreground message handler - shows notification when app is in foreground
            // Wrapped in try-catch for mobile stability
            try {
              unsubscribeOnMessage = onMessage(messagingInstance, (payload) => {
                try {
                  console.log("Foreground push notification received:", payload?.notification?.title);
                  const { title, body } = payload.notification || {};
                  if (title && Notification.permission === "granted") {
                    // Show notification via the Notification API for foreground messages
                    new Notification(title, {
                      body: body || "",
                      icon: "/icons/icon-192x192.png",
                      dir: "rtl",
                      lang: "ar",
                    });
                  }
                } catch (handlerErr) {
                  // Silently ignore handler errors to prevent crashes
                  console.warn("Error handling foreground notification:", handlerErr);
                }
              });
            } catch (onMsgErr) {
              console.warn("Could not set up foreground message handler:", onMsgErr);
            }

            console.log("Firebase messaging initialized with foreground handler");

            // Check if already has permission and token - auto-refresh token
            if (mounted && Notification.permission === "granted") {
              const existingToken = localStorage.getItem("fcm_token");
              if (existingToken) {
                setState(prev => ({
                  ...prev,
                  isEnabled: true,
                  token: existingToken,
                  permission: "granted"
                }));

                // Auto-refresh token in background to ensure it's still valid
                // This helps recover from stale tokens
                (async () => {
                  try {
                    const registration = await navigator.serviceWorker.ready;
                    const { getToken } = await import("firebase/messaging");
                    const newToken = await getToken(messagingInstance, {
                      vapidKey,
                      serviceWorkerRegistration: registration
                    });

                    if (newToken && newToken !== existingToken) {
                      console.log("FCM Token refreshed (was different)");
                      localStorage.setItem("fcm_token", newToken);

                      // Update in database
                      const userId = await getCurrentUserId();
                      if (userId) {
                        const deviceInfo = {
                          userAgent: navigator.userAgent,
                          platform: navigator.platform,
                          language: navigator.language,
                          timestamp: new Date().toISOString(),
                          refreshed: true
                        };
                        await saveFcmToken(newToken, deviceInfo, userId);

                        // Deactivate old token
                        await deactivateFcmToken(existingToken);
                      }

                      if (mounted) {
                        setState(prev => ({ ...prev, token: newToken }));
                      }
                    } else if (newToken) {
                      // Token is the same, but re-register to ensure it's active in DB
                      const userId = await getCurrentUserId();
                      if (userId) {
                        const deviceInfo = {
                          userAgent: navigator.userAgent,
                          platform: navigator.platform,
                          language: navigator.language,
                          timestamp: new Date().toISOString(),
                          reactivated: true
                        };
                        await saveFcmToken(newToken, deviceInfo, userId);
                        console.log("FCM Token reactivated in database");
                      }
                    }
                  } catch (refreshError) {
                    console.warn("Failed to refresh FCM token:", refreshError);
                  }
                })();
              }
            }
          } catch (error) {
            console.error("Failed to initialize Firebase:", error);
            if (mounted) {
              setState(prev => ({ ...prev, isConfigured: false }));
            }
          }
        }
      } catch (error) {
        console.error("Error in push notification setup:", error);
      }
    };

    checkSupport();

    return () => {
      mounted = false;
      if (unsubscribeOnMessage) unsubscribeOnMessage();
    };
  }, []);

  // Handle messages from service worker (notification clicks)
  useEffect(() => {
    const handleServiceWorkerMessage = (event: MessageEvent) => {
      try {
        if (event.data?.type === "NOTIFICATION_CLICK") {
          console.log("Notification clicked:", event.data);
          const { targetUrl } = event.data;

          // Only navigate if we have a meaningful URL that's not just root
          if (targetUrl && targetUrl !== "/" && targetUrl.length > 1) {
            // Use a safe navigation approach - store in sessionStorage for the app to handle
            // This prevents full page reloads that cause blank screens on mobile
            try {
              sessionStorage.setItem("pending_notification_action", JSON.stringify({
                url: targetUrl,
                data: event.data.data,
                action: event.data.action,
                timestamp: Date.now()
              }));

              // Dispatch custom event for app to handle
              window.dispatchEvent(new CustomEvent("notification-action", {
                detail: {
                  url: targetUrl,
                  data: event.data.data,
                  action: event.data.action
                }
              }));
            } catch (storageError) {
              console.warn("Failed to store notification action:", storageError);
            }
          }
        }
      } catch (error) {
        console.error("Error handling service worker message:", error);
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

      // Get current user ID
      const userId = await getCurrentUserId();
      console.log("Current user ID:", userId);

      if (!userId) {
        toast({
          title: "خطأ",
          description: "فشل في الحصول على معرف المستخدم. يرجى تسجيل الدخول مرة أخرى.",
          variant: "destructive"
        });
        return false;
      }

      const saved = await saveFcmToken(token, deviceInfo, userId);
      console.log("Token save result:", saved);

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
