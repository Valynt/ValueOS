export interface ValueCommitment {
  id: string;
  tenant_id: string;
  user_id: string;
  session_id: string;
  organization_id?: string | null;
  title: string;
  description?: string;
  commitment_type: "financial" | "operational" | "strategic";
  priority: "high" | "medium" | "low";
  financial_impact?: {
    revenue_uplift?: number;
    cost_reduction?: number;
  };
  currency?: string;
  timeframe_months?: number;
  status: "draft" | "in_progress" | "at_risk" | "achieved" | "missed";
  progress_percentage: number;
  confidence_level?: number;
  committed_at: string;
  target_completion_date?: string;
  actual_completion_date?: string | null;
  ground_truth_references?: any;
  tags?: string[];
  metadata?: any;
  created_at: string;
  updated_at: string;
}

export type ValueCommitmentInsert = Omit<ValueCommitment, 'id' | 'created_at' | 'updated_at'>;

export interface CommitmentStakeholder {
  id: string;
  commitment_id: string;
  tenant_id: string;
  user_id: string;
  role: "owner" | "contributor" | "reviewer" | "approver";
  responsibility?: string;
  accountability_percentage?: number;
  is_active?: boolean;
  notification_preferences?: any;
  joined_at: string;
  last_active_at: string;
  updated_at?: string;
}

export type CommitmentStakeholderInsert = Omit<CommitmentStakeholder, 'id' | 'updated_at'>;

export interface CommitmentMilestone {
  id: string;
  commitment_id: string;
  tenant_id: string;
  title: string;
  description?: string;
  status: "pending" | "in_progress" | "completed" | "delayed";
  progress_percentage: number;
  due_date?: string;
  actual_date?: string;
  created_at: string;
  updated_at: string;
}

export type CommitmentMilestoneInsert = Omit<CommitmentMilestone, 'id' | 'created_at' | 'updated_at'>;

export interface CommitmentMetric {
  id: string;
  commitment_id: string;
  tenant_id: string;
  metric_name: string;
  target_value: number;
  current_value: number;
  unit: string;
  is_active: boolean;
  last_measured_at?: string;
  created_at: string;
  updated_at: string;
}

export type CommitmentMetricInsert = Omit<CommitmentMetric, 'id' | 'created_at' | 'updated_at'>;

export interface CommitmentRisk {
  id: string;
  commitment_id: string;
  tenant_id: string;
  risk_title: string;
  risk_description?: string;
  risk_score: number;
  status: "identified" | "mitigated" | "occurred" | "closed";
  identified_at: string;
  mitigated_at?: string;
  created_at: string;
  updated_at: string;
}

export type CommitmentRiskInsert = Omit<CommitmentRisk, 'id' | 'created_at' | 'updated_at'>;

export interface CommitmentAudit {
  id: string;
  commitment_id: string;
  tenant_id: string;
  user_id: string;
  action: "created" | "updated" | "deleted" | "status_changed" | "stakeholder_added" | "risk_assessed" | "milestone_completed" | "metric_updated";
  previous_values?: any;
  new_values?: any;
  change_reason?: string;
  created_at: string;
}

export type CommitmentAuditInsert = Omit<CommitmentAudit, 'id' | 'created_at'>;

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
