-- Fix group_session_attendance CHECK constraint to include 'vacation'
ALTER TABLE public.group_session_attendance 
  DROP CONSTRAINT IF EXISTS group_session_attendance_status_check;

ALTER TABLE public.group_session_attendance 
  ADD CONSTRAINT group_session_attendance_status_check 
  CHECK (status IN ('scheduled', 'completed', 'cancelled', 'absent', 'excused', 'vacation'));