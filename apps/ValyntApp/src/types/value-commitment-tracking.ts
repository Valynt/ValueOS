export interface ValueCommitment {
  id: string;
  tenant_id: string;
  session_id: string;
  user_id: string;
  organization_id?: string | null;
  title: string;
  description: string;
  commitment_type: 'financial' | 'timeline' | 'operational' | 'strategic' | 'compliance';
  priority: 'critical' | 'high' | 'medium' | 'low';
  financial_impact?: Record<string, any>;
  currency: string;
  timeframe_months: number;
  status: 'draft' | 'committed' | 'in_progress' | 'on_track' | 'at_risk' | 'completed' | 'cancelled' | 'failed';
  progress_percentage: number;
  confidence_level: number;
  committed_at: string;
  target_completion_date: string;
  actual_completion_date?: string | null;
  ground_truth_references?: Record<string, any>;
  tags?: string[];
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export type ValueCommitmentInsert = Omit<ValueCommitment, 'id' | 'created_at' | 'updated_at'>;

export interface CommitmentStakeholder {
  id: string;
  commitment_id: string;
  tenant_id: string;
  user_id: string;
  role: 'owner' | 'contributor' | 'approver' | 'reviewer' | 'observer';
  responsibility: string;
  accountability_percentage: number;
  notification_preferences?: Record<string, any>;
  joined_at: string;
  last_active_at: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type CommitmentStakeholderInsert = Omit<CommitmentStakeholder, 'id' | 'created_at' | 'updated_at'>;

export interface CommitmentMilestone {
  id: string;
  commitment_id: string;
  tenant_id: string;
  title: string;
  description: string;
  milestone_type: 'planning' | 'execution' | 'review' | 'completion' | 'validation';
  sequence_order: number;
  target_date: string;
  actual_date?: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'delayed' | 'cancelled';
  progress_percentage: number;
  deliverables?: string[];
  dependencies?: string[];
  assigned_to?: string | null;
  success_criteria?: string[];
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export type CommitmentMilestoneInsert = Omit<CommitmentMilestone, 'id' | 'created_at' | 'updated_at'>;

export interface CommitmentMetric {
  id: string;
  commitment_id: string;
  tenant_id: string;
  metric_name: string;
  metric_description: string;
  metric_type: 'kpi' | 'roi' | 'progress' | 'quality' | 'efficiency';
  target_value: number;
  current_value?: number | null;
  unit: string;
  measurement_frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annually';
  baseline_value?: number | null;
  tolerance_percentage: number;
  last_measured_at?: string | null;
  next_measurement_date: string;
  data_source: string;
  is_active: boolean;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export type CommitmentMetricInsert = Omit<CommitmentMetric, 'id' | 'created_at' | 'updated_at'>;

export interface CommitmentAudit {
  id: string;
  commitment_id: string;
  tenant_id: string;
  user_id: string;
  action: 'created' | 'updated' | 'status_changed' | 'stakeholder_added' | 'stakeholder_removed' | 'milestone_completed' | 'metric_updated' | 'risk_assessed';
  previous_values?: Record<string, any>;
  new_values?: Record<string, any>;
  change_reason: string;
  ip_address?: string | null;
  user_agent?: string | null;
  audit_metadata?: Record<string, any>;
  created_at: string;
}

export type CommitmentAuditInsert = Omit<CommitmentAudit, 'id' | 'created_at'>;

export interface CommitmentRisk {
  id: string;
  commitment_id: string;
  tenant_id: string;
  risk_title: string;
  risk_description: string;
  risk_category: 'execution' | 'resource' | 'market' | 'technical' | 'regulatory' | 'financial';
  probability: 'low' | 'medium' | 'high' | 'critical';
  impact: 'low' | 'medium' | 'high' | 'critical';
  risk_score?: number | null;
  mitigation_plan: string;
  contingency_plan: string;
  owner_id: string;
  status: 'identified' | 'mitigating' | 'mitigated' | 'occurred' | 'closed';
  identified_at: string;
  mitigated_at?: string | null;
  occurred_at?: string | null;
  review_date: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export type CommitmentRiskInsert = Omit<CommitmentRisk, 'id' | 'created_at' | 'updated_at'>;

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
