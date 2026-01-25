export type CommitmentStatus = 'draft' | 'committed' | 'in_progress' | 'on_track' | 'at_risk' | 'completed' | 'cancelled' | 'failed';
export type CommitmentPriority = 'low' | 'medium' | 'high' | 'critical';
export type CommitmentType = 'financial' | 'timeline' | 'operational' | 'strategic' | 'compliance';

export interface ValueCommitment {
  id: string;
  tenant_id: string;
  session_id?: string;
  user_id: string;
  organization_id?: string | null;
  title: string;
  description?: string;
  commitment_type: CommitmentType;
  priority: CommitmentPriority;
  financial_impact?: {
    revenue_uplift?: number;
    cost_reduction?: number;
    [key: string]: number | undefined;
  };
  currency?: string;
  timeframe_months?: number;
  status: CommitmentStatus;
  progress_percentage: number;
  confidence_level?: number;
  committed_at?: string;
  target_completion_date?: string;
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

export interface ValueCommitmentInsert extends Partial<ValueCommitment> {
  title: string;
  tenant_id: string;
  user_id: string;
}

export type StakeholderRole = 'owner' | 'contributor' | 'approver' | 'reviewer' | 'observer';

export interface CommitmentStakeholder {
  id: string;
  commitment_id: string;
  tenant_id: string;
  user_id: string;
  role: StakeholderRole;
  responsibility?: string;
  accountability_percentage?: number;
  is_active: boolean;
  notification_preferences?: {
    email?: boolean;
    slack?: boolean;
    milestone_updates?: boolean;
    risk_alerts?: boolean;
    [key: string]: boolean | undefined;
  };
  joined_at: string;
  last_active_at?: string;
  updated_at?: string;
}

export interface CommitmentStakeholderInsert extends Partial<CommitmentStakeholder> {
  commitment_id: string;
  tenant_id: string;
  user_id: string;
  role: StakeholderRole;
}

export type MilestoneStatus = 'pending' | 'in_progress' | 'completed' | 'delayed' | 'skipped';

export interface CommitmentMilestone {
  id: string;
  commitment_id: string;
  tenant_id: string;
  title: string;
  description?: string;
  milestone_type?: string;
  sequence_order?: number;
  target_date?: string;
  actual_date?: string;
  progress_percentage: number;
  status: MilestoneStatus;
  deliverables?: string[];
  success_criteria?: string[];
  created_at: string;
  updated_at: string;
}

export interface CommitmentMilestoneInsert extends Partial<CommitmentMilestone> {
  commitment_id: string;
  tenant_id: string;
  title: string;
}

export type MetricType = 'kpi' | 'leading_indicator' | 'lagging_indicator';

export interface CommitmentMetric {
  id: string;
  commitment_id: string;
  tenant_id: string;
  metric_name: string;
  metric_description?: string;
  metric_type?: MetricType;
  current_value?: number;
  target_value?: number;
  unit?: string;
  measurement_frequency?: string;
  baseline_value?: number;
  tolerance_percentage?: number;
  data_source?: string;
  last_measured_at?: string;
  next_measurement_date?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CommitmentMetricInsert extends Partial<CommitmentMetric> {
  commitment_id: string;
  tenant_id: string;
  metric_name: string;
}

export type RiskStatus = 'identified' | 'analyzed' | 'mitigated' | 'occurred' | 'closed';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface CommitmentRisk {
  id: string;
  commitment_id: string;
  tenant_id: string;
  risk_title: string;
  risk_description?: string;
  risk_category?: string;
  probability?: number; // 1-4
  impact?: number; // 1-4
  risk_score?: number; // probability * impact
  status: RiskStatus;
  mitigation_plan?: string;
  owner_id?: string;
  identified_at: string;
  mitigated_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CommitmentRiskInsert extends Partial<CommitmentRisk> {
  commitment_id: string;
  tenant_id: string;
  risk_title: string;
}

export interface CommitmentAudit {
  id: string;
  commitment_id: string;
  tenant_id: string;
  user_id: string;
  action: string;
  previous_values?: Record<string, any>;
  new_values?: Record<string, any>;
  change_reason?: string;
  created_at: string;
}

export interface CommitmentAuditInsert extends Partial<CommitmentAudit> {
  commitment_id: string;
  tenant_id: string;
  user_id: string;
  action: string;
}

export interface CommitmentProgress {
  commitment_id: string;
  overall_progress: number;
  milestone_completion: number;
  metric_achievement: number;
  risk_level: RiskLevel | string;
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
