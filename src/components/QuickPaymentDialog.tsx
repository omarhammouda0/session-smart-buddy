import { useState, useEffect } from "react";
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
import { Student, AppSettings, PaymentMethod } from "@/types/student";
import { CreditCard, Banknote, Wallet } from "lucide-react";

interface QuickPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: Student | null;
  sessionDate: string;
  settings: AppSettings;
  onConfirm: (amount: number, method: PaymentMethod) => void;
}

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

export const QuickPaymentDialog = ({
  open,
  onOpenChange,
  student,
  sessionDate,
  settings,
  onConfirm,
}: QuickPaymentDialogProps) => {
  const [amount, setAmount] = useState<number>(0);
  const [method, setMethod] = useState<PaymentMethod>("cash");

  useEffect(() => {
    if (student && open) {
      const sessionPrice = getStudentSessionPrice(student, settings);
      setAmount(sessionPrice);
      setMethod("cash");
    }
  }, [student, open, settings]);

  if (!student) return null;

  const handleConfirm = () => {
    if (amount > 0) {
      onConfirm(amount, method);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]" dir="rtl">
        <DialogHeader>
          <DialogTitle>تسجيل دفعة سريعة</DialogTitle>
          <DialogDescription>
            تسجيل دفعة لـ {student.name} - حصة {sessionDate}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="amount">المبلغ (جنيه)</Label>
            <Input
              id="amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              min={0}
              className="text-left"
              dir="ltr"
            />
          </div>

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
                  className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                >
                  <Banknote className="mb-1 h-5 w-5" />
                  <span className="text-xs">كاش</span>
                </Label>
              </div>

              <div>
                <RadioGroupItem value="bank" id="quick-bank" className="peer sr-only" />
                <Label
                  htmlFor="quick-bank"
                  className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                >
                  <CreditCard className="mb-1 h-5 w-5" />
                  <span className="text-xs">بنك</span>
                </Label>
              </div>

              <div>
                <RadioGroupItem value="wallet" id="quick-wallet" className="peer sr-only" />
                <Label
                  htmlFor="quick-wallet"
                  className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                >
                  <Wallet className="mb-1 h-5 w-5" />
                  <span className="text-xs">محفظة</span>
                </Label>
              </div>
            </RadioGroup>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button onClick={handleConfirm} disabled={amount <= 0}>
            تأكيد الدفع
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
