-- Fix group_session_attendance CHECK constraint to include 'vacation' 
-- The TypeScript SessionStatus type includes 'vacation' for excused absences,
-- but the DB only allowed ('scheduled', 'completed', 'cancelled', 'absent', 'excused')
-- This caused silent failures when marking a member as "excused" (عذر) in the UI

-- Drop old constraint and add new one that includes 'vacation'
ALTER TABLE public.group_session_attendance 
  DROP CONSTRAINT IF EXISTS group_session_attendance_status_check;

ALTER TABLE public.group_session_attendance 
  ADD CONSTRAINT group_session_attendance_status_check 
  CHECK (status IN ('scheduled', 'completed', 'cancelled', 'absent', 'excused', 'vacation'));
