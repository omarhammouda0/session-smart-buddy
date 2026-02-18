import { BookOpen, CalendarDays, GraduationCap, Users, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface MobileBottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  todaySessionsCount?: number;
}

export const MobileBottomNav = ({
  activeTab,
  onTabChange,
  todaySessionsCount = 0,
}: MobileBottomNavProps) => {
  const tabs = [
    { id: "sessions", label: "الحصص", icon: BookOpen, badge: todaySessionsCount > 0 ? todaySessionsCount : undefined },
    { id: "calendar", label: "التقويم", icon: CalendarDays },
    { id: "history", label: "الطلبة", icon: GraduationCap },
    { id: "groups", label: "المجموعات", icon: Users },
    { id: "payments", label: "الدفع", icon: CreditCard },
  ];

  return (
    <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-xl border-t border-border/50 safe-bottom">
      <div className="flex items-center justify-around px-1 py-1.5">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 px-2 py-1.5 rounded-lg transition-all duration-200 min-w-[3.5rem] touch-manipulation active:scale-95",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div className="relative">
                <Icon className={cn(
                  "h-5 w-5 transition-all duration-200",
                  isActive && "scale-110"
                )} />
                {tab.badge && (
                  <Badge
                    className={cn(
                      "absolute -top-1.5 -right-2 h-4 min-w-[1rem] px-1 text-[0.6rem] font-bold",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted-foreground/80 text-background"
                    )}
                  >
                    {tab.badge}
                  </Badge>
                )}
              </div>
              <span className={cn(
                "text-[0.65rem] font-medium leading-tight transition-all duration-200",
                isActive && "font-semibold"
              )}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};


