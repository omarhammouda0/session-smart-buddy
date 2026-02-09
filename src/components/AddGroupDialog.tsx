import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Users, Plus, Clock, Monitor, MapPin, DollarSign, Trash2, UserPlus, X, ChevronDown, ChevronUp } from 'lucide-react';
import { SessionType, Student, ScheduleDay, GroupMember } from '@/types/student';
import { DAY_NAMES_AR } from '@/lib/arabicConstants';
import { DurationPicker } from '@/components/DurationPicker';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
  onAdd: (
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
  ) => void;
  existingStudents?: Student[];
  defaultStart: string;
  defaultEnd: string;
  defaultPriceOnsite?: number;
  defaultPriceOnline?: number;
}

// Format time in Arabic
const formatTimeAr = (time: string): string => {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'م' : 'ص';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
};

// Generate unique ID
const generateId = () => `member_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

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
  onAdd,
  existingStudents = [],
  defaultStart,
  defaultEnd,
  defaultPriceOnsite = 150,
  defaultPriceOnline = 120,
}: AddGroupDialogProps) => {
  const [open, setOpen] = useState(false);

  // Group info
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedColor, setSelectedColor] = useState('blue');

  // Session settings
  const [sessionType, setSessionType] = useState<SessionType | null>(null);
  const [sessionDuration, setSessionDuration] = useState<number>(60);
  const [defaultPrice, setDefaultPrice] = useState<number>(80); // Group default is usually lower

  // Schedule
  const [daySchedules, setDaySchedules] = useState<DayScheduleInput[]>([]);
  const [showCustomDates, setShowCustomDates] = useState(false);
  const [customStart, setCustomStart] = useState(defaultStart);
  const [customEnd, setCustomEnd] = useState(defaultEnd);

  // Members
  const [members, setMembers] = useState<MemberInput[]>([]);
  const [showAddExisting, setShowAddExisting] = useState(false);

  // New member form
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberPhone, setNewMemberPhone] = useState('');
  const [newMemberParentPhone, setNewMemberParentPhone] = useState('');

  // Get students not already in the group
  const availableStudents = useMemo(() => {
    const memberIds = new Set(members.map(m => m.id));
    return existingStudents.filter(s => !memberIds.has(s.id));
  }, [existingStudents, members]);

  const resetForm = () => {
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
    setShowAddExisting(false);
    setNewMemberName('');
    setNewMemberPhone('');
    setNewMemberParentPhone('');
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

  const addNewMember = () => {
    if (!newMemberName.trim()) return;

    const newMember: MemberInput = {
      id: generateId(),
      name: newMemberName.trim(),
      phone: newMemberPhone.trim() || undefined,
      parentPhone: newMemberParentPhone.trim() || undefined,
      useCustomPrice: false,
    };

    setMembers(prev => [...prev, newMember]);
    setNewMemberName('');
    setNewMemberPhone('');
    setNewMemberParentPhone('');
  };

  const addExistingStudent = (student: Student) => {
    const newMember: MemberInput = {
      id: student.id,
      name: student.name,
      phone: student.phone,
      parentPhone: student.parentPhone,
      useCustomPrice: false,
    };

    setMembers(prev => [...prev, newMember]);
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate
    const hasValidSchedule = daySchedules.length > 0 && daySchedules.every(d => d.time);
    if (!groupName.trim() || !sessionType || !hasValidSchedule || members.length === 0) {
      return;
    }

    // Get the first session time as the default
    const primaryTime = daySchedules[0]?.time || '16:00';

    // Convert members to GroupMember format
    const groupMembers: Omit<GroupMember, 'joinedAt' | 'isActive'>[] = members.map(m => ({
      studentId: m.id,
      studentName: m.name,
      phone: m.phone,
      parentPhone: m.parentPhone,
      customPrice: m.useCustomPrice ? m.customPrice : undefined,
    }));

    // Convert day schedules
    const scheduleDays: ScheduleDay[] = daySchedules.map(d => ({
      dayOfWeek: d.dayOfWeek,
      time: d.time,
    }));

    const useCustom = showCustomDates;

    onAdd(
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
      selectedColor
    );

    resetForm();
    setOpen(false);
  };

  const isValid = groupName.trim() &&
    sessionType &&
    daySchedules.length > 0 &&
    daySchedules.every(d => d.time) &&
    members.length > 0;

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Users className="h-4 w-4" />
          إضافة مجموعة
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col" dir="rtl">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl flex items-center gap-2">
            <Users className="h-5 w-5" />
            إضافة مجموعة جديدة
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

            {/* Schedule */}
            <div className="space-y-3">
              <Label>جدول الحصص الأسبوعي</Label>
              <div className="space-y-2">
                {DAY_NAMES_AR.map((day, index) => {
                  const schedule = daySchedules.find(d => d.dayOfWeek === index);
                  const isSelected = !!schedule;

                  return (
                    <div
                      key={day}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border-2 transition-all",
                        isSelected
                          ? "bg-primary/5 border-primary/30"
                          : "bg-card border-border hover:border-primary/20"
                      )}
                    >
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

                      {isSelected && (
                        <div className="flex items-center gap-2 flex-1">
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
                  );
                })}
              </div>
            </div>

            {/* Members Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  أعضاء المجموعة ({members.length})
                </Label>
              </div>

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
                        {/* Custom Price Toggle */}
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

              {/* Add New Member */}
              <div className="p-3 rounded-lg border bg-muted/30 space-y-3">
                <p className="text-sm font-medium">إضافة عضو جديد</p>
                <div className="grid grid-cols-1 gap-2">
                  <Input
                    value={newMemberName}
                    onChange={(e) => setNewMemberName(e.target.value)}
                    placeholder="اسم الطالب"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      value={newMemberPhone}
                      onChange={(e) => setNewMemberPhone(e.target.value)}
                      placeholder="رقم الطالب"
                      dir="ltr"
                    />
                    <Input
                      value={newMemberParentPhone}
                      onChange={(e) => setNewMemberParentPhone(e.target.value)}
                      placeholder="رقم ولي الأمر"
                      dir="ltr"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addNewMember}
                    disabled={!newMemberName.trim()}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 ml-1" />
                    إضافة
                  </Button>
                </div>
              </div>

              {/* Add from Existing Students */}
              {availableStudents.length > 0 && (
                <Collapsible open={showAddExisting} onOpenChange={setShowAddExisting}>
                  <CollapsibleTrigger asChild>
                    <Button type="button" variant="ghost" size="sm" className="w-full justify-between">
                      <span className="flex items-center gap-1">
                        <UserPlus className="h-4 w-4" />
                        إضافة من الطلاب الموجودين ({availableStudents.length})
                      </span>
                      {showAddExisting ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-2">
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {availableStudents.map(student => (
                        <button
                          key={student.id}
                          type="button"
                          onClick={() => addExistingStudent(student)}
                          className="w-full flex items-center justify-between p-2 rounded hover:bg-muted text-right"
                        >
                          <span className="text-sm">{student.name}</span>
                          <Plus className="h-4 w-4 text-muted-foreground" />
                        </button>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
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
            <Users className="h-4 w-4 ml-2" />
            إنشاء المجموعة
          </Button>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} className="w-full sm:flex-1">
            إلغاء
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddGroupDialog;

