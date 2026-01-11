// Database type definitions updated to match corrected schema
// This file ensures type safety and consistency between database and application code

export interface Database {
  public: {
    Tables: {
      agent_sessions: {
        Row: {
          id: string;
          tenant_id: string;
          user_id: string;
          is_active: boolean;
          is_completed: boolean;
          status: 'pending' | 'active' | 'completed' | 'failed' | 'cancelled';
          metadata: Record<string, any>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          user_id: string;
          is_active?: boolean;
          is_completed?: boolean;
          status?: 'pending' | 'active' | 'completed' | 'failed' | 'cancelled';
          metadata?: Record<string, any>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          user_id?: string;
          is_active?: boolean;
          is_completed?: boolean;
          status?: 'pending' | 'active' | 'completed' | 'failed' | 'cancelled';
          metadata?: Record<string, any>;
          created_at?: string;
          updated_at?: string;
        };
      };

      workflow_executions: {
        Row: {
          id: string;
          session_id: string;
          tenant_id: string | null;
          user_id: string | null;
          organization_id: string | null;
          status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
          priority: number;
          progress: number;
          input_params: Record<string, any>;
          output_data: Record<string, any>;
          created_at: string;
          updated_at: string;
          started_at: string | null;
          completed_at: string | null;
          is_success: boolean;
          is_completed: boolean;
        };
        Insert: {
          id?: string;
          session_id: string;
          tenant_id?: string | null;
          user_id?: string | null;
          organization_id?: string | null;
          status?: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
          priority?: number;
          progress?: number;
          input_params?: Record<string, any>;
          output_data?: Record<string, any>;
          created_at?: string;
          updated_at?: string;
          started_at?: string | null;
          completed_at?: string | null;
          is_success?: boolean;
          is_completed?: boolean;
        };
        Update: {
          id?: string;
          session_id?: string;
          tenant_id?: string | null;
          user_id?: string | null;
          organization_id?: string | null;
          status?: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
          priority?: number;
          progress?: number;
          input_params?: Record<string, any>;
          output_data?: Record<string, any>;
          created_at?: string;
          updated_at?: string;
          started_at?: string | null;
          completed_at?: string | null;
          is_success?: boolean;
          is_completed?: boolean;
        };
      };

      agent_memory: {
        Row: {
          id: string;
          tenant_id: string;
          agent_id: string;
          memory_type: 'short_term' | 'long_term' | 'shared' | 'domain' | 'conversation' | 'factual' | 'procedural';
          content: string;
          embedding: any; // pgvector type
          metadata: Record<string, any>;
          confidence: number;
          importance: number;
          created_at: string;
          updated_at: string;
          expires_at: string | null;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          agent_id: string;
          memory_type?: 'short_term' | 'long_term' | 'shared' | 'domain' | 'conversation' | 'factual' | 'procedural';
          content: string;
          embedding?: any;
          metadata?: Record<string, any>;
          confidence?: number;
          importance?: number;
          created_at?: string;
          updated_at?: string;
          expires_at?: string | null;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          agent_id?: string;
          memory_type?: 'short_term' | 'long_term' | 'shared' | 'domain' | 'conversation' | 'factual' | 'procedural';
          content?: string;
          embedding?: any;
          metadata?: Record<string, any>;
          confidence?: number;
          importance?: number;
          created_at?: string;
          updated_at?: string;
          expires_at?: string | null;
        };
      };

      value_cases: {
        Row: {
          id: string;
          session_id: string;
          tenant_id: string;
          company_name: string;
          business_case: Record<string, any>;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          tenant_id: string;
          company_name: string;
          business_case?: Record<string, any>;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          tenant_id?: string;
          company_name?: string;
          business_case?: Record<string, any>;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
      };

      organizations: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          tier: 'free' | 'professional' | 'enterprise' | 'custom';
          is_active: boolean;
          settings: Record<string, any>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          name: string;
          tier?: 'free' | 'professional' | 'enterprise' | 'custom';
          is_active?: boolean;
          settings?: Record<string, any>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          name?: string;
          tier?: 'free' | 'professional' | 'enterprise' | 'custom';
          is_active?: boolean;
          settings?: Record<string, any>;
          created_at?: string;
          updated_at?: string;
        };
      };

      users: {
        Row: {
          id: string;
          tenant_id: string;
          organization_id: string | null;
          email: string;
          role: 'user' | 'admin' | 'super_admin';
          is_active: boolean;
          email_verified: boolean;
          preferences: Record<string, any>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          organization_id?: string | null;
          email: string;
          role?: 'user' | 'admin' | 'super_admin';
          is_active?: boolean;
          email_verified?: boolean;
          preferences?: Record<string, any>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          organization_id?: string | null;
          email?: string;
          role?: 'user' | 'admin' | 'super_admin';
          is_active?: boolean;
          email_verified?: boolean;
          preferences?: Record<string, any>;
          created_at?: string;
          updated_at?: string;
        };
      };

      agent_performance_summary: {
        Row: {
          id: string;
          tenant_id: string;
          agent_id: string;
          period_start: string;
          period_end: string;
          total_requests: number;
          successful_requests: number;
          failed_requests: number;
          average_response_time_ms: number;
          accuracy_score: number;
          is_success: boolean;
          metadata: Record<string, any>;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          agent_id: string;
          period_start: string;
          period_end: string;
          total_requests?: number;
          successful_requests?: number;
          failed_requests?: number;
          average_response_time_ms?: number;
          accuracy_score?: number;
          is_success?: boolean;
          metadata?: Record<string, any>;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          agent_id?: string;
          period_start?: string;
          period_end?: string;
          total_requests?: number;
          successful_requests?: number;
          failed_requests?: number;
          average_response_time_ms?: number;
          accuracy_score?: number;
          is_success?: boolean;
          metadata?: Record<string, any>;
          created_at?: string;
        };
      };

      llm_gating: {
        Row: {
          id: string;
          tenant_id: string;
          is_enabled: boolean;
          max_tokens_per_request: number;
          requests_per_minute: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          is_enabled?: boolean;
          max_tokens_per_request?: number;
          requests_per_minute?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          is_enabled?: boolean;
          max_tokens_per_request?: number;
          requests_per_minute?: number;
          created_at?: string;
          updated_at?: string;
        };
      };

      progressive_rollouts: {
        Row: {
          id: string;
          tenant_id: string;
          feature_name: string;
          rollout_percentage: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          feature_name: string;
          rollout_percentage?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          feature_name?: string;
          rollout_percentage?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };

      feature_flags: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          is_enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          is_enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          is_enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };

      tenants: {
        Row: {
          id: string;
          name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          created_at?: string;
          updated_at?: string;
        };
      };

      user_tenants: {
        Row: {
          user_id: string;
          tenant_id: string;
          role: string;
          status: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          tenant_id: string;
          role?: string;
          status?: string;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          tenant_id?: string;
          role?: string;
          status?: string;
          created_at?: string;
        };
      };

      user_roles: {
        Row: {
          user_id: string;
          role_id: string;
          tenant_id: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          role_id: string;
          tenant_id: string;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          role_id?: string;
          tenant_id?: string;
          created_at?: string;
        };
      };

      roles: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          permissions: string[];
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          permissions?: string[];
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          permissions?: string[];
          created_at?: string;
        };
      };
    };

    Views: {
      [_ in never]: never;
    };

    Functions: {
      [_ in never]: never;
    };

    Enums: {
      [_ in never]: never;
    };
  };
}

