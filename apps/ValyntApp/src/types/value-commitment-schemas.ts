import { z } from "zod";

export const ValueCommitmentSchema = z.object({
  id: z.string(),
  tenant_id: z.string(),
  user_id: z.string(),
  session_id: z.string(),
  organization_id: z.string().nullable().optional(),
  title: z.string(),
  description: z.string().optional(),
  commitment_type: z.string().optional(),
  priority: z.string().optional(),
  financial_impact: z.object({
    revenue_uplift: z.number().optional(),
    cost_reduction: z.number().optional(),
  }).optional(),
  currency: z.string().optional(),
  timeframe_months: z.number().optional(),
  status: z.enum(['pending', 'in_progress', 'completed', 'at_risk', 'cancelled']).default('pending'),
  progress_percentage: z.number().default(0),
  confidence_level: z.number().optional(),
  committed_at: z.string(),
  target_completion_date: z.string().optional(),
  actual_completion_date: z.string().nullable().optional(),
  ground_truth_references: z.any().optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export const CommitmentStakeholderSchema = z.object({
  id: z.string().optional(),
  commitment_id: z.string(),
  tenant_id: z.string(),
  user_id: z.string(),
  role: z.string(),
  responsibility: z.string().optional(),
  accountability_percentage: z.number().default(0),
  joined_at: z.string(),
  last_active_at: z.string().optional(),
  is_active: z.boolean().default(true),
  notification_preferences: z.record(z.any()).optional(),
  updated_at: z.string().optional(),
});

export const CommitmentMilestoneSchema = z.object({
  id: z.string(),
  commitment_id: z.string(),
  tenant_id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  due_date: z.string().optional(),
  progress_percentage: z.number().default(0),
  status: z.enum(['pending', 'in_progress', 'completed', 'delayed']).default('pending'),
  actual_date: z.string().optional(),
  updated_at: z.string().optional(),
});

export const CommitmentMetricSchema = z.object({
  id: z.string(),
  commitment_id: z.string(),
  tenant_id: z.string(),
  metric_name: z.string(),
  target_value: z.number().optional(),
  current_value: z.number().default(0),
  unit: z.string().optional(),
  frequency: z.string().optional(),
  last_measured_at: z.string().optional(),
  is_active: z.boolean().default(true),
  updated_at: z.string().optional(),
});

export const CommitmentRiskSchema = z.object({
  id: z.string(),
  commitment_id: z.string(),
  tenant_id: z.string(),
  risk_title: z.string(),
  risk_description: z.string().optional(),
  risk_score: z.number().default(0),
  probability: z.string().optional(),
  impact: z.string().optional(),
  status: z.enum(['identified', 'mitigated', 'accepted', 'occurred']).default('identified'),
  mitigation_plan: z.string().optional(),
  identified_at: z.string(),
  mitigated_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export const CommitmentAuditSchema = z.object({
  id: z.string().optional(),
  commitment_id: z.string(),
  tenant_id: z.string(),
  user_id: z.string(),
  action: z.enum(['created', 'updated', 'deleted', 'status_changed', 'stakeholder_added', 'milestone_completed', 'metric_updated', 'risk_assessed']),
  previous_values: z.record(z.any()).optional(),
  new_values: z.record(z.any()).optional(),
  change_reason: z.string().optional(),
  timestamp: z.string().optional(),
});
