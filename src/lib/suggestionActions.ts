// Suggestion Action Router
// Maps action targets to app navigation/dialogs
// Includes WhatsApp action support for payment reminders


export interface ActionHandlers {
  openStudent: (studentId: string) => void;
  openPayment: (studentId: string) => void;
  openSessionNotes: (studentId: string, sessionId: string) => void;
  showTodaySessions: () => void;
  showCalendar: () => void;
  markComplete: (studentId: string, sessionId: string) => void;
  sendWhatsAppReminder: (studentId: string) => void;
}

// Callback for when an action is completed (for auto-removal)
export type OnActionComplete = (
  actionType: string,
  entityType: "session" | "student" | "payment",
  entityId: string
) => void;

/**
 * Parse action target string and execute appropriate handler
 * Returns entity info for auto-removal tracking
 */
export function executeAction(
  target: string,
  handlers: ActionHandlers,
  onActionComplete?: OnActionComplete
): { entityType?: "session" | "student" | "payment"; entityId?: string } {
  const [action, ...params] = target.split(":");
  let result: { entityType?: "session" | "student" | "payment"; entityId?: string } = {};

  switch (action) {
    case "open_student":
      if (params[0]) {
        handlers.openStudent(params[0]);
        result = { entityType: "student", entityId: params[0] };
      }
      break;

    case "open_payment":
      if (params[0]) {
        handlers.openPayment(params[0]);
        result = { entityType: "student", entityId: params[0] };
      }
      break;

    case "open_session_notes":
      if (params[0] && params[1]) {
        handlers.openSessionNotes(params[0], params[1]);
        result = { entityType: "session", entityId: params[1] };
      }
      break;

    case "show_today_sessions":
      handlers.showTodaySessions();
      break;

    case "show_calendar":
      handlers.showCalendar();
      break;

    case "mark_complete":
      if (params[0] && params[1]) {
        handlers.markComplete(params[0], params[1]);
        result = { entityType: "session", entityId: params[1] };
        if (onActionComplete) {
          onActionComplete("mark_complete", "session", params[1]);
        }
      }
      break;

    case "send_whatsapp":
      if (params[0]) {
        handlers.sendWhatsAppReminder(params[0]);
        result = { entityType: "student", entityId: params[0] };
      }
      break;

    default:
      console.warn(`Unknown action target: ${target}`);
  }

  return result;
}

/**
 * Get action icon based on target
 */
export function getActionIcon(target: string): string {
  const action = target.split(":")[0];

  switch (action) {
    case "open_student":
      return "👤";
    case "open_payment":
      return "💳";
    case "open_session_notes":
      return "📝";
    case "show_today_sessions":
      return "📅";
    case "show_calendar":
      return "🗓️";
    case "mark_complete":
      return "✅";
    case "send_whatsapp":
      return "📱";
    default:
      return "→";
  }
}

/**
 * Get human-readable action description (Arabic)
 */
export function getActionDescription(target: string): string {
  const action = target.split(":")[0];

  switch (action) {
    case "open_student":
      return "عرض بيانات الطالب";
    case "open_payment":
      return "تسجيل دفعة";
    case "open_session_notes":
      return "عرض ملاحظات الحصة";
    case "show_today_sessions":
      return "عرض حصص اليوم";
    case "show_calendar":
      return "عرض الجدول";
    case "mark_complete":
      return "تأكيد الحصة";
    case "send_whatsapp":
      return "تذكير واتساب";
    default:
      return "تنفيذ";
  }
}
