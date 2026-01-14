// Suggestion Action Router
// Maps action targets to app navigation/dialogs


export interface ActionHandlers {
  openStudent: (studentId: string) => void;
  openPayment: (studentId: string) => void;
  openSessionNotes: (studentId: string, sessionId: string) => void;
  showTodaySessions: () => void;
  showCalendar: () => void;
  markComplete: (studentId: string, sessionId: string) => void;
}

/**
 * Parse action target string and execute appropriate handler
 */
export function executeAction(target: string, handlers: ActionHandlers): void {
  const [action, ...params] = target.split(":");

  switch (action) {
    case "open_student":
      if (params[0]) {
        handlers.openStudent(params[0]);
      }
      break;

    case "open_payment":
      if (params[0]) {
        handlers.openPayment(params[0]);
      }
      break;

    case "open_session_notes":
      if (params[0] && params[1]) {
        handlers.openSessionNotes(params[0], params[1]);
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
      }
      break;

    default:
      console.warn(`Unknown action target: ${target}`);
  }
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
    default:
      return "→";
  }
}

