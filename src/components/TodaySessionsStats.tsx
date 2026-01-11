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
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Student, Session, AppSettings, StudentPayments } from "@/types/student";
import { format, differenceInMinutes, differenceInSeconds } from "date-fns";
import { ar } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface TodaySessionsStatsProps {
  students: Student[];
  settings: AppSettings;
  payments?: StudentPayments[];
}

// Motivational quotes in Arabic
const MOTIVATIONAL_QUOTES = [
  { text: "العلم نور والجهل ظلام", emoji: "📚", color: "from-blue-500 to-indigo-500" },
  { text: "من جد وجد ومن زرع حصد", emoji: "🌱", color: "from-green-500 to-emerald-500" },
  { text: "التعليم هو أقوى سلاح يمكنك استخدامه لتغيير العالم", emoji: "💪", color: "from-purple-500 to-pink-500" },
  { text: "كل طالب يستحق معلماً يؤمن به", emoji: "⭐", color: "from-amber-500 to-orange-500" },
  { text: "النجاح يبدأ بخطوة واحدة", emoji: "🚀", color: "from-cyan-500 to-blue-500" },
  { text: "الصبر مفتاح الفرج", emoji: "🔑", color: "from-rose-500 to-red-500" },
  { text: "علم الناس علمك وتعلم علم غيرك", emoji: "🎓", color: "from-teal-500 to-green-500" },
  { text: "أفضل استثمار هو في العقول", emoji: "🧠", color: "from-violet-500 to-purple-500" },
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

export function TodaySessionsStats({ students, settings, payments }: TodaySessionsStatsProps) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [dailyQuote] = useState(() =>
    MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)]
  );
  const [dailyTip] = useState(() =>
    TEACHING_TIPS[Math.floor(Math.random() * TEACHING_TIPS.length)]
  );

  // Update time every second for live countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const todayStr = format(currentTime, "yyyy-MM-dd");

  // Calculate today's sessions statistics
  const stats = useMemo(() => {
    let total = 0;
    let completed = 0;
    let cancelled = 0;
    let scheduled = 0;
    let expectedValue = 0; // Expected value from non-cancelled sessions
    let paidAmount = 0; // Actual paid amount for today's sessions
    let nextSession: { session: Session; student: Student; minutesUntil: number } | null = null;
    let currentSession: { session: Session; student: Student; minutesRemaining: number } | null = null;

    // Get today's date info for payment lookup
    const todayDate = new Date(currentTime);
    const todayMonth = todayDate.getMonth();
    const todayYear = todayDate.getFullYear();

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

    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      total,
      completed,
      cancelled,
      scheduled,
      completionRate,
      expectedValue,
      paidAmount,
      nextSession,
      currentSession,
    };
  }, [students, todayStr, currentTime, settings, payments]);

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
    if (hour < 12) return { text: "صباح الخير", emoji: "☀️", gradient: "from-amber-400 via-orange-400 to-yellow-300" };
    if (hour < 17) return { text: "مساء النور", emoji: "🌤️", gradient: "from-blue-400 via-cyan-400 to-teal-300" };
    if (hour < 20) return { text: "مساء الخير", emoji: "🌅", gradient: "from-orange-400 via-pink-400 to-purple-400" };
    return { text: "مساء النور", emoji: "🌙", gradient: "from-indigo-400 via-purple-400 to-blue-400" };
  };

  const greeting = getGreeting();

  return (
    <div className="space-y-3 relative">
      {/* Animated Background Effects */}
      <div className="absolute -inset-4 -z-10 overflow-hidden pointer-events-none">
        {/* Gradient orbs */}
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-gradient-to-br from-primary/30 via-purple-500/20 to-pink-500/10 rounded-full blur-3xl animate-blob" />
        <div className="absolute top-20 -left-10 w-32 h-32 bg-gradient-to-tr from-cyan-500/20 via-blue-500/15 to-indigo-500/10 rounded-full blur-2xl animate-blob animation-delay-2000" />
        <div className="absolute -bottom-10 right-1/4 w-36 h-36 bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-rose-500/5 rounded-full blur-3xl animate-blob animation-delay-4000" />

        {/* Floating particles */}
        <div className="absolute top-10 right-1/3 w-2 h-2 bg-primary/40 rounded-full animate-float" />
        <div className="absolute top-1/2 left-10 w-1.5 h-1.5 bg-purple-500/30 rounded-full animate-float animation-delay-1000" />
        <div className="absolute bottom-20 right-20 w-2 h-2 bg-amber-500/40 rounded-full animate-float animation-delay-2000" />
        <div className="absolute top-1/3 right-10 w-1 h-1 bg-cyan-500/50 rounded-full animate-float animation-delay-3000" />

        {/* Subtle grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(139,92,246,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(139,92,246,0.03)_1px,transparent_1px)] bg-[size:32px_32px]" />
      </div>

      {/* Compact Header: Greeting + Stats in one row */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Compact Greeting */}
        <Card className="relative overflow-hidden border-0 shadow-lg flex-1 sm:max-w-[280px]">
          <div className={cn(
            "absolute inset-0 bg-gradient-to-r",
            greeting.gradient
          )} />
          {/* Decorative circles */}
          <div className="absolute -top-6 -right-6 w-20 h-20 bg-white/10 rounded-full" />
          <div className="absolute -bottom-4 -left-4 w-16 h-16 bg-white/5 rounded-full" />
          {/* Shimmer effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-[shimmer_3s_infinite]" />
          <CardContent className="relative p-3.5 text-white">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="text-3xl drop-shadow-lg">{greeting.emoji}</span>
                <div>
                  <p className="text-lg font-bold drop-shadow font-display">{greeting.text}!</p>
                  <p className="text-[11px] text-white/80 font-medium">
                    {format(currentTime, "EEEE، d MMMM", { locale: ar })}
                  </p>
                </div>
              </div>
              <div className="text-left bg-white/20 backdrop-blur-sm rounded-xl px-3 py-1.5 shadow-inner">
                <p className="text-2xl font-mono font-bold drop-shadow tabular-nums">
                  {format(currentTime, "HH:mm")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Compact Stats Row */}
        <div className="flex-1 grid grid-cols-4 gap-2">
          {/* Total Sessions */}
          <Card className="group relative overflow-hidden border-0 bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 hover:scale-105 transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-t from-white/0 via-white/5 to-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="absolute -top-4 -right-4 w-16 h-16 bg-white/10 rounded-full blur-xl" />
            <CardContent className="p-2.5 text-center text-white relative">
              <Calendar className="h-4 w-4 mx-auto mb-1 opacity-90" />
              <p className="text-2xl font-bold leading-none tabular-nums">{stats.total}</p>
              <p className="text-[10px] text-white/90 font-medium mt-0.5">حصص</p>
            </CardContent>
          </Card>

          {/* Completed */}
          <Card className="group relative overflow-hidden border-0 bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:scale-105 transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-t from-white/0 via-white/5 to-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="absolute -top-4 -right-4 w-16 h-16 bg-white/10 rounded-full blur-xl" />
            <CardContent className="p-2.5 text-center text-white relative">
              <CheckCircle2 className="h-4 w-4 mx-auto mb-1 opacity-90" />
              <p className="text-2xl font-bold leading-none tabular-nums">{stats.completed}</p>
              <p className="text-[10px] text-white/90 font-medium mt-0.5">مكتملة</p>
            </CardContent>
          </Card>

          {/* Completion Rate */}
          <Card className="group relative overflow-hidden border-0 bg-gradient-to-br from-purple-500 to-purple-600 shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 hover:scale-105 transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-t from-white/0 via-white/5 to-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="absolute -top-4 -right-4 w-16 h-16 bg-white/10 rounded-full blur-xl" />
            <CardContent className="p-2.5 text-center text-white relative">
              <Target className="h-4 w-4 mx-auto mb-1 opacity-90" />
              <p className="text-2xl font-bold leading-none tabular-nums">{stats.completionRate}%</p>
              <p className="text-[10px] text-white/90 font-medium mt-0.5">إنجاز</p>
            </CardContent>
          </Card>

          {/* Today's Earnings - Shows paid / expected */}
          <Card className="group relative overflow-hidden border-0 bg-gradient-to-br from-amber-500 to-orange-500 shadow-lg shadow-amber-500/30 hover:shadow-amber-500/50 hover:scale-105 transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-t from-white/0 via-white/5 to-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="absolute -top-4 -right-4 w-16 h-16 bg-white/10 rounded-full blur-xl" />
            <CardContent className="p-2.5 text-center text-white relative">
              <DollarSign className="h-4 w-4 mx-auto mb-1 opacity-90" />
              <p className="text-2xl font-bold leading-none tabular-nums">{stats.paidAmount}</p>
              <p className="text-[10px] text-white/90 font-medium mt-0.5">
                {stats.expectedValue > 0 ? `من ${stats.expectedValue} ج.م` : "ج.م"}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Current Session Card - Compact */}
      {stats.currentSession && (
        <Card className="relative overflow-hidden border-2 border-emerald-400 shadow-lg shadow-emerald-500/20">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-green-500/5 to-emerald-500/10" />
          <CardContent className="relative p-3.5">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center shadow-md">
                  <Zap className="h-5 w-5 text-white" />
                </div>
                <div className="absolute inset-0 rounded-full border-2 border-emerald-400 animate-ping opacity-30" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Badge className="bg-emerald-500 text-white text-[11px] h-5 font-semibold">🎯 جارية</Badge>
                  <span className="font-bold text-base truncate">{stats.currentSession.student.name}</span>
                </div>
                <div className="flex items-center gap-1.5 text-sm text-emerald-600 mt-1 font-medium">
                  <Timer className="h-3.5 w-3.5" />
                  <span>متبقي {formatCountdown(stats.currentSession.minutesRemaining)}</span>
                </div>
              </div>
              <div className="w-14 h-14 rounded-full border-[3px] border-emerald-500 flex items-center justify-center bg-emerald-50 shrink-0">
                <span className="text-base font-bold text-emerald-600 tabular-nums">
                  {Math.round(100 - (stats.currentSession.minutesRemaining / (stats.currentSession.session.duration || 60)) * 100)}%
                </span>
              </div>
            </div>
            {/* Slim Progress bar */}
            <div className="mt-3">
              <div className="h-2 bg-emerald-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-400 to-green-500 rounded-full transition-all duration-1000"
                  style={{ width: `${100 - (stats.currentSession.minutesRemaining / (stats.currentSession.session.duration || 60)) * 100}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Next Session Countdown - Compact */}
      {stats.nextSession && !stats.currentSession && (
        <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-slate-800 to-slate-900">
          <CardContent className="relative p-4 text-white">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center shadow-lg">
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
                <p className="text-3xl font-mono font-bold bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent tabular-nums">
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
          <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary via-purple-500 to-pink-500 rounded-full transition-all duration-1000"
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
      <Card className="relative overflow-hidden border border-white/20 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl shadow-md">
        <CardContent className="relative p-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center shrink-0 shadow-sm">
              <Award className="h-4 w-4 text-white" />
            </div>
            <p className="text-sm text-foreground font-medium">💡 {dailyTip}</p>
          </div>
        </CardContent>
      </Card>

      {/* Break Reminder - Slim */}
      {!stats.currentSession && stats.nextSession && stats.nextSession.minutesUntil > 30 && (
        <Card className="relative overflow-hidden border-0 bg-gradient-to-r from-green-400 to-emerald-500 shadow-md">
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
