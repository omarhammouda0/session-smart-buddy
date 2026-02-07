-- Add sessions_per_week and schedule_mode columns to students table
ALTER TABLE public.students
ADD COLUMN sessions_per_week INTEGER CHECK (sessions_per_week >= 1 AND sessions_per_week <= 7),
ADD COLUMN schedule_mode TEXT DEFAULT 'days' CHECK (schedule_mode IN ('days', 'perWeek'));

-- Add comment for documentation
COMMENT ON COLUMN public.students.sessions_per_week IS 'Number of sessions per week (1-7), used when schedule_mode is perWeek';
COMMENT ON COLUMN public.students.schedule_mode IS 'Schedule mode: days = select specific days, perWeek = specify number of sessions per week';