-- Add dual reminder support columns to reminder_settings
ALTER TABLE public.reminder_settings 
ADD COLUMN IF NOT EXISTS session_reminder_hours_2 integer NOT NULL DEFAULT 1;

ALTER TABLE public.reminder_settings 
ADD COLUMN IF NOT EXISTS session_reminder_template_1 text NOT NULL DEFAULT 'مرحباً {student_name}،
تذكير: لديك جلسة غداً بتاريخ {date} الساعة {time}.
نراك قريباً!';

ALTER TABLE public.reminder_settings 
ADD COLUMN IF NOT EXISTS session_reminder_template_2 text NOT NULL DEFAULT 'مرحباً {student_name}،
جلستك تبدأ خلال ساعة واحدة الساعة {time}!
الرجاء الاستعداد.';

-- Add reminder_interval column to reminder_log for tracking which reminder was sent
ALTER TABLE public.reminder_log 
ADD COLUMN IF NOT EXISTS reminder_interval integer;