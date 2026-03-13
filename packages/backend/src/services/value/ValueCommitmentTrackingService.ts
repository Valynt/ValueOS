/**
 * ValueCommitmentTrackingService
 *
 * Supabase-backed persistence for value commitments, milestones, metrics,
 * risks, stakeholders, and audit trail. Every query is scoped to
 * (commitment_id, organization_id) to enforce tenant isolation.
 */

import { logger } from '../../lib/logger.js';
import { supabase } from '../../lib/supabase.js';

// ---------------------------------------------------------------------------
// Input types (minimal — callers supply what the DB needs)
// ---------------------------------------------------------------------------

export interface CreateCommitmentInput {
  tenant_id: string;
  organization_id: string;
  user_id: string;
  session_id: string;
  title: string;
  description: string;
  commitment_type: string;
  priority?: string;
  financial_impact?: Record<string, unknown>;
  currency?: string;
  timeframe_months: number;
  target_completion_date: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface UpdateCommitmentStatusInput {
  commitment_id: string;
  organization_id: string;
  status: string;
  progress_percentage?: number;
}

export interface AddMilestoneInput {
  commitment_id: string;
  tenant_id: string;
  organization_id: string;
  title: string;
  description: string;
  milestone_type: string;
  sequence_order: number;
  target_date: string;
  deliverables?: string[];
  success_criteria?: string[];
}

export interface UpdateMilestoneProgressInput {
  milestone_id: string;
  commitment_id: string;
  organization_id: string;
  progress_percentage: number;
  status?: string;
  actual_date?: string;
}

export interface RecordMetricActualInput {
  metric_id: string;
  commitment_id: string;
  organization_id: string;
  current_value: number;
}

export interface AddRiskInput {
  commitment_id: string;
  tenant_id: string;
  organization_id: string;
  risk_title: string;
  risk_description: string;
  risk_category: string;
  probability: string;
  impact: string;
  risk_score?: number;
  mitigation_plan: string;
  contingency_plan: string;
  owner_id: string;
  review_date: string;
}

export interface UpdateRiskStatusInput {
  risk_id: string;
  commitment_id: string;
  organization_id: string;
  status: string;
  mitigated_at?: string;
}

export interface AddStakeholderInput {
  commitment_id: string;
  tenant_id: string;
  organization_id: string;
  user_id: string;
  role: string;
  responsibility: string;
  accountability_percentage?: number;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class ValueCommitmentTrackingService {
  // -------------------------------------------------------------------------
  // Commitment CRUD
  // -------------------------------------------------------------------------

  async createCommitment(input: CreateCommitmentInput) {
    const { data, error } = await supabase
      .from('value_commitments')
      .insert({
        tenant_id: input.tenant_id,
        organization_id: input.organization_id,
        user_id: input.user_id,
        session_id: input.session_id,
        title: input.title,
        description: input.description,
        commitment_type: input.commitment_type,
        priority: input.priority ?? 'medium',
        financial_impact: input.financial_impact ?? {},
        currency: input.currency ?? 'USD',
        timeframe_months: input.timeframe_months,
        target_completion_date: input.target_completion_date,
        tags: input.tags ?? [],
        metadata: input.metadata ?? {},
        status: 'draft',
        progress_percentage: 0,
      })
      .select()
      .single();

    if (error) {
      logger.error('createCommitment failed', { error: error.message, organization_id: input.organization_id });
      throw new Error(`createCommitment: ${error.message}`);
    }
    return data;
  }

  async getCommitment(commitmentId: string, organizationId: string) {
    const { data, error } = await supabase
      .from('value_commitments')
      .select('*')
      .eq('id', commitmentId)
      .eq('organization_id', organizationId)
      .single();

    if (error) {
      logger.error('getCommitment failed', { error: error.message, commitmentId, organizationId });
      throw new Error(`getCommitment: ${error.message}`);
    }
    return data;
  }

  async updateCommitmentStatus(input: UpdateCommitmentStatusInput) {
    const patch: Record<string, unknown> = {
      status: input.status,
      updated_at: new Date().toISOString(),
    };
    if (input.progress_percentage !== undefined) {
      patch['progress_percentage'] = input.progress_percentage;
    }
    if (input.status === 'completed') {
      patch['actual_completion_date'] = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('value_commitments')
      .update(patch)
      .eq('id', input.commitment_id)
      .eq('organization_id', input.organization_id)
      .select()
      .single();

    if (error) {
      logger.error('updateCommitmentStatus failed', { error: error.message, ...input });
      throw new Error(`updateCommitmentStatus: ${error.message}`);
    }
    return data;
  }

  // -------------------------------------------------------------------------
  // Milestones
  // -------------------------------------------------------------------------

  async addMilestone(input: AddMilestoneInput) {
    const { data, error } = await supabase
      .from('commitment_milestones')
      .insert({
        commitment_id: input.commitment_id,
        tenant_id: input.tenant_id,
        title: input.title,
        description: input.description,
        milestone_type: input.milestone_type,
        sequence_order: input.sequence_order,
        target_date: input.target_date,
        deliverables: input.deliverables ?? [],
        success_criteria: input.success_criteria ?? [],
        status: 'pending',
        progress_percentage: 0,
      })
      .select()
      .single();

    if (error) {
      logger.error('addMilestone failed', { error: error.message, commitment_id: input.commitment_id });
      throw new Error(`addMilestone: ${error.message}`);
    }
    return data;
  }

  async updateMilestoneProgress(input: UpdateMilestoneProgressInput) {
    const patch: Record<string, unknown> = {
      progress_percentage: input.progress_percentage,
      updated_at: new Date().toISOString(),
    };
    if (input.status) patch['status'] = input.status;
    if (input.actual_date) patch['actual_date'] = input.actual_date;

    const { data, error } = await supabase
      .from('commitment_milestones')
      .update(patch)
      .eq('id', input.milestone_id)
      .eq('commitment_id', input.commitment_id)
      .select()
      .single();

    if (error) {
      logger.error('updateMilestoneProgress failed', { error: error.message, ...input });
      throw new Error(`updateMilestoneProgress: ${error.message}`);
    }

    // Recompute commitment-level progress from milestone averages
    await this.recomputeCommitmentProgress(input.commitment_id, input.organization_id);

    return data;
  }

  // -------------------------------------------------------------------------
  // Metrics
  // -------------------------------------------------------------------------

  async recordMetricActual(input: RecordMetricActualInput) {
    const { data, error } = await supabase
      .from('commitment_metrics')
      .update({
        current_value: input.current_value,
        last_measured_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.metric_id)
      .eq('commitment_id', input.commitment_id)
      .select()
      .single();

    if (error) {
      logger.error('recordMetricActual failed', { error: error.message, ...input });
      throw new Error(`recordMetricActual: ${error.message}`);
    }
    return data;
  }

  // -------------------------------------------------------------------------
  // Risks
  // -------------------------------------------------------------------------

  async addRisk(input: AddRiskInput) {
    const { data, error } = await supabase
      .from('commitment_risks')
      .insert({
        commitment_id: input.commitment_id,
        tenant_id: input.tenant_id,
        risk_title: input.risk_title,
        risk_description: input.risk_description,
        risk_category: input.risk_category,
        probability: input.probability,
        impact: input.impact,
        risk_score: input.risk_score ?? null,
        mitigation_plan: input.mitigation_plan,
        contingency_plan: input.contingency_plan,
        owner_id: input.owner_id,
        review_date: input.review_date,
        status: 'identified',
      })
      .select()
      .single();

    if (error) {
      logger.error('addRisk failed', { error: error.message, commitment_id: input.commitment_id });
      throw new Error(`addRisk: ${error.message}`);
    }
    return data;
  }

  async updateRiskStatus(input: UpdateRiskStatusInput) {
    const patch: Record<string, unknown> = {
      status: input.status,
      updated_at: new Date().toISOString(),
    };
    if (input.mitigated_at) patch['mitigated_at'] = input.mitigated_at;

    const { data, error } = await supabase
      .from('commitment_risks')
      .update(patch)
      .eq('id', input.risk_id)
      .eq('commitment_id', input.commitment_id)
      .select()
      .single();

    if (error) {
      logger.error('updateRiskStatus failed', { error: error.message, ...input });
      throw new Error(`updateRiskStatus: ${error.message}`);
    }
    return data;
  }

  // -------------------------------------------------------------------------
  // Stakeholders
  // -------------------------------------------------------------------------

  async addStakeholder(input: AddStakeholderInput) {
    const { data, error } = await supabase
      .from('commitment_stakeholders')
      .insert({
        commitment_id: input.commitment_id,
        tenant_id: input.tenant_id,
        user_id: input.user_id,
        role: input.role,
        responsibility: input.responsibility,
        accountability_percentage: input.accountability_percentage ?? 50,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      logger.error('addStakeholder failed', { error: error.message, commitment_id: input.commitment_id });
      throw new Error(`addStakeholder: ${error.message}`);
    }
    return data;
  }

  // -------------------------------------------------------------------------
  // Progress report
  // -------------------------------------------------------------------------

  async generateProgressReport(commitmentId: string, organizationId: string) {
    const [commitmentRes, milestonesRes, metricsRes, risksRes] = await Promise.all([
      supabase
        .from('value_commitments')
        .select('*')
        .eq('id', commitmentId)
        .eq('organization_id', organizationId)
        .single(),
      supabase
        .from('commitment_milestones')
        .select('*')
        .eq('commitment_id', commitmentId)
        .eq('organization_id', organizationId)
        .order('sequence_order'),
      supabase
        .from('commitment_metrics')
        .select('*')
        .eq('commitment_id', commitmentId)
        .eq('organization_id', organizationId)
        .eq('is_active', true),
      supabase
        .from('commitment_risks')
        .select('*')
        .eq('commitment_id', commitmentId)
        .eq('organization_id', organizationId)
        .neq('status', 'closed'),
    ]);

    if (commitmentRes.error) throw new Error(`generateProgressReport: ${commitmentRes.error.message}`);
    if (milestonesRes.error) throw new Error(`generateProgressReport milestones: ${milestonesRes.error.message}`);
    if (metricsRes.error) throw new Error(`generateProgressReport metrics: ${metricsRes.error.message}`);
    if (risksRes.error) throw new Error(`generateProgressReport risks: ${risksRes.error.message}`);

    const commitment = commitmentRes.data;
    const milestones = milestonesRes.data ?? [];
    const metrics = metricsRes.data ?? [];
    const risks = risksRes.data ?? [];

    const completedMilestones = milestones.filter((m) => m.status === 'completed').length;
    const milestoneCompletion = milestones.length > 0
      ? Math.round((completedMilestones / milestones.length) * 100)
      : 0;

    const metricAchievement = metrics.length > 0
      ? Math.round(
          metrics.reduce((sum, m) => {
            const pct = m.target_value > 0
              ? Math.min(100, ((m.current_value ?? 0) / m.target_value) * 100)
              : 0;
            return sum + pct;
          }, 0) / metrics.length,
        )
      : 0;

    const highRisks = risks.filter((r) => r.probability === 'high' || r.probability === 'critical').length;
    const riskLevel = highRisks > 2 ? 'critical' : highRisks > 0 ? 'high' : 'low';

    const targetDate = commitment.target_completion_date
      ? new Date(commitment.target_completion_date)
      : null;
    const daysRemaining = targetDate
      ? Math.ceil((targetDate.getTime() - Date.now()) / 86_400_000)
      : 0;

    const overallProgress = Math.round(
      (milestoneCompletion * 0.6 + metricAchievement * 0.4),
    );

    return {
      commitment,
      milestones,
      metrics,
      risks,
      summary: {
        overall_progress: overallProgress,
        milestone_completion: milestoneCompletion,
        metric_achievement: metricAchievement,
        risk_level: riskLevel,
        days_remaining: daysRemaining,
        // Threshold matches ValueCommitmentBackendService.getProgress (80%).
        is_on_track: overallProgress >= 80 && riskLevel !== 'critical',
      },
    };
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  private async recomputeCommitmentProgress(commitmentId: string, organizationId: string) {
    const { data: milestones, error } = await supabase
      .from('commitment_milestones')
      .select('progress_percentage')
      .eq('commitment_id', commitmentId);

    if (error || !milestones?.length) return;

    const avg = milestones.reduce((s, m) => s + (m.progress_percentage ?? 0), 0) / milestones.length;

    await supabase
      .from('value_commitments')
      .update({ progress_percentage: Math.round(avg), updated_at: new Date().toISOString() })
      .eq('id', commitmentId)
      .eq('organization_id', organizationId);
  }
}

export const valueCommitmentTrackingService = new ValueCommitmentTrackingService();
