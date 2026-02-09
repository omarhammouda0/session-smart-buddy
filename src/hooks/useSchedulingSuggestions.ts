import { useMemo } from 'react';
import { Student, SessionType } from '@/types/student';
import { DAY_NAMES_AR } from '@/lib/arabicConstants';

// Types for scheduling suggestions
export type SuggestionType =
  | 'free_day'           // Day with no sessions - highly recommended
  | 'light_day'          // Day with 1-2 sessions - good option
  | 'moderate_day'       // Day with 3-4 sessions - acceptable
  | 'busy_day'           // Day with 5+ sessions - avoid
  | 'same_type_cluster'  // Day has same session type - efficient
  | 'mixed_type';        // Day has both online/onsite - less efficient

export type SuggestionPriority = 'high' | 'medium' | 'low';

export interface SuggestedTimeSlot {
  time: string;        // HH:mm format
  timeAr: string;      // Arabic formatted time
  reason: string;      // Why this time is suggested
  priority: SuggestionPriority;
}

export interface DaySuggestion {
  dayOfWeek: number;
  dayName: string;
  type: SuggestionType;
  priority: SuggestionPriority;
  message: string;
  icon: 'sparkles' | 'check' | 'alert' | 'clock' | 'users' | 'monitor' | 'map-pin' | 'zap';
  sessionCount: number;
  onlineCount: number;
  onsiteCount: number;
  suggestedTimeSlots: SuggestedTimeSlot[];
  isRecommended: boolean;
  isWarning: boolean;
  travelConsideration?: string; // For onsite sessions clustering
}

export interface SchedulingSuggestions {
  daySuggestions: DaySuggestion[];
  bestDays: number[];        // Top recommended days
  avoidDays: number[];       // Days to avoid
  generalTips: string[];
  overallLoad: 'light' | 'moderate' | 'heavy';
}

// Threshold for busy day
const BUSY_DAY_THRESHOLD = 5;

