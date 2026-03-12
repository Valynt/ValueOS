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
  status: 'draft' | 'active' | 'at_risk' | 'fulfilled' | 'cancelled';
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
  // Matches CommitmentStatus in backend schemas.ts
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
  user_id: string;
  role: 'owner' | 'contributor' | 'approver' | 'reviewer' | 'observer';
  responsibility: string;
  accountability_percentage: number;
  is_active: boolean;
  joined_at: string;
  updated_at: string;
}

export interface CommitmentMilestone {
  id: string;
  commitment_id: string;
  title: string;
  description: string | null;
  milestone_type: 'planning' | 'execution' | 'review' | 'completion' | 'validation';
  sequence_order: number;
  target_date: string;
  actual_date: string | null;
  // 'cancelled' matches the backend UpdateMilestoneSchema; legacy 'skipped' is not accepted
  status: 'pending' | 'in_progress' | 'completed' | 'delayed' | 'cancelled';
  progress_percentage: number;
  deliverables: string[];
  success_criteria: string[];
  created_at: string;
  updated_at: string;
}

export interface CommitmentMetric {
  id: string;
  commitment_id: string;
  metric_name: string;
  baseline_value: number;
  target_value: number;
  current_value: number | null;
  unit: string;
  is_active: boolean;
  last_measured_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CommitmentRisk {
  id: string;
  commitment_id: string;
  risk_title: string;
  risk_description: string;
  risk_category: 'execution' | 'resource' | 'market' | 'technical' | 'regulatory' | 'financial';
  // Field names match AddRiskRequest / UpdateRiskRequest (not the legacy risk_probability/risk_impact)
  probability: 'low' | 'medium' | 'high' | 'critical';
  impact: 'low' | 'medium' | 'high' | 'critical';
  mitigation_plan: string;
  contingency_plan: string;
  owner_id: string;
  review_date: string;
  status: 'identified' | 'mitigating' | 'mitigated' | 'occurred' | 'closed';
  mitigated_at: string | null;
  updated_at: string;
}

export interface CommitmentAudit {
  id: string;
  commitment_id: string;
  user_id: string;
  action: 'created' | 'updated' | 'deleted' | 'status_changed' | 'stakeholder_added' | 'milestone_completed' | 'metric_updated' | 'risk_assessed';
  previous_values: Record<string, unknown>;
  new_values: Record<string, unknown>;
  change_reason: string;
  metadata?: Record<string, unknown>;
  performed_at: string;
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
