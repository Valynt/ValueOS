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

// ---------------------------------------------------------------------------
// Milestone schemas
// ---------------------------------------------------------------------------

export const CreateMilestoneSchema = z.object({
  title:            shortText(200),
  description:      optText(2000),
  milestone_type:   z.string().min(1).max(50).default('deliverable'),
  sequence_order:   z.number().int().min(0).default(0),
  target_date:      isoDate,
  deliverables:     z.array(z.string().max(500)).max(50).optional(),
  success_criteria: z.array(z.string().max(500)).max(50).optional(),
});
export type CreateMilestoneInput = z.infer<typeof CreateMilestoneSchema>;

export const UpdateMilestoneSchema = z.object({
  progress_percentage: z.number().int().min(0).max(100),
  status:              z.enum(['pending', 'in_progress', 'completed', 'delayed', 'skipped']).optional(),
  actual_date:         isoDate.optional(),
});
export type UpdateMilestoneInput = z.infer<typeof UpdateMilestoneSchema>;

// ---------------------------------------------------------------------------
// Metric schemas
// ---------------------------------------------------------------------------

export const UpdateMetricSchema = z.object({
  current_value:    z.number().finite(),
  last_measured_at: isoDate.optional(),
});
export type UpdateMetricInput = z.infer<typeof UpdateMetricSchema>;

// ---------------------------------------------------------------------------
// Risk schemas
// ---------------------------------------------------------------------------

export const CreateRiskSchema = z.object({
  risk_title:        shortText(200),
  risk_description:  z.string().min(1).max(2000).trim(),
  risk_category:     z.string().min(1).max(100).trim(),
  probability:       z.enum(['low', 'medium', 'high', 'critical']),
  impact:            z.enum(['low', 'medium', 'high', 'critical']),
  risk_score:        z.number().min(0).max(100).optional(),
  mitigation_plan:   z.string().min(1).max(2000).trim(),
  contingency_plan:  z.string().min(1).max(2000).trim(),
  owner_id:          uuid,
  review_date:       isoDate,
});
export type CreateRiskInput = z.infer<typeof CreateRiskSchema>;

export const UpdateRiskStatusSchema = z.object({
  status:       z.enum(['identified', 'active', 'mitigated', 'accepted', 'occurred']),
  mitigated_at: isoDate.optional(),
});
export type UpdateRiskStatusInput = z.infer<typeof UpdateRiskStatusSchema>;

// ---------------------------------------------------------------------------
// Stakeholder schemas
// ---------------------------------------------------------------------------

export const AddStakeholderSchema = z.object({
  user_id:                   uuid,
  role:                      shortText(100),
  responsibility:            z.string().min(1).max(1000).trim(),
  accountability_percentage: z.number().int().min(0).max(100).optional(),
});
export type AddStakeholderInput = z.infer<typeof AddStakeholderSchema>;
