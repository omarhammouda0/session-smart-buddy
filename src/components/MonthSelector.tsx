import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MonthSelectorProps {
  month: number;
  year: number;
  onChange: (month: number, year: number) => void;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const MonthSelector = ({ month, year, onChange }: MonthSelectorProps) => {
  const goToPrevMonth = () => {
    if (month === 0) {
      onChange(11, year - 1);
    } else {
      onChange(month - 1, year);
    }
  };

  const goToNextMonth = () => {
    if (month === 11) {
      onChange(0, year + 1);
    } else {
      onChange(month + 1, year);
    }
  };

  const goToToday = () => {
    const now = new Date();
    onChange(now.getMonth(), now.getFullYear());
  };

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="icon" onClick={goToPrevMonth} className="h-9 w-9">
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <div className="min-w-[160px] text-center">
        <span className="font-heading font-semibold text-lg">
          {MONTH_NAMES[month]} {year}
        </span>
      </div>
      <Button variant="outline" size="icon" onClick={goToNextMonth} className="h-9 w-9">
        <ChevronRight className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="sm" onClick={goToToday} className="ml-2 text-muted-foreground">
        Today
      </Button>
    </div>
  );
};
