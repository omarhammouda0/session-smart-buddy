import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DollarSign,
  Check,
  Clock,
  Calendar,
  User,
  CreditCard,
  Banknote,
  Smartphone,
  Users,
  Link,
} from 'lucide-react';
import { StudentGroup, GroupSession, PaymentMethod, Student } from '@/types/student';
import { cn } from '@/lib/utils';

interface GroupPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: StudentGroup;
  session: GroupSession;
  students?: Student[]; // All students to find linked ones
  onRecordPayment: (
    memberId: string,
    memberName: string,
    amount: number,
    method: PaymentMethod,
    linkedStudentId?: string, // If member is linked to a real student
    sessionDate?: string,
    groupId?: string,
    groupName?: string
  ) => void;
}

// Format time in Arabic
const formatTimeAr = (time: string): string => {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'م' : 'ص';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
};

const PAYMENT_METHODS: { value: PaymentMethod; label: string; icon: React.ReactNode }[] = [
  { value: 'cash', label: 'نقدي', icon: <Banknote className="h-4 w-4" /> },
  { value: 'bank', label: 'تحويل بنكي', icon: <CreditCard className="h-4 w-4" /> },
  { value: 'wallet', label: 'محفظة إلكترونية', icon: <Smartphone className="h-4 w-4" /> },
];

