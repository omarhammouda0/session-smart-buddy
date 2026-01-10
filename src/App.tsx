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
// ANIMATED BACKGROUND COMPONENT (embedded)
// =====================================================
const AnimatedBackground = memo(() => {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      {/* Base gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-primary/5" />

      {/* Animated Blobs */}
      <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-primary/20 blur-[100px] animate-blob" />
      <div className="absolute top-[40%] left-[-15%] w-[400px] h-[400px] rounded-full bg-accent-foreground/10 blur-[100px] animate-blob animation-delay-2000" />
      <div className="absolute bottom-[-10%] right-[20%] w-[350px] h-[350px] rounded-full bg-success/15 blur-[100px] animate-blob animation-delay-4000" />

      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.02] dark:opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(to right, currentColor 1px, transparent 1px),
            linear-gradient(to bottom, currentColor 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
        }}
      />

      {/* Floating Education Icons */}
      <svg
        className="absolute top-[10%] left-[5%] w-16 h-16 text-primary animate-float opacity-10 dark:opacity-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        <path d="M8 7h8" />
        <path d="M8 11h6" />
      </svg>

      <svg
        className="absolute top-[15%] right-[8%] w-20 h-20 text-primary animate-float animation-delay-1000 opacity-10 dark:opacity-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
        <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5" />
      </svg>

      <svg
        className="absolute bottom-[20%] left-[10%] w-14 h-14 text-accent-foreground animate-float animation-delay-3000 opacity-10 dark:opacity-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
        <path d="M15 5l4 4" />
      </svg>

      <svg
        className="absolute bottom-[30%] right-[5%] w-12 h-12 text-warning animate-float animation-delay-2000 opacity-10 dark:opacity-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M9 18h6" />
        <path d="M10 22h4" />
        <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
      </svg>

      <svg
        className="absolute top-[50%] left-[3%] w-10 h-10 text-success animate-float animation-delay-4000 opacity-10 dark:opacity-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
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

      <svg
        className="absolute top-[70%] right-[12%] w-8 h-8 text-warning animate-float animation-delay-1500 opacity-10 dark:opacity-5"
        viewBox="0 0 24 24"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>

      {/* Decorative circles */}
      <div className="absolute top-[25%] right-[25%] w-2 h-2 rounded-full bg-primary/30 animate-pulse" />
      <div className="absolute top-[60%] left-[20%] w-3 h-3 rounded-full bg-success/30 animate-pulse animation-delay-1000" />
      <div className="absolute bottom-[35%] right-[35%] w-2 h-2 rounded-full bg-warning/30 animate-pulse animation-delay-2000" />
    </div>
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
        <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
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
