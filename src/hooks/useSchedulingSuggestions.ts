import { useMemo } from 'react';
import { Student, SessionType, Location as StudentLocation } from '@/types/student';
import { DAY_NAMES_AR } from '@/lib/arabicConstants';

// Types for scheduling suggestions
export type SuggestionType =
  | 'free_day'           // Day with no sessions - highly recommended
  | 'light_day'          // Day with 1-2 sessions - good option
  | 'moderate_day'       // Day with 3-4 sessions - acceptable
  | 'busy_day'           // Day with 5+ sessions - avoid
  | 'same_type_cluster'  // Day has same session type - efficient
  | 'mixed_type';        // Day has both online/onsite - less efficient

// Proximity-based suggestion (nearby students)
export interface ProximitySuggestion {
  dayOfWeek: number;
  dayName: string;
  nearbyStudent: string;
  nearbyStudentTime: string;
  nearbyStudentTimeAr: string;
  suggestedTime: string;
  suggestedTimeAr: string;
  distanceKm: number;
  placement: 'before' | 'after';
  reason: string;
}

export type SuggestionPriority = 'high' | 'medium' | 'low';

export type TimePeriod = 'morning' | 'afternoon' | 'evening';

export interface SuggestedTimeSlot {
  time: string;        // HH:mm format
  timeAr: string;      // Arabic formatted time
  reason: string;      // Why this time is suggested
  priority: SuggestionPriority;
  period?: TimePeriod;  // Time of day
  isPeakHour?: boolean; // Whether this is a peak hour
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
  travelConsideration?: string;
  consecutiveWarning?: string;     // Warning about back-to-back sessions
  energyTip?: string;              // Tip about energy levels
  // Session type dominance
  onsiteDominant?: boolean;        // Day has 60%+ onsite sessions
  onlineDominant?: boolean;        // Day has 60%+ online sessions
}

// Peak hour analysis
export interface PeakHourInfo {
  hour: number;
  sessionCount: number;
  isPeak: boolean;
}

// Workload balance
export interface WorkloadBalance {
  morningCount: number;    // 8-12
  afternoonCount: number;  // 12-17
  eveningCount: number;    // 17-22
  busiestPeriod: TimePeriod;
  quietestPeriod: TimePeriod;
  isBalanced: boolean;
}

// Similar student for grouping suggestions
export interface SimilarStudentMatch {
  studentId: string;
  studentName: string;
  matchingDays: number[];
  matchingDayNames: string[];
  sessionType: SessionType;
  sessionTime: string;
  sessionTimeAr: string;
  matchScore: number; // 0-100 how similar
  reason: string;
}

// Grouping suggestion
export interface GroupingSuggestion {
  dayOfWeek: number;
  dayName: string;
  existingStudents: string[];
  suggestedTime: string;
  suggestedTimeAr: string;
  reason: string;
  benefit: string;
}

