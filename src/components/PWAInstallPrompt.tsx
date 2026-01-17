// PWA Install Prompt Component
// Shows a banner prompting users to install the app and enable notifications
// Handles iOS-specific "Add to Home Screen" instructions

import { useState, useEffect } from "react";
import { X, Download, Bell, Smartphone, Share } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

const DISMISS_KEY = "pwa-install-dismissed";
const DISMISS_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

export function PWAInstallPrompt() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  useEffect(() => {
    // Check if running as installed PWA
    const standalone = window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);

    // Check if iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(iOS);

    // Check if recently dismissed
    const dismissedAt = localStorage.getItem(DISMISS_KEY);
    if (dismissedAt) {
      const elapsed = Date.now() - parseInt(dismissedAt, 10);
      if (elapsed < DISMISS_DURATION) {
        return; // Don't show if recently dismissed
      }
    }

    // Listen for install prompt (Chrome, Edge, etc.)
    const handleBeforeInstall = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setInstallPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    // Show iOS instructions after a delay if not installed
    if (iOS && !standalone) {
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 5000); // Show after 5 seconds
      return () => {
        clearTimeout(timer);
        window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      };
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;

    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;

    if (outcome === "accepted") {
      setShowPrompt(false);
      setInstallPrompt(null);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
    setShowPrompt(false);
    setShowIOSInstructions(false);
  };

  // Don't show if already installed or no prompt available
  if (isStandalone || (!showPrompt && !showIOSInstructions)) {
    return null;
  }

  return (
    <>
      {/* Main Install Banner */}
      {showPrompt && !showIOSInstructions && (
        <Card
          className={cn(
            "fixed bottom-4 left-4 right-4 z-50 p-4 shadow-xl border-2",
            "animate-in slide-in-from-bottom-4 duration-300",
            "bg-gradient-to-r from-primary/10 to-primary/5 border-primary/30"
          )}
          dir="rtl"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
              <Smartphone className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-sm mb-1">تثبيت التطبيق</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {isIOS
                  ? "أضف التطبيق للشاشة الرئيسية للحصول على إشعارات حتى عند إغلاق المتصفح"
                  : "ثبّت التطبيق للحصول على إشعارات فورية حتى عند إغلاق المتصفح"}
              </p>
              <div className="flex gap-2 mt-3">
                {isIOS ? (
                  <Button
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setShowIOSInstructions(true)}
                  >
                    <Share className="h-3.5 w-3.5" />
                    كيفية التثبيت
                  </Button>
                ) : installPrompt ? (
                  <Button size="sm" className="gap-1.5" onClick={handleInstall}>
                    <Download className="h-3.5 w-3.5" />
                    تثبيت الآن
                  </Button>
                ) : null}
                <Button size="sm" variant="ghost" onClick={handleDismiss}>
                  لاحقاً
                </Button>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0 opacity-50 hover:opacity-100"
              onClick={handleDismiss}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      )}

      {/* iOS Instructions Modal */}
      {showIOSInstructions && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4">
          <Card
            className="w-full max-w-sm p-5 animate-in slide-in-from-bottom-4 duration-300"
            dir="rtl"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">تثبيت على iOS</h3>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleDismiss}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 font-bold text-sm">
                  1
                </div>
                <div>
                  <p className="text-sm font-medium">اضغط على زر المشاركة</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    الزر الموجود أسفل Safari <Share className="h-3 w-3 inline" />
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 font-bold text-sm">
                  2
                </div>
                <div>
                  <p className="text-sm font-medium">اختر "إضافة إلى الشاشة الرئيسية"</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    قد تحتاج للتمرير للأسفل لرؤية الخيار
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 font-bold text-sm">
                  3
                </div>
                <div>
                  <p className="text-sm font-medium">اضغط "إضافة"</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    سيظهر التطبيق على شاشتك الرئيسية
                  </p>
                </div>
              </div>

              <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3 mt-4">
                <div className="flex items-start gap-2">
                  <Bell className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800 dark:text-amber-200">
                    بعد التثبيت، ستحصل على إشعارات فورية للحصص والمدفوعات حتى عند إغلاق التطبيق
                  </p>
                </div>
              </div>
            </div>

            <Button className="w-full mt-4" onClick={handleDismiss}>
              فهمت
            </Button>
          </Card>
        </div>
      )}
    </>
  );
}
