// Push Notification Debug Component
// Helps diagnose issues with background push notifications

import { useState } from "react";
import { Bell, Check, X, AlertTriangle, RefreshCw, Bug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { supabase } from "@/integrations/supabase/client";

interface DiagnosticResult {
  name: string;
  status: "pass" | "fail" | "warning" | "pending";
  message: string;
}

export function PushNotificationDebug() {
  const [isOpen, setIsOpen] = useState(false);
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [cronJobStatus, setCronJobStatus] = useState<string>("unknown");

  const {
    isSupported,
    isEnabled,
    isConfigured,
    permission,
    token,
    enableNotifications,
  } = usePushNotifications();

  const runDiagnostics = async () => {
    setIsRunning(true);
    const results: DiagnosticResult[] = [];

    // 1. Check browser support
    results.push({
      name: "دعم المتصفح",
      status: isSupported ? "pass" : "fail",
      message: isSupported
        ? "المتصفح يدعم الإشعارات"
        : "المتصفح لا يدعم الإشعارات",
    });

    // 2. Check Firebase configuration
    results.push({
      name: "إعدادات Firebase",
      status: isConfigured ? "pass" : "fail",
      message: isConfigured
        ? "Firebase مُهيأ بشكل صحيح"
        : "Firebase غير مُهيأ",
    });

    // 3. Check notification permission
    results.push({
      name: "صلاحية الإشعارات",
      status: permission === "granted" ? "pass" : permission === "denied" ? "fail" : "warning",
      message:
        permission === "granted"
          ? "تم السماح بالإشعارات"
          : permission === "denied"
          ? "تم رفض الإشعارات - يجب تفعيلها من إعدادات المتصفح"
          : "لم يتم طلب الصلاحية بعد",
    });

    // 4. Check Service Worker
    let swRegistered = false;
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      const fcmSw = registrations.find((r) =>
        r.active?.scriptURL.includes("firebase-messaging-sw.js")
      );
      swRegistered = !!fcmSw;
      results.push({
        name: "Service Worker",
        status: swRegistered ? "pass" : "fail",
        message: swRegistered
          ? "Service Worker مُسجل ونشط"
          : "Service Worker غير مُسجل",
      });
    } catch (e) {
      results.push({
        name: "Service Worker",
        status: "fail",
        message: "فشل في التحقق من Service Worker",
      });
    }

    // 5. Check FCM token
    const localToken = token || localStorage.getItem("fcm_token");
    results.push({
      name: "FCM Token محلي",
      status: localToken ? "pass" : "fail",
      message: localToken
        ? `Token موجود: ${localToken.substring(0, 20)}...`
        : "لا يوجد Token - يجب تفعيل الإشعارات",
    });

    // 6. Check if token is in database
    if (localToken) {
      try {
        const { data: user } = await supabase.auth.getUser();
        if (user?.user?.id) {
          const { data, error } = await supabase
            .from("push_subscriptions")
            .select("*")
            .eq("user_id", user.user.id)
            .eq("is_active", true);

          if (error) {
            results.push({
              name: "Token في قاعدة البيانات",
              status: "fail",
              message: `خطأ: ${error.message}`,
            });
          } else if (data && data.length > 0) {
            const tokenMatches = data.some((d) => d.fcm_token === localToken);
            results.push({
              name: "Token في قاعدة البيانات",
              status: tokenMatches ? "pass" : "warning",
              message: tokenMatches
                ? `Token محفوظ ونشط (${data.length} جهاز)`
                : `Token مختلف في قاعدة البيانات`,
            });
          } else {
            results.push({
              name: "Token في قاعدة البيانات",
              status: "fail",
              message: "Token غير موجود في قاعدة البيانات!",
            });
          }
        }
      } catch (e) {
        results.push({
          name: "Token في قاعدة البيانات",
          status: "fail",
          message: "فشل في التحقق من قاعدة البيانات",
        });
      }
    }

    // 7. Check user authentication
    try {
      const { data: user } = await supabase.auth.getUser();
      results.push({
        name: "المستخدم",
        status: user?.user?.id ? "pass" : "fail",
        message: user?.user?.id
          ? `مُسجل دخول: ${user.user.id.substring(0, 8)}...`
          : "غير مسجل دخول",
      });
    } catch (e) {
      results.push({
        name: "المستخدم",
        status: "fail",
        message: "فشل في التحقق من المستخدم",
      });
    }

    setDiagnostics(results);
    setIsRunning(false);
  };

  // Test push notification manually
  const testPushNotification = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("send-push-notification", {
        body: {
          title: "🔔 اختبار الإشعارات",
          body: "إذا ظهر هذا الإشعار، فالنظام يعمل بشكل صحيح!",
          priority: 100,
          suggestionType: "test",
          actionType: "test",
        },
      });

      if (error) {
        alert(`خطأ: ${error.message}`);
      } else {
        alert(`تم إرسال الإشعار! النتيجة: ${JSON.stringify(data)}`);
      }
    } catch (e) {
      alert(`فشل: ${e}`);
    }
  };

  // Refresh FCM token
  const refreshToken = async () => {
    try {
      // Clear existing token
      const oldToken = localStorage.getItem("fcm_token");
      if (oldToken) {
        localStorage.removeItem("fcm_token");
      }

      // Re-enable notifications (will get fresh token)
      const success = await enableNotifications();
      if (success) {
        alert("تم تحديث Token بنجاح! أعد التشخيص للتأكد.");
        runDiagnostics();
      } else {
        alert("فشل في تحديث Token");
      }
    } catch (e) {
      alert(`فشل: ${e}`);
    }
  };

  // Trigger check-critical-alerts manually
  const triggerCronJob = async () => {
    try {
      setCronJobStatus("جاري التشغيل...");
      const { data, error } = await supabase.functions.invoke("check-critical-alerts");

      if (error) {
        setCronJobStatus(`خطأ: ${error.message}`);
      } else {
        setCronJobStatus(`نجح! تم إرسال ${data?.sent || 0} إشعارات من ${data?.alerts || 0} تنبيه`);
      }
    } catch (e) {
      setCronJobStatus(`فشل: ${e}`);
    }
  };

  const getStatusIcon = (status: DiagnosticResult["status"]) => {
    switch (status) {
      case "pass":
        return <Check className="h-4 w-4 text-green-500" />;
      case "fail":
        return <X className="h-4 w-4 text-red-500" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      default:
        return <RefreshCw className="h-4 w-4 animate-spin" />;
    }
  };

  const getStatusBadge = (status: DiagnosticResult["status"]) => {
    switch (status) {
      case "pass":
        return <Badge className="bg-green-500">نجح</Badge>;
      case "fail":
        return <Badge variant="destructive">فشل</Badge>;
      case "warning":
        return <Badge className="bg-amber-500">تحذير</Badge>;
      default:
        return <Badge variant="secondary">جاري...</Badge>;
    }
  };

  if (!isOpen) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="fixed bottom-20 left-4 z-50 gap-2"
        onClick={() => {
          setIsOpen(true);
          runDiagnostics();
        }}
      >
        <Bug className="h-4 w-4" />
        تشخيص الإشعارات
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md max-h-[80vh] overflow-hidden" dir="rtl">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Bug className="h-5 w-5" />
              تشخيص الإشعارات
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 overflow-y-auto max-h-[60vh]">
          {/* Diagnostics List */}
          <div className="space-y-2">
            {diagnostics.map((d, i) => (
              <div
                key={i}
                className="flex items-start gap-2 p-2 rounded-lg bg-muted/50"
              >
                {getStatusIcon(d.status)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{d.name}</span>
                    {getStatusBadge(d.status)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 break-all">
                    {d.message}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-2 border-t">
            <Button
              className="w-full"
              onClick={runDiagnostics}
              disabled={isRunning}
            >
              <RefreshCw className={`h-4 w-4 ml-2 ${isRunning ? "animate-spin" : ""}`} />
              إعادة التشخيص
            </Button>

            {!isEnabled && permission !== "denied" && (
              <Button
                className="w-full"
                variant="secondary"
                onClick={enableNotifications}
              >
                <Bell className="h-4 w-4 ml-2" />
                تفعيل الإشعارات
              </Button>
            )}

            {isEnabled && (
              <Button
                className="w-full"
                variant="secondary"
                onClick={refreshToken}
              >
                <RefreshCw className="h-4 w-4 ml-2" />
                تحديث Token
              </Button>
            )}

            <Button
              className="w-full"
              variant="outline"
              onClick={testPushNotification}
            >
              إرسال إشعار تجريبي
            </Button>

            <Button
              className="w-full"
              variant="outline"
              onClick={triggerCronJob}
            >
              تشغيل فحص التنبيهات يدوياً
            </Button>

            {cronJobStatus !== "unknown" && (
              <p className="text-xs text-muted-foreground bg-muted p-2 rounded break-all">
                {cronJobStatus}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
