import { useState, useRef, useEffect } from 'react';
import { Mic, Square, Pause, Play, Trash2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface VoiceRecorderProps {
  onSave: (audioBlob: Blob, duration: number, title?: string) => Promise<boolean>;
  onCancel: () => void;
  maxDuration?: number; // in seconds, default 300 (5 minutes)
}

export function VoiceRecorder({ onSave, onCancel, maxDuration = 300 }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [hasRecording, setHasRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [title, setTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm',
      });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        setHasRecording(true);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(1000);
      setIsRecording(true);
      setIsPaused(false);
      setPermissionDenied(false);

      timerRef.current = setInterval(() => {
        setDuration(prev => {
          if (prev >= maxDuration - 1) {
            stopRecording();
            return maxDuration;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      setPermissionDenied(true);
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      timerRef.current = setInterval(() => {
        setDuration(prev => {
          if (prev >= maxDuration - 1) {
            stopRecording();
            return maxDuration;
          }
          return prev + 1;
        });
      }, 1000);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const handleDiscard = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioUrl(null);
    setAudioBlob(null);
    setHasRecording(false);
    setDuration(0);
    setTitle('');
  };

  const handleSave = async () => {
    if (!audioBlob) return;
    setIsSaving(true);
    const success = await onSave(audioBlob, duration, title || undefined);
    setIsSaving(false);
    if (success) {
      handleDiscard();
      onCancel();
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (permissionDenied) {
    return (
      <div className="text-center p-4 space-y-3">
        <div className="text-destructive text-sm">
          ❌ لا يمكن الوصول للميكروفون
        </div>
        <p className="text-xs text-muted-foreground">
          الرجاء السماح بالوصول للميكروفون من إعدادات المتصفح
        </p>
        <Button variant="outline" size="sm" onClick={startRecording}>
          إعادة المحاولة
        </Button>
      </div>
    );
  }

  if (hasRecording && audioUrl) {
    return (
      <div className="space-y-4 p-4">
        <div className="text-center space-y-2">
          <p className="text-sm font-medium">معاينة التسجيل</p>
          <p className="text-xs text-muted-foreground">
            المدة: {formatDuration(duration)} | الحجم: {audioBlob ? (audioBlob.size / 1024).toFixed(1) : 0} KB
          </p>
        </div>

        <audio ref={audioRef} src={audioUrl} controls className="w-full" />

        <div className="space-y-2">
          <Label htmlFor="voice-title">العنوان (اختياري)</Label>
          <Input
            id="voice-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="عنوان التسجيل..."
            className="text-right"
          />
        </div>

        <div className="flex justify-between gap-2">
          <Button variant="destructive" size="sm" onClick={handleDiscard} className="gap-1">
            <Trash2 className="h-4 w-4" />
            حذف
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isSaving} className="gap-1">
            <Save className="h-4 w-4" />
            {isSaving ? 'جاري الحفظ...' : 'حفظ'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <div className="text-center space-y-4">
        {isRecording && (
          <div className={cn(
            "inline-flex items-center gap-2 px-4 py-2 rounded-full",
            isPaused ? "bg-warning/20 text-warning" : "bg-destructive/20 text-destructive"
          )}>
            <span className={cn(
              "w-3 h-3 rounded-full",
              isPaused ? "bg-warning" : "bg-destructive animate-pulse"
            )} />
            {isPaused ? 'متوقف مؤقتاً' : 'جاري التسجيل'}
          </div>
        )}

        <p className="text-3xl font-mono font-bold">
          {formatDuration(duration)}
        </p>

        {duration >= maxDuration - 30 && (
          <p className="text-xs text-warning">
            ⚠️ الحد الأقصى: {formatDuration(maxDuration)}
          </p>
        )}

        {/* Waveform animation placeholder */}
        {isRecording && !isPaused && (
          <div className="flex justify-center items-center gap-1 h-8">
            {[...Array(20)].map((_, i) => (
              <div
                key={i}
                className="w-1 bg-primary rounded-full animate-pulse"
                style={{
                  height: `${Math.random() * 24 + 8}px`,
                  animationDelay: `${i * 0.05}s`,
                }}
              />
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-center gap-2">
        {!isRecording ? (
          <Button onClick={startRecording} className="gap-2">
            <Mic className="h-5 w-5" />
            بدء التسجيل
          </Button>
        ) : (
          <>
            {isPaused ? (
              <Button variant="outline" onClick={resumeRecording} className="gap-2">
                <Play className="h-5 w-5" />
                استئناف
              </Button>
            ) : (
              <Button variant="outline" onClick={pauseRecording} className="gap-2">
                <Pause className="h-5 w-5" />
                إيقاف مؤقت
              </Button>
            )}
            <Button variant="destructive" onClick={stopRecording} className="gap-2">
              <Square className="h-5 w-5" />
              إيقاف
            </Button>
          </>
        )}
      </div>

      {!isRecording && (
        <Button variant="ghost" size="sm" onClick={onCancel} className="w-full">
          إلغاء
        </Button>
      )}
    </div>
  );
}
