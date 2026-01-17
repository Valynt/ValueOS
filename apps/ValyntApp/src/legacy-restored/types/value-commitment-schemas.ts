/**
 * Value Commitment Tracking Zod Schemas
 *
 * Runtime validation schemas for value commitment tracking data structures
 */

import { z } from "zod";

// Financial Impact Schema
export const FinancialImpactSchema = z.object({
  revenue_uplift: z.number().optional(),
  cost_reduction: z.number().optional(),
  risk_mitigation: z.number().optional(),
  capital_efficiency: z.number().optional(),
  productivity_gain: z.number().optional(),
  fcf_improvement: z.number().optional(),
  ebitda_expansion: z.number().optional(),
});

// Ground Truth References Schema
export const GroundTruthReferencesSchema = z.object({
  benchmark_ids: z.array(z.string()),
  persona: z.string(),
  industry: z.string(),
  confidence_sources: z.array(z.string()),
});

// Value Commitment Schema
export const ValueCommitmentSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string(),
  session_id: z.string(),
  user_id: z.string(),
  organization_id: z.string().nullable(),

  title: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  commitment_type: z.enum(["financial", "timeline", "operational", "strategic", "compliance"]),
  priority: z.enum(["critical", "high", "medium", "low"]),

  financial_impact: FinancialImpactSchema.optional(),
  currency: z.string().default("USD"),
  timeframe_months: z.number().int().min(1).max(120),

  status: z.enum([
    "draft",
    "committed",
    "in_progress",
    "on_track",
    "at_risk",
    "completed",
    "cancelled",
    "failed",
  ]),
  progress_percentage: z.number().min(0).max(100).default(0),
  confidence_level: z.number().min(0).max(100).default(50),

  committed_at: z.string().datetime(),
  target_completion_date: z.string().datetime(),
  actual_completion_date: z.string().datetime().nullable(),

  ground_truth_references: GroundTruthReferencesSchema.optional(),

  tags: z.array(z.string()).default([]),
  metadata: z.record(z.any()).default({}),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

