-- Create storage bucket for session attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('session-attachments', 'session-attachments', true);

-- Storage policies for session attachments
CREATE POLICY "Anyone can view session attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'session-attachments');

CREATE POLICY "Anyone can upload session attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'session-attachments');

CREATE POLICY "Anyone can update session attachments"
ON storage.objects FOR UPDATE
USING (bucket_id = 'session-attachments');

CREATE POLICY "Anyone can delete session attachments"
ON storage.objects FOR DELETE
USING (bucket_id = 'session-attachments');

-- Create note categories enum
CREATE TYPE public.note_category AS ENUM ('general', 'progress', 'challenge', 'achievement');

-- Create homework priority enum
CREATE TYPE public.homework_priority AS ENUM ('normal', 'important', 'urgent');

-- Create homework status enum
CREATE TYPE public.homework_status_type AS ENUM ('pending', 'completed', 'not_completed');

-- Create session notes table
CREATE TABLE public.session_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'default',
  student_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  session_date TEXT NOT NULL,
  title TEXT,
  content TEXT,
  category note_category NOT NULL DEFAULT 'general',
  type TEXT NOT NULL DEFAULT 'text', -- 'text', 'voice', 'file'
  file_url TEXT,
  file_name TEXT,
  file_size INTEGER,
  file_type TEXT,
  duration INTEGER, -- for voice notes in seconds
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create homework table
CREATE TABLE public.homework (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'default',
  student_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  session_date TEXT NOT NULL,
  description TEXT NOT NULL,
  due_date TEXT NOT NULL,
  priority homework_priority NOT NULL DEFAULT 'normal',
  status homework_status_type NOT NULL DEFAULT 'pending',
  completed_at TIMESTAMP WITH TIME ZONE,
  voice_instruction_url TEXT,
  voice_instruction_duration INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create homework attachments table
CREATE TABLE public.homework_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  homework_id UUID NOT NULL REFERENCES public.homework(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.session_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homework ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homework_attachments ENABLE ROW LEVEL SECURITY;

-- RLS policies for session_notes
CREATE POLICY "Allow all operations on session_notes"
ON public.session_notes FOR ALL
USING (true)
WITH CHECK (true);

-- RLS policies for homework
CREATE POLICY "Allow all operations on homework"
ON public.homework FOR ALL
USING (true)
WITH CHECK (true);

-- RLS policies for homework_attachments
CREATE POLICY "Allow all operations on homework_attachments"
ON public.homework_attachments FOR ALL
USING (true)
WITH CHECK (true);

-- Triggers for updated_at
CREATE TRIGGER update_session_notes_updated_at
  BEFORE UPDATE ON public.session_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_homework_updated_at
  BEFORE UPDATE ON public.homework
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_session_notes_student_id ON public.session_notes(student_id);
CREATE INDEX idx_session_notes_session_id ON public.session_notes(session_id);
CREATE INDEX idx_homework_student_id ON public.homework(student_id);
CREATE INDEX idx_homework_session_id ON public.homework(session_id);
CREATE INDEX idx_homework_due_date ON public.homework(due_date);
CREATE INDEX idx_homework_status ON public.homework(status);