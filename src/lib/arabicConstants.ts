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
