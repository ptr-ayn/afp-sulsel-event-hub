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
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_date_locks: {
        Row: {
          created_at: string
          event_date: string
          event_id: string
          expires_at: string | null
          id: string
          lock_type: Database["public"]["Enums"]["lock_type"]
          region_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_date: string
          event_id: string
          expires_at?: string | null
          id?: string
          lock_type?: Database["public"]["Enums"]["lock_type"]
          region_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_date?: string
          event_id?: string
          expires_at?: string | null
          id?: string
          lock_type?: Database["public"]["Enums"]["lock_type"]
          region_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_date_locks_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_date_locks_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      event_documents: {
        Row: {
          created_at: string
          document_type: string
          event_id: string
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          storage_path: string
          verification_status: Database["public"]["Enums"]["doc_status"]
        }
        Insert: {
          created_at?: string
          document_type: string
          event_id: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          storage_path: string
          verification_status?: Database["public"]["Enums"]["doc_status"]
        }
        Update: {
          created_at?: string
          document_type?: string
          event_id?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          storage_path?: string
          verification_status?: Database["public"]["Enums"]["doc_status"]
        }
        Relationships: [
          {
            foreignKeyName: "event_documents_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_documents_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_status_history: {
        Row: {
          actor_id: string | null
          created_at: string
          event_id: string
          from_status: Database["public"]["Enums"]["application_status"] | null
          id: string
          reason: string | null
          to_status: Database["public"]["Enums"]["application_status"]
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event_id: string
          from_status?: Database["public"]["Enums"]["application_status"] | null
          id?: string
          reason?: string | null
          to_status: Database["public"]["Enums"]["application_status"]
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event_id?: string
          from_status?: Database["public"]["Enums"]["application_status"] | null
          id?: string
          reason?: string | null
          to_status?: Database["public"]["Enums"]["application_status"]
        }
        Relationships: [
          {
            foreignKeyName: "event_status_history_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_status_history_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          description: string | null
          end_date: string
          estimated_participants: number
          event_code: string
          event_type: string
          id: string
          name: string
          organizer_id: string
          participant_category: string
          region_id: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          start_date: string
          status: Database["public"]["Enums"]["application_status"]
          submitted_at: string | null
          updated_at: string
          venue: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_date: string
          estimated_participants?: number
          event_code?: string
          event_type: string
          id?: string
          name: string
          organizer_id: string
          participant_category: string
          region_id: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["application_status"]
          submitted_at?: string | null
          updated_at?: string
          venue: string
        }
        Update: {
          created_at?: string
          description?: string | null
          end_date?: string
          estimated_participants?: number
          event_code?: string
          event_type?: string
          id?: string
          name?: string
          organizer_id?: string
          participant_category?: string
          region_id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["application_status"]
          submitted_at?: string | null
          updated_at?: string
          venue?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "organizers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizers: {
        Row: {
          contact_person: string
          contact_phone: string | null
          created_at: string
          id: string
          legal_id: string | null
          organization_name: string
          owner_id: string
          updated_at: string
          verification_status: Database["public"]["Enums"]["verification_status"]
        }
        Insert: {
          contact_person: string
          contact_phone?: string | null
          created_at?: string
          id?: string
          legal_id?: string | null
          organization_name: string
          owner_id: string
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["verification_status"]
        }
        Update: {
          contact_person?: string
          contact_phone?: string | null
          created_at?: string
          id?: string
          legal_id?: string | null
          organization_name?: string
          owner_id?: string
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["verification_status"]
        }
        Relationships: [
          {
            foreignKeyName: "organizers_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_webhook_events: {
        Row: {
          error_summary: string | null
          id: string
          processed_at: string | null
          processing_status: Database["public"]["Enums"]["webhook_status"]
          provider: string
          provider_event_id: string
          received_at: string
        }
        Insert: {
          error_summary?: string | null
          id?: string
          processed_at?: string | null
          processing_status?: Database["public"]["Enums"]["webhook_status"]
          provider: string
          provider_event_id: string
          received_at?: string
        }
        Update: {
          error_summary?: string | null
          id?: string
          processed_at?: string | null
          processing_status?: Database["public"]["Enums"]["webhook_status"]
          provider?: string
          provider_event_id?: string
          received_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount_idr: number
          created_at: string
          currency: string
          event_id: string
          id: string
          idempotency_key: string | null
          method: Database["public"]["Enums"]["payment_method"]
          provider: string | null
          provider_reference: string | null
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          amount_idr: number
          created_at?: string
          currency?: string
          event_id: string
          id?: string
          idempotency_key?: string | null
          method: Database["public"]["Enums"]["payment_method"]
          provider?: string | null
          provider_reference?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          amount_idr?: number
          created_at?: string
          currency?: string
          event_id?: string
          id?: string
          idempotency_key?: string | null
          method?: Database["public"]["Enums"]["payment_method"]
          provider?: string | null
          provider_reference?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          is_active: boolean
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string
          id: string
          is_active?: boolean
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          is_active?: boolean
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      refunds: {
        Row: {
          amount_idr: number
          created_at: string
          id: string
          initiated_by: string | null
          payment_id: string
          processed_at: string | null
          provider_reference: string | null
          reason: string
          status: Database["public"]["Enums"]["refund_status"]
          updated_at: string
        }
        Insert: {
          amount_idr: number
          created_at?: string
          id?: string
          initiated_by?: string | null
          payment_id: string
          processed_at?: string | null
          provider_reference?: string | null
          reason: string
          status?: Database["public"]["Enums"]["refund_status"]
          updated_at?: string
        }
        Update: {
          amount_idr?: number
          created_at?: string
          id?: string
          initiated_by?: string | null
          payment_id?: string
          processed_at?: string | null
          provider_reference?: string | null
          reason?: string
          status?: Database["public"]["Enums"]["refund_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "refunds_initiated_by_fkey"
            columns: ["initiated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      regions: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          kemendagri_code: string | null
          name: string
          province_code: string
          region_type: Database["public"]["Enums"]["region_type"]
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          kemendagri_code?: string | null
          name: string
          province_code?: string
          region_type: Database["public"]["Enums"]["region_type"]
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          kemendagri_code?: string | null
          name?: string
          province_code?: string
          region_type?: Database["public"]["Enums"]["region_type"]
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "system_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: never; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "organizer" | "admin_event" | "finance" | "super_admin"
      application_status:
        | "DRAFT"
        | "PENDING_PAYMENT"
        | "PENDING_ADMIN"
        | "APPROVED"
        | "REJECTED"
        | "CANCELLED"
        | "COMPLETED"
      doc_status: "PENDING" | "VERIFIED" | "REJECTED"
      lock_type: "TEMPORARY_HOLD" | "PAYMENT_VERIFIED" | "APPROVED"
      payment_method: "GATEWAY" | "MANUAL_TRANSFER"
      payment_status:
        | "PENDING"
        | "PROCESSING"
        | "PAID"
        | "FAILED"
        | "EXPIRED"
        | "REFUND_PENDING"
        | "REFUNDED"
        | "DISPUTED"
      refund_status:
        | "PENDING"
        | "PROCESSING"
        | "COMPLETED"
        | "FAILED"
        | "REJECTED"
      region_type: "KABUPATEN" | "KOTA"
      verification_status: "PENDING" | "VERIFIED" | "REJECTED"
      webhook_status: "RECEIVED" | "PROCESSING" | "PROCESSED" | "FAILED"
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
      app_role: ["organizer", "admin_event", "finance", "super_admin"],
      application_status: [
        "DRAFT",
        "PENDING_PAYMENT",
        "PENDING_ADMIN",
        "APPROVED",
        "REJECTED",
        "CANCELLED",
        "COMPLETED",
      ],
      doc_status: ["PENDING", "VERIFIED", "REJECTED"],
      lock_type: ["TEMPORARY_HOLD", "PAYMENT_VERIFIED", "APPROVED"],
      payment_method: ["GATEWAY", "MANUAL_TRANSFER"],
      payment_status: [
        "PENDING",
        "PROCESSING",
        "PAID",
        "FAILED",
        "EXPIRED",
        "REFUND_PENDING",
        "REFUNDED",
        "DISPUTED",
      ],
      refund_status: [
        "PENDING",
        "PROCESSING",
        "COMPLETED",
        "FAILED",
        "REJECTED",
      ],
      region_type: ["KABUPATEN", "KOTA"],
      verification_status: ["PENDING", "VERIFIED", "REJECTED"],
      webhook_status: ["RECEIVED", "PROCESSING", "PROCESSED", "FAILED"],
    },
  },
} as const
