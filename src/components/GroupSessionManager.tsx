import { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  ArrowRight,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  Loader2,
  MapPin,
  Monitor,
  MoreVertical,
  Palmtree,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  User,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StudentGroup, GroupSession, SessionStatus, GroupMemberAttendance } from '@/types/student';
import { formatDateAr, formatShortDateAr, DAY_NAMES_AR, formatDurationAr } from '@/lib/arabicConstants';
import { SessionNotesDialog } from '@/components/SessionNotesDialog';
import { cn } from '@/lib/utils';

// ============== Types ==============

type TimeFilter = 'all' | 'today' | 'this-week' | 'next-week' | 'last-week' | 'this-month' | 'next-month' | 'last-month' | 'last-2-months' | 'last-3-months' | 'custom';
type SortOrder = 'date-desc' | 'date-asc' | 'time-asc';
type SubTab = 'upcoming' | 'history';

interface GroupSessionManagerProps {
  group: StudentGroup;
  onBack: () => void;
  onEdit: () => void;
  // Session actions
  onCompleteSession: (groupId: string, sessionId: string, topic?: string, notes?: string) => Promise<void>;
  onCancelSession: (groupId: string, sessionId: string, reason?: string) => Promise<void>;
  onRestoreSession: (groupId: string, sessionId: string) => Promise<void>;
  onVacationSession: (groupId: string, sessionId: string) => Promise<void>;
  onDeleteSession: (groupId: string, sessionId: string) => Promise<void>;
  onRescheduleSession: (groupId: string, sessionId: string, newDate: string, newTime?: string) => Promise<void>;
  onAddSession: (groupId: string, date: string, time?: string) => Promise<string | null>;
  onUpdateSessionDetails: (groupId: string, sessionId: string, details: { topic?: string; notes?: string; homework?: string; homeworkStatus?: string }) => Promise<void>;
  onUpdateAttendance: (groupId: string, sessionId: string, memberId: string, status: SessionStatus, note?: string) => void | Promise<void>;
}

// ============== Helpers ==============

const formatTimeAr = (time: string): string => {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'م' : 'ص';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
};

const toLocalDateStr = (d: Date): string => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const getRelativeLabel = (dateStr: string): string | null => {
  const today = toLocalDateStr(new Date());
  const tomorrow = toLocalDateStr(new Date(Date.now() + 86400000));
  const yesterday = toLocalDateStr(new Date(Date.now() - 86400000));
  if (dateStr === today) return 'اليوم';
  if (dateStr === tomorrow) return 'غداً';
  if (dateStr === yesterday) return 'أمس';
  return null;
};

