// Arabic day names
export const DAY_NAMES_AR = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
export const DAY_NAMES_SHORT_AR = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];

// Arabic month names
export const MONTH_NAMES_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
];

export const formatMonthYearAr = (month: number, year: number): string => {
  return `${MONTH_NAMES_AR[month]} ${year}`;
};

export const formatDateAr = (dateStr: string): string => {
  const date = new Date(dateStr);
  const day = date.getDate();
  const month = MONTH_NAMES_AR[date.getMonth()];
  const dayName = DAY_NAMES_AR[date.getDay()];
  return `${dayName} ${day} ${month}`;
};

export const formatShortDateAr = (dateStr: string): string => {
  const date = new Date(dateStr);
  const day = date.getDate();
  const dayName = DAY_NAMES_SHORT_AR[date.getDay()];
  const month = MONTH_NAMES_AR[date.getMonth()];
  return `${dayName}، ${day} ${month}`;
};

// Duration formatting
export const formatDurationAr = (minutes: number): string => {
  if (minutes < 60) {
    return `${minutes} د`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) {
    return hours === 1 ? 'ساعة' : `${hours} ساعات`;
  }
  return `${hours}:${String(remainingMinutes).padStart(2, '0')} س`;
};

export const formatDurationFullAr = (minutes: number): string => {
  if (minutes < 60) {
    return `${minutes} دقيقة`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) {
    return hours === 1 ? 'ساعة واحدة' : `${hours} ساعات`;
  }
  return `${hours} ساعة و ${remainingMinutes} دقيقة`;
};

// Calculate end time from start time and duration
export const calculateEndTime = (startTime: string, durationMinutes: number): { endTime: string; crossesMidnight: boolean } => {
  const [hours, minutes] = startTime.split(':').map(Number);
  const startMinutes = hours * 60 + minutes;
  const endMinutes = startMinutes + durationMinutes;
  
  const crossesMidnight = endMinutes >= 24 * 60;
  const normalizedEndMinutes = endMinutes % (24 * 60);
  
  const endHours = Math.floor(normalizedEndMinutes / 60);
  const endMins = normalizedEndMinutes % 60;
  
  return {
    endTime: `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`,
    crossesMidnight,
  };
};

// Calculate duration from start and end time
export const calculateDurationFromTimes = (startTime: string, endTime: string): number => {
  const [startHours, startMinutes] = startTime.split(':').map(Number);
  const [endHours, endMinutes] = endTime.split(':').map(Number);
  
  const startTotal = startHours * 60 + startMinutes;
  let endTotal = endHours * 60 + endMinutes;
  
  // Handle midnight crossing
  if (endTotal <= startTotal) {
    endTotal += 24 * 60;
  }
  
  return endTotal - startTotal;
};
