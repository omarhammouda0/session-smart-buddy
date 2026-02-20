import { useState, useMemo, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Users, Clock, Monitor, MapPin, DollarSign, X, ChevronDown, ChevronUp, Lightbulb, Sparkles, AlertTriangle, Check, Calendar, UserCheck, XCircle, Loader2 } from 'lucide-react';
import { SessionType, Student, ScheduleDay, GroupMember, StudentGroup, Location } from '@/types/student';
import { DAY_NAMES_AR } from '@/lib/arabicConstants';
import { DurationPicker } from '@/components/DurationPicker';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSchedulingSuggestions } from '@/hooks/useSchedulingSuggestions';
import { useConflictDetection, formatTimeAr as formatTimeArConflict, ConflictResult } from '@/hooks/useConflictDetection';
import { generateSessionsForSchedule } from '@/lib/dateUtils';
import { LocationPicker, LocationData } from '@/components/LocationPicker';
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
import { cn } from '@/lib/utils';

// Type for day schedule with time
interface DayScheduleInput {
  dayOfWeek: number;
  time: string;
}

// Member input before adding
interface MemberInput {
  id: string;
  name: string;
  phone?: string;
  parentPhone?: string;
  customPrice?: number;
  useCustomPrice: boolean;
}

interface AddGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddGroup: (
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
    location?: LocationData | null
  ) => void | Promise<StudentGroup | null>;
  students?: Student[];
  groups?: StudentGroup[];
  settings?: {
    defaultPriceOnline?: number;
    defaultPriceOnsite?: number;
    semesterStart?: string;
    semesterEnd?: string;
  };
  // Edit mode props
  editMode?: boolean;
  groupToEdit?: StudentGroup | null;
  onUpdateGroup?: (groupId: string, updates: Partial<StudentGroup>) => void | Promise<void>;
}

// Format time in Arabic
const formatTimeAr = (time: string): string => {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'م' : 'ص';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
};

// Color options for groups
const GROUP_COLORS = [
  { value: 'blue', label: 'أزرق', class: 'bg-blue-500' },
  { value: 'green', label: 'أخضر', class: 'bg-green-500' },
  { value: 'purple', label: 'بنفسجي', class: 'bg-purple-500' },
  { value: 'orange', label: 'برتقالي', class: 'bg-orange-500' },
  { value: 'pink', label: 'وردي', class: 'bg-pink-500' },
  { value: 'teal', label: 'فيروزي', class: 'bg-teal-500' },
];

