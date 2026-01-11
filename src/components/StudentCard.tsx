import { Trash2, Clock, Monitor, MapPin, Phone, CheckCircle2, Ban, Check, DollarSign } from "lucide-react";
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

  // Remove + sign for wa.me URL
  cleaned = cleaned.replace("+", "");

  return cleaned;
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
                  className="h-8 px-3 gap-1.5 border-green-500/50 text-green-600 hover:bg-green-500/10 hover:text-green-700 hover:border-green-500"
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
                          isCompleted && "bg-emerald-500/20 text-emerald-700 border-emerald-500/30",
                          isCancelled && "bg-rose-500/20 text-rose-700 border-rose-500/30",
                          isScheduled && "bg-blue-500/20 text-blue-700 border-blue-500/30",
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
                          className="h-8 w-8 text-amber-600 hover:bg-amber-500/10 hover:text-amber-700"
                          title="تسجيل دفع"
                          onClick={() => onQuickPayment(student.id, session.id, session.date)}
                        >
                          <DollarSign className="h-4 w-4" />
                        </Button>
                      )}

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
