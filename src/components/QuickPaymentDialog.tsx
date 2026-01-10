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
  sessionDate: string;
  settings: AppSettings;
  payments?: StudentPayments[]; // ✅ NEW: Add payments to calculate remaining
  onConfirm: (amount: number, method: PaymentMethod) => void;
}

// Helper to get session price
const getStudentSessionPrice = (student: Student, settings: AppSettings): number => {
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

// Helper to count billable sessions in a month
const getStudentMonthStats = (student: Student, month: number, year: number) => {
  const sessions = student.sessions.filter((s) => {
    const sessionDate = new Date(s.date);
    return sessionDate.getMonth() === month && sessionDate.getFullYear() === year;
  });

  const completed = sessions.filter((s) => s.status === "completed").length;
  const scheduled = sessions.filter((s) => s.status === "scheduled").length;

  return { completed, scheduled, billable: completed + scheduled };
};

export const QuickPaymentDialog = ({
  open,
  onOpenChange,
  student,
  sessionDate,
  settings,
  payments,
  onConfirm,
}: QuickPaymentDialogProps) => {
  const [amount, setAmount] = useState<number>(0);
  const [method, setMethod] = useState<PaymentMethod>("cash");

  // ✅ Calculate payment info for this month
  const paymentInfo = useMemo(() => {
    if (!student || !sessionDate) {
      return {
        sessionPrice: 0,
        monthlyDue: 0,
        alreadyPaid: 0,
        remaining: 0,
        status: "unpaid" as const,
        billableSessions: 0,
      };
    }

    const date = new Date(sessionDate);
    const month = date.getMonth();
    const year = date.getFullYear();

    const sessionPrice = getStudentSessionPrice(student, settings);
    const { billable } = getStudentMonthStats(student, month, year);
    const monthlyDue = billable * sessionPrice;

    // Get already paid amount from payments
    let alreadyPaid = 0;
    let status: "unpaid" | "partial" | "paid" = "unpaid";

    if (payments) {
      const studentPayments = payments.find((p) => p.studentId === student.id);
      if (studentPayments) {
        const monthPayment = studentPayments.payments.find((p) => p.month === month && p.year === year);
        if (monthPayment) {
          alreadyPaid = monthPayment.amountPaid || monthPayment.amount || 0;
          if (alreadyPaid >= monthlyDue && monthlyDue > 0) {
            status = "paid";
          } else if (alreadyPaid > 0) {
            status = "partial";
          }
        }
      }
    }

    const remaining = Math.max(0, monthlyDue - alreadyPaid);

    return {
      sessionPrice,
      monthlyDue,
      alreadyPaid,
      remaining,
      status,
      billableSessions: billable,
    };
  }, [student, sessionDate, settings, payments]);

  // ✅ Set default amount to REMAINING, not session price
  useEffect(() => {
    if (student && open) {
      // Default to remaining amount if there's partial payment, otherwise session price
      const defaultAmount = paymentInfo.remaining > 0 ? paymentInfo.remaining : paymentInfo.sessionPrice;
      setAmount(defaultAmount);
      setMethod("cash");
    }
  }, [student, open, paymentInfo]);

  if (!student) return null;

  const handleConfirm = () => {
    if (amount > 0) {
      onConfirm(amount, method);
    }
  };

  // Quick amount buttons
  const quickAmounts = useMemo(() => {
    const amounts: number[] = [];
    const { sessionPrice, remaining } = paymentInfo;

    // Add session price if different from remaining
    if (sessionPrice > 0 && sessionPrice !== remaining) {
      amounts.push(sessionPrice);
    }

    // Add remaining if there is one
    if (remaining > 0) {
      amounts.push(remaining);
    }

    // Add monthly due if different
    if (paymentInfo.monthlyDue > 0 && paymentInfo.monthlyDue !== remaining && paymentInfo.monthlyDue !== sessionPrice) {
      amounts.push(paymentInfo.monthlyDue);
    }

    // Sort and remove duplicates
    return [...new Set(amounts)].sort((a, b) => a - b);
  }, [paymentInfo]);

  const progressPercentage =
    paymentInfo.monthlyDue > 0
      ? Math.min(100, Math.round((paymentInfo.alreadyPaid / paymentInfo.monthlyDue) * 100))
      : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div
              className={cn(
                "p-2 rounded-lg",
                paymentInfo.status === "paid"
                  ? "bg-success/10"
                  : paymentInfo.status === "partial"
                    ? "bg-amber-500/10"
                    : "bg-primary/10",
              )}
            >
              {paymentInfo.status === "paid" ? (
                <Check className="h-5 w-5 text-success" />
              ) : paymentInfo.status === "partial" ? (
                <Clock className="h-5 w-5 text-amber-500" />
              ) : (
                <Banknote className="h-5 w-5 text-primary" />
              )}
            </div>
            تسجيل دفعة سريعة
          </DialogTitle>
          <DialogDescription>
            {student.name} - حصة {sessionDate}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* ✅ NEW: Payment Status Summary */}
          <div
            className={cn(
              "p-4 rounded-xl border-2",
              paymentInfo.status === "paid"
                ? "bg-success/5 border-success/30"
                : paymentInfo.status === "partial"
                  ? "bg-amber-500/5 border-amber-500/30"
                  : "bg-muted/50 border-border",
            )}
          >
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-muted-foreground">حالة الشهر:</span>
              <span
                className={cn(
                  "text-sm font-bold px-2 py-0.5 rounded-full",
                  paymentInfo.status === "paid"
                    ? "bg-success/20 text-success"
                    : paymentInfo.status === "partial"
                      ? "bg-amber-500/20 text-amber-600"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {paymentInfo.status === "paid"
                  ? "مدفوع بالكامل"
                  : paymentInfo.status === "partial"
                    ? "دفع جزئي"
                    : "غير مدفوع"}
              </span>
            </div>

            {/* Progress Bar */}
            {paymentInfo.monthlyDue > 0 && (
              <div className="space-y-1.5">
                <Progress
                  value={progressPercentage}
                  className={cn(
                    "h-2",
                    paymentInfo.status === "paid"
                      ? "[&>div]:bg-success"
                      : paymentInfo.status === "partial"
                        ? "[&>div]:bg-amber-500"
                        : "",
                  )}
                />
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">
                    المدفوع:{" "}
                    <span className="font-bold text-foreground">{paymentInfo.alreadyPaid.toLocaleString()}</span> جنيه
                  </span>
                  <span className="text-muted-foreground">
                    من <span className="font-bold text-foreground">{paymentInfo.monthlyDue.toLocaleString()}</span> جنيه
                  </span>
                </div>
              </div>
            )}

            {/* Remaining Amount Highlight */}
            {paymentInfo.remaining > 0 && (
              <div className="mt-3 pt-3 border-t border-border/50 flex justify-between items-center">
                <span className="text-sm font-medium">المتبقي:</span>
                <span
                  className={cn(
                    "text-lg font-bold",
                    paymentInfo.status === "partial" ? "text-amber-600" : "text-primary",
                  )}
                >
                  {paymentInfo.remaining.toLocaleString()} جنيه
                </span>
              </div>
            )}

            {/* Session Info */}
            <div className="mt-2 pt-2 border-t border-border/50 text-xs text-muted-foreground">
              سعر الحصة: {paymentInfo.sessionPrice} جنيه × {paymentInfo.billableSessions} حصص
            </div>
          </div>

          {/* Amount Input */}
          <div className="space-y-2">
            <Label htmlFor="amount">المبلغ المدفوع (جنيه)</Label>
            <Input
              id="amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              min={0}
              className="text-left text-lg font-bold h-12"
              dir="ltr"
            />

            {/* ✅ NEW: Quick Amount Buttons */}
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
                    {quickAmount === paymentInfo.remaining && paymentInfo.status === "partial"
                      ? `المتبقي (${quickAmount})`
                      : quickAmount === paymentInfo.sessionPrice
                        ? `حصة (${quickAmount})`
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
                  className="flex flex-col items-center justify-center rounded-xl border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 [&:has([data-state=checked])]:border-primary cursor-pointer transition-all"
                >
                  <Banknote className="mb-1.5 h-5 w-5" />
                  <span className="text-xs font-medium">كاش</span>
                </Label>
              </div>

              <div>
                <RadioGroupItem value="bank" id="quick-bank" className="peer sr-only" />
                <Label
                  htmlFor="quick-bank"
                  className="flex flex-col items-center justify-center rounded-xl border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 [&:has([data-state=checked])]:border-primary cursor-pointer transition-all"
                >
                  <CreditCard className="mb-1.5 h-5 w-5" />
                  <span className="text-xs font-medium">بنك</span>
                </Label>
              </div>

              <div>
                <RadioGroupItem value="wallet" id="quick-wallet" className="peer sr-only" />
                <Label
                  htmlFor="quick-wallet"
                  className="flex flex-col items-center justify-center rounded-xl border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 [&:has([data-state=checked])]:border-primary cursor-pointer transition-all"
                >
                  <Wallet className="mb-1.5 h-5 w-5" />
                  <span className="text-xs font-medium">محفظة</span>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Warning if paying more than remaining */}
          {paymentInfo.remaining > 0 && amount > paymentInfo.remaining && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-sm">
              <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
              <span className="text-amber-700">
                المبلغ المدخل ({amount} جنيه) أكبر من المتبقي ({paymentInfo.remaining} جنيه)
              </span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
            إلغاء
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={amount <= 0}
            className="rounded-xl bg-gradient-to-r from-primary to-primary/80 shadow-lg"
          >
            تأكيد الدفع ({amount.toLocaleString()} جنيه)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
