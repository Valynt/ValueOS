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
  financial_impact: {
    revenue_uplift?: number;
    cost_reduction?: number;
    [key: string]: any;
  };
  currency: string;
  timeframe_months: number;
  status: 'draft' | 'in_progress' | 'completed' | 'at_risk' | 'cancelled';
  progress_percentage: number;
  confidence_level: number;
  committed_at: string;
  target_completion_date: string;
  actual_completion_date?: string | null;
  ground_truth_references?: {
    benchmark_ids?: string[];
    persona?: string;
    industry?: string;
    confidence_sources?: string[];
    [key: string]: any;
  };
  tags?: string[];
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface CommitmentStakeholder {
  id: string;
  commitment_id: string;
  tenant_id: string;
  user_id: string;
  role: string;
  responsibility?: string;
  accountability_percentage: number;
  is_active: boolean;
  notification_preferences: Record<string, any>;
  joined_at: string;
  last_active_at: string;
  updated_at?: string;
}

export interface CommitmentMilestone {
  id: string;
  commitment_id: string;
  tenant_id: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'delayed';
  progress_percentage: number;
  due_date?: string;
  actual_date?: string;
  created_at: string;
  updated_at: string;
}

export interface CommitmentMetric {
  id: string;
  commitment_id: string;
  tenant_id: string;
  metric_name: string;
  target_value: number;
  current_value: number;
  unit: string;
  last_measured_at?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CommitmentRisk {
  id: string;
  commitment_id: string;
  tenant_id: string;
  risk_title: string;
  risk_description?: string;
  risk_score: number;
  status: 'identified' | 'mitigated' | 'occurred' | 'resolved';
  identified_at: string;
  mitigated_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CommitmentAudit {
  id?: string;
  commitment_id: string;
  tenant_id: string;
  user_id: string;
  action: 'created' | 'updated' | 'deleted' | 'status_changed' | 'stakeholder_added' | 'milestone_completed' | 'metric_updated' | 'risk_assessed';
  previous_values: Record<string, any>;
  new_values: Record<string, any>;
  change_reason: string;
  created_at?: string;
}

export interface CommitmentProgress {
  commitment_id: string;
  overall_progress: number;
  milestone_completion: number;
  metric_achievement: number;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
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

export type ValueCommitmentInsert = Partial<ValueCommitment>;
export type CommitmentStakeholderInsert = Partial<CommitmentStakeholder>;
export type CommitmentMilestoneInsert = Partial<CommitmentMilestone>;
export type CommitmentMetricInsert = Partial<CommitmentMetric>;
export type CommitmentRiskInsert = Partial<CommitmentRisk>;
export type CommitmentAuditInsert = CommitmentAudit;
