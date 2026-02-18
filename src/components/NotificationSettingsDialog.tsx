import { useState, useEffect } from 'react';
import { Bell, Volume2, VolumeX, Clock, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { PushNotificationSettings } from '@/components/PushNotificationSettings';

interface NotificationSettingsDialogProps {
  settings: {
    enabled: boolean;
    minutesBefore: number;
    soundEnabled: boolean;
  };
  onSave: (settings: {
    enabled: boolean;
    minutesBefore: number;
    soundEnabled: boolean;
  }) => void;
}

const MINUTES_OPTIONS = [
  { value: 15, label: '15 دقيقة' },
  { value: 30, label: '30 دقيقة' },
  { value: 45, label: '45 دقيقة' },
  { value: 60, label: 'ساعة واحدة' },
  { value: 90, label: 'ساعة ونصف' },
  { value: 120, label: 'ساعتين' },
];

export function NotificationSettingsDialog({ settings, onSave }: NotificationSettingsDialogProps) {
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(settings.enabled);
  const [minutesBefore, setMinutesBefore] = useState(settings.minutesBefore);
  const [soundEnabled, setSoundEnabled] = useState(settings.soundEnabled);
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if ('Notification' in window) {
      setBrowserPermission(Notification.permission);
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      setEnabled(settings.enabled);
      setMinutesBefore(settings.minutesBefore);
      setSoundEnabled(settings.soundEnabled);
    }
  }, [open, settings]);

  const handleRequestPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      setBrowserPermission(permission);
      if (permission === 'granted') {
        toast({
          title: '✓ تم التفعيل',
          description: 'سيتم إرسال إشعارات المتصفح',
        });
      }
    }
  };

  const handleSave = () => {
    onSave({
      enabled,
      minutesBefore,
      soundEnabled,
    });
    setOpen(false);
    toast({
      title: '✓ تم الحفظ',
      description: 'تم حفظ إعدادات الإشعارات',
    });
  };

  const handleTestNotification = async () => {
    // Play sound
    if (soundEnabled) {
      try {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const audioContext = new AudioContextClass();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
      } catch (e) {
        console.log('Could not play sound:', e);
      }
    }

    // Browser notification - use service worker for mobile compatibility
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        // Try service worker first (mobile compatible)
        if ('serviceWorker' in navigator) {
          const registration = await navigator.serviceWorker.ready;
          await registration.showNotification('🔔 إشعار تجريبي', {
            body: 'هذا إشعار تجريبي - الإشعارات تعمل بشكل صحيح!',
            icon: '/favicon.ico',
            dir: 'rtl',
            lang: 'ar',
          });
        } else {
          // Fallback for desktop - may not work on mobile
          try {
            new Notification('🔔 إشعار تجريبي', {
              body: 'هذا إشعار تجريبي - الإشعارات تعمل بشكل صحيح!',
              icon: '/favicon.ico',
            });
          } catch (e) {
            console.log('Direct notification not supported');
          }
        }
      } catch (error) {
        console.warn('Could not show notification:', error);
      }
    }

    toast({
      title: '🔔 إشعار تجريبي',
      description: 'تم إرسال إشعار تجريبي',
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="relative w-full justify-start gap-2">
          <Bell className="h-4 w-4 shrink-0" />
          <span>الإشعارات</span>
          {enabled && (
            <span className="absolute top-1 right-1 w-2 h-2 bg-green-500 rounded-full" />
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-heading">
            <Bell className="h-5 w-5" />
            إعدادات الإشعارات
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-6 py-4">
          {/* Enable Notifications */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base font-medium">تفعيل الإشعارات</Label>
              <p className="text-sm text-muted-foreground">
                إشعارات قبل بداية الحصص
              </p>
            </div>
            <Switch
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>

          <Separator />

          {/* Minutes Before */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              وقت الإشعار قبل الحصة
            </Label>
            <Select
              value={String(minutesBefore)}
              onValueChange={(v) => setMinutesBefore(Number(v))}
              disabled={!enabled}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MINUTES_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={String(opt.value)}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Sound */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {soundEnabled ? (
                <Volume2 className="h-4 w-4 text-green-600" />
              ) : (
                <VolumeX className="h-4 w-4 text-muted-foreground" />
              )}
              <Label>صوت الإشعار</Label>
            </div>
            <Switch
              checked={soundEnabled}
              onCheckedChange={setSoundEnabled}
              disabled={!enabled}
            />
          </div>

          <Separator />

          {/* Browser Notifications */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4" />
                <Label>إشعارات المتصفح</Label>
              </div>
              <Badge
                variant={browserPermission === 'granted' ? 'default' : 'secondary'}
                className={browserPermission === 'granted' ? 'bg-green-500' : ''}
              >
                {browserPermission === 'granted' && 'مفعّل'}
                {browserPermission === 'denied' && 'مرفوض'}
                {browserPermission === 'default' && 'غير مفعّل'}
              </Badge>
            </div>
            {browserPermission !== 'granted' && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRequestPermission}
                disabled={browserPermission === 'denied'}
                className="w-full"
              >
                {browserPermission === 'denied'
                  ? 'تم رفض الإذن - فعّله من إعدادات المتصفح'
                  : 'تفعيل إشعارات المتصفح'
                }
              </Button>
            )}
          </div>

          <Separator />

          {/* Background Push Notifications */}
          <PushNotificationSettings />

          <Separator />

          {/* Test Button */}
          <Button
            variant="outline"
            onClick={handleTestNotification}
            disabled={!enabled}
            className="w-full gap-2"
          >
            <Bell className="h-4 w-4" />
            اختبار الإشعارات
          </Button>
        </div>

        <DialogFooter className="flex-col sm:flex-row-reverse gap-2">
          <Button onClick={handleSave} className="w-full sm:w-auto">
            حفظ
          </Button>
          <Button variant="outline" onClick={() => setOpen(false)} className="w-full sm:w-auto">
            إلغاء
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
