import { useState, useEffect, useMemo } from "react";
import {
  CheckCircle2,
  Timer,
  Zap,
  Target,
  Flame,
  Award,
  Calendar,
  DollarSign,
  Sparkles,
  Users,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Student, Session, AppSettings, StudentPayments, StudentGroup } from "@/types/student";
import { format, differenceInMinutes, differenceInSeconds } from "date-fns";
import { ar } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface GroupMemberPayment {
  id: string;
  groupId: string;
  sessionId?: string;
  memberId: string;
  linkedStudentId?: string;
  amount: number;
  method: 'cash' | 'bank' | 'wallet';
  paidAt: string;
  notes?: string;
}

interface TodaySessionsStatsProps {
  students: Student[];
  settings: AppSettings;
  payments?: StudentPayments[];
  groups?: StudentGroup[];
  groupPayments?: GroupMemberPayment[];
}

// Motivational quotes in Arabic - Navy blue theme
const MOTIVATIONAL_QUOTES = [
  { text: "العلم نور والجهل ظلام", emoji: "📚", color: "from-[hsl(220,60%,30%)] to-[hsl(220,50%,45%)]" },
  { text: "من جد وجد ومن زرع حصد", emoji: "🌱", color: "from-[hsl(220,50%,35%)] to-[hsl(220,40%,50%)]" },
  { text: "التعليم هو أقوى سلاح يمكنك استخدامه لتغيير العالم", emoji: "💪", color: "from-[hsl(220,55%,32%)] to-[hsl(220,45%,48%)]" },
  { text: "كل طالب يستحق معلماً يؤمن به", emoji: "⭐", color: "from-[hsl(220,60%,28%)] to-[hsl(220,50%,42%)]" },
  { text: "النجاح يبدأ بخطوة واحدة", emoji: "🚀", color: "from-[hsl(220,55%,30%)] to-[hsl(220,45%,45%)]" },
  { text: "الصبر مفتاح الفرج", emoji: "🔑", color: "from-[hsl(220,50%,33%)] to-[hsl(220,40%,48%)]" },
  { text: "علم الناس علمك وتعلم علم غيرك", emoji: "🎓", color: "from-[hsl(220,60%,35%)] to-[hsl(220,50%,50%)]" },
  { text: "أفضل استثمار هو في العقول", emoji: "🧠", color: "from-[hsl(220,55%,28%)] to-[hsl(220,45%,43%)]" },
];

// Teaching tips
const TEACHING_TIPS = [
  "جرب تغيير نبرة صوتك لجذب انتباه الطالب",
  "استخدم أمثلة من الحياة اليومية",
  "امنح الطالب فرصة للتفكير قبل الإجابة",
  "احتفل بالإنجازات الصغيرة",
  "اسأل الطالب عن رأيه في الدرس",
  "استخدم الرسومات والصور للشرح",
];

