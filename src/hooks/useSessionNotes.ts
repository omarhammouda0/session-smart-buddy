import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SessionNote, Homework, HomeworkAttachment, NoteCategory, NoteType, HomeworkPriority, HomeworkStatusType } from '@/types/notes';
import { toast } from 'sonner';

export function useSessionNotes(studentId?: string, sessionId?: string) {
  const [notes, setNotes] = useState<SessionNote[]>([]);
  const [homework, setHomework] = useState<Homework[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Get current user ID
  const getUserId = useCallback(async (): Promise<string | null> => {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      console.error("Auth error:", error);
      return null;
    }
    return data.user?.id ?? null;
  }, []);

  // Initialize user ID
  useEffect(() => {
    const init = async () => {
      const uid = await getUserId();
      setUserId(uid);
    };
    init();
  }, [getUserId]);

  // Fetch notes for a student or session
  const fetchNotes = useCallback(async () => {
    if (!userId) return;

    setIsLoading(true);
    try {
      let query = supabase
        .from('session_notes')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (studentId) {
        query = query.eq('student_id', studentId);
      }
      if (sessionId) {
        query = query.eq('session_id', sessionId);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      // Map database types to our types
      const mappedNotes: SessionNote[] = (data || []).map(note => ({
        ...note,
        category: note.category as NoteCategory,
        type: note.type as NoteType,
        include_in_report: note.include_in_report ?? true,
      }));
      
      setNotes(mappedNotes);
    } catch (error) {
      console.error('Error fetching notes:', error);
    } finally {
      setIsLoading(false);
    }
  }, [studentId, sessionId, userId]);

  // Fetch homework for a student or session
  const fetchHomework = useCallback(async () => {
    if (!userId) return;

    try {
      let query = supabase
        .from('homework')
        .select('*')
        .eq('user_id', userId)
        .order('due_date', { ascending: true });

      if (studentId) {
        query = query.eq('student_id', studentId);
      }
      if (sessionId) {
        query = query.eq('session_id', sessionId);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch attachments for each homework
      const homeworkWithAttachments: Homework[] = await Promise.all(
        (data || []).map(async (hw) => {
          const { data: attachments } = await supabase
            .from('homework_attachments')
            .select('*')
            .eq('homework_id', hw.id);
          
          return {
            ...hw,
            priority: hw.priority as HomeworkPriority,
            status: hw.status as HomeworkStatusType,
            include_in_report: hw.include_in_report ?? true,
            attachments: attachments || [],
          } as Homework;
        })
      );

      setHomework(homeworkWithAttachments);
    } catch (error) {
      console.error('Error fetching homework:', error);
    }
  }, [studentId, sessionId, userId]);

  // Load data when userId is available
  useEffect(() => {
    if (userId) {
      fetchNotes();
      fetchHomework();
    }
  }, [userId, fetchNotes, fetchHomework]);

  // Add text note
  const addTextNote = async (params: {
    studentId: string;
    sessionId: string;
    sessionDate: string;
    title?: string;
    content: string;
    category: NoteCategory;
    includeInReport?: boolean;
  }) => {
    const currentUserId = userId || await getUserId();
    if (!currentUserId) {
      toast.error('يجب تسجيل الدخول أولاً');
      return false;
    }

    try {
      const { error } = await supabase.from('session_notes').insert({
        user_id: currentUserId,
        student_id: params.studentId,
        session_id: params.sessionId,
        session_date: params.sessionDate,
        title: params.title,
        content: params.content,
        category: params.category,
        type: 'text',
        include_in_report: params.includeInReport ?? true,
      });

      if (error) throw error;
      toast.success('تم حفظ الملاحظة');
      fetchNotes();
      return true;
    } catch (error) {
      console.error('Error adding note:', error);
      toast.error('فشل حفظ الملاحظة');
      return false;
    }
  };

  // Add voice note
  const addVoiceNote = async (params: {
    studentId: string;
    sessionId: string;
    sessionDate: string;
    title?: string;
    audioBlob: Blob;
    duration: number;
  }) => {
    const currentUserId = userId || await getUserId();
    if (!currentUserId) {
      toast.error('يجب تسجيل الدخول أولاً');
      return false;
    }

    try {
      // Upload audio file to storage
      const fileName = `voice-notes/${params.studentId}/${params.sessionId}/${Date.now()}.webm`;
      const { error: uploadError } = await supabase.storage
        .from('session-attachments')
        .upload(fileName, params.audioBlob, {
          contentType: 'audio/webm',
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('session-attachments')
        .getPublicUrl(fileName);

      // Save note to database
      const { error } = await supabase.from('session_notes').insert({
        user_id: currentUserId,
        student_id: params.studentId,
        session_id: params.sessionId,
        session_date: params.sessionDate,
        title: params.title,
        type: 'voice',
        category: 'general',
        file_url: publicUrl,
        file_name: fileName,
        file_size: params.audioBlob.size,
        file_type: 'audio/webm',
        duration: params.duration,
      });

      if (error) {
        // Clean up orphaned file in storage
        await supabase.storage.from('session-attachments').remove([fileName]);
        throw error;
      }
      toast.success('تم حفظ التسجيل الصوتي');
      fetchNotes();
      return true;
    } catch (error) {
      console.error('Error adding voice note:', error);
      toast.error('فشل حفظ التسجيل الصوتي');
      return false;
    }
  };

  // Add file attachment
  const addFileNote = async (params: {
    studentId: string;
    sessionId: string;
    sessionDate: string;
    file: File;
    description?: string;
  }) => {
    const currentUserId = userId || await getUserId();
    if (!currentUserId) {
      toast.error('يجب تسجيل الدخول أولاً');
      return false;
    }

    try {
      // Upload file to storage
      const fileName = `files/${params.studentId}/${params.sessionId}/${Date.now()}-${params.file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('session-attachments')
        .upload(fileName, params.file, {
          contentType: params.file.type,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('session-attachments')
        .getPublicUrl(fileName);

      // Save note to database
      const { error } = await supabase.from('session_notes').insert({
        user_id: currentUserId,
        student_id: params.studentId,
        session_id: params.sessionId,
        session_date: params.sessionDate,
        title: params.description,
        type: 'file',
        category: 'general',
        file_url: publicUrl,
        file_name: params.file.name,
        file_size: params.file.size,
        file_type: params.file.type,
      });

      if (error) {
        // Clean up orphaned file in storage
        await supabase.storage.from('session-attachments').remove([fileName]);
        throw error;
      }
      toast.success('تم رفع الملف');
      fetchNotes();
      return true;
    } catch (error) {
      console.error('Error adding file:', error);
      toast.error('فشل رفع الملف');
      return false;
    }
  };

  // Update note
  const updateNote = async (noteId: string, updates: Partial<SessionNote>) => {
    try {
      const { error } = await supabase
        .from('session_notes')
        .update(updates)
        .eq('id', noteId);

      if (error) throw error;
      toast.success('تم تحديث الملاحظة');
      fetchNotes();
      return true;
    } catch (error) {
      console.error('Error updating note:', error);
      toast.error('فشل تحديث الملاحظة');
      return false;
    }
  };

  // Delete note
  const deleteNote = async (noteId: string) => {
    try {
      // First get the note to check if it has a file
      const note = notes.find(n => n.id === noteId);
      if (note?.file_name) {
        // Delete file from storage
        await supabase.storage
          .from('session-attachments')
          .remove([note.file_name]);
      }

      const { error } = await supabase
        .from('session_notes')
        .delete()
        .eq('id', noteId);

      if (error) throw error;
      toast.success('تم حذف الملاحظة');
      fetchNotes();
      return true;
    } catch (error) {
      console.error('Error deleting note:', error);
      toast.error('فشل حذف الملاحظة');
      return false;
    }
  };

  // Add homework
  const addHomework = async (params: {
    studentId: string;
    sessionId: string;
    sessionDate: string;
    description: string;
    dueDate: string;
    priority: HomeworkPriority;
    includeInReport?: boolean;
    voiceBlob?: Blob;
    voiceDuration?: number;
    files?: File[];
  }) => {
    const currentUserId = userId || await getUserId();
    if (!currentUserId) {
      toast.error('يجب تسجيل الدخول أولاً');
      return false;
    }

    try {
      let voiceUrl: string | undefined;

      // Upload voice instruction if provided
      if (params.voiceBlob) {
        const voiceFileName = `homework-voice/${params.studentId}/${Date.now()}.webm`;
        const { error: uploadError } = await supabase.storage
          .from('session-attachments')
          .upload(voiceFileName, params.voiceBlob, {
            contentType: 'audio/webm',
          });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('session-attachments')
          .getPublicUrl(voiceFileName);
        voiceUrl = publicUrl;
      }

      // Create homework record
      const { data: hwData, error } = await supabase
        .from('homework')
        .insert({
          user_id: currentUserId,
          student_id: params.studentId,
          session_id: params.sessionId,
          session_date: params.sessionDate,
          description: params.description,
          due_date: params.dueDate,
          priority: params.priority,
          status: 'pending',
          include_in_report: params.includeInReport ?? true,
          voice_instruction_url: voiceUrl,
          voice_instruction_duration: params.voiceDuration,
        })
        .select()
        .single();

      if (error) throw error;

      // Upload attachments if provided
      if (params.files && params.files.length > 0) {
        for (const file of params.files) {
          const fileName = `homework-files/${params.studentId}/${hwData.id}/${Date.now()}-${file.name}`;
          const { error: uploadError } = await supabase.storage
            .from('session-attachments')
            .upload(fileName, file, {
              contentType: file.type,
            });

          if (uploadError) {
            console.error('Error uploading attachment:', uploadError);
            continue;
          }

          const { data: { publicUrl } } = supabase.storage
            .from('session-attachments')
            .getPublicUrl(fileName);

          await supabase.from('homework_attachments').insert({
            homework_id: hwData.id,
            file_url: publicUrl,
            file_name: file.name,
            file_size: file.size,
            file_type: file.type,
          });
        }
      }

      toast.success('تم إضافة الواجب المنزلي');
      fetchHomework();
      return true;
    } catch (error) {
      console.error('Error adding homework:', error);
      toast.error('فشل إضافة الواجب');
      return false;
    }
  };

  // Update homework status
  const updateHomeworkStatus = async (homeworkId: string, status: HomeworkStatusType) => {
    try {
      const updates: Record<string, unknown> = { status };
      if (status === 'completed') {
        updates.completed_at = new Date().toISOString();
      } else {
        updates.completed_at = null;
      }

      const { error } = await supabase
        .from('homework')
        .update(updates)
        .eq('id', homeworkId);

      if (error) throw error;
      toast.success('تم تحديث حالة الواجب');
      fetchHomework();
      return true;
    } catch (error) {
      console.error('Error updating homework:', error);
      toast.error('فشل تحديث الواجب');
      return false;
    }
  };

  // Delete homework
  const deleteHomework = async (homeworkId: string) => {
    try {
      const { error } = await supabase
        .from('homework')
        .delete()
        .eq('id', homeworkId);

      if (error) throw error;
      toast.success('تم حذف الواجب');
      fetchHomework();
      return true;
    } catch (error) {
      console.error('Error deleting homework:', error);
      toast.error('فشل حذف الواجب');
      return false;
    }
  };

  // Update note report inclusion
  const updateNoteReportInclusion = async (noteId: string, include: boolean) => {
    try {
      const { error } = await supabase
        .from('session_notes')
        .update({ include_in_report: include })
        .eq('id', noteId);

      if (error) throw error;
      
      // Update local state
      setNotes(prev => prev.map(n => 
        n.id === noteId ? { ...n, include_in_report: include } : n
      ));
      
      toast.success(include ? 'ستظهر في التقرير' : 'تم استبعادها من التقرير');
      return true;
    } catch (error) {
      console.error('Error updating note:', error);
      toast.error('فشل التحديث');
      return false;
    }
  };

  // Update homework report inclusion
  const updateHomeworkReportInclusion = async (homeworkId: string, include: boolean) => {
    try {
      const { error } = await supabase
        .from('homework')
        .update({ include_in_report: include })
        .eq('id', homeworkId);

      if (error) throw error;
      
      // Update local state
      setHomework(prev => prev.map(h => 
        h.id === homeworkId ? { ...h, include_in_report: include } : h
      ));
      
      toast.success(include ? 'سيظهر في التقرير' : 'تم استبعاده من التقرير');
      return true;
    } catch (error) {
      console.error('Error updating homework:', error);
      toast.error('فشل التحديث');
      return false;
    }
  };

  return {
    notes,
    homework,
    isLoading,
    addTextNote,
    addVoiceNote,
    addFileNote,
    updateNote,
    deleteNote,
    addHomework,
    updateHomeworkStatus,
    deleteHomework,
    updateNoteReportInclusion,
    updateHomeworkReportInclusion,
    refetch: () => {
      fetchNotes();
      fetchHomework();
    },
  };
}
