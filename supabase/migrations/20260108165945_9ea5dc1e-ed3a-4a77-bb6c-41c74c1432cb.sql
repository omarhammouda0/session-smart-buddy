-- Add include_in_report field to session_notes table
ALTER TABLE public.session_notes 
ADD COLUMN IF NOT EXISTS include_in_report boolean NOT NULL DEFAULT true;

-- Add include_in_report field to homework table
ALTER TABLE public.homework 
ADD COLUMN IF NOT EXISTS include_in_report boolean NOT NULL DEFAULT true;