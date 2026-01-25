export interface ValueCommitment {
  id: string;
  tenant_id: string;
  session_id: string;
  user_id: string;
  organization_id: string | null;
  title: string;
  description: string;
  commitment_type: 'financial' | 'strategic' | 'operational';
  priority: 'low' | 'medium' | 'high' | 'critical';
  financial_impact: {
    revenue_uplift?: number;
    cost_reduction?: number;
    cost_avoidance?: number;
    efficiency_gain?: number;
  };
  currency: string;
  timeframe_months: number;
  status: 'draft' | 'pending_approval' | 'in_progress' | 'at_risk' | 'completed' | 'cancelled';
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

export type ValueCommitmentInsert = Omit<ValueCommitment, 'id' | 'created_at' | 'updated_at'>;

export interface CommitmentStakeholder {
  id: string;
  commitment_id: string;
  tenant_id: string;
  user_id: string;
  role: 'owner' | 'contributor' | 'approver' | 'observer';
  responsibility: string;
  accountability_percentage: number;
  is_active: boolean;
  notification_preferences: {
    email: boolean;
    in_app: boolean;
    frequency: 'real_time' | 'daily' | 'weekly';
  };
  joined_at: string;
  last_active_at: string;
  created_at: string;
  updated_at: string;
}

export type CommitmentStakeholderInsert = Omit<CommitmentStakeholder, 'id' | 'created_at' | 'updated_at' | 'joined_at' | 'last_active_at' | 'is_active' | 'notification_preferences'> & {
  joined_at?: string;
  last_active_at?: string;
  is_active?: boolean;
  notification_preferences?: {
    email: boolean;
    in_app: boolean;
    frequency: 'real_time' | 'daily' | 'weekly';
  };
};

export interface CommitmentMilestone {
  id: string;
  commitment_id: string;
  tenant_id: string;
  title: string;
  description: string;
  due_date: string;
  actual_date: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'delayed' | 'skipped';
  progress_percentage: number;
  dependencies: string[];
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export type CommitmentMilestoneInsert = Omit<CommitmentMilestone, 'id' | 'created_at' | 'updated_at'>;

export interface CommitmentMetric {
  id: string;
  commitment_id: string;
  tenant_id: string;
  metric_name: string;
  metric_type: 'financial' | 'operational' | 'satisfaction' | 'adoption';
  unit: string;
  target_value: number;
  current_value: number;
  baseline_value: number;
  measurement_frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  data_source: string;
  is_active: boolean;
  last_measured_at: string | null;
  created_at: string;
  updated_at: string;
}

export type CommitmentMetricInsert = Omit<CommitmentMetric, 'id' | 'created_at' | 'updated_at'>;

export interface CommitmentRisk {
  id: string;
  commitment_id: string;
  tenant_id: string;
  risk_title: string;
  risk_description: string;
  risk_type: 'financial' | 'technical' | 'market' | 'operational';
  probability: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  risk_score: number;
  mitigation_plan: string;
  status: 'identified' | 'mitigating' | 'mitigated' | 'accepted' | 'occurred';
  owner_id: string | null;
  identified_at: string;
  mitigated_at: string | null;
  created_at: string;
  updated_at: string;
}

export type CommitmentRiskInsert = Omit<CommitmentRisk, 'id' | 'created_at' | 'updated_at'>;

export interface CommitmentAudit {
  id: string;
  commitment_id: string;
  tenant_id: string;
  user_id: string;
  action: 'created' | 'updated' | 'deleted' | 'status_changed' | 'stakeholder_added' | 'stakeholder_removed' | 'milestone_completed' | 'metric_updated' | 'risk_assessed';
  previous_values: Record<string, any>;
  new_values: Record<string, any>;
  change_reason: string;
  created_at: string;
}

export type CommitmentAuditInsert = Omit<CommitmentAudit, 'id' | 'created_at'>;

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
