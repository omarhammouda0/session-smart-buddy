-- Add second reminder hours column to reminder_settings table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'reminder_settings'
        AND column_name = 'session_reminder_hours_2'
    ) THEN
        ALTER TABLE public.reminder_settings
        ADD COLUMN session_reminder_hours_2 INTEGER NOT NULL DEFAULT 1;
    END IF;
END $$;

-- Add reminder_interval column to reminder_log table to distinguish between first and second reminders
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'reminder_log'
        AND column_name = 'reminder_interval'
    ) THEN
        ALTER TABLE public.reminder_log
        ADD COLUMN reminder_interval INTEGER DEFAULT 1;
    END IF;
END $$;
