import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { Student, AppSettings, PaymentMethod, StudentPayments } from "@/types/student";
import { CreditCard, Banknote, Wallet, Check, Clock, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuickPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: Student | null;
  sessionId: string;
  sessionDate: string;
  settings: AppSettings;
  payments?: StudentPayments[];
  onConfirm: (amount: number, method: PaymentMethod) => void;
}

// Helper to get session price for a student
const getStudentSessionPrice = (student: Student | null, settings: AppSettings): number => {
  if (!student) return 0;

  const defaultOnsite = 150;
  const defaultOnline = 120;

  if (student.useCustomSettings) {
    if (student.sessionType === "online") {
      return typeof student.customPriceOnline === "number" && student.customPriceOnline > 0
        ? student.customPriceOnline
        : (settings?.defaultPriceOnline ?? defaultOnline);
    }
    return typeof student.customPriceOnsite === "number" && student.customPriceOnsite > 0
      ? student.customPriceOnsite
      : (settings?.defaultPriceOnsite ?? defaultOnsite);
  }

  if (student.sessionType === "online") {
    return typeof settings?.defaultPriceOnline === "number" && settings.defaultPriceOnline > 0
      ? settings.defaultPriceOnline
      : defaultOnline;
  }
  return typeof settings?.defaultPriceOnsite === "number" && settings.defaultPriceOnsite > 0
    ? settings.defaultPriceOnsite
    : defaultOnsite;
};

