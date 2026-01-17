// Notification Permission Prompt Component
// Prompts users to enable push notifications after meaningful interactions
// Shows contextual message based on the trigger

import { useState, useEffect, useCallback } from "react";
import { Bell, X, BellRing, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { usePushNotifications } from "@/hooks/usePushNotifications";

interface NotificationPermissionPromptProps {
  // Trigger types for contextual messaging
  trigger?: "session_completed" | "first_visit" | "payment_recorded" | "manual";
  // Callback when permission is granted
  onPermissionGranted?: () => void;
  // Callback when dismissed
  onDismiss?: () => void;
}

const PROMPT_KEY = "notification-prompt-shown";
const PROMPT_COOLDOWN = 24 * 60 * 60 * 1000; // 24 hours

const TRIGGER_MESSAGES: Record<string, { title: string; description: string }> = {
  session_completed: {
    title: "أحسنت! 🎉",
    description: "فعّل الإشعارات لتذكيرك بالحصص القادمة والمدفوعات المستحقة",
  },
  first_visit: {
    title: "مرحباً بك!",
    description: "فعّل الإشعارات لتحصل على تنبيهات مهمة حتى عند إغلاق المتصفح",
  },
  payment_recorded: {
    title: "تم تسجيل الدفعة! ✅",
    description: "فعّل الإشعارات لتذكيرك بالمدفوعات المتأخرة تلقائياً",
  },
  manual: {
    title: "الإشعارات الفورية",
    description: "احصل على تنبيهات للحصص والمدفوعات حتى عند إغلاق التطبيق",
  },
};

export function NotificationPermissionPrompt({
  trigger = "first_visit",
  onPermissionGranted,
  onDismiss,
}: NotificationPermissionPromptProps) {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isEnabling, setIsEnabling] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const {
    isSupported,
    isEnabled,
    isConfigured,
    permission,
    enableNotifications,
  } = usePushNotifications();

  // Check if we should show the prompt
  useEffect(() => {
    // Don't show if already enabled or not supported
    if (isEnabled || !isSupported || !isConfigured || permission === "denied") {
      return;
    }

    // Check cooldown (except for manual trigger)
    if (trigger !== "manual") {
      const lastShown = localStorage.getItem(PROMPT_KEY);
      if (lastShown) {
        const elapsed = Date.now() - parseInt(lastShown, 10);
        if (elapsed < PROMPT_COOLDOWN) {
          return;
        }
      }
    }

    // Show prompt with a small delay for non-first-visit triggers
    const delay = trigger === "first_visit" ? 3000 : 500;
    const timer = setTimeout(() => {
      setShowPrompt(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [trigger, isEnabled, isSupported, isConfigured, permission]);

  const handleEnable = useCallback(async () => {
    setIsEnabling(true);
    localStorage.setItem(PROMPT_KEY, Date.now().toString());

    try {
      const success = await enableNotifications();
      if (success) {
        setIsSuccess(true);
        onPermissionGranted?.();
        // Auto-hide after success
        setTimeout(() => {
          setShowPrompt(false);
        }, 2000);
      }
    } catch (error) {
      console.error("Error enabling notifications:", error);
    } finally {
      setIsEnabling(false);
    }
  }, [enableNotifications, onPermissionGranted]);

  const handleDismiss = useCallback(() => {
    localStorage.setItem(PROMPT_KEY, Date.now().toString());
    setShowPrompt(false);
    onDismiss?.();
  }, [onDismiss]);

  if (!showPrompt || isEnabled) {
    return null;
  }

  const message = TRIGGER_MESSAGES[trigger] || TRIGGER_MESSAGES.first_visit;

  return (
    <Card
      className={cn(
        "fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-50 p-4 shadow-xl border-2",
        "animate-in slide-in-from-bottom-4 duration-300",
        isSuccess
          ? "bg-gradient-to-r from-green-50 to-green-100 border-green-300 dark:from-green-950/30 dark:to-green-900/30 dark:border-green-800"
          : "bg-gradient-to-r from-blue-50 to-blue-100 border-blue-300 dark:from-blue-950/30 dark:to-blue-900/30 dark:border-blue-800"
      )}
      dir="rtl"
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
            isSuccess
              ? "bg-green-200 dark:bg-green-800"
              : "bg-blue-200 dark:bg-blue-800"
          )}
        >
          {isSuccess ? (
            <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
          ) : (
            <BellRing className="h-5 w-5 text-blue-600 dark:text-blue-400 animate-pulse" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-sm mb-1">
            {isSuccess ? "تم تفعيل الإشعارات! ✅" : message.title}
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {isSuccess
              ? "ستصلك الإشعارات حتى عند إغلاق المتصفح"
              : message.description}
          </p>
          {!isSuccess && (
            <div className="flex gap-2 mt-3">
              <Button
                size="sm"
                className="gap-1.5"
                onClick={handleEnable}
                disabled={isEnabling}
              >
                {isEnabling ? (
                  <>جارٍ التفعيل...</>
                ) : (
                  <>
                    <Bell className="h-3.5 w-3.5" />
                    تفعيل الإشعارات
                  </>
                )}
              </Button>
              <Button size="sm" variant="ghost" onClick={handleDismiss}>
                لاحقاً
              </Button>
            </div>
          )}
        </div>
        {!isSuccess && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0 opacity-50 hover:opacity-100"
            onClick={handleDismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </Card>
  );
}

