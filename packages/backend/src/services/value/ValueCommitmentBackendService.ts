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
  type AddMilestoneInput,
  type UpdateMilestoneInput,
  type AddMetricInput,
  type UpdateMetricActualInput,
  type AddRiskInput,
  type UpdateRiskInput,
  type AddStakeholderInput,
  type UpdateStakeholderInput,
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
  // Milestones
  // -------------------------------------------------------------------------

  async addMilestone(
    commitmentId: string,
    organizationId: string,
    actorUserId: string,
    input: AddMilestoneInput,
  ): Promise<Record<string, unknown>> {
    await fetchOwned(commitmentId, organizationId);

    const { data, error } = await supabase
      .from('commitment_milestones')
      .insert({
        commitment_id:      commitmentId,
        organization_id:    organizationId,
        tenant_id:          organizationId,
        title:              input.title,
        description:        input.description ?? null,
        milestone_type:     input.milestone_type,
        sequence_order:     input.sequence_order,
        target_date:        input.target_date,
        deliverables:       input.deliverables ?? [],
        success_criteria:   input.success_criteria ?? [],
        status:             'pending',
        progress_percentage: 0,
      })
      .select()
      .single();

    if (error) {
      logger.error('addMilestone failed', { error: error.message, commitmentId, organizationId });
      throw new ServiceError(`addMilestone: ${error.message}`, ErrorCode.SERVER_ERROR);
    }

    const row = data as Record<string, unknown>;

    await this.emitAudit({
      actorUserId,
      organizationId,
      action:     'commitment.milestone_added',
      resourceId: commitmentId,
      afterState: { milestone_id: row['id'], title: input.title },
    });

    return row;
  }

  async updateMilestone(
    commitmentId: string,
    milestoneId: string,
    organizationId: string,
    actorUserId: string,
    input: UpdateMilestoneInput,
  ): Promise<Record<string, unknown>> {
    await fetchOwned(commitmentId, organizationId);

    const patch: Record<string, unknown> = {
      ...input,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('commitment_milestones')
      .update(patch)
      .eq('id', milestoneId)
      .eq('commitment_id', commitmentId)
      .eq('organization_id', organizationId)
      .select()
      .single();

    if (error) {
      logger.error('updateMilestone failed', { error: error.message, milestoneId, commitmentId });
      throw new ServiceError(`updateMilestone: ${error.message}`, ErrorCode.SERVER_ERROR);
    }
    if (!data) throw new NotFoundError('Milestone');

    const row = data as Record<string, unknown>;

    // Recompute commitment-level progress from milestone averages
    await this.recomputeProgress(commitmentId, organizationId);

    await this.emitAudit({
      actorUserId,
      organizationId,
      action:     'commitment.milestone_updated',
      resourceId: commitmentId,
      afterState: { milestone_id: milestoneId, ...input },
    });

    return row;
  }

  // -------------------------------------------------------------------------
  // Metrics
  // -------------------------------------------------------------------------

  async addMetric(
    commitmentId: string,
    organizationId: string,
    actorUserId: string,
    input: AddMetricInput,
  ): Promise<Record<string, unknown>> {
    await fetchOwned(commitmentId, organizationId);

    const { data, error } = await supabase
      .from('commitment_metrics')
      .insert({
        commitment_id:   commitmentId,
        organization_id: organizationId,
        tenant_id:       organizationId,
        metric_name:     input.metric_name,
        baseline_value:  input.baseline_value,
        target_value:    input.target_value,
        current_value:   input.baseline_value,
        unit:            input.unit,
        is_active:       true,
      })
      .select()
      .single();

    if (error) {
      logger.error('addMetric failed', { error: error.message, commitmentId, organizationId });
      throw new ServiceError(`addMetric: ${error.message}`, ErrorCode.SERVER_ERROR);
    }

    const row = data as Record<string, unknown>;

    await this.emitAudit({
      actorUserId,
      organizationId,
      action:     'commitment.metric_added',
      resourceId: commitmentId,
      afterState: { metric_id: row['id'], metric_name: input.metric_name },
    });

    return row;
  }

  async updateMetricActual(
    commitmentId: string,
    metricId: string,
    organizationId: string,
    actorUserId: string,
    input: UpdateMetricActualInput,
  ): Promise<Record<string, unknown>> {
    await fetchOwned(commitmentId, organizationId);

    const { data, error } = await supabase
      .from('commitment_metrics')
      .update({
        current_value:    input.current_value,
        last_measured_at: new Date().toISOString(),
        updated_at:       new Date().toISOString(),
      })
      .eq('id', metricId)
      .eq('commitment_id', commitmentId)
      .eq('organization_id', organizationId)
      .select()
      .single();

    if (error) {
      logger.error('updateMetricActual failed', { error: error.message, metricId, commitmentId });
      throw new ServiceError(`updateMetricActual: ${error.message}`, ErrorCode.SERVER_ERROR);
    }
    if (!data) throw new NotFoundError('Metric');

    const row = data as Record<string, unknown>;

    await this.recomputeProgress(commitmentId, organizationId);

    await this.emitAudit({
      actorUserId,
      organizationId,
      action:     'commitment.metric_updated',
      resourceId: commitmentId,
      afterState: { metric_id: metricId, current_value: input.current_value },
    });

    return row;
  }

  // -------------------------------------------------------------------------
  // Risks
  // -------------------------------------------------------------------------

  async addRisk(
    commitmentId: string,
    organizationId: string,
    actorUserId: string,
    input: AddRiskInput,
  ): Promise<Record<string, unknown>> {
    await fetchOwned(commitmentId, organizationId);

    const { data, error } = await supabase
      .from('commitment_risks')
      .insert({
        commitment_id:    commitmentId,
        organization_id:  organizationId,
        tenant_id:        organizationId,
        risk_title:       input.risk_title,
        risk_description: input.risk_description,
        risk_category:    input.risk_category,
        probability:      input.probability,
        impact:           input.impact,
        mitigation_plan:  input.mitigation_plan,
        contingency_plan: input.contingency_plan,
        owner_id:         input.owner_id,
        review_date:      input.review_date,
        status:           'identified',
      })
      .select()
      .single();

    if (error) {
      logger.error('addRisk failed', { error: error.message, commitmentId, organizationId });
      throw new ServiceError(`addRisk: ${error.message}`, ErrorCode.SERVER_ERROR);
    }

    const row = data as Record<string, unknown>;

    await this.emitAudit({
      actorUserId,
      organizationId,
      action:     'commitment.risk_added',
      resourceId: commitmentId,
      afterState: { risk_id: row['id'], risk_title: input.risk_title },
    });

    return row;
  }

  async updateRisk(
    commitmentId: string,
    riskId: string,
    organizationId: string,
    actorUserId: string,
    input: UpdateRiskInput,
  ): Promise<Record<string, unknown>> {
    await fetchOwned(commitmentId, organizationId);

    const patch: Record<string, unknown> = {
      ...input,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('commitment_risks')
      .update(patch)
      .eq('id', riskId)
      .eq('commitment_id', commitmentId)
      .eq('organization_id', organizationId)
      .select()
      .single();

    if (error) {
      logger.error('updateRisk failed', { error: error.message, riskId, commitmentId });
      throw new ServiceError(`updateRisk: ${error.message}`, ErrorCode.SERVER_ERROR);
    }
    if (!data) throw new NotFoundError('Risk');

    const row = data as Record<string, unknown>;

    await this.emitAudit({
      actorUserId,
      organizationId,
      action:     'commitment.risk_updated',
      resourceId: commitmentId,
      afterState: { risk_id: riskId, ...input },
    });

    return row;
  }

  // -------------------------------------------------------------------------
  // Stakeholders
  // -------------------------------------------------------------------------

  async addStakeholder(
    commitmentId: string,
    organizationId: string,
    actorUserId: string,
    input: AddStakeholderInput,
  ): Promise<Record<string, unknown>> {
    await fetchOwned(commitmentId, organizationId);

    const { data, error } = await supabase
      .from('commitment_stakeholders')
      .insert({
        commitment_id:             commitmentId,
        organization_id:           organizationId,
        tenant_id:                 organizationId,
        user_id:                   input.user_id,
        role:                      input.role,
        responsibility:            input.responsibility,
        accountability_percentage: input.accountability_percentage ?? 50,
        is_active:                 true,
      })
      .select()
      .single();

    if (error) {
      logger.error('addStakeholder failed', { error: error.message, commitmentId, organizationId });
      throw new ServiceError(`addStakeholder: ${error.message}`, ErrorCode.SERVER_ERROR);
    }

    const row = data as Record<string, unknown>;

    await this.emitAudit({
      actorUserId,
      organizationId,
      action:     'commitment.stakeholder_added',
      resourceId: commitmentId,
      afterState: { stakeholder_id: row['id'], user_id: input.user_id, role: input.role },
    });

    return row;
  }

  async updateStakeholder(
    commitmentId: string,
    stakeholderId: string,
    organizationId: string,
    actorUserId: string,
    input: UpdateStakeholderInput,
  ): Promise<Record<string, unknown>> {
    await fetchOwned(commitmentId, organizationId);

    const patch: Record<string, unknown> = {
      ...input,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('commitment_stakeholders')
      .update(patch)
      .eq('id', stakeholderId)
      .eq('commitment_id', commitmentId)
      .eq('organization_id', organizationId)
      .select()
      .single();

    if (error) {
      logger.error('updateStakeholder failed', { error: error.message, stakeholderId, commitmentId });
      throw new ServiceError(`updateStakeholder: ${error.message}`, ErrorCode.SERVER_ERROR);
    }
    if (!data) throw new NotFoundError('Stakeholder');

    const row = data as Record<string, unknown>;

    await this.emitAudit({
      actorUserId,
      organizationId,
      action:     'commitment.stakeholder_updated',
      resourceId: commitmentId,
      afterState: { stakeholder_id: stakeholderId, ...input },
    });

    return row;
  }

  // -------------------------------------------------------------------------
  // Progress (computed from live DB rows)
  // -------------------------------------------------------------------------

  async getProgress(
    commitmentId: string,
    organizationId: string,
  ): Promise<{
    commitment_id: string;
    overall_progress: number;
    milestone_completion: number;
    metric_achievement: number;
    risk_level: string;
    days_remaining: number;
    is_on_track: boolean;
  }> {
    const commitment = await fetchOwned(commitmentId, organizationId);

    const [milestonesRes, metricsRes, risksRes] = await Promise.all([
      supabase
        .from('commitment_milestones')
        .select('progress_percentage, status')
        .eq('commitment_id', commitmentId)
        .eq('organization_id', organizationId)
        .neq('status', 'cancelled'),
      supabase
        .from('commitment_metrics')
        .select('current_value, target_value')
        .eq('commitment_id', commitmentId)
        .eq('organization_id', organizationId)
        .eq('is_active', true),
      supabase
        .from('commitment_risks')
        .select('probability')
        .eq('commitment_id', commitmentId)
        .eq('organization_id', organizationId)
        .neq('status', 'closed'),
    ]);

    const milestones = milestonesRes.data ?? [];
    const metrics    = metricsRes.data ?? [];
    const risks      = risksRes.data ?? [];

    const milestoneCompletion = milestones.length > 0
      ? Math.round(milestones.reduce((s, m) => s + (m.progress_percentage ?? 0), 0) / milestones.length)
      : 0;

    const metricAchievement = metrics.length > 0
      ? Math.round(
          metrics.reduce((s, m) => {
            const pct = (m.target_value ?? 0) > 0
              ? Math.min(100, ((m.current_value ?? 0) / m.target_value) * 100)
              : 0;
            return s + pct;
          }, 0) / metrics.length,
        )
      : 0;

    const highRisks = risks.filter((r) => r.probability === 'high' || r.probability === 'critical').length;
    const riskLevel = highRisks > 2 ? 'critical' : highRisks > 0 ? 'high' : 'low';

    const targetDate = commitment['target_completion_date']
      ? new Date(commitment['target_completion_date'] as string)
      : null;
    const daysRemaining = targetDate
      ? Math.ceil((targetDate.getTime() - Date.now()) / 86_400_000)
      : 0;

    const overallProgress = Math.round(milestoneCompletion * 0.6 + metricAchievement * 0.4);

    return {
      commitment_id:        commitmentId,
      overall_progress:     overallProgress,
      milestone_completion: milestoneCompletion,
      metric_achievement:   metricAchievement,
      risk_level:           riskLevel,
      days_remaining:       daysRemaining,
      is_on_track:          overallProgress >= 50 && riskLevel !== 'critical',
    };
  }

  // -------------------------------------------------------------------------
  // Commitment list
  // -------------------------------------------------------------------------

  async listCommitments(organizationId: string): Promise<Record<string, unknown>[]> {
    const { data, error } = await supabase
      .from('value_commitments')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('listCommitments failed', { error: error.message, organizationId });
      throw new ServiceError(`listCommitments: ${error.message}`, ErrorCode.SERVER_ERROR);
    }

    return (data ?? []) as Record<string, unknown>[];
  }

  // -------------------------------------------------------------------------
  // At-risk commitments list
  // -------------------------------------------------------------------------

  async getAtRiskCommitments(
    organizationId: string,
    threshold = 80,
  ): Promise<Record<string, unknown>[]> {
    const { data, error } = await supabase
      .from('value_commitments')
      .select('*')
      .eq('organization_id', organizationId)
      .lt('progress_percentage', threshold)
      .in('status', ['active', 'at_risk']);

    if (error) {
      logger.error('getAtRiskCommitments failed', { error: error.message, organizationId });
      throw new ServiceError(`getAtRiskCommitments: ${error.message}`, ErrorCode.SERVER_ERROR);
    }

    return (data ?? []) as Record<string, unknown>[];
  }

  // -------------------------------------------------------------------------
  // Private: recompute commitment progress_percentage from milestones + metrics
  // -------------------------------------------------------------------------

  private async recomputeProgress(commitmentId: string, organizationId: string): Promise<void> {
    const [milestonesRes, metricsRes] = await Promise.all([
      supabase
        .from('commitment_milestones')
        .select('progress_percentage')
        .eq('commitment_id', commitmentId)
        .eq('organization_id', organizationId)
        .neq('status', 'cancelled'),
      supabase
        .from('commitment_metrics')
        .select('current_value, target_value')
        .eq('commitment_id', commitmentId)
        .eq('organization_id', organizationId)
        .eq('is_active', true),
    ]);

    const milestones = milestonesRes.data ?? [];
    const metrics    = metricsRes.data ?? [];

    const milestoneAvg = milestones.length > 0
      ? milestones.reduce((s, m) => s + (m.progress_percentage ?? 0), 0) / milestones.length
      : 0;

    const metricAvg = metrics.length > 0
      ? metrics.reduce((s, m) => {
          const pct = (m.target_value ?? 0) > 0
            ? Math.min(100, ((m.current_value ?? 0) / m.target_value) * 100)
            : 0;
          return s + pct;
        }, 0) / metrics.length
      : 0;

    const overall = Math.round(milestoneAvg * 0.6 + metricAvg * 0.4);

    await supabase
      .from('value_commitments')
      .update({ progress_percentage: overall, updated_at: new Date().toISOString() })
      .eq('id', commitmentId)
      .eq('organization_id', organizationId);
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