export const QuickPaymentDialog = ({
  open,
  onOpenChange,
  student,
  sessionId,
  sessionDate,
  settings,
  payments,
  onConfirm,
}: QuickPaymentDialogProps) => {
  const [amount, setAmount] = useState<number>(0);
  const [method, setMethod] = useState<PaymentMethod>("cash");

  // Calculate SESSION payment info using SESSION ID (not date!)
  const sessionPaymentInfo = useMemo(() => {
    if (!student || !sessionId) {
      return {
        sessionPrice: 0,
        alreadyPaidForSession: 0,
        remainingForSession: 0,
        isFullyPaid: false,
        hasPartialPayment: false,
      };
    }

    const sessionPrice = getStudentSessionPrice(student, settings);

    // Get amount already paid for THIS SPECIFIC SESSION by session ID
    const date = new Date(sessionDate);
    const month = date.getMonth();
    const year = date.getFullYear();

    let alreadyPaidForSession = 0;

    if (payments) {
      const studentPayments = payments.find((p) => p.studentId === student.id);
      if (studentPayments) {
        const monthPayment = studentPayments.payments.find((p) => p.month === month && p.year === year);
        if (monthPayment && monthPayment.paymentRecords) {
          // Sum payments made for this SPECIFIC SESSION ID
          // Notes format: "session:abc123|date:2026-01-10"
          alreadyPaidForSession = monthPayment.paymentRecords
            .filter((record) => record.notes && new RegExp(`session:${sessionId}(?:\\||$)`).test(record.notes))
            .reduce((sum, record) => sum + record.amount, 0);
        }
      }
    }

    // Cap at session price (can't pay more than session cost)
    alreadyPaidForSession = Math.min(alreadyPaidForSession, sessionPrice);
    const remainingForSession = Math.max(0, sessionPrice - alreadyPaidForSession);
    const isFullyPaid = remainingForSession === 0 && sessionPrice > 0;
    const hasPartialPayment = alreadyPaidForSession > 0 && !isFullyPaid;

    return {
      sessionPrice,
      alreadyPaidForSession,
      remainingForSession,
      isFullyPaid,
      hasPartialPayment,
    };
  }, [student, sessionId, sessionDate, settings, payments]);

  // Quick amount buttons
  const quickAmounts = useMemo(() => {
    const { remainingForSession } = sessionPaymentInfo;
    const amounts: number[] = [];

    if (remainingForSession > 0) {
      // Add remaining (full payment for session)
      amounts.push(remainingForSession);

      // Add half if it makes sense (more than 50 and not same as remaining)
      if (remainingForSession > 50) {
        const half = Math.round(remainingForSession / 2);
        if (half !== remainingForSession && half > 0) {
          amounts.push(half);
        }
      }
    }

    return [...new Set(amounts)].sort((a, b) => a - b);
  }, [sessionPaymentInfo]);

  // Set default amount to REMAINING session fee
  useEffect(() => {
    if (student && open) {
      setAmount(sessionPaymentInfo.remainingForSession);
      setMethod("cash");
    }
  }, [student, open, sessionPaymentInfo.remainingForSession]);

  // Early return after all hooks
  if (!student) {
    return null;
  }

  const handleConfirm = () => {
    if (amount > 0 && amount <= sessionPaymentInfo.remainingForSession) {
      onConfirm(amount, method);
    }
  };

  // Handle amount change - cap at remaining
  const handleAmountChange = (value: number) => {
    const cappedValue = Math.min(Math.max(0, value), sessionPaymentInfo.remainingForSession);
    setAmount(cappedValue);
  };

  const progressPercentage =
    sessionPaymentInfo.sessionPrice > 0
      ? Math.round((sessionPaymentInfo.alreadyPaidForSession / sessionPaymentInfo.sessionPrice) * 100)
      : 0;

  // If session is fully paid, show success message
  if (sessionPaymentInfo.isFullyPaid) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[380px]" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-success/10">
                <Check className="h-5 w-5 text-success" />
              </div>
              حصة مدفوعة بالكامل
            </DialogTitle>
            <DialogDescription>
              {student.name} - حصة {sessionDate}
            </DialogDescription>
          </DialogHeader>

          <div className="py-6">
            <div className="p-4 rounded-xl bg-success/10 border-2 border-success/30 text-center">
              <Check className="h-12 w-12 text-success mx-auto mb-3" />
              <p className="font-bold text-success text-lg">تم دفع رسوم هذه الحصة</p>
              <p className="text-sm text-muted-foreground mt-2">
                المبلغ: {sessionPaymentInfo.sessionPrice.toLocaleString()} جنيه
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => onOpenChange(false)} className="w-full rounded-xl">
              إغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div
              className={cn(
                "p-2 rounded-lg",
                sessionPaymentInfo.hasPartialPayment ? "bg-amber-500/10" : "bg-primary/10",
              )}
            >
              {sessionPaymentInfo.hasPartialPayment ? (
                <Clock className="h-5 w-5 text-amber-500" />
              ) : (
                <Banknote className="h-5 w-5 text-primary" />
              )}
            </div>
            دفع رسوم الحصة
          </DialogTitle>
          <DialogDescription>
            {student.name} - حصة {sessionDate}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Session Payment Status - Always show both lines */}
          <div
            className={cn(
              "p-4 rounded-xl border-2",
              sessionPaymentInfo.hasPartialPayment ? "bg-amber-500/5 border-amber-500/30" : "bg-muted/50 border-border",
            )}
          >
            {/* المطلوب للحصة - Session Price (always shown) */}
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">المطلوب للحصة:</span>
              <span className="text-lg font-bold text-primary">
                {sessionPaymentInfo.sessionPrice.toLocaleString()} جنيه
              </span>
            </div>

            {/* المدفوع - Already paid (always shown) */}
            <div className="flex justify-between items-center mt-3 pt-3 border-t border-border/50">
              <span className="text-sm font-medium">المدفوع:</span>
              <span
                className={cn(
                  "text-lg font-bold",
                  sessionPaymentInfo.alreadyPaidForSession > 0 ? "text-emerald-600" : "text-muted-foreground",
                )}
              >
                {sessionPaymentInfo.alreadyPaidForSession.toLocaleString()} جنيه
              </span>
            </div>

            {/* Progress Bar (only if partial payment exists) */}
            {sessionPaymentInfo.hasPartialPayment && (
              <div className="mt-3">
                <Progress value={progressPercentage} className="h-2 [&>div]:bg-emerald-500" />
                <div className="text-xs text-muted-foreground mt-1 text-center">{progressPercentage}% مدفوع</div>
              </div>
            )}

            {/* المتبقي - Remaining (only if partial payment) */}
            {sessionPaymentInfo.hasPartialPayment && (
              <div className="flex justify-between items-center mt-3 pt-3 border-t border-border/50">
                <span className="text-sm font-medium">المتبقي:</span>
                <span className="text-xl font-bold text-amber-600">
                  {sessionPaymentInfo.remainingForSession.toLocaleString()} جنيه
                </span>
              </div>
            )}
          </div>

          {/* Amount Input */}
          <div className="space-y-2">
            <Label htmlFor="amount">المبلغ المدفوع (جنيه)</Label>
            <Input
              id="amount"
              type="number"
              value={amount}
              onChange={(e) => handleAmountChange(Number(e.target.value))}
              min={0}
              max={sessionPaymentInfo.remainingForSession}
              className="text-left text-lg font-bold h-12"
              dir="ltr"
            />
            <p className="text-xs text-muted-foreground">
              الحد الأقصى: {sessionPaymentInfo.remainingForSession.toLocaleString()} جنيه
            </p>

            {/* Quick Amount Buttons */}
            {quickAmounts.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {quickAmounts.map((quickAmount) => (
                  <Button
                    key={quickAmount}
                    type="button"
                    variant={amount === quickAmount ? "default" : "outline"}
                    size="sm"
                    onClick={() => setAmount(quickAmount)}
                    className={cn("text-xs", amount === quickAmount && "ring-2 ring-primary/30")}
                  >
                    {quickAmount === sessionPaymentInfo.remainingForSession
                      ? sessionPaymentInfo.hasPartialPayment
                        ? `كامل المتبقي (${quickAmount})`
                        : `كامل المبلغ (${quickAmount})`
                      : `${quickAmount} جنيه`}
                  </Button>
                ))}
              </div>
            )}
          </div>

          {/* Payment Method */}
          <div className="space-y-2">
            <Label>طريقة الدفع</Label>
            <RadioGroup
              value={method}
              onValueChange={(value) => setMethod(value as PaymentMethod)}
              className="grid grid-cols-3 gap-2"
            >
              <div>
                <RadioGroupItem value="cash" id="quick-cash" className="peer sr-only" />
                <Label
                  htmlFor="quick-cash"
                  className="flex flex-col items-center justify-center rounded-xl border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 cursor-pointer transition-all"
                >
                  <Banknote className="mb-1.5 h-5 w-5" />
                  <span className="text-xs font-medium">كاش</span>
                </Label>
              </div>

              <div>
                <RadioGroupItem value="bank" id="quick-bank" className="peer sr-only" />
                <Label
                  htmlFor="quick-bank"
                  className="flex flex-col items-center justify-center rounded-xl border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 cursor-pointer transition-all"
                >
                  <CreditCard className="mb-1.5 h-5 w-5" />
                  <span className="text-xs font-medium">بنك</span>
                </Label>
              </div>

              <div>
                <RadioGroupItem value="wallet" id="quick-wallet" className="peer sr-only" />
                <Label
                  htmlFor="quick-wallet"
                  className="flex flex-col items-center justify-center rounded-xl border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 cursor-pointer transition-all"
                >
                  <Wallet className="mb-1.5 h-5 w-5" />
                  <span className="text-xs font-medium">محفظة</span>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Warning if somehow amount exceeds remaining */}
          {amount > sessionPaymentInfo.remainingForSession && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-sm">
              <AlertCircle className="h-4 w-4 text-rose-500 mt-0.5 shrink-0" />
              <span className="text-rose-700">
                لا يمكن دفع أكثر من المتبقي ({sessionPaymentInfo.remainingForSession} جنيه)
              </span>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto rounded-xl">
            إلغاء
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={amount <= 0 || amount > sessionPaymentInfo.remainingForSession}
            className="w-full sm:w-auto rounded-xl bg-gradient-to-r from-primary to-primary/80 shadow-lg"
          >
            تأكيد الدفع ({amount.toLocaleString()} جنيه)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
