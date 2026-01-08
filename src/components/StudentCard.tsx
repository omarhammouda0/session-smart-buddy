import { Trash2, Clock, Monitor, MapPin, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Student, SessionType, AppSettings } from "@/types/student";
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
  onRemove,
  onUpdateName,
  onUpdateTime,
  onUpdatePhone,
  onUpdateSessionType,
  onUpdateSchedule,
  onUpdateDuration,
  onUpdateCustomSettings,
}: StudentCardProps) => {
  const initials = student.name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("");

  return (
    <Card dir="rtl" className="transition-all hover:shadow-lg hover:-translate-y-0.5 border-border/60">
      <CardHeader className="p-4 pb-3">
        <div className="flex items-start justify-between gap-3">
          {/* Avatar + Name */}
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0">
              {initials}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-heading font-semibold text-base truncate">{student.name}</h3>
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

              {/* Meta */}
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md bg-muted">
                  <Clock className="h-3 w-3" />
                  {student.sessionTime || "16:00"} ({formatDurationAr(student.sessionDuration || 60)})
                </span>

                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px]",
                    (student.sessionType || "onsite") === "online"
                      ? "border-blue-500/30 text-blue-600 bg-blue-500/10"
                      : "border-orange-500/30 text-orange-600 bg-orange-500/10",
                  )}
                >
                  {(student.sessionType || "onsite") === "online" ? (
                    <>
                      <Monitor className="h-3 w-3 ml-1" /> أونلاين
                    </>
                  ) : (
                    <>
                      <MapPin className="h-3 w-3 ml-1" /> حضوري
                    </>
                  )}
                </Badge>

                {student.scheduleDays.map((d) => (
                  <span
                    key={d.dayOfWeek}
                    className={cn(
                      "text-[10px] px-2 py-0.5 rounded-full",
                      d.dayOfWeek === selectedDayOfWeek
                        ? "bg-primary text-primary-foreground"
                        : "bg-primary/10 text-primary",
                    )}
                  >
                    {DAY_NAMES_SHORT_AR[d.dayOfWeek]}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Delete */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="icon" variant="ghost" className="text-muted-foreground hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent dir="rtl">
              <AlertDialogHeader>
                <AlertDialogTitle>حذف الطالب</AlertDialogTitle>
                <AlertDialogDescription>هل أنت متأكد من حذف {student.name}؟</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="flex-row-reverse gap-2">
                <AlertDialogCancel>إلغاء</AlertDialogCancel>
                <AlertDialogAction onClick={onRemove} className="bg-destructive text-destructive-foreground">
                  حذف
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardHeader>

      {student.phone && (
        <CardContent className="px-4 pb-4 pt-0">
          <a
            href={`https://wa.me/${student.phone.replace(/\D/g, "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
          >
            <Phone className="h-3 w-3" />
            {student.phone}
          </a>
        </CardContent>
      )}
    </Card>
  );
};
