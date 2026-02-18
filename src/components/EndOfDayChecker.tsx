import { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  X,
  Bell,
  ClipboardCheck,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Student, Session } from "@/types/student";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

interface EndOfDayCheckerProps {
  students: Student[];
  onToggleComplete?: (studentId: string, sessionId: string) => void;
}

interface UncompletedSession {
  session: Session;
  student: Student;
  sessionTime: string;
}

export function EndOfDayChecker({ students, onToggleComplete }: EndOfDayCheckerProps) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showNotification, setShowNotification] = useState(false);
  const [notificationDismissed, setNotificationDismissed] = useState(false);
  const [showEndOfDayDialog, setShowEndOfDayDialog] = useState(false);
  const [completeAllDialog, setCompleteAllDialog] = useState(false);

  // Update time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  const todayStr = format(currentTime, "yyyy-MM-dd");

  // Get all today's sessions with their details
  const todaySessions = useMemo(() => {
    const sessions: UncompletedSession[] = [];

    students.forEach((student) => {
      student.sessions
        .filter((s) => s.date === todayStr)
        .forEach((session) => {
          const sessionTime = session.time || student.sessionTime || "16:00";
          sessions.push({ session, student, sessionTime });
        });
    });

    // Sort by time
    return sessions.sort((a, b) => a.sessionTime.localeCompare(b.sessionTime));
  }, [students, todayStr]);

  // Get uncompleted sessions that have ended
  const uncompletedEndedSessions = useMemo(() => {
    return todaySessions.filter(({ session, student, sessionTime }) => {
      if (session.status !== "scheduled") return false;

      // Check if session has ended
      const [hours, minutes] = sessionTime.split(":").map(Number);
      const duration = session.duration || student.sessionDuration || 60;
      const sessionEndMinutes = hours * 60 + minutes + duration;
      const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();

      return currentMinutes >= sessionEndMinutes;
    });
  }, [todaySessions, currentTime]);

  // Find the last session end time of the day
  const lastSessionEndTime = useMemo(() => {
    if (todaySessions.length === 0) return null;

    let latestEnd = 0;
    todaySessions.forEach(({ session, student, sessionTime }) => {
      if (session.status === "cancelled") return;

      const [hours, minutes] = sessionTime.split(":").map(Number);
      const duration = session.duration || student.sessionDuration || 60;
      const sessionEndMinutes = hours * 60 + minutes + duration;

      if (sessionEndMinutes > latestEnd) {
        latestEnd = sessionEndMinutes;
      }
    });

    return latestEnd > 0 ? latestEnd : null;
  }, [todaySessions]);

  // Check if we should show notification (10 minutes after last session)
  useEffect(() => {
    if (notificationDismissed || lastSessionEndTime === null) return;

    const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
    const notificationTime = lastSessionEndTime + 10; // 10 minutes after last session

    // Show notification if:
    // 1. Current time is past notification time
    // 2. There are uncompleted sessions
    // 3. Notification hasn't been dismissed
    if (currentMinutes >= notificationTime && uncompletedEndedSessions.length > 0) {
      setShowNotification(true);
    }
  }, [currentTime, lastSessionEndTime, uncompletedEndedSessions, notificationDismissed]);

  const handleDismissNotification = () => {
    setShowNotification(false);
    setNotificationDismissed(true);
  };

  const handleEndOfDayCheck = () => {
    if (uncompletedEndedSessions.length === 0) {
      toast({
        title: "✅ أحسنت!",
        description: "جميع حصص اليوم مكتملة",
      });
    } else {
      setShowEndOfDayDialog(true);
    }
  };

  const handleCompleteSession = (studentId: string, sessionId: string) => {
    if (onToggleComplete) {
      onToggleComplete(studentId, sessionId);
      toast({
        title: "✅ تم إكمال الحصة",
        description: "تم تسجيل الحصة كمكتملة",
      });
    }
  };

  const handleCompleteAll = () => {
    if (onToggleComplete) {
      uncompletedEndedSessions.forEach(({ session, student }) => {
        onToggleComplete(student.id, session.id);
      });
      toast({
        title: "✅ تم إكمال جميع الحصص",
        description: `تم تسجيل ${uncompletedEndedSessions.length} حصة كمكتملة`,
      });
      setCompleteAllDialog(false);
      setShowEndOfDayDialog(false);
      setShowNotification(false);
      setNotificationDismissed(true);
    }
  };

  const completedCount = todaySessions.filter(s => s.session.status === "completed").length;
  const cancelledCount = todaySessions.filter(s => s.session.status === "cancelled").length;
  const cancelledSessions = todaySessions.filter(s => s.session.status === "cancelled");

  // Check if all sessions for today have ended (last session end time has passed)
  const allSessionsEnded = useMemo(() => {
    if (lastSessionEndTime === null) return false;
    const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
    return currentMinutes >= lastSessionEndTime;
  }, [lastSessionEndTime, currentTime]);

  // Don't render anything if no sessions today or sessions haven't ended yet
  if (todaySessions.length === 0 || !allSessionsEnded) {
    return null;
  }

  return (
    <>
      {/* Floating End of Day Button - appears at bottom right after all sessions end */}
      <div className="fixed bottom-20 sm:bottom-4 left-4 z-40">
        <Button
          onClick={handleEndOfDayCheck}
          className={cn(
            "gap-2 shadow-xl hover:shadow-2xl transition-all rounded-full px-5 py-6 text-base font-bold",
            uncompletedEndedSessions.length > 0
              ? "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white animate-pulse"
              : "bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white"
          )}
        >
          <ClipboardCheck className="h-5 w-5" />
          إنهاء اليوم
          {uncompletedEndedSessions.length > 0 && (
            <Badge className="h-6 px-2 text-sm bg-white text-amber-600 hover:bg-white">
              {uncompletedEndedSessions.length}
            </Badge>
          )}
        </Button>
      </div>

      {/* Floating Notification Banner */}
      {showNotification && !notificationDismissed && (
        <div className="fixed bottom-20 sm:bottom-4 right-4 left-4 sm:left-auto sm:w-96 z-50 animate-in slide-in-from-bottom-4 duration-300">
          <Card className="border-2 border-amber-500 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/50 dark:to-orange-950/50 shadow-xl">
            <CardHeader className="pb-2 pt-3 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold flex items-center gap-2 text-amber-700 dark:text-amber-400">
                  <Bell className="h-5 w-5 animate-bounce" />
                  تذكير نهاية اليوم
                </CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-amber-600 hover:bg-amber-500/20"
                  onClick={handleDismissNotification}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-3 space-y-3">
              <p className="text-sm text-amber-800 dark:text-amber-300">
                لديك <strong>{uncompletedEndedSessions.length}</strong> حصة لم يتم تأكيد إكمالها بعد
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
                  onClick={() => {
                    setShowNotification(false);
                    setShowEndOfDayDialog(true);
                  }}
                >
                  مراجعة الحصص
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-amber-500/50 text-amber-700 hover:bg-amber-500/10"
                  onClick={handleDismissNotification}
                >
                  لاحقاً
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* End of Day Dialog */}
      <Dialog open={showEndOfDayDialog} onOpenChange={setShowEndOfDayDialog}>
        <DialogContent dir="rtl" className="sm:max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <ClipboardCheck className="h-6 w-6 text-primary" />
              مراجعة حصص اليوم
            </DialogTitle>
            <DialogDescription>
              {format(currentTime, "EEEE، d MMMM yyyy", { locale: ar })}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 py-4">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <div className="p-3 rounded-xl bg-emerald-500/10 border-2 border-emerald-500/30 text-center">
                <CheckCircle2 className="h-5 w-5 mx-auto mb-1 text-emerald-600" />
                <p className="text-2xl font-bold text-emerald-700">{completedCount}</p>
                <p className="text-xs text-emerald-600">مكتملة</p>
              </div>
              <div className={cn(
                "p-3 rounded-xl border-2 text-center",
                uncompletedEndedSessions.length > 0
                  ? "bg-amber-500/10 border-amber-500/30"
                  : "bg-muted/50 border-border"
              )}>
                <Clock className="h-5 w-5 mx-auto mb-1 text-amber-600" />
                <p className={cn(
                  "text-2xl font-bold",
                  uncompletedEndedSessions.length > 0 ? "text-amber-700" : "text-muted-foreground"
                )}>
                  {uncompletedEndedSessions.length}
                </p>
                <p className="text-xs text-amber-600">بانتظار التأكيد</p>
              </div>
              <div className={cn(
                "p-3 rounded-xl border-2 text-center",
                cancelledCount > 0
                  ? "bg-rose-500/10 border-rose-500/30"
                  : "bg-muted/50 border-border"
              )}>
                <X className="h-5 w-5 mx-auto mb-1 text-rose-600" />
                <p className={cn(
                  "text-2xl font-bold",
                  cancelledCount > 0 ? "text-rose-700" : "text-muted-foreground"
                )}>
                  {cancelledCount}
                </p>
                <p className="text-xs text-rose-600">ملغاة</p>
              </div>
            </div>

            {/* Uncompleted Sessions List */}
            {uncompletedEndedSessions.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    حصص لم تكتمل بعد
                  </h3>
                  {uncompletedEndedSessions.length > 1 && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1 border-emerald-500/50 text-emerald-600 hover:bg-emerald-500/10"
                      onClick={() => setCompleteAllDialog(true)}
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      إكمال الكل
                    </Button>
                  )}
                </div>

                <div className="space-y-2">
                  {uncompletedEndedSessions.map(({ session, student, sessionTime }) => (
                    <div
                      key={session.id}
                      className="flex items-center justify-between p-3 rounded-xl border-2 border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-bold text-sm">{student.name}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {sessionTime}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                        onClick={() => handleCompleteSession(student.id, session.id)}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        إكمال
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                </div>
                <p className="text-lg font-bold text-emerald-700">أحسنت! 🎉</p>
                <p className="text-sm text-muted-foreground mt-1">
                  جميع حصص اليوم مكتملة
                </p>
              </div>
            )}

            {/* Completed Sessions */}
            {completedCount > 0 && (
              <div className="space-y-2 pt-3 border-t">
                <h3 className="font-semibold text-sm flex items-center gap-2 text-emerald-600">
                  <CheckCircle2 className="h-4 w-4" />
                  الحصص المكتملة ({completedCount})
                </h3>
                <div className="space-y-1.5">
                  {todaySessions
                    .filter(s => s.session.status === "completed")
                    .map(({ session, student, sessionTime }) => (
                      <div
                        key={session.id}
                        className="flex items-center gap-3 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20"
                      >
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span className="text-sm font-medium">{student.name}</span>
                        <span className="text-xs text-muted-foreground">{sessionTime}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Cancelled Sessions */}
            {cancelledCount > 0 && (
              <div className="space-y-2 pt-3 border-t">
                <h3 className="font-semibold text-sm flex items-center gap-2 text-rose-600">
                  <X className="h-4 w-4" />
                  الحصص الملغاة ({cancelledCount})
                </h3>
                <div className="space-y-1.5">
                  {cancelledSessions.map(({ session, student, sessionTime }) => (
                    <div
                      key={session.id}
                      className="flex items-center gap-3 p-2 rounded-lg bg-rose-500/10 border border-rose-500/20"
                    >
                      <X className="h-4 w-4 text-rose-600 shrink-0" />
                      <span className="text-sm font-medium text-rose-700">{student.name}</span>
                      <span className="text-xs text-muted-foreground">{sessionTime}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-3 border-t shrink-0">
            <Button variant="outline" onClick={() => setShowEndOfDayDialog(false)}>
              إغلاق
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Complete All Confirmation */}
      <AlertDialog open={completeAllDialog} onOpenChange={setCompleteAllDialog}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              تأكيد إكمال جميع الحصص
            </AlertDialogTitle>
            <AlertDialogDescription>
              هل تريد تسجيل جميع الحصص المتبقية ({uncompletedEndedSessions.length} حصة) كمكتملة؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCompleteAll}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              <CheckCircle2 className="h-4 w-4 ml-1" />
              نعم، أكمل الكل
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

