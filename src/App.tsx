import { useEffect, useState, memo } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { GroupsProvider } from "@/hooks/useGroups";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";

const queryClient = new QueryClient();

// =====================================================
// ANIMATED BACKGROUND COMPONENT
// =====================================================
const AnimatedBackground = memo(() => {
  const isMobile = useIsMobile();

  // Simplified background for mobile - better performance
  if (isMobile) {
    return (
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(180deg, hsl(30 25% 98%) 0%, hsl(30 20% 96%) 100%)`,
          }}
        />
      </div>
    );
  }

  return (
    <>
      {/* Inline styles for animations - desktop only */}
      <style>{`
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(30px, -40px) scale(1.1); }
          50% { transform: translate(-30px, 30px) scale(0.9); }
          75% { transform: translate(40px, 20px) scale(1.05); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-15px) rotate(3deg); }
        }
        @keyframes float-reverse {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(15px) rotate(-3deg); }
        }
        .bg-blob {
          animation: blob 25s ease-in-out infinite;
        }
        .bg-blob-2 {
          animation: blob 25s ease-in-out infinite;
          animation-delay: -8s;
        }
        .bg-blob-3 {
          animation: blob 25s ease-in-out infinite;
          animation-delay: -16s;
        }
        .bg-float {
          animation: float 5s ease-in-out infinite;
        }
        .bg-float-1 {
          animation: float 6s ease-in-out infinite;
          animation-delay: -1s;
        }
        .bg-float-2 {
          animation: float-reverse 7s ease-in-out infinite;
          animation-delay: -2s;
        }
        .bg-float-3 {
          animation: float 5s ease-in-out infinite;
          animation-delay: -3s;
        }
        .bg-float-4 {
          animation: float-reverse 6s ease-in-out infinite;
          animation-delay: -4s;
        }
        .bg-float-5 {
          animation: float 8s ease-in-out infinite;
          animation-delay: -2s;
        }
      `}</style>

      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        {/* Base gradient - more vibrant */}
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse at top right, hsl(333 71% 50% / 0.15) 0%, transparent 50%),
              radial-gradient(ellipse at bottom left, hsl(152 60% 42% / 0.12) 0%, transparent 50%),
              radial-gradient(ellipse at center, hsl(38 92% 50% / 0.08) 0%, transparent 70%),
              linear-gradient(180deg, hsl(30 25% 98%) 0%, hsl(30 20% 96%) 100%)
            `,
          }}
        />

        {/* Enhanced Animated Blobs - more visible */}
        <div
          className="absolute rounded-full bg-blob"
          style={{
            top: "-10%",
            right: "-5%",
            width: "600px",
            height: "600px",
            background: "hsl(333 71% 50% / 0.2)",
            filter: "blur(60px)",
          }}
        />
        <div
          className="absolute rounded-full bg-blob-2"
          style={{
            top: "30%",
            left: "-10%",
            width: "500px",
            height: "500px",
            background: "hsl(152 60% 42% / 0.18)",
            filter: "blur(60px)",
          }}
        />
        <div
          className="absolute rounded-full bg-blob-3"
          style={{
            bottom: "-5%",
            right: "10%",
            width: "450px",
            height: "450px",
            background: "hsl(38 92% 50% / 0.15)",
            filter: "blur(60px)",
          }}
        />

        {/* Grid pattern - slightly more visible */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(to right, hsl(333 71% 50% / 0.05) 1px, transparent 1px),
              linear-gradient(to bottom, hsl(333 71% 50% / 0.05) 1px, transparent 1px)
            `,
            backgroundSize: "50px 50px",
          }}
        />

        {/* ========== ENHANCED FLOATING EDUCATION ICONS - MORE VISIBLE ========== */}

        {/* Book - top left */}
        <svg
          className="absolute bg-float"
          style={{ top: "80px", left: "20px", width: "55px", height: "55px", opacity: 0.4 }}
          viewBox="0 0 24 24"
          fill="hsl(333 71% 50% / 0.3)"
          stroke="hsl(333 71% 50%)"
          strokeWidth="2"
        >
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          <path d="M8 7h8" />
          <path d="M8 11h6" />
        </svg>

        {/* Graduation Cap - top right area */}
        <svg
          className="absolute bg-float-1"
          style={{ top: "120px", right: "30px", width: "65px", height: "65px", opacity: 0.45 }}
          viewBox="0 0 24 24"
          fill="hsl(333 71% 50% / 0.3)"
          stroke="hsl(333 71% 50%)"
          strokeWidth="2"
        >
          <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
          <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5" />
        </svg>

        {/* Pencil - left side */}
        <svg
          className="absolute bg-float-2"
          style={{ top: "350px", left: "15px", width: "50px", height: "50px", opacity: 0.5 }}
          viewBox="0 0 24 24"
          fill="hsl(152 60% 42% / 0.3)"
          stroke="hsl(152 60% 42%)"
          strokeWidth="2"
        >
          <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
          <path d="M15 5l4 4" />
        </svg>

        {/* Lightbulb - right side */}
        <svg
          className="absolute bg-float-3"
          style={{ top: "400px", right: "20px", width: "52px", height: "52px", opacity: 0.55 }}
          viewBox="0 0 24 24"
          fill="hsl(38 92% 50% / 0.4)"
          stroke="hsl(38 92% 50%)"
          strokeWidth="2"
        >
          <path d="M9 18h6" />
          <path d="M10 22h4" />
          <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
        </svg>

        {/* Calculator - bottom left */}
        <svg
          className="absolute bg-float-4"
          style={{ bottom: "150px", left: "25px", width: "45px", height: "45px", opacity: 0.45 }}
          viewBox="0 0 24 24"
          fill="hsl(200 80% 50% / 0.3)"
          stroke="hsl(200 80% 50%)"
          strokeWidth="2"
        >
          <rect x="4" y="2" width="16" height="20" rx="2" />
          <path d="M8 6h8" />
          <path d="M8 10h8" />
          <path d="M8 14h2" />
          <path d="M14 14h2" />
          <path d="M8 18h2" />
          <path d="M14 18h2" />
        </svg>

        {/* Star - bottom right */}
        <svg
          className="absolute bg-float-5"
          style={{ bottom: "200px", right: "35px", width: "42px", height: "42px", opacity: 0.6 }}
          viewBox="0 0 24 24"
          fill="hsl(38 92% 50% / 0.7)"
          stroke="hsl(38 92% 50%)"
          strokeWidth="2"
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>

        {/* Ruler - left side lower */}
        <svg
          className="absolute bg-float-1"
          style={{
            bottom: "300px",
            left: "10px",
            width: "50px",
            height: "50px",
            opacity: 0.4,
            transform: "rotate(-20deg)",
          }}
          viewBox="0 0 24 24"
          fill="none"
          stroke="hsl(280 60% 50%)"
          strokeWidth="2"
        >
          <path d="M21.2 8.8l-9.9 9.9c-.8.8-2 .8-2.8 0l-5.4-5.4c-.8-.8-.8-2 0-2.8l9.9-9.9c.8-.8 2-.8 2.8 0l5.4 5.4c.8.8.8 2 0 2.8z" />
          <path d="M7 14l2-2" />
          <path d="M10 11l2-2" />
          <path d="M13 8l2-2" />
        </svg>

        {/* Clock - right side upper */}
        <svg
          className="absolute bg-float-2"
          style={{ top: "250px", right: "15px", width: "46px", height: "46px", opacity: 0.45 }}
          viewBox="0 0 24 24"
          fill="hsl(333 71% 50% / 0.3)"
          stroke="hsl(333 71% 50%)"
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>

        {/* Arabic Letters - floating text */}
        <div
          className="absolute bg-float-2"
          style={{
            top: "180px",
            right: "25px",
            fontSize: "26px",
            fontWeight: "bold",
            opacity: 0.35,
            color: "hsl(333 71% 50%)",
            fontFamily: "Tajawal, sans-serif",
          }}
        >
          أ ب ت
        </div>

        {/* Arabic Numbers */}
        <div
          className="absolute bg-float-3"
          style={{
            bottom: "100px",
            left: "30px",
            fontSize: "24px",
            fontWeight: "bold",
            opacity: 0.35,
            color: "hsl(152 60% 42%)",
            fontFamily: "Tajawal, sans-serif",
          }}
        >
          ١٢٣
        </div>

        {/* Math symbols */}
        <div
          className="absolute bg-float-4"
          style={{
            top: "500px",
            right: "25px",
            fontSize: "22px",
            fontWeight: "bold",
            opacity: 0.35,
            color: "hsl(38 92% 50%)",
            fontFamily: "monospace",
          }}
        >
          + − ×
        </div>

        {/* Decorative dots - more visible */}
        <div
          className="absolute rounded-full animate-pulse"
          style={{
            top: "150px",
            right: "120px",
            width: "12px",
            height: "12px",
            background: "hsl(333 71% 50% / 0.8)",
            boxShadow: "0 0 10px hsl(333 71% 50% / 0.5)",
          }}
        />
        <div
          className="absolute rounded-full animate-pulse"
          style={{
            top: "380px",
            left: "80px",
            width: "14px",
            height: "14px",
            background: "hsl(152 60% 42% / 0.8)",
            boxShadow: "0 0 10px hsl(152 60% 42% / 0.5)",
            animationDelay: "1s",
          }}
        />
        <div
          className="absolute rounded-full animate-pulse"
          style={{
            bottom: "250px",
            right: "100px",
            width: "12px",
            height: "12px",
            background: "hsl(38 92% 50% / 0.8)",
            boxShadow: "0 0 10px hsl(38 92% 50% / 0.5)",
            animationDelay: "2s",
          }}
        />
        <div
          className="absolute rounded-full animate-pulse"
          style={{
            top: "550px",
            left: "100px",
            width: "10px",
            height: "10px",
            background: "hsl(200 80% 50% / 0.7)",
            boxShadow: "0 0 8px hsl(200 80% 50% / 0.4)",
            animationDelay: "0.5s",
          }}
        />
        <div
          className="absolute rounded-full animate-pulse"
          style={{
            top: "280px",
            right: "80px",
            width: "11px",
            height: "11px",
            background: "hsl(280 60% 50% / 0.7)",
            boxShadow: "0 0 8px hsl(280 60% 50% / 0.4)",
            animationDelay: "1.5s",
          }}
        />

        {/* Subtle glow effect */}
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(circle at 20% 20%, hsl(333 71% 50% / 0.03) 0%, transparent 40%),
                        radial-gradient(circle at 80% 80%, hsl(152 60% 42% / 0.03) 0%, transparent 40%)`,
          }}
        />
      </div>
    </>
  );
});

AnimatedBackground.displayName = "AnimatedBackground";

// =====================================================
// LOADING SCREEN
// =====================================================
const LoadingScreen = () => (
  <div className="min-h-screen grid place-items-center">
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <div
          className="w-12 h-12 rounded-full animate-spin"
          style={{
            border: "4px solid hsl(333 71% 50% / 0.2)",
            borderTopColor: "hsl(333 71% 50%)",
          }}
        />
      </div>
      <p className="text-sm text-muted-foreground animate-pulse">جاري التحميل...</p>
    </div>
  </div>
);

// =====================================================
// AUTH GUARD
// =====================================================
function RequireAuth({ children }: { children: JSX.Element }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return <LoadingScreen />;
  }

  if (!session) return <Navigate to="/auth" replace />;
  return children;
}

// =====================================================
// MAIN APP
// =====================================================
const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <GroupsProvider>
        <TooltipProvider>
          {/* Animated Background */}
          <AnimatedBackground />

          {/* Toast notifications */}
          <Toaster />
          <Sonner />

          {/* Main App Routes */}
          <BrowserRouter>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route
                path="/"
                element={
                  <RequireAuth>
                    <Index />
                  </RequireAuth>
                }
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </GroupsProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
