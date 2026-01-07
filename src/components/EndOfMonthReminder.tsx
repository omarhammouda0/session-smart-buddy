import { useState, useEffect } from 'react';
import { Bell, Check, X, Phone, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Student, StudentPayments } from '@/types/student';
import { formatMonthYear } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';

interface EndOfMonthReminderProps {
  students: Student[];
  payments: StudentPayments[];
  onTogglePayment: (studentId: string, month: number, year: number) => void;
}

export const EndOfMonthReminder = ({
  students,
  payments,
  onTogglePayment,
}: EndOfMonthReminderProps) => {
  const [showReminder, setShowReminder] = useState(false);
  const [dismissedThisSession, setDismissedThisSession] = useState(false);

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const currentDay = now.getDate();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  // Show reminder if it's the last 3 days of the month
  const isEndOfMonth = currentDay >= daysInMonth - 2;
  // Also show on the 26th for WhatsApp reminder
  const isDay26 = currentDay === 26;

  const getPaymentStatus = (studentId: string): boolean => {
    const studentPayments = payments.find(p => p.studentId === studentId);
    if (!studentPayments) return false;
    const payment = studentPayments.payments.find(
      p => p.month === currentMonth && p.year === currentYear
    );
    return payment?.isPaid || false;
  };

  const unpaidStudents = students.filter(s => !getPaymentStatus(s.id));

  useEffect(() => {
    if ((isEndOfMonth || isDay26) && unpaidStudents.length > 0 && !dismissedThisSession) {
      // Check if already shown today
      const lastShown = localStorage.getItem('payment-reminder-last-shown');
      const today = now.toDateString();
      
      if (lastShown !== today) {
        setShowReminder(true);
        localStorage.setItem('payment-reminder-last-shown', today);
      }
    }
  }, [isEndOfMonth, isDay26, unpaidStudents.length, dismissedThisSession]);

  const handleConfirmPaid = (studentId: string) => {
    onTogglePayment(studentId, currentMonth, currentYear);
  };

  const handleSendWhatsApp = (student: Student) => {
    if (!student.phone) return;
    
    const message = encodeURIComponent(
      `مرحباً، هذا تذكير بخصوص دفع الأقساط لشهر ${formatMonthYear(currentMonth, currentYear)}. شكراً لك!`
    );
    
    // Clean phone number (remove spaces and special chars except +)
    const cleanPhone = student.phone.replace(/[^\d+]/g, '');
    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${message}`;
    
    window.open(whatsappUrl, '_blank');
  };

  const handleDismiss = () => {
    setShowReminder(false);
    setDismissedThisSession(true);
  };

  if (students.length === 0 || unpaidStudents.length === 0) {
    return null;
  }

  return (
    <>
      {/* Floating reminder button */}
      {(isEndOfMonth || isDay26) && unpaidStudents.length > 0 && !showReminder && (
        <button
          onClick={() => setShowReminder(true)}
          className="fixed bottom-20 right-4 z-50 bg-warning text-warning-foreground p-3 rounded-full shadow-lg animate-bounce"
        >
          <Bell className="h-6 w-6" />
          <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs w-5 h-5 rounded-full flex items-center justify-center">
            {unpaidStudents.length}
          </span>
        </button>
      )}

      {/* Reminder Dialog */}
      <Dialog open={showReminder} onOpenChange={setShowReminder}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-warning">
              <Bell className="h-5 w-5" />
              Payment Reminder - {formatMonthYear(currentMonth, currentYear)}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {isDay26
                ? "It's the 26th! Time to send payment reminders to unpaid students."
                : "End of month reminder: The following students haven't paid yet."}
            </p>

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Unpaid students:</span>
              <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
                {unpaidStudents.length} of {students.length}
              </Badge>
            </div>

            <ScrollArea className="max-h-[300px]">
              <div className="space-y-2 pr-2">
                {unpaidStudents.map(student => (
                  <div
                    key={student.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="font-medium block truncate">{student.name}</span>
                      {student.phone && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {student.phone}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {student.phone && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 px-2 border-green-500/50 text-green-600 hover:bg-green-500/10"
                          onClick={() => handleSendWhatsApp(student)}
                        >
                          <MessageCircle className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        className="h-8 gradient-primary"
                        onClick={() => handleConfirmPaid(student.id)}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Paid
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={handleDismiss}>
                Dismiss
              </Button>
              {unpaidStudents.some(s => s.phone) && (
                <Button
                  variant="outline"
                  className="flex-1 border-green-500/50 text-green-600 hover:bg-green-500/10"
                  onClick={() => {
                    unpaidStudents.forEach(student => {
                      if (student.phone) {
                        handleSendWhatsApp(student);
                      }
                    });
                  }}
                >
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Send All WhatsApp
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};