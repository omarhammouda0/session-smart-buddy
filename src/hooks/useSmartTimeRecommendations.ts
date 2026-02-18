import { useMemo, useCallback } from 'react';
import { Student, StudentGroup, Session, GroupSession, SessionType, Location as StudentLocation, AppSettings } from '@/types/student';
import { formatTimeAr } from '@/hooks/useConflictDetection';

// ── Types ──────────────────────────────────────────────────

export type SlotTier = 'gold' | 'green' | 'neutral';
export type TimePeriod = 'morning' | 'afternoon' | 'evening';

export interface SmartSlot {
  time: string;        // HH:mm
  timeAr: string;      // Arabic 12-hour
  score: number;       // 0-100
  tier: SlotTier;      // gold ≥ 75, green ≥ 50, neutral < 50
  priority: 'high' | 'medium' | 'low';
  period: TimePeriod;
  reasons: string[];   // Arabic reasons why this slot is good
  tags: string[];      // Short labels like "فارغ" / "قريب" / "نفس النوع"
}

export interface DayTip {
  icon: string;  // emoji
  text: string;  // Arabic tip
  type: 'info' | 'warning' | 'success';
}

export interface SmartRecommendations {
  slots: SmartSlot[];
  tips: DayTip[];
}

interface SmartRecommendationInput {
  students: Student[];
  groups: StudentGroup[];
  date: string;              // YYYY-MM-DD
  duration: number;          // minutes
  newSessionType?: SessionType;
  newLocation?: StudentLocation;
  settings?: AppSettings;
  excludeSessionId?: string; // for edit mode
}

// ── Constants ──────────────────────────────────────────────

const DEFAULT_DURATION = 60;
const MIN_GAP = 30;         // buffer between sessions
const TRAVEL_BUFFER = 45;   // onsite travel buffer
const SLOT_INTERVAL = 30;   // scan every 30 min
const PROXIMITY_KM = 10;    // suggest proximity within this range
const MAX_SLOTS = 8;

// ── Helpers ────────────────────────────────────────────────

