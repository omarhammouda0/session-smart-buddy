import { Trash2, Clock, Monitor, MapPin, Phone, CheckCircle2, Ban, Check, DollarSign, FileText, BookOpen, ChevronDown, ChevronUp, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Student, SessionType, AppSettings, Session } from "@/types/student";
import { EditStudentDialog } from "@/components/EditStudentDialog";
import { cn } from "@/lib/utils";
import { DAY_NAMES_SHORT_AR, formatDurationAr } from "@/lib/arabicConstants";
import { useState, useMemo } from "react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// Helper function to check if a session has ended
const isSessionEnded = (sessionDate: string, sessionTime: string, sessionDuration: number = 60): boolean => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sessionDateObj = new Date(sessionDate);

  // If session is in the past (before today), it has ended
  if (sessionDateObj < today) {
    return true;
  }

  // If session is in the future (after today), it has NOT ended
  if (sessionDateObj > today) {
    return false;
  }

  // Session is today - check if current time is past the session end time
  if (!sessionTime) return false;

  const [sessionHour, sessionMin] = sessionTime.split(":").map(Number);
  const sessionEndMinutes = sessionHour * 60 + sessionMin + sessionDuration;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  return currentMinutes >= sessionEndMinutes;
};

// Helper function to check if a session is currently in progress
const isSessionInProgress = (sessionDate: string, sessionTime: string, sessionDuration: number = 60): boolean => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sessionDateObj = new Date(sessionDate);

  // Session must be today
  if (sessionDateObj.getTime() !== today.getTime()) {
    return false;
  }

  if (!sessionTime) return false;

  const [sessionHour, sessionMin] = sessionTime.split(":").map(Number);
  const sessionStartMinutes = sessionHour * 60 + sessionMin;
  const sessionEndMinutes = sessionStartMinutes + sessionDuration;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  // In progress = current time is between start and end
  return currentMinutes >= sessionStartMinutes && currentMinutes < sessionEndMinutes;
};

interface StudentCardProps {
  student: Student;
  students?: Student[];
  settings?: AppSettings;
  selectedDayOfWeek: number;
  todaySessions?: Session[];
  onRemove: () => void;
  onUpdateName: (name: string) => void;
  onUpdateTime: (time: string) => void;
  onUpdatePhone: (phone: string) => void;
  onUpdateSessionType: (type: SessionType) => void;
  onUpdateSchedule: (days: number[], start?: string, end?: string) => void;
  onUpdateDuration?: (duration: number) => void;
  onUpdateCustomSettings?: (settings: {
    useCustomSettings?: boolean;
    sessionDuration?: number;
    customPriceOnsite?: number;
    customPriceOnline?: number;
  }) => void;
  onToggleComplete?: (studentId: string, sessionId: string) => void;
  onCancelSession?: (studentId: string, sessionId: string, reason?: string) => void;
  onQuickPayment?: (studentId: string, sessionId: string, sessionDate: string) => void;
}

// WhatsApp Icon Component
const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

// Helper function to format phone number for WhatsApp
const formatWhatsAppNumber = (phone: string): string => {
  // Remove all non-digit characters except +
  let cleaned = phone.replace(/[^\d+]/g, "");

  // If starts with 0, assume Saudi Arabia and replace with +966
  if (cleaned.startsWith("0")) {
    cleaned = "+966" + cleaned.substring(1);
  }

  // If no + prefix, add it
  if (!cleaned.startsWith("+")) {
    cleaned = "+" + cleaned;
  }

  return cleaned.replace("+", "");
};

// Helper function to open WhatsApp
const openWhatsApp = (phone: string, message?: string) => {
  const formattedPhone = formatWhatsAppNumber(phone);
  const baseUrl = `https://wa.me/${formattedPhone}`;
  const url = message ? `${baseUrl}?text=${encodeURIComponent(message)}` : baseUrl;
  window.open(url, "_blank");
};

