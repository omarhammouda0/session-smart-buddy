import { Check, Calendar } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Session } from '@/types/student';

interface SessionItemProps {
  session: Session;
  index: number;
  onToggleComplete: () => void;
  onDateChange: (date: string | null) => void;
}

export const SessionItem = ({ session, index, onToggleComplete, onDateChange }: SessionItemProps) => {
  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border transition-all animate-fade-in",
        session.completed 
          ? "bg-success/10 border-success/30" 
          : "bg-card border-border hover:border-primary/30"
      )}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <button
        onClick={onToggleComplete}
        className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center transition-all shrink-0",
          session.completed
            ? "bg-success text-success-foreground"
            : "border-2 border-muted-foreground/30 hover:border-primary hover:bg-primary/10"
        )}
      >
        {session.completed && <Check className="h-4 w-4" />}
      </button>
      
      <span className="font-medium text-sm text-muted-foreground w-20 shrink-0">
        Session {index + 1}
      </span>
      
      <div className="flex items-center gap-2 flex-1">
        <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
        <Input
          type="date"
          value={session.date || ''}
          onChange={(e) => onDateChange(e.target.value || null)}
          className="h-8 text-sm max-w-[160px]"
        />
      </div>
      
      <span className={cn(
        "text-xs font-medium px-2 py-1 rounded-full shrink-0",
        session.completed 
          ? "bg-success/20 text-success" 
          : "bg-muted text-muted-foreground"
      )}>
        {session.completed ? 'Done' : 'Pending'}
      </span>
    </div>
  );
};
