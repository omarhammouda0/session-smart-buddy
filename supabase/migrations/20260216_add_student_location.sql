-- Add location column to students table for storing geographic coordinates
-- This enables proximity-based scheduling suggestions

ALTER TABLE students ADD COLUMN IF NOT EXISTS location JSONB DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN students.location IS 'JSON object with lat, lng, address, and name fields for onsite session locations';

-- Create index for faster queries (optional, for future use)
CREATE INDEX IF NOT EXISTS idx_students_location ON students USING GIN (location) WHERE location IS NOT NULL;

