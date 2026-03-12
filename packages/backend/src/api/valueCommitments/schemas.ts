/**
 * Zod command schemas for value commitment mutations.
 *
 * organizationId is never accepted from the request body — it is always
 * resolved server-side from the authenticated session and injected by the
 * controller before calling the service.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

const uuid = z.string().uuid();
const isoDate = z.string().datetime({ offset: true });
const shortText = (max = 255) => z.string().min(1).max(max).trim();
const optText = (max = 255) => z.string().max(max).trim().optional();

// ---------------------------------------------------------------------------
// Commitment status FSM
// draft → active → fulfilled | cancelled
// active → at_risk (system-set, also allowed via API for manual override)
// ---------------------------------------------------------------------------

export const CommitmentStatus = z.enum([
  'draft',
  'active',
  'at_risk',
  'fulfilled',
  'cancelled',
]);
export type CommitmentStatus = z.infer<typeof CommitmentStatus>;

/** Allowed client-initiated transitions per source status. */
export const ALLOWED_TRANSITIONS: Record<CommitmentStatus, CommitmentStatus[]> = {
  draft:      ['active', 'cancelled'],
  active:     ['at_risk', 'fulfilled', 'cancelled'],
  at_risk:    ['active', 'fulfilled', 'cancelled'],
  fulfilled:  [],
  cancelled:  [],
};

// ---------------------------------------------------------------------------
// Create commitment
// ---------------------------------------------------------------------------

export const CreateCommitmentSchema = z.object({
  title:                shortText(200),
  description:          optText(2000),
  commitment_type:      z.enum(['financial', 'operational', 'strategic', 'compliance']),
  priority:             z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  owner_user_id:        uuid,
  target_completion_date: isoDate,
  timeframe_months:     z.number().int().min(1).max(120),
  financial_impact:     z.record(z.unknown()).optional(),
  currency:             z.string().length(3).toUpperCase().default('USD'),
  tags:                 z.array(z.string().max(50)).max(20).optional(),
  metrics: z.array(z.object({
    metric_name:    shortText(100),
    baseline_value: z.number().finite(),
    target_value:   z.number().finite(),
    unit:           shortText(50),
  })).max(20).optional(),
});
export type CreateCommitmentInput = z.infer<typeof CreateCommitmentSchema>;

// ---------------------------------------------------------------------------
// Update commitment (core fields — status has its own endpoint)
// ---------------------------------------------------------------------------

export const UpdateCommitmentSchema = z.object({
  title:                  shortText(200).optional(),
  description:            optText(2000),
  priority:               z.enum(['low', 'medium', 'high', 'critical']).optional(),
  target_completion_date: isoDate.optional(),
  timeframe_months:       z.number().int().min(1).max(120).optional(),
  financial_impact:       z.record(z.unknown()).optional(),
  tags:                   z.array(z.string().max(50)).max(20).optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'At least one field required' });
export type UpdateCommitmentInput = z.infer<typeof UpdateCommitmentSchema>;

// ---------------------------------------------------------------------------
// Status transition
// ---------------------------------------------------------------------------

export const StatusTransitionSchema = z.object({
  status: CommitmentStatus,
  progress_percentage: z.number().int().min(0).max(100).optional(),
  reason: z.string().max(500).trim().optional(),
});
export type StatusTransitionInput = z.infer<typeof StatusTransitionSchema>;

// ---------------------------------------------------------------------------
// Add note
// ---------------------------------------------------------------------------

export const AddNoteSchema = z.object({
  body: z.string().min(1).max(5000).trim(),
  visibility: z.enum(['internal', 'stakeholder']).default('internal'),
});
export type AddNoteInput = z.infer<typeof AddNoteSchema>;

// ---------------------------------------------------------------------------
// Milestone schemas
// ---------------------------------------------------------------------------

export const AddMilestoneSchema = z.object({
  title:            shortText(200),
  description:      optText(1000),
  milestone_type:   z.enum(['planning', 'execution', 'review', 'completion', 'validation']),
  sequence_order:   z.number().int().min(1),
  target_date:      isoDate,
  deliverables:     z.array(z.string().max(500)).max(20).optional(),
  success_criteria: z.array(z.string().max(500)).max(20).optional(),
});
export type AddMilestoneInput = z.infer<typeof AddMilestoneSchema>;

export const UpdateMilestoneSchema = z.object({
  title:              shortText(200).optional(),
  description:        optText(1000),
  status:             z.enum(['pending', 'in_progress', 'completed', 'delayed', 'cancelled']).optional(),
  progress_percentage: z.number().int().min(0).max(100).optional(),
  target_date:        isoDate.optional(),
  actual_date:        isoDate.optional(),
  deliverables:       z.array(z.string().max(500)).max(20).optional(),
  success_criteria:   z.array(z.string().max(500)).max(20).optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'At least one field required' });
