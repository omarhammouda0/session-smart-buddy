import { useState, useRef, useEffect } from 'react';
import { Search, X, Check, Clock, Monitor, MapPin } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Student } from '@/types/student';
import { DAY_NAMES_SHORT_AR } from '@/lib/arabicConstants';

interface StudentSearchComboboxProps {
  students: Student[];
  value: string; // search text or selected student name
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export const StudentSearchCombobox = ({
  students,
  value,
  onChange,
  placeholder = 'ابحث عن طالب...',
  className,
}: StudentSearchComboboxProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync external value
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredStudents = inputValue.trim() === '' 
    ? [] 
    : students.filter(student =>
        student.name.toLowerCase().includes(inputValue.trim().toLowerCase())
      );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange(newValue);
    setIsOpen(true);
  };

  const handleSelectStudent = (student: Student) => {
    setInputValue(student.name);
    onChange(student.name);
    setIsOpen(false);
  };

  const handleClear = () => {
    setInputValue('');
    onChange('');
    inputRef.current?.focus();
  };

  const handleFocus = () => {
    setIsOpen(true);
  };

  return (
    <div ref={containerRef} className={cn("relative w-full", className)} dir="rtl">
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-4 sm:w-4 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          className="pr-10 pl-10 bg-background h-11 sm:h-10 text-base sm:text-sm w-full"
        />
        {inputValue && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute left-1 top-1/2 -translate-y-1/2 h-9 w-9 sm:h-7 sm:w-7 text-muted-foreground hover:text-foreground"
            onClick={handleClear}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && filteredStudents.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {filteredStudents.map(student => (
            <button
              key={student.id}
              type="button"
              onClick={() => handleSelectStudent(student)}
              className={cn(
                "w-full flex items-center gap-2 sm:gap-3 p-3 sm:p-3 text-right hover:bg-accent transition-colors min-h-[3rem]",
                inputValue === student.name && "bg-accent/50"
              )}
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate text-sm sm:text-base">{student.name}</p>
                <div className="flex items-center gap-1.5 sm:gap-2 text-[0.65rem] sm:text-xs text-muted-foreground mt-0.5">
                  <span className="flex items-center gap-0.5">
                    <Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                    {student.sessionTime || '16:00'}
                  </span>
                  <span>•</span>
                  <span>
                    {(student.sessionType || 'onsite') === 'online' ? 'أونلاين' : 'حضوري'}
                  </span>
                </div>
              </div>
              {inputValue === student.name && (
                <Check className="h-4 w-4 text-primary shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}

      {/* No results message */}
      {isOpen && inputValue.trim() !== '' && filteredStudents.length === 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg p-3 sm:p-4 text-center text-muted-foreground text-xs sm:text-sm">
          لا يوجد نتائج
        </div>
      )}
    </div>
  );
};
