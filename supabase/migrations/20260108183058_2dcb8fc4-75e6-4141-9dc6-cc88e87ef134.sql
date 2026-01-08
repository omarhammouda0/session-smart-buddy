-- Add cancellation reminder settings columns to reminder_settings table
ALTER TABLE public.reminder_settings
ADD COLUMN IF NOT EXISTS cancellation_reminders_enabled boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS cancellation_reminder_template text NOT NULL DEFAULT 'عزيزي ولي الأمر،
نود إعلامكم بأن {student_name} قد وصل إلى الحد الأقصى للإلغاءات ({limit} مرات) لشهر {month}.
الإلغاءات الإضافية ستُحتسب من الرصيد.
شكراً لتفهمكم';