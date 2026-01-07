import { useState } from 'react';
import { Edit2, Phone, Clock, Monitor, MapPin, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Student, SessionType } from '@/types/student';
import { DAY_NAMES_AR } from '@/lib/arabicConstants';

interface EditStudentDialogProps {
  student: Student;
  onUpdateName: (name: string) => void;
  onUpdateTime: (time: string) => void;
  onUpdatePhone: (phone: string) => void;
  onUpdateSessionType: (type: SessionType) => void;
  onUpdateSchedule: (days: number[], start?: string, end?: string) => void;
}

export const EditStudentDialog = ({
  student,
  onUpdateName,
  onUpdateTime,
  onUpdatePhone,
  onUpdateSessionType,
  onUpdateSchedule,
}: EditStudentDialogProps) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(student.name);
  const [phone, setPhone] = useState(student.phone || '');
  const [sessionTime, setSessionTime] = useState(student.sessionTime || '16:00');
  const [sessionType, setSessionType] = useState<SessionType>(student.sessionType || 'onsite');
  const [selectedDays, setSelectedDays] = useState<number[]>(
    student.scheduleDays.map(d => d.dayOfWeek)
  );

  const handleSave = () => {
    if (name.trim() !== student.name) {
      onUpdateName(name.trim());
    }
    if (phone !== (student.phone || '')) {
      onUpdatePhone(phone);
    }
    if (sessionTime !== student.sessionTime) {
      onUpdateTime(sessionTime);
    }
    if (sessionType !== student.sessionType) {
      onUpdateSessionType(sessionType);
    }
    
    const currentDays = student.scheduleDays.map(d => d.dayOfWeek).sort().join(',');
    const newDays = selectedDays.sort().join(',');
    if (currentDays !== newDays && selectedDays.length > 0) {
      onUpdateSchedule(selectedDays);
    }
    
    setOpen(false);
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      // Reset to current values when opening
      setName(student.name);
      setPhone(student.phone || '');
      setSessionTime(student.sessionTime || '16:00');
      setSessionType(student.sessionType || 'onsite');
      setSelectedDays(student.scheduleDays.map(d => d.dayOfWeek));
    }
    setOpen(isOpen);
  };

  const toggleDay = (day: number) => {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0">
          <Edit2 className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="font-heading">تعديل بيانات الطالب</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="edit-name">اسم الطالب</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="اسم الطالب"
            />
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label htmlFor="edit-phone" className="flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5" />
              رقم الهاتف
            </Label>
            <Input
              id="edit-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="رقم الواتساب"
              dir="ltr"
              className="text-right"
            />
          </div>

          {/* Session Time */}
          <div className="space-y-2">
            <Label htmlFor="edit-time" className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              وقت الحصة
            </Label>
            <Input
              id="edit-time"
              type="time"
              value={sessionTime}
              onChange={(e) => setSessionTime(e.target.value)}
              className="w-32"
            />
          </div>

          {/* Session Type */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              {sessionType === 'online' ? <Monitor className="h-3.5 w-3.5" /> : <MapPin className="h-3.5 w-3.5" />}
              نوع الحصة
            </Label>
            <Select value={sessionType} onValueChange={(v) => setSessionType(v as SessionType)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="onsite">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    حضوري
                  </div>
                </SelectItem>
                <SelectItem value="online">
                  <div className="flex items-center gap-2">
                    <Monitor className="h-4 w-4" />
                    أونلاين
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Schedule Days */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              أيام الحصص
            </Label>
            <div className="flex flex-wrap gap-2">
              {[0, 1, 2, 3, 4, 5, 6].map(day => (
                <label
                  key={day}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                    selectedDays.includes(day)
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-card border-border hover:border-primary/50'
                  }`}
                >
                  <Checkbox
                    checked={selectedDays.includes(day)}
                    onCheckedChange={() => toggleDay(day)}
                    className="hidden"
                  />
                  <span className="text-sm">{DAY_NAMES_AR[day]}</span>
                </label>
              ))}
            </div>
            {selectedDays.length === 0 && (
              <p className="text-xs text-destructive">يجب اختيار يوم واحد على الأقل</p>
            )}
          </div>
        </div>

        <DialogFooter className="flex-row-reverse gap-2">
          <Button onClick={handleSave} disabled={!name.trim() || selectedDays.length === 0}>
            حفظ التعديلات
          </Button>
          <Button variant="outline" onClick={() => setOpen(false)}>
            إلغاء
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
