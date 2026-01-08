export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      cancellation_notifications: {
        Row: {
          created_at: string
          delivery_status: string
          error_message: string | null
          id: string
          message_text: string
          month: string
          parent_phone: string
          sent_at: string
          student_id: string
          triggered_by: string
          twilio_message_sid: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          delivery_status?: string
          error_message?: string | null
          id?: string
          message_text: string
          month: string
          parent_phone: string
          sent_at?: string
          student_id: string
          triggered_by?: string
          twilio_message_sid?: string | null
          user_id?: string
        }
        Update: {
          created_at?: string
          delivery_status?: string
          error_message?: string | null
          id?: string
          message_text?: string
          month?: string
          parent_phone?: string
          sent_at?: string
          student_id?: string
          triggered_by?: string
          twilio_message_sid?: string | null
          user_id?: string
        }
        Relationships: []
      }
      homework: {
        Row: {
          completed_at: string | null
          created_at: string
          description: string
          due_date: string
          id: string
          include_in_report: boolean
          priority: Database["public"]["Enums"]["homework_priority"]
          session_date: string
          session_id: string
          status: Database["public"]["Enums"]["homework_status_type"]
          student_id: string
          updated_at: string
          user_id: string
          voice_instruction_duration: number | null
          voice_instruction_url: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          description: string
          due_date: string
          id?: string
          include_in_report?: boolean
          priority?: Database["public"]["Enums"]["homework_priority"]
          session_date: string
          session_id: string
          status?: Database["public"]["Enums"]["homework_status_type"]
          student_id: string
          updated_at?: string
          user_id?: string
          voice_instruction_duration?: number | null
          voice_instruction_url?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          description?: string
          due_date?: string
          id?: string
          include_in_report?: boolean
          priority?: Database["public"]["Enums"]["homework_priority"]
          session_date?: string
          session_id?: string
          status?: Database["public"]["Enums"]["homework_status_type"]
          student_id?: string
          updated_at?: string
          user_id?: string
          voice_instruction_duration?: number | null
          voice_instruction_url?: string | null
        }
        Relationships: []
      }
      homework_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          homework_id: string
          id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          homework_id: string
          id?: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          homework_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "homework_attachments_homework_id_fkey"
            columns: ["homework_id"]
            isOneToOne: false
            referencedRelation: "homework"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reminder_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_text: string
          month: number | null
          phone_number: string
          sent_at: string
          session_date: string | null
          session_id: string | null
          status: string
          student_id: string
          student_name: string
          twilio_message_sid: string | null
          type: string
          user_id: string
          year: number | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_text: string
          month?: number | null
          phone_number: string
          sent_at?: string
          session_date?: string | null
          session_id?: string | null
          status: string
          student_id: string
          student_name: string
          twilio_message_sid?: string | null
          type: string
          user_id?: string
          year?: number | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_text?: string
          month?: number | null
          phone_number?: string
          sent_at?: string
          session_date?: string | null
          session_id?: string | null
          status?: string
          student_id?: string
          student_name?: string
          twilio_message_sid?: string | null
          type?: string
          user_id?: string
          year?: number | null
        }
        Relationships: []
      }
      reminder_settings: {
        Row: {
          cancellation_reminder_template: string
          cancellation_reminders_enabled: boolean
          created_at: string
          id: string
          payment_reminder_days_before: number
          payment_reminder_template: string
          payment_reminders_enabled: boolean
          session_reminder_hours: number
          session_reminder_send_time: string
          session_reminder_template: string
          session_reminders_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          cancellation_reminder_template?: string
          cancellation_reminders_enabled?: boolean
          created_at?: string
          id?: string
          payment_reminder_days_before?: number
          payment_reminder_template?: string
          payment_reminders_enabled?: boolean
          session_reminder_hours?: number
          session_reminder_send_time?: string
          session_reminder_template?: string
          session_reminders_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Update: {
          cancellation_reminder_template?: string
          cancellation_reminders_enabled?: boolean
          created_at?: string
          id?: string
          payment_reminder_days_before?: number
          payment_reminder_template?: string
          payment_reminders_enabled?: boolean
          session_reminder_hours?: number
          session_reminder_send_time?: string
          session_reminder_template?: string
          session_reminders_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      session_cancellations: {
        Row: {
          cancelled_at: string
          created_at: string
          id: string
          month: string
          reason: string | null
          session_date: string
          session_time: string | null
          student_id: string
          user_id: string
        }
        Insert: {
          cancelled_at?: string
          created_at?: string
          id?: string
          month: string
          reason?: string | null
          session_date: string
          session_time?: string | null
          student_id: string
          user_id?: string
        }
        Update: {
          cancelled_at?: string
          created_at?: string
          id?: string
          month?: string
          reason?: string | null
          session_date?: string
          session_time?: string | null
          student_id?: string
          user_id?: string
        }
        Relationships: []
      }
      session_notes: {
        Row: {
          category: Database["public"]["Enums"]["note_category"]
          content: string | null
          created_at: string
          duration: number | null
          file_name: string | null
          file_size: number | null
          file_type: string | null
          file_url: string | null
          id: string
          include_in_report: boolean
          session_date: string
          session_id: string
          student_id: string
          title: string | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["note_category"]
          content?: string | null
          created_at?: string
          duration?: number | null
          file_name?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          include_in_report?: boolean
          session_date: string
          session_id: string
          student_id: string
          title?: string | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["note_category"]
          content?: string | null
          created_at?: string
          duration?: number | null
          file_name?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          include_in_report?: boolean
          session_date?: string
          session_id?: string
          student_id?: string
          title?: string | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      student_cancellation_tracking: {
        Row: {
          cancellation_count: number
          created_at: string
          id: string
          limit_at_time: number | null
          limit_reached_date: string | null
          month: string
          parent_notified: boolean
          parent_notified_at: string | null
          student_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cancellation_count?: number
          created_at?: string
          id?: string
          limit_at_time?: number | null
          limit_reached_date?: string | null
          month: string
          parent_notified?: boolean
          parent_notified_at?: string | null
          student_id: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          cancellation_count?: number
          created_at?: string
          id?: string
          limit_at_time?: number | null
          limit_reached_date?: string | null
          month?: string
          parent_notified?: boolean
          parent_notified_at?: string | null
          student_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      homework_priority: "normal" | "important" | "urgent"
      homework_status_type: "pending" | "completed" | "not_completed"
      note_category: "general" | "progress" | "challenge" | "achievement"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      homework_priority: ["normal", "important", "urgent"],
      homework_status_type: ["pending", "completed", "not_completed"],
      note_category: ["general", "progress", "challenge", "achievement"],
    },
  },
} as const
