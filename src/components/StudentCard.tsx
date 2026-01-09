import { Trash2, Clock, Monitor, MapPin, Phone, CheckCircle2, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Student, SessionType, AppSettings, Session } from "@/types/student";
import { EditStudentDialog } from "@/components/EditStudentDialog";
import { cn } from "@/lib/utils";
import { DAY_NAMES_SHORT_AR, formatDurationAr } from "@/lib/arabicConstants";
import { format, parseISO } from "date-fns";
import { ar } from "date-fns/locale";
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
}

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
}: StudentCardProps) => {
  return (
    <Card className={cn("card-shadow transition-all duration-300 overflow-hidden border-2")} dir="rtl">
      {/* Student Header */}
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
                {student.sessionTime || "16:00"}
                <span className="text-xs text-muted-foreground">
                  ({formatDurationAr(student.sessionDuration || 60)})
                </span>
              </span>
              
              <Badge
                variant="outline"
                className={cn(
                  "text-xs gap-1.5 font-semibold shadow-sm",
                  (student.sessionType || "onsite") === "online"
                    ? "border-blue-500/50 text-blue-600 bg-blue-500/10"
                    : "border-orange-500/50 text-orange-600 bg-orange-500/10",
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

              {student.scheduleDays.map((d) => (
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

            {student.phone && (
              <a
                href={`https://wa.me/${student.phone.replace(/\D/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors mt-2"
              >
                <Phone className="h-3.5 w-3.5" />
                {student.phone}
              </a>
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

      {/* Today's Sessions List */}
      {todaySessions && todaySessions.length > 0 && (
        <CardContent className="p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-sm text-muted-foreground">
              حصص اليوم ({todaySessions.length})
            </h4>
          </div>
          
          <div className="space-y-2">
            {todaySessions
              .sort((a, b) => (a.time || "").localeCompare(b.time || ""))
              .map((session, index) => {
                const sessionTime = session.time || student.sessionTime || "16:00";
                const isCompleted = session.status === "completed";
                const isCancelled = session.status === "cancelled";
                
                return (
                  <div
                    key={session.id || index}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-xl border-2 transition-all",
                      isCompleted && "bg-emerald-500/5 border-emerald-500/30",
                      isCancelled && "bg-destructive/5 border-destructive/30 opacity-60",
                      !isCompleted && !isCancelled && "bg-card border-border hover:border-primary/50"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      {/* Status Icon */}
                      <div className={cn(
                        "p-2 rounded-lg",
                        isCompleted && "bg-emerald-500/10",
                        isCancelled && "bg-destructive/10",
                        !isCompleted && !isCancelled && "bg-primary/10"
                      )}>
                        {isCompleted ? (
                          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                        ) : (
                          <Circle className={cn(
                            "h-5 w-5",
                            isCancelled ? "text-destructive" : "text-primary"
                          )} />
                        )}
                      </div>

                      {/* Session Details */}
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-base">
                            {sessionTime}
                          </span>
                          {session.status && (
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-xs",
                                isCompleted && "border-emerald-500/50 text-emerald-600 bg-emerald-500/10",
                                isCancelled && "border-destructive/50 text-destructive bg-destructive/10",
                                !isCompleted && !isCancelled && "border-primary/50 text-primary bg-primary/10"
                              )}
                            >
                              {isCompleted ? "مكتملة" : isCancelled ? "ملغاة" : "مجدولة"}
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {format(parseISO(session.date), "EEEE، dd MMMM", { locale: ar })}
                        </span>
                      </div>
                    </div>

                    {/* Session Duration */}
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {formatDurationAr(student.sessionDuration || 60)}
                      </Badge>
                    </div>
                  </div>
                );
              })}
          </div>
        </CardContent>
      )}
    </Card>
  );
};