export interface ValueCommitment {
  id: string;
  tenant_id: string;
  user_id: string;
  session_id: string;
  organization_id?: string | null;
  title: string;
  description?: string;
  commitment_type: string;
  priority: string;
  financial_impact?: {
    revenue_uplift?: number;
    cost_reduction?: number;
  };
  currency?: string;
  timeframe_months?: number;
  status: 'draft' | 'pending' | 'active' | 'completed' | 'cancelled' | 'at_risk' | 'in_progress';
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

export type ValueCommitmentInsert = Omit<ValueCommitment, 'id' | 'created_at' | 'updated_at'> & { id?: string };

export interface CommitmentStakeholder {
  id: string;
  commitment_id: string;
  tenant_id: string;
  user_id: string;
  role: string;
  responsibility?: string;
  accountability_percentage?: number;
  is_active: boolean;
  notification_preferences?: any;
  joined_at: string;
  last_active_at?: string;
  updated_at?: string;
}

export type CommitmentStakeholderInsert = Omit<CommitmentStakeholder, 'id' | 'updated_at'> & { id?: string };

export interface CommitmentMilestone {
  id: string;
  commitment_id: string;
  tenant_id: string;
  title: string;
  description?: string;
  due_date: string;
  actual_date?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'delayed' | 'skipped';
  progress_percentage: number;
  updated_at?: string;
}

export type CommitmentMilestoneInsert = Omit<CommitmentMilestone, 'id' | 'updated_at'> & { id?: string };

export interface CommitmentMetric {
  id: string;
  commitment_id: string;
  tenant_id: string;
  metric_name: string;
  metric_definition?: string;
  current_value: number;
  target_value?: number;
  baseline_value?: number;
  unit?: string;
  is_active: boolean;
  last_measured_at?: string;
  updated_at?: string;
}

export type CommitmentMetricInsert = Omit<CommitmentMetric, 'id' | 'updated_at'> & { id?: string };

export interface CommitmentRisk {
  id: string;
  commitment_id: string;
  tenant_id: string;
  risk_title: string;
  risk_description?: string;
  risk_score: number;
  impact_level?: string;
  probability_level?: string;
  mitigation_plan?: string;
  status: 'identified' | 'mitigated' | 'occurred' | 'dismissed';
  identified_at: string;
  mitigated_at?: string;
  updated_at?: string;
}

export type CommitmentRiskInsert = Omit<CommitmentRisk, 'id' | 'updated_at'> & { id?: string };

export interface CommitmentAudit {
  id: string;
  commitment_id: string;
  tenant_id: string;
  user_id: string;
  action: 'created' | 'updated' | 'deleted' | 'status_changed' | 'stakeholder_added' | 'milestone_completed' | 'metric_updated' | 'risk_assessed';
  previous_values: Record<string, any>;
  new_values: Record<string, any>;
  change_reason?: string;
  created_at: string;
}

export type CommitmentAuditInsert = Omit<CommitmentAudit, 'id' | 'created_at'> & { id?: string };

export interface CommitmentProgress {
  commitment_id: string;
  overall_progress: number;
  milestone_completion: number;
  metric_achievement: number;
  risk_level: string;
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
