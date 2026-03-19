/**
 * RealizationAgent
 *
 * Sits in the REALIZATION phase of the value lifecycle. Compares committed
 * value (KPI targets from TargetAgent, validated by IntegrityAgent) against
 * actual telemetry data to produce proof points and variance reports.
 *
 * When realized value falls below the committed threshold, the agent
 * recommends interventions. When realized value exceeds commitments,
 * it flags expansion signals for the downstream ExpansionAgent.
 *
 * Output includes proof points, variance analysis, intervention
 * recommendations, and SDUI sections (AgentResponseCard + InteractiveChart
 * + KPIForm + NarrativeBlock).
 */

import { z } from 'zod';

import { buildEventEnvelope, getDomainEventBus } from '../../../events/DomainEventBus.js';
import { RealizationReportRepository } from '../../../repositories/RealizationReportRepository.js';
import type {
  AgentOutput,
  LifecycleContext,
} from '../../../types/agent.js';
import { logger } from '../../logger.js';
import { resolvePromptTemplate } from '../promptRegistry.js';
import { renderTemplate } from '../promptUtils.js';

import { BaseAgent } from './BaseAgent.js';

// ---------------------------------------------------------------------------
// Zod schemas for LLM output validation
// ---------------------------------------------------------------------------

const ProofPointSchema = z.object({
  kpi_id: z.string(),
  kpi_name: z.string(),
  committed_value: z.number(),
  realized_value: z.number(),
  unit: z.string(),
  measurement_date: z.string(),
  variance_absolute: z.number(),
  variance_percentage: z.number(),
  direction: z.enum(['over', 'under', 'on_target']),
  evidence: z.array(z.string()).min(1),
  confidence: z.number().min(0).max(1),
  data_source: z.string(),
});

const InterventionSchema = z.object({
  kpi_id: z.string(),
  type: z.enum([
    'review_assumptions',
    'adjust_targets',
    'validate_data',
    'check_methodology',
    'escalate_to_stakeholder',
    'reallocate_resources',
  ]),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  description: z.string(),
  expected_impact: z.string(),
  owner_role: z.string(),
});

const RealizationAnalysisSchema = z.object({
  proof_points: z.array(ProofPointSchema).min(1),
  overall_realization_rate: z.number().min(0).max(2),
  variance_summary: z.string(),
  interventions: z.array(InterventionSchema),
  expansion_signals: z.array(z.object({
    kpi_id: z.string(),
    signal_type: z.enum(['exceeded_target', 'accelerated_timeline', 'new_opportunity']),
    description: z.string(),
    estimated_additional_value: z.number().optional(),
  })),
  data_quality_assessment: z.string(),
  recommended_next_steps: z.array(z.string()),
});

type RealizationAnalysis = z.infer<typeof RealizationAnalysisSchema>;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Below this realization rate, interventions are triggered */
const INTERVENTION_THRESHOLD = 0.8;

/** Above this realization rate, expansion signals are flagged */
const EXPANSION_THRESHOLD = 1.1;

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

export class RealizationAgent extends BaseAgent {
  public override readonly version = "1.0.0";

