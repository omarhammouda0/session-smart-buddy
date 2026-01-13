-- Add working hours columns to app_settings table
ALTER TABLE app_settings
ADD COLUMN IF NOT EXISTS working_hours_start TEXT DEFAULT '14:00',
ADD COLUMN IF NOT EXISTS working_hours_end TEXT DEFAULT '22:00';

