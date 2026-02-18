import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  Check,
  X,
  Clock,
  Calendar,
  CheckCircle2,
  XCircle,
  AlertCircle,
  User
} from 'lucide-react';
import { StudentGroup, GroupSession, GroupMemberAttendance, SessionStatus } from '@/types/student';
import { cn } from '@/lib/utils';

interface GroupAttendanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: StudentGroup;
  session: GroupSession;
  onUpdateAttendance: (
    groupId: string,
    sessionId: string,
    memberId: string,
    status: SessionStatus,
    note?: string
  ) => void | Promise<void>;
  onCompleteSession: (groupId: string, sessionId: string, topic?: string, notes?: string) => void | Promise<void>;
}

// Format time in Arabic
const formatTimeAr = (time: string): string => {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'م' : 'ص';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
};

// Get status color and icon
const getStatusInfo = (status: SessionStatus) => {
  switch (status) {
    case 'completed':
      return {
        icon: CheckCircle2,
        color: 'text-emerald-600',
        bg: 'bg-emerald-100 dark:bg-emerald-900/30',
        label: 'حضر'
      };
    case 'cancelled':
      return {
        icon: XCircle,
        color: 'text-red-600',
        bg: 'bg-red-100 dark:bg-red-900/30',
        label: 'غائب'
      };
    case 'vacation':
      return {
        icon: AlertCircle,
        color: 'text-amber-600',
        bg: 'bg-amber-100 dark:bg-amber-900/30',
        label: 'عذر'
      };
    default:
      return {
        icon: Clock,
        color: 'text-gray-500',
        bg: 'bg-gray-100 dark:bg-gray-800',
        label: 'مجدول'
      };
  }
};

