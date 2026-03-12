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
    revenue_uplift?: number;
    cost_reduction?: number;
  };
  currency: string;
  timeframe_months: number;
  status: 'draft' | 'active' | 'completed' | 'cancelled' | 'at_risk' | 'in_progress';
  progress_percentage: number;
  confidence_level: number;
  committed_at: string;
  target_completion_date: string;
  actual_completion_date: string | null;
  ground_truth_references: Record<string, unknown>;
  tags: string[];
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/**
 * Shape returned by the backend /api/v1/value-commitments endpoints.
 * Does not include internal columns (tenant_id, session_id, etc.).
 */
export interface CommitmentDto {
  id: string;
  organization_id: string;
  title: string;
  description: string | null;
  commitment_type: string;
  priority: string;
  owner_user_id: string | null;
  status: 'draft' | 'active' | 'at_risk' | 'fulfilled' | 'cancelled';
  progress_percentage: number;
  target_completion_date: string;
  timeframe_months: number;
  financial_impact: Record<string, unknown> | null;
  currency: string;
  tags: string[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface NoteDto {
  id: string;
  commitment_id: string;
  body: string;
  visibility: 'internal' | 'stakeholder';
  created_by: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Request shapes for the backend API (no tenant fields — backend derives them)
// ---------------------------------------------------------------------------

export interface CreateCommitmentRequest {
  title: string;
  description?: string;
  commitment_type: 'financial' | 'operational' | 'strategic' | 'compliance';
  priority?: 'low' | 'medium' | 'high' | 'critical';
  owner_user_id: string;
  target_completion_date: string;
  timeframe_months: number;
  financial_impact?: Record<string, unknown>;
  currency?: string;
  tags?: string[];
  metrics?: Array<{
    metric_name: string;
    baseline_value: number;
    target_value: number;
    unit: string;
  }>;
}

export interface UpdateCommitmentRequest {
  title?: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  target_completion_date?: string;
  timeframe_months?: number;
  financial_impact?: Record<string, unknown>;
  tags?: string[];
}

export interface StatusTransitionRequest {
  status: 'draft' | 'active' | 'at_risk' | 'fulfilled' | 'cancelled';
  progress_percentage?: number;
  reason?: string;
}

export interface AddNoteRequest {
  body: string;
  visibility?: 'internal' | 'stakeholder';
}

export type ValueCommitmentInsert = Omit<ValueCommitment, 'id' | 'created_at' | 'updated_at'> & { id?: string };

// ---------------------------------------------------------------------------
// Sub-resource request shapes (no tenant fields — backend derives them)
// ---------------------------------------------------------------------------

export interface AddMilestoneRequest {
  title: string;
  description?: string;
  milestone_type: 'planning' | 'execution' | 'review' | 'completion' | 'validation';
  sequence_order: number;
  target_date: string;
  deliverables?: string[];
  success_criteria?: string[];
}

export interface UpdateMilestoneRequest {
  title?: string;
  description?: string;
  status?: 'pending' | 'in_progress' | 'completed' | 'delayed' | 'cancelled';
  progress_percentage?: number;
  target_date?: string;
  actual_date?: string;
  deliverables?: string[];
  success_criteria?: string[];
}

export interface AddMetricRequest {
  metric_name: string;
  baseline_value: number;
  target_value: number;
  unit: string;
}

export interface UpdateMetricActualRequest {
  current_value: number;
}

export interface AddRiskRequest {
  risk_title: string;
  risk_description: string;
  risk_category: 'execution' | 'resource' | 'market' | 'technical' | 'regulatory' | 'financial';
  probability: 'low' | 'medium' | 'high' | 'critical';
  impact: 'low' | 'medium' | 'high' | 'critical';
  mitigation_plan: string;
  contingency_plan: string;
  owner_id: string;
  review_date: string;
}

export interface UpdateRiskRequest {
  status?: 'identified' | 'mitigating' | 'mitigated' | 'occurred' | 'closed';
  probability?: 'low' | 'medium' | 'high' | 'critical';
  impact?: 'low' | 'medium' | 'high' | 'critical';
  mitigated_at?: string;
  review_date?: string;
}

export interface AddStakeholderRequest {
  user_id: string;
  role: 'owner' | 'contributor' | 'approver' | 'reviewer' | 'observer';
  responsibility: string;
  accountability_percentage?: number;
}

export interface UpdateStakeholderRequest {
  role?: 'owner' | 'contributor' | 'approver' | 'reviewer' | 'observer';
  responsibility?: string;
  accountability_percentage?: number;
  is_active?: boolean;
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
  notification_preferences: Record<string, any>;
  joined_at: string;
  last_active_at: string;
  updated_at: string;
}

export type CommitmentStakeholderInsert = Omit<CommitmentStakeholder, 'id' | 'updated_at'> & { id?: string };

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
  weight: number;
  owner_id: string;
  dependencies: string[];
  deliverables: Record<string, any>[];
  created_at: string;
  updated_at: string;
}

export type CommitmentMilestoneInsert = Omit<CommitmentMilestone, 'id' | 'created_at' | 'updated_at'> & { id?: string };

export interface CommitmentMetric {
  id: string;
  commitment_id: string;
  tenant_id: string;
  metric_name: string;
  metric_type: string;
  baseline_value: number;
  target_value: number;
  current_value: number;
  unit: string;
  data_source: string;
  collection_frequency: string;
  is_active: boolean;
  last_measured_at: string;
  next_measurement_due: string;
  created_at: string;
  updated_at: string;
}

export type CommitmentMetricInsert = Omit<CommitmentMetric, 'id' | 'created_at' | 'updated_at'> & { id?: string };

export interface CommitmentRisk {
  id: string;
  commitment_id: string;
  tenant_id: string;
  risk_title: string;
  risk_description: string;
  risk_category: string;
  risk_probability: 'low' | 'medium' | 'high';
  risk_impact: 'low' | 'medium' | 'high';
  risk_score: number;
  mitigation_strategy: string;
  owner_id: string;
  status: 'active' | 'mitigated' | 'accepted' | 'occurred';
  identified_at: string;
  mitigated_at: string | null;
  updated_at: string;
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
  change_reason: string;
  metadata?: Record<string, any>;
  performed_at: string;
}

export type CommitmentAuditInsert = Omit<CommitmentAudit, 'id' | 'performed_at'> & { id?: string };

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