// Commitment Stakeholder Schema
export const CommitmentStakeholderSchema = z.object({
  id: z.string().uuid(),
  commitment_id: z.string().uuid(),
  tenant_id: z.string(),
  user_id: z.string(),
  role: z.enum(["owner", "contributor", "approver", "reviewer", "observer"]),
  responsibility: z.string().min(1).max(500),
  accountability_percentage: z.number().min(0).max(100).default(50),
  notification_preferences: z
    .object({
      email: z.boolean().default(true),
      slack: z.boolean().default(false),
      milestone_updates: z.boolean().default(true),
      risk_alerts: z.boolean().default(true),
    })
    .default({
      email: true,
      slack: false,
      milestone_updates: true,
      risk_alerts: true,
    }),
  joined_at: z.string().datetime(),
  last_active_at: z.string().datetime(),
  is_active: z.boolean().default(true),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

// Commitment Milestone Schema
export const CommitmentMilestoneSchema = z.object({
  id: z.string().uuid(),
  commitment_id: z.string().uuid(),
  tenant_id: z.string(),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(1000),
  milestone_type: z.enum(["planning", "execution", "review", "completion", "validation"]),
  sequence_order: z.number().int().min(1),
  target_date: z.string().datetime(),
  actual_date: z.string().datetime().nullable(),
  status: z.enum(["pending", "in_progress", "completed", "delayed", "cancelled"]),
  progress_percentage: z.number().min(0).max(100).default(0),
  deliverables: z.array(z.string()).default([]),
  dependencies: z.array(z.string()).default([]),
  assigned_to: z.string().uuid().nullable(),
  success_criteria: z.array(z.string()).default([]),
  metadata: z.record(z.any()).default({}),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

// Commitment Metric Schema
export const CommitmentMetricSchema = z.object({
  id: z.string().uuid(),
  commitment_id: z.string().uuid(),
  tenant_id: z.string(),
  metric_name: z.string().min(1).max(100),
  metric_description: z.string().min(1).max(500),
  metric_type: z.enum(["kpi", "roi", "progress", "quality", "efficiency"]),
  target_value: z.number(),
  current_value: z.number().nullable(),
  unit: z.string().min(1).max(20),
  measurement_frequency: z.enum(["daily", "weekly", "monthly", "quarterly", "annually"]),
  baseline_value: z.number().nullable(),
  tolerance_percentage: z.number().min(0).max(100).default(10),
  last_measured_at: z.string().datetime().nullable(),
  next_measurement_date: z.string().datetime(),
  data_source: z.string().min(1).max(200),
  is_active: z.boolean().default(true),
  metadata: z.record(z.any()).default({}),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

// Commitment Audit Schema
export const CommitmentAuditSchema = z.object({
  id: z.string().uuid(),
  commitment_id: z.string().uuid(),
  tenant_id: z.string(),
  user_id: z.string(),
  action: z.enum([
    "created",
    "updated",
    "status_changed",
    "stakeholder_added",
    "stakeholder_removed",
    "milestone_completed",
    "metric_updated",
    "risk_assessed",
  ]),
  previous_values: z.record(z.any()).default({}),
  new_values: z.record(z.any()).default({}),
  change_reason: z.string().min(1).max(500),
  ip_address: z.string().nullable(),
  user_agent: z.string().nullable(),
  audit_metadata: z.record(z.any()).default({}),
  created_at: z.string().datetime(),
});

// Commitment Risk Schema
export const CommitmentRiskSchema = z.object({
  id: z.string().uuid(),
  commitment_id: z.string().uuid(),
  tenant_id: z.string(),
  risk_title: z.string().min(1).max(200),
  risk_description: z.string().min(1).max(1000),
  risk_category: z.enum([
    "execution",
    "resource",
    "market",
    "technical",
    "regulatory",
    "financial",
  ]),
  probability: z.enum(["low", "medium", "high", "critical"]),
  impact: z.enum(["low", "medium", "high", "critical"]),
  risk_score: z.number().min(1).max(16).optional(), // Auto-calculated from probability * impact
  mitigation_plan: z.string().min(1).max(2000),
  contingency_plan: z.string().min(1).max(2000),
  owner_id: z.string(),
  status: z.enum(["identified", "mitigating", "mitigated", "occurred", "closed"]),
  identified_at: z.string().datetime(),
  mitigated_at: z.string().datetime().nullable(),
  occurred_at: z.string().datetime().nullable(),
  review_date: z.string().datetime(),
  metadata: z.record(z.any()).default({}),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

// Progress and Dashboard Schemas
export const CommitmentProgressSchema = z.object({
  commitment_id: z.string().uuid(),
  overall_progress: z.number().min(0).max(100),
  milestone_completion: z.number().min(0).max(100),
  metric_achievement: z.number().min(0).max(100),
  risk_level: z.enum(["low", "medium", "high", "critical"]),
  days_remaining: z.number().int(),
  is_on_track: z.boolean(),
});

export const CommitmentDashboardSchema = z.object({
  commitment: ValueCommitmentSchema,
  stakeholders: z.array(CommitmentStakeholderSchema),
  milestones: z.array(CommitmentMilestoneSchema),
  metrics: z.array(CommitmentMetricSchema),
  risks: z.array(CommitmentRiskSchema),
  progress: CommitmentProgressSchema,
  recent_audits: z.array(CommitmentAuditSchema),
});

// Utility schemas for partial updates
export const ValueCommitmentUpdateSchema = ValueCommitmentSchema.partial().omit({
  id: true,
  tenant_id: true,
  created_at: true,
});

export const CommitmentStakeholderUpdateSchema = CommitmentStakeholderSchema.partial().omit({
  id: true,
  commitment_id: true,
  tenant_id: true,
  created_at: true,
});

export const CommitmentMilestoneUpdateSchema = CommitmentMilestoneSchema.partial().omit({
  id: true,
  commitment_id: true,
  tenant_id: true,
  created_at: true,
});

export const CommitmentMetricUpdateSchema = CommitmentMetricSchema.partial().omit({
  id: true,
  commitment_id: true,
  tenant_id: true,
  created_at: true,
});

export const CommitmentRiskUpdateSchema = CommitmentRiskSchema.partial().omit({
  id: true,
  commitment_id: true,
  tenant_id: true,
  created_at: true,
});

// Validation helpers
export const validateValueCommitment = (data: unknown) => {
  return ValueCommitmentSchema.safeParse(data);
};

export const validateCommitmentStakeholder = (data: unknown) => {
  return CommitmentStakeholderSchema.safeParse(data);
};

export const validateCommitmentMilestone = (data: unknown) => {
  return CommitmentMilestoneSchema.safeParse(data);
};

export const validateCommitmentMetric = (data: unknown) => {
  return CommitmentMetricSchema.safeParse(data);
};

export const validateCommitmentRisk = (data: unknown) => {
  return CommitmentRiskSchema.safeParse(data);
};

export const validateCommitmentDashboard = (data: unknown) => {
  return CommitmentDashboardSchema.safeParse(data);
};

// Type exports for use in other modules
export type ValueCommitmentInput = z.infer<typeof ValueCommitmentSchema>;
export type CommitmentStakeholderInput = z.infer<typeof CommitmentStakeholderSchema>;
export type CommitmentMilestoneInput = z.infer<typeof CommitmentMilestoneSchema>;
export type CommitmentMetricInput = z.infer<typeof CommitmentMetricSchema>;
export type CommitmentAuditInput = z.infer<typeof CommitmentAuditSchema>;
export type CommitmentRiskInput = z.infer<typeof CommitmentRiskSchema>;
export type CommitmentProgressInput = z.infer<typeof CommitmentProgressSchema>;
export type CommitmentDashboardInput = z.infer<typeof CommitmentDashboardSchema>;

// Update type exports
export type ValueCommitmentUpdateInput = z.infer<typeof ValueCommitmentUpdateSchema>;
export type CommitmentStakeholderUpdateInput = z.infer<typeof CommitmentStakeholderUpdateSchema>;
export type CommitmentMilestoneUpdateInput = z.infer<typeof CommitmentMilestoneUpdateSchema>;
export type CommitmentMetricUpdateInput = z.infer<typeof CommitmentMetricUpdateSchema>;
export type CommitmentRiskUpdateInput = z.infer<typeof CommitmentRiskUpdateSchema>;
