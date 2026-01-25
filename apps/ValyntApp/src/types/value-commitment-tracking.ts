export interface ValueCommitment {
  id: string;
  tenant_id: string;
  user_id: string;
  session_id: string;
  organization_id: string | null;
  title: string;
  description: string;
  commitment_type: string;
  priority: string;
  financial_impact: {
    revenue_uplift: number;
    cost_reduction: number;
  };
  currency: string;
  timeframe_months: number;
  status: 'draft' | 'active' | 'in_progress' | 'completed' | 'at_risk' | 'cancelled';
  progress_percentage: number;
  confidence_level: number;
  committed_at: string;
  target_completion_date: string;
  actual_completion_date: string | null;
  ground_truth_references: {
    benchmark_ids: string[];
    persona: string;
    industry: string;
    confidence_sources: string[];
  };
  tags: string[];
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface ValueCommitmentInsert extends Omit<ValueCommitment, 'id' | 'created_at' | 'updated_at'> {
  id?: string;
}

export interface CommitmentStakeholder {
  id: string;
  commitment_id: string;
  tenant_id: string;
  user_id: string;
  role: string;
  responsibility: string;
  accountability_percentage: number;
  is_active: boolean;
  notification_preferences: any;
  joined_at: string;
  last_active_at: string;
  updated_at: string;
}

export interface CommitmentStakeholderInsert extends Omit<CommitmentStakeholder, 'id' | 'updated_at'> {
  id?: string;
}

export interface CommitmentMilestone {
  id: string;
  commitment_id: string;
  tenant_id: string;
  title: string;
  description: string;
  due_date: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  progress_percentage: number;
  actual_date: string | null;
  updated_at: string;
}

export interface CommitmentMilestoneInsert extends Omit<CommitmentMilestone, 'id' | 'updated_at'> {
  id?: string;
}

export interface CommitmentMetric {
  id: string;
  commitment_id: string;
  tenant_id: string;
  metric_name: string;
  target_value: number;
  current_value: number;
  unit: string;
  is_active: boolean;
  last_measured_at: string;
  updated_at: string;
}

export interface CommitmentMetricInsert extends Omit<CommitmentMetric, 'id' | 'updated_at'> {
  id?: string;
}

export interface CommitmentRisk {
  id: string;
  commitment_id: string;
  tenant_id: string;
  risk_title: string;
  risk_description: string;
  risk_score: number;
  status: 'active' | 'mitigated' | 'resolved';
  identified_at: string;
  mitigated_at: string | null;
  updated_at: string;
}

export interface CommitmentRiskInsert extends Omit<CommitmentRisk, 'id' | 'updated_at'> {
  id?: string;
}

export interface CommitmentAudit {
  id: string;
  commitment_id: string;
  tenant_id: string;
  user_id: string;
  action: 'created' | 'updated' | 'deleted' | 'status_changed' | 'stakeholder_added' | 'milestone_completed' | 'metric_updated' | 'risk_assessed';
  previous_values: Record<string, any>;
  new_values: Record<string, any>;
  change_reason: string;
  created_at: string;
}

export interface CommitmentAuditInsert extends Omit<CommitmentAudit, 'id' | 'created_at'> {
  id?: string;
}

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
