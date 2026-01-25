import { z } from "zod";

export const ValueCommitmentSchema = z.object({
  id: z.string().optional(),
  tenant_id: z.string(),
  user_id: z.string(),
  session_id: z.string(),
  organization_id: z.string().nullable().optional(),
  title: z.string(),
  description: z.string(),
  commitment_type: z.string(),
  priority: z.string(),
  financial_impact: z.object({
    revenue_uplift: z.number(),
    cost_reduction: z.number(),
  }),
  currency: z.string(),
  timeframe_months: z.number(),
  status: z.enum(['draft', 'active', 'in_progress', 'completed', 'at_risk', 'cancelled']).optional(),
  progress_percentage: z.number().optional(),
  confidence_level: z.number().optional(),
  committed_at: z.string(),
  target_completion_date: z.string(),
  actual_completion_date: z.string().nullable().optional(),
  ground_truth_references: z.object({
    benchmark_ids: z.array(z.string()),
    persona: z.string(),
    industry: z.string(),
    confidence_sources: z.array(z.string()),
  }),
  tags: z.array(z.string()),
  metadata: z.record(z.any()),
});

export const CommitmentStakeholderSchema = z.object({
  id: z.string().optional(),
  commitment_id: z.string(),
  tenant_id: z.string(),
  user_id: z.string(),
  role: z.string(),
  responsibility: z.string(),
  accountability_percentage: z.number(),
  is_active: z.boolean().optional(),
  notification_preferences: z.any().optional(),
  joined_at: z.string(),
  last_active_at: z.string(),
});

export const CommitmentMilestoneSchema = z.object({
  id: z.string().optional(),
  commitment_id: z.string(),
  tenant_id: z.string(),
  title: z.string(),
  description: z.string(),
  due_date: z.string(),
  status: z.enum(['pending', 'in_progress', 'completed', 'blocked']).optional(),
  progress_percentage: z.number().optional(),
  actual_date: z.string().nullable().optional(),
});

export const CommitmentMetricSchema = z.object({
  id: z.string().optional(),
  commitment_id: z.string(),
  tenant_id: z.string(),
  metric_name: z.string(),
  target_value: z.number(),
  current_value: z.number(),
  unit: z.string(),
  is_active: z.boolean().optional(),
  last_measured_at: z.string().optional(),
});

export const CommitmentRiskSchema = z.object({
  id: z.string().optional(),
  commitment_id: z.string(),
  tenant_id: z.string(),
  risk_title: z.string(),
  risk_description: z.string(),
  risk_score: z.number(),
  status: z.enum(['active', 'mitigated', 'resolved']).optional(),
  identified_at: z.string(),
  mitigated_at: z.string().nullable().optional(),
});

export const CommitmentAuditSchema = z.object({
  id: z.string().optional(),
  commitment_id: z.string(),
  tenant_id: z.string(),
  user_id: z.string(),
  action: z.enum(['created', 'updated', 'deleted', 'status_changed', 'stakeholder_added', 'milestone_completed', 'metric_updated', 'risk_assessed']),
  previous_values: z.record(z.any()),
  new_values: z.record(z.any()),
  change_reason: z.string(),
});
