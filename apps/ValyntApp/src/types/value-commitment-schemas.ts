import { z } from "zod";

export const ValueCommitmentSchema = z.object({
  id: z.string().optional(),
  tenant_id: z.string(),
  user_id: z.string(),
  session_id: z.string(),
  organization_id: z.string().nullable().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  commitment_type: z.enum(['financial', 'strategic', 'operational', 'other']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  financial_impact: z.object({
    revenue_uplift: z.number().optional(),
    cost_reduction: z.number().optional(),
  }).optional(),
  currency: z.string().default('USD'),
  timeframe_months: z.number().optional(),
  status: z.enum(['draft', 'pending', 'active', 'in_progress', 'completed', 'cancelled', 'at_risk']).default('draft'),
  progress_percentage: z.number().default(0),
  confidence_level: z.number().default(0),
  committed_at: z.string().datetime().optional(),
  target_completion_date: z.string().datetime().optional(),
  actual_completion_date: z.string().datetime().nullable().optional(),
  ground_truth_references: z.record(z.any()).optional(),
  tags: z.array(z.string()).default([]),
  metadata: z.record(z.any()).default({}),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});

export const CommitmentStakeholderSchema = z.object({
  id: z.string().optional(),
  commitment_id: z.string(),
  tenant_id: z.string(),
  user_id: z.string(),
  role: z.string(),
  responsibility: z.string().optional(),
  accountability_percentage: z.number().default(0),
  is_active: z.boolean().default(true),
  notification_preferences: z.record(z.any()).optional(),
  joined_at: z.string().datetime(),
  last_active_at: z.string().datetime().optional(),
});

export const CommitmentMilestoneSchema = z.object({
  id: z.string().optional(),
  commitment_id: z.string(),
  tenant_id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  due_date: z.string().datetime(),
  status: z.string().default('pending'),
  progress_percentage: z.number().default(0),
  actual_date: z.string().datetime().optional(),
});

export const CommitmentMetricSchema = z.object({
  id: z.string().optional(),
  commitment_id: z.string(),
  tenant_id: z.string(),
  metric_name: z.string(),
  target_value: z.number(),
  current_value: z.number().default(0),
  unit: z.string(),
  last_measured_at: z.string().datetime().optional(),
  is_active: z.boolean().default(true),
});

export const CommitmentRiskSchema = z.object({
  id: z.string().optional(),
  commitment_id: z.string(),
  tenant_id: z.string(),
  risk_title: z.string(),
  risk_description: z.string().optional(),
  risk_score: z.number(),
  status: z.string().default('identified'),
  mitigation_plan: z.string().optional(),
  identified_at: z.string().datetime(),
  mitigated_at: z.string().datetime().optional(),
});

export const CommitmentAuditSchema = z.object({
  id: z.string().optional(),
  commitment_id: z.string(),
  tenant_id: z.string(),
  user_id: z.string(),
  action: z.string(),
  previous_values: z.record(z.any()).optional(),
  new_values: z.record(z.any()).optional(),
  change_reason: z.string().optional(),
  created_at: z.string().datetime().optional(),
});