export const GroupPaymentDialog = ({
  open,
  onOpenChange,
  group,
  session,
  students = [],
  onRecordPayment,
}: GroupPaymentDialogProps) => {
  const activeMembers = group.members.filter(m => m.isActive);
  const sessionDate = new Date(session.date);

  // Track which members have been selected for payment
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  // Track custom amounts per member
  const [customAmounts, setCustomAmounts] = useState<Record<string, number>>({});
  // Payment method
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  // Track paid members in this session (for UI feedback)
  const [paidMembers, setPaidMembers] = useState<Set<string>>(new Set());

  // Find linked students for each member
  const memberStudentLinks = useMemo(() => {
    const links: Record<string, Student | undefined> = {};
    activeMembers.forEach(member => {
      // Check if studentId is a valid UUID (not a group-generated ID)
      if (member.studentId && !member.studentId.startsWith('group_')) {
        const linkedStudent = students.find(s => s.id === member.studentId);
        if (linkedStudent) {
          links[member.studentId] = linkedStudent;
        }
      }
    });
    return links;
  }, [activeMembers, students]);

  // Calculate total
  const totalAmount = useMemo(() => {
    let total = 0;
    selectedMembers.forEach(memberId => {
      const member = activeMembers.find(m => m.studentId === memberId);
      if (member) {
        const amount = customAmounts[memberId] ?? member.customPrice ?? group.defaultPricePerStudent;
        total += amount;
      }
    });
    return total;
  }, [selectedMembers, customAmounts, activeMembers, group.defaultPricePerStudent]);

  const toggleMember = (memberId: string) => {
    setSelectedMembers(prev => {
      const next = new Set(prev);
      if (next.has(memberId)) {
        next.delete(memberId);
      } else {
        next.add(memberId);
      }
      return next;
    });
  };

  const selectAll = () => {
    const allIds = activeMembers.map(m => m.studentId);
    setSelectedMembers(new Set(allIds));
  };

  const deselectAll = () => {
    setSelectedMembers(new Set());
  };

  const handlePayment = () => {
    selectedMembers.forEach(memberId => {
      const member = activeMembers.find(m => m.studentId === memberId);
      if (member) {
        const amount = customAmounts[memberId] ?? member.customPrice ?? group.defaultPricePerStudent;
        const linkedStudent = memberStudentLinks[memberId];

        onRecordPayment(
          memberId,
          member.studentName,
          amount,
          paymentMethod,
          linkedStudent?.id, // Pass linked student ID if exists
          session.date,
          group.id,
          group.name
        );
        setPaidMembers(prev => new Set(prev).add(memberId));
      }
    });
    // Clear selection after payment
    setSelectedMembers(new Set());
  };

  const handleClose = () => {
    setSelectedMembers(new Set());
    setCustomAmounts({});
    setPaidMembers(new Set());
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col" dir="rtl">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-amber-500" />
            دفع المجموعة - {group.name}
          </DialogTitle>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
            <Calendar className="h-4 w-4" />
            <span>
              {sessionDate.toLocaleDateString('ar-EG', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </span>
            <span className="mx-1">•</span>
            <Clock className="h-4 w-4" />
            <span>{formatTimeAr(session.time || group.sessionTime)}</span>
          </div>
        </DialogHeader>

        <DialogBody>
          <div className="space-y-4 pt-2">
            {/* Payment Method Selection */}
            <div className="space-y-2">
              <Label>طريقة الدفع</Label>
              <div className="flex gap-2">
                {PAYMENT_METHODS.map(method => (
                  <button
                    key={method.value}
                    type="button"
                    onClick={() => setPaymentMethod(method.value)}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border transition-all",
                      paymentMethod === method.value
                        ? 'bg-amber-500 text-white border-amber-500'
                        : 'bg-card border-border hover:border-amber-300'
                    )}
                  >
                    {method.icon}
                    <span className="text-sm">{method.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center justify-between">
              <Label>اختر الطلاب للدفع ({selectedMembers.size}/{activeMembers.length})</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={selectAll}
                  className="h-7 text-xs"
                >
                  تحديد الكل
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={deselectAll}
                  className="h-7 text-xs"
                >
                  إلغاء التحديد
                </Button>
              </div>
            </div>

            {/* Members List */}
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {activeMembers.map(member => {
                const isSelected = selectedMembers.has(member.studentId);
                const isPaid = paidMembers.has(member.studentId);
                const memberPrice = member.customPrice ?? group.defaultPricePerStudent;
                const currentAmount = customAmounts[member.studentId] ?? memberPrice;
                const linkedStudent = memberStudentLinks[member.studentId];

                return (
                  <div
                    key={member.studentId}
                    className={cn(
                      "p-3 rounded-lg border transition-all cursor-pointer",
                      isPaid
                        ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700"
                        : isSelected
                          ? "bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700"
                          : "bg-card border-border hover:border-amber-200"
                    )}
                    onClick={() => !isPaid && toggleMember(member.studentId)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {isPaid ? (
                          <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
                            <Check className="h-4 w-4 text-white" />
                          </div>
                        ) : (
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleMember(member.studentId)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        )}
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center",
                            linkedStudent ? "bg-primary/10" : "bg-violet-100 dark:bg-violet-900/30"
                          )}>
                            {linkedStudent ? (
                              <User className="h-4 w-4 text-primary" />
                            ) : (
                              <Users className="h-4 w-4 text-violet-500" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{member.studentName}</p>
                            <div className="flex items-center gap-1">
                              {isPaid && (
                                <span className="text-xs text-emerald-600 dark:text-emerald-400">✓ تم الدفع</span>
                              )}
                              {linkedStudent && !isPaid && (
                                <span className="text-xs text-primary flex items-center gap-0.5">
                                  <Link className="h-3 w-3" />
                                  مرتبط بسجل الطالب
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {isSelected && !isPaid ? (
                          <Input
                            type="number"
                            min="0"
                            value={currentAmount}
                            onChange={(e) => {
                              e.stopPropagation();
                              setCustomAmounts(prev => ({
                                ...prev,
                                [member.studentId]: Number(e.target.value) || 0
                              }));
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-20 h-8 text-center text-sm"
                          />
                        ) : (
                          <Badge variant="outline" className={cn(
                            "text-sm",
                            isPaid && "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
                          )}>
                            {memberPrice} ج.م
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Total */}
            {selectedMembers.size > 0 && (
              <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-amber-600" />
                    <span className="font-medium text-amber-700 dark:text-amber-300">
                      الإجمالي ({selectedMembers.size} طالب)
                    </span>
                  </div>
                  <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                    {totalAmount} ج.م
                  </span>
                </div>
              </div>
            )}

            {/* Info about linked students */}
            {Object.keys(memberStudentLinks).length > 0 && (
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-xs">
                <div className="flex items-center gap-1.5 text-primary font-medium mb-1">
                  <Link className="h-3.5 w-3.5" />
                  <span>ملاحظة</span>
                </div>
                <p className="text-muted-foreground">
                  الطلاب المرتبطين بسجلات فردية سيتم تسجيل دفعاتهم في سجلاتهم الشخصية أيضاً.
                </p>
              </div>
            )}
          </div>
        </DialogBody>

        <DialogFooter className="flex-col sm:flex-row-reverse gap-2 pt-2">
          <Button
            onClick={handlePayment}
            className="w-full sm:flex-1 bg-amber-500 hover:bg-amber-600 text-white"
            disabled={selectedMembers.size === 0}
          >
            <DollarSign className="h-4 w-4 ml-2" />
            تسجيل الدفع ({totalAmount} ج.م)
          </Button>
          <Button variant="outline" onClick={handleClose} className="w-full sm:flex-1">
            إغلاق
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default GroupPaymentDialog;

