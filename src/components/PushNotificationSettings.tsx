// Push Notification Settings Component
// Allows users to enable/disable background push notifications

import { Bell, BellOff, Smartphone, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { usePushNotifications } from "@/hooks/usePushNotifications";

export function PushNotificationSettings() {
  const {
    isSupported,
    isEnabled,
    isConfigured,
    permission,
    enableNotifications,
    disableNotifications
  } = usePushNotifications();

  if (!isSupported) {
    return (
      <Card className="border-dashed">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BellOff className="h-4 w-4 text-muted-foreground" />
            إشعارات الخلفية
          </CardTitle>
          <CardDescription>
            غير مدعوم في هذا المتصفح
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!isConfigured) {
    return (
      <Card className="border-dashed border-yellow-300">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            إشعارات الخلفية
          </CardTitle>
          <CardDescription>
            يتطلب إعداد Firebase
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg bg-yellow-50 p-3 text-xs text-yellow-800 space-y-2">
            <p className="font-medium">إعدادات Firebase مفقودة</p>
            <p>يرجى إضافة المتغيرات التالية في Lovable Secrets:</p>
            <ul className="list-disc list-inside mr-2 space-y-1 font-mono text-[10px]">
              <li>VITE_FIREBASE_API_KEY</li>
              <li>VITE_FIREBASE_MESSAGING_SENDER_ID</li>
              <li>VITE_FIREBASE_APP_ID</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Smartphone className="h-4 w-4" />
          إشعارات الخلفية
          {isEnabled && (
            <Badge variant="secondary" className="bg-green-100 text-green-700">
              مفعّل
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          استلم إشعارات حتى عند إغلاق التطبيق
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label htmlFor="push-enabled" className="text-sm font-medium">
              تفعيل الإشعارات
            </Label>
            <p className="text-xs text-muted-foreground">
              {isEnabled
                ? "سيتم إرسال تنبيهات أولوية ١٠٠ حتى عند إغلاق المتصفح"
                : "لن تصلك إشعارات عند إغلاق التطبيق"
              }
            </p>
          </div>
          <Switch
            id="push-enabled"
            checked={isEnabled}
            onCheckedChange={(checked) => {
              if (checked) {
                enableNotifications();
              } else {
                disableNotifications();
              }
            }}
          />
        </div>

        {permission === "denied" && (
          <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            <p className="font-medium">تم حظر الإشعارات</p>
            <p className="text-xs mt-1">
              يرجى السماح بالإشعارات من إعدادات المتصفح
            </p>
          </div>
        )}

        <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">التنبيهات المدعومة:</p>
          <ul className="list-disc list-inside space-y-0.5 mr-2">
            <li>حصة انتهت ومحتاجة تأكيد</li>
            <li>تذكير قبل الحصة بـ ٣٠ دقيقة</li>
            <li>دفع متأخر أكثر من ٣٠ يوم</li>
          </ul>
        </div>

        {!isEnabled && permission !== "denied" && (
          <Button
            onClick={enableNotifications}
            className="w-full"
            variant="outline"
          >
            <Bell className="h-4 w-4 ml-2" />
            تفعيل الإشعارات الآن
          </Button>
        )}

        {isEnabled && (
          <Button
            onClick={async () => {
              try {
                const response = await fetch(
                  'https://jguiqcroufwbxamfymnj.supabase.co/functions/v1/send-push-notification',
                  {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpndWlxY3JvdWZ3YnhhbWZ5bW5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzYyNDcyMDUsImV4cCI6MjA1MTgyMzIwNX0.SiM9Ebv5R-G9ORZgInf9VpPVz1h5ZmEoOV0IjhKzq-s'
                    },
                    body: JSON.stringify({
                      title: '🔔 اختبار الإشعارات',
                      body: 'تم تفعيل إشعارات الخلفية بنجاح! ستصلك تنبيهات حتى عند إغلاق التطبيق.',
                      priority: 100
                    })
                  }
                );
                const result = await response.json();
                console.log('Test notification result:', result);
              } catch (error) {
                console.error('Error sending test notification:', error);
              }
            }}
            className="w-full"
            variant="secondary"
          >
            <Bell className="h-4 w-4 ml-2" />
            إرسال إشعار تجريبي
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

