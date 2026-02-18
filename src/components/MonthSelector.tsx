import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MonthSelectorProps {
  month: number;
  year: number;
  onChange: (month: number, year: number) => void;
}

const MONTH_NAMES = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
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

  const isCurrentMonth = () => {
    const now = new Date();
    return month === now.getMonth() && year === now.getFullYear();
  };

  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="icon" onClick={goToPrevMonth} className="h-8 w-8">
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <div className="min-w-[140px] text-center">
        <span className="font-heading font-semibold">
          {MONTH_NAMES[month]} {year}
        </span>
      </div>
      <Button variant="ghost" size="icon" onClick={goToNextMonth} className="h-8 w-8">
        <ChevronRight className="h-4 w-4" />
      </Button>
      {!isCurrentMonth() && (
        <Button variant="ghost" size="sm" onClick={goToToday} className="ml-1 text-xs text-muted-foreground h-7">
          اليوم
        </Button>
      )}
    </div>
  );
};
