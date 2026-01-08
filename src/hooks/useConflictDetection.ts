import { useState, useCallback, useMemo } from 'react';
import { Student, Session } from '@/types/student';

export type ConflictSeverity = 'none' | 'warning' | 'error';
export type ConflictType = 'exact' | 'partial' | 'close' | 'none';

export interface ConflictResult {
  severity: ConflictSeverity;
  type: ConflictType;
  conflicts: ConflictDetail[];
  suggestions: TimeSuggestion[];
}

export interface ConflictDetail {
  session: Session;
  student: Student;
  type: ConflictType;
  gap?: number; // Gap in minutes for 'close' type
  message: string;
  messageAr: string;
}

export interface TimeSuggestion {
  time: string;
  label: string;
  labelAr: string;
}

export interface SessionTimeInfo {
  date: string;
  startTime: string;
  duration?: number; // minutes, defaults to 60
}

const DEFAULT_SESSION_DURATION = 60; // minutes
const MIN_GAP_MINUTES = 15;

// Helper to parse time to minutes
const timeToMinutes = (time: string): number => {
  if (!time) return 16 * 60; // Default 4 PM
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

// Helper to convert minutes to time string
const minutesToTime = (minutes: number): string => {
  const normalizedMinutes = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(normalizedMinutes / 60);
  const m = normalizedMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

// Format time in Arabic (12-hour)
export const formatTimeAr = (time: string): string => {
  if (!time) return '4:00 م';
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'م' : 'ص';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
};

export const useConflictDetection = (students: Student[]) => {
  /**
   * Check for conflicts when adding/editing a session
   */
  const checkConflict = useCallback((
    sessionInfo: SessionTimeInfo,
    excludeSessionId?: string
  ): ConflictResult => {
    const { date, startTime, duration = DEFAULT_SESSION_DURATION } = sessionInfo;
    const startMinutes = timeToMinutes(startTime);
    const endMinutes = startMinutes + duration;

    const conflicts: ConflictDetail[] = [];
    let highestSeverity: ConflictSeverity = 'none';
    let highestType: ConflictType = 'none';

    // Get all sessions on the same date
    students.forEach(student => {
      student.sessions.forEach(session => {
        // Skip excluded session (when editing)
        if (excludeSessionId && session.id === excludeSessionId) return;
        // Skip cancelled sessions - they don't conflict
        if (session.status === 'cancelled') return;
        // Skip vacation sessions - they don't conflict
        if (session.status === 'vacation') return;
        // Only check same date
        if (session.date !== date) return;

        const sessionStartTime = session.time || student.sessionTime || '16:00';
        const otherStartMinutes = timeToMinutes(sessionStartTime);
        const otherEndMinutes = otherStartMinutes + DEFAULT_SESSION_DURATION;

        // Check exact overlap
        if (startMinutes === otherStartMinutes) {
          conflicts.push({
            session,
            student,
            type: 'exact',
            message: `Conflicts with ${student.name}'s session at same time`,
            messageAr: `تعارض مع جلسة ${student.name} في نفس الوقت`,
          });
          highestSeverity = 'error';
          highestType = 'exact';
          return;
        }

        // Check partial overlap
        const overlaps =
          (startMinutes >= otherStartMinutes && startMinutes < otherEndMinutes) ||
          (endMinutes > otherStartMinutes && endMinutes <= otherEndMinutes) ||
          (startMinutes <= otherStartMinutes && endMinutes >= otherEndMinutes);

        if (overlaps) {
          conflicts.push({
            session,
            student,
            type: 'partial',
            message: `Overlaps with ${student.name}'s session`,
            messageAr: `تداخل مع جلسة ${student.name}`,
          });
          highestSeverity = 'error';
          if (highestType !== 'exact') highestType = 'partial';
          return;
        }

        // Check close sessions (< 15 min gap)
        const gapBefore = otherStartMinutes - endMinutes; // Gap if new session is before
        const gapAfter = startMinutes - otherEndMinutes; // Gap if new session is after

        if (gapBefore >= 0 && gapBefore < MIN_GAP_MINUTES) {
          conflicts.push({
            session,
            student,
            type: 'close',
            gap: gapBefore,
            message: `Only ${gapBefore} min gap before ${student.name}'s session`,
            messageAr: `فاصل ${gapBefore} دقيقة فقط قبل جلسة ${student.name}`,
          });
          if (highestSeverity !== 'error') highestSeverity = 'warning';
          if (highestType === 'none') highestType = 'close';
        } else if (gapAfter >= 0 && gapAfter < MIN_GAP_MINUTES) {
          conflicts.push({
            session,
            student,
            type: 'close',
            gap: gapAfter,
            message: `Only ${gapAfter} min gap after ${student.name}'s session`,
            messageAr: `فاصل ${gapAfter} دقيقة فقط بعد جلسة ${student.name}`,
          });
          if (highestSeverity !== 'error') highestSeverity = 'warning';
          if (highestType === 'none') highestType = 'close';
        }
      });
    });

    // Generate time suggestions if there are conflicts
    const suggestions: TimeSuggestion[] = [];
    if (highestSeverity !== 'none') {
      // Find all sessions on the same date
      const sessionsOnDate: { start: number; end: number }[] = [];
      students.forEach(student => {
        student.sessions.forEach(session => {
          if (session.date !== date) return;
          if (session.status === 'cancelled' || session.status === 'vacation') return;
          if (excludeSessionId && session.id === excludeSessionId) return;
          const time = session.time || student.sessionTime || '16:00';
          const start = timeToMinutes(time);
          sessionsOnDate.push({ start, end: start + DEFAULT_SESSION_DURATION });
        });
      });

      sessionsOnDate.sort((a, b) => a.start - b.start);

      // Suggest times with 15+ minute gaps
      if (sessionsOnDate.length > 0) {
        // Before first session
        const firstSession = sessionsOnDate[0];
        if (firstSession.start >= duration + MIN_GAP_MINUTES) {
          const suggestedTime = firstSession.start - duration - MIN_GAP_MINUTES;
          if (suggestedTime >= 8 * 60) { // After 8 AM
            suggestions.push({
              time: minutesToTime(suggestedTime),
              label: `Before: ${formatTimeAr(minutesToTime(suggestedTime))}`,
              labelAr: `قبل: ${formatTimeAr(minutesToTime(suggestedTime))}`,
            });
          }
        }

        // After each session
        sessionsOnDate.forEach((session, idx) => {
          const nextSession = sessionsOnDate[idx + 1];
          const suggestedStart = session.end + MIN_GAP_MINUTES;
          const suggestedEnd = suggestedStart + duration;

          // Check if there's room before the next session
          if (!nextSession || suggestedEnd + MIN_GAP_MINUTES <= nextSession.start) {
            if (suggestedStart < 23 * 60) { // Before 11 PM
              suggestions.push({
                time: minutesToTime(suggestedStart),
                label: `After: ${formatTimeAr(minutesToTime(suggestedStart))}`,
                labelAr: `بعد: ${formatTimeAr(minutesToTime(suggestedStart))}`,
              });
            }
          }
        });
      }

      // Limit to 3 suggestions
      suggestions.splice(3);
    }

    return {
      severity: highestSeverity,
      type: highestType,
      conflicts,
      suggestions,
    };
  }, [students]);

  /**
   * Check conflicts for restoring a vacation session
   */
  const checkRestoreConflict = useCallback((
    studentId: string,
    sessionId: string
  ): ConflictResult => {
    const student = students.find(s => s.id === studentId);
    if (!student) {
      return { severity: 'none', type: 'none', conflicts: [], suggestions: [] };
    }

    const session = student.sessions.find(s => s.id === sessionId);
    if (!session) {
      return { severity: 'none', type: 'none', conflicts: [], suggestions: [] };
    }

    const sessionTime = session.time || student.sessionTime || '16:00';
    return checkConflict(
      { date: session.date, startTime: sessionTime },
      sessionId // Exclude this session from check
    );
  }, [students, checkConflict]);

  /**
   * Get all sessions on a date with their gap information
   */
  const getSessionsWithGaps = useCallback((date: string): Array<{
    session: Session;
    student: Student;
    startMinutes: number;
    endMinutes: number;
    gapAfter: number | null;
    gapSeverity: 'good' | 'warning' | 'critical';
    hasConflict: boolean;
    conflictType?: ConflictType;
  }> => {
    const sessionsOnDate: Array<{
      session: Session;
      student: Student;
      startMinutes: number;
      endMinutes: number;
    }> = [];

    students.forEach(student => {
      student.sessions.forEach(session => {
        if (session.date !== date) return;
        if (session.status === 'cancelled' || session.status === 'vacation') return;

        const time = session.time || student.sessionTime || '16:00';
        const startMinutes = timeToMinutes(time);
        sessionsOnDate.push({
          session,
          student,
          startMinutes,
          endMinutes: startMinutes + DEFAULT_SESSION_DURATION,
        });
      });
    });

    // Sort by start time
    sessionsOnDate.sort((a, b) => a.startMinutes - b.startMinutes);

    // Calculate gaps and conflicts
    return sessionsOnDate.map((item, idx) => {
      const nextSession = sessionsOnDate[idx + 1];
      let gapAfter: number | null = null;
      let gapSeverity: 'good' | 'warning' | 'critical' = 'good';

      if (nextSession) {
        gapAfter = nextSession.startMinutes - item.endMinutes;
        if (gapAfter < 0) {
          gapSeverity = 'critical'; // Overlap
        } else if (gapAfter < MIN_GAP_MINUTES) {
          gapSeverity = 'warning'; // Too close
        } else {
          gapSeverity = 'good';
        }
      }

      // Check for conflicts with other sessions
      let hasConflict = false;
      let conflictType: ConflictType | undefined;

      sessionsOnDate.forEach((other, otherIdx) => {
        if (idx === otherIdx) return;

        // Check exact overlap
        if (item.startMinutes === other.startMinutes) {
          hasConflict = true;
          conflictType = 'exact';
          return;
        }

        // Check partial overlap
        const overlaps =
          (item.startMinutes >= other.startMinutes && item.startMinutes < other.endMinutes) ||
          (item.endMinutes > other.startMinutes && item.endMinutes <= other.endMinutes);

        if (overlaps) {
          hasConflict = true;
          if (!conflictType) conflictType = 'partial';
        }
      });

      return {
        ...item,
        gapAfter,
        gapSeverity,
        hasConflict,
        conflictType,
      };
    });
  }, [students]);

  /**
   * Scan all sessions for conflicts (used for visual indicators)
   */
  const scanAllConflicts = useCallback((): Map<string, ConflictResult> => {
    const results = new Map<string, ConflictResult>();

    students.forEach(student => {
      student.sessions.forEach(session => {
        if (session.status === 'cancelled' || session.status === 'vacation') return;

        const sessionTime = session.time || student.sessionTime || '16:00';
        const result = checkConflict(
          { date: session.date, startTime: sessionTime },
          session.id
        );

        if (result.severity !== 'none') {
          results.set(session.id, result);
        }
      });
    });

    return results;
  }, [students, checkConflict]);

  return {
    checkConflict,
    checkRestoreConflict,
    getSessionsWithGaps,
    scanAllConflicts,
    formatTimeAr,
  };
};
