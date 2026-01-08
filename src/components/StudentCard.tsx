import { Trash2, Clock, Monitor, MapPin, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Student, SessionType } from '@/types/student';
import { EditStudentDialog } from '@/components/EditStudentDialog';
import { cn } from '@/lib/utils';
import { DAY_NAMES_SHORT_AR, formatDurationAr } from '@/lib/arabicConstants';
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
} from '@/components/ui/alert-dialog';

interface StudentCardProps {
  student: Student;
  students?: Student[];
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

  return (
    <Card className={cn(
      "card-shadow transition-all duration-300 overflow-hidden"
    )} dir="rtl">
      <CardHeader className="p-3 sm:pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-heading font-semibold text-base sm:text-lg truncate">{student.name}</h3>
              <EditStudentDialog
                student={student}
                students={students}
                onUpdateName={onUpdateName}
                onUpdateTime={onUpdateTime}
                onUpdatePhone={onUpdatePhone}
                onUpdateSessionType={onUpdateSessionType}
                onUpdateSchedule={onUpdateSchedule}
                onUpdateDuration={onUpdateDuration}
                onUpdateCustomSettings={onUpdateCustomSettings}
              />
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 mt-1 flex-wrap">
              <span className="text-xs sm:text-sm font-medium px-2 py-0.5 sm:px-2.5 sm:py-1 bg-accent/20 text-foreground rounded-lg flex items-center gap-1">
                <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                {student.sessionTime || '16:00'}
                <span className="text-muted-foreground">({formatDurationAr(student.sessionDuration || 60)})</span>
              </span>
              <Badge variant="outline" className={cn(
                "text-[10px] gap-1",
                (student.sessionType || 'onsite') === 'online' 
                  ? "border-blue-500/30 text-blue-600 bg-blue-500/10"
                  : "border-orange-500/30 text-orange-600 bg-orange-500/10"
              )}>
                {(student.sessionType || 'onsite') === 'online' ? (
                  <><Monitor className="h-3 w-3" /> أونلاين</>
                ) : (
                  <><MapPin className="h-3 w-3" /> حضوري</>
                )}
              </Badge>
              {student.scheduleDays.map(d => (
                <span key={d.dayOfWeek} className={cn(
                  "text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full",
                  d.dayOfWeek === selectedDayOfWeek 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-primary/10 text-primary"
                )}>
                  {DAY_NAMES_SHORT_AR[d.dayOfWeek]}
                </span>
              ))}
            </div>
          </div>
          
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="icon" variant="ghost" className="shrink-0 h-9 w-9 text-muted-foreground hover:text-destructive">
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
                <AlertDialogAction onClick={onRemove} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  حذف
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardHeader>

      {student.phone && (
        <CardContent className="p-3 pt-0">
          <a 
            href={`https://wa.me/${student.phone.replace(/\D/g, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            <Phone className="h-3 w-3" />
            {student.phone}
          </a>
        </CardContent>
      )}
    </Card>
  );
};
