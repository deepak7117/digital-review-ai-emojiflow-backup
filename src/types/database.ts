/**
 * Hand-written type definitions matching supabase/migrations/*.sql.
 *
 * If you have the Supabase CLI linked to a project, you can regenerate this
 * file exactly from the live schema with:
 *
 *   supabase gen types typescript --linked > src/types/database.ts
 *
 * Until then, keep this file in sync with the migrations by hand.
 */

export type ProfileRole = "business_owner" | "admin";
export type AdminRole = "super_admin" | "support_admin" | "operations_admin" | "read_only_analyst";

export interface Database {
  public: {
    Views: {
      feedback_pages: {
        Row: {
          public_code: string;
          tags: string[];
          is_active: boolean;
          business_name: string;
          category: string | null;
          city: string | null;
          logo_url: string | null;
          google_review_url: string | null;
        };
        Relationships: [];
      };
      customer_pulse_pages: {
        Row: {
          public_code: string;
          question: string;
          options: string[];
          is_active: boolean;
          starts_at: string | null;
          ends_at: string | null;
          business_name: string;
          logo_url: string | null;
        };
        Relationships: [];
      };
      feedback_page_questions: {
        Row: {
          public_code: string;
          question_id: string;
          question_text: string;
          options: string[];
          sort_order: number;
        };
        Relationships: [];
      };
    };
    Functions: {
      check_rate_limit: {
        Args: {
          p_scope: string;
          p_key: string;
          p_max_count: number;
          p_window_seconds: number;
        };
        Returns: boolean;
      };
      admin_set_business_status: {
        Args: {
          p_business_id: string;
          p_new_status: "active" | "inactive" | "suspended";
          p_reason: string | null;
        };
        Returns: {
          id: string;
          owner_id: string;
          business_name: string;
          category: string | null;
          phone: string | null;
          email: string | null;
          address: string | null;
          city: string | null;
          website: string | null;
          google_review_url: string | null;
          logo_url: string | null;
          industry_slug: string | null;
          segment_slug: string | null;
          status: "active" | "inactive" | "suspended";
          created_at: string;
          updated_at: string;
        };
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
    Tables: {
      profiles: {
        Row: {
          id: string;
          user_id: string;
          full_name: string | null;
          email: string;
          phone: string | null;
          role: ProfileRole;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          full_name?: string | null;
          email: string;
          phone?: string | null;
          role?: ProfileRole;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          full_name?: string | null;
          email?: string;
          phone?: string | null;
          role?: ProfileRole;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      businesses: {
        Row: {
          id: string;
          owner_id: string;
          business_name: string;
          category: string | null;
          phone: string | null;
          email: string | null;
          address: string | null;
          city: string | null;
          website: string | null;
          google_review_url: string | null;
          logo_url: string | null;
          industry_slug: string | null;
          segment_slug: string | null;
          status: "active" | "inactive" | "suspended";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          business_name: string;
          category?: string | null;
          phone?: string | null;
          email?: string | null;
          address?: string | null;
          city?: string | null;
          website?: string | null;
          google_review_url?: string | null;
          logo_url?: string | null;
          industry_slug?: string | null;
          segment_slug?: string | null;
          status?: "active" | "inactive" | "suspended";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          business_name?: string;
          category?: string | null;
          phone?: string | null;
          email?: string | null;
          address?: string | null;
          city?: string | null;
          website?: string | null;
          google_review_url?: string | null;
          logo_url?: string | null;
          industry_slug?: string | null;
          segment_slug?: string | null;
          status?: "active" | "inactive" | "suspended";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      feedback_links: {
        Row: {
          id: string;
          business_id: string;
          public_code: string;
          tags: string[];
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          public_code: string;
          tags?: string[];
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          public_code?: string;
          tags?: string[];
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      feedback_submissions: {
        Row: {
          id: string;
          business_id: string;
          feedback_link_id: string | null;
          rating: number;
          tags: string[];
          message: string | null;
          ai_draft: string | null;
          final_draft: string | null;
          proceeded_to_google: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          feedback_link_id?: string | null;
          rating: number;
          tags?: string[];
          message?: string | null;
          ai_draft?: string | null;
          final_draft?: string | null;
          proceeded_to_google?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          feedback_link_id?: string | null;
          rating?: number;
          tags?: string[];
          message?: string | null;
          ai_draft?: string | null;
          final_draft?: string | null;
          proceeded_to_google?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      unmet_demand_reports: {
        Row: {
          id: string;
          business_id: string;
          feedback_link_id: string | null;
          feedback_submission_id: string | null;
          reason: string;
          detail: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          feedback_link_id?: string | null;
          feedback_submission_id?: string | null;
          reason: string;
          detail?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          feedback_link_id?: string | null;
          feedback_submission_id?: string | null;
          reason?: string;
          detail?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      customer_pulse_polls: {
        Row: {
          id: string;
          business_id: string;
          public_code: string;
          question: string;
          options: string[];
          is_active: boolean;
          starts_at: string | null;
          ends_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          public_code: string;
          question: string;
          options: string[];
          is_active?: boolean;
          starts_at?: string | null;
          ends_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          public_code?: string;
          question?: string;
          options?: string[];
          is_active?: boolean;
          starts_at?: string | null;
          ends_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      customer_pulse_responses: {
        Row: {
          id: string;
          poll_id: string;
          option_index: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          poll_id: string;
          option_index: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          poll_id?: string;
          option_index?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      business_action_status: {
        Row: {
          id: string;
          business_id: string;
          action_key: string;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          action_key: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          action_key?: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      business_context_questions: {
        Row: {
          id: string;
          business_id: string;
          question_text: string;
          options: string[];
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          question_text: string;
          options: string[];
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          question_text?: string;
          options?: string[];
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      feedback_question_answers: {
        Row: {
          id: string;
          feedback_submission_id: string;
          business_id: string;
          feedback_link_id: string | null;
          question_id: string | null;
          question_text: string;
          answer: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          feedback_submission_id: string;
          business_id: string;
          feedback_link_id?: string | null;
          question_id?: string | null;
          question_text: string;
          answer: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          feedback_submission_id?: string;
          business_id?: string;
          feedback_link_id?: string | null;
          question_id?: string | null;
          question_text?: string;
          answer?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      admin_role_assignments: {
        Row: {
          id: string;
          user_id: string;
          admin_role: AdminRole;
          granted_by: string | null;
          granted_at: string;
          revoked_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          admin_role: AdminRole;
          granted_by?: string | null;
          granted_at?: string;
          revoked_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          admin_role?: AdminRole;
          granted_by?: string | null;
          granted_at?: string;
          revoked_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          admin_user_id: string | null;
          action: string;
          target_type: string | null;
          target_id: string | null;
          reason: string | null;
          result: "success" | "failure";
          metadata: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          admin_user_id?: string | null;
          action: string;
          target_type?: string | null;
          target_id?: string | null;
          reason?: string | null;
          result?: "success" | "failure";
          metadata?: Record<string, unknown> | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          admin_user_id?: string | null;
          action?: string;
          target_type?: string | null;
          target_id?: string | null;
          reason?: string | null;
          result?: "success" | "failure";
          metadata?: Record<string, unknown> | null;
          created_at?: string;
        };
        Relationships: [];
      };
      business_support_notes: {
        Row: {
          id: string;
          business_id: string;
          admin_user_id: string | null;
          note: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          admin_user_id?: string | null;
          note: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          admin_user_id?: string | null;
          note?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      google_business_connections: {
        Row: {
          id: string;
          business_id: string;
          branch_label: string | null;
          google_account_id: string | null;
          google_location_id: string | null;
          google_location_name: string | null;
          access_token_encrypted: string;
          refresh_token_encrypted: string;
          token_expires_at: string;
          connected_by: string | null;
          status: "pending" | "connected" | "disconnected";
          disconnected_at: string | null;
          disconnected_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          branch_label?: string | null;
          google_account_id?: string | null;
          google_location_id?: string | null;
          google_location_name?: string | null;
          access_token_encrypted: string;
          refresh_token_encrypted: string;
          token_expires_at: string;
          connected_by?: string | null;
          status?: "pending" | "connected" | "disconnected";
          disconnected_at?: string | null;
          disconnected_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          branch_label?: string | null;
          google_account_id?: string | null;
          google_location_id?: string | null;
          google_location_name?: string | null;
          access_token_encrypted?: string;
          refresh_token_encrypted?: string;
          token_expires_at?: string;
          connected_by?: string | null;
          status?: "pending" | "connected" | "disconnected";
          disconnected_at?: string | null;
          disconnected_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      action_baseline_snapshots: {
        Row: {
          id: string;
          business_id: string;
          action_key: string;
          baseline_count: number;
          evidence_label: string;
          captured_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          action_key: string;
          baseline_count: number;
          evidence_label: string;
          captured_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          action_key?: string;
          baseline_count?: number;
          evidence_label?: string;
          captured_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      owner_notifications: {
        Row: {
          id: string;
          business_id: string;
          feedback_submission_id: string | null;
          rating: number;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          feedback_submission_id?: string | null;
          rating: number;
          read_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          feedback_submission_id?: string | null;
          rating?: number;
          read_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      google_reviews: {
        Row: {
          id: string;
          business_id: string;
          connection_id: string;
          google_review_id: string;
          reviewer_name: string | null;
          rating: number;
          comment: string | null;
          owner_reply: string | null;
          owner_reply_at: string | null;
          reply_status: string | null;
          review_created_at: string | null;
          review_updated_at: string | null;
          synced_at: string;
          ai_reply_draft: string | null;
          draft_status: "none" | "drafted" | "edited" | "publishing" | "published" | "failed";
          draft_updated_at: string | null;
          publish_attempted_at: string | null;
          publish_error: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          connection_id: string;
          google_review_id: string;
          reviewer_name?: string | null;
          rating: number;
          comment?: string | null;
          owner_reply?: string | null;
          owner_reply_at?: string | null;
          reply_status?: string | null;
          review_created_at?: string | null;
          review_updated_at?: string | null;
          synced_at?: string;
          ai_reply_draft?: string | null;
          draft_status?: "none" | "drafted" | "edited" | "publishing" | "published" | "failed";
          draft_updated_at?: string | null;
          publish_attempted_at?: string | null;
          publish_error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          connection_id?: string;
          google_review_id?: string;
          reviewer_name?: string | null;
          rating?: number;
          comment?: string | null;
          owner_reply?: string | null;
          owner_reply_at?: string | null;
          reply_status?: string | null;
          review_created_at?: string | null;
          review_updated_at?: string | null;
          synced_at?: string;
          ai_reply_draft?: string | null;
          draft_status?: "none" | "drafted" | "edited" | "publishing" | "published" | "failed";
          draft_updated_at?: string | null;
          publish_attempted_at?: string | null;
          publish_error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
  };
}