export function TodaySessionsStats({ students, settings, payments, groups = [], groupPayments = [] }: TodaySessionsStatsProps) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [dailyQuote] = useState(() =>
    MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)]
  );
  const [dailyTip] = useState(() =>
    TEACHING_TIPS[Math.floor(Math.random() * TEACHING_TIPS.length)]
  );

  // Update time every 30 seconds (countdown shows ~minute precision anyway)
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const todayStr = format(currentTime, "yyyy-MM-dd");

  // Calculate today's sessions statistics (including groups)
  const stats = useMemo(() => {
    let total = 0;
    let completed = 0;
    let cancelled = 0;
    let scheduled = 0;
    let vacation = 0;
    let expectedValue = 0; // Expected value from non-cancelled sessions
    let paidAmount = 0; // Actual paid amount for today's sessions
    let nextSession: { session: Session; student: Student; minutesUntil: number } | null = null;
    let currentSession: { session: Session; student: Student; minutesRemaining: number } | null = null;

    // Group session counters
    let groupTotal = 0;
    let groupCompleted = 0;
    let groupScheduled = 0;
    let groupCancelled = 0;
    let groupVacation = 0;
    let groupExpectedValue = 0;
    let groupPaidAmount = 0;

    // Get today's date info for payment lookup
    const todayDate = new Date(currentTime);
    const todayMonth = todayDate.getMonth();
    const todayYear = todayDate.getFullYear();

    // Calculate individual student sessions
    students.forEach((student) => {
      // Get student's payments for this month
      const studentPayments = payments?.find((p) => p.studentId === student.id);
      const monthPayment = studentPayments?.payments.find(
        (p) => p.month === todayMonth && p.year === todayYear
      );

      student.sessions
        .filter((s) => s.date === todayStr)
        .forEach((session) => {
          total++;

          const sessionTime = session.time || student.sessionTime || "16:00";
          const [hours, minutes] = sessionTime.split(":").map(Number);
          const sessionStart = new Date(currentTime);
          sessionStart.setHours(hours, minutes, 0, 0);

          const duration = session.duration || student.sessionDuration || 60;
          const sessionEnd = new Date(sessionStart.getTime() + duration * 60000);

          // Calculate session price
          const price = student.sessionType === "online"
            ? (student.customPriceOnline || settings.defaultPriceOnline || 120)
            : (student.customPriceOnsite || settings.defaultPriceOnsite || 150);

          // Check payment records for this specific session
          let sessionPaidAmount = 0;
          if (monthPayment?.paymentRecords) {
            sessionPaidAmount = monthPayment.paymentRecords
              .filter((record) => record.notes && record.notes.includes(`session:${session.id}`))
              .reduce((sum, record) => sum + record.amount, 0);
          }
          paidAmount += sessionPaidAmount;

          if (session.status === "completed") {
            completed++;
            expectedValue += price;
          } else if (session.status === "cancelled") {
            cancelled++;
            // Cancelled sessions don't add to expected value
          } else if (session.status === "vacation") {
            vacation++;
            // Vacation sessions don't add to expected value
          } else if (session.status === "scheduled") {
            scheduled++;
            expectedValue += price;

            const minutesUntil = differenceInMinutes(sessionStart, currentTime);
            const minutesRemaining = differenceInMinutes(sessionEnd, currentTime);

            if (currentTime >= sessionStart && currentTime <= sessionEnd) {
              if (!currentSession || minutesRemaining > (currentSession?.minutesRemaining || 0)) {
                currentSession = { session, student, minutesRemaining };
              }
            } else if (minutesUntil > 0) {
              if (!nextSession || minutesUntil < nextSession.minutesUntil) {
                nextSession = { session, student, minutesUntil };
              }
            }
          }
        });
    });

    // Calculate group sessions for today
    groups.forEach((group) => {
      const todayGroupSession = group.sessions.find((s) => s.date === todayStr);
      if (!todayGroupSession) return;

      // Count active members
      const activeMembers = group.members.filter((m) => m.isActive);

      activeMembers.forEach((member) => {
        groupTotal++;

        const memberPrice = member.customPrice ?? group.defaultPricePerStudent;

        // Check member attendance status - default to session status if no attendance record
        const attendance = todayGroupSession.memberAttendance.find(
          (a) => a.memberId === member.studentId
        );

        const memberStatus = attendance?.status || todayGroupSession.status;

        if (memberStatus === "completed") {
          groupCompleted++;
          groupExpectedValue += memberPrice;
        } else if (memberStatus === "scheduled") {
          groupScheduled++;
          groupExpectedValue += memberPrice;
        } else if (memberStatus === "cancelled") {
          groupCancelled++;
          // Cancelled doesn't add to expected value
        } else if (memberStatus === "vacation") {
          groupVacation++;
          // Vacation doesn't add to expected value
        }

        // Check if member has paid for this session
        const memberPayment = groupPayments.find(
          (p) => p.sessionId === todayGroupSession.id && p.memberId === member.studentId
        );
        if (memberPayment) {
          groupPaidAmount += memberPayment.amount;
        }
      });
    });

    // Combined totals
    const combinedTotal = total + groupTotal;
    const combinedCompleted = completed + groupCompleted;
    const combinedScheduled = scheduled + groupScheduled;
    const combinedCancelled = cancelled + groupCancelled;
    const combinedVacation = vacation + groupVacation;
    const combinedExpectedValue = expectedValue + groupExpectedValue;
    const combinedPaidAmount = paidAmount + groupPaidAmount;

    // Completion rate: completed / (completed + scheduled) - excludes cancelled and vacation for meaningful rate
    const billableSessions = combinedCompleted + combinedScheduled;
    const completionRate = billableSessions > 0 ? Math.round((combinedCompleted / billableSessions) * 100) : 0;

    return {
      total: combinedTotal,
      completed: combinedCompleted,
      cancelled: combinedCancelled,
      vacation: combinedVacation,
      scheduled: combinedScheduled,
      completionRate,
      expectedValue: combinedExpectedValue,
      paidAmount: combinedPaidAmount,
      nextSession,
      currentSession,
      // Keep individual counts for display
      privateTotal: total,
      groupTotal,
      privateCompleted: completed,
      groupCompleted,
    };
  }, [students, todayStr, currentTime, settings, payments, groups, groupPayments]);

  const formatCountdown = (minutes: number) => {
    if (minutes < 1) {
      const seconds = Math.max(0, differenceInSeconds(
        new Date(currentTime.getTime() + minutes * 60000),
        currentTime
      ));
      return `${seconds} ثانية`;
    }
    if (minutes < 60) return `${minutes} دقيقة`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) return `${hours} ساعة`;
    return `${hours}:${mins.toString().padStart(2, "0")}`;
  };

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return { text: "صباح الخير", emoji: "☀️", gradient: "from-[hsl(220,55%,35%)] via-[hsl(220,50%,45%)] to-[hsl(220,45%,55%)]" };
    if (hour < 17) return { text: "مساء النور", emoji: "🌤️", gradient: "from-[hsl(220,60%,30%)] via-[hsl(220,55%,40%)] to-[hsl(220,50%,50%)]" };
    if (hour < 20) return { text: "مساء الخير", emoji: "🌅", gradient: "from-[hsl(220,55%,28%)] via-[hsl(220,50%,38%)] to-[hsl(220,45%,48%)]" };
    return { text: "مساء النور", emoji: "🌙", gradient: "from-[hsl(220,60%,25%)] via-[hsl(220,55%,35%)] to-[hsl(220,50%,45%)]" };
  };

  const greeting = getGreeting();

  return (
    <div className="space-y-2 sm:space-y-3 relative">
      {/* Animated Background Effects - Hidden on mobile */}
      <div className="hidden sm:block absolute -inset-4 -z-10 overflow-hidden pointer-events-none">
        {/* Gradient orbs - Navy blue theme */}
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-gradient-to-br from-primary/30 via-primary/20 to-primary/10 rounded-full blur-3xl animate-blob" />
        <div className="absolute top-20 -left-10 w-32 h-32 bg-gradient-to-tr from-primary/20 via-primary/15 to-primary/10 rounded-full blur-2xl animate-blob animation-delay-2000" />
      </div>

      {/* Compact Header: Greeting + Stats - Very compact on mobile */}
      <div className="flex flex-col sm:flex-row gap-1.5 sm:gap-3">
        {/* Compact Greeting - Single row on mobile */}
        <Card className="relative overflow-hidden border-0 shadow-md sm:shadow-lg flex-1 sm:max-w-[280px]">
          <div className={cn("absolute inset-0 bg-gradient-to-r", greeting.gradient)} />
          <CardContent className="relative p-2 sm:p-3.5 text-white">
            <div className="flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-1.5 sm:gap-2.5">
                <span className="text-lg sm:text-3xl drop-shadow-lg">{greeting.emoji}</span>
                <div>
                  <p className="text-sm sm:text-lg font-bold drop-shadow font-display">{greeting.text}!</p>
                  <p className="text-[0.55rem] sm:text-[11px] text-white/80 font-medium">
                    {format(currentTime, "EEEE، d MMMM", { locale: ar })}
                  </p>
                </div>
              </div>
              <div className="text-left bg-white/20 backdrop-blur-sm rounded-lg sm:rounded-xl px-2 sm:px-3 py-1 sm:py-1.5 shadow-inner">
                <p className="text-xl sm:text-2xl font-mono font-bold drop-shadow tabular-nums">
                  {format(currentTime, "HH:mm")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Compact Stats Row */}
        <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2">
          {/* Total Sessions */}
          <Card className="group relative overflow-hidden border-0 bg-gradient-to-br from-[hsl(220,60%,30%)] to-[hsl(220,55%,40%)] shadow-lg shadow-primary/30 hover:shadow-primary/50 sm:hover:scale-105 transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-t from-white/0 via-white/5 to-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="absolute -top-4 -right-4 w-16 h-16 bg-white/10 rounded-full blur-xl" />
            <CardContent className="p-1.5 sm:p-2.5 text-center text-white relative">
              <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 mx-auto mb-0.5 sm:mb-1 opacity-90" />
              <p className="text-lg sm:text-2xl font-bold leading-none tabular-nums">{stats.total}</p>
              <p className="text-[8px] sm:text-[10px] text-white/90 font-medium mt-0.5">
                {stats.groupTotal > 0 ? (
                  <span className="flex items-center justify-center gap-0.5">
                    حصص
                    <span className="text-violet-200">({stats.privateTotal}+{stats.groupTotal}👥)</span>
                  </span>
                ) : "حصص"}
              </p>
            </CardContent>
          </Card>

          {/* Completed */}
          <Card className="group relative overflow-hidden border-0 bg-gradient-to-br from-[hsl(220,50%,35%)] to-[hsl(220,45%,45%)] shadow-lg shadow-primary/30 hover:shadow-primary/50 sm:hover:scale-105 transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-t from-white/0 via-white/5 to-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="absolute -top-4 -right-4 w-16 h-16 bg-white/10 rounded-full blur-xl" />
            <CardContent className="p-1.5 sm:p-2.5 text-center text-white relative">
              <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 mx-auto mb-0.5 sm:mb-1 opacity-90" />
              <p className="text-lg sm:text-2xl font-bold leading-none tabular-nums">{stats.completed}</p>
              <p className="text-[8px] sm:text-[10px] text-white/90 font-medium mt-0.5">
                {stats.groupCompleted > 0 ? (
                  <span className="flex items-center justify-center gap-0.5">
                    مكتملة
                    <span className="text-violet-200">({stats.privateCompleted}+{stats.groupCompleted}👥)</span>
                  </span>
                ) : "مكتملة"}
              </p>
            </CardContent>
          </Card>

          {/* Completion Rate */}
          <Card className="group relative overflow-hidden border-0 bg-gradient-to-br from-[hsl(220,55%,38%)] to-[hsl(220,50%,48%)] shadow-lg shadow-primary/30 hover:shadow-primary/50 sm:hover:scale-105 transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-t from-white/0 via-white/5 to-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="absolute -top-4 -right-4 w-16 h-16 bg-white/10 rounded-full blur-xl" />
            <CardContent className="p-1.5 sm:p-2.5 text-center text-white relative">
              <Target className="h-3.5 w-3.5 sm:h-4 sm:w-4 mx-auto mb-0.5 sm:mb-1 opacity-90" />
              <p className="text-lg sm:text-2xl font-bold leading-none tabular-nums">{stats.completionRate}%</p>
              <p className="text-[8px] sm:text-[10px] text-white/90 font-medium mt-0.5">إنجاز</p>
            </CardContent>
          </Card>

          {/* Today's Earnings - Shows paid / expected */}
          <Card className="group relative overflow-hidden border-0 bg-gradient-to-br from-[hsl(220,45%,40%)] to-[hsl(220,40%,50%)] shadow-lg shadow-primary/30 hover:shadow-primary/50 sm:hover:scale-105 transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-t from-white/0 via-white/5 to-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="absolute -top-4 -right-4 w-16 h-16 bg-white/10 rounded-full blur-xl" />
            <CardContent className="p-1.5 sm:p-2.5 text-center text-white relative">
              <DollarSign className="h-3.5 w-3.5 sm:h-4 sm:w-4 mx-auto mb-0.5 sm:mb-1 opacity-90" />
              <p className="text-lg sm:text-2xl font-bold leading-none tabular-nums">{stats.paidAmount}</p>
              <p className="text-[8px] sm:text-[10px] text-white/90 font-medium mt-0.5">
                {stats.expectedValue > 0 ? `من ${stats.expectedValue}` : "ج.م"}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Current Session Card - Compact */}
      {stats.currentSession && (
        <Card className="relative overflow-hidden border-2 border-primary/50 shadow-lg shadow-primary/20">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10" />
          <CardContent className="relative p-3.5">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-md">
                  <Zap className="h-5 w-5 text-white" />
                </div>
                <div className="absolute inset-0 rounded-full border-2 border-primary animate-ping opacity-30" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Badge className="bg-primary text-white text-[11px] h-5 font-semibold">🎯 جارية</Badge>
                  <span className="font-bold text-base truncate">{stats.currentSession.student.name}</span>
                </div>
                <div className="flex items-center gap-1.5 text-sm text-primary mt-1 font-medium">
                  <Timer className="h-3.5 w-3.5" />
                  <span>متبقي {formatCountdown(stats.currentSession.minutesRemaining)}</span>
                </div>
              </div>
              <div className="w-14 h-14 rounded-full border-[3px] border-primary flex items-center justify-center bg-primary/5 shrink-0">
                <span className="text-base font-bold text-primary tabular-nums">
                  {Math.round(100 - (stats.currentSession.minutesRemaining / (stats.currentSession.session.duration || 60)) * 100)}%
                </span>
              </div>
            </div>
            {/* Slim Progress bar */}
            <div className="mt-3">
              <div className="h-2 bg-primary/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary to-primary/80 rounded-full transition-all duration-1000"
                  style={{ width: `${100 - (stats.currentSession.minutesRemaining / (stats.currentSession.session.duration || 60)) * 100}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Next Session Countdown - Compact */}
      {stats.nextSession && !stats.currentSession && (
        <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-[hsl(220,50%,15%)] to-[hsl(220,55%,20%)]">
          <CardContent className="relative p-4 text-white">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg">
                <Timer className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white/60 flex items-center gap-1 font-medium">
                  <Sparkles className="h-3 w-3" /> الحصة القادمة
                </p>
                <p className="font-bold text-lg truncate mt-0.5">{stats.nextSession.student.name}</p>
                <p className="text-sm text-white/70 font-medium">
                  الساعة {stats.nextSession.session.time || stats.nextSession.student.sessionTime}
                </p>
              </div>
              <div className="text-center bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2 shrink-0">
                <p className="text-3xl font-mono font-bold bg-gradient-to-r from-[hsl(45,30%,85%)] to-[hsl(45,25%,95%)] bg-clip-text text-transparent tabular-nums">
                  {formatCountdown(stats.nextSession.minutesUntil)}
                </p>
                <p className="text-[10px] text-white/50 font-medium">حتى البدء</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Day Progress - Slim inline */}
      {stats.total > 0 && (
        <div className="flex items-center gap-3 px-1">
          <span className="text-xs text-muted-foreground shrink-0">التقدم</span>
          <div className="flex-1 h-2 bg-primary/10 dark:bg-primary/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary via-primary/90 to-primary/80 rounded-full transition-all duration-1000"
              style={{ width: `${stats.completionRate}%` }}
            />
          </div>
          <span className="text-sm font-semibold shrink-0 tabular-nums">{stats.completed}/{stats.total}</span>
        </div>
      )}

      {/* Motivational Quote - Slim */}
      <Card className={cn(
        "relative overflow-hidden border-0 shadow-md",
        "bg-gradient-to-r",
        dailyQuote.color
      )}>
        <CardContent className="relative p-3 text-white">
          <div className="flex items-center gap-2.5">
            <Flame className="h-5 w-5 shrink-0 opacity-90" />
            <p className="text-sm font-semibold flex-1">"{dailyQuote.text}"</p>
            <span className="text-xl shrink-0">{dailyQuote.emoji}</span>
          </div>
        </CardContent>
      </Card>

      {/* Teaching Tip - Slim */}
      <Card className="relative overflow-hidden border border-border/50 bg-card/80 dark:bg-card/60 backdrop-blur-xl shadow-md">
        <CardContent className="relative p-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shrink-0 shadow-sm">
              <Award className="h-4 w-4 text-white" />
            </div>
            <p className="text-sm text-foreground font-medium">💡 {dailyTip}</p>
          </div>
        </CardContent>
      </Card>

      {/* Break Reminder - Slim */}
      {!stats.currentSession && stats.nextSession && stats.nextSession.minutesUntil > 30 && (
        <Card className="relative overflow-hidden border-0 bg-gradient-to-r from-[hsl(220,50%,40%)] to-[hsl(220,45%,50%)] shadow-md">
          <CardContent className="p-3 text-white">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl">☕</span>
              <p className="text-sm font-medium">
                لديك <span className="font-bold">{formatCountdown(stats.nextSession.minutesUntil)}</span> - خذ استراحة!
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