// Helper types for common operations
export type AgentSession = Database['public']['Tables']['agent_sessions']['Row'];
export type WorkflowExecution = Database['public']['Tables']['workflow_executions']['Row'];
export type AgentMemory = Database['public']['Tables']['agent_memory']['Row'];
export type ValueCase = Database['public']['Tables']['value_cases']['Row'];
export type Organization = Database['public']['Tables']['organizations']['Row'];
export type User = Database['public']['Tables']['users']['Row'];
export type AgentPerformanceSummary = Database['public']['Tables']['agent_performance_summary']['Row'];
export type LLMGating = Database['public']['Tables']['llm_gating']['Row'];
export type ProgressiveRollout = Database['public']['Tables']['progressive_rollouts']['Row'];
export type FeatureFlag = Database['public']['Tables']['feature_flags']['Row'];
export type Tenant = Database['public']['Tables']['tenants']['Row'];

// Insert types
export type AgentSessionInsert = Database['public']['Tables']['agent_sessions']['Insert'];
export type WorkflowExecutionInsert = Database['public']['Tables']['workflow_executions']['Insert'];
export type AgentMemoryInsert = Database['public']['Tables']['agent_memory']['Insert'];
export type ValueCaseInsert = Database['public']['Tables']['value_cases']['Insert'];
export type OrganizationInsert = Database['public']['Tables']['organizations']['Insert'];
export type UserInsert = Database['public']['Tables']['users']['Insert'];
export type AgentPerformanceSummaryInsert = Database['public']['Tables']['agent_performance_summary']['Insert'];
export type LLMGatingInsert = Database['public']['Tables']['llm_gating']['Insert'];
export type ProgressiveRolloutInsert = Database['public']['Tables']['progressive_rollouts']['Insert'];
export type FeatureFlagInsert = Database['public']['Tables']['feature_flags']['Insert'];
export type TenantInsert = Database['public']['Tables']['tenants']['Insert'];

// Update types
export type AgentSessionUpdate = Database['public']['Tables']['agent_sessions']['Update'];
export type WorkflowExecutionUpdate = Database['public']['Tables']['workflow_executions']['Update'];
export type AgentMemoryUpdate = Database['public']['Tables']['agent_memory']['Update'];
export type ValueCaseUpdate = Database['public']['Tables']['value_cases']['Update'];
export type OrganizationUpdate = Database['public']['Tables']['organizations']['Update'];
export type UserUpdate = Database['public']['Tables']['users']['Update'];
export type AgentPerformanceSummaryUpdate = Database['public']['Tables']['agent_performance_summary']['Update'];
export type LLMGatingUpdate = Database['public']['Tables']['llm_gating']['Update'];
export type ProgressiveRolloutUpdate = Database['public']['Tables']['progressive_rollouts']['Update'];
export type FeatureFlagUpdate = Database['public']['Tables']['feature_flags']['Update'];
export type TenantUpdate = Database['public']['Tables']['tenants']['Update'];