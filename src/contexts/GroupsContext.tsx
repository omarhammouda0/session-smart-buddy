import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { StudentGroup, GroupMember, GroupSession, SessionStatus, ScheduleDay, SessionType } from '@/types/student';

// Generate session dates based on schedule
const generateGroupSessionDates = (
  scheduleDays: ScheduleDay[],
  startDate: string,
  endDate: string
): string[] => {
  const dates: string[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  const current = new Date(start);
  while (current <= end) {
    const dayOfWeek = current.getDay();
    if (scheduleDays.some(d => d.dayOfWeek === dayOfWeek)) {
      dates.push(current.toISOString().split('T')[0]);
    }
    current.setDate(current.getDate() + 1);
  }

  return dates;
};

interface GroupsContextType {
  groups: StudentGroup[];
  activeGroups: StudentGroup[];
  isLoading: boolean;
  addGroup: (
    name: string,
    members: Omit<GroupMember, 'joinedAt' | 'isActive'>[],
    defaultPricePerStudent: number,
    sessionType: SessionType,
    scheduleDays: ScheduleDay[],
    sessionDuration: number,
    sessionTime: string,
    semesterStart: string,
    semesterEnd: string,
    description?: string,
    color?: string
  ) => Promise<StudentGroup | null>;
  updateGroup: (groupId: string, updates: Partial<Omit<StudentGroup, 'id' | 'createdAt' | 'sessions'>>) => Promise<void>;
  deleteGroup: (groupId: string) => Promise<void>;
  permanentlyDeleteGroup: (groupId: string) => Promise<void>;
  addMemberToGroup: (groupId: string, member: Omit<GroupMember, 'joinedAt' | 'isActive'>) => Promise<void>;
  removeMemberFromGroup: (groupId: string, studentId: string) => Promise<void>;
  updateMemberPrice: (groupId: string, studentId: string, customPrice: number | undefined) => Promise<void>;
  updateMemberAttendance: (groupId: string, sessionId: string, memberId: string, status: SessionStatus, note?: string) => Promise<void>;
  completeGroupSession: (groupId: string, sessionId: string) => Promise<void>;
  getGroupById: (groupId: string) => StudentGroup | undefined;
  getGroupSessionsForDate: (date: string) => Array<{ group: StudentGroup; session: GroupSession }>;
  calculateGroupEarnings: (groupId: string, month: number, year: number) => number;
  refreshGroups: () => Promise<void>;
}

const GroupsContext = createContext<GroupsContextType | undefined>(undefined);

export const GroupsProvider = ({ children }: { children: ReactNode }) => {
  const [groups, setGroups] = useState<StudentGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch all groups with related data from Supabase
  const fetchGroups = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setGroups([]);
        setIsLoading(false);
        return;
      }

      // Fetch groups
      const { data: groupsData, error: groupsError } = await supabase
        .from('student_groups')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (groupsError) throw groupsError;

      if (!groupsData || groupsData.length === 0) {
        setGroups([]);
        setIsLoading(false);
        return;
      }

      // Fetch all related data
      const groupIds = groupsData.map(g => g.id);

      const [membersResult, scheduleResult, sessionsResult] = await Promise.all([
        supabase.from('group_members').select('*').in('group_id', groupIds),
        supabase.from('group_schedule_days').select('*').in('group_id', groupIds),
        supabase.from('group_sessions').select('*').in('group_id', groupIds).order('date', { ascending: true }),
      ]);

      // Fetch attendance for all sessions
      const sessionIds = sessionsResult.data?.map(s => s.id) || [];
      const attendanceResult = sessionIds.length > 0
        ? await supabase.from('group_session_attendance').select('*').in('session_id', sessionIds)
        : { data: [] };

      // Transform to our types
      const transformedGroups: StudentGroup[] = groupsData.map(g => {
        const members: GroupMember[] = (membersResult.data || [])
          .filter(m => m.group_id === g.id)
          .map(m => ({
            studentId: m.student_id || m.id,
            studentName: m.student_name,
            phone: m.phone,
            parentPhone: m.parent_phone,
            customPrice: m.custom_price,
            joinedAt: m.joined_at,
            isActive: m.is_active,
          }));

        const scheduleDays: ScheduleDay[] = (scheduleResult.data || [])
          .filter(s => s.group_id === g.id)
          .map(s => ({
            dayOfWeek: s.day_of_week,
            time: s.time,
          }));

        const sessions: GroupSession[] = (sessionsResult.data || [])
          .filter(s => s.group_id === g.id)
          .map(s => {
            const attendance = (attendanceResult.data || [])
              .filter(a => a.session_id === s.id)
              .map(a => ({
                memberId: a.member_id,
                memberName: members.find(m => m.studentId === a.member_id)?.studentName || '',
                status: a.status as SessionStatus,
                note: a.note,
              }));

            return {
              id: s.id,
              groupId: s.group_id,
              date: s.date,
              time: s.time,
              duration: s.duration,
              completed: s.status === 'completed',
              status: s.status as SessionStatus,
              completedAt: s.completed_at,
              notes: s.notes,
              topic: s.topic,
              history: [],
              memberAttendance: attendance,
            };
          });

        return {
          id: g.id,
          name: g.name,
          description: g.description,
          color: g.color,
          members,
          defaultPricePerStudent: parseFloat(g.default_price_per_student),
          sessionType: g.session_type as SessionType,
          scheduleDays,
          sessionDuration: g.session_duration,
          sessionTime: g.session_time,
          semesterStart: g.semester_start,
          semesterEnd: g.semester_end,
          sessions,
          isActive: g.is_active,
          createdAt: g.created_at,
          updatedAt: g.updated_at,
        };
      });

      setGroups(transformedGroups);
    } catch (error) {
      console.error('Failed to fetch groups:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load groups on mount
  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  // Add a new group
  const addGroup = useCallback(async (
    name: string,
    members: Omit<GroupMember, 'joinedAt' | 'isActive'>[],
    defaultPricePerStudent: number,
    sessionType: SessionType,
    scheduleDays: ScheduleDay[],
    sessionDuration: number,
    sessionTime: string,
    semesterStart: string,
    semesterEnd: string,
    description?: string,
    color?: string
  ): Promise<StudentGroup | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // 1. Create the group
      const { data: groupData, error: groupError } = await supabase
        .from('student_groups')
        .insert({
          user_id: user.id,
          name,
          description,
          color: color || 'blue',
          default_price_per_student: defaultPricePerStudent,
          session_type: sessionType,
          session_duration: sessionDuration,
          session_time: sessionTime,
          semester_start: semesterStart,
          semester_end: semesterEnd,
        })
        .select()
        .single();

      if (groupError) throw groupError;

      const groupId = groupData.id;

      // 2. Create schedule days
      if (scheduleDays.length > 0) {
        const { error: scheduleError } = await supabase
          .from('group_schedule_days')
          .insert(scheduleDays.map(d => ({
            group_id: groupId,
            day_of_week: d.dayOfWeek,
            time: d.time,
          })));

        if (scheduleError) throw scheduleError;
      }

      // 3. Create members
      const memberInserts = members.map(m => ({
        group_id: groupId,
        student_id: m.studentId,
        student_name: m.studentName,
        phone: m.phone,
        parent_phone: m.parentPhone,
        custom_price: m.customPrice,
      }));

      const { data: membersData, error: membersError } = await supabase
        .from('group_members')
        .insert(memberInserts)
        .select();

      if (membersError) throw membersError;

      // 4. Generate and create sessions
      const sessionDates = generateGroupSessionDates(scheduleDays, semesterStart, semesterEnd);

      if (sessionDates.length > 0) {
        const sessionInserts = sessionDates.map(date => {
          const dayOfWeek = new Date(date).getDay();
          const scheduleDay = scheduleDays.find(d => d.dayOfWeek === dayOfWeek);
          return {
            group_id: groupId,
            date,
            time: scheduleDay?.time || sessionTime,
            duration: sessionDuration,
            status: 'scheduled',
          };
        });

        const { data: sessionsData, error: sessionsError } = await supabase
          .from('group_sessions')
          .insert(sessionInserts)
          .select();

        if (sessionsError) throw sessionsError;

        // 5. Create attendance records for each session
        if (sessionsData && membersData) {
          const attendanceInserts = sessionsData.flatMap(session =>
            membersData.map(member => ({
              session_id: session.id,
              member_id: member.id,
              status: 'scheduled',
            }))
          );

          if (attendanceInserts.length > 0) {
            const { error: attendanceError } = await supabase
              .from('group_session_attendance')
              .insert(attendanceInserts);

            if (attendanceError) throw attendanceError;
          }
        }
      }

      // Refresh groups
      await fetchGroups();

      return groups.find(g => g.id === groupId) || null;
    } catch (error) {
      console.error('Failed to add group:', error);
      return null;
    }
  }, [fetchGroups, groups]);

  // Update a group
  const updateGroup = useCallback(async (
    groupId: string,
    updates: Partial<Omit<StudentGroup, 'id' | 'createdAt' | 'sessions'>>
  ) => {
    try {
      const { error } = await supabase
        .from('student_groups')
        .update({
          name: updates.name,
          description: updates.description,
          color: updates.color,
          default_price_per_student: updates.defaultPricePerStudent,
          session_type: updates.sessionType,
          session_duration: updates.sessionDuration,
          session_time: updates.sessionTime,
          is_active: updates.isActive,
        })
        .eq('id', groupId);

      if (error) throw error;
      await fetchGroups();
    } catch (error) {
      console.error('Failed to update group:', error);
    }
  }, [fetchGroups]);

  // Delete a group (soft delete)
  const deleteGroup = useCallback(async (groupId: string) => {
    try {
      const { error } = await supabase
        .from('student_groups')
        .update({ is_active: false })
        .eq('id', groupId);

      if (error) throw error;
      await fetchGroups();
    } catch (error) {
      console.error('Failed to delete group:', error);
    }
  }, [fetchGroups]);

  // Permanently delete a group
  const permanentlyDeleteGroup = useCallback(async (groupId: string) => {
    try {
      const { error } = await supabase
        .from('student_groups')
        .delete()
        .eq('id', groupId);

      if (error) throw error;
      await fetchGroups();
    } catch (error) {
      console.error('Failed to permanently delete group:', error);
    }
  }, [fetchGroups]);

  // Add member to group
  const addMemberToGroup = useCallback(async (
    groupId: string,
    member: Omit<GroupMember, 'joinedAt' | 'isActive'>
  ) => {
    try {
      const { data: memberData, error: memberError } = await supabase
        .from('group_members')
        .insert({
          group_id: groupId,
          student_id: member.studentId,
          student_name: member.studentName,
          phone: member.phone,
          parent_phone: member.parentPhone,
          custom_price: member.customPrice,
        })
        .select()
        .single();

      if (memberError) throw memberError;

      // Add attendance records for future sessions
      const { data: futureSessions } = await supabase
        .from('group_sessions')
        .select('id')
        .eq('group_id', groupId)
        .gte('date', new Date().toISOString().split('T')[0]);

      if (futureSessions && futureSessions.length > 0) {
        const attendanceInserts = futureSessions.map(s => ({
          session_id: s.id,
          member_id: memberData.id,
          status: 'scheduled',
        }));

        await supabase.from('group_session_attendance').insert(attendanceInserts);
      }

      await fetchGroups();
    } catch (error) {
      console.error('Failed to add member to group:', error);
    }
  }, [fetchGroups]);

  // Remove member from group (soft delete)
  const removeMemberFromGroup = useCallback(async (groupId: string, studentId: string) => {
    try {
      const { error } = await supabase
        .from('group_members')
        .update({ is_active: false })
        .eq('group_id', groupId)
        .eq('student_id', studentId);

      if (error) throw error;
      await fetchGroups();
    } catch (error) {
      console.error('Failed to remove member from group:', error);
    }
  }, [fetchGroups]);

  // Update member's custom price
  const updateMemberPrice = useCallback(async (
    groupId: string,
    studentId: string,
    customPrice: number | undefined
  ) => {
    try {
      const { error } = await supabase
        .from('group_members')
        .update({ custom_price: customPrice })
        .eq('group_id', groupId)
        .eq('student_id', studentId);

      if (error) throw error;
      await fetchGroups();
    } catch (error) {
      console.error('Failed to update member price:', error);
    }
  }, [fetchGroups]);

  // Update session attendance for a member
  const updateMemberAttendance = useCallback(async (
    groupId: string,
    sessionId: string,
    memberId: string,
    status: SessionStatus,
    note?: string
  ) => {
    try {
      const { error } = await supabase
        .from('group_session_attendance')
        .update({ status, note })
        .eq('session_id', sessionId)
        .eq('member_id', memberId);

      if (error) throw error;
      await fetchGroups();
    } catch (error) {
      console.error('Failed to update member attendance:', error);
    }
  }, [fetchGroups]);

  // Mark entire group session as completed
  const completeGroupSession = useCallback(async (groupId: string, sessionId: string) => {
    try {
      // Update session status
      const { error: sessionError } = await supabase
        .from('group_sessions')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', sessionId);

      if (sessionError) throw sessionError;

      // Update all scheduled attendance to completed
      const { error: attendanceError } = await supabase
        .from('group_session_attendance')
        .update({ status: 'completed' })
        .eq('session_id', sessionId)
        .eq('status', 'scheduled');

      if (attendanceError) throw attendanceError;

      await fetchGroups();
    } catch (error) {
      console.error('Failed to complete group session:', error);
    }
  }, [fetchGroups]);

  // Get active groups only
  const activeGroups = groups.filter(g => g.isActive);

  // Get group by ID
  const getGroupById = useCallback((groupId: string) => {
    return groups.find(g => g.id === groupId);
  }, [groups]);

  // Get all group sessions for a specific date
  const getGroupSessionsForDate = useCallback((date: string) => {
    const sessionsForDate: Array<{ group: StudentGroup; session: GroupSession }> = [];

    groups.forEach(group => {
      if (!group.isActive) return;

      const session = group.sessions.find(s => s.date === date);
      if (session) {
        sessionsForDate.push({ group, session });
      }
    });

    return sessionsForDate;
  }, [groups]);

  // Calculate group earnings for a month
  const calculateGroupEarnings = useCallback((groupId: string, month: number, year: number) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return 0;

    let total = 0;

    group.sessions.forEach(session => {
      const sessionDate = new Date(session.date);
      if (sessionDate.getMonth() === month && sessionDate.getFullYear() === year) {
        if (session.status === 'completed') {
          session.memberAttendance.forEach(att => {
            if (att.status === 'completed') {
              const member = group.members.find(m => m.studentId === att.memberId);
              const price = member?.customPrice ?? group.defaultPricePerStudent;
              total += price;
            }
          });
        }
      }
    });

    return total;
  }, [groups]);

  const refreshGroups = useCallback(async () => {
    await fetchGroups();
  }, [fetchGroups]);

  const value: GroupsContextType = {
    groups,
    activeGroups,
    isLoading,
    addGroup,
    updateGroup,
    deleteGroup,
    permanentlyDeleteGroup,
    addMemberToGroup,
    removeMemberFromGroup,
    updateMemberPrice,
    updateMemberAttendance,
    completeGroupSession,
    getGroupById,
    getGroupSessionsForDate,
    calculateGroupEarnings,
    refreshGroups,
  };

  return (
    <GroupsContext.Provider value={value}>
      {children}
    </GroupsContext.Provider>
  );
};

// Custom hook to use the groups context
export const useGroups = () => {
  const context = useContext(GroupsContext);
  if (context === undefined) {
    throw new Error('useGroups must be used within a GroupsProvider');
  }
  return context;
};

export default GroupsContext;

