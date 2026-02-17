ALTER TABLE student_groups ADD COLUMN IF NOT EXISTS location JSONB DEFAULT NULL;

COMMENT ON COLUMN student_groups.location IS 'JSON object with lat, lng, address, and name fields for onsite group session locations';