export const AddGroupDialog = ({
  open,
  onOpenChange,
  onAddGroup,
  students: existingStudents = [],
  groups: existingGroups = [],
  settings = {},
  editMode = false,
  groupToEdit = null,
  onUpdateGroup,
}: AddGroupDialogProps) => {
  const defaultStart = settings.semesterStart || new Date().toISOString().split('T')[0];
  const defaultEnd = settings.semesterEnd || new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const defaultPriceOnsite = settings.defaultPriceOnsite || 150;
  const defaultPriceOnline = settings.defaultPriceOnline || 120;

  // Group info
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedColor, setSelectedColor] = useState('blue');

  // Session settings
  const [sessionType, setSessionType] = useState<SessionType | null>(null);
  const [sessionDuration, setSessionDuration] = useState<number>(60);
  const [defaultPrice, setDefaultPrice] = useState<number>(80);
  const [location, setLocation] = useState<LocationData | null>(null);

  // Schedule
  const [daySchedules, setDaySchedules] = useState<DayScheduleInput[]>([]);
  const [showCustomDates, setShowCustomDates] = useState(false);
  const [customStart, setCustomStart] = useState(defaultStart);
  const [customEnd, setCustomEnd] = useState(defaultEnd);

  // Members
  const [members, setMembers] = useState<MemberInput[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [selectOpen, setSelectOpen] = useState(false);

  // Conflict detection state
  const [isChecking, setIsChecking] = useState(false);
  const [conflictResults, setConflictResults] = useState<Map<string, ConflictResult>>(new Map());
  const [showWarningDialog, setShowWarningDialog] = useState(false);

  const { checkConflict } = useConflictDetection(existingStudents, existingGroups);
  const checkConflictRef = useRef(checkConflict);
  checkConflictRef.current = checkConflict;

  // Initialize form when editing
  useEffect(() => {
    if (editMode && groupToEdit && open) {
      setGroupName(groupToEdit.name);
      setDescription(groupToEdit.description || '');
      setSelectedColor(groupToEdit.color || 'blue');
      setSessionType(groupToEdit.sessionType);
      setSessionDuration(groupToEdit.sessionDuration);
      setDefaultPrice(groupToEdit.defaultPricePerStudent);
      setDaySchedules(groupToEdit.scheduleDays.map(d => ({
        dayOfWeek: d.dayOfWeek,
        time: d.time || groupToEdit.sessionTime,
      })));
      setCustomStart(groupToEdit.semesterStart);
      setCustomEnd(groupToEdit.semesterEnd);
      setMembers(groupToEdit.members.filter(m => m.isActive).map(m => ({
        id: m.studentId,
        name: m.studentName,
        phone: m.phone,
        parentPhone: m.parentPhone,
        customPrice: m.customPrice,
        useCustomPrice: !!m.customPrice,
      })));
      // Initialize location if group has one
      if (groupToEdit.location) {
        setLocation(groupToEdit.location as LocationData);
      } else {
        setLocation(null);
      }
    }
  }, [editMode, groupToEdit, open]);


  // Get scheduling suggestions (with location for proximity suggestions)
  const schedulingSuggestions = useSchedulingSuggestions(
    existingStudents,
    sessionType,
    sessionType === 'onsite' ? location : null
  );

  // Check conflicts when schedule changes (debounced)
  useEffect(() => {
    if (!open || daySchedules.length === 0) {
      setConflictResults(new Map());
      setIsChecking(false);
      return;
    }

    setIsChecking(true);
    const timer = setTimeout(() => {
      try {
        const semesterStart = showCustomDates ? customStart : defaultStart;
        const semesterEnd = showCustomDates ? customEnd : defaultEnd;

        const results = new Map<string, ConflictResult>();
        const maxDatesToCheck = 8; // Check first 8 weeks for performance

        daySchedules.forEach(schedule => {
          if (!schedule.time) return;

          const sessionDates = generateSessionsForSchedule([schedule.dayOfWeek], semesterStart, semesterEnd);
          const datesToCheck = sessionDates.slice(0, maxDatesToCheck);

          datesToCheck.forEach(date => {
            const result = checkConflictRef.current({ date, startTime: schedule.time, duration: sessionDuration });
            if (result.severity !== 'none') {
              results.set(`${date}-${schedule.dayOfWeek}`, result);
            }
          });
        });

        setConflictResults(results);
      } finally {
        setIsChecking(false);
      }
    }, 500);

    return () => {
      clearTimeout(timer);
      setIsChecking(false);
    };
  }, [open, daySchedules, sessionDuration, showCustomDates, customStart, customEnd, defaultStart, defaultEnd]);

  // Summarize conflicts
  const conflictSummary = useMemo(() => {
    let errorCount = 0;
    let warningCount = 0;
    const errorDates: string[] = [];
    const warningDates: string[] = [];
    const conflictingNames = new Set<string>();

    conflictResults.forEach((result, key) => {
      if (result.severity === 'error') {
        errorCount++;
        errorDates.push(key);
        result.conflicts.forEach(c => conflictingNames.add(c.student.name));
      } else if (result.severity === 'warning') {
        warningCount++;
        warningDates.push(key);
        result.conflicts.forEach(c => conflictingNames.add(c.student.name));
      }
    });

    return {
      errorCount,
      warningCount,
      errorDates,
      warningDates,
      conflictingNames: Array.from(conflictingNames),
      hasErrors: errorCount > 0,
      hasWarnings: warningCount > 0,
    };
  }, [conflictResults]);

  // Get students not already in the group
  const availableStudents = useMemo(() => {
    const memberIds = new Set(members.map(m => m.id));
    return existingStudents.filter(s => !memberIds.has(s.id));
  }, [existingStudents, members]);

  const resetForm = () => {
    setSelectOpen(false); // Close select dropdown first
    setGroupName('');
    setDescription('');
    setSelectedColor('blue');
    setSessionType(null);
    setSessionDuration(60);
    setDefaultPrice(80);
    setDaySchedules([]);
    setShowCustomDates(false);
    setCustomStart(defaultStart);
    setCustomEnd(defaultEnd);
    setMembers([]);
    setSelectedStudentId('');
    setLocation(null);
    setConflictResults(new Map());
    setIsChecking(false);
    setShowWarningDialog(false);
  };

  const toggleDaySchedule = (day: number) => {
    setDaySchedules(prev => {
      const exists = prev.find(d => d.dayOfWeek === day);
      if (exists) {
        return prev.filter(d => d.dayOfWeek !== day);
      } else {
        return [...prev, { dayOfWeek: day, time: '' }].sort((a, b) => a.dayOfWeek - b.dayOfWeek);
      }
    });
  };

  const updateDayTime = (day: number, time: string) => {
    setDaySchedules(prev =>
      prev.map(d => d.dayOfWeek === day ? { ...d, time } : d)
    );
  };

  const addSelectedStudent = () => {
    if (!selectedStudentId) return;

    const student = existingStudents.find(s => s.id === selectedStudentId);
    if (!student) return;

    const newMember: MemberInput = {
      id: student.id,
      name: student.name,
      phone: student.phone,
      parentPhone: student.parentPhone,
      useCustomPrice: false,
    };

    setMembers(prev => [...prev, newMember]);
    setSelectedStudentId('');
  };

  const removeMember = (memberId: string) => {
    setMembers(prev => prev.filter(m => m.id !== memberId));
  };

  const updateMemberCustomPrice = (memberId: string, price: number | undefined) => {
    setMembers(prev => prev.map(m =>
      m.id === memberId ? { ...m, customPrice: price } : m
    ));
  };

  const toggleMemberCustomPrice = (memberId: string) => {
    setMembers(prev => prev.map(m =>
      m.id === memberId ? { ...m, useCustomPrice: !m.useCustomPrice, customPrice: m.useCustomPrice ? undefined : defaultPrice } : m
    ));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const hasValidSchedule = daySchedules.length > 0 && daySchedules.every(d => d.time);
    if (!groupName.trim() || !sessionType || !hasValidSchedule || members.length === 0) {
      return;
    }

    // If there are error conflicts, block submission
    if (conflictSummary.hasErrors) {
      return;
    }

    // If there are warnings, show confirmation dialog
    if (conflictSummary.hasWarnings) {
      setShowWarningDialog(true);
      return;
    }

    // No conflicts - proceed
    await proceedWithSubmit();
  };

  const proceedWithSubmit = async () => {
    if (!sessionType) return;
    const primaryTime = daySchedules[0]?.time || '16:00';

    const groupMembers: Omit<GroupMember, 'joinedAt' | 'isActive'>[] = members.map(m => ({
      studentId: m.id,
      studentName: m.name,
      phone: m.phone,
      parentPhone: m.parentPhone,
      customPrice: m.useCustomPrice ? m.customPrice : undefined,
    }));

    const scheduleDays: ScheduleDay[] = daySchedules.map(d => ({
      dayOfWeek: d.dayOfWeek,
      time: d.time,
    }));

    const useCustom = showCustomDates;

    if (editMode && groupToEdit && onUpdateGroup) {
      // Build members for update — map dialog member IDs back to group_members table IDs
      const updatedMembers: GroupMember[] = members.map(m => {
        // Check if this member existed in the original group (by matching group_members table ID)
        const existingMember = groupToEdit.members.find(gm => gm.studentId === m.id);
        return {
          studentId: m.id, // This is the group_members table row ID for existing, or student ID for new
          linkedStudentId: existingMember?.linkedStudentId,
          studentName: m.name,
          phone: m.phone,
          parentPhone: m.parentPhone,
          customPrice: m.useCustomPrice ? m.customPrice : undefined,
          joinedAt: existingMember?.joinedAt || new Date().toISOString(),
          isActive: true,
        };
      });

      // Update existing group with all changes
      await onUpdateGroup(groupToEdit.id, {
        name: groupName.trim(),
        description: description.trim() || undefined,
        color: selectedColor,
        defaultPricePerStudent: defaultPrice,
        sessionType,
        sessionDuration,
        sessionTime: primaryTime,
        location: sessionType === 'onsite' ? location as any : undefined,
        members: updatedMembers,
        scheduleDays,
      });
    } else {
      // Add new group
      onAddGroup(
        groupName.trim(),
        groupMembers,
        defaultPrice,
        sessionType,
        scheduleDays,
        sessionDuration,
        primaryTime,
        useCustom ? customStart : defaultStart,
        useCustom ? customEnd : defaultEnd,
        description.trim() || undefined,
        selectedColor,
        sessionType === 'onsite' ? location : null
      );
    }

    resetForm();
    onOpenChange(false);
    setShowWarningDialog(false);
  };

  const isValid = groupName.trim() &&
    sessionType &&
    daySchedules.length > 0 &&
    daySchedules.every(d => d.time) &&
    (editMode || members.length > 0) &&
    !conflictSummary.hasErrors &&
    !isChecking;

  return (
    <>
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) resetForm(); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col" dir="rtl">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl flex items-center gap-2">
            <Users className="h-5 w-5" />
            {editMode ? 'تعديل المجموعة' : 'إضافة مجموعة جديدة'}
          </DialogTitle>
        </DialogHeader>
        <DialogBody>
          <form onSubmit={handleSubmit} className="space-y-5 pt-4 pb-2">
            {/* Group Info */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="groupName">اسم المجموعة</Label>
                <Input
                  id="groupName"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="مثال: مجموعة الثانوية"
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">وصف المجموعة (اختياري)</Label>
                <Input
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="وصف قصير للمجموعة"
                />
              </div>

              {/* Color Selection */}
              <div className="space-y-2">
                <Label>لون المجموعة</Label>
                <div className="flex flex-wrap gap-2">
                  {GROUP_COLORS.map(color => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => setSelectedColor(color.value)}
                      className={cn(
                        "w-8 h-8 rounded-full transition-all",
                        color.class,
                        selectedColor === color.value
                          ? "ring-2 ring-offset-2 ring-primary"
                          : "opacity-60 hover:opacity-100"
                      )}
                      title={color.label}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Session Type */}
            <div className="space-y-2">
              <Label>نوع الحصة</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSessionType('onsite')}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border transition-all",
                    sessionType === 'onsite'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-card border-border hover:border-primary/50'
                  )}
                >
                  <MapPin className="h-3.5 w-3.5" />
                  <span className="text-sm">حضوري</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSessionType('online')}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border transition-all",
                    sessionType === 'online'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-card border-border hover:border-primary/50'
                  )}
                >
                  <Monitor className="h-3.5 w-3.5" />
                  <span className="text-sm">أونلاين</span>
                </button>
              </div>
            </div>

            {/* Location Picker - Only for onsite sessions */}
            {sessionType === 'onsite' && (
              <LocationPicker
                value={location}
                onChange={setLocation}
                label="موقع الحصة (اختياري)"
                placeholder="اختر موقع الحصة على الخريطة"
              />
            )}

            {/* Default Price */}
            <div className="space-y-2">
              <Label htmlFor="defaultPrice" className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-amber-500" />
                سعر الحصة الافتراضي للطالب (ج.م)
              </Label>
              <Input
                id="defaultPrice"
                type="number"
                min="0"
                value={defaultPrice}
                onChange={(e) => setDefaultPrice(Number(e.target.value) || 0)}
                className="w-32"
              />
              <p className="text-xs text-muted-foreground">
                يمكن تخصيص سعر مختلف لكل طالب
              </p>
            </div>

            {/* Duration */}
            <DurationPicker
              startTime="16:00"
              duration={sessionDuration}
              onDurationChange={setSessionDuration}
              showEndTime={false}
              placeholder="اختر مدة الحصة"
            />

            {/* Conflict Warning Box */}
            {!isChecking && conflictSummary.hasErrors && (
              <div className="p-3 rounded-lg bg-destructive/10 border-2 border-destructive">
                <div className="flex items-start gap-2">
                  <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold text-destructive text-sm">
                      ❌ تعارض مع {conflictSummary.errorCount} جلسة موجودة
                    </p>
                    <p className="text-xs text-destructive/80">
                      يتعارض الوقت مع: {conflictSummary.conflictingNames.slice(0, 3).join('، ')}
                      {conflictSummary.conflictingNames.length > 3 && ` (+${conflictSummary.conflictingNames.length - 3})`}
                    </p>
                    <p className="text-xs text-destructive/70">
                      الرجاء اختيار وقت مختلف
                    </p>
                  </div>
                </div>
              </div>
            )}

            {!isChecking && !conflictSummary.hasErrors && conflictSummary.hasWarnings && (
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border-2 border-amber-500">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold text-amber-700 dark:text-amber-400 text-sm">
                      ⚠️ قريب من {conflictSummary.warningCount} جلسة
                    </p>
                    <p className="text-xs text-amber-600 dark:text-amber-500">
                      فاصل أقل من 30 دقيقة مع: {conflictSummary.conflictingNames.slice(0, 3).join('، ')}
                    </p>
                    <p className="text-xs text-amber-500 dark:text-amber-600">
                      يمكنك الاستمرار، لكن ننصح بفاصل أكبر
                    </p>
                  </div>
                </div>
              </div>
            )}

            {!isChecking && !conflictSummary.hasErrors && !conflictSummary.hasWarnings && daySchedules.length > 0 && daySchedules.every(d => d.time) && (
              <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-500">
                <Check className="h-4 w-4" />
                <span>✓ الأوقات متاحة</span>
              </div>
            )}

            {/* Members Section - Dropdown Only */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  أعضاء المجموعة ({members.length})
                </Label>
              </div>

              {/* Student Dropdown */}
              {availableStudents.length > 0 ? (
                <div className="flex gap-2">
                  <Select
                    value={selectedStudentId}
                    onValueChange={(value) => {
                      setSelectedStudentId(value);
                      setSelectOpen(false);
                    }}
                    open={selectOpen}
                    onOpenChange={setSelectOpen}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="اختر طالب لإضافته..." />
                    </SelectTrigger>
                    <SelectContent
                      position="popper"
                      sideOffset={4}
                      className="max-h-[200px] overflow-y-auto"
                    >
                      {availableStudents.map(student => (
                        <SelectItem key={student.id} value={student.id}>
                          <div className="flex items-center gap-2">
                            <span>{student.name}</span>
                            <span className="text-xs text-muted-foreground">
                              ({student.sessionType === 'online' ? 'أونلاين' : 'حضوري'})
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addSelectedStudent}
                    disabled={!selectedStudentId}
                  >
                    إضافة
                  </Button>
                </div>
              ) : existingStudents.length === 0 ? (
                <p className="text-sm text-muted-foreground p-3 bg-muted/50 rounded-lg text-center">
                  لا يوجد طلاب. أضف طلاباً أولاً ثم أنشئ مجموعة.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground p-3 bg-muted/50 rounded-lg text-center">
                  تم إضافة جميع الطلاب المتاحين
                </p>
              )}

              {/* Member List */}
              {members.length > 0 && (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-muted/50 border"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-xs font-medium text-primary">
                            {member.name.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium">{member.name}</p>
                          {member.phone && (
                            <p className="text-xs text-muted-foreground">{member.phone}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5">
                          <Switch
                            checked={member.useCustomPrice}
                            onCheckedChange={() => toggleMemberCustomPrice(member.id)}
                            className="scale-75"
                          />
                          {member.useCustomPrice && (
                            <Input
                              type="number"
                              min="0"
                              value={member.customPrice || ''}
                              onChange={(e) => updateMemberCustomPrice(member.id, Number(e.target.value) || undefined)}
                              className="w-16 h-7 text-xs text-center"
                              placeholder="سعر"
                            />
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeMember(member.id)}
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Schedule Section with Smart Suggestions */}
            <div className="space-y-3">
              <Label>جدول الحصص الأسبوعي</Label>

              {/* Simplified Smart Scheduling Tips - Max 3 tips total */}
              {sessionType && (schedulingSuggestions.generalTips.length > 0 || schedulingSuggestions.smartRecommendations.length > 0) && (
                <div className="p-2.5 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-800/50">
                  <div className="flex items-start gap-2">
                    <Lightbulb className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      {/* Show only top 3 most important tips combined */}
                      {[...schedulingSuggestions.generalTips.slice(0, 2), ...schedulingSuggestions.smartRecommendations.slice(0, 1)]
                        .slice(0, 3)
                        .map((tip, i) => (
                          <p key={`tip-${i}`} className="text-xs text-blue-600 dark:text-blue-400">{tip}</p>
                        ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Grouping Suggestions - Show only top 2 most relevant */}
              {sessionType && schedulingSuggestions.groupingSuggestions.length > 0 && (
                <div className="p-2.5 rounded-lg bg-teal-50/50 dark:bg-teal-950/20 border border-teal-200/50 dark:border-teal-800/50">
                  <p className="text-xs font-medium text-teal-700 dark:text-teal-300 mb-2">📅 أيام مقترحة (نفس نوع الجلسات)</p>
                  <div className="flex flex-wrap gap-2">
                    {schedulingSuggestions.groupingSuggestions.slice(0, 2).map((suggestion, i) => (
                      <button
                        key={`group-${i}`}
                        type="button"
                        onClick={() => {
                          const existingSchedule = daySchedules.find(d => d.dayOfWeek === suggestion.dayOfWeek);
                          if (!existingSchedule) {
                            setDaySchedules(prev => [...prev, { dayOfWeek: suggestion.dayOfWeek, time: suggestion.suggestedTime }].sort((a, b) => a.dayOfWeek - b.dayOfWeek));
                          }
                        }}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-teal-100 text-teal-700 hover:bg-teal-200 dark:bg-teal-900/50 dark:text-teal-300 dark:hover:bg-teal-900/70 transition-colors"
                      >
                        <span>{suggestion.dayName}</span>
                        <span className="text-teal-500">•</span>
                        <span>{suggestion.suggestedTimeAr}</span>
                        <span className="text-[10px] text-teal-500">({suggestion.existingStudents.length} طالب)</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Proximity Suggestions - Simplified (only for onsite with location) */}
              {sessionType === 'onsite' && location && schedulingSuggestions.proximitySuggestions && schedulingSuggestions.proximitySuggestions.length > 0 && (
                <div className="p-2.5 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/50">
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-300 mb-2">📍 طلاب قريبون</p>
                  <div className="flex flex-wrap gap-2">
                    {schedulingSuggestions.proximitySuggestions.slice(0, 2).map((suggestion, i) => (
                      <button
                        key={`prox-${i}`}
                        type="button"
                        onClick={() => {
                          const existingSchedule = daySchedules.find(d => d.dayOfWeek === suggestion.dayOfWeek);
                          if (!existingSchedule) {
                            setDaySchedules(prev => [...prev, { dayOfWeek: suggestion.dayOfWeek, time: suggestion.suggestedTime }].sort((a, b) => a.dayOfWeek - b.dayOfWeek));
                          }
                        }}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/50 dark:text-amber-300 dark:hover:bg-amber-900/70 transition-colors"
                      >
                        <span>{suggestion.nearbyStudent}</span>
                        <span className="text-amber-500">•</span>
                        <span>{suggestion.dayName}</span>
                        <span className="text-[10px] text-amber-500">({suggestion.distanceKm.toFixed(1)} كم)</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Day Selection with Per-Day Time */}
              <div className="space-y-2">
                {DAY_NAMES_AR.map((day, index) => {
                  const schedule = daySchedules.find(d => d.dayOfWeek === index);
                  const isSelected = !!schedule;
                  const daySuggestion = schedulingSuggestions.daySuggestions[index];
                  const isBestDay = schedulingSuggestions.bestDays.includes(index);
                  const isAvoidDay = schedulingSuggestions.avoidDays.includes(index);

                  return (
                    <div
                      key={day}
                      className={cn(
                        "flex flex-col gap-2 p-3 rounded-lg border-2 transition-all",
                        isSelected
                          ? "bg-primary/5 border-primary/30"
                          : isBestDay && sessionType
                            ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-700"
                            : isAvoidDay && sessionType
                              ? "bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-700"
                              : "bg-card border-border hover:border-primary/20"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 cursor-pointer min-w-[80px]">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleDaySchedule(index)}
                          />
                          <span className={cn(
                            "text-sm font-medium",
                            isSelected ? "text-primary" : "text-foreground"
                          )}>
                            {day}
                          </span>
                        </label>

                        {/* Smart suggestion badge */}
                        {sessionType && daySuggestion && (
                          <div className="flex items-center gap-1.5 flex-1">
                            {daySuggestion.type === 'free_day' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                                <Sparkles className="h-3 w-3" />
                                فارغ
                              </span>
                            )}
                            {daySuggestion.type === 'light_day' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                                <Check className="h-3 w-3" />
                                خفيف ({daySuggestion.sessionCount})
                              </span>
                            )}
                            {daySuggestion.type === 'moderate_day' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                                <Clock className="h-3 w-3" />
                                متوسط ({daySuggestion.sessionCount})
                              </span>
                            )}
                            {daySuggestion.type === 'busy_day' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                                <AlertTriangle className="h-3 w-3" />
                                مزدحم ({daySuggestion.sessionCount})
                              </span>
                            )}
                            {daySuggestion.type === 'same_type_cluster' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300">
                                {sessionType === 'online' ? <Monitor className="h-3 w-3" /> : <MapPin className="h-3 w-3" />}
                                {sessionType === 'online' ? 'أونلاين' : 'حضوري'} ({daySuggestion.sessionCount})
                              </span>
                            )}
                            {daySuggestion.type === 'mixed_type' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                                <Users className="h-3 w-3" />
                                مختلط
                              </span>
                            )}
                          </div>
                        )}

                        {/* Time input */}
                        {isSelected && (
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <Input
                              type="time"
                              value={schedule.time}
                              onChange={(e) => updateDayTime(index, e.target.value)}
                              className="w-32"
                            />
                            {schedule.time && (
                              <span className="text-xs text-muted-foreground">
                                {formatTimeAr(schedule.time)}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Suggested time slots */}
                      {isSelected && !schedule.time && daySuggestion && daySuggestion.suggestedTimeSlots.length > 0 && (
                        <div className="mr-8 mt-1">
                          <p className="text-xs text-muted-foreground mb-1.5">⏰ أوقات مقترحة:</p>
                          <div className="flex flex-wrap gap-1.5">
                            {daySuggestion.suggestedTimeSlots.map((slot, i) => (
                              <button
                                key={i}
                                type="button"
                                onClick={() => updateDayTime(index, slot.time)}
                                className={cn(
                                  "inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all",
                                  slot.priority === 'high'
                                    ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-300"
                                    : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300"
                                )}
                                title={slot.reason}
                              >
                                <Clock className="h-3 w-3" />
                                {slot.timeAr}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Summary of selected days */}
              {daySchedules.length > 0 && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-2">ملخص الجدول:</p>
                  <div className="flex flex-wrap gap-2">
                    {daySchedules.map((schedule) => (
                      <span
                        key={schedule.dayOfWeek}
                        className={cn(
                          "px-2 py-1 rounded text-xs font-medium",
                          schedule.time
                            ? "bg-primary/10 text-primary"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                        )}
                      >
                        {DAY_NAMES_AR[schedule.dayOfWeek]}: {schedule.time ? formatTimeAr(schedule.time) : "⏰ حدد الوقت"}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Custom Dates */}
            <Collapsible open={showCustomDates} onOpenChange={setShowCustomDates}>
              <CollapsibleTrigger asChild>
                <Button type="button" variant="ghost" className="w-full justify-between text-muted-foreground">
                  تواريخ الفصل الدراسي (اختياري)
                  {showCustomDates ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 pt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="customStart">تاريخ البداية</Label>
                    <Input
                      id="customStart"
                      type="date"
                      value={customStart}
                      onChange={(e) => setCustomStart(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="customEnd">تاريخ النهاية</Label>
                    <Input
                      id="customEnd"
                      type="date"
                      value={customEnd}
                      onChange={(e) => setCustomEnd(e.target.value)}
                    />
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Summary */}
            {members.length > 0 && daySchedules.length > 0 && (
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground mb-2">ملخص المجموعة:</p>
                <div className="space-y-1 text-sm">
                  <p>👥 {members.length} طالب</p>
                  <p>📅 {daySchedules.map(d => DAY_NAMES_AR[d.dayOfWeek]).join('، ')}</p>
                  <p>💰 {defaultPrice} ج.م / طالب</p>
                  {sessionType && (
                    <p>{sessionType === 'online' ? '💻 أونلاين' : '🏠 حضوري'}</p>
                  )}
                </div>
              </div>
            )}
          </form>
        </DialogBody>

        <DialogFooter className="flex-col sm:flex-row-reverse gap-2 pt-2">
          <Button
            type="submit"
            onClick={handleSubmit}
            className="w-full sm:flex-1 gradient-primary"
            disabled={!isValid}
          >
            {isChecking ? (
              <>
                <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                جاري التحقق...
              </>
            ) : (
              <>
                <Users className="h-4 w-4 ml-2" />
                {editMode ? 'حفظ التغييرات' : 'إنشاء المجموعة'}
              </>
            )}
          </Button>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:flex-1">
            إلغاء
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Warning Confirmation Dialog */}
    <AlertDialog open={showWarningDialog} onOpenChange={setShowWarningDialog}>
      <AlertDialogContent dir="rtl">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            تحذير: جلسات قريبة جداً
          </AlertDialogTitle>
          <AlertDialogDescription className="text-right space-y-2">
            <p>
              سيتم إنشاء {conflictSummary.warningCount} جلسة بفاصل أقل من 30 دقيقة عن جلسات أخرى.
            </p>
            <p className="text-muted-foreground text-sm">
              المتأثرون: {conflictSummary.conflictingNames.join('، ')}
            </p>
            <p className="text-muted-foreground text-sm">
              قد لا يكون لديك وقت كافٍ للتحضير أو الراحة بين الحصص.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row-reverse gap-2">
          <AlertDialogCancel>إلغاء</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => proceedWithSubmit()}
            className="bg-amber-500 hover:bg-amber-600"
          >
            نعم، {editMode ? 'احفظ التغييرات' : 'أنشئ المجموعة'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
};

export default AddGroupDialog;

