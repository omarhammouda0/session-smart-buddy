import { Users } from 'lucide-react';

export const EmptyState = () => {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 animate-fade-in">
      <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mb-6">
        <Users className="h-12 w-12 text-primary" />
      </div>
      <h3 className="font-heading font-semibold text-xl mb-2">No Students Yet</h3>
      <p className="text-muted-foreground text-center max-w-sm">
        Add your first student to start tracking sessions and payments.
      </p>
    </div>
  );
};
