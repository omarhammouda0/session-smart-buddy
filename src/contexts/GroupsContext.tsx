import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { StudentGroup, GroupMember, GroupSession, SessionStatus, ScheduleDay, SessionType, Location } from '@/types/student';
import { toast } from '@/hooks/use-toast';

// Helper to safely cast Json to Location
const parseLocation = (loc: unknown): Location | undefined => {
  if (!loc || typeof loc !== 'object') return undefined;
  const obj = loc as Record<string, unknown>;
  if (typeof obj.lat === 'number' && typeof obj.lng === 'number') {
    return obj as unknown as Location;
  }
  return undefined;
};

// Helper to get local YYYY-MM-DD string (avoids UTC shift from toISOString)
const toLocalDateStr = (d: Date): string => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

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
      dates.push(toLocalDateStr(current));
    }
    current.setDate(current.getDate() + 1);
  }

  return dates;
};

// Group member payment type
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
    color?: string,
    location?: { lat: number; lng: number; address?: string; name?: string } | null
  ) => Promise<string | null>;
  updateGroup: (groupId: string, updates: Partial<Omit<StudentGroup, 'id' | 'createdAt' | 'sessions'>>) => Promise<void>;
  deleteGroup: (groupId: string) => Promise<void>;
  permanentlyDeleteGroup: (groupId: string) => Promise<void>;
  addMemberToGroup: (groupId: string, member: Omit<GroupMember, 'joinedAt' | 'isActive'>) => Promise<void>;
  removeMemberFromGroup: (groupId: string, memberId: string) => Promise<void>;
  updateMemberPrice: (groupId: string, memberId: string, customPrice: number | undefined) => Promise<void>;
  updateMemberAttendance: (groupId: string, sessionId: string, memberId: string, status: SessionStatus, note?: string) => Promise<void>;
  completeGroupSession: (groupId: string, sessionId: string, topic?: string, notes?: string) => Promise<void>;
  cancelGroupSession: (groupId: string, sessionId: string, reason?: string) => Promise<void>;
  rescheduleGroupSession: (groupId: string, sessionId: string, newDate: string, newTime?: string) => Promise<void>;
  addGroupSessionForToday: (groupId: string, time?: string) => Promise<string | null>;
  getGroupById: (groupId: string) => StudentGroup | undefined;
  getGroupSessionsForDate: (date: string) => Array<{ group: StudentGroup; session: GroupSession }>;
  calculateGroupEarnings: (groupId: string, month: number, year: number) => number;
  refreshGroups: () => Promise<void>;
  // Payment functions
  recordGroupMemberPayment: (
    groupId: string,
    sessionId: string,
    memberId: string,
    amount: number,
    method: 'cash' | 'bank' | 'wallet',
    linkedStudentId?: string,
    notes?: string
  ) => Promise<void>;
  getGroupMemberPayments: (groupId: string, memberId?: string) => Promise<GroupMemberPayment[]>;
  updateGroupSessionDetails: (groupId: string, sessionId: string, details: { topic?: string; notes?: string }) => Promise<void>;
  updateGroupSessionDateTime: (groupId: string, sessionId: string, newDate: string, newTime: string) => Promise<void>;
}

const GroupsContext = createContext<GroupsContextType | undefined>(undefined);

