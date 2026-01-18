import { useState } from "react";
import { CheckCircle2, XCircle, Trash2, AlertTriangle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Student, Session } from "@/types/student";
import { formatShortDateAr } from "@/lib/arabicConstants";
import { cn } from "@/lib/utils";

interface SessionCompletionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: Student;
  session: Session;
  onComplete: () => void;
  onCancel: (reason?: string) => void;
  onDelete: () => void;
  isAutoTriggered?: boolean; // True when triggered by session end time
}

type CompletionAction = "complete" | "cancel" | "delete" | null;

export function SessionCompletionDialog({
  open,
  onOpenChange,
  student,
  session,
  onComplete,
  onCancel,
  onDelete,
  isAutoTriggered = false,
}: SessionCompletionDialogProps) {
  const [action, setAction] = useState<CompletionAction>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const sessionTime = session.time || student.sessionTime || "16:00";

  const handleConfirm = () => {
    switch (action) {
      case "complete":
        onComplete();
        break;
      case "cancel":
        onCancel(cancelReason || undefined);
        break;
      case "delete":
        if (confirmDelete) {
          onDelete();
        } else {
          setConfirmDelete(true);
          return; // Don't close dialog
        }
        break;
    }
    resetAndClose();
  };

  const resetAndClose = () => {
    setAction(null);
    setCancelReason("");
    setConfirmDelete(false);
    onOpenChange(false);
  };

  const getActionDetails = () => {
    switch (action) {
      case "complete":
        return {
          title: "تأكيد إكمال الحصة",
          description: `هل تريد تسجيل حصة ${student.name} في ${sessionTime} كمكتملة؟`,
          confirmText: "تأكيد الإكمال",
          confirmClass: "bg-emerald-600 hover:bg-emerald-700",
        };
      case "cancel":
        return {
          title: "إلغاء الحصة",
          description: `سيتم تسجيل حصة ${student.name} كملغاة وسيتم احتسابها في سجل الإلغاءات.`,
          confirmText: "تأكيد الإلغاء",
          confirmClass: "bg-amber-600 hover:bg-amber-700",
        };
      case "delete":
        return {
          title: confirmDelete ? "⚠️ تأكيد الحذف النهائي" : "حذف الحصة نهائياً",
          description: confirmDelete
            ? `هل أنت متأكد؟ سيتم حذف الحصة نهائياً من كل مكان ولن يتم احتسابها في أي سجلات.`
            : `سيتم حذف حصة ${student.name} نهائياً من النظام. لن يتم احتسابها في المدفوعات أو سجل الإلغاءات.`,
          confirmText: confirmDelete ? "نعم، احذف نهائياً" : "حذف الحصة",
          confirmClass: "bg-destructive hover:bg-destructive/90",
        };
      default:
        return null;
    }
  };

  const actionDetails = getActionDetails();

  return (
    <Dialog open={open} onOpenChange={resetAndClose}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            {action === null ? (
              isAutoTriggered ? (
                <>
                  <Clock className="h-5 w-5 text-primary" />
                  انتهت الحصة - تأكيد الحالة
                </>
              ) : (
                <>تأكيد حالة الحصة</>
              )
            ) : (
              actionDetails?.title
            )}
          </DialogTitle>
          <DialogDescription>
            {action === null ? (
              <>
                {isAutoTriggered && (
                  <span className="block text-primary font-medium mb-1">
                    ⏰ انتهى وقت الحصة
                  </span>
                )}
                <span className="font-semibold">{student.name}</span> -{" "}
                {formatShortDateAr(session.date)} الساعة {sessionTime}
              </>
            ) : (
              actionDetails?.description
            )}
          </DialogDescription>
        </DialogHeader>

        {action === null ? (
          <div className="space-y-3 py-4">
            <Button
              className="w-full gap-2 h-12 text-base bg-emerald-500 hover:bg-emerald-600 text-white"
              onClick={() => setAction("complete")}
            >
              <CheckCircle2 className="h-5 w-5" />
              تم إكمال الحصة ✓
            </Button>

            <Button
              variant="outline"
              className="w-full gap-2 h-12 text-base border-amber-500/50 text-amber-600 hover:bg-amber-500/10"
              onClick={() => setAction("cancel")}
            >
              <XCircle className="h-5 w-5" />
              إلغاء الحصة
            </Button>

            <Button
              variant="outline"
              className="w-full gap-2 h-12 text-base border-destructive/50 text-destructive hover:bg-destructive/10"
              onClick={() => setAction("delete")}
            >
              <Trash2 className="h-5 w-5" />
              حذف نهائي
            </Button>
          </div>
        ) : (
          <div className="py-4 space-y-4">
            {action === "cancel" && (
              <div className="space-y-2">
                <Label htmlFor="cancelReason">سبب الإلغاء (اختياري)</Label>
                <Textarea
                  id="cancelReason"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="مثال: الطالب مريض، ظروف طارئة..."
                  className="resize-none"
                  rows={2}
                />
              </div>
            )}

            {action === "delete" && confirmDelete && (
              <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <p className="text-sm text-destructive">
                  هذا الإجراء لا يمكن التراجع عنه. سيتم حذف الحصة من جميع السجلات بشكل دائم.
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          {action === null ? (
            <Button variant="outline" onClick={resetAndClose} className="w-full sm:w-auto">
              إغلاق
            </Button>
          ) : (
            <>
              <Button variant="outline" className="w-full sm:w-auto" onClick={() => {
                if (confirmDelete) {
                  setConfirmDelete(false);
                } else {
                  setAction(null);
                }
              }}>
                رجوع
              </Button>
              <Button className={cn("w-full sm:w-auto", actionDetails?.confirmClass)} onClick={handleConfirm}>
                {actionDetails?.confirmText}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
