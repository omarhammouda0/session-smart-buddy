import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { StudentGroup, GroupMember, GroupSession, SessionStatus, ScheduleDay, SessionType } from '@/types/student';

const STORAGE_KEY = 'session-smart-buddy-groups';

// Generate unique ID
const generateId = () => `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

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

// Create initial group sessions
const createGroupSessions = (
  groupId: string,
  members: GroupMember[],
  scheduleDays: ScheduleDay[],
  startDate: string,
  endDate: string,
  sessionTime: string,
  sessionDuration: number
): GroupSession[] => {
  const dates = generateGroupSessionDates(scheduleDays, startDate, endDate);

  return dates.map(date => {
    const scheduleDay = scheduleDays.find(d => {
      const dateObj = new Date(date);
      return d.dayOfWeek === dateObj.getDay();
    });

    return {
      id: generateId(),
      groupId,
      date,
      time: scheduleDay?.time || sessionTime,
      duration: sessionDuration,
      completed: false,
      status: 'scheduled' as SessionStatus,
      history: [{
        status: 'scheduled' as SessionStatus,
        timestamp: new Date().toISOString(),
      }],
      memberAttendance: members.filter(m => m.isActive).map(m => ({
        memberId: m.studentId,
        memberName: m.studentName,
        status: 'scheduled' as SessionStatus,
      })),
    };
  });
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
  ) => StudentGroup;
  updateGroup: (groupId: string, updates: Partial<Omit<StudentGroup, 'id' | 'createdAt' | 'sessions'>>) => void;
  deleteGroup: (groupId: string) => void;
  permanentlyDeleteGroup: (groupId: string) => void;
  addMemberToGroup: (groupId: string, member: Omit<GroupMember, 'joinedAt' | 'isActive'>) => void;
  removeMemberFromGroup: (groupId: string, studentId: string) => void;
  updateMemberPrice: (groupId: string, studentId: string, customPrice: number | undefined) => void;
  updateMemberAttendance: (groupId: string, sessionId: string, memberId: string, status: SessionStatus, note?: string) => void;
  completeGroupSession: (groupId: string, sessionId: string) => void;
  getGroupById: (groupId: string) => StudentGroup | undefined;
  getGroupSessionsForDate: (date: string) => Array<{ group: StudentGroup; session: GroupSession }>;
  calculateGroupEarnings: (groupId: string, month: number, year: number) => number;
}

const GroupsContext = createContext<GroupsContextType | undefined>(undefined);

export const GroupsProvider = ({ children }: { children: ReactNode }) => {
  const [groups, setGroups] = useState<StudentGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load groups from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsedGroups = JSON.parse(stored);
        console.log('Loaded groups from localStorage:', parsedGroups.length);
        setGroups(parsedGroups);
      }
    } catch (error) {
      console.error('Failed to load groups:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save groups to localStorage whenever they change
  useEffect(() => {
    if (!isLoading) {
      console.log('Saving groups to localStorage:', groups.length);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
    }
  }, [groups, isLoading]);

  // Add a new group
  const addGroup = useCallback((
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
  ): StudentGroup => {
    const now = new Date().toISOString();
    const groupId = generateId();

    // Create members with joinedAt and isActive
    const fullMembers: GroupMember[] = members.map(m => ({
      ...m,
      joinedAt: now,
      isActive: true,
    }));

    // Generate sessions
    const sessions = createGroupSessions(
      groupId,
      fullMembers,
      scheduleDays,
      semesterStart,
      semesterEnd,
      sessionTime,
      sessionDuration
    );

    const newGroup: StudentGroup = {
      id: groupId,
      name,
      members: fullMembers,
      defaultPricePerStudent,
      sessionType,
      scheduleDays,
      sessionDuration,
      sessionTime,
      semesterStart,
      semesterEnd,
      sessions,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      description,
      color,
    };

    setGroups(prev => [...prev, newGroup]);
    return newGroup;
  }, []);

  // Update a group
  const updateGroup = useCallback((
    groupId: string,
    updates: Partial<Omit<StudentGroup, 'id' | 'createdAt' | 'sessions'>>
  ) => {
    setGroups(prev => prev.map(group => {
      if (group.id !== groupId) return group;
      return {
        ...group,
        ...updates,
        updatedAt: new Date().toISOString(),
      };
    }));
  }, []);

  // Delete a group (soft delete - mark as inactive)
  const deleteGroup = useCallback((groupId: string) => {
    setGroups(prev => prev.map(group => {
      if (group.id !== groupId) return group;
      return {
        ...group,
        isActive: false,
        updatedAt: new Date().toISOString(),
      };
    }));
  }, []);

  // Permanently delete a group
  const permanentlyDeleteGroup = useCallback((groupId: string) => {
    setGroups(prev => prev.filter(group => group.id !== groupId));
  }, []);

  // Add member to group
  const addMemberToGroup = useCallback((
    groupId: string,
    member: Omit<GroupMember, 'joinedAt' | 'isActive'>
  ) => {
    const now = new Date().toISOString();

    setGroups(prev => prev.map(group => {
      if (group.id !== groupId) return group;

      // Check if member already exists
      if (group.members.some(m => m.studentId === member.studentId)) {
        return group;
      }

      const newMember: GroupMember = {
        ...member,
        joinedAt: now,
        isActive: true,
      };

      // Add member to future sessions
      const updatedSessions = group.sessions.map(session => {
        const sessionDate = new Date(session.date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Only add to future sessions
        if (sessionDate >= today) {
          return {
            ...session,
            memberAttendance: [
              ...session.memberAttendance,
              {
                memberId: member.studentId,
                memberName: member.studentName,
                status: 'scheduled' as SessionStatus,
              },
            ],
          };
        }
        return session;
      });

      return {
        ...group,
        members: [...group.members, newMember],
        sessions: updatedSessions,
        updatedAt: now,
      };
    }));
  }, []);

  // Remove member from group (soft delete)
  const removeMemberFromGroup = useCallback((groupId: string, studentId: string) => {
    setGroups(prev => prev.map(group => {
      if (group.id !== groupId) return group;

      return {
        ...group,
        members: group.members.map(m =>
          m.studentId === studentId ? { ...m, isActive: false } : m
        ),
        updatedAt: new Date().toISOString(),
      };
    }));
  }, []);

  // Update member's custom price
  const updateMemberPrice = useCallback((
    groupId: string,
    studentId: string,
    customPrice: number | undefined
  ) => {
    setGroups(prev => prev.map(group => {
      if (group.id !== groupId) return group;

      return {
        ...group,
        members: group.members.map(m =>
          m.studentId === studentId ? { ...m, customPrice } : m
        ),
        updatedAt: new Date().toISOString(),
      };
    }));
  }, []);

  // Update session attendance for a member
  const updateMemberAttendance = useCallback((
    groupId: string,
    sessionId: string,
    memberId: string,
    status: SessionStatus,
    note?: string
  ) => {
    const now = new Date().toISOString();

    setGroups(prev => prev.map(group => {
      if (group.id !== groupId) return group;

      return {
        ...group,
        sessions: group.sessions.map(session => {
          if (session.id !== sessionId) return session;

          return {
            ...session,
            memberAttendance: session.memberAttendance.map(att =>
              att.memberId === memberId
                ? { ...att, status, note }
                : att
            ),
            history: [
              ...session.history,
              {
                status,
                timestamp: now,
                note: `${memberId}: ${status}`,
              },
            ],
          };
        }),
        updatedAt: now,
      };
    }));
  }, []);

  // Mark entire group session as completed
  const completeGroupSession = useCallback((groupId: string, sessionId: string) => {
    const now = new Date().toISOString();

    setGroups(prev => prev.map(group => {
      if (group.id !== groupId) return group;

      return {
        ...group,
        sessions: group.sessions.map(session => {
          if (session.id !== sessionId) return session;

          return {
            ...session,
            completed: true,
            status: 'completed' as SessionStatus,
            completedAt: now,
            memberAttendance: session.memberAttendance.map(att => ({
              ...att,
              status: att.status === 'scheduled' ? 'completed' as SessionStatus : att.status,
            })),
            history: [
              ...session.history,
              {
                status: 'completed' as SessionStatus,
                timestamp: now,
              },
            ],
          };
        }),
        updatedAt: now,
      };
    }));
  }, []);

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

