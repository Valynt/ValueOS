/**
 * RealizationAgent
 *
 * Sits in the REALIZATION phase of the value lifecycle. Tracks actual
 * value delivery against KPI targets set by TargetAgent, measures
 * progress, identifies gaps, and generates realization dashboards.
 *
 * Retrieves KPI targets and financial model inputs from memory, uses
 * the LLM to assess realization status, and produces SDUI sections
 * for progress tracking.
 */

import { BaseAgent } from './BaseAgent.js';
import { z } from 'zod';
import { logger } from '../../logger.js';
import type {
  AgentOutput,
  AgentOutputMetadata,
  ConfidenceLevel,
  LifecycleContext,
} from '../../../types/agent.js';

// ---------------------------------------------------------------------------
// Zod schemas for LLM output validation
// ---------------------------------------------------------------------------

const KPIProgressSchema = z.object({
  kpi_id: z.string().min(1),
  kpi_name: z.string().min(1),
  baseline_value: z.number(),
  target_value: z.number(),
  current_value: z.number(),
  unit: z.string(),
  progress_percent: z.number().min(0).max(100),
  status: z.enum(['on_track', 'at_risk', 'behind', 'exceeded', 'not_started']),
  trend: z.enum(['improving', 'stable', 'declining']),
  notes: z.string(),
});

const ValueGapSchema = z.object({
  kpi_id: z.string(),
  gap_description: z.string(),
  root_cause: z.string(),
  recommended_action: z.string(),
  urgency: z.enum(['high', 'medium', 'low']),
  estimated_recovery_weeks: z.number().int().positive(),
});

const MilestoneSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  target_date: z.string(),
  status: z.enum(['completed', 'in_progress', 'upcoming', 'at_risk', 'missed']),
  linked_kpis: z.array(z.string()),
  notes: z.string().optional(),
});

const RealizationAnalysisSchema = z.object({
  executive_summary: z.string(),
  overall_realization_percent: z.number().min(0).max(100),
  kpi_progress: z.array(KPIProgressSchema).min(1),
  value_gaps: z.array(ValueGapSchema),
  milestones: z.array(MilestoneSchema),
  stakeholder_impact: z.array(z.object({
    role: z.string(),
    impact_summary: z.string(),
    sentiment: z.enum(['positive', 'neutral', 'negative']),
  })),
  recommended_actions: z.array(z.string()),
});

type RealizationAnalysis = z.infer<typeof RealizationAnalysisSchema>;

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

export class RealizationAgent extends BaseAgent {
  async execute(context: LifecycleContext): Promise<AgentOutput> {
    const startTime = Date.now();
    const isValid = await this.validateInput(context);
    if (!isValid) {
      throw new Error('Invalid input context');
    }

    // Step 1: Retrieve KPI targets from TargetAgent
    const kpiTargets = await this.retrieveKPITargets(context);

    // Step 2: Retrieve opportunity hypotheses for context
    const hypotheses = await this.retrieveHypotheses(context);

    // Step 3: Generate realization analysis via LLM
    const query = context.user_inputs?.query as string | undefined;
    const analysis = await this.generateRealizationAnalysis(
      context,
      kpiTargets,
      hypotheses,
      query,
    );

    if (!analysis) {
      return this.buildOutput(
        { error: 'Realization analysis generation failed. Retry or provide more context.' },
        'failure',
        'low',
        startTime,
      );
    }

    // Step 4: Store realization data in memory for downstream agents (ExpansionAgent)
    await this.storeRealizationInMemory(context, analysis);

    // Step 5: Build SDUI sections
    const sduiSections = this.buildSDUISections(analysis);

    // Step 6: Determine confidence based on data availability
    const dataRichness = (kpiTargets.length + hypotheses.length) / 10;
    const confidenceScore = Math.min(0.9, 0.4 + dataRichness * 0.3);
    const confidenceLevel = this.toConfidenceLevel(confidenceScore);

    const onTrackCount = analysis.kpi_progress.filter(k => k.status === 'on_track' || k.status === 'exceeded').length;
    const atRiskCount = analysis.kpi_progress.filter(k => k.status === 'at_risk' || k.status === 'behind').length;

    const result = {
      executive_summary: analysis.executive_summary,
      overall_realization_percent: analysis.overall_realization_percent,
      kpi_progress: analysis.kpi_progress,
      value_gaps: analysis.value_gaps,
      milestones: analysis.milestones,
      stakeholder_impact: analysis.stakeholder_impact,
      recommended_actions: analysis.recommended_actions,
      kpis_on_track: onTrackCount,
      kpis_at_risk: atRiskCount,
      kpis_total: analysis.kpi_progress.length,
      sdui_sections: sduiSections,
    };

    const warnings: string[] = [];
    if (atRiskCount > 0) {
      warnings.push(
        `${atRiskCount} of ${analysis.kpi_progress.length} KPIs are at risk or behind target.`,
      );
    }
    if (analysis.value_gaps.length > 0) {
      const highUrgency = analysis.value_gaps.filter(g => g.urgency === 'high').length;
      if (highUrgency > 0) {
        warnings.push(`${highUrgency} high-urgency value gap(s) require immediate attention.`);
      }
    }

    return this.buildOutput(result, 'success', confidenceLevel, startTime, {
      reasoning: `Assessed realization of ${analysis.kpi_progress.length} KPIs at ` +
        `${analysis.overall_realization_percent}% overall. ` +
        `${onTrackCount} on track, ${atRiskCount} at risk. ` +
        `${analysis.value_gaps.length} value gaps identified.`,
      suggested_next_actions: analysis.recommended_actions,
      warnings,
    });
  }