  private readonly realizationRepo = new RealizationReportRepository();
  async execute(context: LifecycleContext): Promise<AgentOutput> {
    const startTime = Date.now();
    const isValid = await this.validateInput(context);
    if (!isValid) {
      throw new Error('Invalid input context');
    }

    // Step 1: Retrieve committed KPI targets from memory (written by TargetAgent)
    const committedKPIs = await this.retrieveCommittedKPIs(context);

    // Step 2: Retrieve integrity validation results
    const integrityResults = await this.retrieveIntegrityResults(context);

    if (committedKPIs.length === 0) {
      return this.buildOutput(
        { error: 'No committed KPI targets found in memory. Run TargetAgent first.' },
        'failure', 'low', startTime,
      );
    }

    // Step 3: Retrieve telemetry / actual values from context
    const telemetryData = this.extractTelemetryData(context);

    // Step 4: Generate realization analysis via LLM
    const analysis = await this.analyzeRealization(
      context, committedKPIs, integrityResults, telemetryData,
    );
    if (!analysis) {
      return this.buildOutput(
        { error: 'Realization analysis failed. Retry or provide telemetry data.' },
        'failure', 'low', startTime,
      );
    }

    // Step 5: Store proof points and variance in memory for ExpansionAgent
    await this.storeRealizationInMemory(context, analysis);

    // Step 6: Build SDUI sections
    const sduiSections = this.buildSDUISections(analysis);

    // Step 7: Determine status based on realization rate
    const rate = analysis.overall_realization_rate;
    const hasInterventions = analysis.interventions.some(
      i => i.priority === 'critical' || i.priority === 'high',
    );
    const status: AgentOutput['status'] = rate < INTERVENTION_THRESHOLD && hasInterventions
      ? 'partial_success'
      : 'success';

    const confidenceLevel = this.toConfidenceLevel(
      analysis.proof_points.reduce((sum, p) => sum + p.confidence, 0) / analysis.proof_points.length,
    );

    const overCount = analysis.proof_points.filter(p => p.direction === 'over').length;
    const underCount = analysis.proof_points.filter(p => p.direction === 'under').length;
    const onTargetCount = analysis.proof_points.filter(p => p.direction === 'on_target').length;

    const result = {
      proof_points: analysis.proof_points,
      overall_realization_rate: analysis.overall_realization_rate,
      variance_summary: analysis.variance_summary,
      interventions: analysis.interventions,
      expansion_signals: analysis.expansion_signals,
      data_quality_assessment: analysis.data_quality_assessment,
      kpis_tracked: analysis.proof_points.length,
      kpis_on_target: onTargetCount + overCount,
      kpis_under_target: underCount,
      intervention_threshold: INTERVENTION_THRESHOLD,
      expansion_threshold: EXPANSION_THRESHOLD,
      sdui_sections: sduiSections,
    };

    // Persist realization report to DB for frontend retrieval.
    const valueCaseId = context.user_inputs?.value_case_id as string | undefined;
    if (valueCaseId && context.organization_id) {
      try {
        await this.realizationRepo.createReport(valueCaseId, context.organization_id, {
          session_id: context.workspace_id,
          kpis: analysis.proof_points.map(p => ({
            kpi_id: p.kpi_id,
            kpi_name: p.kpi_name,
            committed_value: p.committed_value,
            realized_value: p.realized_value,
            unit: p.unit,
            variance_percentage: p.variance_percentage,
            direction: p.direction,
            confidence: p.confidence,
          })),
          milestones: [],
          risks: analysis.interventions.map((iv, i) => ({
            id: `risk-${i}`,
            description: iv.description,
            severity: iv.priority === 'critical' ? 'critical' : iv.priority === 'high' ? 'high' : iv.priority === 'medium' ? 'medium' : 'low',
            mitigation: iv.type,
          })),
          variance_analysis: {
            overall_rate: analysis.overall_realization_rate,
            summary: analysis.variance_summary,
            expansion_signals: analysis.expansion_signals,
          },
          hallucination_check: true,
        });
      } catch (err) {
        logger.error('RealizationAgent: failed to persist report', { error: (err as Error).message });
      }
    }

    // Record outcomes in the RealizationFeedbackLoop so variance is tracked
    // and agent retraining is triggered when prediction accuracy degrades.
    const valueCommitId = context.user_inputs?.value_commit_id as string | undefined;
    if (valueCommitId && context.organization_id && context.user_id) {
      try {
        const { RealizationFeedbackLoop } = await import(
          '../../../services/post-v1/RealizationFeedbackLoop.js'
        ) as { RealizationFeedbackLoop: typeof import('../../../services/post-v1/RealizationFeedbackLoop.js').RealizationFeedbackLoop };
        const { createServerSupabaseClient } = await import('../../../lib/supabase.js');

        const feedbackLoop = new RealizationFeedbackLoop(createServerSupabaseClient());

        // Record the overall realization rate as the actual outcome
        await feedbackLoop.recordActualOutcome(
          valueCommitId,
          {
            actual_value: analysis.overall_realization_rate * 100,
            notes: analysis.variance_summary,
            recorded_date: new Date(),
            evidence: analysis.proof_points.map((p) => p.kpi_name),
          },
          {
            userId: context.user_id,
            organizationId: context.organization_id,
            sessionId: context.workspace_id,
          },
        );

        logger.info('RealizationAgent: feedback loop outcome recorded', {
          valueCommitId,
          overall_realization_rate: analysis.overall_realization_rate,
        });
      } catch (feedbackErr) {
        // Feedback loop failure must not block the realization output
        logger.warn('RealizationAgent: feedback loop recording failed', {
          valueCommitId,
          error: (feedbackErr as Error).message,
        });
      }
    }

    // Publish a milestone event for each proof point so the RecommendationEngine
    // and other subscribers can react to individual KPI outcomes.
    const opportunityId = (context.user_inputs?.opportunity_id as string | undefined)
      ?? context.workspace_id;
    await this.publishMilestoneEvents(context, opportunityId, analysis);

    return this.buildOutput(result, status, confidenceLevel, startTime, {
      reasoning: `Tracked ${analysis.proof_points.length} KPIs: ${onTargetCount} on target, ${overCount} exceeded, ${underCount} under target. ` +
        `Overall realization rate: ${(rate * 100).toFixed(0)}%. ` +
        (analysis.interventions.length > 0 ? `${analysis.interventions.length} interventions recommended. ` : '') +
        (analysis.expansion_signals.length > 0 ? `${analysis.expansion_signals.length} expansion signals detected.` : ''),
      suggested_next_actions: analysis.recommended_next_steps,
    });
  }

