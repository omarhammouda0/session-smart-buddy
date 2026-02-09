-- Create student_groups table
CREATE TABLE IF NOT EXISTS student_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT 'blue',
  default_price_per_student NUMERIC NOT NULL DEFAULT 80,
  session_type TEXT NOT NULL CHECK (session_type IN ('online', 'onsite')),
  session_duration INTEGER NOT NULL DEFAULT 60,
  session_time TEXT NOT NULL DEFAULT '16:00',
  semester_start DATE NOT NULL,
  semester_end DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create group_members table
CREATE TABLE IF NOT EXISTS group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES student_groups(id) ON DELETE CASCADE,
  student_id UUID, -- Can be null if member is not linked to existing student
  student_name TEXT NOT NULL,
  phone TEXT,
  parent_phone TEXT,
  custom_price NUMERIC, -- Override group default price
  is_active BOOLEAN NOT NULL DEFAULT true,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create group_schedule_days table (for weekly schedule)
CREATE TABLE IF NOT EXISTS group_schedule_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES student_groups(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  time TEXT NOT NULL,
  UNIQUE(group_id, day_of_week)
);

-- Create group_sessions table
CREATE TABLE IF NOT EXISTS group_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES student_groups(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  time TEXT NOT NULL,
  duration INTEGER NOT NULL DEFAULT 60,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'vacation')),
  completed_at TIMESTAMPTZ,
  notes TEXT,
  topic TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(group_id, date)
);

-- Create group_session_attendance table (per-member attendance)
CREATE TABLE IF NOT EXISTS group_session_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES group_sessions(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES group_members(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'absent', 'excused')),
  note TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(session_id, member_id)
);

-- Enable RLS on all tables
ALTER TABLE student_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_schedule_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_session_attendance ENABLE ROW LEVEL SECURITY;

-- RLS policies for student_groups
CREATE POLICY "Users can view their own groups"
  ON student_groups FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own groups"
  ON student_groups FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own groups"
  ON student_groups FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own groups"
  ON student_groups FOR DELETE
  USING (auth.uid() = user_id);

-- RLS policies for group_members (via group ownership)
CREATE POLICY "Users can view members of their groups"
  ON group_members FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM student_groups WHERE id = group_members.group_id AND user_id = auth.uid()
  ));

CREATE POLICY "Users can insert members to their groups"
  ON group_members FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM student_groups WHERE id = group_members.group_id AND user_id = auth.uid()
  ));

CREATE POLICY "Users can update members of their groups"
  ON group_members FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM student_groups WHERE id = group_members.group_id AND user_id = auth.uid()
  ));

CREATE POLICY "Users can delete members from their groups"
  ON group_members FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM student_groups WHERE id = group_members.group_id AND user_id = auth.uid()
  ));

-- RLS policies for group_schedule_days
CREATE POLICY "Users can view schedule of their groups"
  ON group_schedule_days FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM student_groups WHERE id = group_schedule_days.group_id AND user_id = auth.uid()
  ));

CREATE POLICY "Users can insert schedule to their groups"
  ON group_schedule_days FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM student_groups WHERE id = group_schedule_days.group_id AND user_id = auth.uid()
  ));

CREATE POLICY "Users can update schedule of their groups"
  ON group_schedule_days FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM student_groups WHERE id = group_schedule_days.group_id AND user_id = auth.uid()
  ));

CREATE POLICY "Users can delete schedule from their groups"
  ON group_schedule_days FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM student_groups WHERE id = group_schedule_days.group_id AND user_id = auth.uid()
  ));

-- RLS policies for group_sessions
CREATE POLICY "Users can view sessions of their groups"
  ON group_sessions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM student_groups WHERE id = group_sessions.group_id AND user_id = auth.uid()
  ));

CREATE POLICY "Users can insert sessions to their groups"
  ON group_sessions FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM student_groups WHERE id = group_sessions.group_id AND user_id = auth.uid()
  ));

CREATE POLICY "Users can update sessions of their groups"
  ON group_sessions FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM student_groups WHERE id = group_sessions.group_id AND user_id = auth.uid()
  ));

CREATE POLICY "Users can delete sessions from their groups"
  ON group_sessions FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM student_groups WHERE id = group_sessions.group_id AND user_id = auth.uid()
  ));

-- RLS policies for group_session_attendance
CREATE POLICY "Users can view attendance of their groups"
  ON group_session_attendance FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM group_sessions gs
    JOIN student_groups sg ON sg.id = gs.group_id
    WHERE gs.id = group_session_attendance.session_id AND sg.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert attendance to their groups"
  ON group_session_attendance FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM group_sessions gs
    JOIN student_groups sg ON sg.id = gs.group_id
    WHERE gs.id = group_session_attendance.session_id AND sg.user_id = auth.uid()
  ));

CREATE POLICY "Users can update attendance of their groups"
  ON group_session_attendance FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM group_sessions gs
    JOIN student_groups sg ON sg.id = gs.group_id
    WHERE gs.id = group_session_attendance.session_id AND sg.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete attendance from their groups"
  ON group_session_attendance FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM group_sessions gs
    JOIN student_groups sg ON sg.id = gs.group_id
    WHERE gs.id = group_session_attendance.session_id AND sg.user_id = auth.uid()
  ));

-- Create indexes for performance
CREATE INDEX idx_student_groups_user_id ON student_groups(user_id);
CREATE INDEX idx_group_members_group_id ON group_members(group_id);
CREATE INDEX idx_group_schedule_days_group_id ON group_schedule_days(group_id);
CREATE INDEX idx_group_sessions_group_id ON group_sessions(group_id);
CREATE INDEX idx_group_sessions_date ON group_sessions(date);
CREATE INDEX idx_group_session_attendance_session_id ON group_session_attendance(session_id);
CREATE INDEX idx_group_session_attendance_member_id ON group_session_attendance(member_id);

-- Create updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers
CREATE TRIGGER update_student_groups_updated_at
  BEFORE UPDATE ON student_groups
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_group_session_attendance_updated_at
  BEFORE UPDATE ON group_session_attendance
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

