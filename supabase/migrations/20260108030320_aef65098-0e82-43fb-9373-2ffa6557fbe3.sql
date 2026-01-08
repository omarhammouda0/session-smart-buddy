-- Drop existing restrictive RLS policies on session_cancellations
DROP POLICY IF EXISTS "Users can delete their own session cancellations" ON session_cancellations;
DROP POLICY IF EXISTS "Users can insert their own session cancellations" ON session_cancellations;
DROP POLICY IF EXISTS "Users can update their own session cancellations" ON session_cancellations;
DROP POLICY IF EXISTS "Users can view their own session cancellations" ON session_cancellations;

-- Create permissive policy for session_cancellations
CREATE POLICY "Allow all operations on session_cancellations" 
ON session_cancellations 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Drop existing restrictive RLS policies on student_cancellation_tracking
DROP POLICY IF EXISTS "Users can delete their own cancellation tracking" ON student_cancellation_tracking;
DROP POLICY IF EXISTS "Users can insert their own cancellation tracking" ON student_cancellation_tracking;
DROP POLICY IF EXISTS "Users can update their own cancellation tracking" ON student_cancellation_tracking;
DROP POLICY IF EXISTS "Users can view their own cancellation tracking" ON student_cancellation_tracking;

-- Create permissive policy for student_cancellation_tracking
CREATE POLICY "Allow all operations on student_cancellation_tracking" 
ON student_cancellation_tracking 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Drop existing restrictive RLS policies on cancellation_notifications
DROP POLICY IF EXISTS "Users can insert their own cancellation notifications" ON cancellation_notifications;
DROP POLICY IF EXISTS "Users can update their own cancellation notifications" ON cancellation_notifications;
DROP POLICY IF EXISTS "Users can view their own cancellation notifications" ON cancellation_notifications;

-- Create permissive policy for cancellation_notifications
CREATE POLICY "Allow all operations on cancellation_notifications" 
ON cancellation_notifications 
FOR ALL 
USING (true) 
WITH CHECK (true);