
import { Bell, Clock, X, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Student, Session } from "@/types/student";
import { cn } from "@/lib/utils";

interface SessionNotificationBannerProps {
  student: Student;
  session: Session;
  minutesUntil: number;
  onDismiss: () => void;
  className?: string;
}

export function SessionNotificationBanner({
  student,
  session,
  minutesUntil,
  onDismiss,
  className,
}: SessionNotificationBannerProps) {
  const sessionTime = session.time || student.sessionTime || "16:00";

  const getTimeText = () => {
    if (minutesUntil <= 0) return "الآن!";
    if (minutesUntil < 60) return `بعد ${minutesUntil} دقيقة`;
    const hours = Math.floor(minutesUntil / 60);
    const mins = minutesUntil % 60;
    if (mins === 0) return `بعد ${hours} ساعة`;
    return `بعد ${hours} ساعة و ${mins} دقيقة`;
  };

  return (
    <Card
      className={cn(
        "fixed top-20 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 z-50",
        "bg-gradient-to-r from-primary/95 to-primary/90 text-primary-foreground",
        "shadow-2xl border-0 animate-in slide-in-from-top-5 duration-300",
        className
      )}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0 animate-pulse">
              <Bell className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs opacity-90 mb-0.5">تذكير بالحصة القادمة</p>
              <div className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 opacity-80" />
                <p className="font-bold text-base truncate">{student.name}</p>
              </div>
              <div className="flex items-center gap-1.5 text-sm opacity-90 mt-0.5">
                <Clock className="h-3.5 w-3.5" />
                <span>{sessionTime}</span>
                <span className="mx-1">•</span>
                <span className="font-semibold">{getTimeText()}</span>
              </div>
            </div>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-primary-foreground/80 hover:text-primary-foreground hover:bg-white/10 shrink-0"
            onClick={onDismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

