-- Create group_member_payments table for tracking payments from group members
CREATE TABLE IF NOT EXISTS group_member_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES student_groups(id) ON DELETE CASCADE,
  session_id UUID REFERENCES group_sessions(id) ON DELETE SET NULL,
  member_id UUID NOT NULL REFERENCES group_members(id) ON DELETE CASCADE,
  linked_student_id UUID REFERENCES students(id) ON DELETE SET NULL, -- If member is linked to a student
  amount NUMERIC NOT NULL CHECK (amount > 0),
  method TEXT NOT NULL DEFAULT 'cash' CHECK (method IN ('cash', 'bank', 'wallet')),
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE group_member_payments ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own group payments"
  ON group_member_payments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own group payments"
  ON group_member_payments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own group payments"
  ON group_member_payments FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own group payments"
  ON group_member_payments FOR DELETE
  USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_group_member_payments_user_id ON group_member_payments(user_id);
CREATE INDEX idx_group_member_payments_group_id ON group_member_payments(group_id);
CREATE INDEX idx_group_member_payments_member_id ON group_member_payments(member_id);
CREATE INDEX idx_group_member_payments_session_id ON group_member_payments(session_id);
CREATE INDEX idx_group_member_payments_linked_student_id ON group_member_payments(linked_student_id);
CREATE INDEX idx_group_member_payments_paid_at ON group_member_payments(paid_at);