export interface SchedulingSuggestions {
  daySuggestions: DaySuggestion[];
  bestDays: number[];
  avoidDays: number[];
  generalTips: string[];
  overallLoad: 'light' | 'moderate' | 'heavy';
  // Enhanced analytics
  peakHours: PeakHourInfo[];
  workloadBalance: WorkloadBalance;
  weeklyStats: {
    totalSessions: number;
    avgSessionsPerDay: number;
    consecutiveSessionDays: number[];
    longestStreak: number;
  };
  smartRecommendations: string[];
  // Similar student grouping
  similarStudents: SimilarStudentMatch[];
  groupingSuggestions: GroupingSuggestion[];
  // NEW: Proximity-based suggestions
  proximitySuggestions: ProximitySuggestion[];
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

// Get time period
const getTimePeriod = (time: string): TimePeriod => {
  const minutes = timeToMinutes(time);
  if (minutes < 12 * 60) return 'morning';
  if (minutes < 17 * 60) return 'afternoon';
  return 'evening';
};

// Get Arabic name for time period
const getPeriodNameAr = (period: TimePeriod): string => {
  switch (period) {
    case 'morning': return 'الصباح';
    case 'afternoon': return 'الظهيرة';
    case 'evening': return 'المساء';
  }
};

interface ScheduledSession {
  time: string;
  duration: number;
  type: SessionType;
  studentName: string;
  studentId?: string;
  location?: StudentLocation;
}

interface DayStats {
  dayOfWeek: number;
  totalSessions: number;
  onlineSessions: number;
  onsiteSessions: number;
  scheduledSessions: ScheduledSession[];
}

/**
 * Calculate distance between two locations using Haversine formula
 * Returns distance in kilometers
 */
function calculateDistanceKm(loc1: StudentLocation, loc2: StudentLocation): number {
  const R = 6371; // Earth's radius in km
  const dLat = (loc2.lat - loc1.lat) * Math.PI / 180;
  const dLon = (loc2.lng - loc1.lng) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(loc1.lat * Math.PI / 180) * Math.cos(loc2.lat * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Find proximity-based suggestions for nearby onsite students
 */
function findProximitySuggestions(
  students: Student[],
  newLocation: StudentLocation | null | undefined,
  dayStats: DayStats[]
): ProximitySuggestion[] {
  if (!newLocation) return [];

  const suggestions: ProximitySuggestion[] = [];
  const NEARBY_THRESHOLD_KM = 5; // 5km radius

  // Find onsite students with locations
  const onsiteStudentsWithLocation = students.filter(s =>
    s.sessionType === 'onsite' && s.location
  );

  if (onsiteStudentsWithLocation.length === 0) return [];

  // Check each day for nearby students
  dayStats.forEach(day => {
    const onsiteSessions = day.scheduledSessions.filter(s =>
      s.type === 'onsite' && s.location
    );

    onsiteSessions.forEach(session => {
      if (!session.location) return;

      const distance = calculateDistanceKm(newLocation, session.location);

      if (distance <= NEARBY_THRESHOLD_KM) {
        const sessionTime = timeToMinutes(session.time);
        const sessionEnd = sessionTime + session.duration;

        // Suggest time before (with 30 min travel buffer)
        const beforeTime = sessionTime - 90; // 1.5 hours before
        // Suggest time after (with 30 min travel buffer)
        const afterTime = sessionEnd + 30; // 30 min after

        // Check which slot is better
        if (beforeTime >= 8 * 60) { // After 8 AM
          suggestions.push({
            dayOfWeek: day.dayOfWeek,
            dayName: DAY_NAMES_AR[day.dayOfWeek],
            nearbyStudent: session.studentName,
            nearbyStudentTime: session.time,
            nearbyStudentTimeAr: formatTimeAr(session.time),
            suggestedTime: minutesToTime(beforeTime),
            suggestedTimeAr: formatTimeAr(minutesToTime(beforeTime)),
            distanceKm: distance,
            placement: 'before',
            reason: `📍 قريب من ${session.studentName} (${distance.toFixed(1)} كم) - قبل جلسته`,
          });
        }

        if (afterTime <= 21 * 60) { // Before 9 PM
          suggestions.push({
            dayOfWeek: day.dayOfWeek,
            dayName: DAY_NAMES_AR[day.dayOfWeek],
            nearbyStudent: session.studentName,
            nearbyStudentTime: session.time,
            nearbyStudentTimeAr: formatTimeAr(session.time),
            suggestedTime: minutesToTime(afterTime),
            suggestedTimeAr: formatTimeAr(minutesToTime(afterTime)),
            distanceKm: distance,
            placement: 'after',
            reason: `📍 قريب من ${session.studentName} (${distance.toFixed(1)} كم) - بعد جلسته`,
          });
        }
      }
    });
  });

  // Sort by distance (closest first) and limit to 2 suggestions
  return suggestions
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, 2);
}

/**
 * Check if sessions are consecutive (back-to-back)
 */
function countConsecutiveSessions(sessions: ScheduledSession[]): number {
  if (sessions.length < 2) return 0;

  const sorted = [...sessions].sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
  let consecutiveCount = 0;

  for (let i = 0; i < sorted.length - 1; i++) {
    const currentEnd = timeToMinutes(sorted[i].time) + sorted[i].duration;
    const nextStart = timeToMinutes(sorted[i + 1].time);
    const gap = nextStart - currentEnd;

    // Less than 15 minutes gap = consecutive
    if (gap < 15) {
      consecutiveCount++;
    }
  }

  return consecutiveCount;
}

/**
 * Analyze peak hours across all days
 */
function analyzePeakHours(dayStats: DayStats[]): PeakHourInfo[] {
  const hourCounts: Map<number, number> = new Map();

  // Count sessions per hour
  dayStats.forEach(day => {
    day.scheduledSessions.forEach(session => {
      const hour = Math.floor(timeToMinutes(session.time) / 60);
      hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
    });
  });

  // Find threshold for peak (60% of max)
  const counts = Array.from(hourCounts.values());
  const maxCount = Math.max(...counts, 0);
  const peakThreshold = maxCount * 0.6;

  // Build peak hours info
  const peakHours: PeakHourInfo[] = [];
  for (let hour = 8; hour <= 21; hour++) {
    const count = hourCounts.get(hour) || 0;
    peakHours.push({
      hour,
      sessionCount: count,
      isPeak: count >= peakThreshold && count > 0,
    });
  }

  return peakHours;
}

/**
 * Analyze workload balance across time periods
 */
function analyzeWorkloadBalance(dayStats: DayStats[]): WorkloadBalance {
  let morningCount = 0;
  let afternoonCount = 0;
  let eveningCount = 0;

  dayStats.forEach(day => {
    day.scheduledSessions.forEach(session => {
      const period = getTimePeriod(session.time);
      switch (period) {
        case 'morning': morningCount++; break;
        case 'afternoon': afternoonCount++; break;
        case 'evening': eveningCount++; break;
      }
    });
  });

  const counts: Record<TimePeriod, number> = {
    morning: morningCount,
    afternoon: afternoonCount,
    evening: eveningCount,
  };

  const periods: TimePeriod[] = ['morning', 'afternoon', 'evening'];
  const busiestPeriod = periods.reduce((a, b) => counts[a] > counts[b] ? a : b);
  const quietestPeriod = periods.reduce((a, b) => counts[a] < counts[b] ? a : b);

  // Check if balanced (no period has more than 2x another)
  const max = Math.max(morningCount, afternoonCount, eveningCount);
  const min = Math.min(morningCount, afternoonCount, eveningCount);
  const isBalanced = min === 0 ? max <= 3 : max / min <= 2;

  return {
    morningCount,
    afternoonCount,
    eveningCount,
    busiestPeriod,
    quietestPeriod,
    isBalanced,
  };
}

/**
 * Find students with similar schedules for grouping suggestions
 */
function findSimilarStudents(
  students: Student[],
  newSessionType: SessionType | null,
  selectedDays: number[]
): SimilarStudentMatch[] {
  if (!newSessionType || students.length === 0) return [];

  const similarStudents: SimilarStudentMatch[] = [];

  students.forEach(student => {
    // Check if same session type
    if (student.sessionType !== newSessionType) return;

    // Get student's schedule days
    const studentDays = student.scheduleDays.map(d => d.dayOfWeek);

    // Find matching days with selected days (if any selected)
    const matchingDays = selectedDays.length > 0
      ? studentDays.filter(d => selectedDays.includes(d))
      : studentDays;

    // Calculate match score based on various factors
    let matchScore = 0;

    // Same session type = 40 points
    matchScore += 40;

    // Matching days = up to 30 points
    if (selectedDays.length > 0 && matchingDays.length > 0) {
      matchScore += Math.min(30, matchingDays.length * 15);
    } else if (selectedDays.length === 0) {
      // No days selected yet, show all same-type students
      matchScore += 20;
    }

    // Similar time preference = up to 30 points
    const studentTime = student.sessionTime || '16:00';
    const studentPeriod = getTimePeriod(studentTime);
    // We'll give points based on time period match potential
    matchScore += 20;

    // Only include if score >= 50
    if (matchScore >= 50) {
      const primaryTime = student.scheduleDays[0]?.time || student.sessionTime || '16:00';

      similarStudents.push({
        studentId: student.id,
        studentName: student.name,
        matchingDays: studentDays,
        matchingDayNames: studentDays.map(d => DAY_NAMES_AR[d]),
        sessionType: student.sessionType,
        sessionTime: primaryTime,
        sessionTimeAr: formatTimeAr(primaryTime),
        matchScore,
        reason: generateSimilarityReason(student, newSessionType, matchingDays),
      });
    }
  });

  // Sort by match score (highest first) and limit to 5
  return similarStudents
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 5);
}

/**
 * Generate reason text for why a student is similar
 */
function generateSimilarityReason(
  student: Student,
  newSessionType: SessionType,
  matchingDays: number[]
): string {
  const reasons: string[] = [];

  if (student.sessionType === newSessionType) {
    reasons.push(newSessionType === 'online' ? 'نفس النوع (أونلاين)' : 'نفس النوع (حضوري)');
  }

  if (matchingDays.length > 0) {
    const dayNames = matchingDays.map(d => DAY_NAMES_AR[d]).join('، ');
    reasons.push(`أيام مشتركة: ${dayNames}`);
  }

  return reasons.join(' | ') || 'طالب مشابه';
}

/**
 * Generate grouping suggestions based on existing students
 */
function generateGroupingSuggestions(
  students: Student[],
  newSessionType: SessionType | null,
  dayStats: DayStats[]
): GroupingSuggestion[] {
  if (!newSessionType || students.length === 0) return [];

  const suggestions: GroupingSuggestion[] = [];

  // Find days where same-type students are already scheduled
  dayStats.forEach(day => {
    const sameTypeSessions = day.scheduledSessions.filter(s =>
      (newSessionType === 'online' && s.type === 'online') ||
      (newSessionType === 'onsite' && s.type === 'onsite')
    );

    if (sameTypeSessions.length >= 1 && day.totalSessions < BUSY_DAY_THRESHOLD) {
      // Find a good time slot near existing same-type sessions
      const existingTimes = sameTypeSessions.map(s => timeToMinutes(s.time));
      const avgTime = Math.round(existingTimes.reduce((a, b) => a + b, 0) / existingTimes.length);

      // Suggest time before or after the cluster
      const minTime = Math.min(...existingTimes);
      const maxTime = Math.max(...existingTimes);

      let suggestedMinutes: number;
      if (minTime > 9 * 60) {
        // Suggest before the first session
        suggestedMinutes = minTime - 90; // 1.5 hours before
      } else {
        // Suggest after the last session
        suggestedMinutes = maxTime + 90; // 1.5 hours after
      }

      // Clamp to working hours
      suggestedMinutes = Math.max(8 * 60, Math.min(21 * 60, suggestedMinutes));

      const suggestedTime = minutesToTime(suggestedMinutes);
      const studentNames = sameTypeSessions.map(s => s.studentName);

      suggestions.push({
        dayOfWeek: day.dayOfWeek,
        dayName: DAY_NAMES_AR[day.dayOfWeek],
        existingStudents: studentNames,
        suggestedTime,
        suggestedTimeAr: formatTimeAr(suggestedTime),
        reason: `${studentNames.length} طالب ${newSessionType === 'online' ? 'أونلاين' : 'حضوري'} في نفس اليوم`,
        benefit: newSessionType === 'online'
          ? '💻 تنظيم أفضل - كل الجلسات أونلاين'
          : '🚗 توفير وقت التنقل - كل الجلسات حضورية',
      });
    }
  });

  // Sort by number of existing students (more = better grouping)
  return suggestions
    .sort((a, b) => b.existingStudents.length - a.existingStudents.length)
    .slice(0, 3);
}

/**
 * Hook to generate smart scheduling suggestions when adding a new student
 */
export const useSchedulingSuggestions = (
  students: Student[],
  newSessionType: SessionType | null,
  newLocation?: StudentLocation | null
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
          studentId: student.id,
          location: student.location,
        });
      });
    });

    // Sort sessions by time for each day
    dayStats.forEach(day => {
      day.scheduledSessions.sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
    });

    // Analyze peak hours and workload balance
    const peakHours = analyzePeakHours(dayStats);
    const workloadBalance = analyzeWorkloadBalance(dayStats);

    // Calculate total weekly sessions
    const totalWeeklySessions = dayStats.reduce((sum, d) => sum + d.totalSessions, 0);
    const avgSessionsPerDay = totalWeeklySessions / 7;

    // Find days with consecutive sessions
    const consecutiveSessionDays = dayStats
      .filter(d => countConsecutiveSessions(d.scheduledSessions) > 0)
      .map(d => d.dayOfWeek);

    // Find longest streak of working days
    let longestStreak = 0;
    let currentStreak = 0;
    for (let i = 0; i < 7; i++) {
      if (dayStats[i].totalSessions > 0) {
        currentStreak++;
        longestStreak = Math.max(longestStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    }

    // Determine overall load
    let overallLoad: 'light' | 'moderate' | 'heavy' = 'light';
    if (totalWeeklySessions > 25) overallLoad = 'heavy';
    else if (totalWeeklySessions > 12) overallLoad = 'moderate';

    // Generate suggestions for each day
    const daySuggestions: DaySuggestion[] = dayStats.map(day => {
      const suggestedTimeSlots = findAvailableTimeSlots(day.scheduledSessions, newSessionType, peakHours, workloadBalance);
      const consecutiveCount = countConsecutiveSessions(day.scheduledSessions);

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

      // RULE 7: Consecutive sessions warning
      if (consecutiveCount > 0) {
        suggestion.consecutiveWarning = `⚡ ${consecutiveCount} جلسات متتالية بدون استراحة - قد تحتاج راحة بين الحصص`;
      }

      // RULE 8: Energy tip based on time distribution
      if (day.scheduledSessions.length > 0) {
        const periods = day.scheduledSessions.map(s => getTimePeriod(s.time));
        const eveningSessionCount = periods.filter(p => p === 'evening').length;
        const morningSessionCount = periods.filter(p => p === 'morning').length;

        if (eveningSessionCount >= 3) {
          suggestion.energyTip = '🌙 معظم الجلسات مسائية - تأكد من الحصول على راحة كافية';
        } else if (morningSessionCount >= 3) {
          suggestion.energyTip = '☀️ معظم الجلسات صباحية - ابدأ يومك بنشاط!';
        }
      }

      // RULE 9: Session type dominance (60% threshold)
      if (day.totalSessions >= 2) {
        const onsiteRatio = day.onsiteSessions / day.totalSessions;
        const onlineRatio = day.onlineSessions / day.totalSessions;

        suggestion.onsiteDominant = onsiteRatio >= 0.6;
        suggestion.onlineDominant = onlineRatio >= 0.6;

        // Smart warning: adding opposite type to dominant day
        if (newSessionType === 'onsite' && suggestion.onlineDominant && !suggestion.isWarning) {
          suggestion.travelConsideration = '💻 يوم أغلبه أونلاين - يفضل إبقاؤه للجلسات الأونلاين';
          suggestion.isRecommended = false;
          suggestion.priority = 'low';
        }

        // Smart recommendation: adding same type to dominant day
        if (newSessionType === 'onsite' && suggestion.onsiteDominant && !suggestion.isWarning) {
          suggestion.travelConsideration = '🚗 يوم أغلبه حضوري - مناسب لتقليل التنقل';
          suggestion.isRecommended = true;
          suggestion.priority = 'high';
        }

        if (newSessionType === 'online' && suggestion.onsiteDominant && !suggestion.isWarning) {
          suggestion.travelConsideration = '🏠 يوم أغلبه حضوري - يفضل إبقاؤه للجلسات الحضورية';
          suggestion.isRecommended = false;
          suggestion.priority = 'low';
        }

        if (newSessionType === 'online' && suggestion.onlineDominant && !suggestion.isWarning) {
          suggestion.travelConsideration = '💻 يوم أغلبه أونلاين - مناسب للتنظيم';
          suggestion.isRecommended = true;
          suggestion.priority = 'high';
        }
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

    // Generate smart recommendations
    const smartRecommendations: string[] = [];

    // Peak hours recommendation
    const peakHoursList = peakHours.filter(h => h.isPeak);
    if (peakHoursList.length > 0) {
      const peakTimes = peakHoursList.map(h => formatTimeAr(`${h.hour}:00`)).join('، ');
      smartRecommendations.push(`🔥 أوقات الذروة: ${peakTimes} - فكر في أوقات أخرى لتوزيع أفضل`);
    }

    // Workload balance recommendation
    if (!workloadBalance.isBalanced) {
      const busyPeriod = getPeriodNameAr(workloadBalance.busiestPeriod);
      const quietPeriod = getPeriodNameAr(workloadBalance.quietestPeriod);
      smartRecommendations.push(`⚖️ معظم جلساتك في ${busyPeriod} - جرب إضافة جلسات في ${quietPeriod}`);
    }

    // Consecutive days recommendation
    if (longestStreak >= 5) {
      smartRecommendations.push(`📅 لديك ${longestStreak} أيام متتالية بها جلسات - خذ يوم راحة!`);
    }

    // Rest day recommendation
    const restDays = dayStats.filter(d => d.totalSessions === 0).length;
    if (restDays === 0 && totalWeeklySessions > 10) {
      smartRecommendations.push('🧘 لا يوجد يوم راحة! حاول إبقاء يوم واحد على الأقل فارغاً');
    }

    // Session variety recommendation
    const onlineTotal = dayStats.reduce((sum, d) => sum + d.onlineSessions, 0);
    const onsiteTotal = dayStats.reduce((sum, d) => sum + d.onsiteSessions, 0);
    if (onlineTotal > 0 && onsiteTotal > 0) {
      const ratio = Math.max(onlineTotal, onsiteTotal) / Math.min(onlineTotal, onsiteTotal);
      if (ratio > 3) {
        const dominant = onlineTotal > onsiteTotal ? 'أونلاين' : 'حضوري';
        smartRecommendations.push(`📊 معظم جلساتك ${dominant} - التنويع قد يساعد في تجديد النشاط`);
      }
    }

    // Find similar students for grouping
    const selectedDays = []; // Will be populated from UI when days are selected
    const similarStudents = findSimilarStudents(students, newSessionType, selectedDays);

    // Generate grouping suggestions
    const groupingSuggestions = generateGroupingSuggestions(students, newSessionType, dayStats);

    // Generate proximity suggestions for nearby onsite students
    const proximitySuggestions = newSessionType === 'onsite'
      ? findProximitySuggestions(students, newLocation, dayStats)
      : [];

    return {
      daySuggestions,
      bestDays,
      avoidDays,
      generalTips,
      overallLoad,
      peakHours,
      workloadBalance,
      weeklyStats: {
        totalSessions: totalWeeklySessions,
        avgSessionsPerDay,
        consecutiveSessionDays,
        longestStreak,
      },
      smartRecommendations,
      similarStudents,
      groupingSuggestions,
      proximitySuggestions,
    };
  }, [students, newSessionType, newLocation]);
};

/**
 * Find available time slots on a day based on existing sessions
 */
function findAvailableTimeSlots(
  sessions: ScheduledSession[],
  newSessionType: SessionType | null,
  peakHours: PeakHourInfo[],
  workloadBalance: WorkloadBalance
): SuggestedTimeSlot[] {
  const availableSlots: SuggestedTimeSlot[] = [];

  // Define working hours (8 AM to 10 PM)
  const startOfDay = 8 * 60;  // 8:00 AM
  const endOfDay = 22 * 60;   // 10:00 PM
  const sessionDuration = 60; // Assume 1 hour
  const minGap = 30;          // Minimum 30 min gap
  const travelTime = 45;      // Extra time for onsite travel

  // Helper to check if hour is peak
  const isPeakHour = (hour: number): boolean => {
    const info = peakHours.find(h => h.hour === hour);
    return info?.isPeak || false;
  };

  // Get priority based on workload balance
  const getPriorityForPeriod = (period: TimePeriod): SuggestionPriority => {
    if (period === workloadBalance.quietestPeriod) return 'high';
    if (period === workloadBalance.busiestPeriod) return 'low';
    return 'medium';
  };

  if (sessions.length === 0) {
    // Return slots prioritizing quietest period and non-peak hours
    const slots: SuggestedTimeSlot[] = [
      { time: '10:00', timeAr: formatTimeAr('10:00'), reason: 'وقت صباحي مريح', priority: getPriorityForPeriod('morning'), period: 'morning', isPeakHour: isPeakHour(10) },
      { time: '14:00', timeAr: formatTimeAr('14:00'), reason: 'بعد الظهر', priority: getPriorityForPeriod('afternoon'), period: 'afternoon', isPeakHour: isPeakHour(14) },
      { time: '16:00', timeAr: formatTimeAr('16:00'), reason: 'وقت العصر - الأكثر شيوعاً', priority: getPriorityForPeriod('afternoon'), period: 'afternoon', isPeakHour: isPeakHour(16) },
      { time: '18:00', timeAr: formatTimeAr('18:00'), reason: 'وقت المساء', priority: getPriorityForPeriod('evening'), period: 'evening', isPeakHour: isPeakHour(18) },
    ];

    // Boost non-peak hours priority
    slots.forEach(slot => {
      if (!slot.isPeakHour && slot.priority === 'medium') {
        slot.priority = 'high';
        slot.reason += ' (غير مزدحم)';
      } else if (slot.isPeakHour && slot.priority === 'high') {
        slot.priority = 'medium';
        slot.reason += ' (وقت ذروة)';
      }
    });

    return slots.sort((a, b) => {
      if (a.priority === 'high' && b.priority !== 'high') return -1;
      if (b.priority === 'high' && a.priority !== 'high') return 1;
      return 0;
    });
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
    const hour = Math.floor(suggestedTime / 60);
    const period = getTimePeriod(timeStr);
    const peak = isPeakHour(hour);

    availableSlots.push({
      time: timeStr,
      timeAr: formatTimeAr(timeStr),
      reason: peak ? `قبل جلسة ${sortedSessions[0].studentName} (وقت ذروة)` : `قبل جلسة ${sortedSessions[0].studentName}`,
      priority: peak ? 'low' : getPriorityForPeriod(period),
      period,
      isPeakHour: peak,
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
      const hour = Math.floor(suggestedTime / 60);
      const period = getTimePeriod(timeStr);
      const peak = isPeakHour(hour);

      availableSlots.push({
        time: timeStr,
        timeAr: formatTimeAr(timeStr),
        reason: `بين ${currentSession.studentName} و ${nextSession.studentName}`,
        priority: 'high', // Gaps between sessions are always good
        period,
        isPeakHour: peak,
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
    const hour = Math.floor(suggestedTime / 60);
    const period = getTimePeriod(timeStr);
    const peak = isPeakHour(hour);

    availableSlots.push({
      time: timeStr,
      timeAr: formatTimeAr(timeStr),
      reason: peak ? `بعد جلسة ${lastSession.studentName} (وقت ذروة)` : `بعد جلسة ${lastSession.studentName}`,
      priority: peak ? 'medium' : getPriorityForPeriod(period),
      period,
      isPeakHour: peak,
    });
  }

  // Sort by priority (non-peak first, then by priority level) and limit to 5 suggestions
  return availableSlots
    .sort((a, b) => {
      // Non-peak hours first
      if (!a.isPeakHour && b.isPeakHour) return -1;
      if (a.isPeakHour && !b.isPeakHour) return 1;
      // Then by priority
      if (a.priority === 'high' && b.priority !== 'high') return -1;
      if (b.priority === 'high' && a.priority !== 'high') return 1;
      if (a.priority === 'medium' && b.priority === 'low') return -1;
      if (b.priority === 'medium' && a.priority === 'low') return 1;
      return 0;
    })
    .slice(0, 5);
}

export default useSchedulingSuggestions;