const timeToMinutes = (time: string): number => {
  if (!time) return 16 * 60;
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

const minutesToTime = (minutes: number): string => {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const getTimePeriod = (minutes: number): TimePeriod => {
  if (minutes < 12 * 60) return 'morning';
  if (minutes < 17 * 60) return 'afternoon';
  return 'evening';
};

const getPeriodNameAr = (p: TimePeriod): string => {
  switch (p) {
    case 'morning':   return 'الصباح';
    case 'afternoon': return 'الظهيرة';
    case 'evening':   return 'المساء';
  }
};

/**
 * Haversine distance between two coordinates in km
 */
function haversineKm(a: StudentLocation, b: StudentLocation): number {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLon = (b.lng - a.lng) * Math.PI / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

// ── Existing session on date ───────────────────────────────

interface OccupiedSlot {
  start: number;       // minutes
  end: number;
  type: SessionType;
  location?: StudentLocation;
  name: string;        // student/group name
}

function collectOccupiedSlots(
  students: Student[],
  groups: StudentGroup[],
  date: string,
  excludeSessionId?: string,
): OccupiedSlot[] {
  const result: OccupiedSlot[] = [];

  students.forEach((student) => {
    student.sessions.forEach((session) => {
      if (session.date !== date) return;
      if (session.status === 'cancelled' || session.status === 'vacation') return;
      if (excludeSessionId && session.id === excludeSessionId) return;

      const t = session.time || student.sessionTime || '16:00';
      const dur = session.duration || student.sessionDuration || DEFAULT_DURATION;
      result.push({
        start: timeToMinutes(t),
        end: timeToMinutes(t) + dur,
        type: student.sessionType,
        location: session.location || student.location,
        name: student.name,
      });
    });
  });

  groups.forEach((group) => {
    group.sessions.forEach((session) => {
      if (session.date !== date) return;
      if (session.status === 'cancelled' || session.status === 'vacation') return;
      if (excludeSessionId && session.id === excludeSessionId) return;

      const t = session.time || group.sessionTime || '16:00';
      const dur = session.duration || group.sessionDuration || DEFAULT_DURATION;
      result.push({
        start: timeToMinutes(t),
        end: timeToMinutes(t) + dur,
        type: group.sessionType,
        location: session.location || group.location,
        name: `👥 ${group.name}`,
      });
    });
  });

  return result.sort((a, b) => a.start - b.start);
}

// ── Workload balance ───────────────────────────────────────

function computeWorkload(slots: OccupiedSlot[]): { morning: number; afternoon: number; evening: number; quietest: TimePeriod } {
  let morning = 0, afternoon = 0, evening = 0;
  slots.forEach(s => {
    const p = getTimePeriod(s.start);
    if (p === 'morning') morning++;
    else if (p === 'afternoon') afternoon++;
    else evening++;
  });
  const min = Math.min(morning, afternoon, evening);
  const quietest: TimePeriod =
    min === morning ? 'morning' :
    min === afternoon ? 'afternoon' : 'evening';
  return { morning, afternoon, evening, quietest };
}

// ── Peak hour detection ────────────────────────────────────

function getPeakHours(slots: OccupiedSlot[]): Set<number> {
  const hourCounts = new Map<number, number>();
  slots.forEach(s => {
    const hour = Math.floor(s.start / 60);
    hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
  });
  const peak = new Set<number>();
  hourCounts.forEach((count, hour) => {
    if (count >= 2) peak.add(hour);
  });
  return peak;
}

// ── Scoring engine ─────────────────────────────────────────

function scoreSlot(
  slotStart: number,
  duration: number,
  occupied: OccupiedSlot[],
  newType: SessionType | undefined,
  newLocation: StudentLocation | undefined,
  workload: ReturnType<typeof computeWorkload>,
  peakHours: Set<number>,
): { score: number; reasons: string[]; tags: string[] } {
  let score = 0;
  const reasons: string[] = [];
  const tags: string[] = [];
  const slotEnd = slotStart + duration;
  const hour = Math.floor(slotStart / 60);
  const period = getTimePeriod(slotStart);

  // ── 1. Base: free slot (+40) ──
  // Verified free (caller ensures no overlap), so always add
  score += 40;

  // ── 2. Type clustering (+15) ──
  if (newType && occupied.length > 0) {
    const sameTypeCount = occupied.filter(s => s.type === newType).length;
    const ratio = sameTypeCount / occupied.length;
    if (ratio >= 0.6) {
      score += 15;
      reasons.push(newType === 'onsite'
        ? '🚗 يوم حضوري — تجميع مناسب'
        : '💻 يوم أونلاين — تجميع مناسب');
      tags.push('نفس النوع');
    } else if (ratio >= 0.4) {
      score += 8;
    }
  }

  // ── 3. Travel awareness (+10 / +15) ──
  if (newType === 'onsite') {
    // Check nearest onsite neighbors
    const onsiteNeighbors = occupied.filter(s => s.type === 'onsite');
    let bestProximityBonus = 0;

    for (const neighbor of onsiteNeighbors) {
      // Close in time → might need travel buffer
      const gapAfter = slotStart - neighbor.end;
      const gapBefore = neighbor.start - slotEnd;
      const gap = Math.max(gapAfter, gapBefore, 0);

      if (gap >= TRAVEL_BUFFER) {
        // Has enough travel buffer → good
        if (newLocation && neighbor.location) {
          const dist = haversineKm(newLocation, neighbor.location);
          if (dist <= PROXIMITY_KM) {
            bestProximityBonus = Math.max(bestProximityBonus, 15);
            reasons.push(`📍 قريب من ${neighbor.name} (${dist.toFixed(1)} كم)`);
            tags.push('قريب');
          } else {
            bestProximityBonus = Math.max(bestProximityBonus, 5);
          }
        } else {
          bestProximityBonus = Math.max(bestProximityBonus, 10);
        }
      } else if (gap >= MIN_GAP && gap < TRAVEL_BUFFER) {
        // Tight travel window → slight penalty
        bestProximityBonus = Math.max(bestProximityBonus, 3);
      }
    }

    score += bestProximityBonus;

    // If no onsite neighbors and mixed day, online-dominant penalty
    if (onsiteNeighbors.length === 0 && occupied.length >= 2) {
      score -= 5;
      reasons.push('💡 معظم الجلسات أونلاين — فكر في يوم حضوري منفصل');
    }
  } else if (newType === 'online') {
    // Bonus if day is online-dominant
    const onlineCount = occupied.filter(s => s.type === 'online').length;
    if (occupied.length > 0 && onlineCount / occupied.length >= 0.6) {
      score += 10;
    }
  }

  // ── 4. Off-peak bonus (+8) ──
  if (!peakHours.has(hour)) {
    score += 8;
    reasons.push('⏰ وقت غير مزدحم');
    tags.push('هادئ');
  } else {
    reasons.push('⚠️ وقت ذروة');
  }

  // ── 5. Workload balance (+7) ──
  if (period === workload.quietest) {
    score += 7;
    reasons.push(`⚖️ ${getPeriodNameAr(period)} أقل ازدحاماً — توازن أفضل`);
    tags.push('متوازن');
  }

  // ── 6. Back-to-back optimization (+5) ──
  // Best: right after previous session with appropriate gap
  for (const s of occupied) {
    const gapAfterPrev = slotStart - s.end;
    if (gapAfterPrev >= MIN_GAP && gapAfterPrev <= MIN_GAP + 15) {
      // Ideal gap after previous — good for flow
      score += 5;
      reasons.push(`⏩ بعد ${s.name} مباشرة — ترتيب جيد`);
      tags.push('متتالي');
      break;
    }
    const gapBeforeNext = s.start - slotEnd;
    if (gapBeforeNext >= MIN_GAP && gapBeforeNext <= MIN_GAP + 15) {
      score += 5;
      reasons.push(`⏩ قبل ${s.name} مباشرة — ترتيب جيد`);
      tags.push('متتالي');
      break;
    }
  }

  // ── 7. Preferred window (+5) ──
  if (hour >= 14 && hour <= 20) {
    score += 5;
    reasons.push('🌟 وقت الذروة المفضل للتدريس');
  }

  // ── 8. Energy tips ──
  if (occupied.length >= 4) {
    reasons.push('💪 عدد جلسات كبير اليوم — خذ استراحة بين الحصص');
  }
  if (occupied.length >= 3 && hour >= 20) {
    reasons.push('🌙 جلسة متأخرة بعد يوم طويل — تأكد من طاقتك');
  }

  // Cap score at 100
  score = Math.min(100, Math.max(0, score));

  return { score, reasons, tags };
}

// ── Day tips generator ─────────────────────────────────────

function generateDayTips(
  occupied: OccupiedSlot[],
  newType?: SessionType,
  newLocation?: StudentLocation,
): DayTip[] {
  const tips: DayTip[] = [];

  if (occupied.length === 0) {
    tips.push({ icon: '✨', text: 'هذا اليوم فارغ — خيار ممتاز', type: 'success' });
    return tips;
  }

  if (occupied.length >= 5) {
    tips.push({ icon: '⚠️', text: `هذا اليوم مزدحم (${occupied.length} جلسات) — فكر في يوم آخر`, type: 'warning' });
  } else if (occupied.length >= 3) {
    tips.push({ icon: '📊', text: `${occupied.length} جلسات اليوم — لا تزال هناك مساحة`, type: 'info' });
  }

  // Type clustering
  const onsiteCount = occupied.filter(s => s.type === 'onsite').length;
  const onlineCount = occupied.filter(s => s.type === 'online').length;

  if (newType === 'onsite') {
    if (onsiteCount >= 2 && onlineCount === 0) {
      tips.push({ icon: '🚗', text: 'يوم حضوري — مناسب لتجميع الجلسات الحضورية', type: 'success' });
    } else if (onlineCount >= 2 && onsiteCount === 0) {
      tips.push({ icon: '💡', text: 'معظم الجلسات أونلاين — فكر في يوم آخر للحضوري', type: 'info' });
    }
  } else if (newType === 'online') {
    if (onlineCount >= 2 && onsiteCount === 0) {
      tips.push({ icon: '💻', text: 'يوم أونلاين — مناسب لتجميع الجلسات', type: 'success' });
    } else if (onsiteCount >= 2 && onlineCount === 0) {
      tips.push({ icon: '💡', text: 'معظم الجلسات حضوري — فكر في يوم آخر للأونلاين', type: 'info' });
    }
  }

  // Location tip
  if (newType === 'onsite' && newLocation) {
    tips.push({ icon: '📍', text: `الموقع: ${newLocation.address || newLocation.name || 'محدد'}`, type: 'info' });
  }

  // Energy tips
  if (occupied.length >= 4) {
    tips.push({ icon: '💪', text: 'يوم طويل — لا تنسَ أخذ استراحات قصيرة', type: 'info' });
  }

  // Consecutive streak detection
  const sorted = [...occupied].sort((a, b) => a.start - b.start);
  let maxConsec = 0, curConsec = 0;
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i].start - sorted[i - 1].end;
    if (gap < 45) {
      curConsec++;
      maxConsec = Math.max(maxConsec, curConsec);
    } else {
      curConsec = 0;
    }
  }
  if (maxConsec >= 2) {
    tips.push({ icon: '☕', text: `${maxConsec + 1} جلسات متتالية — خذ استراحة بعدها`, type: 'warning' });
  }

  return tips;
}

// ── Main hook ──────────────────────────────────────────────

export function useSmartTimeRecommendations(input: SmartRecommendationInput): SmartRecommendations {
  const {
    students,
    groups,
    date,
    duration,
    newSessionType,
    newLocation,
    settings,
    excludeSessionId,
  } = input;

  return useMemo(() => {
    if (!date) return { slots: [], tips: [] };

    const workStart = timeToMinutes(settings?.workingHoursStart || '08:00');
    const workEnd = timeToMinutes(settings?.workingHoursEnd || '22:00');

    // 1. Collect all occupied slots (students + groups)
    const occupied = collectOccupiedSlots(students, groups, date, excludeSessionId);

    // 2. Compute analytics
    const workload = computeWorkload(occupied);
    const peakHours = getPeakHours(occupied);

    // 3. Scan for free slots
    const smartSlots: SmartSlot[] = [];

    for (let slotStart = workStart; slotStart + duration <= workEnd; slotStart += SLOT_INTERVAL) {
      const slotEnd = slotStart + duration;

      // Check conflict (with MIN_GAP buffer)
      let hasConflict = false;
      for (const s of occupied) {
        // Need MIN_GAP buffer before and after; for onsite+onsite need TRAVEL_BUFFER
        const needTravel =
          newSessionType === 'onsite' && s.type === 'onsite';
        const buffer = needTravel ? TRAVEL_BUFFER : MIN_GAP;

        const overlapStart = slotStart < s.end + buffer;
        const overlapEnd = slotEnd + buffer > s.start;

        if (overlapStart && overlapEnd) {
          hasConflict = true;
          break;
        }
      }

      if (hasConflict) continue;

      // Score the slot
      const { score, reasons, tags } = scoreSlot(
        slotStart,
        duration,
        occupied,
        newSessionType,
        newLocation,
        workload,
        peakHours,
      );

      const period = getTimePeriod(slotStart);
      const tier: SlotTier = score >= 75 ? 'gold' : score >= 50 ? 'green' : 'neutral';
      const priority = tier === 'gold' ? 'high' : tier === 'green' ? 'medium' : 'low';

      smartSlots.push({
        time: minutesToTime(slotStart),
        timeAr: formatTimeAr(minutesToTime(slotStart)),
        score,
        tier,
        priority,
        period,
        reasons,
        tags,
      });
    }

    // Sort by score desc, take top MAX_SLOTS
    smartSlots.sort((a, b) => b.score - a.score);
    const topSlots = smartSlots.slice(0, MAX_SLOTS);

    // 4. Generate day tips
    const tips = generateDayTips(occupied, newSessionType, newLocation);

    return { slots: topSlots, tips };
  }, [students, groups, date, duration, newSessionType, newLocation, settings, excludeSessionId]);
}

/**
 * Standalone function (non-hook) for use inside IIFE render blocks
 */
export function getSmartRecommendations(input: SmartRecommendationInput): SmartRecommendations {
  if (!input.date) return { slots: [], tips: [] };

  const workStart = timeToMinutes(input.settings?.workingHoursStart || '08:00');
  const workEnd = timeToMinutes(input.settings?.workingHoursEnd || '22:00');

  const occupied = collectOccupiedSlots(input.students, input.groups, input.date, input.excludeSessionId);
  const workload = computeWorkload(occupied);
  const peakHours = getPeakHours(occupied);

  const smartSlots: SmartSlot[] = [];

  for (let slotStart = workStart; slotStart + input.duration <= workEnd; slotStart += SLOT_INTERVAL) {
    const slotEnd = slotStart + input.duration;

    let hasConflict = false;
    for (const s of occupied) {
      const needTravel = input.newSessionType === 'onsite' && s.type === 'onsite';
      const buffer = needTravel ? TRAVEL_BUFFER : MIN_GAP;

      const overlapStart = slotStart < s.end + buffer;
      const overlapEnd = slotEnd + buffer > s.start;

      if (overlapStart && overlapEnd) {
        hasConflict = true;
        break;
      }
    }

    if (hasConflict) continue;

    const { score, reasons, tags } = scoreSlot(
      slotStart,
      input.duration,
      occupied,
      input.newSessionType,
      input.newLocation,
      workload,
      peakHours,
    );

    const period = getTimePeriod(slotStart);
    const tier: SlotTier = score >= 75 ? 'gold' : score >= 50 ? 'green' : 'neutral';
    const priority = tier === 'gold' ? 'high' : tier === 'green' ? 'medium' : 'low';

    smartSlots.push({
      time: minutesToTime(slotStart),
      timeAr: formatTimeAr(minutesToTime(slotStart)),
      score,
      tier,
      priority,
      period,
      reasons,
      tags,
    });
  }

  smartSlots.sort((a, b) => b.score - a.score);
  const topSlots = smartSlots.slice(0, MAX_SLOTS);
  const tips = generateDayTips(occupied, input.newSessionType, input.newLocation);

  return { slots: topSlots, tips };
}
