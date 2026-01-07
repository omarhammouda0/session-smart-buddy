import { Users } from 'lucide-react';

export const EmptyState = () => {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 animate-fade-in">
      <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-5">
        <Users className="h-10 w-10 text-primary" />
      </div>
      <h3 className="font-heading font-semibold text-lg mb-2">No Students Yet</h3>
      <p className="text-muted-foreground text-center text-sm max-w-xs">
        Add your first student to start tracking sessions. Just set their name and weekly schedule day!
      </p>
    </div>
  );
};