export const GroupsProvider = ({ children }: { children: ReactNode }) => {
  const [groups, setGroups] = useState<StudentGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Fetch all groups with related data from Supabase
  const fetchGroups = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setGroups([]);
        setIsLoading(false);
        return;
      }
      setCurrentUserId(user.id);

      // Fetch groups
      const { data: groupsData, error: groupsError } = await supabase
        .from('student_groups')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (groupsError) {
        console.error('[Groups] Error fetching groups:', groupsError);
        throw groupsError;
      }

      if (!groupsData || groupsData.length === 0) {
        console.log('[Groups] No groups found');
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
      const transformedGroups: StudentGroup[] = groupsData.map((g) => {
        const members: GroupMember[] = (membersResult.data || [])
          .filter(m => m.group_id === g.id)
          .map(m => ({
            studentId: m.id, // The member's own ID (for group_members table operations)
            linkedStudentId: m.student_id || undefined, // The linked student's ID (for payment tracking)
            studentName: m.student_name,
            phone: m.phone,
            parentPhone: m.parent_phone,
            customPrice: m.custom_price ? Number(m.custom_price) : undefined,
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
              .map(a => {
                const member = members.find(m => m.studentId === a.member_id);
                return {
                  memberId: a.member_id,
                  memberName: member?.studentName || '',
                  status: a.status as SessionStatus,
                  note: a.note,
                };
              });

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
          defaultPricePerStudent: Number(g.default_price_per_student),
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
          location: parseLocation(g.location),
        };
      });

      console.log('[Groups] Loaded', transformedGroups.length, 'groups from Supabase');
      setGroups(transformedGroups);
    } catch (error) {
      console.error('[Groups] Failed to fetch groups:', error);
      toast({
        title: "خطأ في تحميل المجموعات",
        description: "حدث خطأ أثناء تحميل بيانات المجموعات",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load groups on mount
  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  // Set up realtime subscription (filtered by user_id to avoid cross-user triggers)
  useEffect(() => {
    if (!currentUserId) return;

    // Debounce realtime reloads to prevent rapid-fire refetches
    let reloadTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedFetch = () => {
      if (reloadTimer) clearTimeout(reloadTimer);
      reloadTimer = setTimeout(() => fetchGroups(), 300);
    };

    const groupsChannel = supabase
      .channel('groups-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'student_groups', filter: `user_id=eq.${currentUserId}` }, () => {
        debouncedFetch();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_sessions' }, () => {
        debouncedFetch();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_session_attendance' }, () => {
        debouncedFetch();
      })
      .subscribe();

    return () => {
      if (reloadTimer) clearTimeout(reloadTimer);
      supabase.removeChannel(groupsChannel);
    };
  }, [fetchGroups, currentUserId]);

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
    color?: string,
    location?: { lat: number; lng: number; address?: string; name?: string } | null
  ): Promise<StudentGroup | null> => {
    if (!currentUserId) {
      toast({ title: "خطأ", description: "يجب تسجيل الدخول أولاً", variant: "destructive" });
      return null;
    }

    try {
      // 1. Create the group
      const { data: groupData, error: groupError } = await supabase
        .from('student_groups')
        .insert({
          user_id: currentUserId,
          name,
          description,
          color: color || 'violet',
          default_price_per_student: defaultPricePerStudent,
          session_type: sessionType,
          session_duration: sessionDuration,
          session_time: sessionTime,
          semester_start: semesterStart,
          semester_end: semesterEnd,
          location: sessionType === 'onsite' && location ? location : null,
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
            time: d.time || sessionTime,
          })));

        if (scheduleError) throw scheduleError;
      }

      // 3. Create members
      let insertedMembers: { id: string }[] = [];
      if (members.length > 0) {
        const memberInserts = members.map(m => ({
          group_id: groupId,
          student_id: m.studentId?.startsWith('group_') ? null : m.studentId,
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
        insertedMembers = membersData || [];
      }

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
        if (sessionsData && insertedMembers.length > 0) {
          const attendanceInserts = sessionsData.flatMap(session =>
            insertedMembers.map(member => ({
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

      toast({ title: "تم إنشاء المجموعة", description: `تم إنشاء مجموعة "${name}" بنجاح` });
      await fetchGroups();
      // Note: groups state is stale in this closure after fetchGroups, so return groupId directly
      return groupId;
    } catch (error) {
      console.error('[Groups] Failed to add group:', error);
      toast({ title: "خطأ", description: "فشل في إنشاء المجموعة", variant: "destructive" });
      return null;
    }
  }, [currentUserId, fetchGroups]);

  // Update a group
  const updateGroup = useCallback(async (
    groupId: string,
    updates: Partial<Omit<StudentGroup, 'id' | 'createdAt' | 'sessions'>>
  ) => {
    try {
      // 1. Build metadata update — only include fields that are actually provided
      const dbUpdates: Record<string, unknown> = {};
      if ('name' in updates) dbUpdates.name = updates.name;
      if ('description' in updates) dbUpdates.description = updates.description;
      if ('color' in updates) dbUpdates.color = updates.color;
      if ('defaultPricePerStudent' in updates) dbUpdates.default_price_per_student = updates.defaultPricePerStudent;
      if ('sessionType' in updates) dbUpdates.session_type = updates.sessionType;
      if ('sessionDuration' in updates) dbUpdates.session_duration = updates.sessionDuration;
      if ('sessionTime' in updates) dbUpdates.session_time = updates.sessionTime;
      if ('isActive' in updates) dbUpdates.is_active = updates.isActive;
      if ('location' in updates) dbUpdates.location = updates.location ? JSON.parse(JSON.stringify(updates.location)) : null;

      if (Object.keys(dbUpdates).length > 0) {
        const { error } = await supabase
          .from('student_groups')
          .update(dbUpdates)
          .eq('id', groupId);
        if (error) throw error;
      }

      // 2. Update schedule days if provided
      if ('scheduleDays' in updates && updates.scheduleDays) {
        // Delete existing schedule days
        const { error: deleteScheduleError } = await supabase
          .from('group_schedule_days')
          .delete()
          .eq('group_id', groupId);

        if (deleteScheduleError) throw deleteScheduleError;

        // Insert new schedule days
        if (updates.scheduleDays.length > 0) {
          const { error: scheduleError } = await supabase
            .from('group_schedule_days')
            .insert(updates.scheduleDays.map(d => ({
              group_id: groupId,
              day_of_week: d.dayOfWeek,
              time: d.time || updates.sessionTime || '16:00',
            })));
          if (scheduleError) throw scheduleError;
        }
      }

      // 3. Update members if provided
      if ('members' in updates && updates.members) {
        // Get current members from DB
        const { data: currentMembers } = await supabase
          .from('group_members')
          .select('*')
          .eq('group_id', groupId)
          .eq('is_active', true);

        const existingMemberIds = new Set((currentMembers || []).map(m => m.id));
        const newMemberIds = new Set(updates.members.filter(m => m.isActive !== false).map(m => m.studentId));

        // Remove members that are no longer in the list
        for (const existing of (currentMembers || [])) {
          if (!newMemberIds.has(existing.id)) {
            await supabase
              .from('group_members')
              .update({ is_active: false })
              .eq('id', existing.id);
          }
        }

        // Add new members and update existing ones
        for (const member of updates.members) {
          if (member.isActive === false) continue;
          
          if (existingMemberIds.has(member.studentId)) {
            // Update existing member (price changes, etc.)
            await supabase
              .from('group_members')
              .update({
                student_name: member.studentName,
                phone: member.phone,
                parent_phone: member.parentPhone,
                custom_price: member.customPrice ?? null,
              })
              .eq('id', member.studentId);
          } else {
            // Add new member
            const { data: memberData } = await supabase
              .from('group_members')
              .insert({
                group_id: groupId,
                student_id: member.studentId?.startsWith('group_') ? null : (member.linkedStudentId || null),
                student_name: member.studentName,
                phone: member.phone,
                parent_phone: member.parentPhone,
                custom_price: member.customPrice ?? null,
              })
              .select()
              .single();

            // Add attendance records for future sessions
            if (memberData) {
              const today = toLocalDateStr(new Date());
              const { data: futureSessions } = await supabase
                .from('group_sessions')
                .select('id')
                .eq('group_id', groupId)
                .gte('date', today);

              if (futureSessions && futureSessions.length > 0) {
                const attendanceInserts = futureSessions.map(s => ({
                  session_id: s.id,
                  member_id: memberData.id,
                  status: 'scheduled',
                }));
                await supabase.from('group_session_attendance').insert(attendanceInserts);
              }
            }
          }
        }
      }

      await fetchGroups();
      toast({ title: "تم تحديث المجموعة بنجاح" });
    } catch (error) {
      console.error('[Groups] Failed to update group:', error);
      toast({ title: "خطأ", description: "فشل في تحديث المجموعة", variant: "destructive" });
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
      toast({ title: "تم حذف المجموعة" });
      await fetchGroups();
    } catch (error) {
      console.error('[Groups] Failed to delete group:', error);
      toast({ title: "خطأ", description: "فشل في حذف المجموعة", variant: "destructive" });
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
      console.error('[Groups] Failed to permanently delete group:', error);
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
          student_id: member.studentId?.startsWith('group_') ? null : member.studentId,
          student_name: member.studentName,
          phone: member.phone,
          parent_phone: member.parentPhone,
          custom_price: member.customPrice,
        })
        .select()
        .single();

      if (memberError) throw memberError;

      // Add attendance records for future sessions
      const today = toLocalDateStr(new Date());
      const { data: futureSessions } = await supabase
        .from('group_sessions')
        .select('id')
        .eq('group_id', groupId)
        .gte('date', today);

      if (futureSessions && futureSessions.length > 0) {
        const attendanceInserts = futureSessions.map(s => ({
          session_id: s.id,
          member_id: memberData.id,
          status: 'scheduled',
        }));

        await supabase.from('group_session_attendance').insert(attendanceInserts);
      }

      toast({ title: "تم إضافة الطالب للمجموعة" });
      await fetchGroups();
    } catch (error) {
      console.error('[Groups] Failed to add member to group:', error);
      toast({ title: "خطأ", description: "فشل في إضافة الطالب", variant: "destructive" });
    }
  }, [fetchGroups]);

  // Remove member from group (soft delete)
  const removeMemberFromGroup = useCallback(async (groupId: string, memberId: string) => {
    try {
      const { error } = await supabase
        .from('group_members')
        .update({ is_active: false })
        .eq('id', memberId);

      if (error) throw error;
      await fetchGroups();
    } catch (error) {
      console.error('[Groups] Failed to remove member from group:', error);
    }
  }, [fetchGroups]);

  // Update member's custom price
  const updateMemberPrice = useCallback(async (
    groupId: string,
    memberId: string,
    customPrice: number | undefined
  ) => {
    try {
      const { error } = await supabase
        .from('group_members')
        .update({ custom_price: customPrice })
        .eq('id', memberId);

      if (error) throw error;
      await fetchGroups();
    } catch (error) {
      console.error('[Groups] Failed to update member price:', error);
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
    console.log('[Groups] Updating attendance:', { groupId, sessionId, memberId, status });
    try {
      const { error } = await supabase
        .from('group_session_attendance')
        .update({ status, note })
        .eq('session_id', sessionId)
        .eq('member_id', memberId);

      if (error) throw error;

      // Update local state immediately for responsive UI
      setGroups(prev => prev.map(group => {
        if (group.id !== groupId) return group;
        return {
          ...group,
          sessions: group.sessions.map(session => {
            if (session.id !== sessionId) return session;
            return {
              ...session,
              memberAttendance: session.memberAttendance.map(att =>
                att.memberId === memberId ? { ...att, status, note } : att
              ),
            };
          }),
        };
      }));
    } catch (error) {
      console.error('[Groups] Failed to update member attendance:', error);
      toast({ title: "خطأ", description: "فشل في تحديث الحضور", variant: "destructive" });
    }
  }, []);

  // Mark entire group session as completed
  const completeGroupSession = useCallback(async (groupId: string, sessionId: string, topic?: string, notes?: string) => {
    try {
      // Update session status (and topic/notes if provided)
      const updateData: Record<string, unknown> = {
        status: 'completed',
        completed_at: new Date().toISOString(),
      };
      if (topic !== undefined) updateData.topic = topic || null;
      if (notes !== undefined) updateData.notes = notes || null;

      const { error: sessionError } = await supabase
        .from('group_sessions')
        .update(updateData)
        .eq('id', sessionId);

      if (sessionError) throw sessionError;

      // Update all scheduled attendance to completed
      const { error: attendanceError } = await supabase
        .from('group_session_attendance')
        .update({ status: 'completed' })
        .eq('session_id', sessionId)
        .eq('status', 'scheduled');

      if (attendanceError) throw attendanceError;

      toast({ title: "تم إكمال الحصة" });
      await fetchGroups();
    } catch (error) {
      console.error('[Groups] Failed to complete group session:', error);
      toast({ title: "خطأ", description: "فشل في إكمال الحصة", variant: "destructive" });
    }
  }, [fetchGroups]);

  // Cancel a group session
  const cancelGroupSession = useCallback(async (groupId: string, sessionId: string, reason?: string) => {
    try {
      // Update session status to cancelled
      const { error: sessionError } = await supabase
        .from('group_sessions')
        .update({
          status: 'cancelled',
          notes: reason || 'ملغاة',
        })
        .eq('id', sessionId);

      if (sessionError) throw sessionError;

      // Update all attendance records to cancelled
      const { error: attendanceError } = await supabase
        .from('group_session_attendance')
        .update({ status: 'cancelled' })
        .eq('session_id', sessionId);

      if (attendanceError) throw attendanceError;

      toast({ title: "تم إلغاء الحصة" });
      await fetchGroups();
    } catch (error) {
      console.error('[Groups] Failed to cancel group session:', error);
      toast({ title: "خطأ", description: "فشل في إلغاء الحصة", variant: "destructive" });
    }
  }, [fetchGroups]);

  // Update group session details (topic, notes)
  const updateGroupSessionDetails = useCallback(async (
    groupId: string,
    sessionId: string,
    details: { topic?: string; notes?: string }
  ) => {
    try {
      // Optimistic update
      setGroups(prev => prev.map(g => {
        if (g.id !== groupId) return g;
        return {
          ...g,
          sessions: g.sessions.map(s => {
            if (s.id !== sessionId) return s;
            return {
              ...s,
              topic: details.topic !== undefined ? details.topic : s.topic,
              notes: details.notes !== undefined ? details.notes : s.notes,
            };
          }),
        };
      }));

      const updateData: Record<string, unknown> = {};
      if (details.topic !== undefined) updateData.topic = details.topic || null;
      if (details.notes !== undefined) updateData.notes = details.notes || null;

      const { error } = await supabase
        .from('group_sessions')
        .update(updateData)
        .eq('id', sessionId);

      if (error) throw error;
    } catch (error) {
      console.error('[Groups] Failed to update group session details:', error);
      toast({ title: "خطأ", description: "فشل في تحديث ملاحظات الحصة", variant: "destructive" });
      await fetchGroups();
    }
  }, [fetchGroups]);

  // Reschedule a group session to a new date/time
  const rescheduleGroupSession = useCallback(async (groupId: string, sessionId: string, newDate: string, newTime?: string) => {
    try {
      const group = groups.find(g => g.id === groupId);
      if (!group) {
        toast({ title: "خطأ", description: "المجموعة غير موجودة", variant: "destructive" });
        return;
      }

      // Check if session already exists for the new date
      const existingSession = group.sessions.find(s => s.date === newDate && s.id !== sessionId);
      if (existingSession) {
        toast({ title: "تعارض", description: "يوجد حصة بالفعل لهذه المجموعة في هذا التاريخ", variant: "destructive" });
        return;
      }

      // Update session date and optionally time
      const updateData: { date: string; time?: string } = { date: newDate };
      if (newTime) {
        updateData.time = newTime;
      }

      const { error } = await supabase
        .from('group_sessions')
        .update(updateData)
        .eq('id', sessionId);

      if (error) throw error;

      toast({ title: "تم نقل الحصة", description: `تم نقل حصة ${group.name} إلى ${newDate}` });
      await fetchGroups();
    } catch (error) {
      console.error('[Groups] Failed to reschedule group session:', error);
      toast({ title: "خطأ", description: "فشل في نقل الحصة", variant: "destructive" });
    }
  }, [groups, fetchGroups]);

  // Add a new session for today for a group
  const addGroupSessionForToday = useCallback(async (groupId: string, time?: string): Promise<GroupSession | null> => {
    try {
      const group = groups.find(g => g.id === groupId);
      if (!group) {
        toast({ title: "خطأ", description: "المجموعة غير موجودة", variant: "destructive" });
        return null;
      }

      const today = toLocalDateStr(new Date());

      // Check if session already exists for today
      const existingSession = group.sessions.find(s => s.date === today);
      if (existingSession) {
        toast({ title: "تنبيه", description: "يوجد حصة بالفعل لهذه المجموعة اليوم", variant: "destructive" });
        return null;
      }

      // Get today's day of week to find if there's a scheduled time
      const dayOfWeek = new Date().getDay();
      const scheduleDay = group.scheduleDays.find(d => d.dayOfWeek === dayOfWeek);
      const sessionTime = time || scheduleDay?.time || group.sessionTime;

      // Create the new session
      const { data: sessionData, error: sessionError } = await supabase
        .from('group_sessions')
        .insert({
          group_id: groupId,
          date: today,
          time: sessionTime,
          duration: group.sessionDuration,
          status: 'scheduled',
        })
        .select()
        .single();

      if (sessionError) throw sessionError;

      // Get all active members of the group to create attendance records
      const { data: membersData, error: membersError } = await supabase
        .from('group_members')
        .select('id')
        .eq('group_id', groupId)
        .eq('is_active', true);

      if (membersError) throw membersError;

      // Create attendance records for all active members
      if (membersData && membersData.length > 0) {
        const attendanceInserts = membersData.map(member => ({
          session_id: sessionData.id,
          member_id: member.id,
          status: 'scheduled',
        }));

        const { error: attendanceError } = await supabase
          .from('group_session_attendance')
          .insert(attendanceInserts);

        if (attendanceError) throw attendanceError;
      }

      toast({ title: "✅ تمت إضافة الحصة", description: `تمت إضافة حصة اليوم لمجموعة "${group.name}"` });
      await fetchGroups();

      // Return the session ID directly — groups state is stale in this closure
      return sessionData.id;
    } catch (error) {
      console.error('[Groups] Failed to add group session for today:', error);
      toast({ title: "خطأ", description: "فشل في إضافة الحصة", variant: "destructive" });
      return null;
    }
  }, [groups, fetchGroups]);

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

  // Record a payment from a group member
  const recordGroupMemberPayment = useCallback(async (
    groupId: string,
    sessionId: string,
    memberId: string,
    amount: number,
    method: 'cash' | 'bank' | 'wallet',
    linkedStudentId?: string,
    notes?: string
  ) => {
    if (!currentUserId) {
      toast({ title: "خطأ", description: "يجب تسجيل الدخول أولاً", variant: "destructive" });
      return;
    }

    try {
      // Get the session token
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        console.error('[Groups] No access token available');
        return;
      }

      // Use the supabase URL from the client
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseKey) {
        console.error('[Groups] Missing Supabase configuration');
        return;
      }

      const response = await fetch(`${supabaseUrl}/rest/v1/group_member_payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${accessToken}`,
          'Prefer': 'return=representation',
        },
        body: JSON.stringify({
          user_id: currentUserId,
          group_id: groupId,
          session_id: sessionId,
          member_id: memberId,
          linked_student_id: linkedStudentId || null,
          amount,
          method,
          paid_at: new Date().toISOString(),
          notes: notes || null,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Groups] Error recording payment:', response.status, errorText);
        toast({ title: "خطأ", description: "فشل في تسجيل الدفعة في قاعدة البيانات", variant: "destructive" });
        return;
      }

      const result = await response.json();
      console.log('[Groups] Payment recorded successfully:', result);
      toast({ title: "✅ تم حفظ الدفعة", description: "تم تسجيل الدفعة بنجاح" });
    } catch (error) {
      console.error('[Groups] Failed to record payment:', error);
      toast({ title: "خطأ", description: "فشل في تسجيل الدفعة", variant: "destructive" });
    }
  }, [currentUserId]);

  // Get payments for a group (optionally filtered by member)
  const getGroupMemberPayments = useCallback(async (groupId: string, memberId?: string): Promise<GroupMemberPayment[]> => {
    if (!currentUserId) return [];

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        console.error('[Groups] No access token available');
        return [];
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseKey) {
        console.error('[Groups] Missing Supabase configuration');
        return [];
      }

      let url = `${supabaseUrl}/rest/v1/group_member_payments?group_id=eq.${groupId}&user_id=eq.${currentUserId}&order=paid_at.desc`;

      if (memberId) {
        url += `&member_id=eq.${memberId}`;
      }

      const response = await fetch(url, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        console.error('[Groups] Error fetching payments:', response.status);
        return [];
      }

      const data = await response.json();

      return (data || []).map((p: Record<string, unknown>) => ({
        id: p.id as string,
        groupId: p.group_id as string,
        sessionId: p.session_id as string | undefined,
        memberId: p.member_id as string,
        linkedStudentId: p.linked_student_id as string | undefined,
        amount: typeof p.amount === 'number' ? p.amount : parseFloat(String(p.amount)),
        method: p.method as 'cash' | 'bank' | 'wallet',
        paidAt: p.paid_at as string,
        notes: p.notes as string | undefined,
      }));
    } catch (error) {
      console.error('[Groups] Failed to fetch payments:', error);
      return [];
    }
  }, [currentUserId]);

  // Simple date+time update for bulk editing (no existence check, no toast)
  const updateGroupSessionDateTime = useCallback(async (groupId: string, sessionId: string, newDate: string, newTime: string) => {
    try {
      // Optimistic update
      setGroups(prev => prev.map(g => {
        if (g.id !== groupId) return g;
        return {
          ...g,
          sessions: g.sessions.map(s =>
            s.id === sessionId ? { ...s, date: newDate, time: newTime } : s
          ).sort((a, b) => a.date.localeCompare(b.date)),
        };
      }));

      const { error } = await supabase
        .from('group_sessions')
        .update({ date: newDate, time: newTime, updated_at: new Date().toISOString() })
        .eq('id', sessionId);

      if (error) {
        console.error('[Groups] Failed to update group session date/time:', error);
        await fetchGroups();
      }
    } catch (error) {
      console.error('[Groups] Failed to update group session date/time:', error);
      await fetchGroups();
    }
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
    cancelGroupSession,
    rescheduleGroupSession,
    addGroupSessionForToday,
    getGroupById,
    getGroupSessionsForDate,
    calculateGroupEarnings,
    refreshGroups,
    recordGroupMemberPayment,
    getGroupMemberPayments,
    updateGroupSessionDetails,
    updateGroupSessionDateTime,
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