  // -------------------------------------------------------------------------
  // Memory Retrieval
  // -------------------------------------------------------------------------

  private async retrieveKPITargets(context: LifecycleContext): Promise<Array<{
    id: string;
    content: string;
    metadata: Record<string, unknown>;
  }>> {
    try {
      const memories = await this.memorySystem.retrieve({
        agent_id: 'target',
        memory_type: 'semantic',
        limit: 10,
        organization_id: context.organization_id,
      });

      return memories.filter(m => {
        const meta = m.metadata || {};
        return meta.kpi_definitions || meta.financial_model_inputs;
      }).map(m => ({
        id: m.id,
        content: m.content,
        metadata: m.metadata || {},
      }));
    } catch (err) {
      logger.warn('Failed to retrieve KPI targets from memory', {
        error: (err as Error).message,
      });
      return [];
    }
  }

  private async retrieveHypotheses(context: LifecycleContext): Promise<Array<{
    id: string;
    content: string;
    metadata: Record<string, unknown>;
  }>> {
    try {
      const memories = await this.memorySystem.retrieve({
        agent_id: 'opportunity',
        memory_type: 'semantic',
        limit: 10,
        organization_id: context.organization_id,
      });

      return memories.filter(m => {
        const meta = m.metadata || {};
        return meta.verified === true;
      }).map(m => ({
        id: m.id,
        content: m.content,
        metadata: m.metadata || {},
      }));
    } catch (err) {
      logger.warn('Failed to retrieve hypotheses from memory', {
        error: (err as Error).message,
      });
      return [];
    }
  }

  // -------------------------------------------------------------------------
  // LLM Realization Analysis
  // -------------------------------------------------------------------------

  private buildSystemPrompt(
    kpiTargets: Array<{ content: string; metadata: Record<string, unknown> }>,
    hypotheses: Array<{ content: string; metadata: Record<string, unknown> }>,
  ): string {
    const kpiContext = kpiTargets.length > 0
      ? kpiTargets.map((k, i) => `${i + 1}. ${k.content}`).join('\n')
      : 'No KPI target data available yet.';

    const hypothesisContext = hypotheses.length > 0
      ? hypotheses.map((h, i) => `${i + 1}. ${h.content}`).join('\n')
      : 'No hypothesis data available.';

    return `You are a Value Engineering analyst specializing in value realization tracking and ROI measurement.

Given the KPI targets and original value hypotheses, generate a realization assessment:
1. Executive summary of value delivery status
2. Progress tracking for each KPI (baseline → current → target)
3. Value gaps where delivery is behind target, with root causes and actions
4. Key milestones and their status
5. Stakeholder impact assessment
6. Recommended actions to improve realization

Rules:
- Progress percentages must be calculated as (current - baseline) / (target - baseline) * 100
- Status must reflect actual progress: on_track (>70%), at_risk (40-70%), behind (<40%), exceeded (>100%)
- Value gaps must include actionable root causes and recovery estimates
- Milestones should map to specific KPIs
- Respond with valid JSON matching the schema. No markdown fences.

KPI Targets:
${kpiContext}

Original Hypotheses:
${hypothesisContext}`;
  }

