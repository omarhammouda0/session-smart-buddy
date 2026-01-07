import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UserPlus } from 'lucide-react';

interface AddStudentDialogProps {
  onAdd: (name: string, sessionsPerMonth: number) => void;
}

export const AddStudentDialog = ({ onAdd }: AddStudentDialogProps) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [sessions, setSessions] = useState('8');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onAdd(name.trim(), parseInt(sessions) || 8);
      setName('');
      setSessions('8');
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gradient-primary gap-2 shadow-lg hover:shadow-xl transition-shadow">
          <UserPlus className="h-4 w-4" />
          Add Student
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Add New Student</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="name">Student Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter student name"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sessions">Sessions per Month</Label>
            <Input
              id="sessions"
              type="number"
              min="1"
              max="31"
              value={sessions}
              onChange={(e) => setSessions(e.target.value)}
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" className="flex-1 gradient-primary">
              Add Student
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
