import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { UserPlus, ChevronDown, ChevronUp, Clock, Monitor, MapPin, Phone } from 'lucide-react';
import { DAY_NAMES, SessionType } from '@/types/student';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface AddStudentDialogProps {
  onAdd: (name: string, scheduleDays: number[], sessionTime: string, sessionType: SessionType, phone?: string, customStart?: string, customEnd?: string) => void;
  defaultStart: string;
  defaultEnd: string;
}

export const AddStudentDialog = ({ onAdd, defaultStart, defaultEnd }: AddStudentDialogProps) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedDays, setSelectedDays] = useState<number[]>([1]); // Monday by default
  const [sessionTime, setSessionTime] = useState('16:00');
  const [sessionType, setSessionType] = useState<SessionType>('onsite');
  const [showCustomDates, setShowCustomDates] = useState(false);
  const [customStart, setCustomStart] = useState(defaultStart);
  const [customEnd, setCustomEnd] = useState(defaultEnd);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && selectedDays.length > 0) {
      const useCustom = showCustomDates && (customStart !== defaultStart || customEnd !== defaultEnd);
      onAdd(
        name.trim(),
        selectedDays,
        sessionTime,
        sessionType,
        phone.trim() || undefined,
        useCustom ? customStart : undefined,
        useCustom ? customEnd : undefined
      );
      resetForm();
      setOpen(false);
    }
  };

  const resetForm = () => {
    setName('');
    setPhone('');
    setSelectedDays([1]);
    setSessionTime('16:00');
    setSessionType('onsite');
    setShowCustomDates(false);
    setCustomStart(defaultStart);
    setCustomEnd(defaultEnd);
  };

  const toggleDay = (day: number) => {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort()
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
      <DialogTrigger asChild>
        <Button className="gradient-primary gap-2 shadow-lg hover:shadow-xl transition-shadow">
          <UserPlus className="h-4 w-4" />
          Add Student
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Add New Student</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5 pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Student Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter student name"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone" className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5" />
                WhatsApp Number
              </Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1234567890"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="time" className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Session Time
              </Label>
              <Input
                id="time"
                type="time"
                value={sessionTime}
                onChange={(e) => setSessionTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Session Type</Label>
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
                  <span className="text-sm">On-site</span>
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
                  <span className="text-sm">Online</span>
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <Label>Session Days (Weekly)</Label>
            <div className="flex flex-wrap gap-2">
              {DAY_NAMES.map((day, index) => (
                <label
                  key={day}
                  className={`
                    flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all
                    ${selectedDays.includes(index)
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-card border-border hover:border-primary/50'
                    }
                  `}
                >
                  <Checkbox
                    checked={selectedDays.includes(index)}
                    onCheckedChange={() => toggleDay(index)}
                    className="sr-only"
                  />
                  <span className="text-sm font-medium">{day.slice(0, 3)}</span>
                </label>
              ))}
            </div>
          </div>

          <Collapsible open={showCustomDates} onOpenChange={setShowCustomDates}>
            <CollapsibleTrigger asChild>
              <Button type="button" variant="ghost" className="w-full justify-between text-muted-foreground">
                Custom semester dates
                {showCustomDates ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="customStart">Start Date</Label>
                  <Input
                    id="customStart"
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customEnd">End Date</Label>
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

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} className="flex-1">
              Cancel
            </Button>
            <Button 
              type="submit" 
              className="flex-1 gradient-primary"
              disabled={!name.trim() || selectedDays.length === 0}
            >
              Add Student
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