// Helper to parse time to minutes
const timeToMinutes = (time: string): number => {
  if (!time) return 16 * 60;
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

// Helper to convert minutes to time string
const minutesToTime = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

// Format time in Arabic (12-hour)
const formatTimeAr = (time: string): string => {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'م' : 'ص';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
};

interface ScheduledSession {
  time: string;
  duration: number;
  type: SessionType;
  studentName: string;
}

interface DayStats {
  dayOfWeek: number;
  totalSessions: number;
  onlineSessions: number;
  onsiteSessions: number;
  scheduledSessions: ScheduledSession[];
}

/**
 * Hook to generate smart scheduling suggestions when adding a new student
 */
export const useSchedulingSuggestions = (
  students: Student[],
  newSessionType: SessionType | null
): SchedulingSuggestions => {
  return useMemo(() => {
    // Analyze each day of the week
    const dayStats: DayStats[] = Array.from({ length: 7 }, (_, i) => ({
      dayOfWeek: i,
      totalSessions: 0,
      onlineSessions: 0,
      onsiteSessions: 0,
      scheduledSessions: [],
    }));

    // Collect stats from all students
    students.forEach(student => {
      student.scheduleDays.forEach(scheduleDay => {
        const day = scheduleDay.dayOfWeek;
        const time = scheduleDay.time || student.sessionTime || '16:00';
        const duration = student.sessionDuration || 60;

        dayStats[day].totalSessions++;
        if (student.sessionType === 'online') {
          dayStats[day].onlineSessions++;
        } else {
          dayStats[day].onsiteSessions++;
        }
        dayStats[day].scheduledSessions.push({
          time,
          duration,
          type: student.sessionType,
          studentName: student.name,
        });
      });
    });

    // Sort sessions by time for each day
    dayStats.forEach(day => {
      day.scheduledSessions.sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
    });

    // Calculate total weekly sessions
    const totalWeeklySessions = dayStats.reduce((sum, d) => sum + d.totalSessions, 0);

    // Determine overall load
    let overallLoad: 'light' | 'moderate' | 'heavy' = 'light';
    if (totalWeeklySessions > 25) overallLoad = 'heavy';
    else if (totalWeeklySessions > 12) overallLoad = 'moderate';

    // Generate suggestions for each day
    const daySuggestions: DaySuggestion[] = dayStats.map(day => {
      const suggestedTimeSlots = findAvailableTimeSlots(day.scheduledSessions, newSessionType);

      const suggestion: DaySuggestion = {
        dayOfWeek: day.dayOfWeek,
        dayName: DAY_NAMES_AR[day.dayOfWeek],
        type: 'light_day',
        priority: 'medium',
        message: '',
        icon: 'check',
        sessionCount: day.totalSessions,
        onlineCount: day.onlineSessions,
        onsiteCount: day.onsiteSessions,
        suggestedTimeSlots,
        isRecommended: false,
        isWarning: false,
      };

      // RULE 1: Free days are highly recommended
      if (day.totalSessions === 0) {
        suggestion.type = 'free_day';
        suggestion.priority = 'high';
        suggestion.message = '✨ يوم فارغ تماماً - موصى به بشدة';
        suggestion.icon = 'sparkles';
        suggestion.isRecommended = true;
      }
      // RULE 2: Light days (1-2 sessions) are good
      else if (day.totalSessions <= 2) {
        suggestion.type = 'light_day';
        suggestion.priority = 'high';
        suggestion.message = `👍 يوم خفيف (${day.totalSessions} جلسة) - خيار ممتاز`;
        suggestion.icon = 'check';
        suggestion.isRecommended = true;
      }
      // RULE 3: Moderate days (3-4 sessions) are acceptable
      else if (day.totalSessions <= 4) {
        suggestion.type = 'moderate_day';
        suggestion.priority = 'medium';
        suggestion.message = `📊 يوم متوسط (${day.totalSessions} جلسات) - مقبول`;
        suggestion.icon = 'clock';
        suggestion.isRecommended = false;
      }
      // RULE 4: Busy days (5+ sessions) - show warning (threshold = 5)
      else if (day.totalSessions >= BUSY_DAY_THRESHOLD) {
        suggestion.type = 'busy_day';
        suggestion.priority = 'low';
        suggestion.message = `⚠️ يوم مزدحم (${day.totalSessions} جلسات) - يفضل تجنبه`;
        suggestion.icon = 'alert';
        suggestion.isWarning = true;
      }

      // RULE 5: Same session type clustering (if adding a new session)
      if (newSessionType && day.totalSessions > 0 && !suggestion.isWarning) {
        if (newSessionType === 'online' && day.onlineSessions > 0 && day.onsiteSessions === 0) {
          // All online - good for clustering
          suggestion.message = `💻 كل الجلسات أونلاين (${day.onlineSessions}) - مثالي للتنظيم`;
          suggestion.icon = 'monitor';
          suggestion.isRecommended = true;
          suggestion.priority = 'high';
          suggestion.type = 'same_type_cluster';
        } else if (newSessionType === 'onsite' && day.onsiteSessions > 0 && day.onlineSessions === 0) {
          // All onsite - good for clustering, consider travel
          suggestion.message = `🏠 كل الجلسات حضورية (${day.onsiteSessions}) - مثالي للتنظيم`;
          suggestion.icon = 'map-pin';
          suggestion.isRecommended = true;
          suggestion.priority = 'high';
          suggestion.type = 'same_type_cluster';
          // Add travel consideration for onsite
          suggestion.travelConsideration = '💡 نصيحة: اترك وقتاً كافياً للتنقل بين الجلسات الحضورية';
        } else if (day.onlineSessions > 0 && day.onsiteSessions > 0) {
          // Mixed types - less efficient
          suggestion.message = `🔄 يوم مختلط (${day.onlineSessions} أونلاين، ${day.onsiteSessions} حضوري)`;
          suggestion.icon = 'users';
          suggestion.type = 'mixed_type';

          // If new session is onsite and there are already onsite sessions
          if (newSessionType === 'onsite' && day.onsiteSessions > 0) {
            suggestion.travelConsideration = '⚠️ تنبيه: قد تحتاج وقتاً للتنقل بين الجلسات الحضورية والأونلاين';
          }
        }
      }

      // RULE 6: Travel time consideration for onsite sessions
      if (newSessionType === 'onsite' && day.onsiteSessions >= 2) {
        suggestion.travelConsideration = '🚗 يوجد ' + day.onsiteSessions + ' جلسات حضورية - تأكد من وجود وقت كافٍ للتنقل';
      }

      return suggestion;
    });

    // Determine best days (free or light days, or same-type days)
    const bestDays = daySuggestions
      .filter(d => d.isRecommended && !d.isWarning)
      .sort((a, b) => {
        // Prioritize: free days > same-type cluster > light days
        if (a.sessionCount === 0 && b.sessionCount > 0) return -1;
        if (b.sessionCount === 0 && a.sessionCount > 0) return 1;
        if (a.type === 'same_type_cluster' && b.type !== 'same_type_cluster') return -1;
        if (b.type === 'same_type_cluster' && a.type !== 'same_type_cluster') return 1;
        return a.sessionCount - b.sessionCount;
      })
      .slice(0, 3)
      .map(d => d.dayOfWeek);

    // Determine days to avoid (busy days)
    const avoidDays = daySuggestions
      .filter(d => d.isWarning)
      .map(d => d.dayOfWeek);

    // Generate general tips
    const generalTips: string[] = [];

    if (overallLoad === 'heavy') {
      generalTips.push('⚡ جدولك مزدحم هذا الأسبوع، حاول توزيع الجلسات بشكل أفضل');
    }

    if (bestDays.length > 0) {
      const bestDayNames = bestDays.map(d => DAY_NAMES_AR[d]).join('، ');
      generalTips.push(`🌟 أفضل الأيام للإضافة: ${bestDayNames}`);
    }

    if (avoidDays.length > 0 && avoidDays.length < 5) {
      const avoidDayNames = avoidDays.map(d => DAY_NAMES_AR[d]).join('، ');
      generalTips.push(`⚠️ أيام مزدحمة (${BUSY_DAY_THRESHOLD}+ جلسات): ${avoidDayNames}`);
    }

    // Check for day balance
    const maxSessions = Math.max(...dayStats.map(d => d.totalSessions));
    const minSessions = Math.min(...dayStats.map(d => d.totalSessions));
    if (maxSessions - minSessions > 4) {
      generalTips.push('💡 جدولك غير متوازن، حاول توزيع الجلسات بالتساوي على الأسبوع');
    }

    // Travel time tip for onsite sessions
    if (newSessionType === 'onsite') {
      const daysWithMultipleOnsite = dayStats.filter(d => d.onsiteSessions >= 2);
      if (daysWithMultipleOnsite.length > 0) {
        generalTips.push('🚗 نصيحة: اترك 30-60 دقيقة على الأقل بين الجلسات الحضورية للتنقل');
      }
    }

    return {
      daySuggestions,
      bestDays,
      avoidDays,
      generalTips,
      overallLoad,
    };
  }, [students, newSessionType]);
};

/**
 * Find available time slots on a day based on existing sessions
 */
function findAvailableTimeSlots(
  sessions: ScheduledSession[],
  newSessionType: SessionType | null
): SuggestedTimeSlot[] {
  const availableSlots: SuggestedTimeSlot[] = [];

  // Define working hours (8 AM to 10 PM)
  const startOfDay = 8 * 60;  // 8:00 AM
  const endOfDay = 22 * 60;   // 10:00 PM
  const sessionDuration = 60; // Assume 1 hour
  const minGap = 30;          // Minimum 30 min gap
  const travelTime = 45;      // Extra time for onsite travel

  if (sessions.length === 0) {
    // Return common time slots for empty days
    return [
      { time: '10:00', timeAr: formatTimeAr('10:00'), reason: 'وقت صباحي مريح', priority: 'high' },
      { time: '14:00', timeAr: formatTimeAr('14:00'), reason: 'بعد الظهر', priority: 'medium' },
      { time: '16:00', timeAr: formatTimeAr('16:00'), reason: 'وقت العصر - الأكثر شيوعاً', priority: 'high' },
      { time: '18:00', timeAr: formatTimeAr('18:00'), reason: 'وقت المساء', priority: 'medium' },
    ];
  }

  // Sort sessions by time
  const sortedSessions = [...sessions].sort(
    (a, b) => timeToMinutes(a.time) - timeToMinutes(b.time)
  );

  // Check slot before first session
  const firstStart = timeToMinutes(sortedSessions[0].time);
  const requiredGapBefore = newSessionType === 'onsite' && sortedSessions[0].type === 'onsite'
    ? sessionDuration + travelTime
    : sessionDuration + minGap;

  if (firstStart - startOfDay >= requiredGapBefore) {
    const suggestedTime = Math.max(startOfDay, firstStart - requiredGapBefore);
    const timeStr = minutesToTime(suggestedTime);
    availableSlots.push({
      time: timeStr,
      timeAr: formatTimeAr(timeStr),
      reason: `قبل جلسة ${sortedSessions[0].studentName}`,
      priority: 'medium',
    });
  }

  // Check gaps between sessions
  for (let i = 0; i < sortedSessions.length - 1; i++) {
    const currentSession = sortedSessions[i];
    const nextSession = sortedSessions[i + 1];
    const currentEnd = timeToMinutes(currentSession.time) + currentSession.duration;
    const nextStart = timeToMinutes(nextSession.time);
    const gap = nextStart - currentEnd;

    // Consider travel time for onsite sessions
    const requiredGap = (newSessionType === 'onsite' &&
      (currentSession.type === 'onsite' || nextSession.type === 'onsite'))
      ? sessionDuration + travelTime * 2
      : sessionDuration + minGap * 2;

    if (gap >= requiredGap) {
      // There's room for a session in this gap
      const suggestedTime = currentEnd + (newSessionType === 'onsite' ? travelTime : minGap);
      const timeStr = minutesToTime(suggestedTime);
      availableSlots.push({
        time: timeStr,
        timeAr: formatTimeAr(timeStr),
        reason: `بين ${currentSession.studentName} و ${nextSession.studentName}`,
        priority: 'high',
      });
    }
  }

  // Check slot after last session
  const lastSession = sortedSessions[sortedSessions.length - 1];
  const lastEnd = timeToMinutes(lastSession.time) + lastSession.duration;
  const requiredGapAfter = newSessionType === 'onsite' && lastSession.type === 'onsite'
    ? sessionDuration + travelTime
    : sessionDuration + minGap;

  if (endOfDay - lastEnd >= requiredGapAfter) {
    const suggestedTime = lastEnd + (newSessionType === 'onsite' ? travelTime : minGap);
    const timeStr = minutesToTime(suggestedTime);
    availableSlots.push({
      time: timeStr,
      timeAr: formatTimeAr(timeStr),
      reason: `بعد جلسة ${lastSession.studentName}`,
      priority: 'medium',
    });
  }

  // Sort by priority and limit to 4 suggestions
  return availableSlots
    .sort((a, b) => {
      if (a.priority === 'high' && b.priority !== 'high') return -1;
      if (b.priority === 'high' && a.priority !== 'high') return 1;
      return 0;
    })
    .slice(0, 4);
}

export default useSchedulingSuggestions;

