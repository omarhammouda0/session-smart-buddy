// Hook to trigger the notification prompt programmatically
// Separated from component file to satisfy React Fast Refresh

import { useState, useCallback } from "react";
import { NotificationPermissionPrompt } from "@/components/NotificationPermissionPrompt";

type TriggerType = "session_completed" | "first_visit" | "payment_recorded" | "manual";

export function useNotificationPrompt() {
  const [trigger, setTrigger] = useState<TriggerType | null>(null);

  const promptForNotifications = useCallback((triggerType: TriggerType) => {
    setTrigger(triggerType || "manual");
  }, []);

  const clearPrompt = useCallback(() => {
    setTrigger(null);
  }, []);

  return {
    trigger,
    promptForNotifications,
    clearPrompt,
    NotificationPromptComponent: trigger ? (
      <NotificationPermissionPrompt
        trigger={trigger}
        onDismiss={clearPrompt}
        onPermissionGranted={clearPrompt}
      />
    ) : null,
  };
}
