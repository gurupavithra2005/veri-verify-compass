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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      application_status_history: {
        Row: {
          application_id: string
          changed_by: string | null
          created_at: string
          id: string
          new_status: string
          previous_status: string | null
          reason: string | null
        }
        Insert: {
          application_id: string
          changed_by?: string | null
          created_at?: string
          id?: string
          new_status: string
          previous_status?: string | null
          reason?: string | null
        }
        Update: {
          application_id?: string
          changed_by?: string | null
          created_at?: string
          id?: string
          new_status?: string
          previous_status?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "application_status_history_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      applications: {
        Row: {
          academic_year: string | null
          additional_notes: string | null
          application_category: string | null
          application_number: string | null
          application_title: string
          assigned_reviewer_id: string | null
          contact_email: string | null
          contact_person: string | null
          contact_phone: string | null
          created_at: string
          created_by: string
          description: string | null
          district: string | null
          external_reference_number: string | null
          id: string
          institution_address: string | null
          institution_name: string
          institution_registration_number: string | null
          institution_type: string | null
          state: string | null
          status: string
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          academic_year?: string | null
          additional_notes?: string | null
          application_category?: string | null
          application_number?: string | null
          application_title: string
          assigned_reviewer_id?: string | null
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          district?: string | null
          external_reference_number?: string | null
          id?: string
          institution_address?: string | null
          institution_name: string
          institution_registration_number?: string | null
          institution_type?: string | null
          state?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          academic_year?: string | null
          additional_notes?: string | null
          application_category?: string | null
          application_number?: string | null
          application_title?: string
          assigned_reviewer_id?: string | null
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          district?: string | null
          external_reference_number?: string | null
          id?: string
          institution_address?: string | null
          institution_name?: string
          institution_registration_number?: string | null
          institution_type?: string | null
          state?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_assigned_reviewer_id_fkey"
            columns: ["assigned_reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_events: {
        Row: {
          action_type: string
          actor_id: string | null
          actor_role: string | null
          application_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          error_message: string | null
          id: string
          new_value: string | null
          outcome: string
          previous_value: string | null
        }
        Insert: {
          action_type: string
          actor_id?: string | null
          actor_role?: string | null
          application_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          error_message?: string | null
          id?: string
          new_value?: string | null
          outcome?: string
          previous_value?: string | null
        }
        Update: {
          action_type?: string
          actor_id?: string | null
          actor_role?: string | null
          application_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          error_message?: string | null
          id?: string
          new_value?: string | null
          outcome?: string
          previous_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      document_requirements: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          document_category: string
          id: string
          required: boolean
          requirement_name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          document_category: string
          id?: string
          required?: boolean
          requirement_name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          document_category?: string
          id?: string
          required?: boolean
          requirement_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          application_id: string
          document_category: string
          extracted_fields: Json | null
          extracted_text: string | null
          extraction_confidence: number | null
          extraction_error: string | null
          extraction_evidence: Json | null
          extraction_method: string | null
          field_corrections: Json | null
          file_name: string
          file_size: number
          id: string
          is_current: boolean
          mime_type: string
          ocr_status: string
          pages_processed: number | null
          sha256_hash: string | null
          storage_path: string
          updated_at: string
          uploaded_at: string
          uploaded_by: string
          verification_status: string
          version_number: number
        }
        Insert: {
          application_id: string
          document_category: string
          extracted_fields?: Json | null
          extracted_text?: string | null
          extraction_confidence?: number | null
          extraction_error?: string | null
          extraction_evidence?: Json | null
          extraction_method?: string | null
          field_corrections?: Json | null
          file_name: string
          file_size: number
          id?: string
          is_current?: boolean
          mime_type: string
          ocr_status?: string
          pages_processed?: number | null
          sha256_hash?: string | null
          storage_path: string
          updated_at?: string
          uploaded_at?: string
          uploaded_by: string
          verification_status?: string
          version_number?: number
        }
        Update: {
          application_id?: string
          document_category?: string
          extracted_fields?: Json | null
          extracted_text?: string | null
          extraction_confidence?: number | null
          extraction_error?: string | null
          extraction_evidence?: Json | null
          extraction_method?: string | null
          field_corrections?: Json | null
          file_name?: string
          file_size?: number
          id?: string
          is_current?: boolean
          mime_type?: string
          ocr_status?: string
          pages_processed?: number | null
          sha256_hash?: string | null
          storage_path?: string
          updated_at?: string
          uploaded_at?: string
          uploaded_by?: string
          verification_status?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "documents_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      external_verifications: {
        Row: {
          application_id: string
          created_at: string
          document_id: string | null
          executed_by: string | null
          http_status: number | null
          id: string
          lookup_field: string | null
          lookup_value: string | null
          request_summary: string | null
          response_summary: string | null
          source_domain: string | null
          source_id: string | null
          source_name: string
          status: string
        }
        Insert: {
          application_id: string
          created_at?: string
          document_id?: string | null
          executed_by?: string | null
          http_status?: number | null
          id?: string
          lookup_field?: string | null
          lookup_value?: string | null
          request_summary?: string | null
          response_summary?: string | null
          source_domain?: string | null
          source_id?: string | null
          source_name: string
          status?: string
        }
        Update: {
          application_id?: string
          created_at?: string
          document_id?: string | null
          executed_by?: string | null
          http_status?: number | null
          id?: string
          lookup_field?: string | null
          lookup_value?: string | null
          request_summary?: string | null
          response_summary?: string | null
          source_domain?: string | null
          source_id?: string | null
          source_name?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_verifications_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_verifications_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_verifications_executed_by_fkey"
            columns: ["executed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_verifications_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "verification_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      institution_records: {
        Row: {
          academic_year: string | null
          active: boolean
          created_at: string
          details: Json | null
          id: string
          imported_by: string | null
          institution_name: string
          record_status: string
          record_type: string
          registration_number: string | null
          source_reference: string | null
          source_type: string
          updated_at: string
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          academic_year?: string | null
          active?: boolean
          created_at?: string
          details?: Json | null
          id?: string
          imported_by?: string | null
          institution_name: string
          record_status?: string
          record_type?: string
          registration_number?: string | null
          source_reference?: string | null
          source_type?: string
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          academic_year?: string | null
          active?: boolean
          created_at?: string
          details?: Json | null
          id?: string
          imported_by?: string | null
          institution_name?: string
          record_status?: string
          record_type?: string
          registration_number?: string | null
          source_reference?: string | null
          source_type?: string
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "institution_records_imported_by_fkey"
            columns: ["imported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          application_id: string | null
          created_at: string
          id: string
          message: string
          notification_type: string
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          application_id?: string | null
          created_at?: string
          id?: string
          message: string
          notification_type?: string
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          application_id?: string | null
          created_at?: string
          id?: string
          message?: string
          notification_type?: string
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          organization_name: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          organization_name?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          organization_name?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      report_history: {
        Row: {
          application_id: string
          generated_at: string
          generated_by: string | null
          id: string
          report_type: string
        }
        Insert: {
          application_id: string
          generated_at?: string
          generated_by?: string | null
          id?: string
          report_type?: string
        }
        Update: {
          application_id?: string
          generated_at?: string
          generated_by?: string | null
          id?: string
          report_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_history_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_history_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      review_comments: {
        Row: {
          application_id: string
          author_id: string
          comment: string
          created_at: string
          id: string
          visibility: string
        }
        Insert: {
          application_id: string
          author_id: string
          comment: string
          created_at?: string
          id?: string
          visibility?: string
        }
        Update: {
          application_id?: string
          author_id?: string
          comment?: string
          created_at?: string
          id?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_comments_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      verification_findings: {
        Row: {
          application_id: string
          application_value: string | null
          category: string
          created_at: string
          document_id: string | null
          document_value: string | null
          explanation: string
          field_name: string | null
          finding_status: string
          id: string
          recommended_action: string | null
          resolution_comment: string | null
          resolved_at: string | null
          resolved_by: string | null
          rule_code: string
          severity: string
          verification_run_id: string
        }
        Insert: {
          application_id: string
          application_value?: string | null
          category: string
          created_at?: string
          document_id?: string | null
          document_value?: string | null
          explanation: string
          field_name?: string | null
          finding_status?: string
          id?: string
          recommended_action?: string | null
          resolution_comment?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          rule_code: string
          severity?: string
          verification_run_id: string
        }
        Update: {
          application_id?: string
          application_value?: string | null
          category?: string
          created_at?: string
          document_id?: string | null
          document_value?: string | null
          explanation?: string
          field_name?: string | null
          finding_status?: string
          id?: string
          recommended_action?: string | null
          resolution_comment?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          rule_code?: string
          severity?: string
          verification_run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "verification_findings_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_findings_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_findings_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_findings_verification_run_id_fkey"
            columns: ["verification_run_id"]
            isOneToOne: false
            referencedRelation: "verification_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_runs: {
        Row: {
          application_id: string
          checks_passed: number
          checks_performed: number
          completed_at: string | null
          error_message: string | null
          executed_by: string | null
          findings_count: number
          id: string
          rules_snapshot: Json | null
          rules_version: string | null
          run_number: number
          started_at: string
          status: string
        }
        Insert: {
          application_id: string
          checks_passed?: number
          checks_performed?: number
          completed_at?: string | null
          error_message?: string | null
          executed_by?: string | null
          findings_count?: number
          id?: string
          rules_snapshot?: Json | null
          rules_version?: string | null
          run_number: number
          started_at?: string
          status?: string
        }
        Update: {
          application_id?: string
          checks_passed?: number
          checks_performed?: number
          completed_at?: string | null
          error_message?: string | null
          executed_by?: string | null
          findings_count?: number
          id?: string
          rules_snapshot?: Json | null
          rules_version?: string | null
          run_number?: number
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "verification_runs_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_runs_executed_by_fkey"
            columns: ["executed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_sources: {
        Row: {
          active: boolean
          base_domain: string
          configured: boolean
          created_at: string
          created_by: string | null
          endpoint_path: string
          id: string
          lookup_param: string
          name: string
          notes: string | null
          source_type: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          base_domain: string
          configured?: boolean
          created_at?: string
          created_by?: string | null
          endpoint_path?: string
          id?: string
          lookup_param?: string
          name: string
          notes?: string | null
          source_type?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          base_domain?: string
          configured?: boolean
          created_at?: string
          created_by?: string | null
          endpoint_path?: string
          id?: string
          lookup_param?: string
          name?: string
          notes?: string | null
          source_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "verification_sources_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "institution_user" | "reviewer" | "admin"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["institution_user", "reviewer", "admin"],
    },
  },
} as const