  private async generateRealizationAnalysis(
    context: LifecycleContext,
    kpiTargets: Array<{ content: string; metadata: Record<string, unknown> }>,
    hypotheses: Array<{ content: string; metadata: Record<string, unknown> }>,
    query?: string,
  ): Promise<RealizationAnalysis | null> {
    const systemPrompt = this.buildSystemPrompt(kpiTargets, hypotheses);

    const userPrompt = `Assess the current state of value realization for this engagement.

${query ? `Additional context: ${query}` : ''}

Generate a JSON object with:
- executive_summary: High-level status of value delivery
- overall_realization_percent: Aggregate realization percentage (0-100)
- kpi_progress: Array of KPI progress records with baseline, current, target, and status
- value_gaps: Array of gaps where delivery is behind, with root causes and actions
- milestones: Key milestones with status and linked KPIs
- stakeholder_impact: How each stakeholder role is affected
- recommended_actions: Prioritized actions to improve realization`;

    try {
      const result = await this.secureInvoke<RealizationAnalysis>(
        context.workspace_id,
        `${systemPrompt}\n\n${userPrompt}`,
        RealizationAnalysisSchema,
        {
          trackPrediction: true,
          confidenceThresholds: { low: 0.5, high: 0.8 },
          context: {
            agent: 'realization',
            organization_id: context.organization_id,
            kpi_target_count: kpiTargets.length,
            hypothesis_count: hypotheses.length,
          },
        },
      );

      return result;
    } catch (err) {
      logger.error('Realization analysis generation failed', {
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
    try {
      const content = JSON.stringify({
        overall_realization_percent: analysis.overall_realization_percent,
        kpi_progress: analysis.kpi_progress,
        value_gaps: analysis.value_gaps,
        executive_summary: analysis.executive_summary,
      });

      await this.memorySystem.storeSemanticMemory(
        context.workspace_id,
        'realization',
        'semantic',
        content,
        {
          overall_percent: analysis.overall_realization_percent,
          kpi_count: analysis.kpi_progress.length,
          gap_count: analysis.value_gaps.length,
          on_track_count: analysis.kpi_progress.filter(k => k.status === 'on_track' || k.status === 'exceeded').length,
        },
        this.organizationId,
      );
    } catch (err) {
      logger.warn('Failed to store realization data in memory', {
        error: (err as Error).message,
      });
    }
  }

  // -------------------------------------------------------------------------
  // SDUI
  // -------------------------------------------------------------------------

  private buildSDUISections(analysis: RealizationAnalysis): Array<Record<string, unknown>> {
    const sections: Array<Record<string, unknown>> = [];

    // KPI progress cards
    for (const kpi of analysis.kpi_progress) {
      sections.push({
        component: 'KPIForm',
        props: {
          title: kpi.kpi_name,
          metrics: [
            { label: 'Baseline', value: `${kpi.baseline_value} ${kpi.unit}` },
            { label: 'Current', value: `${kpi.current_value} ${kpi.unit}` },
            { label: 'Target', value: `${kpi.target_value} ${kpi.unit}` },
            { label: 'Progress', value: `${Math.round(kpi.progress_percent)}%` },
          ],
          status: kpi.status,
          trend: kpi.trend,
        },
      });
    }

    // Value gaps narrative
    if (analysis.value_gaps.length > 0) {
      sections.push({
        component: 'NarrativeBlock',
        props: {
          title: 'Value Gaps',
          content: analysis.value_gaps
            .map(g => `**${g.gap_description}** (${g.urgency} urgency)\n` +
              `Root cause: ${g.root_cause}\n` +
              `Action: ${g.recommended_action}\n` +
              `Recovery: ~${g.estimated_recovery_weeks} weeks`)
            .join('\n\n'),
          variant: 'warning',
        },
      });
    }

    // Executive summary
    sections.push({
      component: 'NarrativeBlock',
      props: {
        title: 'Executive Summary',
        content: analysis.executive_summary,
        variant: 'summary',
      },
    });

    return sections;
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private toConfidenceLevel(score: number): ConfidenceLevel {
    if (score >= 0.8) return 'high';
    if (score >= 0.5) return 'medium';
    return 'low';
  }

  private buildOutput(
    result: Record<string, unknown>,
    status: 'success' | 'partial_success' | 'failure',
    confidence: ConfidenceLevel,
    startTime: number,
    extra?: {
      reasoning?: string;
      suggested_next_actions?: string[];
      warnings?: string[];
    },
  ): AgentOutput {
    const metadata: AgentOutputMetadata = {
      execution_time_ms: Date.now() - startTime,
      model_version: 'realization-v1',
      timestamp: new Date().toISOString(),
    };

    return {
      agent_id: this.name,
      agent_type: 'realization',
      lifecycle_stage: 'realization',
      status,
      result,
      confidence,
      reasoning: extra?.reasoning,
      suggested_next_actions: extra?.suggested_next_actions,
      warnings: extra?.warnings,
      metadata,
    };
  }
}
