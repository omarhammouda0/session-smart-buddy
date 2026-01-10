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
// ANIMATED BACKGROUND COMPONENT
// =====================================================
const AnimatedBackground = memo(() => {
  return (
    <>
      {/* Inline styles for animations - guaranteed to work */}
      <style>{`
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(20px, -30px) scale(1.1); }
          50% { transform: translate(-20px, 20px) scale(0.9); }
          75% { transform: translate(30px, 10px) scale(1.05); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(5deg); }
        }
        .bg-animate-blob {
          animation: blob 20s ease-in-out infinite;
        }
        .bg-animate-blob-delay-2 {
          animation: blob 20s ease-in-out infinite;
          animation-delay: 2s;
        }
        .bg-animate-blob-delay-4 {
          animation: blob 20s ease-in-out infinite;
          animation-delay: 4s;
        }
        .bg-animate-float {
          animation: float 6s ease-in-out infinite;
        }
        .bg-animate-float-delay-1 {
          animation: float 6s ease-in-out infinite;
          animation-delay: 1s;
        }
        .bg-animate-float-delay-2 {
          animation: float 6s ease-in-out infinite;
          animation-delay: 2s;
        }
        .bg-animate-float-delay-3 {
          animation: float 6s ease-in-out infinite;
          animation-delay: 3s;
        }
        .bg-animate-float-delay-4 {
          animation: float 6s ease-in-out infinite;
          animation-delay: 4s;
        }
      `}</style>

      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        {/* Base gradient */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(135deg, hsl(30 25% 97%) 0%, hsl(333 71% 50% / 0.03) 50%, hsl(30 25% 97%) 100%)",
          }}
        />

        {/* Animated Blobs */}
        <div
          className="absolute rounded-full bg-animate-blob"
          style={{
            top: "-20%",
            right: "-10%",
            width: "500px",
            height: "500px",
            background: "hsl(333 71% 50% / 0.15)",
            filter: "blur(100px)",
          }}
        />
        <div
          className="absolute rounded-full bg-animate-blob-delay-2"
          style={{
            top: "40%",
            left: "-15%",
            width: "400px",
            height: "400px",
            background: "hsl(152 60% 42% / 0.12)",
            filter: "blur(100px)",
          }}
        />
        <div
          className="absolute rounded-full bg-animate-blob-delay-4"
          style={{
            bottom: "-10%",
            right: "20%",
            width: "350px",
            height: "350px",
            background: "hsl(38 92% 50% / 0.10)",
            filter: "blur(100px)",
          }}
        />

        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(to right, hsl(240 10% 15% / 0.02) 1px, transparent 1px),
              linear-gradient(to bottom, hsl(240 10% 15% / 0.02) 1px, transparent 1px)
            `,
            backgroundSize: "60px 60px",
          }}
        />

        {/* Floating Education Icons */}
        {/* Book */}
        <svg
          className="absolute bg-animate-float"
          style={{ top: "10%", left: "5%", width: "64px", height: "64px", opacity: 0.08 }}
          viewBox="0 0 24 24"
          fill="none"
          stroke="hsl(333 71% 50%)"
          strokeWidth="1.5"
        >
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          <path d="M8 7h8" />
          <path d="M8 11h6" />
        </svg>

        {/* Graduation Cap */}
        <svg
          className="absolute bg-animate-float-delay-1"
          style={{ top: "15%", right: "8%", width: "80px", height: "80px", opacity: 0.08 }}
          viewBox="0 0 24 24"
          fill="none"
          stroke="hsl(333 71% 50%)"
          strokeWidth="1.5"
        >
          <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
          <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5" />
        </svg>

        {/* Pencil */}
        <svg
          className="absolute bg-animate-float-delay-3"
          style={{ bottom: "20%", left: "8%", width: "56px", height: "56px", opacity: 0.08 }}
          viewBox="0 0 24 24"
          fill="none"
          stroke="hsl(333 71% 50%)"
          strokeWidth="1.5"
        >
          <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
          <path d="M15 5l4 4" />
        </svg>

        {/* Lightbulb */}
        <svg
          className="absolute bg-animate-float-delay-2"
          style={{ bottom: "30%", right: "5%", width: "48px", height: "48px", opacity: 0.08 }}
          viewBox="0 0 24 24"
          fill="none"
          stroke="hsl(38 92% 50%)"
          strokeWidth="1.5"
        >
          <path d="M9 18h6" />
          <path d="M10 22h4" />
          <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
        </svg>

        {/* Calculator */}
        <svg
          className="absolute bg-animate-float-delay-4"
          style={{ top: "50%", left: "3%", width: "40px", height: "40px", opacity: 0.08 }}
          viewBox="0 0 24 24"
          fill="none"
          stroke="hsl(152 60% 42%)"
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

        {/* Star */}
        <svg
          className="absolute bg-animate-float-delay-1"
          style={{ top: "70%", right: "12%", width: "32px", height: "32px", opacity: 0.1 }}
          viewBox="0 0 24 24"
          fill="hsl(38 92% 50% / 0.3)"
          stroke="hsl(38 92% 50%)"
          strokeWidth="1.5"
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>

        {/* ABC Arabic Letters */}
        <div
          className="absolute bg-animate-float-delay-3"
          style={{
            top: "35%",
            right: "3%",
            fontSize: "32px",
            fontWeight: "bold",
            opacity: 0.06,
            color: "hsl(333 71% 50%)",
            fontFamily: "Tajawal, sans-serif",
          }}
        >
          أ ب ت
        </div>

        {/* Arabic Numbers */}
        <div
          className="absolute bg-animate-float-delay-2"
          style={{
            bottom: "15%",
            left: "15%",
            fontSize: "28px",
            fontWeight: "bold",
            opacity: 0.06,
            color: "hsl(152 60% 42%)",
            fontFamily: "Tajawal, sans-serif",
          }}
        >
          ١٢٣
        </div>

        {/* Decorative circles */}
        <div
          className="absolute rounded-full animate-pulse"
          style={{ top: "25%", right: "25%", width: "8px", height: "8px", background: "hsl(333 71% 50% / 0.3)" }}
        />
        <div
          className="absolute rounded-full animate-pulse"
          style={{
            top: "60%",
            left: "20%",
            width: "12px",
            height: "12px",
            background: "hsl(152 60% 42% / 0.3)",
            animationDelay: "1s",
          }}
        />
        <div
          className="absolute rounded-full animate-pulse"
          style={{
            bottom: "35%",
            right: "35%",
            width: "8px",
            height: "8px",
            background: "hsl(38 92% 50% / 0.3)",
            animationDelay: "2s",
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
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      {/* Animated Background - renders behind everything */}
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
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
