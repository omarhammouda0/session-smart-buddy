// Note categories
export type NoteCategory = 'general' | 'progress' | 'challenge' | 'achievement';

// Note type (text, voice, file)
export type NoteType = 'text' | 'voice' | 'file';

// Homework priority
export type HomeworkPriority = 'normal' | 'important' | 'urgent';

// Homework status
export type HomeworkStatusType = 'pending' | 'completed' | 'not_completed';

// Session note interface
export interface SessionNote {
  id: string;
  user_id: string;
  student_id: string;
  session_id: string;
  session_date: string;
  title?: string;
  content?: string;
  category: NoteCategory;
  type: NoteType;
  file_url?: string;
  file_name?: string;
  file_size?: number;
  file_type?: string;
  duration?: number; // for voice notes in seconds
  created_at: string;
  updated_at: string;
}

// Homework interface
export interface Homework {
  id: string;
  user_id: string;
  student_id: string;
  session_id: string;
  session_date: string;
  description: string;
  due_date: string;
  priority: HomeworkPriority;
  status: HomeworkStatusType;
  completed_at?: string;
  voice_instruction_url?: string;
  voice_instruction_duration?: number;
  created_at: string;
  updated_at: string;
  attachments?: HomeworkAttachment[];
}

// Homework attachment interface
export interface HomeworkAttachment {
  id: string;
  homework_id: string;
  file_url: string;
  file_name: string;
  file_size?: number;
  file_type?: string;
  created_at: string;
}

// Category labels
export const NOTE_CATEGORY_LABELS: Record<NoteCategory, string> = {
  general: 'عام',
  progress: 'تقدم',
  challenge: 'تحدي',
  achievement: 'إنجاز',
};

// Category colors
export const NOTE_CATEGORY_COLORS: Record<NoteCategory, { bg: string; text: string; border: string }> = {
  general: { bg: 'bg-muted', text: 'text-muted-foreground', border: 'border-border' },
  progress: { bg: 'bg-success/10', text: 'text-success', border: 'border-success/30' },
  challenge: { bg: 'bg-warning/10', text: 'text-warning', border: 'border-warning/30' },
  achievement: { bg: 'bg-primary/10', text: 'text-primary', border: 'border-primary/30' },
};

// Priority labels
export const HOMEWORK_PRIORITY_LABELS: Record<HomeworkPriority, string> = {
  normal: 'عادي',
  important: 'مهم',
  urgent: 'عاجل',
};

// Priority colors
export const HOMEWORK_PRIORITY_COLORS: Record<HomeworkPriority, { bg: string; text: string; border: string }> = {
  normal: { bg: 'bg-muted', text: 'text-muted-foreground', border: 'border-border' },
  important: { bg: 'bg-warning/10', text: 'text-warning', border: 'border-warning/30' },
  urgent: { bg: 'bg-destructive/10', text: 'text-destructive', border: 'border-destructive/30' },
};

// Status labels
export const HOMEWORK_STATUS_LABELS: Record<HomeworkStatusType, string> = {
  pending: 'قيد الانتظار',
  completed: 'مكتمل',
  not_completed: 'لم يكتمل',
};
