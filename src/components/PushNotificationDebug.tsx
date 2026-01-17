// Push Notification Debug Component
// Helps diagnose issues with background push notifications

import { useState } from "react";
import { Bell, Check, X, AlertTriangle, RefreshCw, Bug, Clock, Send, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

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
  const [isSending, setIsSending] = useState(false);

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
      name: "FCM Token",
      status: localToken ? "pass" : "fail",
      message: localToken
        ? `موجود: ${localToken.substring(0, 15)}...`
        : "غير موجود - فعّل الإشعارات",
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
                ? `محفوظ ونشط (${data.length} جهاز)`
                : `Token مختلف`,
            });
          } else {
            results.push({
              name: "Token في قاعدة البيانات",
              status: "fail",
              message: "غير موجود!",
            });
          }
        }
      } catch (e) {
        results.push({
          name: "Token في قاعدة البيانات",
          status: "fail",
          message: "فشل التحقق",
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
          ? `مُسجل: ${user.user.id.substring(0, 8)}...`
          : "غير مسجل",
      });
    } catch (e) {
      results.push({
        name: "المستخدم",
        status: "fail",
        message: "فشل التحقق",
      });
    }

    setDiagnostics(results);
    setIsRunning(false);
  };

  // Test push notification manually
  const testPushNotification = async () => {
    setIsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-push-notification", {
        body: {
          title: "🔔 اختبار الإشعارات",
          body: "إذا ظهر هذا الإشعار، فالنظام يعمل! " + new Date().toLocaleTimeString('ar-EG'),
          priority: 100,
          suggestionType: "test",
          actionType: "test",
        },
      });

      if (error) {
        alert(`❌ خطأ: ${error.message}`);
      } else {
        const sent = data?.sent || 0;
        const failed = (data?.results || []).filter((r: { success: boolean }) => !r.success).length;

        if (sent > 0) {
          alert(
            `✅ تم الإرسال بنجاح!\n\n` +
            `• أجهزة نجحت: ${sent}\n` +
            `• أجهزة فشلت: ${failed}\n\n` +
            `إذا لم تظهر الإشعارات:\n` +
            `1. تأكد أن إشعارات المتصفح مفعلة\n` +
            `2. تأكد أن الهاتف ليس في وضع "عدم الإزعاج"\n` +
            `3. جرب إغلاق التطبيق والانتظار`
          );
        } else {
          alert(
            `⚠️ لم يتم الإرسال!\n\n` +
            `لا توجد أجهزة مسجلة.\n` +
            `جرب الضغط على "تحديث Token" أولاً.`
          );
        }
      }
    } catch (e) {
      alert(`❌ فشل: ${e}`);
    } finally {
      setIsSending(false);
    }
  };

  // Test with delayed notification (gives you time to close the app)
  const testDelayedNotification = async () => {
    // First, show countdown alert
    const confirmed = window.confirm(
      "سيتم إرسال الإشعار فوراً.\n\n" +
      "1️⃣ اضغط OK\n" +
      "2️⃣ أغلق التطبيق فوراً (خلال 3 ثواني)\n" +
      "3️⃣ انتظر الإشعار\n\n" +
      "هل أنت جاهز؟"
    );

    if (!confirmed) return;

    // Send immediately - user should close app right after
    try {
      await supabase.functions.invoke("send-push-notification", {
        body: {
          title: "🔔 اختبار الخلفية",
          body: "إذا ظهر هذا وأنت خارج التطبيق، فالإشعارات تعمل! ✅ " + new Date().toLocaleTimeString('ar-EG'),
          priority: 100,
          suggestionType: "test",
          actionType: "test",
        },
      });
      console.log("Notification sent - close app NOW!");
    } catch (e) {
      console.error("Failed:", e);
    }
  };

  // Refresh FCM token
  const refreshToken = async () => {
    try {
      localStorage.removeItem("fcm_token");
      const success = await enableNotifications();
      if (success) {
        alert("تم تحديث Token!");
        runDiagnostics();
      } else {
        alert("فشل التحديث");
      }
    } catch (e) {
      alert(`فشل: ${e}`);
    }
  };

  // Trigger check-critical-alerts manually
  const triggerCronJob = async () => {
    setCronJobStatus("جاري...");
    try {
      const { data, error } = await supabase.functions.invoke("check-critical-alerts");
      if (error) {
        setCronJobStatus(`خطأ: ${error.message}`);
      } else {
        setCronJobStatus(`✓ ${data?.sent || 0}/${data?.alerts || 0} إشعار`);
      }
    } catch (e) {
      setCronJobStatus(`فشل`);
    }
  };

  const getStatusIcon = (status: DiagnosticResult["status"]) => {
    switch (status) {
      case "pass":
        return <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />;
      case "fail":
        return <X className="h-3.5 w-3.5 text-red-500 shrink-0" />;
      case "warning":
        return <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />;
      default:
        return <RefreshCw className="h-3.5 w-3.5 animate-spin shrink-0" />;
    }
  };

  const getStatusColor = (status: DiagnosticResult["status"]) => {
    switch (status) {
      case "pass":
        return "bg-green-500/10 border-green-500/30";
      case "fail":
        return "bg-red-500/10 border-red-500/30";
      case "warning":
        return "bg-amber-500/10 border-amber-500/30";
      default:
        return "bg-muted";
    }
  };

  // Floating button when closed
  if (!isOpen) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="fixed bottom-20 left-3 z-50 gap-1.5 h-9 px-3 text-xs shadow-lg bg-background/95 backdrop-blur"
        onClick={() => {
          setIsOpen(true);
          runDiagnostics();
        }}
      >
        <Bug className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">تشخيص الإشعارات</span>
        <span className="sm:hidden">تشخيص</span>
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center">
      <Card
        className="w-full sm:max-w-md max-h-[85vh] sm:max-h-[80vh] overflow-hidden rounded-t-2xl sm:rounded-2xl sm:m-4 animate-in slide-in-from-bottom duration-300"
        dir="rtl"
      >
        {/* Header */}
        <CardHeader className="pb-2 pt-3 px-4 border-b bg-muted/30">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Bug className="h-4 w-4" />
              تشخيص الإشعارات
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 -ml-2"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 60px)' }}>
          {/* Diagnostics List */}
          <div className="p-3 space-y-1.5">
            {diagnostics.map((d, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-center gap-2 p-2 rounded-lg border",
                  getStatusColor(d.status)
                )}
              >
                {getStatusIcon(d.status)}
                <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                  <span className="text-xs font-medium truncate">{d.name}</span>
                  <span className="text-[10px] text-muted-foreground truncate max-w-[45%] text-left">
                    {d.message}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="p-3 pt-0 space-y-2 border-t bg-muted/20">
            {/* Primary Actions Row */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-9 text-xs gap-1.5"
                onClick={runDiagnostics}
                disabled={isRunning}
              >
                <RefreshCw className={cn("h-3.5 w-3.5", isRunning && "animate-spin")} />
                إعادة الفحص
              </Button>

              {!isEnabled && permission !== "denied" ? (
                <Button
                  size="sm"
                  className="h-9 text-xs gap-1.5"
                  onClick={enableNotifications}
                >
                  <Bell className="h-3.5 w-3.5" />
                  تفعيل
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-9 text-xs gap-1.5"
                  onClick={refreshToken}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  تحديث Token
                </Button>
              )}
            </div>

            {/* Test Notifications */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-9 text-xs gap-1.5"
                onClick={testPushNotification}
                disabled={isSending}
              >
                <Send className={cn("h-3.5 w-3.5", isSending && "animate-pulse")} />
                إشعار فوري
              </Button>

              <Button
                size="sm"
                variant="outline"
                className="h-9 text-xs gap-1.5 text-amber-600 border-amber-300 hover:bg-amber-50"
                onClick={testDelayedNotification}
              >
                <Clock className="h-3.5 w-3.5" />
                اختبار الخلفية
              </Button>
            </div>

            {/* Cron Job Button */}
            <Button
              size="sm"
              variant="outline"
              className="w-full h-9 text-xs gap-1.5"
              onClick={triggerCronJob}
            >
              <Zap className="h-3.5 w-3.5" />
              فحص التنبيهات يدوياً
            </Button>

            {/* Cron Job Status */}
            {cronJobStatus !== "unknown" && (
              <div className="text-[10px] text-center text-muted-foreground bg-muted/50 rounded-lg py-1.5 px-2">
                {cronJobStatus}
              </div>
            )}

            {/* Help Text */}
            <p className="text-[10px] text-center text-muted-foreground pt-1">
              اضغط "اختبار الخلفية" ثم أغلق التطبيق فوراً لاختبار الإشعارات
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
