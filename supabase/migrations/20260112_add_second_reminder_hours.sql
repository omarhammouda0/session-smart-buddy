-- Add second reminder hours column to reminder_settings table
ALTER TABLE public.reminder_settings
ADD COLUMN session_reminder_hours_2 INTEGER NOT NULL DEFAULT 1;

-- Add reminder_interval column to reminder_log table to distinguish between first and second reminders
ALTER TABLE public.reminder_log
ADD COLUMN reminder_interval INTEGER DEFAULT 1;

