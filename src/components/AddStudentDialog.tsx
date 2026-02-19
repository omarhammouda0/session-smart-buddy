import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { UserPlus, ChevronDown, ChevronUp, Clock, Monitor, MapPin, Phone, XCircle, AlertTriangle, Check, Loader2, DollarSign, Sparkles, Lightbulb, Car, Users, UserCheck, Calendar } from 'lucide-react';
import { SessionType, Student, DEFAULT_DURATION, StudentMaterial, AppSettings, ScheduleMode, Location } from '@/types/student';
import { DAY_NAMES_AR } from '@/lib/arabicConstants';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { generateSessionsForSchedule, getDistributedDays } from '@/lib/dateUtils';
import { useConflictDetection, formatTimeAr, ConflictResult } from '@/hooks/useConflictDetection';
import { useSchedulingSuggestions } from '@/hooks/useSchedulingSuggestions';
import { DurationPicker } from '@/components/DurationPicker';
import { StudentMaterialsSection } from '@/components/StudentMaterialsSection';
import { LocationPicker, LocationData } from '@/components/LocationPicker';
import { cn } from '@/lib/utils';
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

// Type for day schedule with time
interface DaySchedule {
  dayOfWeek: number;
  time: string;
}

interface AddStudentDialogProps {
  onAdd: (name: string, scheduleDays: number[], sessionTime: string, sessionType: SessionType, phone?: string, parentPhone?: string, customStart?: string, customEnd?: string, sessionDuration?: number, materials?: StudentMaterial[], useCustomPrices?: boolean, customPriceOnsite?: number, customPriceOnline?: number, scheduleMode?: ScheduleMode, sessionsPerWeek?: number, daySchedules?: DaySchedule[], location?: LocationData | null) => void;
  defaultStart: string;
  defaultEnd: string;
  students?: Student[];
  settings?: AppSettings;
  defaultDuration?: number;
  defaultPriceOnsite?: number;
  defaultPriceOnline?: number;
}

