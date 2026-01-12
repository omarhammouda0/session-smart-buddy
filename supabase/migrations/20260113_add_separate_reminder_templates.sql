-- Add separate message templates for 24h and 1h reminders

-- Add template for first reminder (24h before)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'reminder_settings'
        AND column_name = 'session_reminder_template_1'
    ) THEN
        ALTER TABLE public.reminder_settings
        ADD COLUMN session_reminder_template_1 TEXT DEFAULT 'مرحباً {student_name}،
تذكير: لديك جلسة غداً بتاريخ {date} الساعة {time}.
نراك قريباً!';
    END IF;
END $$;

-- Add template for second reminder (1h before)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'reminder_settings'
        AND column_name = 'session_reminder_template_2'
    ) THEN
        ALTER TABLE public.reminder_settings
        ADD COLUMN session_reminder_template_2 TEXT DEFAULT 'مرحباً {student_name}،
جلستك تبدأ خلال ساعة واحدة الساعة {time}!
الرجاء الاستعداد.';
    END IF;
END $$;

-- Update existing rows with default values if they have null
UPDATE public.reminder_settings
SET session_reminder_template_1 = 'مرحباً {student_name}،
تذكير: لديك جلسة غداً بتاريخ {date} الساعة {time}.
نراك قريباً!'
WHERE session_reminder_template_1 IS NULL;

UPDATE public.reminder_settings
SET session_reminder_template_2 = 'مرحباً {student_name}،
جلستك تبدأ خلال ساعة واحدة الساعة {time}!
الرجاء الاستعداد.'
WHERE session_reminder_template_2 IS NULL;
