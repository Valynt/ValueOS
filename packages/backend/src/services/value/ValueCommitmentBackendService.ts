/**
 * ValueCommitmentBackendService
 *
 * Server-side authority for all value commitment mutations. Callers must
 * supply a trusted organizationId resolved from the authenticated session —
 * never from client-supplied request body fields.
 *
 * Responsibilities:
 *  - Authorization: ownership check before every mutation
 *  - Tenant isolation: every query is scoped to organization_id
 *  - State-machine enforcement: status transitions validated against FSM
 *  - Audit trail: immutable audit event emitted for every CUD operation
 */

import { createLogger } from '@shared/lib/logger';

import { supabase } from '../../lib/supabase.js';
import { auditLogService } from '../security/AuditLogService.js';
import { NotFoundError, ServiceError, ErrorCode } from '../errors.js';
import {
  ALLOWED_TRANSITIONS,
  type AddNoteInput,
  type CommitmentStatus,
  type CreateCommitmentInput,
  type StatusTransitionInput,
  type UpdateCommitmentInput,
} from '../../api/valueCommitments/schemas.js';

const logger = createLogger({ component: 'ValueCommitmentBackendService' });

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Resolve a commitment row, enforcing tenant ownership. Throws 404 on miss. */
async function fetchOwned(
  commitmentId: string,
  organizationId: string,
): Promise<Record<string, unknown>> {
  const { data, error } = await supabase
    .from('value_commitments')
    .select('*')
    .eq('id', commitmentId)
    .eq('organization_id', organizationId)
    .single();

  if (error || !data) {
    // Return 404 regardless of whether the row exists in another tenant —
    // existence must not be leaked across tenant boundaries.
    throw new NotFoundError('Commitment');
  }
  return data as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class ValueCommitmentBackendService {
  // -------------------------------------------------------------------------
  // Create
  // -------------------------------------------------------------------------

  async createCommitment(
    organizationId: string,
    actorUserId: string,
    input: CreateCommitmentInput,
  ): Promise<Record<string, unknown>> {
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('value_commitments')
      .insert({
        organization_id:        organizationId,
        // tenant_id mirrors organization_id for tables that carry both columns
        tenant_id:              organizationId,
        created_by:             actorUserId,
        owner_user_id:          input.owner_user_id,
        title:                  input.title,
        description:            input.description ?? null,
        commitment_type:        input.commitment_type,
        priority:               input.priority,
        target_completion_date: input.target_completion_date,
        timeframe_months:       input.timeframe_months,
        financial_impact:       input.financial_impact ?? {},
        currency:               input.currency,
        tags:                   input.tags ?? [],
        status:                 'draft' as CommitmentStatus,
        progress_percentage:    0,
        committed_at:           now,
      })
      .select()
      .single();

    if (error) {
      logger.error('createCommitment failed', { error: error.message, organizationId });
      throw new ServiceError(`createCommitment: ${error.message}`, ErrorCode.SERVER_ERROR);
    }

    const row = data as Record<string, unknown>;

    // Seed initial metrics if provided.
    // Failure is compensated by deleting the commitment row so the caller never
    // receives a 201 for a commitment that is missing its requested metrics.
    if (input.metrics?.length) {
      const metricRows = input.metrics.map((m) => ({
        commitment_id:   row['id'],
        organization_id: organizationId,
        tenant_id:       organizationId,
        metric_name:     m.metric_name,
        baseline_value:  m.baseline_value,
        target_value:    m.target_value,
        current_value:   m.baseline_value,
        unit:            m.unit,
        is_active:       true,
      }));

      const { error: metricError } = await supabase
        .from('commitment_metrics')
        .insert(metricRows);

      if (metricError) {
        logger.error('createCommitment: metric seed failed, compensating', {
          error:        metricError.message,
          commitmentId: row['id'],
          organizationId,
        });

        // Compensation: remove the orphaned commitment row.
        // Wrapped in its own try/catch so a compensation failure does not mask
        // the original error — the ServiceError below always propagates.
        try {
          await supabase
            .from('value_commitments')
            .delete()
            .eq('id', row['id'] as string)
            .eq('organization_id', organizationId);
        } catch (compensationError) {
          logger.error('createCommitment: compensation delete failed — zombie row may exist', {
            error:        compensationError instanceof Error ? compensationError.message : String(compensationError),
            commitmentId: row['id'],
            organizationId,
          });
        }

        throw new ServiceError(
          `createCommitment: metric seed failed — ${metricError.message}`,
          ErrorCode.SERVER_ERROR,
        );
      }
    }

    await this.emitAudit({
      actorUserId,
      organizationId,
      action:       'commitment.created',
      resourceId:   row['id'] as string,
      afterState:   row,
    });

    logger.info('commitment created', {
      commitmentId: row['id'],
      organizationId,
      actorUserId,
    });

    return row;
  }

  // -------------------------------------------------------------------------
  // Update
  // -------------------------------------------------------------------------

  async updateCommitment(
    commitmentId: string,
    organizationId: string,
    actorUserId: string,
    input: UpdateCommitmentInput,
  ): Promise<Record<string, unknown>> {
    const existing = await fetchOwned(commitmentId, organizationId);

    const patch: Record<string, unknown> = {
      ...input,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('value_commitments')
      .update(patch)
      .eq('id', commitmentId)
      .eq('organization_id', organizationId)
      .select()
      .single();

    if (error) {
      logger.error('updateCommitment failed', { error: error.message, commitmentId, organizationId });
      throw new ServiceError(`updateCommitment: ${error.message}`, ErrorCode.SERVER_ERROR);
    }

    const row = data as Record<string, unknown>;

    await this.emitAudit({
      actorUserId,
      organizationId,
      action:       'commitment.updated',
      resourceId:   commitmentId,
      beforeState:  existing,
      afterState:   row,
    });

    return row;
  }

  // -------------------------------------------------------------------------
  // Status transition
  // -------------------------------------------------------------------------

  async transitionStatus(
    commitmentId: string,
    organizationId: string,
    actorUserId: string,
    input: StatusTransitionInput,
  ): Promise<Record<string, unknown>> {
    const existing = await fetchOwned(commitmentId, organizationId);
    const currentStatus = existing['status'] as CommitmentStatus;
    const targetStatus  = input.status;

    const allowed = ALLOWED_TRANSITIONS[currentStatus] ?? [];
    if (!allowed.includes(targetStatus)) {
      throw new ServiceError(
        `Transition from '${currentStatus}' to '${targetStatus}' is not permitted`,
        ErrorCode.CONFLICT,
        409,
      );
    }

    const patch: Record<string, unknown> = {
      status:     targetStatus,
      updated_at: new Date().toISOString(),
    };
    if (input.progress_percentage !== undefined) {
      patch['progress_percentage'] = input.progress_percentage;
    }
    if (targetStatus === 'fulfilled') {
      patch['actual_completion_date'] = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('value_commitments')
      .update(patch)
      .eq('id', commitmentId)
      .eq('organization_id', organizationId)
      .select()
      .single();

    if (error) {
      logger.error('transitionStatus failed', { error: error.message, commitmentId, organizationId });
      throw new ServiceError(`transitionStatus: ${error.message}`, ErrorCode.SERVER_ERROR);
    }

    const row = data as Record<string, unknown>;

    await this.emitAudit({
      actorUserId,
      organizationId,
      action:      'commitment.status_changed',
      resourceId:  commitmentId,
      beforeState: { status: currentStatus },
      afterState:  { status: targetStatus, reason: input.reason },
    });

    logger.info('commitment status transitioned', {
      commitmentId,
      organizationId,
      from: currentStatus,
      to:   targetStatus,
      actorUserId,
    });

    return row;
  }

  // -------------------------------------------------------------------------
  // Notes
  // -------------------------------------------------------------------------

  async addNote(
    commitmentId: string,
    organizationId: string,
    actorUserId: string,
    input: AddNoteInput,
  ): Promise<Record<string, unknown>> {
    // Ownership check — ensures the commitment belongs to this tenant
    await fetchOwned(commitmentId, organizationId);

    const { data, error } = await supabase
      .from('commitment_notes')
      .insert({
        commitment_id:   commitmentId,
        organization_id: organizationId,
        tenant_id:       organizationId,
        created_by:      actorUserId,
        body:            input.body,
        visibility:      input.visibility,
      })
      .select()
      .single();

    if (error) {
      logger.error('addNote failed', { error: error.message, commitmentId, organizationId });
      throw new ServiceError(`addNote: ${error.message}`, ErrorCode.SERVER_ERROR);
    }

    const row = data as Record<string, unknown>;

    await this.emitAudit({
      actorUserId,
      organizationId,
      action:     'commitment.note_added',
      resourceId: commitmentId,
      afterState: { note_id: row['id'], visibility: input.visibility },
    });

    return row;
  }

  // -------------------------------------------------------------------------
  // Delete
  // -------------------------------------------------------------------------

  async deleteCommitment(
    commitmentId: string,
    organizationId: string,
    actorUserId: string,
  ): Promise<void> {
    const existing = await fetchOwned(commitmentId, organizationId);

    // Only draft commitments may be deleted; active/fulfilled require cancellation
    if (existing['status'] !== 'draft') {
      throw new ServiceError(
        'Only draft commitments can be deleted. Use status-transitions to cancel.',
        ErrorCode.CONFLICT,
        409,
      );
    }

    const { error } = await supabase
      .from('value_commitments')
      .delete()
      .eq('id', commitmentId)
      .eq('organization_id', organizationId);

    if (error) {
      logger.error('deleteCommitment failed', { error: error.message, commitmentId, organizationId });
      throw new ServiceError(`deleteCommitment: ${error.message}`, ErrorCode.SERVER_ERROR);
    }

    await this.emitAudit({
      actorUserId,
      organizationId,
      action:      'commitment.deleted',
      resourceId:  commitmentId,
      beforeState: existing,
    });

    logger.warn('commitment deleted', { commitmentId, organizationId, actorUserId });
  }

  // -------------------------------------------------------------------------
  // Read (used by controller for GET responses)
  // -------------------------------------------------------------------------

  async getCommitment(
    commitmentId: string,
    organizationId: string,
  ): Promise<Record<string, unknown>> {
    return fetchOwned(commitmentId, organizationId);
  }

  // -------------------------------------------------------------------------
  // Private: audit emission
  // -------------------------------------------------------------------------

  private async emitAudit(params: {
    actorUserId:    string;
    organizationId: string;
    action:         string;
    resourceId:     string;
    beforeState?:   Record<string, unknown>;
    afterState?:    Record<string, unknown>;
  }): Promise<void> {
    try {
      await auditLogService.logAudit({
        userId:       params.actorUserId,
        userName:     params.actorUserId, // resolved async inside AuditLogService
        userEmail:    '',
        action:       params.action,
        resourceType: 'value_commitment',
        resourceId:   params.resourceId,
        beforeState:  params.beforeState,
        afterState:   params.afterState,
        details: {
          organization_id: params.organizationId,
        },
        status: 'success',
      });
    } catch (auditError) {
      // Audit failures must not break the primary operation
      logger.error('audit emission failed', {
        error: auditError instanceof Error ? auditError.message : String(auditError),
        action: params.action,
        resourceId: params.resourceId,
      });
    }
  }
}

export const valueCommitmentBackendService = new ValueCommitmentBackendService();
