import { useState } from "react";
import { AlertTriangle, XCircle } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Student, Session } from "@/types/student";
import { formatShortDateAr } from "@/lib/arabicConstants";
import { cn } from "@/lib/utils";

interface CancelSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: Student;
  session: Session;
  currentCount: number;
  onConfirm: (reason?: string) => void;
  onMarkAsVacation?: () => void;
}

export const CancelSessionDialog = ({
  open,
  onOpenChange,
  student,
  session,
  currentCount,
  onConfirm,
  onMarkAsVacation,
}: CancelSessionDialogProps) => {
  const [reason, setReason] = useState("");

  const limit = student.cancellationPolicy?.monthlyLimit ?? null;
  const newCount = currentCount + 1;
  const willReachLimit = limit !== null && newCount === limit;
  const willExceedLimit = limit !== null && newCount > limit;

  // Format month and year in Arabic
  const sessionMonth = format(new Date(session.date), "MMMM yyyy", { locale: ar });

  const handleConfirm = () => {
    onConfirm(reason.trim() || undefined);
    setReason("");
    onOpenChange(false);
  };

  const handleVacation = () => {
    onMarkAsVacation?.();
    setReason("");
    onOpenChange(false);
  };

  const handleClose = () => {
    setReason("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-destructive" />
            إلغاء الجلسة
          </DialogTitle>
          <DialogDescription>
            {student.name} • {formatShortDateAr(session.date)}
            {session.time && ` • ${session.time}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Reason Input */}
          <div className="space-y-2">
            <Label htmlFor="cancel-reason">السبب (اختياري)</Label>
            <Input
              id="cancel-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="مثال: مريض، امتحان، ظرف عائلي"
            />
          </div>

          {/* Warning about limit */}
          {limit !== null && (
            <div
              className={cn(
                "p-3 rounded-lg border-2",
                willExceedLimit
                  ? "bg-destructive/10 border-destructive"
                  : willReachLimit
                    ? "bg-amber-50 dark:bg-amber-950/30 border-amber-500"
                    : "bg-muted/50 border-border",
              )}
            >
              <div className="flex items-start gap-2">
                <AlertTriangle
                  className={cn(
                    "h-5 w-5 shrink-0 mt-0.5",
                    willExceedLimit
                      ? "text-destructive"
                      : willReachLimit
                        ? "text-amber-600 dark:text-amber-500"
                        : "text-muted-foreground",
                  )}
                />
                <div className="space-y-2 flex-1">
                  <p
                    className={cn(
                      "font-semibold text-sm",
                      willExceedLimit
                        ? "text-destructive"
                        : willReachLimit
                          ? "text-amber-700 dark:text-amber-400"
                          : "text-foreground",
                    )}
                  >
                    {willExceedLimit
                      ? "🔴 تجاوز الحد الأقصى للإلغاءات"
                      : willReachLimit
                        ? "⚠️ الوصول للحد الأقصى"
                        : "تتبع الإلغاءات"}
                  </p>

                  <div className="text-sm text-muted-foreground space-y-1">
                    <div className="flex gap-2 items-center">
                      <span className="text-muted-foreground">الطالب:</span>
                      <span className="font-semibold text-foreground" style={{ unicodeBidi: "plaintext" }}>
                        {student.name}
                      </span>
                    </div>

                    <div className="flex gap-2 items-center">
                      <span className="text-muted-foreground">الشهر:</span>
                      <span className="font-semibold text-foreground">{sessionMonth}</span>
                    </div>

                    <div className="flex gap-2 items-center">
                      <span className="text-muted-foreground">الإلغاءات:</span>
                      <span
                        className={cn(
                          "font-semibold",
                          willExceedLimit
                            ? "text-destructive"
                            : willReachLimit
                              ? "text-amber-700 dark:text-amber-400"
                              : "text-foreground",
                        )}
                      >
                        {newCount} من {limit}
                      </span>
                    </div>
                  </div>

                  {(willReachLimit || willExceedLimit) && (
                    <p className="text-xs text-muted-foreground pt-1 border-t">
                      {student.cancellationPolicy?.autoNotifyParent
                        ? "📱 سيتم إبلاغ ولي الأمر تلقائياً"
                        : "💡 يمكنك إبلاغ ولي الأمر يدوياً"}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Vacation suggestion for multiple cancellations */}
          {onMarkAsVacation && (
            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-700 dark:text-blue-400">
                💡 إذا كانت إجازة، يمكنك تحديدها كـ "إجازة" بدلاً من "إلغاء"
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-500 mt-1">(جلسات الإجازة لا تحتسب في حد الإلغاء)</p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-row-reverse gap-2">
          <Button variant="outline" onClick={handleClose}>
            رجوع
          </Button>
          {onMarkAsVacation && (
            <Button variant="secondary" onClick={handleVacation} className="gap-1">
              تحديد كإجازة
            </Button>
          )}
          <Button variant="destructive" onClick={handleConfirm} className="gap-1">
            نعم، إلغاء
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