export type UpdateMilestoneInput = z.infer<typeof UpdateMilestoneSchema>;

// ---------------------------------------------------------------------------
// Metric schemas
// ---------------------------------------------------------------------------

export const AddMetricSchema = z.object({
  metric_name:    shortText(100),
  baseline_value: z.number().finite(),
  target_value:   z.number().finite(),
  unit:           shortText(50),
});
export type AddMetricInput = z.infer<typeof AddMetricSchema>;

export const UpdateMetricActualSchema = z.object({
  current_value: z.number().finite(),
});
export type UpdateMetricActualInput = z.infer<typeof UpdateMetricActualSchema>;

// ---------------------------------------------------------------------------
// Risk schemas
// ---------------------------------------------------------------------------

export const AddRiskSchema = z.object({
  risk_title:       shortText(200),
  risk_description: shortText(1000),
  risk_category:    z.enum(['execution', 'resource', 'market', 'technical', 'regulatory', 'financial']),
  probability:      z.enum(['low', 'medium', 'high', 'critical']),
  impact:           z.enum(['low', 'medium', 'high', 'critical']),
  mitigation_plan:  shortText(2000),
  contingency_plan: shortText(2000),
  owner_id:         uuid,
  review_date:      isoDate,
});
export type AddRiskInput = z.infer<typeof AddRiskSchema>;

export const UpdateRiskSchema = z.object({
  status:       z.enum(['identified', 'mitigating', 'mitigated', 'occurred', 'closed']).optional(),
  probability:  z.enum(['low', 'medium', 'high', 'critical']).optional(),
  impact:       z.enum(['low', 'medium', 'high', 'critical']).optional(),
  mitigated_at: isoDate.optional(),
  review_date:  isoDate.optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'At least one field required' });
export type UpdateRiskInput = z.infer<typeof UpdateRiskSchema>;

// ---------------------------------------------------------------------------
// Stakeholder schemas
// ---------------------------------------------------------------------------

export const AddStakeholderSchema = z.object({
  user_id:                   uuid,
  role:                      z.enum(['owner', 'contributor', 'approver', 'reviewer', 'observer']),
  responsibility:            shortText(500),
  accountability_percentage: z.number().min(0).max(100).optional(),
});
export type AddStakeholderInput = z.infer<typeof AddStakeholderSchema>;

export const UpdateStakeholderSchema = z.object({
  role:                      z.enum(['owner', 'contributor', 'approver', 'reviewer', 'observer']).optional(),
  responsibility:            shortText(500).optional(),
  accountability_percentage: z.number().min(0).max(100).optional(),
  is_active:                 z.boolean().optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'At least one field required' });
export type UpdateStakeholderInput = z.infer<typeof UpdateStakeholderSchema>;

// ---------------------------------------------------------------------------
// Response DTOs — strip internal columns before sending to client
// ---------------------------------------------------------------------------

export interface CommitmentDto {
  id: string;
  organization_id: string;
  title: string;
  description: string | null;
  commitment_type: string;
  priority: string;
  owner_user_id: string | null;
  status: CommitmentStatus;
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
  visibility: string;
  created_by: string;
  created_at: string;
}

/** Strip columns that must not leak to clients (tenant_id, session_id, etc.). */
export function toCommitmentDto(row: Record<string, unknown>): CommitmentDto {
  return {
    id:                     row['id'] as string,
    organization_id:        row['organization_id'] as string,
    title:                  row['title'] as string,
    description:            (row['description'] as string | null) ?? null,
    commitment_type:        row['commitment_type'] as string,
    priority:               row['priority'] as string,
    owner_user_id:          (row['owner_user_id'] as string | null) ?? null,
    status:                 row['status'] as CommitmentStatus,
    progress_percentage:    (row['progress_percentage'] as number) ?? 0,
    target_completion_date: row['target_completion_date'] as string,
    timeframe_months:       row['timeframe_months'] as number,
    financial_impact:       (row['financial_impact'] as Record<string, unknown> | null) ?? null,
    currency:               (row['currency'] as string) ?? 'USD',
    tags:                   (row['tags'] as string[]) ?? [],
    created_by:             row['created_by'] as string,
    created_at:             row['created_at'] as string,
    updated_at:             row['updated_at'] as string,
  };
}

export function toNoteDto(row: Record<string, unknown>): NoteDto {
  return {
    id:            row['id'] as string,
    commitment_id: row['commitment_id'] as string,
    body:          row['body'] as string,
    visibility:    row['visibility'] as string,
    created_by:    row['created_by'] as string,
    created_at:    row['created_at'] as string,
  };
}