export const AddStudentDialog = ({ onAdd, defaultStart, defaultEnd, students = [], settings, defaultDuration = DEFAULT_DURATION, defaultPriceOnsite = 150, defaultPriceOnline = 120 }: AddStudentDialogProps) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [parentPhone, setParentPhone] = useState('');

  // New: Per-day schedule with individual times
  // Format: { dayOfWeek: number, time: string }[]
  const [daySchedules, setDaySchedules] = useState<Array<{ dayOfWeek: number; time: string }>>([]);

  // Legacy: for backwards compatibility
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [sessionTime, setSessionTime] = useState('');
  const [sessionDuration, setSessionDuration] = useState<number>(60); // Default to 1 hour
  const [sessionType, setSessionType] = useState<SessionType | null>(null);
  const [showCustomDates, setShowCustomDates] = useState(false);
  const [customStart, setCustomStart] = useState(defaultStart);
  const [customEnd, setCustomEnd] = useState(defaultEnd);
  const [materials, setMaterials] = useState<StudentMaterial[]>([]);

  // Schedule mode state - now simplified to just 'days' with per-day times
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>('days');
  const [sessionsPerWeek, setSessionsPerWeek] = useState<number>(2);

  // Custom pricing state
  const [useCustomPrices, setUseCustomPrices] = useState(false);
  const [customPriceOnsite, setCustomPriceOnsite] = useState<number>(defaultPriceOnsite);
  const [customPriceOnline, setCustomPriceOnline] = useState<number>(defaultPriceOnline);

  // Location state (for onsite sessions)
  const [location, setLocation] = useState<LocationData | null>(null);

  // Conflict detection state
  const [isChecking, setIsChecking] = useState(false);
  const [conflictResults, setConflictResults] = useState<Map<string, ConflictResult>>(new Map());
  const [showWarningDialog, setShowWarningDialog] = useState(false);
  
  const { checkConflict } = useConflictDetection(students);

  // Get scheduling suggestions based on existing students and location
  const schedulingSuggestions = useSchedulingSuggestions(
    students,
    sessionType,
    sessionType === 'onsite' ? location : null
  );

  // Get effective days from daySchedules
  const effectiveDaysFromSchedules = useMemo(() => {
    return daySchedules.map(d => d.dayOfWeek).sort((a, b) => a - b);
  }, [daySchedules]);

  // Compute effective days based on schedule mode
  const effectiveDays = useMemo(() => {
    if (scheduleMode === 'perWeek') {
      return getDistributedDays(sessionsPerWeek);
    }
    // Use days from daySchedules
    return effectiveDaysFromSchedules;
  }, [scheduleMode, sessionsPerWeek, effectiveDaysFromSchedules]);

  // Check conflicts when time or days change (debounced)
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
        
        // Generate session dates and check conflicts for each day with its specific time
        const results = new Map<string, ConflictResult>();

        // Only check the first 8 weeks to keep it fast
        const maxDatesToCheck = 8;

        daySchedules.forEach(schedule => {
          if (!schedule.time) return;

          // Generate dates for this specific day
          const sessionDates = generateSessionsForSchedule([schedule.dayOfWeek], semesterStart, semesterEnd);

          // Check only the first N occurrences
          const datesToCheck = sessionDates.slice(0, maxDatesToCheck);

          datesToCheck.forEach(date => {
            const result = checkConflict({ date, startTime: schedule.time });
            if (result.severity !== 'none') {
              results.set(`${date}-${schedule.dayOfWeek}`, result);
            }
          });
        });
        
        setConflictResults(results);
      } finally {
        setIsChecking(false);
      }
    }, 500); // 500ms debounce to reduce re-triggers
    
    return () => clearTimeout(timer);
  }, [open, daySchedules, showCustomDates, customStart, customEnd, defaultStart, defaultEnd, checkConflict]);

  // Summarize conflicts
  const conflictSummary = useMemo(() => {
    let errorCount = 0;
    let warningCount = 0;
    const errorDates: string[] = [];
    const warningDates: string[] = [];
    const conflictingStudents = new Set<string>();
    
    conflictResults.forEach((result, date) => {
      if (result.severity === 'error') {
        errorCount++;
        errorDates.push(date);
        result.conflicts.forEach(c => conflictingStudents.add(c.student.name));
      } else if (result.severity === 'warning') {
        warningCount++;
        warningDates.push(date);
        result.conflicts.forEach(c => conflictingStudents.add(c.student.name));
      }
    });
    
    return {
      errorCount,
      warningCount,
      errorDates,
      warningDates,
      conflictingStudents: Array.from(conflictingStudents),
      hasErrors: errorCount > 0,
      hasWarnings: warningCount > 0,
    };
  }, [conflictResults]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Validate: must have at least one day with time, name, duration, and type
    const hasValidSchedule = daySchedules.length > 0 && daySchedules.every(d => d.time);

    if (!name.trim() || !hasValidSchedule || !sessionDuration || !sessionType) return;

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
    proceedWithAdd();
  };
  
  const proceedWithAdd = () => {
    if (!sessionType || !sessionDuration || daySchedules.length === 0) return;
    const useCustom = showCustomDates && (customStart !== defaultStart || customEnd !== defaultEnd);

    // Get the first session time as the default (for backwards compatibility)
    const primaryTime = daySchedules[0]?.time || '16:00';

    // Convert daySchedules to the format expected by onAdd
    const scheduleDaysWithTimes = daySchedules.map(d => d.dayOfWeek);

    onAdd(
      name.trim(),
      scheduleDaysWithTimes,
      primaryTime, // Primary session time
      sessionType,
      phone.trim() || undefined,
      parentPhone.trim() || undefined,
      useCustom ? customStart : undefined,
      useCustom ? customEnd : undefined,
      sessionDuration,
      materials.length > 0 ? materials : undefined,
      useCustomPrices || undefined,
      useCustomPrices ? customPriceOnsite : undefined,
      useCustomPrices ? customPriceOnline : undefined,
      'days', // Always use 'days' mode now
      undefined, // No sessionsPerWeek
      daySchedules, // Pass the full day schedules with times
      sessionType === 'onsite' ? location : null // Pass location for onsite sessions
    );
    resetForm();
    setOpen(false);
    setShowWarningDialog(false);
  };

  const resetForm = () => {
    setName('');
    setPhone('');
    setParentPhone('');
    setDaySchedules([]);
    setSelectedDays([]);
    setSessionTime('');
    setSessionDuration(60); // Reset to default 1 hour
    setSessionType(null);
    setShowCustomDates(false);
    setCustomStart(defaultStart);
    setCustomEnd(defaultEnd);
    setConflictResults(new Map());
    setMaterials([]);
    setUseCustomPrices(false);
    setCustomPriceOnsite(defaultPriceOnsite);
    setCustomPriceOnline(defaultPriceOnline);
    setScheduleMode('days');
    setSessionsPerWeek(2);
    setLocation(null);
  };

  // Toggle a day in the schedule
  const toggleDaySchedule = (day: number) => {
    setDaySchedules(prev => {
      const exists = prev.find(d => d.dayOfWeek === day);
      if (exists) {
        // Remove the day
        return prev.filter(d => d.dayOfWeek !== day);
      } else {
        // Add the day with empty time (user will set it)
        return [...prev, { dayOfWeek: day, time: '' }].sort((a, b) => a.dayOfWeek - b.dayOfWeek);
      }
    });
  };

  // Update time for a specific day
  const updateDayTime = (day: number, time: string) => {
    setDaySchedules(prev =>
      prev.map(d => d.dayOfWeek === day ? { ...d, time } : d)
    );
  };

  const toggleDay = (day: number) => {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort()
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
        <DialogTrigger asChild>
          <Button className="gradient-primary gap-2 shadow-lg hover:shadow-xl transition-shadow">
            <UserPlus className="h-4 w-4" />
            إضافة طالب
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col" dir="rtl">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">إضافة طالب جديد</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <form onSubmit={handleSubmit} className="space-y-5 pt-4 pb-2">
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">اسم الطالب</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="أدخل اسم الطالب"
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone" className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5" />
                    رقم الطالب (واتساب)
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+966xxxxxxxxx"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="parentPhone" className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5" />
                    رقم ولي الأمر (واتساب)
                  </Label>
                  <Input
                    id="parentPhone"
                    type="tel"
                    value={parentPhone}
                    onChange={(e) => setParentPhone(e.target.value)}
                    placeholder="+966xxxxxxxxx"
                    dir="ltr"
                  />
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
                  className={`
                    flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border transition-all
                    ${sessionType === 'onsite'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-card border-border hover:border-primary/50'
                    }
                  `}
                >
                  <MapPin className="h-3.5 w-3.5" />
                  <span className="text-sm">حضوري</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSessionType('online')}
                  className={`
                    flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border transition-all
                    ${sessionType === 'online'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-card border-border hover:border-primary/50'
                    }
                  `}
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
                label="موقع الدرس (اختياري)"
                placeholder="اختر موقع الدرس على الخريطة"
              />
            )}

            {/* Custom Pricing Section */}
            <div className="space-y-3 p-3 rounded-lg border bg-muted/30">
              <div className="flex items-center justify-between">
                <Label htmlFor="customPrices" className="flex items-center gap-2 cursor-pointer">
                  <DollarSign className="h-4 w-4 text-amber-500" />
                  <span>سعر مخصص للحصة</span>
                </Label>
                <Switch
                  id="customPrices"
                  checked={useCustomPrices}
                  onCheckedChange={setUseCustomPrices}
                />
              </div>

              {useCustomPrices && (
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="space-y-2">
                    <Label htmlFor="priceOnsite" className="text-xs flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      سعر الحضوري (ج.م)
                    </Label>
                    <Input
                      id="priceOnsite"
                      type="number"
                      min="0"
                      value={customPriceOnsite}
                      onChange={(e) => setCustomPriceOnsite(Number(e.target.value) || 0)}
                      placeholder={String(defaultPriceOnsite)}
                      className="text-center"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="priceOnline" className="text-xs flex items-center gap-1">
                      <Monitor className="h-3 w-3" />
                      سعر الأونلاين (ج.م)
                    </Label>
                    <Input
                      id="priceOnline"
                      type="number"
                      min="0"
                      value={customPriceOnline}
                      onChange={(e) => setCustomPriceOnline(Number(e.target.value) || 0)}
                      placeholder={String(defaultPriceOnline)}
                      className="text-center"
                    />
                  </div>
                </div>
              )}

              {!useCustomPrices && (
                <p className="text-xs text-muted-foreground">
                  السعر الافتراضي: حضوري {defaultPriceOnsite} ج.م | أونلاين {defaultPriceOnline} ج.م
                </p>
              )}
            </div>

            {/* Duration Picker */}
            <DurationPicker
              startTime={sessionTime || '00:00'}
              duration={sessionDuration}
              onDurationChange={setSessionDuration}
              showEndTime={!!sessionTime && !!sessionDuration}
              placeholder="اختر المدة"
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
                      يتعارض وقت {formatTimeAr(sessionTime)} مع: {conflictSummary.conflictingStudents.slice(0, 3).join('، ')}
                      {conflictSummary.conflictingStudents.length > 3 && ` (+${conflictSummary.conflictingStudents.length - 3})`}
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
                      فاصل أقل من 30 دقيقة مع: {conflictSummary.conflictingStudents.slice(0, 3).join('، ')}
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

            <div className="space-y-3">
              <Label>جدول الحصص الأسبوعي</Label>
              <p className="text-xs text-muted-foreground">اختر أيام الحصص وحدد الوقت لكل يوم</p>

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

              {/* Day Selection with Per-Day Time and Smart Suggestions */}
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
                        {/* Day checkbox */}
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

                        {/* Time input - only show when day is selected */}
                        {isSelected && (
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <Input
                              type="time"
                              value={schedule.time}
                              onChange={(e) => updateDayTime(index, e.target.value)}
                              className="w-32"
                              placeholder="الوقت"
                            />
                            {schedule.time && (
                              <span className="text-xs text-muted-foreground">
                                {formatTimeAr(schedule.time)}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Suggested time slots dropdown - show when day is selected but no time set */}
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
                                    ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-300 dark:hover:bg-emerald-900/70"
                                    : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                                )}
                                title={slot.reason}
                              >
                                <Clock className="h-3 w-3" />
                                {slot.timeAr}
                              </button>
                            ))}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {daySuggestion.suggestedTimeSlots[0]?.reason}
                          </p>
                        </div>
                      )}

                      {/* Travel time consideration warning */}
                      {isSelected && daySuggestion?.travelConsideration && (
                        <div className="mr-8 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                          <Car className="h-3 w-3" />
                          {daySuggestion.travelConsideration}
                        </div>
                      )}

                      {/* Consecutive sessions warning */}
                      {isSelected && daySuggestion?.consecutiveWarning && (
                        <div className="mr-8 flex items-center gap-1.5 text-xs text-orange-600 dark:text-orange-400">
                          <AlertTriangle className="h-3 w-3" />
                          {daySuggestion.consecutiveWarning}
                        </div>
                      )}

                      {/* Energy tip */}
                      {isSelected && daySuggestion?.energyTip && (
                        <div className="mr-8 flex items-center gap-1.5 text-xs text-purple-600 dark:text-purple-400">
                          <Sparkles className="h-3 w-3" />
                          {daySuggestion.energyTip}
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
                  {!daySchedules.every(d => d.time) && (
                    <p className="text-xs text-amber-600 mt-2">⚠️ يرجى تحديد الوقت لجميع الأيام</p>
                  )}
                </div>
              )}
            </div>

            {/* Student Materials Section */}
            <StudentMaterialsSection
              materials={materials}
              onMaterialsChange={setMaterials}
            />

            <Collapsible open={showCustomDates} onOpenChange={setShowCustomDates}>
              <CollapsibleTrigger asChild>
                <Button type="button" variant="ghost" className="w-full justify-between text-muted-foreground">
                  تواريخ الفصل الدراسي (اختياري)
                  {showCustomDates ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 pt-2">
                <p className="text-xs text-muted-foreground">حدد بداية ونهاية الفصل الدراسي للطالب</p>
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
            </form>
          </DialogBody>

          <DialogFooter className="flex-col sm:flex-row-reverse gap-2 pt-2">
            <Button
              type="submit" 
              onClick={handleSubmit}
              className="w-full sm:flex-1 gradient-primary"
              disabled={!name.trim() || daySchedules.length === 0 || !daySchedules.every(d => d.time) || !sessionDuration || !sessionType || conflictSummary.hasErrors || isChecking}
            >
              {isChecking ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin ml-2" />
                  جاري التحقق...
                </>
              ) : (
                'إضافة الطالب'
              )}
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} className="w-full sm:flex-1">
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
                الطلاب المتأثرون: {conflictSummary.conflictingStudents.join('، ')}
              </p>
              <p className="text-muted-foreground text-sm">
                قد لا يكون لديك وقت كافٍ للتحضير أو الراحة بين الحصص.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction 
              onClick={proceedWithAdd}
              className="bg-amber-500 hover:bg-amber-600"
            >
              نعم، أضف الطالب
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
