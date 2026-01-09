import { Trash2, Clock, Monitor, MapPin, Phone, CheckCircle2, Ban, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Student, SessionType, AppSettings, Session } from "@/types/student";
import { EditStudentDialog } from "@/components/EditStudentDialog";
import { cn } from "@/lib/utils";
import { DAY_NAMES_SHORT_AR, formatDurationAr } from "@/lib/arabicConstants";
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
  onToggleComplete?: (studentId: string, sessionId: string) => void;
  onCancelSession?: (studentId: string, sessionId: string, reason?: string) => void;
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
  onToggleComplete,
  onCancelSession,
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

            {/* Phone number link */}
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
                    {/* Status Icon */}
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

                    {/* Session Time */}
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-bold text-base">{sessionTime}</span>

                      {/* Status Badge */}
                      <Badge
                        className={cn(
                          "text-xs",
                          isCompleted && "bg-emerald-500/20 text-emerald-700 border-emerald-500/30",
                          isCancelled && "bg-rose-500/20 text-rose-700 border-rose-500/30",
                          isScheduled && "bg-blue-500/20 text-blue-700 border-blue-500/30",
                        )}
                      >
                        {isCompleted ? "مكتملة ✓" : isCancelled ? "ملغاة ✗" : "مجدولة"}
                      </Badge>
                    </div>
                  </div>

                  {/* Action Buttons - ONLY for scheduled sessions */}
                  {isScheduled && (
                    <div className="flex items-center gap-1 shrink-0">
                      {/* Complete Button */}
                      {onToggleComplete && (
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

                      {/* Cancel Button */}
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