  private async publishMilestoneEvents(
    context: LifecycleContext,
    opportunityId: string,
    analysis: RealizationAnalysis,
  ): Promise<void> {
    const traceId = (context.metadata?.trace_id as string | undefined) ?? context.workspace_id;
    const publishBatchSize = 5;

    for (let i = 0; i < analysis.proof_points.length; i += publishBatchSize) {
      const proofPointBatch = analysis.proof_points.slice(i, i + publishBatchSize);
      const publishResults = await Promise.allSettled(
        proofPointBatch.map(async (proofPoint) => {
          try {
            await getDomainEventBus().publish('realization.milestone_reached', {
              ...buildEventEnvelope({
                traceId,
                tenantId: context.organization_id,
                actorId: context.user_id,
              }),
              opportunityId,
              workspaceId: context.workspace_id,
              kpiId: proofPoint.kpi_id,
              kpiName: proofPoint.kpi_name,
              committedValue: proofPoint.committed_value,
              realizedValue: proofPoint.realized_value,
              unit: proofPoint.unit,
              variancePercentage: proofPoint.variance_percentage,
              direction: proofPoint.direction,
              overallRealizationRate: analysis.overall_realization_rate,
              expansionSignalCount: analysis.expansion_signals.length,
            });
          } catch (error) {
            throw {
              proofPoint,
              error,
            };
          }
        }),
      );

      publishResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          return;
        }

        const proofPoint =
          result.reason && typeof result.reason === 'object' && 'proofPoint' in result.reason
            ? result.reason.proofPoint as RealizationAnalysis['proof_points'][number]
            : undefined;
        const reason =
          result.reason && typeof result.reason === 'object' && 'error' in result.reason
            ? result.reason.error
            : result.reason;

        logger.warn('RealizationAgent: failed to publish realization.milestone_reached event', {
          kpi_id: proofPoint?.kpi_id,
          kpi_name: proofPoint?.kpi_name,
          error: reason instanceof Error ? reason.message : String(reason),
        });
      });
    }
  }

  // -------------------------------------------------------------------------
  // Baseline Creation (called when case transitions to FINALIZED)
  // -------------------------------------------------------------------------

  /**
   * Create a promise baseline from an approved scenario.
   * Called when a value case transitions to FINALIZED.
   */
  async createBaseline(
    caseId: string,
    scenarioId: string,
    scenarioType: 'conservative' | 'base' | 'upside',
    userId: string
  ): Promise<{ baselineId: string; success: boolean; error?: string }> {
    try {
      // Import services dynamically to avoid circular dependencies
      const { promiseBaselineService } = await import('../../../services/handoff/PromiseBaselineService.js');
      const { checkpointScheduler } = await import('../../../services/handoff/CheckpointScheduler.js');
      const { handoffNotesGenerator } = await import('../../../services/handoff/HandoffNotesGenerator.js');

      // Create baseline
      const baseline = await promiseBaselineService.createFromApprovedCase(this.organizationId, {
        case_id: caseId,
        scenario_id: scenarioId,
        scenario_type: scenarioType,
        user_id: userId,
      });

      // Generate checkpoints
      await checkpointScheduler.generateCheckpointsForBaseline(baseline.id, this.organizationId);

      // Generate handoff notes
      await handoffNotesGenerator.generateHandoffNotes(baseline.id, this.organizationId);

      logger.info('RealizationAgent: baseline created for finalized case', {
        caseId,
        baselineId: baseline.id,
        scenarioType,
      });

      // Emit domain event
      try {
        await getDomainEventBus().publish('narrative.drafted', {
          ...buildEventEnvelope({
            traceId: baseline.id,
            tenantId: this.organizationId,
            actorId: userId,
          }),
          valueCaseId: caseId,
          defenseReadinessScore: 0.9,
          format: 'promise_baseline',
        });
      } catch (eventErr) {
        logger.warn('RealizationAgent: failed to publish baseline created event', {
          baselineId: baseline.id,
          error: (eventErr as Error).message,
        });
      }

      return { baselineId: baseline.id, success: true };
    } catch (err) {
      const message = (err as Error).message;
      logger.error('RealizationAgent: baseline creation failed', {
        caseId,
        scenarioId,
        error: message,
      });
      return { baselineId: '', success: false, error: message };
    }
  }

  // -------------------------------------------------------------------------
  // Memory Retrieval
  // -------------------------------------------------------------------------

  private async retrieveCommittedKPIs(
    context: LifecycleContext,
  ): Promise<Array<{ id: string; content: string; metadata: Record<string, unknown> }>> {
    try {
      const memories = await this.memorySystem.retrieve({
        agent_id: 'target',
        memory_type: 'semantic',
        limit: 20,
        organization_id: context.organization_id,
        workspace_id: context.workspace_id,
      });
      return memories
        .filter(m => m.metadata?.kpi_id)
        .map(m => ({ id: m.id, content: m.content, metadata: m.metadata || {} }));
    } catch (err) {
      logger.warn('RealizationAgent: failed to retrieve committed KPIs', {
        error: (err as Error).message,
      });
      return [];
    }
  }

  private async retrieveIntegrityResults(
    context: LifecycleContext,
  ): Promise<Array<{ id: string; content: string; metadata: Record<string, unknown> }>> {
    try {
      const memories = await this.memorySystem.retrieve({
        agent_id: 'integrity',
        memory_type: 'semantic',
        limit: 5,
        organization_id: context.organization_id,
        workspace_id: context.workspace_id,
      });
      return memories
        .filter(m => m.metadata?.type === 'integrity_validation')
        .map(m => ({ id: m.id, content: m.content, metadata: m.metadata || {} }));
    } catch (err) {
      logger.warn('RealizationAgent: failed to retrieve integrity results', {
        error: (err as Error).message,
      });
      return [];
    }
  }

  // -------------------------------------------------------------------------
  // Telemetry Extraction
  // -------------------------------------------------------------------------

  /**
   * Extract actual telemetry data from the lifecycle context.
   * Telemetry can be provided via user_inputs.telemetry.
   */
  private extractTelemetryData(
    context: LifecycleContext,
  ): Array<{ kpi_id: string; actual_value: number; measurement_date: string; source: string }> {
    const telemetry = context.user_inputs?.telemetry as
      Array<{ kpi_id: string; actual_value: number; measurement_date?: string; source?: string }> | undefined;

    if (!telemetry || !Array.isArray(telemetry)) {
      return [];
    }

    return telemetry.map(t => ({
      kpi_id: t.kpi_id,
      actual_value: t.actual_value,
      measurement_date: t.measurement_date || new Date().toISOString(),
      source: t.source || 'user_provided',
    }));
  }

  // -------------------------------------------------------------------------
  // LLM Realization Analysis
  // -------------------------------------------------------------------------

  private async analyzeRealization(
    context: LifecycleContext,
    committedKPIs: Array<{ id: string; content: string; metadata: Record<string, unknown> }>,
    integrityResults: Array<{ id: string; content: string; metadata: Record<string, unknown> }>,
    telemetryData: Array<{ kpi_id: string; actual_value: number; measurement_date: string; source: string }>,
  ): Promise<RealizationAnalysis | null> {
    const kpiContext = committedKPIs.map((kpi, i) => {
      const m = kpi.metadata;
      const baseline = m.baseline as { value?: number; source?: string } | undefined;
      const target = m.target as { value?: number; timeframe_months?: number } | undefined;
      const telemetry = telemetryData.find(t => t.kpi_id === m.kpi_id);

      return `${i + 1}. KPI: ${kpi.content}
   ID: ${m.kpi_id}
   Category: ${m.category}
   Unit: ${m.unit}
   Baseline: ${baseline?.value ?? 'unknown'} (source: ${baseline?.source ?? 'unknown'})
   Committed Target: ${target?.value ?? 'unknown'} in ${target?.timeframe_months ?? '?'} months
   ${telemetry ? `Actual Value: ${telemetry.actual_value} (measured: ${telemetry.measurement_date}, source: ${telemetry.source})` : 'Actual Value: not yet measured'}`;
    }).join('\n\n');

    const integrityContext = integrityResults.length > 0
      ? `\n\nIntegrity validation context:\n${integrityResults.map(r => r.content).join('\n')}`
      : '';

    const systemPromptTemplate = resolvePromptTemplate('realization_system');
    const userPromptTemplate = resolvePromptTemplate('realization_user');
    this.setPromptVersionReferences(
      [
        { key: systemPromptTemplate.key, version: systemPromptTemplate.version },
        { key: userPromptTemplate.key, version: userPromptTemplate.version },
      ],
      [systemPromptTemplate.approval, userPromptTemplate.approval],
    );

    const systemPrompt = renderTemplate(systemPromptTemplate.template, {
      interventionThreshold: String(INTERVENTION_THRESHOLD),
      interventionThresholdPct: String(INTERVENTION_THRESHOLD * 100),
      expansionThreshold: String(EXPANSION_THRESHOLD),
      expansionThresholdPct: String(EXPANSION_THRESHOLD * 100),
    });
    const userPrompt = renderTemplate(userPromptTemplate.template, {
      kpiContext,
      integrityContext,
    });

    try {
      return await this.secureInvoke<RealizationAnalysis>(
        context.workspace_id,
        `${systemPrompt}\n\n${userPrompt}`,
        RealizationAnalysisSchema,

        {
          trackPrediction: true,
          confidenceThresholds: { low: 0.5, high: 0.8 },
          userId: context.user_id,
          context: {
            agent: 'realization',
            organization_id: context.organization_id,
            kpi_count: committedKPIs.length,
            telemetry_count: telemetryData.length,
          },
        },
      );
    } catch (err) {
      logger.error('RealizationAgent: analysis failed', {
        error: (err as Error).message,
        workspace_id: context.workspace_id,
      });
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // Memory Storage
  // -------------------------------------------------------------------------

  private async storeRealizationInMemory(
    context: LifecycleContext,
    analysis: RealizationAnalysis,
  ): Promise<void> {
    for (const proofPoint of analysis.proof_points) {
      try {
        await this.memorySystem.storeSemanticMemory(
          context.workspace_id,
          'realization',
          'semantic',
          `ProofPoint: ${proofPoint.kpi_name} — committed: ${proofPoint.committed_value}, realized: ${proofPoint.realized_value} ${proofPoint.unit}. Variance: ${proofPoint.variance_percentage.toFixed(1)}% (${proofPoint.direction}).`,
          {
            type: 'proof_point',
            kpi_id: proofPoint.kpi_id,
            kpi_name: proofPoint.kpi_name,
            committed_value: proofPoint.committed_value,
            realized_value: proofPoint.realized_value,
            unit: proofPoint.unit,
            variance_absolute: proofPoint.variance_absolute,
            variance_percentage: proofPoint.variance_percentage,
            direction: proofPoint.direction,
            confidence: proofPoint.confidence,
            data_source: proofPoint.data_source,
            measurement_date: proofPoint.measurement_date,
            organization_id: context.organization_id,
            importance: proofPoint.direction === 'under' ? 0.95 : 0.7,
          },
          context.organization_id,
        );
      } catch (err) {
        logger.warn('RealizationAgent: failed to store proof point', {
          kpi_id: proofPoint.kpi_id,
          error: (err as Error).message,
        });
      }
    }

    for (const signal of analysis.expansion_signals) {
      try {
        await this.memorySystem.storeSemanticMemory(
          context.workspace_id,
          'realization',
          'semantic',
          `ExpansionSignal: ${signal.description} (KPI: ${signal.kpi_id}, type: ${signal.signal_type})`,
          {
            type: 'expansion_signal',
            kpi_id: signal.kpi_id,
            signal_type: signal.signal_type,
            estimated_additional_value: signal.estimated_additional_value,
            organization_id: context.organization_id,
            importance: 0.85,
          },
          context.organization_id,
        );
      } catch (err) {
        logger.warn('RealizationAgent: failed to store expansion signal', {
          kpi_id: signal.kpi_id,
          error: (err as Error).message,
        });
      }
    }

    try {
      await this.memorySystem.storeSemanticMemory(
        context.workspace_id,
        'realization',
        'semantic',
        `VarianceReport: Overall realization rate ${(analysis.overall_realization_rate * 100).toFixed(0)}%. ` +
          `${analysis.proof_points.length} KPIs tracked. ${analysis.interventions.length} interventions. ` +
          `${analysis.expansion_signals.length} expansion signals.`,
        {
          type: 'variance_report',
          overall_realization_rate: analysis.overall_realization_rate,
          kpi_count: analysis.proof_points.length,
          intervention_count: analysis.interventions.length,
          expansion_signal_count: analysis.expansion_signals.length,
          organization_id: context.organization_id,
          importance: 0.9,
        },
        context.organization_id,
      );
    } catch (err) {
      logger.warn('RealizationAgent: failed to store variance report', {
        error: (err as Error).message,
      });
    }
  }

  // -------------------------------------------------------------------------
  // SDUI Output
  // -------------------------------------------------------------------------

  private buildSDUISections(analysis: RealizationAnalysis): Array<Record<string, unknown>> {
    const sections: Array<Record<string, unknown>> = [];

    const onTarget = analysis.proof_points.filter(p => p.direction === 'on_target').length;
    const over = analysis.proof_points.filter(p => p.direction === 'over').length;

    // Summary card
    sections.push({
      type: 'component',
      component: 'AgentResponseCard',
      version: 1,
      props: {
        response: {
          agentId: 'realization',
          agentName: 'Realization Agent',
          timestamp: new Date().toISOString(),
          content: `${analysis.variance_summary}\n\nOverall realization rate: ${(analysis.overall_realization_rate * 100).toFixed(0)}%. ` +
            `${onTarget + over}/${analysis.proof_points.length} KPIs on or above target.`,
          confidence: analysis.overall_realization_rate,
          status: analysis.overall_realization_rate >= INTERVENTION_THRESHOLD ? 'completed' : 'warning',
        },
        showReasoning: true,
        showActions: true,
        stage: 'realization',
      },
    });

    // Variance chart — committed vs realized per KPI
    sections.push({
      type: 'component',
      component: 'InteractiveChart',
      version: 1,
      props: {
        type: 'bar',
        data: analysis.proof_points.map(p => ({
          name: p.kpi_name,
          committed: p.committed_value,
          realized: p.realized_value,
        })),
        title: 'Committed vs Realized Value',
        xAxisLabel: 'KPI',
        yAxisLabel: 'Value',
        showLegend: true,
        showTooltip: true,
      },
    });

    // KPI actuals form (readonly)
    sections.push({
      type: 'component',
      component: 'KPIForm',
      version: 1,
      props: {
        kpis: analysis.proof_points.map(p => ({
          name: p.kpi_name,
          value: p.realized_value,
          unit: p.unit,
          source: p.data_source,
        })),
        title: 'Realized KPI Values',
        readonly: true,
      },
    });

    // Intervention narrative (if any)
    if (analysis.interventions.length > 0) {
      const interventionText = analysis.interventions
        .map(i => `**${i.priority.toUpperCase()}** [${i.kpi_id}]: ${i.description} — ${i.expected_impact} (Owner: ${i.owner_role})`)
        .join('\n\n');

      sections.push({
        type: 'component',
        component: 'NarrativeBlock',
        version: 1,
        props: {
          content: interventionText,
          type: 'recommendation',
          confidence: analysis.overall_realization_rate,
        },
      });
    }

    return sections;
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  // ...existing code...
}