const getStatusBadge = (status: SessionStatus) => {
  switch (status) {
    case 'completed':
      return { label: 'مكتملة', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' };
    case 'cancelled':
      return { label: 'ملغية', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' };
    case 'vacation':
      return { label: 'إجازة', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' };
    default:
      return { label: 'مجدولة', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' };
  }
};

const getTimeBoxColor = (status: SessionStatus, sessionType: string) => {
  if (status === 'completed') return 'bg-emerald-500';
  if (status === 'cancelled') return 'bg-red-400';
  if (status === 'vacation') return 'bg-amber-400';
  return sessionType === 'online' ? 'bg-blue-500' : 'bg-violet-500';
};

const isSessionEnded = (session: GroupSession, duration: number): boolean => {
  if (!session.time) return false;
  const now = new Date();
  const [h, m] = session.time.split(':').map(Number);
  const sessionDate = new Date(session.date);
  sessionDate.setHours(h, m + duration, 0, 0);
  return now >= sessionDate;
};

const getDateRange = (filter: TimeFilter, customStart: string, customEnd: string): { start: string; end: string } | null => {
  const today = new Date();
  const todayStr = toLocalDateStr(today);

  switch (filter) {
    case 'all': return null;
    case 'today': return { start: todayStr, end: todayStr };
    case 'this-week': {
      const start = new Date(today);
      start.setDate(today.getDate() - today.getDay());
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return { start: toLocalDateStr(start), end: toLocalDateStr(end) };
    }
    case 'next-week': {
      const start = new Date(today);
      start.setDate(today.getDate() - today.getDay() + 7);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return { start: toLocalDateStr(start), end: toLocalDateStr(end) };
    }
    case 'last-week': {
      const start = new Date(today);
      start.setDate(today.getDate() - today.getDay() - 7);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return { start: toLocalDateStr(start), end: toLocalDateStr(end) };
    }
    case 'this-month': {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return { start: toLocalDateStr(start), end: toLocalDateStr(end) };
    }
    case 'next-month': {
      const start = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth() + 2, 0);
      return { start: toLocalDateStr(start), end: toLocalDateStr(end) };
    }
    case 'last-month': {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 0);
      return { start: toLocalDateStr(start), end: toLocalDateStr(end) };
    }
    case 'last-2-months': {
      const start = new Date(today.getFullYear(), today.getMonth() - 2, 1);
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return { start: toLocalDateStr(start), end: toLocalDateStr(end) };
    }
    case 'last-3-months': {
      const start = new Date(today.getFullYear(), today.getMonth() - 3, 1);
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return { start: toLocalDateStr(start), end: toLocalDateStr(end) };
    }
    case 'custom': return { start: customStart, end: customEnd };
    default: return null;
  }
};

const TIME_FILTER_LABELS: Record<TimeFilter, string> = {
  'all': 'الكل',
  'today': 'اليوم',
  'this-week': 'هذا الأسبوع',
  'next-week': 'الأسبوع القادم',
  'last-week': 'الأسبوع الماضي',
  'this-month': 'هذا الشهر',
  'next-month': 'الشهر القادم',
  'last-month': 'الشهر الماضي',
  'last-2-months': 'آخر شهرين',
  'last-3-months': 'آخر 3 أشهر',
  'custom': 'فترة مخصصة',
};

// ============== Component ==============

export const GroupSessionManager = ({
  group,
  onBack,
  onEdit,
  onCompleteSession,
  onCancelSession,
  onRestoreSession,
  onVacationSession,
  onDeleteSession,
  onRescheduleSession,
  onAddSession,
  onUpdateSessionDetails,
  onUpdateAttendance,
}: GroupSessionManagerProps) => {
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<SessionStatus | 'all'>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('date-asc');
  const [subTab, setSubTab] = useState<SubTab>('upcoming');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // Dialogs
  const [completeDialog, setCompleteDialog] = useState<{ open: boolean; session: GroupSession | null }>({ open: false, session: null });
  const [cancelDialog, setCancelDialog] = useState<{ open: boolean; session: GroupSession | null }>({ open: false, session: null });
  const [vacationDialog, setVacationDialog] = useState<{ open: boolean; session: GroupSession | null }>({ open: false, session: null });
  const [restoreDialog, setRestoreDialog] = useState<{ open: boolean; session: GroupSession | null }>({ open: false, session: null });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; session: GroupSession | null }>({ open: false, session: null });
  const [rescheduleDialog, setRescheduleDialog] = useState<{ open: boolean; session: GroupSession | null }>({ open: false, session: null });
  const [addSessionDialog, setAddSessionDialog] = useState(false);

  // Form state
  const [completeTopic, setCompleteTopic] = useState('');
  const [completeNotes, setCompleteNotes] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [addSessionDate, setAddSessionDate] = useState('');
  const [addSessionTime, setAddSessionTime] = useState('');

  // Attendance expanded state
  const [expandedAttendance, setExpandedAttendance] = useState<Set<string>>(new Set());

  const todayStr = toLocalDateStr(new Date());
  const activeMembers = group.members.filter(m => m.isActive);

  // ============== Computed data ==============

  const stats = useMemo(() => {
    const scheduled = group.sessions.filter(s => s.status === 'scheduled').length;
    const completed = group.sessions.filter(s => s.status === 'completed').length;
    const cancelled = group.sessions.filter(s => s.status === 'cancelled').length;
    const vacation = group.sessions.filter(s => s.status === 'vacation').length;
    return { scheduled, completed, cancelled, vacation, total: group.sessions.length };
  }, [group.sessions]);

  const filteredSessions = useMemo(() => {
    let sessions = [...group.sessions];

    // Split by sub-tab
    if (subTab === 'upcoming') {
      sessions = sessions.filter(s => s.status === 'scheduled' && s.date >= todayStr);
    } else {
      sessions = sessions.filter(s => s.status !== 'scheduled' || s.date < todayStr);
    }

    // Status filter
    if (statusFilter !== 'all') {
      sessions = sessions.filter(s => s.status === statusFilter);
    }

    // Time filter
    const range = getDateRange(timeFilter, customStart, customEnd);
    if (range) {
      sessions = sessions.filter(s => s.date >= range.start && s.date <= range.end);
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      sessions = sessions.filter(s =>
        s.date.includes(q) ||
        (s.topic && s.topic.toLowerCase().includes(q)) ||
        (s.notes && s.notes.toLowerCase().includes(q)) ||
        formatDateAr(s.date).toLowerCase().includes(q)
      );
    }

    // Sort
    sessions.sort((a, b) => {
      if (sortOrder === 'date-asc') return a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || '');
      if (sortOrder === 'date-desc') return b.date.localeCompare(a.date) || (b.time || '').localeCompare(a.time || '');
      if (sortOrder === 'time-asc') return (a.time || '').localeCompare(b.time || '') || a.date.localeCompare(b.date);
      return 0;
    });

    return sessions;
  }, [group.sessions, subTab, statusFilter, timeFilter, customStart, customEnd, searchQuery, sortOrder, todayStr]);

  const hasActiveFilters = timeFilter !== 'all' || statusFilter !== 'all' || searchQuery.trim();

  const clearFilters = () => {
    setTimeFilter('all');
    setStatusFilter('all');
    setSearchQuery('');
  };

  // ============== Handlers ==============

  const handleComplete = useCallback(async () => {
    if (!completeDialog.session) return;
    await onCompleteSession(group.id, completeDialog.session.id, completeTopic.trim() || undefined, completeNotes.trim() || undefined);
    setCompleteDialog({ open: false, session: null });
    setCompleteTopic('');
    setCompleteNotes('');
  }, [completeDialog.session, group.id, completeTopic, completeNotes, onCompleteSession]);

  const handleCancel = useCallback(async () => {
    if (!cancelDialog.session) return;
    await onCancelSession(group.id, cancelDialog.session.id, cancelReason.trim() || undefined);
    setCancelDialog({ open: false, session: null });
    setCancelReason('');
  }, [cancelDialog.session, group.id, cancelReason, onCancelSession]);

  const handleVacation = useCallback(async () => {
    if (!vacationDialog.session) return;
    await onVacationSession(group.id, vacationDialog.session.id);
    setVacationDialog({ open: false, session: null });
  }, [vacationDialog.session, group.id, onVacationSession]);

  const handleRestore = useCallback(async () => {
    if (!restoreDialog.session) return;
    await onRestoreSession(group.id, restoreDialog.session.id);
    setRestoreDialog({ open: false, session: null });
  }, [restoreDialog.session, group.id, onRestoreSession]);

  const handleDelete = useCallback(async () => {
    if (!deleteDialog.session) return;
    await onDeleteSession(group.id, deleteDialog.session.id);
    setDeleteDialog({ open: false, session: null });
  }, [deleteDialog.session, group.id, onDeleteSession]);

  const handleReschedule = useCallback(async () => {
    if (!rescheduleDialog.session || !rescheduleDate) return;
    await onRescheduleSession(group.id, rescheduleDialog.session.id, rescheduleDate, rescheduleTime || undefined);
    setRescheduleDialog({ open: false, session: null });
    setRescheduleDate('');
    setRescheduleTime('');
  }, [rescheduleDialog.session, group.id, rescheduleDate, rescheduleTime, onRescheduleSession]);

  const handleAddSession = useCallback(async () => {
    if (!addSessionDate) return;
    await onAddSession(group.id, addSessionDate, addSessionTime || undefined);
    setAddSessionDialog(false);
    setAddSessionDate('');
    setAddSessionTime('');
  }, [group.id, addSessionDate, addSessionTime, onAddSession]);

  const toggleAttendance = (sessionId: string) => {
    setExpandedAttendance(prev => {
      const next = new Set(prev);
      if (next.has(sessionId)) next.delete(sessionId);
      else next.add(sessionId);
      return next;
    });
  };

  const cycleAttendanceStatus = (current: SessionStatus): SessionStatus => {
    if (current === 'scheduled' || current === 'completed') return 'cancelled';
    if (current === 'cancelled') return 'vacation';
    return 'completed';
  };

  const getAttendanceIcon = (status: SessionStatus) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
      case 'cancelled': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'vacation': return <Palmtree className="h-4 w-4 text-amber-500" />;
      default: return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getAttendanceLabel = (status: SessionStatus) => {
    switch (status) {
      case 'completed': return 'حضر';
      case 'cancelled': return 'غائب';
      case 'vacation': return 'عذر';
      default: return 'مجدول';
    }
  };

  // ============== Render Session Card ==============

  const renderSessionCard = (session: GroupSession, isUpcoming: boolean) => {
    const time = session.time || group.sessionTime || '16:00';
    const duration = session.duration || group.sessionDuration || 60;
    const statusBadge = getStatusBadge(session.status);
    const relativeLabel = getRelativeLabel(session.date);
    const timeBoxColor = getTimeBoxColor(session.status, group.sessionType);
    const canComplete = isUpcoming && session.status === 'scheduled' && isSessionEnded(session, duration);
    const isExpanded = expandedAttendance.has(session.id);

    // Attendance summary
    const attended = session.memberAttendance.filter(a => a.status === 'completed').length;
    const total = session.memberAttendance.length;

    return (
      <div
        key={session.id}
        className={cn(
          "p-3 sm:p-4 border rounded-xl transition-all",
          session.status === 'completed' && "border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/30 dark:bg-emerald-950/10",
          session.status === 'cancelled' && "border-red-200 dark:border-red-800/50 bg-red-50/30 dark:bg-red-950/10",
          session.status === 'vacation' && "border-amber-200 dark:border-amber-800/50 bg-amber-50/30 dark:bg-amber-950/10",
          session.status === 'scheduled' && "border-border hover:border-violet-300 dark:hover:border-violet-700",
        )}
      >
        {/* Row 1: Time box + Info + Actions */}
        <div className="flex items-start gap-3">
          {/* Time box */}
          <div className={cn(
            "flex flex-col items-center justify-center rounded-lg px-2.5 py-2 text-white shrink-0 min-w-[56px]",
            timeBoxColor
          )}>
            <span className="text-sm font-bold leading-none">{formatTimeAr(time)}</span>
            <span className="text-[10px] mt-0.5 opacity-80">{formatDurationAr(duration)}</span>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium">{formatDateAr(session.date)}</span>
              {relativeLabel && (
                <Badge variant="outline" className="text-[10px] h-5">{relativeLabel}</Badge>
              )}
              <Badge className={cn("text-[10px] h-5 border-0", statusBadge.className)}>
                {statusBadge.label}
              </Badge>
            </div>

            {/* Topic & notes preview */}
            {(session.topic || session.notes) && (
              <div className="mt-1">
                {session.topic && <p className="text-xs text-muted-foreground truncate">📚 {session.topic}</p>}
                {session.notes && <p className="text-xs text-muted-foreground truncate">📝 {session.notes}</p>}
              </div>
            )}

            {/* Attendance summary badge */}
            {session.memberAttendance.length > 0 && session.status !== 'scheduled' && (
              <div className="mt-1">
                <Badge variant="outline" className="text-[10px] h-5 gap-1">
                  <Users className="h-3 w-3" />
                  {attended}/{total} حضور
                </Badge>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Notes button */}
            <SessionNotesDialog
              session={session}
              studentName={group.name}
              onSave={(details) => onUpdateSessionDetails(group.id, session.id, details)}
              trigger={
                <Button variant={session.topic || session.notes ? "secondary" : "ghost"} size="icon" className="h-7 w-7">
                  <FileText className="h-3.5 w-3.5" />
                </Button>
              }
            />

            {/* Action menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MoreVertical className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {isUpcoming && session.status === 'scheduled' && (
                  <>
                    <DropdownMenuItem
                      disabled={!canComplete}
                      onClick={() => {
                        setCompleteTopic(session.topic || '');
                        setCompleteNotes(session.notes || '');
                        setCompleteDialog({ open: true, session });
                      }}
                    >
                      <CheckCircle2 className="h-4 w-4 ml-2 text-emerald-600" />
                      إكمال الحصة
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setVacationDialog({ open: true, session })}>
                      <Palmtree className="h-4 w-4 ml-2 text-amber-500" />
                      تسجيل إجازة
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setCancelDialog({ open: true, session })}>
                      <XCircle className="h-4 w-4 ml-2 text-red-500" />
                      إلغاء الحصة
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => {
                      setRescheduleDate(session.date);
                      setRescheduleTime(session.time || '');
                      setRescheduleDialog({ open: true, session });
                    }}>
                      <Calendar className="h-4 w-4 ml-2 text-blue-500" />
                      نقل الحصة
                    </DropdownMenuItem>
                  </>
                )}
                {!isUpcoming && (session.status === 'completed' || session.status === 'cancelled' || session.status === 'vacation') && (
                  <DropdownMenuItem onClick={() => setRestoreDialog({ open: true, session })}>
                    <RefreshCw className="h-4 w-4 ml-2 text-blue-500" />
                    استعادة الحصة
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  className="text-red-600 focus:text-red-600"
                  onClick={() => setDeleteDialog({ open: true, session })}
                >
                  <Trash2 className="h-4 w-4 ml-2" />
                  حذف نهائي
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Attendance toggle */}
        <button
          type="button"
          className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
          onClick={() => toggleAttendance(session.id)}
        >
          <Users className="h-3.5 w-3.5" />
          <span>الحضور ({session.memberAttendance.length})</span>
          {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>

        {/* Expanded attendance */}
        {isExpanded && (
          <div className="mt-2 space-y-1 border-t pt-2">
            {session.memberAttendance.map((att) => (
              <div key={att.memberId} className="flex items-center justify-between py-1 px-1">
                <div className="flex items-center gap-2 min-w-0">
                  <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-sm truncate">{att.memberName}</span>
                </div>
                <button
                  type="button"
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all",
                    att.status === 'completed' && "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
                    att.status === 'cancelled' && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
                    att.status === 'vacation' && "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
                    att.status === 'scheduled' && "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
                  )}
                  onClick={() => {
                    const nextStatus = cycleAttendanceStatus(att.status);
                    onUpdateAttendance(group.id, session.id, att.memberId, nextStatus);
                  }}
                >
                  {getAttendanceIcon(att.status)}
                  <span>{getAttendanceLabel(att.status)}</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ============== Main Render ==============

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="border overflow-hidden">
        <div className="p-4 bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 border-b">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={onBack}
                title="العودة للمجموعات"
              >
                <ArrowRight className="h-5 w-5" />
              </Button>
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
                `bg-${group.color || 'violet'}-500`
              )}
              style={{ backgroundColor: group.color ? undefined : '#8b5cf6' }}
              >
                <Users className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0">
                <h2 className="font-bold text-base truncate">{group.name}</h2>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{activeMembers.length} طالب</span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    {group.sessionType === 'online' ? <Monitor className="h-3 w-3" /> : <MapPin className="h-3 w-3" />}
                    {group.sessionType === 'online' ? 'أونلاين' : 'حضوري'}
                  </span>
                  <span>•</span>
                  <span>{group.sessionDuration} دقيقة</span>
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-violet-600"
              onClick={onEdit}
              title="تعديل المجموعة"
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <CardContent className="p-4 space-y-4">
          {/* Stats cards */}
          <div className="grid grid-cols-4 gap-2">
            <div
              className={cn(
                "text-center p-2 rounded-lg border cursor-pointer transition-all",
                statusFilter === 'all' && subTab === 'upcoming' ? "border-blue-400 bg-blue-50 dark:bg-blue-950/30" : "hover:bg-muted/50"
              )}
              onClick={() => { setStatusFilter('all'); setSubTab('upcoming'); }}
            >
              <p className="text-lg font-bold text-blue-600">{stats.scheduled}</p>
              <p className="text-[10px] text-muted-foreground">قادمة</p>
            </div>
            <div
              className={cn(
                "text-center p-2 rounded-lg border cursor-pointer transition-all",
                statusFilter === 'completed' ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30" : "hover:bg-muted/50"
              )}
              onClick={() => { setStatusFilter('completed'); setSubTab('history'); }}
            >
              <p className="text-lg font-bold text-emerald-600">{stats.completed}</p>
              <p className="text-[10px] text-muted-foreground">مكتملة</p>
            </div>
            <div
              className={cn(
                "text-center p-2 rounded-lg border cursor-pointer transition-all",
                statusFilter === 'cancelled' ? "border-red-400 bg-red-50 dark:bg-red-950/30" : "hover:bg-muted/50"
              )}
              onClick={() => { setStatusFilter('cancelled'); setSubTab('history'); }}
            >
              <p className="text-lg font-bold text-red-600">{stats.cancelled}</p>
              <p className="text-[10px] text-muted-foreground">ملغية</p>
            </div>
            <div
              className={cn(
                "text-center p-2 rounded-lg border cursor-pointer transition-all",
                statusFilter === 'vacation' ? "border-amber-400 bg-amber-50 dark:bg-amber-950/30" : "hover:bg-muted/50"
              )}
              onClick={() => { setStatusFilter('vacation'); setSubTab('history'); }}
            >
              <p className="text-lg font-bold text-amber-600">{stats.vacation}</p>
              <p className="text-[10px] text-muted-foreground">إجازة</p>
            </div>
          </div>

          {/* Filter bar */}
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[150px]">
              <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="بحث..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pr-8 text-sm"
              />
            </div>

            <Select value={timeFilter} onValueChange={(v) => setTimeFilter(v as TimeFilter)}>
              <SelectTrigger className="h-8 w-auto min-w-[120px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TIME_FILTER_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value} className="text-xs">{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as SortOrder)}>
              <SelectTrigger className="h-8 w-auto min-w-[100px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date-asc" className="text-xs">الأقدم أولاً</SelectItem>
                <SelectItem value="date-desc" className="text-xs">الأحدث أولاً</SelectItem>
                <SelectItem value="time-asc" className="text-xs">حسب الوقت</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Custom date range */}
          {timeFilter === 'custom' && (
            <div className="flex gap-2">
              <Input type="date" className="h-8 text-xs flex-1" value={customStart} onChange={e => setCustomStart(e.target.value)} />
              <Input type="date" className="h-8 text-xs flex-1" value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
            </div>
          )}

          {/* Active filter badges */}
          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-1.5">
              {statusFilter !== 'all' && (
                <Badge variant="secondary" className="text-[10px] h-5 gap-1 cursor-pointer" onClick={() => setStatusFilter('all')}>
                  {getStatusBadge(statusFilter).label}
                  <X className="h-2.5 w-2.5" />
                </Badge>
              )}
              {timeFilter !== 'all' && (
                <Badge variant="secondary" className="text-[10px] h-5 gap-1 cursor-pointer" onClick={() => setTimeFilter('all')}>
                  {TIME_FILTER_LABELS[timeFilter]}
                  <X className="h-2.5 w-2.5" />
                </Badge>
              )}
              {searchQuery.trim() && (
                <Badge variant="secondary" className="text-[10px] h-5 gap-1 cursor-pointer" onClick={() => setSearchQuery('')}>
                  "{searchQuery}"
                  <X className="h-2.5 w-2.5" />
                </Badge>
              )}
              <button className="text-[10px] text-muted-foreground hover:text-foreground underline" onClick={clearFilters}>
                مسح الكل
              </button>
            </div>
          )}

          {/* Sub-tabs */}
          <Tabs value={subTab} onValueChange={(v) => { setSubTab(v as SubTab); setStatusFilter('all'); }}>
            <TabsList className="w-full h-9">
              <TabsTrigger value="upcoming" className="flex-1 text-xs gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                القادمة ({group.sessions.filter(s => s.status === 'scheduled' && s.date >= todayStr).length})
              </TabsTrigger>
              <TabsTrigger value="history" className="flex-1 text-xs gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                السجل ({group.sessions.filter(s => s.status !== 'scheduled' || s.date < todayStr).length})
              </TabsTrigger>
            </TabsList>

            {/* Upcoming sessions */}
            <TabsContent value="upcoming" className="mt-3 space-y-2">
              {/* Add session button */}
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2 border-dashed text-violet-600 hover:text-violet-700 hover:bg-violet-50 dark:hover:bg-violet-950/20"
                onClick={() => setAddSessionDialog(true)}
              >
                <Plus className="h-4 w-4" />
                إضافة حصة
              </Button>

              {filteredSessions.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  <Calendar className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p>لا توجد حصص قادمة</p>
                  {hasActiveFilters && <p className="text-xs mt-1">جرب تغيير الفلاتر</p>}
                </div>
              ) : (
                filteredSessions.map(s => renderSessionCard(s, true))
              )}
            </TabsContent>

            {/* History sessions */}
            <TabsContent value="history" className="mt-3 space-y-2">
              {/* Completion stats */}
              {stats.completed > 0 && statusFilter === 'all' && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-200/50 dark:border-emerald-800/30">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span className="text-xs text-emerald-700 dark:text-emerald-300">
                    نسبة الإكمال: {stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}% ({stats.completed} من {stats.total})
                  </span>
                </div>
              )}

              {filteredSessions.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  <Clock className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p>لا يوجد سجل</p>
                  {hasActiveFilters && <p className="text-xs mt-1">جرب تغيير الفلاتر</p>}
                </div>
              ) : (
                filteredSessions.map(s => renderSessionCard(s, false))
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* ============== Dialogs ============== */}

      {/* Complete Session Dialog */}
      <AlertDialog open={completeDialog.open} onOpenChange={(open) => !open && setCompleteDialog({ open: false, session: null })}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              إكمال الحصة
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-right">
                <p>هل تريد تسجيل هذه الحصة كمكتملة؟</p>
                {completeDialog.session && (
                  <p className="text-sm text-muted-foreground">{formatDateAr(completeDialog.session.date)} - {formatTimeAr(completeDialog.session.time || group.sessionTime)}</p>
                )}
                <div className="space-y-2">
                  <Label className="text-xs">الموضوع</Label>
                  <Input
                    value={completeTopic}
                    onChange={e => setCompleteTopic(e.target.value)}
                    placeholder="موضوع الحصة..."
                    className="text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">ملاحظات</Label>
                  <Textarea
                    value={completeNotes}
                    onChange={e => setCompleteNotes(e.target.value)}
                    placeholder="ملاحظات عن الحصة..."
                    className="text-sm min-h-[60px]"
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleComplete} className="bg-emerald-600 hover:bg-emerald-700">
              <Check className="h-4 w-4 ml-1" />
              إكمال
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Session Dialog */}
      <AlertDialog open={cancelDialog.open} onOpenChange={(open) => !open && setCancelDialog({ open: false, session: null })}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              إلغاء الحصة
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-right">
                <p>هل تريد إلغاء هذه الحصة؟</p>
                {cancelDialog.session && (
                  <p className="text-sm text-muted-foreground">{formatDateAr(cancelDialog.session.date)} - {formatTimeAr(cancelDialog.session.time || group.sessionTime)}</p>
                )}
                <div className="space-y-2">
                  <Label className="text-xs">سبب الإلغاء (اختياري)</Label>
                  <Input
                    value={cancelReason}
                    onChange={e => setCancelReason(e.target.value)}
                    placeholder="سبب الإلغاء..."
                    className="text-sm"
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>تراجع</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel} className="bg-red-600 hover:bg-red-700">
              <XCircle className="h-4 w-4 ml-1" />
              إلغاء الحصة
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Vacation Dialog */}
      <AlertDialog open={vacationDialog.open} onOpenChange={(open) => !open && setVacationDialog({ open: false, session: null })}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Palmtree className="h-5 w-5 text-amber-500" />
              تسجيل إجازة
            </AlertDialogTitle>
            <AlertDialogDescription className="text-right">
              هل تريد تسجيل هذه الحصة كإجازة؟ سيتم تسجيل جميع الأعضاء كمتغيبين بعذر.
              {vacationDialog.session && (
                <p className="mt-2 text-sm">{formatDateAr(vacationDialog.session.date)} - {formatTimeAr(vacationDialog.session.time || group.sessionTime)}</p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>تراجع</AlertDialogCancel>
            <AlertDialogAction onClick={handleVacation} className="bg-amber-500 hover:bg-amber-600">
              <Palmtree className="h-4 w-4 ml-1" />
              تسجيل إجازة
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Restore Dialog */}
      <AlertDialog open={restoreDialog.open} onOpenChange={(open) => !open && setRestoreDialog({ open: false, session: null })}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-blue-500" />
              استعادة الحصة
            </AlertDialogTitle>
            <AlertDialogDescription className="text-right">
              هل تريد استعادة هذه الحصة إلى الحالة المجدولة؟ سيتم إعادة حالة جميع الأعضاء أيضاً.
              {restoreDialog.session && (
                <p className="mt-2 text-sm">{formatDateAr(restoreDialog.session.date)} - {formatTimeAr(restoreDialog.session.time || group.sessionTime)}</p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>تراجع</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestore} className="bg-blue-600 hover:bg-blue-700">
              <RefreshCw className="h-4 w-4 ml-1" />
              استعادة
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => !open && setDeleteDialog({ open: false, session: null })}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-500" />
              حذف الحصة نهائياً
            </AlertDialogTitle>
            <AlertDialogDescription className="text-right">
              هل أنت متأكد من حذف هذه الحصة نهائياً؟ لا يمكن التراجع عن هذا الإجراء.
              {deleteDialog.session && (
                <p className="mt-2 text-sm">{formatDateAr(deleteDialog.session.date)} - {formatTimeAr(deleteDialog.session.time || group.sessionTime)}</p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>تراجع</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              <Trash2 className="h-4 w-4 ml-1" />
              حذف نهائي
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reschedule Dialog */}
      <AlertDialog open={rescheduleDialog.open} onOpenChange={(open) => !open && setRescheduleDialog({ open: false, session: null })}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-500" />
              نقل الحصة
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-right">
                <p>اختر التاريخ والوقت الجديد للحصة</p>
                <div className="space-y-2">
                  <Label className="text-xs">التاريخ الجديد</Label>
                  <Input
                    type="date"
                    value={rescheduleDate}
                    onChange={e => setRescheduleDate(e.target.value)}
                    className="text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">الوقت الجديد (اختياري)</Label>
                  <Input
                    type="time"
                    value={rescheduleTime}
                    onChange={e => setRescheduleTime(e.target.value)}
                    className="text-sm"
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>تراجع</AlertDialogCancel>
            <AlertDialogAction onClick={handleReschedule} disabled={!rescheduleDate} className="bg-blue-600 hover:bg-blue-700">
              <Calendar className="h-4 w-4 ml-1" />
              نقل
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Session Dialog */}
      <AlertDialog open={addSessionDialog} onOpenChange={setAddSessionDialog}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-violet-600" />
              إضافة حصة جديدة
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-right">
                <p>حدد تاريخ ووقت الحصة الجديدة</p>
                <div className="space-y-2">
                  <Label className="text-xs">التاريخ</Label>
                  <Input
                    type="date"
                    value={addSessionDate}
                    onChange={e => setAddSessionDate(e.target.value)}
                    className="text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">الوقت (يستخدم الوقت الافتراضي إذا لم يحدد)</Label>
                  <Input
                    type="time"
                    value={addSessionTime}
                    onChange={e => setAddSessionTime(e.target.value)}
                    className="text-sm"
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleAddSession} disabled={!addSessionDate} className="bg-violet-600 hover:bg-violet-700">
              <Plus className="h-4 w-4 ml-1" />
              إضافة
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
