/**
 * Value Commitment Tracking Schema
 *
 * Comprehensive database schema for tracking value commitments made during
 * ValueOS value analysis sessions. Tracks financial commitments, stakeholder
 * responsibilities, milestones, success metrics, and audit trails.
 */

export interface ValueCommitmentTracking {
  public: {
    Tables: {
      value_commitments: {
        Row: {
          id: string;
          tenant_id: string;
          session_id: string;
          user_id: string;
          organization_id: string | null;

          // Commitment Details
          title: string;
          description: string;
          commitment_type: "financial" | "timeline" | "operational" | "strategic" | "compliance";
          priority: "critical" | "high" | "medium" | "low";

          // Financial Aspects
          financial_impact: {
            revenue_uplift?: number;
            cost_reduction?: number;
            risk_mitigation?: number;
            capital_efficiency?: number;
            productivity_gain?: number;
            fcf_improvement?: number;
            ebitda_expansion?: number;
          };
          currency: string;
          timeframe_months: number;

          // Status & Progress
          status:
            | "draft"
            | "committed"
            | "in_progress"
            | "on_track"
            | "at_risk"
            | "completed"
            | "cancelled"
            | "failed";
          progress_percentage: number;
          confidence_level: number; // 0-100

          // Timeline
          committed_at: string;
          target_completion_date: string;
          actual_completion_date: string | null;

          // Ground Truth Integration
          ground_truth_references: {
            benchmark_ids: string[];
            persona: string;
            industry: string;
            confidence_sources: string[];
          };

          // Metadata
          tags: string[];
          metadata: Record<string, any>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          session_id: string;
          user_id: string;
          organization_id?: string | null;
          title: string;
          description: string;
          commitment_type?: "financial" | "timeline" | "operational" | "strategic" | "compliance";
          priority?: "critical" | "high" | "medium" | "low";
          financial_impact?: {
            revenue_uplift?: number;
            cost_reduction?: number;
            risk_mitigation?: number;
            capital_efficiency?: number;
            productivity_gain?: number;
            fcf_improvement?: number;
            ebitda_expansion?: number;
          };
          currency?: string;
          timeframe_months: number;
          status?:
            | "draft"
            | "committed"
            | "in_progress"
            | "on_track"
            | "at_risk"
            | "completed"
            | "cancelled"
            | "failed";
          progress_percentage?: number;
          confidence_level?: number;
          committed_at?: string;
          target_completion_date: string;
          actual_completion_date?: string | null;
          ground_truth_references?: {
            benchmark_ids: string[];
            persona: string;
            industry: string;
            confidence_sources: string[];
          };
          tags?: string[];
          metadata?: Record<string, any>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          session_id?: string;
          user_id?: string;
          organization_id?: string | null;
          title?: string;
          description?: string;
          commitment_type?: "financial" | "timeline" | "operational" | "strategic" | "compliance";
          priority?: "critical" | "high" | "medium" | "low";
          financial_impact?: {
            revenue_uplift?: number;
            cost_reduction?: number;
            risk_mitigation?: number;
            capital_efficiency?: number;
            productivity_gain?: number;
            fcf_improvement?: number;
            ebitda_expansion?: number;
          };
          currency?: string;
          timeframe_months?: number;
          status?:
            | "draft"
            | "committed"
            | "in_progress"
            | "on_track"
            | "at_risk"
            | "completed"
            | "cancelled"
            | "failed";
          progress_percentage?: number;
          confidence_level?: number;
          committed_at?: string;
          target_completion_date?: string;
          actual_completion_date?: string | null;
          ground_truth_references?: {
            benchmark_ids: string[];
            persona: string;
            industry: string;
            confidence_sources: string[];
          };
          tags?: string[];
          metadata?: Record<string, any>;
          created_at?: string;
          updated_at?: string;
        };
      };

      commitment_stakeholders: {
        Row: {
          id: string;
          commitment_id: string;
          tenant_id: string;
          user_id: string;
          role: "owner" | "contributor" | "approver" | "reviewer" | "observer";
          responsibility: string;
          accountability_percentage: number; // 0-100
          notification_preferences: {
            email: boolean;
            slack: boolean;
            milestone_updates: boolean;
            risk_alerts: boolean;
          };
          joined_at: string;
          last_active_at: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          commitment_id: string;
          tenant_id: string;
          user_id: string;
          role?: "owner" | "contributor" | "approver" | "reviewer" | "observer";
          responsibility: string;
          accountability_percentage?: number;
          notification_preferences?: {
            email: boolean;
            slack: boolean;
            milestone_updates: boolean;
            risk_alerts: boolean;
          };
          joined_at?: string;
          last_active_at?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          commitment_id?: string;
          tenant_id?: string;
          user_id?: string;
          role?: "owner" | "contributor" | "approver" | "reviewer" | "observer";
          responsibility?: string;
          accountability_percentage?: number;
          notification_preferences?: {
            email: boolean;
            slack: boolean;
            milestone_updates: boolean;
            risk_alerts: boolean;
          };
          joined_at?: string;
          last_active_at?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };

      commitment_milestones: {
        Row: {
          id: string;
          commitment_id: string;
          tenant_id: string;
          title: string;
          description: string;
          milestone_type: "planning" | "execution" | "review" | "completion" | "validation";
          sequence_order: number;
          target_date: string;
          actual_date: string | null;
          status: "pending" | "in_progress" | "completed" | "delayed" | "cancelled";
          progress_percentage: number;
          deliverables: string[];
          dependencies: string[]; // IDs of other milestones
          assigned_to: string | null; // user_id
          success_criteria: string[];
          metadata: Record<string, any>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          commitment_id: string;
          tenant_id: string;
          title: string;
          description: string;
          milestone_type?: "planning" | "execution" | "review" | "completion" | "validation";
          sequence_order: number;
          target_date: string;
          actual_date?: string | null;
          status?: "pending" | "in_progress" | "completed" | "delayed" | "cancelled";
          progress_percentage?: number;
          deliverables?: string[];
          dependencies?: string[];
          assigned_to?: string | null;
          success_criteria?: string[];
          metadata?: Record<string, any>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          commitment_id?: string;
          tenant_id?: string;
          title?: string;
          description?: string;
          milestone_type?: "planning" | "execution" | "review" | "completion" | "validation";
          sequence_order?: number;
          target_date?: string;
          actual_date?: string | null;
          status?: "pending" | "in_progress" | "completed" | "delayed" | "cancelled";
          progress_percentage?: number;
          deliverables?: string[];
          dependencies?: string[];
          assigned_to?: string | null;
          success_criteria?: string[];
          metadata?: Record<string, any>;
          created_at?: string;
          updated_at?: string;
        };
      };

      commitment_metrics: {
        Row: {
          id: string;
          commitment_id: string;
          tenant_id: string;
          metric_name: string;
          metric_description: string;
          metric_type: "kpi" | "roi" | "progress" | "quality" | "efficiency";
          target_value: number;
          current_value: number | null;
          unit: string;
          measurement_frequency: "daily" | "weekly" | "monthly" | "quarterly" | "annually";
          baseline_value: number | null;
          tolerance_percentage: number; // Acceptable variance
          last_measured_at: string | null;
          next_measurement_date: string;
          data_source: string;
          is_active: boolean;
          metadata: Record<string, any>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          commitment_id: string;
          tenant_id: string;
          metric_name: string;
          metric_description: string;
          metric_type?: "kpi" | "roi" | "progress" | "quality" | "efficiency";
          target_value: number;
          current_value?: number | null;
          unit: string;
          measurement_frequency?: "daily" | "weekly" | "monthly" | "quarterly" | "annually";
          baseline_value?: number | null;
          tolerance_percentage?: number;
          last_measured_at?: string | null;
          next_measurement_date: string;
          data_source: string;
          is_active?: boolean;
          metadata?: Record<string, any>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          commitment_id?: string;
          tenant_id?: string;
          metric_name?: string;
          metric_description?: string;
          metric_type?: "kpi" | "roi" | "progress" | "quality" | "efficiency";
          target_value?: number;
          current_value?: number | null;
          unit?: string;
          measurement_frequency?: "daily" | "weekly" | "monthly" | "quarterly" | "annually";
          baseline_value?: number | null;
          tolerance_percentage?: number;
          last_measured_at?: string | null;
          next_measurement_date?: string;
          data_source?: string;
          is_active?: boolean;
          metadata?: Record<string, any>;
          created_at?: string;
          updated_at?: string;
        };
      };

      commitment_audits: {
        Row: {
          id: string;
          commitment_id: string;
          tenant_id: string;
          user_id: string;
          action:
            | "created"
            | "updated"
            | "status_changed"
            | "stakeholder_added"
            | "stakeholder_removed"
            | "milestone_completed"
            | "metric_updated"
            | "risk_assessed";
          previous_values: Record<string, any>;
          new_values: Record<string, any>;
          change_reason: string;
          ip_address: string | null;
          user_agent: string | null;
          audit_metadata: Record<string, any>;
          created_at: string;
        };
        Insert: {
          id?: string;
          commitment_id: string;
          tenant_id: string;
          user_id: string;
          action:
            | "created"
            | "updated"
            | "status_changed"
            | "stakeholder_added"
            | "stakeholder_removed"
            | "milestone_completed"
            | "metric_updated"
            | "risk_assessed";
          previous_values: Record<string, any>;
          new_values: Record<string, any>;
          change_reason: string;
          ip_address?: string | null;
          user_agent?: string | null;
          audit_metadata?: Record<string, any>;
          created_at?: string;
        };
        Update: {
          id?: string;
          commitment_id?: string;
          tenant_id?: string;
          user_id?: string;
          action?:
            | "created"
            | "updated"
            | "status_changed"
            | "stakeholder_added"
            | "stakeholder_removed"
            | "milestone_completed"
            | "metric_updated"
            | "risk_assessed";
          previous_values?: Record<string, any>;
          new_values?: Record<string, any>;
          change_reason?: string;
          ip_address?: string | null;
          user_agent?: string | null;
          audit_metadata?: Record<string, any>;
          created_at?: string;
        };
      };

      commitment_risks: {
        Row: {
          id: string;
          commitment_id: string;
          tenant_id: string;
          risk_title: string;
          risk_description: string;
          risk_category:
            | "execution"
            | "resource"
            | "market"
            | "technical"
            | "regulatory"
            | "financial";
          probability: "low" | "medium" | "high" | "critical";
          impact: "low" | "medium" | "high" | "critical";
          risk_score: number; // Calculated from probability * impact
          mitigation_plan: string;
          contingency_plan: string;
          owner_id: string;
          status: "identified" | "mitigating" | "mitigated" | "occurred" | "closed";
          identified_at: string;
          mitigated_at: string | null;
          occurred_at: string | null;
          review_date: string;
          metadata: Record<string, any>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          commitment_id: string;
          tenant_id: string;
          risk_title: string;
          risk_description: string;
          risk_category?:
            | "execution"
            | "resource"
            | "market"
            | "technical"
            | "regulatory"
            | "financial";
          probability?: "low" | "medium" | "high" | "critical";
          impact?: "low" | "medium" | "high" | "critical";
          risk_score?: number;
          mitigation_plan: string;
          contingency_plan: string;
          owner_id: string;
          status?: "identified" | "mitigating" | "mitigated" | "occurred" | "closed";
          identified_at?: string;
          mitigated_at?: string | null;
          occurred_at?: string | null;
          review_date: string;
          metadata?: Record<string, any>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          commitment_id?: string;
          tenant_id?: string;
          risk_title?: string;
          risk_description?: string;
          risk_category?:
            | "execution"
            | "resource"
            | "market"
            | "technical"
            | "regulatory"
            | "financial";
          probability?: "low" | "medium" | "high" | "critical";
          impact?: "low" | "medium" | "high" | "critical";
          risk_score?: number;
          mitigation_plan?: string;
          contingency_plan?: string;
          owner_id?: string;
          status?: "identified" | "mitigating" | "mitigated" | "occurred" | "closed";
          identified_at?: string;
          mitigated_at?: string | null;
          occurred_at?: string | null;
          review_date?: string;
          metadata?: Record<string, any>;
          created_at?: string;
          updated_at?: string;
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
export type ValueCommitment =
  ValueCommitmentTracking["public"]["Tables"]["value_commitments"]["Row"];
export type CommitmentStakeholder =
  ValueCommitmentTracking["public"]["Tables"]["commitment_stakeholders"]["Row"];
export type CommitmentMilestone =
  ValueCommitmentTracking["public"]["Tables"]["commitment_milestones"]["Row"];
export type CommitmentMetric =
  ValueCommitmentTracking["public"]["Tables"]["commitment_metrics"]["Row"];
export type CommitmentAudit =
  ValueCommitmentTracking["public"]["Tables"]["commitment_audits"]["Row"];
export type CommitmentRisk = ValueCommitmentTracking["public"]["Tables"]["commitment_risks"]["Row"];

// Insert types
export type ValueCommitmentInsert =
  ValueCommitmentTracking["public"]["Tables"]["value_commitments"]["Insert"];
export type CommitmentStakeholderInsert =
  ValueCommitmentTracking["public"]["Tables"]["commitment_stakeholders"]["Insert"];
export type CommitmentMilestoneInsert =
  ValueCommitmentTracking["public"]["Tables"]["commitment_milestones"]["Insert"];
export type CommitmentMetricInsert =
  ValueCommitmentTracking["public"]["Tables"]["commitment_metrics"]["Insert"];
export type CommitmentAuditInsert =
  ValueCommitmentTracking["public"]["Tables"]["commitment_audits"]["Insert"];
export type CommitmentRiskInsert =
  ValueCommitmentTracking["public"]["Tables"]["commitment_risks"]["Insert"];

// Update types
export type ValueCommitmentUpdate =
  ValueCommitmentTracking["public"]["Tables"]["value_commitments"]["Update"];
export type CommitmentStakeholderUpdate =
  ValueCommitmentTracking["public"]["Tables"]["commitment_stakeholders"]["Update"];
export type CommitmentMilestoneUpdate =
  ValueCommitmentTracking["public"]["Tables"]["commitment_milestones"]["Update"];
export type CommitmentMetricUpdate =
  ValueCommitmentTracking["public"]["Tables"]["commitment_metrics"]["Update"];
export type CommitmentAuditUpdate =
  ValueCommitmentTracking["public"]["Tables"]["commitment_audits"]["Update"];
export type CommitmentRiskUpdate =
  ValueCommitmentTracking["public"]["Tables"]["commitment_risks"]["Update"];

// Extended types for business logic
export interface CommitmentProgress {
  commitment_id: string;
  overall_progress: number;
  milestone_completion: number;
  metric_achievement: number;
  risk_level: "low" | "medium" | "high" | "critical";
  days_remaining: number;
  is_on_track: boolean;
}

export interface CommitmentDashboard {
  commitment: ValueCommitment;
  stakeholders: CommitmentStakeholder[];
  milestones: CommitmentMilestone[];
  metrics: CommitmentMetric[];
  risks: CommitmentRisk[];
  progress: CommitmentProgress;
  recent_audits: CommitmentAudit[];
}
