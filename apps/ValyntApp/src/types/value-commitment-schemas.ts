/**
 * Frontend Zod schemas for value commitment domain objects.
 *
 * These mirror the backend API response shapes — not the raw DB columns.
 * tenant_id and session_id are internal and never returned to the client.
 * Field names match the backend router schemas in
 * packages/backend/src/api/valueCommitments/schemas.ts.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Commitment (top-level resource)
// ---------------------------------------------------------------------------

export const CommitmentDtoSchema = z.object({
  id: z.string(),
  organization_id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  commitment_type: z.enum(["financial", "operational", "strategic", "compliance"]),
  priority: z.enum(["low", "medium", "high", "critical"]),
  owner_user_id: z.string().nullable(),
  status: z.enum(["draft", "active", "at_risk", "fulfilled", "cancelled"]),
  progress_percentage: z.number(),
  target_completion_date: z.string(),
  timeframe_months: z.number(),
  financial_impact: z.record(z.unknown()).nullable(),
  currency: z.string(),
  tags: z.array(z.string()),
  created_by: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

// ---------------------------------------------------------------------------
// Sub-resources — field names match backend response rows
// ---------------------------------------------------------------------------

export const CommitmentStakeholderSchema = z.object({
  id: z.string(),
  commitment_id: z.string(),
  user_id: z.string(),
  role: z.enum(["owner", "contributor", "approver", "reviewer", "observer"]),
  responsibility: z.string(),
  accountability_percentage: z.number(),
  is_active: z.boolean(),
  joined_at: z.string(),
  updated_at: z.string(),
});

export const CommitmentMilestoneSchema = z.object({
  id: z.string(),
  commitment_id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  milestone_type: z.enum(["planning", "execution", "review", "completion", "validation"]),
  sequence_order: z.number(),
  target_date: z.string(),
  actual_date: z.string().nullable(),
  status: z.enum(["pending", "in_progress", "completed", "delayed", "cancelled"]),
  progress_percentage: z.number(),
  deliverables: z.array(z.string()),
  success_criteria: z.array(z.string()),
  created_at: z.string(),
  updated_at: z.string(),
});

export const CommitmentMetricSchema = z.object({
  id: z.string(),
  commitment_id: z.string(),
  metric_name: z.string(),
  baseline_value: z.number(),
  target_value: z.number(),
  current_value: z.number().nullable(),
  unit: z.string(),
  is_active: z.boolean(),
  last_measured_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const CommitmentRiskSchema = z.object({
  id: z.string(),
  commitment_id: z.string(),
  risk_title: z.string(),
  risk_description: z.string(),
  risk_category: z.enum(["execution", "resource", "market", "technical", "regulatory", "financial"]),
  probability: z.enum(["low", "medium", "high", "critical"]),
  impact: z.enum(["low", "medium", "high", "critical"]),
  mitigation_plan: z.string(),
  contingency_plan: z.string(),
  owner_id: z.string(),
  review_date: z.string(),
  status: z.enum(["identified", "mitigating", "mitigated", "occurred", "closed"]),
  mitigated_at: z.string().nullable(),
  updated_at: z.string(),
});

export const CommitmentAuditSchema = z.object({
  id: z.string(),
  commitment_id: z.string(),
  user_id: z.string(),
  action: z.enum([
    "created", "updated", "deleted", "status_changed",
    "stakeholder_added", "milestone_completed", "metric_updated", "risk_assessed",
  ]),
  previous_values: z.record(z.unknown()),
  new_values: z.record(z.unknown()),
  change_reason: z.string(),
  metadata: z.record(z.unknown()).optional(),
  performed_at: z.string(),
});

export const CommitmentProgressSchema = z.object({
  commitment_id: z.string(),
  overall_progress: z.number(),
  milestone_completion: z.number(),
  metric_achievement: z.number(),
  risk_level: z.string(),
  days_remaining: z.number(),
  is_on_track: z.boolean(),
});

export const ValidateProgressResponseSchema = z.object({
  isValid: z.boolean(),
  confidence: z.number(),
  issues: z.array(z.string()),
  recommendations: z.array(z.string()),
});
