import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { XCircle, AlertTriangle } from 'lucide-react';
import { ConflictResult, formatTimeAr } from '@/hooks/useConflictDetection';
import { cn } from '@/lib/utils';

interface RestoreConflictDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conflictResult: ConflictResult;
  sessionInfo: {
    studentName: string;
    date: string;
    time: string;
  };
  onConfirm: () => void;
}

export const RestoreConflictDialog = ({
  open,
  onOpenChange,
  conflictResult,
  sessionInfo,
  onConfirm,
}: RestoreConflictDialogProps) => {
  const isError = conflictResult.severity === 'error';
  const Icon = isError ? XCircle : AlertTriangle;
  const iconColor = isError ? 'text-destructive' : 'text-warning';

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent dir="rtl" className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Icon className={cn("h-5 w-5", iconColor)} />
            {isError ? '❌ لا يمكن استعادة الجلسة' : '⚠️ تحذير'}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                {isError
                  ? 'يوجد تعارض مع جلسة أخرى'
                  : 'استعادة هذه الجلسة ستكون قريبة جداً من جلسة أخرى'}
              </p>

              {/* Session being restored */}
              <div className="p-3 rounded-lg bg-muted/50 border">
                <p className="text-xs text-muted-foreground mb-1">الجلسة المُستعادة:</p>
                <p className="font-medium">{sessionInfo.studentName}</p>
                <p className="text-sm text-muted-foreground">
                  {sessionInfo.date} • {formatTimeAr(sessionInfo.time)}
                </p>
              </div>

              {/* Conflicting sessions */}
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  {isError ? 'تتعارض مع:' : 'قريبة من:'}
                </p>
                {conflictResult.conflicts.map((conflict, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "p-3 rounded-lg border",
                      isError ? "bg-destructive/5 border-destructive/20" : "bg-warning/5 border-warning/20"
                    )}
                  >
                    <p className="font-medium">{conflict.student.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatTimeAr(conflict.session.time || conflict.student.sessionTime || '16:00')}
                      {conflict.type === 'close' && conflict.gap !== undefined && (
                        <span className="mr-1">(فاصل {conflict.gap} دقيقة فقط)</span>
                      )}
                    </p>
                  </div>
                ))}
              </div>

              {isError && (
                <p className="text-sm text-muted-foreground">
                  الرجاء حذف أو تعديل الجلسة المتعارضة أولاً
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row-reverse gap-2">
          <AlertDialogCancel>
            {isError ? 'حسناً' : 'إلغاء'}
          </AlertDialogCancel>
          {!isError && (
            <AlertDialogAction onClick={onConfirm}>
              نعم، استعادة
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
