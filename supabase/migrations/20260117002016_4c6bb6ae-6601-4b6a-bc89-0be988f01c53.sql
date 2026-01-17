-- Migration: Add student_materials and notification_settings tables
-- Version: 20260116_student_materials_and_notification_settings

-- =============================================
-- 1. STUDENT MATERIALS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS public.student_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    student_id UUID NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('text', 'file')),
    title TEXT NOT NULL,
    content TEXT,
    file_url TEXT,
    file_name TEXT,
    file_size INTEGER,
    file_type TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for student_materials
CREATE INDEX IF NOT EXISTS idx_student_materials_user_id ON public.student_materials(user_id);
CREATE INDEX IF NOT EXISTS idx_student_materials_student_id ON public.student_materials(student_id);

-- Enable RLS for student_materials
ALTER TABLE public.student_materials ENABLE ROW LEVEL SECURITY;

-- RLS Policies for student_materials
CREATE POLICY "Users can view their own student materials"
    ON public.student_materials FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own student materials"
    ON public.student_materials FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own student materials"
    ON public.student_materials FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own student materials"
    ON public.student_materials FOR DELETE
    USING (auth.uid() = user_id);

-- =============================================
-- 2. NOTIFICATION SETTINGS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS public.notification_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    session_notifications_enabled BOOLEAN DEFAULT true,
    session_notification_minutes_before INTEGER DEFAULT 60,
    session_notification_sound_enabled BOOLEAN DEFAULT true,
    ended_session_alerts_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for notification_settings
CREATE INDEX IF NOT EXISTS idx_notification_settings_user_id ON public.notification_settings(user_id);

-- Enable RLS for notification_settings
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for notification_settings
CREATE POLICY "Users can view their own notification settings"
    ON public.notification_settings FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notification settings"
    ON public.notification_settings FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notification settings"
    ON public.notification_settings FOR UPDATE
    USING (auth.uid() = user_id);

-- =============================================
-- 3. UPDATE TRIGGERS
-- =============================================

CREATE OR REPLACE FUNCTION update_student_materials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_student_materials_updated_at ON public.student_materials;
CREATE TRIGGER trigger_student_materials_updated_at
    BEFORE UPDATE ON public.student_materials
    FOR EACH ROW
    EXECUTE FUNCTION update_student_materials_updated_at();

CREATE OR REPLACE FUNCTION update_notification_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_notification_settings_updated_at ON public.notification_settings;
CREATE TRIGGER trigger_notification_settings_updated_at
    BEFORE UPDATE ON public.notification_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_notification_settings_updated_at();