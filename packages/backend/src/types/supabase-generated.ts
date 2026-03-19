/**
 * Supabase Generated Types
 *
 * These types are generated from the Supabase database schema using:
 *   supabase gen types typescript --linked
 *
 * This file serves as a placeholder until the types are properly generated.
 * The actual generation should be run in the infra/supabase directory.
 *
 * @see https://supabase.com/docs/reference/javascript/overview
 */

// ============================================================================
// Database Schema Types
// ============================================================================

/**
 * Core database type that extends Postgres types.
 * This is a minimal placeholder - run `supabase gen types` to generate full types.
 */
export interface Database {
  public: {
    Tables: {
      // Academy tables
      academy_pillars: {
        Row: {
          id: number;
          number: number;
          title: string;
          description: string;
          icon: string;
          color: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          number: number;
          title: string;
          description: string;
          icon: string;
          color: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          number?: number;
          title?: string;
          description?: string;
          icon?: string;
          color?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      academy_modules: {
        Row: {
          id: string;
          pillar: string; // academy_pillar enum
          title: string;
          description: string;
          display_order: number;
          estimated_minutes: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          pillar: string;
          title: string;
          description?: string;
          display_order?: number;
          estimated_minutes?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          pillar?: string;
          title?: string;
          description?: string;
          display_order?: number;
          estimated_minutes?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      academy_lessons: {
        Row: {
          id: string;
          module_id: string;
          title: string;
          description: string;
          content_type: string;
          display_order: number;
          estimated_minutes: number;
          sdui_components: unknown[];
          prerequisites: unknown[];
          tracks: unknown[];
          lab_config: unknown;
          quiz_config: unknown;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          module_id: string;
          title: string;
          description?: string;
          content_type: string;
          display_order?: number;
          estimated_minutes?: number;
          sdui_components?: unknown[];
          prerequisites?: unknown[];
          tracks?: unknown[];
          lab_config?: unknown;
          quiz_config?: unknown;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          module_id?: string;
          title?: string;
          description?: string;
          content_type?: string;
          display_order?: number;
          estimated_minutes?: number;
          sdui_components?: unknown[];
          prerequisites?: unknown[];
          tracks?: unknown[];
          lab_config?: unknown;
          quiz_config?: unknown;
          created_at?: string;
          updated_at?: string;
        };
      };
      academy_progress: {
        Row: {
          id: string;
          user_id: string;
          lesson_id: string;
          organization_id: string;
          status: string;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          lesson_id: string;
          organization_id: string;
          status: string;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          lesson_id?: string;
          organization_id?: string;
          status?: string;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      certifications: {
        Row: {
          id: number;
          user_id: string;
          badge_name: string;
          pillar_id: number;
          vos_role: string;
          tier: string;
          score: number | null;
          awarded_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          user_id: string;
          badge_name: string;
          pillar_id: number;
          vos_role: string;
          tier: string;
          score?: number | null;
          awarded_at: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          user_id?: string;
          badge_name?: string;
          pillar_id?: number;
          vos_role?: string;
          tier?: string;
          score?: number | null;
          awarded_at?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      certificate_jobs: {
        Row: {
          id: string;
          tenant_id: string;
          organization_id: string;
          user_id: string;
          certification_id: number;
          format: 'pdf' | 'png';
          status: 'queued' | 'running' | 'completed' | 'failed';
          download_url: string | null;
          certificate_blob: string | null;
          error_message: string | null;
          queued_at: string;
          started_at: string | null;
          completed_at: string | null;
          failed_at: string | null;
          trace_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          organization_id: string;
          user_id: string;
          certification_id: number;
          format: 'pdf' | 'png';
          status: 'queued' | 'running' | 'completed' | 'failed';
          download_url?: string | null;
          certificate_blob?: string | null;
          error_message?: string | null;
          queued_at?: string;
          started_at?: string | null;
          completed_at?: string | null;
          failed_at?: string | null;
          trace_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          organization_id?: string;
          user_id?: string;
          certification_id?: number;
          format?: 'pdf' | 'png';
          status?: 'queued' | 'running' | 'completed' | 'failed';
          download_url?: string | null;
          certificate_blob?: string | null;
          error_message?: string | null;
          queued_at?: string;
          started_at?: string | null;
          completed_at?: string | null;
          failed_at?: string | null;
          trace_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      resource_artifacts: {
        Row: {
          id: string;
          name: string;
          description: string;
          lifecycle_stage: string;
          artifact_type: string;
          file_url: string;
          version: string;
          deprecated: boolean;
          replaced_by: string | null;
          linked_pillars: string[]; // academy_pillar[]
          governance_required: boolean;
          integrity_validated: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string;
          lifecycle_stage: string;
          artifact_type: string;
          file_url: string;
          version?: string;
          deprecated?: boolean;
          replaced_by?: string | null;
          linked_pillars?: string[];
          governance_required?: boolean;
          integrity_validated?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string;
          lifecycle_stage?: string;
          artifact_type?: string;
          file_url?: string;
          version?: string;
          deprecated?: boolean;
          replaced_by?: string | null;
          linked_pillars?: string[];
          governance_required?: boolean;
          integrity_validated?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      // Add other tables as needed...
    };
    Functions: {
      // Add stored procedures if needed
    };
    Enums: {
      academy_pillar: string; // '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10'
    };
  };
}

// ============================================================================
// Type Utilities
// ============================================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// ============================================================================
// Note: Regenerate these types when schema changes
// ============================================================================
//
// To regenerate types:
//   1. cd infra/supabase
//   2. supabase gen types typescript --linked > ../packages/backend/src/types/supabase-generated.ts
//
// See also: infra/supabase/SETUP_SUMMARY.md for setup instructions.
