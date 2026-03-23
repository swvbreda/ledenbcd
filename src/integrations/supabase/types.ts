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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      board_members: {
        Row: {
          bond_email: string | null
          coffeeshop: string | null
          coffeeshop_plaats: string | null
          created_at: string
          email: string | null
          functie: string
          geboortedatum: string | null
          id: string
          lid_id: number | null
          lid_ids: number[] | null
          naam: string
          prive_adres: string | null
          prive_plaats: string | null
          prive_postcode: string | null
          sort_order: number
          telefoon: string | null
          type: string
          updated_at: string
        }
        Insert: {
          bond_email?: string | null
          coffeeshop?: string | null
          coffeeshop_plaats?: string | null
          created_at?: string
          email?: string | null
          functie: string
          geboortedatum?: string | null
          id?: string
          lid_id?: number | null
          lid_ids?: number[] | null
          naam: string
          prive_adres?: string | null
          prive_plaats?: string | null
          prive_postcode?: string | null
          sort_order?: number
          telefoon?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          bond_email?: string | null
          coffeeshop?: string | null
          coffeeshop_plaats?: string | null
          created_at?: string
          email?: string | null
          functie?: string
          geboortedatum?: string | null
          id?: string
          lid_id?: number | null
          lid_ids?: number[] | null
          naam?: string
          prive_adres?: string | null
          prive_plaats?: string | null
          prive_postcode?: string | null
          sort_order?: number
          telefoon?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      lead_conversions: {
        Row: {
          created_at: string
          created_by: string
          factuur_adres: string | null
          factuur_bedrijfsnaam: string | null
          factuur_email: string | null
          factuur_kvk: string | null
          factuur_plaats: string | null
          factuur_postcode: string | null
          id: string
          lead_id: number
          lid_sinds: number | null
          lidnummer: number
        }
        Insert: {
          created_at?: string
          created_by: string
          factuur_adres?: string | null
          factuur_bedrijfsnaam?: string | null
          factuur_email?: string | null
          factuur_kvk?: string | null
          factuur_plaats?: string | null
          factuur_postcode?: string | null
          id?: string
          lead_id: number
          lid_sinds?: number | null
          lidnummer: number
        }
        Update: {
          created_at?: string
          created_by?: string
          factuur_adres?: string | null
          factuur_bedrijfsnaam?: string | null
          factuur_email?: string | null
          factuur_kvk?: string | null
          factuur_plaats?: string | null
          factuur_postcode?: string | null
          id?: string
          lead_id?: number
          lid_sinds?: number | null
          lidnummer?: number
        }
        Relationships: []
      }
      member_allowed_emails: {
        Row: {
          email: string
          id: string
          member_id: number
        }
        Insert: {
          email: string
          id?: string
          member_id: number
        }
        Update: {
          email?: string
          id?: string
          member_id?: number
        }
        Relationships: []
      }
      member_edit_requests: {
        Row: {
          created_at: string
          data: Json
          id: string
          member_id: number
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["edit_request_status"]
          submitted_by: string
        }
        Insert: {
          created_at?: string
          data?: Json
          id?: string
          member_id: number
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["edit_request_status"]
          submitted_by: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          member_id?: number
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["edit_request_status"]
          submitted_by?: string
        }
        Relationships: []
      }
      member_edits: {
        Row: {
          data: Json
          id: string
          member_id: number
          updated_at: string
          updated_by: string
        }
        Insert: {
          data?: Json
          id?: string
          member_id: number
          updated_at?: string
          updated_by: string
        }
        Update: {
          data?: Json
          id?: string
          member_id?: number
          updated_at?: string
          updated_by?: string
        }
        Relationships: []
      }
      member_mailing_preferences: {
        Row: {
          created_at: string
          email: string
          id: string
          member_id: number
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          member_id: number
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          member_id?: number
        }
        Relationships: []
      }
      member_notes: {
        Row: {
          created_at: string
          created_by: string
          id: string
          member_id: number
          note: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          member_id: number
          note: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          member_id?: number
          note?: string
        }
        Relationships: []
      }
      member_profiles: {
        Row: {
          created_at: string
          id: string
          member_id: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          member_id: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          member_id?: number
          user_id?: string
        }
        Relationships: []
      }
      push_device_tokens: {
        Row: {
          created_at: string
          device_token: string
          id: string
          platform: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_token: string
          id?: string
          platform?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_token?: string
          id?: string
          platform?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      survey_completions: {
        Row: {
          completed_at: string
          id: string
          survey_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          id?: string
          survey_id: string
          user_id: string
        }
        Update: {
          completed_at?: string
          id?: string
          survey_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_completions_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_questions: {
        Row: {
          id: string
          options: Json | null
          question_text: string
          question_type: string
          required: boolean
          sort_order: number
          survey_id: string
        }
        Insert: {
          id?: string
          options?: Json | null
          question_text: string
          question_type?: string
          required?: boolean
          sort_order?: number
          survey_id: string
        }
        Update: {
          id?: string
          options?: Json | null
          question_text?: string
          question_type?: string
          required?: boolean
          sort_order?: number
          survey_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_questions_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_responses: {
        Row: {
          answer: Json
          id: string
          question_id: string
          submitted_at: string
          survey_id: string
        }
        Insert: {
          answer?: Json
          id?: string
          question_id: string
          submitted_at?: string
          survey_id: string
        }
        Update: {
          answer?: Json
          id?: string
          question_id?: string
          submitted_at?: string
          survey_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_responses_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "survey_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_responses_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      surveys: {
        Row: {
          active: boolean
          created_at: string
          created_by: string
          description: string | null
          id: string
          title: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          title: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          title?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_board_members_public: {
        Args: never
        Returns: {
          bond_email: string
          coffeeshop: string
          coffeeshop_plaats: string
          created_at: string
          email: string
          functie: string
          id: string
          lid_id: number
          lid_ids: number[]
          naam: string
          sort_order: number
          telefoon: string
          type: string
          updated_at: string
        }[]
      }
      get_member_id_for_email: { Args: { _email: string }; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      edit_request_status: "pending" | "approved" | "rejected"
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
      app_role: ["admin", "user"],
      edit_request_status: ["pending", "approved", "rejected"],
    },
  },
} as const