export const StudentCard = ({
  student,
  students = [],
  settings,
  selectedDayOfWeek,
  todaySessions = [],
  onRemove,
  onUpdateName,
  onUpdateTime,
  onUpdatePhone,
  onUpdateSessionType,
  onUpdateSchedule,
  onUpdateDuration,
  onUpdateCustomSettings,
  onToggleComplete,
  onCancelSession,
  onQuickPayment,
}: StudentCardProps) => {
  const [showNotesExpanded, setShowNotesExpanded] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);

  // Get today's date string for comparison
  const todayStr = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);

  // Get the last session with notes (excluding today) - prioritize sessions with content
  const lastSessionWithNotes = useMemo(() => {
    // First, try to find the most recent past session with notes/topic/homework
    const pastSessionsWithContent = student.sessions
      .filter(s =>
        s.date < todayStr && // Only past sessions
        (s.notes || s.homework || s.topic) // Has some content
      )
      .sort((a, b) => b.date.localeCompare(a.date));

    if (pastSessionsWithContent.length > 0) {
      return pastSessionsWithContent[0];
    }

    // If no sessions with content, return the most recent completed session
    const pastCompletedSessions = student.sessions
      .filter(s => s.date < todayStr && s.status === "completed")
      .sort((a, b) => b.date.localeCompare(a.date));

    return pastCompletedSessions[0] || null;
  }, [student.sessions, todayStr]);

  // Get all past sessions for history (with notes or completed)
  const allPastSessions = useMemo(() => {
    return student.sessions
      .filter(s =>
        s.date < todayStr && // Only past sessions
        (s.status === "completed" || s.notes || s.homework || s.topic)
      )
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [student.sessions, todayStr]);

  // Check if last session has any content
  const lastSessionHasContent = lastSessionWithNotes &&
    (lastSessionWithNotes.notes || lastSessionWithNotes.homework || lastSessionWithNotes.topic);

  // Format date in Arabic
  const formatDateAr = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "EEEE d MMMM", { locale: ar });
    } catch {
      return dateStr;
    }
  };

  // Get homework status badge
  const getHomeworkStatusBadge = (status?: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-emerald-500/20 text-emerald-700 text-xs">✓ تم حله</Badge>;
      case "incomplete":
        return <Badge className="bg-rose-500/20 text-rose-700 text-xs">✗ لم يُحل</Badge>;
      case "assigned":
        return <Badge className="bg-amber-500/20 text-amber-700 text-xs">⏳ مطلوب</Badge>;
      default:
        return null;
    }
  };

  return (
    <Card className={cn("card-shadow transition-all duration-300 overflow-hidden border-2")} dir="rtl">
      <CardHeader className="p-4 sm:p-5 bg-gradient-to-r from-card to-primary/5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-heading font-bold text-lg sm:text-xl truncate">{student.name}</h3>
              <EditStudentDialog
                student={student}
                students={students}
                appSettings={settings}
                onUpdateName={onUpdateName}
                onUpdateTime={onUpdateTime}
                onUpdatePhone={onUpdatePhone}
                onUpdateSessionType={onUpdateSessionType}
                onUpdateSchedule={onUpdateSchedule}
                onUpdateDuration={onUpdateDuration}
                onUpdateCustomSettings={onUpdateCustomSettings}
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium px-3 py-1.5 bg-primary/10 text-primary rounded-lg flex items-center gap-1.5 shadow-sm">
                <Clock className="h-4 w-4" />
                {student.sessionTime}
                <span className="text-xs text-muted-foreground">
                  ({formatDurationAr(student.sessionDuration || 60)})
                </span>
              </span>

              <Badge
                variant="outline"
                className={cn(
                  "text-xs gap-1.5 font-semibold shadow-sm",
                  (student.sessionType || "onsite") === "online"
                    ? "border-primary/50 text-primary bg-primary/10"
                    : "border-primary/40 text-primary/90 bg-primary/5",
                )}
              >
                {(student.sessionType || "onsite") === "online" ? (
                  <>
                    <Monitor className="h-3.5 w-3.5" /> أونلاين
                  </>
                ) : (
                  <>
                    <MapPin className="h-3.5 w-3.5" /> حضوري
                  </>
                )}
              </Badge>

              {student.scheduleDays &&
                student.scheduleDays.map((d) => (
                  <span
                    key={d.dayOfWeek}
                    className={cn(
                      "text-xs px-2.5 py-1 rounded-full font-medium",
                      d.dayOfWeek === selectedDayOfWeek
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {DAY_NAMES_SHORT_AR[d.dayOfWeek]}
                  </span>
                ))}
            </div>

            {/* Phone number with WhatsApp button */}
            {student.phone && (
              <div className="flex items-center gap-2 mt-3">
                <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" />
                  {student.phone}
                </span>

                {/* WhatsApp Button */}
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-3 gap-1.5 border-primary/50 text-primary hover:bg-primary/10 hover:text-primary hover:border-primary"
                  onClick={() => openWhatsApp(student.phone!)}
                >
                  <WhatsAppIcon className="h-4 w-4" />
                  <span className="text-xs font-medium">واتساب</span>
                </Button>
              </div>
            )}
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="shrink-0 h-9 w-9 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent dir="rtl">
              <AlertDialogHeader>
                <AlertDialogTitle>حذف الطالب</AlertDialogTitle>
                <AlertDialogDescription>
                  هل أنت متأكد من حذف {student.name}؟ سيتم حذف جميع سجلات الحصص والمدفوعات.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="flex-row-reverse gap-2">
                <AlertDialogCancel>إلغاء</AlertDialogCancel>
                <AlertDialogAction
                  onClick={onRemove}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  حذف
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardHeader>

      {todaySessions && todaySessions.length > 0 && (
        <CardContent className="p-4 sm:p-5 space-y-3">
          {/* Last Session Notes & Homework */}
          {lastSessionWithNotes && (
            <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500/5 to-indigo-500/5 border-2 border-purple-500/20 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm text-purple-700 dark:text-purple-400 flex items-center gap-1.5">
                  <FileText className="h-4 w-4" />
                  الحصة السابقة
                </h4>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {formatDateAr(lastSessionWithNotes.date)}
                  </span>
                  {allPastSessions.length > 1 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs gap-1 text-purple-600 hover:bg-purple-500/10"
                      onClick={() => setShowHistoryDialog(true)}
                    >
                      <History className="h-3.5 w-3.5" />
                      السجل ({allPastSessions.length})
                    </Button>
                  )}
                </div>
              </div>

              {/* Show message if no notes */}
              {!lastSessionHasContent && (
                <p className="text-sm text-muted-foreground italic">لا توجد ملاحظات للحصة السابقة</p>
              )}

              {/* Topic */}
              {lastSessionWithNotes.topic && (
                <div className="flex items-start gap-2">
                  <BookOpen className="h-3.5 w-3.5 text-indigo-500 mt-0.5 shrink-0" />
                  <p className="text-sm font-medium text-foreground">{lastSessionWithNotes.topic}</p>
                </div>
              )}

              {/* Notes - collapsible if long */}
              {lastSessionWithNotes.notes && (
                <div className="space-y-1">
                  <p className={cn(
                    "text-sm text-muted-foreground",
                    !showNotesExpanded && lastSessionWithNotes.notes.length > 100 && "line-clamp-2"
                  )}>
                    {lastSessionWithNotes.notes}
                  </p>
                  {lastSessionWithNotes.notes.length > 100 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs text-purple-600 hover:text-purple-700"
                      onClick={() => setShowNotesExpanded(!showNotesExpanded)}
                    >
                      {showNotesExpanded ? (
                        <>
                          <ChevronUp className="h-3 w-3 ml-1" />
                          عرض أقل
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-3 w-3 ml-1" />
                          عرض المزيد
                        </>
                      )}
                    </Button>
                  )}
                </div>
              )}

              {/* Homework */}
              {lastSessionWithNotes.homework && (
                <div className="flex items-start gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <BookOpen className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-semibold text-amber-700">الواجب:</span>
                      {getHomeworkStatusBadge(lastSessionWithNotes.homeworkStatus)}
                    </div>
                    <p className="text-sm text-amber-800 dark:text-amber-300">{lastSessionWithNotes.homework}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* History Dialog */}
          <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
            <DialogContent dir="rtl" className="sm:max-w-lg max-h-[80vh]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <History className="h-5 w-5 text-purple-600" />
                  سجل حصص {student.name}
                </DialogTitle>
                <DialogDescription>
                  {allPastSessions.length} حصة سابقة
                </DialogDescription>
              </DialogHeader>
              <ScrollArea className="max-h-[60vh] pr-4">
                <div className="space-y-4">
                  {allPastSessions.map((session) => (
                    <div
                      key={session.id}
                      className="p-3 rounded-xl border-2 space-y-2 bg-muted/30"
                    >
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-xs">
                          {formatDateAr(session.date)}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {session.time || student.sessionTime}
                        </span>
                      </div>

                      {session.topic && (
                        <div className="flex items-start gap-2">
                          <BookOpen className="h-3.5 w-3.5 text-indigo-500 mt-0.5 shrink-0" />
                          <p className="text-sm font-medium">{session.topic}</p>
                        </div>
                      )}

                      {session.notes && (
                        <p className="text-sm text-muted-foreground pr-5">{session.notes}</p>
                      )}

                      {session.homework && (
                        <div className="flex items-start gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                          <BookOpen className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-xs font-semibold text-amber-700">الواجب:</span>
                              {getHomeworkStatusBadge(session.homeworkStatus)}
                            </div>
                            <p className="text-sm text-amber-800 dark:text-amber-300">{session.homework}</p>
                          </div>
                        </div>
                      )}

                      {!session.topic && !session.notes && !session.homework && (
                        <p className="text-sm text-muted-foreground italic">لا توجد ملاحظات</p>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </DialogContent>
          </Dialog>

          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-sm text-muted-foreground">حصص اليوم ({todaySessions.length})</h4>
          </div>

          <div className="space-y-2">
            {todaySessions.map((session, index) => {
              const sessionTime = session.time || student.sessionTime;
              const isCompleted = session.status === "completed";
              const isCancelled = session.status === "cancelled";
              const isScheduled = session.status === "scheduled";

              return (
                <div
                  key={session.id || index}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-xl border-2 transition-all",
                    isCompleted && "bg-emerald-500/10 border-emerald-500/30",
                    isCancelled && "bg-rose-500/10 border-rose-500/30",
                    isScheduled && "bg-card border-border",
                  )}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div
                      className={cn(
                        "w-5 h-5 rounded-full flex items-center justify-center shrink-0",
                        isCompleted && "bg-emerald-500/20 text-emerald-600",
                        isCancelled && "bg-rose-500/20 text-rose-600",
                        isScheduled && "bg-primary/20 text-primary",
                      )}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : isCancelled ? (
                        <Ban className="h-3.5 w-3.5" />
                      ) : (
                        <Clock className="h-3.5 w-3.5" />
                      )}
                    </div>

                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-bold text-base">{sessionTime}</span>
                      <Badge
                        className={cn(
                          "text-xs",
                          isCompleted && "bg-primary/20 text-primary border-primary/30",
                          isCancelled && "bg-muted text-muted-foreground border-border",
                          isScheduled && "bg-primary/10 text-primary border-primary/20",
                        )}
                      >
                        {isCompleted ? "مكتملة ✓" : isCancelled ? "ملغاة ✗" : "مجدولة"}
                      </Badge>
                    </div>
                  </div>

                  {isScheduled && (
                    <div className="flex items-center gap-1 shrink-0">
                      {onQuickPayment && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-primary hover:bg-primary/10 hover:text-primary"
                          title="تسجيل دفع"
                          onClick={() => onQuickPayment(student.id, session.id, session.date)}
                        >
                          <DollarSign className="h-4 w-4" />
                        </Button>
                      )}

                      {/* Complete button - only show if session has ended */}
                      {onToggleComplete && isSessionEnded(
                        session.date,
                        sessionTime || "16:00",
                        session.duration || student.sessionDuration || 60
                      ) && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700"
                              title="إكمال الحصة"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent dir="rtl">
                            <AlertDialogHeader>
                              <AlertDialogTitle>تأكيد إكمال الحصة</AlertDialogTitle>
                              <AlertDialogDescription>
                                هل تريد تسجيل حصة {student.name} في {sessionTime} كمكتملة؟
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="flex-row-reverse gap-2">
                              <AlertDialogCancel>إلغاء</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => onToggleComplete(student.id, session.id)}
                                className="bg-emerald-600 text-white hover:bg-emerald-700"
                              >
                                تأكيد الإكمال
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}

                      {/* Show in progress indicator if session is ongoing */}
                      {onToggleComplete && isSessionInProgress(
                        session.date,
                        sessionTime || "16:00",
                        session.duration || student.sessionDuration || 60
                      ) && (
                        <div
                          className="h-8 w-8 flex items-center justify-center text-amber-500"
                          title="الحصة جارية الآن"
                        >
                          <Clock className="h-4 w-4 animate-pulse" />
                        </div>
                      )}

                      {/* Show scheduled indicator if session hasn't started yet */}
                      {onToggleComplete && !isSessionEnded(
                        session.date,
                        sessionTime || "16:00",
                        session.duration || student.sessionDuration || 60
                      ) && !isSessionInProgress(
                        session.date,
                        sessionTime || "16:00",
                        session.duration || student.sessionDuration || 60
                      ) && (
                        <div
                          className="h-8 w-8 flex items-center justify-center text-blue-500"
                          title="الحصة مجدولة"
                        >
                          <Clock className="h-4 w-4" />
                        </div>
                      )}

                      {onCancelSession && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-rose-600 hover:bg-rose-500/10 hover:text-rose-700"
                              title="إلغاء الحصة"
                            >
                              <Ban className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent dir="rtl">
                            <AlertDialogHeader>
                              <AlertDialogTitle>تأكيد إلغاء الحصة</AlertDialogTitle>
                              <AlertDialogDescription>
                                هل تريد إلغاء حصة {student.name} في {sessionTime}؟
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="flex-row-reverse gap-2">
                              <AlertDialogCancel>رجوع</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => {
                                  const reason = prompt("سبب الإلغاء (اختياري):");
                                  onCancelSession(student.id, session.id, reason || undefined);
                                }}
                                className="bg-rose-600 text-white hover:bg-rose-700"
                              >
                                تأكيد الإلغاء
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      )}
    </Card>
  );
};
