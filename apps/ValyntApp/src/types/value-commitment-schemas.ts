import { z } from "zod";

export const ValueCommitmentSchema = z.object({
  id: z.string().optional(),
  tenant_id: z.string(),
  user_id: z.string(),
  session_id: z.string(),
  organization_id: z.string().nullable().optional(),
  title: z.string(),
  description: z.string().optional(),
  commitment_type: z.enum(["financial", "operational", "strategic"]),
  priority: z.enum(["high", "medium", "low"]),
  financial_impact: z.object({
    revenue_uplift: z.number().optional(),
    cost_reduction: z.number().optional(),
  }).optional(),
  currency: z.string().optional(),
  timeframe_months: z.number().optional(),
  status: z.enum(["draft", "in_progress", "at_risk", "achieved", "missed"]),
  progress_percentage: z.number(),
  confidence_level: z.number().optional(),
  committed_at: z.string(),
  target_completion_date: z.string().optional(),
  actual_completion_date: z.string().nullable().optional(),
  ground_truth_references: z.any().optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.any().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export const CommitmentStakeholderSchema = z.object({
  id: z.string().optional(),
  commitment_id: z.string(),
  tenant_id: z.string(),
  user_id: z.string(),
  role: z.enum(["owner", "contributor", "reviewer", "approver"]),
  responsibility: z.string().optional(),
  accountability_percentage: z.number().optional(),
  is_active: z.boolean().optional(),
  notification_preferences: z.any().optional(),
  joined_at: z.string(),
  last_active_at: z.string(),
  updated_at: z.string().optional(),
});

export const CommitmentMilestoneSchema = z.object({
  id: z.string().optional(),
  commitment_id: z.string(),
  tenant_id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  status: z.enum(["pending", "in_progress", "completed", "delayed"]),
  progress_percentage: z.number(),
  due_date: z.string().optional(),
  actual_date: z.string().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export const CommitmentMetricSchema = z.object({
  id: z.string().optional(),
  commitment_id: z.string(),
  tenant_id: z.string(),
  metric_name: z.string(),
  target_value: z.number(),
  current_value: z.number(),
  unit: z.string(),
  is_active: z.boolean(),
  last_measured_at: z.string().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export const CommitmentRiskSchema = z.object({
  id: z.string().optional(),
  commitment_id: z.string(),
  tenant_id: z.string(),
  risk_title: z.string(),
  risk_description: z.string().optional(),
  risk_score: z.number(),
  status: z.enum(["identified", "mitigated", "occurred", "closed"]),
  identified_at: z.string(),
  mitigated_at: z.string().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export const CommitmentAuditSchema = z.object({
  id: z.string().optional(),
  commitment_id: z.string(),
  tenant_id: z.string(),
  user_id: z.string(),
  action: z.enum(["created", "updated", "deleted", "status_changed", "stakeholder_added", "risk_assessed", "milestone_completed", "metric_updated"]),
  previous_values: z.any().optional(),
  new_values: z.any().optional(),
  change_reason: z.string().optional(),
  created_at: z.string().optional(),
});
