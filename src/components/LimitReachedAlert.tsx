import { AlertTriangle, XCircle, MessageSquare, X, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Student } from '@/types/student';
import { CancellationRecord } from '@/hooks/useCancellationTracking';
import { formatShortDateAr } from '@/lib/arabicConstants';
import { cn } from '@/lib/utils';

interface LimitReachedAlertProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: Student;
  count: number;
  limit: number;
  exceeded: boolean;
  cancellations: CancellationRecord[];
  onNotifyParent: () => void;
  onDismiss: () => void;
  onViewDetails: () => void;
}

export const LimitReachedAlert = ({
  open,
  onOpenChange,
  student,
  count,
  limit,
  exceeded,
  cancellations,
  onNotifyParent,
  onDismiss,
  onViewDetails,
}: LimitReachedAlertProps) => {
  // Calculate cancellation rate
  // This would need the total scheduled sessions, simplified for now
  const totalSessions = student.sessions.filter(s => 
    s.status === 'completed' || s.status === 'cancelled'
  ).length;
  const cancellationRate = totalSessions > 0 
    ? Math.round((count / totalSessions) * 100) 
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle
            className={cn(
              'flex items-center gap-2',
              exceeded ? 'text-destructive' : 'text-amber-600 dark:text-amber-500'
            )}
          >
            {exceeded ? (
              <>
                <XCircle className="h-5 w-5" />
                تحذير: تجاوز الحد الأقصى
              </>
            ) : (
              <>
                <AlertTriangle className="h-5 w-5" />
                تنبيه: وصل للحد الأقصى
              </>
            )}
          </DialogTitle>
          <DialogDescription>{student.name}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Count info */}
          <div
            className={cn(
              'p-4 rounded-lg text-center',
              exceeded
                ? 'bg-destructive/10'
                : 'bg-amber-50 dark:bg-amber-950/30'
            )}
          >
            <p className="text-2xl font-bold">
              {count} <span className="text-muted-foreground text-lg">إلغاء</span>
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {exceeded
                ? `تجاوز الحد بـ ${count - limit} جلسة`
                : `الحد الأقصى المسموح: ${limit} جلسات`}
            </p>
          </div>

          {/* Cancellation list */}
          <div className="space-y-2">
            <p className="text-sm font-medium">الجلسات الملغاة:</p>
            <div className="max-h-32 overflow-y-auto space-y-1">
              {cancellations.slice(0, 5).map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between text-sm p-2 rounded bg-muted/50"
                >
                  <span>{formatShortDateAr(c.sessionDate)}</span>
                  <span className="text-muted-foreground text-xs">
                    {c.reason || 'بدون سبب'}
                  </span>
                </div>
              ))}
              {cancellations.length > 5 && (
                <p className="text-xs text-muted-foreground text-center">
                  +{cancellations.length - 5} إلغاءات أخرى
                </p>
              )}
            </div>
          </div>

          {/* Cancellation rate */}
          <div className="text-sm text-muted-foreground">
            نسبة الإلغاء: {cancellationRate}% من الجلسات
          </div>

          {/* Recommendations for exceeded */}
          {exceeded && (
            <div className="p-3 rounded-lg bg-muted/50 space-y-1">
              <p className="text-sm font-medium">الإجراءات الموصى بها:</p>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                <li>التحدث مع الطالب/الوالد</li>
                <li>مراجعة الالتزام بالجدول</li>
                <li>النظر في تعديل مواعيد الجلسات</li>
              </ul>
            </div>
          )}
        </div>

        <DialogFooter className="flex-row gap-2 sm:justify-start">
          {student.phone && (
            <Button onClick={onNotifyParent} className="gap-1">
              <MessageSquare className="h-4 w-4" />
              إبلاغ الوالد
            </Button>
          )}
          <Button variant="outline" onClick={onViewDetails} className="gap-1">
            <Eye className="h-4 w-4" />
            التفاصيل
          </Button>
          <Button variant="ghost" onClick={onDismiss} className="gap-1">
            <X className="h-4 w-4" />
            تجاهل
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
