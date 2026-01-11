import { useEffect, useState, memo } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";

const queryClient = new QueryClient();

// =====================================================
// ANIMATED BACKGROUND COMPONENT - ENHANCED VERSION
// =====================================================
const AnimatedBackground = memo(() => {
  return (
    <>
      {/* Inline styles for animations */}
      <style>{`
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(30px, -40px) scale(1.15); }
          50% { transform: translate(-30px, 30px) scale(0.85); }
          75% { transform: translate(40px, 20px) scale(1.05); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(5deg); }
        }
        @keyframes float-reverse {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(20px) rotate(-5deg); }
        }
        @keyframes pulse-glow {
          0%, 100% { opacity: 0.4; filter: blur(60px); }
          50% { opacity: 0.7; filter: blur(80px); }
        }
        @keyframes shimmer-move {
          0% { transform: translateX(-100%) rotate(45deg); }
          100% { transform: translateX(100%) rotate(45deg); }
        }
        @keyframes orbit {
          0% { transform: rotate(0deg) translateX(150px) rotate(0deg); }
          100% { transform: rotate(360deg) translateX(150px) rotate(-360deg); }
        }
        @keyframes wave {
          0%, 100% { transform: translateX(0) translateY(0); }
          25% { transform: translateX(10px) translateY(-5px); }
          50% { transform: translateX(0) translateY(-10px); }
          75% { transform: translateX(-10px) translateY(-5px); }
        }
        .bg-blob {
          animation: blob 25s ease-in-out infinite;
        }
        .bg-blob-2 {
          animation: blob 30s ease-in-out infinite;
          animation-delay: -10s;
        }
        .bg-blob-3 {
          animation: blob 28s ease-in-out infinite;
          animation-delay: -18s;
        }
        .bg-blob-4 {
          animation: blob 32s ease-in-out infinite;
          animation-delay: -5s;
        }
        .pulse-glow {
          animation: pulse-glow 4s ease-in-out infinite;
        }
        .bg-float {
          animation: float 6s ease-in-out infinite;
        }
        .bg-float-1 {
          animation: float 7s ease-in-out infinite;
          animation-delay: -1s;
        }
        .bg-float-2 {
          animation: float-reverse 8s ease-in-out infinite;
          animation-delay: -2s;
        }
        .bg-float-3 {
          animation: float 5.5s ease-in-out infinite;
          animation-delay: -3s;
        }
        .bg-float-4 {
          animation: float-reverse 6.5s ease-in-out infinite;
          animation-delay: -4s;
        }
        .bg-float-5 {
          animation: float 9s ease-in-out infinite;
          animation-delay: -2s;
        }
        .bg-wave {
          animation: wave 8s ease-in-out infinite;
        }
        .orbit-1 {
          animation: orbit 45s linear infinite;
        }
        .orbit-2 {
          animation: orbit 60s linear infinite reverse;
        }
      `}</style>

      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        {/* Premium gradient base */}
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 80% 50% at 50% -20%, hsl(333 71% 50% / 0.12) 0%, transparent 50%),
              radial-gradient(ellipse 60% 40% at 100% 50%, hsl(333 71% 50% / 0.08) 0%, transparent 50%),
              radial-gradient(ellipse 60% 40% at 0% 50%, hsl(152 60% 42% / 0.08) 0%, transparent 50%),
              radial-gradient(ellipse 80% 50% at 50% 120%, hsl(38 92% 50% / 0.1) 0%, transparent 50%),
              linear-gradient(180deg, hsl(30 25% 98%) 0%, hsl(30 20% 96%) 50%, hsl(30 25% 97%) 100%)
            `,
          }}
        />

        {/* Animated gradient orbs with enhanced glow */}
        <div
          className="absolute rounded-full bg-blob pulse-glow"
          style={{
            top: "-15%",
            right: "-10%",
            width: "700px",
            height: "700px",
            background: "radial-gradient(circle, hsl(333 71% 50% / 0.25) 0%, hsl(333 71% 50% / 0.05) 70%, transparent 100%)",
          }}
        />
        <div
          className="absolute rounded-full bg-blob-2 pulse-glow"
          style={{
            top: "40%",
            left: "-15%",
            width: "600px",
            height: "600px",
            background: "radial-gradient(circle, hsl(152 60% 42% / 0.22) 0%, hsl(152 60% 42% / 0.05) 70%, transparent 100%)",
            animationDelay: "-2s",
          }}
        />
        <div
          className="absolute rounded-full bg-blob-3 pulse-glow"
          style={{
            bottom: "-10%",
            right: "5%",
            width: "550px",
            height: "550px",
            background: "radial-gradient(circle, hsl(38 92% 50% / 0.2) 0%, hsl(38 92% 50% / 0.05) 70%, transparent 100%)",
            animationDelay: "-4s",
          }}
        />
        <div
          className="absolute rounded-full bg-blob-4 pulse-glow"
          style={{
            top: "20%",
            right: "30%",
            width: "400px",
            height: "400px",
            background: "radial-gradient(circle, hsl(200 80% 50% / 0.15) 0%, hsl(200 80% 50% / 0.03) 70%, transparent 100%)",
            animationDelay: "-6s",
          }}
        />

        {/* Subtle grid pattern overlay */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(to right, hsl(333 71% 50% / 0.03) 1px, transparent 1px),
              linear-gradient(to bottom, hsl(333 71% 50% / 0.03) 1px, transparent 1px)
            `,
            backgroundSize: "60px 60px",
          }}
        />

        {/* Dot pattern for depth */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "radial-gradient(hsl(333 71% 50% / 0.08) 1px, transparent 1px)",
            backgroundSize: "30px 30px",
          }}
        />

        {/* ========== FLOATING EDUCATION ICONS ========== */}

        {/* Book - top left */}
        <svg
          className="absolute bg-float"
          style={{ top: "80px", left: "20px", width: "60px", height: "60px", opacity: 0.5 }}
          viewBox="0 0 24 24"
          fill="hsl(333 71% 50% / 0.25)"
          stroke="hsl(333 71% 50%)"
          strokeWidth="1.5"
        >
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          <path d="M8 7h8" />
          <path d="M8 11h6" />
        </svg>

        {/* Graduation Cap - top right */}
        <svg
          className="absolute bg-float-1"
          style={{ top: "100px", right: "25px", width: "70px", height: "70px", opacity: 0.55 }}
          viewBox="0 0 24 24"
          fill="hsl(333 71% 50% / 0.25)"
          stroke="hsl(333 71% 50%)"
          strokeWidth="1.5"
        >
          <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
          <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5" />
        </svg>

        {/* Pencil - left side */}
        <svg
          className="absolute bg-float-2"
          style={{ top: "320px", left: "15px", width: "55px", height: "55px", opacity: 0.55 }}
          viewBox="0 0 24 24"
          fill="hsl(152 60% 42% / 0.25)"
          stroke="hsl(152 60% 42%)"
          strokeWidth="1.5"
        >
          <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
          <path d="M15 5l4 4" />
        </svg>

        {/* Lightbulb - right side */}
        <svg
          className="absolute bg-float-3"
          style={{ top: "380px", right: "18px", width: "58px", height: "58px", opacity: 0.6 }}
          viewBox="0 0 24 24"
          fill="hsl(38 92% 50% / 0.35)"
          stroke="hsl(38 92% 50%)"
          strokeWidth="1.5"
        >
          <path d="M9 18h6" />
          <path d="M10 22h4" />
          <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
        </svg>

        {/* Calculator - bottom left */}
        <svg
          className="absolute bg-float-4"
          style={{ bottom: "180px", left: "25px", width: "50px", height: "50px", opacity: 0.5 }}
          viewBox="0 0 24 24"
          fill="hsl(200 80% 50% / 0.25)"
          stroke="hsl(200 80% 50%)"
          strokeWidth="1.5"
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
          style={{ bottom: "220px", right: "30px", width: "48px", height: "48px", opacity: 0.65 }}
          viewBox="0 0 24 24"
          fill="hsl(38 92% 50% / 0.6)"
          stroke="hsl(38 92% 50%)"
          strokeWidth="1.5"
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>

        {/* Ruler - left side */}
        <svg
          className="absolute bg-float-1"
          style={{
            bottom: "320px",
            left: "10px",
            width: "52px",
            height: "52px",
            opacity: 0.45,
          }}
          viewBox="0 0 24 24"
          fill="none"
          stroke="hsl(280 60% 50%)"
          strokeWidth="1.5"
        >
          <path d="M21.2 8.8l-9.9 9.9c-.8.8-2 .8-2.8 0l-5.4-5.4c-.8-.8-.8-2 0-2.8l9.9-9.9c.8-.8 2-.8 2.8 0l5.4 5.4c.8.8.8 2 0 2.8z" />
          <path d="M7 14l2-2" />
          <path d="M10 11l2-2" />
          <path d="M13 8l2-2" />
        </svg>

        {/* Clock - right side */}
        <svg
          className="absolute bg-float-2"
          style={{ top: "230px", right: "12px", width: "50px", height: "50px", opacity: 0.5 }}
          viewBox="0 0 24 24"
          fill="hsl(333 71% 50% / 0.25)"
          stroke="hsl(333 71% 50%)"
          strokeWidth="1.5"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>

        {/* Trophy - center left */}
        <svg
          className="absolute bg-wave"
          style={{ top: "500px", left: "30px", width: "45px", height: "45px", opacity: 0.5 }}
          viewBox="0 0 24 24"
          fill="hsl(38 92% 50% / 0.3)"
          stroke="hsl(38 92% 50%)"
          strokeWidth="1.5"
        >
          <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
          <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
          <path d="M4 22h16" />
          <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
          <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
          <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
        </svg>

        {/* Heart - decorative */}
        <svg
          className="absolute bg-float-3"
          style={{ top: "600px", right: "50px", width: "35px", height: "35px", opacity: 0.45 }}
          viewBox="0 0 24 24"
          fill="hsl(333 71% 50% / 0.4)"
          stroke="hsl(333 71% 50%)"
          strokeWidth="1.5"
        >
          <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
        </svg>

        {/* Arabic Letters */}
        <div
          className="absolute bg-float-2"
          style={{
            top: "160px",
            right: "100px",
            fontSize: "28px",
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
            bottom: "120px",
            left: "80px",
            fontSize: "26px",
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
            top: "480px",
            right: "25px",
            fontSize: "24px",
            fontWeight: "bold",
            opacity: 0.35,
            color: "hsl(38 92% 50%)",
            fontFamily: "monospace",
          }}
        >
          + − × ÷
        </div>

        {/* Decorative glowing dots */}
        <div
          className="absolute rounded-full animate-pulse"
          style={{
            top: "140px",
            right: "150px",
            width: "14px",
            height: "14px",
            background: "hsl(333 71% 50% / 0.9)",
            boxShadow: "0 0 15px 5px hsl(333 71% 50% / 0.4)",
          }}
        />
        <div
          className="absolute rounded-full animate-pulse"
          style={{
            top: "360px",
            left: "100px",
            width: "16px",
            height: "16px",
            background: "hsl(152 60% 42% / 0.9)",
            boxShadow: "0 0 15px 5px hsl(152 60% 42% / 0.4)",
            animationDelay: "1s",
          }}
        />
        <div
          className="absolute rounded-full animate-pulse"
          style={{
            bottom: "280px",
            right: "120px",
            width: "12px",
            height: "12px",
            background: "hsl(38 92% 50% / 0.9)",
            boxShadow: "0 0 12px 4px hsl(38 92% 50% / 0.4)",
            animationDelay: "2s",
          }}
        />
        <div
          className="absolute rounded-full animate-pulse"
          style={{
            top: "520px",
            left: "120px",
            width: "10px",
            height: "10px",
            background: "hsl(200 80% 50% / 0.85)",
            boxShadow: "0 0 10px 3px hsl(200 80% 50% / 0.4)",
            animationDelay: "0.5s",
          }}
        />
        <div
          className="absolute rounded-full animate-pulse"
          style={{
            top: "260px",
            right: "90px",
            width: "11px",
            height: "11px",
            background: "hsl(280 60% 50% / 0.85)",
            boxShadow: "0 0 10px 3px hsl(280 60% 50% / 0.4)",
            animationDelay: "1.5s",
          }}
        />
        
        {/* Additional sparkle dots */}
        <div
          className="absolute rounded-full animate-pulse"
          style={{
            top: "420px",
            left: "200px",
            width: "8px",
            height: "8px",
            background: "hsl(333 71% 60% / 0.8)",
            boxShadow: "0 0 8px 2px hsl(333 71% 60% / 0.3)",
            animationDelay: "2.5s",
          }}
        />
        <div
          className="absolute rounded-full animate-pulse"
          style={{
            bottom: "380px",
            right: "200px",
            width: "9px",
            height: "9px",
            background: "hsl(152 60% 50% / 0.8)",
            boxShadow: "0 0 8px 2px hsl(152 60% 50% / 0.3)",
            animationDelay: "3s",
          }}
        />

        {/* Subtle overlay glow */}
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(circle at 15% 15%, hsl(333 71% 50% / 0.04) 0%, transparent 35%),
              radial-gradient(circle at 85% 85%, hsl(152 60% 42% / 0.04) 0%, transparent 35%),
              radial-gradient(circle at 50% 50%, hsl(38 92% 50% / 0.02) 0%, transparent 50%)
            `,
          }}
        />
      </div>
    </>
  );
});

AnimatedBackground.displayName = "AnimatedBackground";

// =====================================================
// LOADING SCREEN - ENHANCED
// =====================================================
const LoadingScreen = () => (
  <div className="min-h-screen grid place-items-center">
    <div className="flex flex-col items-center gap-6">
      <div className="relative">
        {/* Outer glow ring */}
        <div
          className="absolute inset-0 rounded-full animate-ping"
          style={{
            background: "hsl(333 71% 50% / 0.2)",
            animationDuration: "1.5s",
          }}
        />
        {/* Main spinner */}
        <div
          className="w-16 h-16 rounded-full animate-spin"
          style={{
            border: "4px solid hsl(333 71% 50% / 0.15)",
            borderTopColor: "hsl(333 71% 50%)",
            borderRightColor: "hsl(333 71% 50% / 0.5)",
          }}
        />
        {/* Inner icon */}
        <div className="absolute inset-0 flex items-center justify-center">
          <svg
            className="w-6 h-6"
            viewBox="0 0 24 24"
            fill="hsl(333 71% 50%)"
          >
            <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
            <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5" fill="none" stroke="hsl(333 71% 50%)" strokeWidth="2" />
          </svg>
        </div>
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-foreground animate-pulse">جاري التحميل...</p>
        <p className="text-xs text-muted-foreground mt-1">متابعة الطلاب</p>
      </div>
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
  <QueryClientProvider client={queryClient}>
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
  </QueryClientProvider>
);

export default App;
