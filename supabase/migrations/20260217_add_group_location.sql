-- Add location column to student_groups table for storing geographic coordinates
-- This enables proximity-based scheduling suggestions for groups

ALTER TABLE student_groups ADD COLUMN IF NOT EXISTS location JSONB DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN student_groups.location IS 'JSON object with lat, lng, address, and name fields for onsite group session locations';