export const GroupAttendanceDialog = ({
  open,
  onOpenChange,
  group,
  session,
  onUpdateAttendance,
  onCompleteSession,
}: GroupAttendanceDialogProps) => {
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [sessionTopic, setSessionTopic] = useState(session.topic || '');
  const [sessionNotes, setSessionNotes] = useState(session.notes || '');
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  // Track local attendance state for immediate UI updates
  const [localAttendance, setLocalAttendance] = useState<Record<string, SessionStatus>>(() => {
    const initial: Record<string, SessionStatus> = {};
    session.memberAttendance.forEach(a => {
      initial[a.memberId] = a.status;
    });
    return initial;
  });

  const activeMembers = group.members.filter(m => m.isActive);
  const sessionDate = new Date(session.date);

  // Count attendance stats using local state
  const stats = {
    attended: Object.values(localAttendance).filter(s => s === 'completed').length,
    absent: Object.values(localAttendance).filter(s => s === 'cancelled').length,
    excused: Object.values(localAttendance).filter(s => s === 'vacation').length,
    pending: Object.values(localAttendance).filter(s => s === 'scheduled').length,
  };

  const handleStatusChange = (memberId: string, status: SessionStatus) => {
    // Update local state immediately for responsive UI
    setLocalAttendance(prev => ({ ...prev, [memberId]: status }));

    // Call the update function (synchronous localStorage update)
    onUpdateAttendance(group.id, session.id, memberId, status, notes[memberId]);
  };

  const handleMarkAllAttended = () => {
    if (isMarkingAll) return;
    setIsMarkingAll(true);

    // Update local state immediately
    const newAttendance: Record<string, SessionStatus> = { ...localAttendance };
    Object.keys(newAttendance).forEach(memberId => {
      if (newAttendance[memberId] === 'scheduled') {
        newAttendance[memberId] = 'completed';
      }
    });
    setLocalAttendance(newAttendance);

    // Update each pending member using local state (avoids stale props)
    Object.entries(localAttendance).forEach(([memberId, status]) => {
      if (status === 'scheduled') {
        onUpdateAttendance(group.id, session.id, memberId, 'completed');
      }
    });

    setIsMarkingAll(false);
  };

  const handleCompleteSession = () => {
    onCompleteSession(group.id, session.id, sessionTopic || undefined, sessionNotes || undefined);
    onOpenChange(false);
  };

  const getMemberAttendance = (memberId: string): GroupMemberAttendance | undefined => {
    return session.memberAttendance.find(a => a.memberId === memberId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col" dir="rtl">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl flex items-center gap-2">
            <Users className="h-5 w-5" />
            تسجيل الحضور - {group.name}
          </DialogTitle>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
            <Calendar className="h-4 w-4" />
            <span>
              {sessionDate.toLocaleDateString('ar-EG', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </span>
            <span className="mx-1">•</span>
            <Clock className="h-4 w-4" />
            <span>{formatTimeAr(session.time || group.sessionTime)}</span>
          </div>
        </DialogHeader>

        <DialogBody>
          <div className="space-y-4 pt-2">
            {/* Stats Summary */}
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="gap-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                <CheckCircle2 className="h-3 w-3" />
                حضور: {stats.attended}
              </Badge>
              <Badge variant="outline" className="gap-1 bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                <XCircle className="h-3 w-3" />
                غياب: {stats.absent}
              </Badge>
              <Badge variant="outline" className="gap-1 bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                <AlertCircle className="h-3 w-3" />
                عذر: {stats.excused}
              </Badge>
              {stats.pending > 0 && (
                <Badge variant="outline" className="gap-1">
                  <Clock className="h-3 w-3" />
                  متبقي: {stats.pending}
                </Badge>
              )}
            </div>

            {/* Quick Actions */}
            {stats.pending > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleMarkAllAttended}
                disabled={isMarkingAll}
                className="w-full"
              >
                <Check className="h-4 w-4 ml-1" />
                تسجيل حضور الجميع
              </Button>
            )}

            {/* Members Attendance List */}
            <div className="space-y-2">
              <Label>الطلاب ({activeMembers.length})</Label>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {activeMembers.map(member => {
                  const attendance = getMemberAttendance(member.studentId);
                  const status = localAttendance[member.studentId] || attendance?.status || 'scheduled';
                  const statusInfo = getStatusInfo(status);
                  const StatusIcon = statusInfo.icon;

                  return (
                    <div
                      key={member.studentId}
                      className={cn(
                        "p-3 rounded-lg border transition-all",
                        statusInfo.bg
                      )}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{member.studentName}</p>
                            <div className="flex items-center gap-1">
                              <StatusIcon className={cn("h-3 w-3", statusInfo.color)} />
                              <span className={cn("text-xs", statusInfo.color)}>{statusInfo.label}</span>
                            </div>
                          </div>
                        </div>

                        {/* Attendance Buttons */}
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant={status === 'completed' ? 'default' : 'outline'}
                            size="sm"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleStatusChange(member.studentId, 'completed');
                            }}
                            className={cn(
                              "h-8 w-8 p-0 touch-manipulation",
                              status === 'completed' && "bg-emerald-600 hover:bg-emerald-700"
                            )}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant={status === 'cancelled' ? 'default' : 'outline'}
                            size="sm"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleStatusChange(member.studentId, 'cancelled');
                            }}
                            className={cn(
                              "h-8 w-8 p-0 touch-manipulation",
                              status === 'cancelled' && "bg-red-600 hover:bg-red-700"
                            )}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant={status === 'vacation' ? 'default' : 'outline'}
                            size="sm"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleStatusChange(member.studentId, 'vacation');
                            }}
                            className={cn(
                              "h-8 w-8 p-0 touch-manipulation",
                              status === 'vacation' && "bg-amber-600 hover:bg-amber-700"
                            )}
                          >
                            <AlertCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Note for member */}
                      {(status === 'cancelled' || status === 'vacation') && (
                        <Input
                          value={notes[member.studentId] || attendance?.note || ''}
                          onChange={(e) => setNotes({ ...notes, [member.studentId]: e.target.value })}
                          placeholder="سبب الغياب..."
                          className="mt-2 text-xs h-8"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Session Notes */}
            <div className="space-y-2 pt-2 border-t">
              <Label htmlFor="sessionTopic">موضوع الحصة</Label>
              <Input
                id="sessionTopic"
                value={sessionTopic}
                onChange={(e) => setSessionTopic(e.target.value)}
                placeholder="مثال: مراجعة الباب الأول"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sessionNotes">ملاحظات</Label>
              <Textarea
                id="sessionNotes"
                value={sessionNotes}
                onChange={(e) => setSessionNotes(e.target.value)}
                placeholder="ملاحظات عن الحصة..."
                rows={2}
              />
            </div>
          </div>
        </DialogBody>

        <DialogFooter className="flex-col sm:flex-row-reverse gap-2 pt-2">
          <Button
            onClick={handleCompleteSession}
            className="w-full sm:flex-1 gradient-primary"
            disabled={stats.pending === activeMembers.length}
          >
            <CheckCircle2 className="h-4 w-4 ml-2" />
            إنهاء الحصة
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:flex-1">
            إغلاق
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default GroupAttendanceDialog;

