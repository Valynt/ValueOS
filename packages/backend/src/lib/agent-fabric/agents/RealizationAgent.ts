/**
 * RealizationAgent
 *
 * Sits in the FINALIZED phase of the value lifecycle. Retrieves KPI targets
 * (from TargetAgent) and financial model outputs (from FinancialModelingAgent),
 * then uses the LLM to produce a realization dashboard: KPI variance analysis,
 * trend detection, risk flags, and intervention recommendations.
 *
 * Downstream: ExpansionAgent reads realization results to identify scaling
 * opportunities.
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
// Zod schemas
// ---------------------------------------------------------------------------

const KPIVarianceSchema = z.object({
  kpi_name: z.string().min(1),
  target_value: z.number(),
  actual_value: z.number(),
  variance_percent: z.number(),
  unit: z.string(),
  status: z.enum(['on_track', 'at_risk', 'off_track', 'exceeded']),
  trend: z.enum(['improving', 'stable', 'declining']),
  explanation: z.string(),
});

type KPIVariance = z.infer<typeof KPIVarianceSchema>;

const RiskFlagSchema = z.object({
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  category: z.string(),
  description: z.string(),
  affected_kpis: z.array(z.string()),
  recommended_action: z.string(),
});

const InterventionSchema = z.object({
  title: z.string().min(1),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  description: z.string(),
  expected_impact: z.string(),
  effort_estimate: z.string(),
  affected_kpis: z.array(z.string()),
});

const RealizationAnalysisSchema = z.object({
  kpi_variances: z.array(KPIVarianceSchema).min(1),
  overall_realization_percent: z.number().min(0).max(100),
  risk_flags: z.array(RiskFlagSchema),
  interventions: z.array(InterventionSchema),
  trend_summary: z.string(),
  implementation_status: z.enum(['planning', 'implementing', 'completed']),
  confidence: z.number().min(0).max(1),
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
    if (kpiTargets.length === 0) {
      return this.buildOutput(
        { error: 'No KPI targets found in memory. Run TargetAgent first.' },
        'failure',
        'low',
        startTime,
      );
    }

    // Step 2: Retrieve financial model from FinancialModelingAgent
    const financialModel = await this.retrieveFinancialModel(context);

    // Step 3: Generate realization analysis via LLM
    const query = context.user_inputs?.query as string | undefined;
    const analysis = await this.generateRealizationAnalysis(
      context,
      kpiTargets,
      financialModel,
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

    // Step 4: Store results in memory for ExpansionAgent
    await this.storeRealizationInMemory(context, analysis);

    // Step 5: Build SDUI sections
    const sduiSections = this.buildSDUISections(analysis);

    // Step 6: Determine confidence and warnings
    const confidenceLevel = this.toConfidenceLevel(analysis.confidence);
    const warnings = this.deriveWarnings(analysis);

    const result = {
      kpi_variances: analysis.kpi_variances,
      overall_realization_percent: analysis.overall_realization_percent,
      risk_flags: analysis.risk_flags,
      interventions: analysis.interventions,
      trend_summary: analysis.trend_summary,
      implementation_status: analysis.implementation_status,
      kpi_count: analysis.kpi_variances.length,
      off_track_count: analysis.kpi_variances.filter(k => k.status === 'off_track').length,
      sdui_sections: sduiSections,
    };

    return this.buildOutput(result, 'success', confidenceLevel, startTime, {
      reasoning:
        `Analyzed ${analysis.kpi_variances.length} KPIs. ` +
        `Overall realization: ${analysis.overall_realization_percent}%. ` +
        `${analysis.risk_flags.length} risk flags, ` +
        `${analysis.interventions.length} interventions recommended.`,
      suggested_next_actions: [
        'Review off-track KPIs with stakeholders',
        'Prioritize interventions by impact and effort',
        'Run ExpansionAgent to identify scaling opportunities',
      ],
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
        limit: 30,
        organization_id: context.organization_id,
      });

      return memories
        .filter(m => m.metadata && (m.metadata as Record<string, unknown>).category)
        .map(m => ({
          id: m.id,
          content: m.content,
          metadata: (m.metadata || {}) as Record<string, unknown>,
        }));
    } catch (err) {
      logger.warn('Failed to retrieve KPI targets from memory', {
        error: (err as Error).message,
      });
      return [];
    }
  }

  private async retrieveFinancialModel(context: LifecycleContext): Promise<{
    content: string;
    metadata: Record<string, unknown>;
  } | null> {
    try {
      const memories = await this.memorySystem.retrieve({
        agent_id: 'financial-modeling',
        memory_type: 'semantic',
        limit: 5,
        organization_id: context.organization_id,
      });

      if (memories.length === 0) return null;

      const latest = memories[0];
      return {
        content: latest.content,
        metadata: (latest.metadata || {}) as Record<string, unknown>,
      };
    } catch (err) {
      logger.warn('Failed to retrieve financial model from memory', {
        error: (err as Error).message,
      });
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // LLM Analysis
  // -------------------------------------------------------------------------

  private async generateRealizationAnalysis(
    context: LifecycleContext,
    kpiTargets: Array<{ content: string; metadata: Record<string, unknown> }>,
    financialModel: { content: string; metadata: Record<string, unknown> } | null,
    query?: string,
  ): Promise<RealizationAnalysis | null> {
    const kpiContext = kpiTargets.map((t, i) => {
      const meta = t.metadata;
      return `${i + 1}. ${t.content}
   Category: ${meta.category}
   Baseline: ${meta.baseline_value} → Target: ${meta.target_value} ${meta.unit}
   Timeframe: ${meta.timeframe_months} months`;
    }).join('\n\n');

    const financialContext = financialModel
      ? `\nFinancial Model Summary:\n${financialModel.content}`
      : '';

    const systemPrompt = `You are a Realization Tracking agent for a Value Engineering platform. Analyze KPI progress against targets and produce a realization dashboard.

Rules:
- Compare each KPI target against realistic actual values based on the implementation timeline.
- Classify each KPI as on_track, at_risk, off_track, or exceeded.
- Detect trends (improving, stable, declining) for each KPI.
- Flag risks with severity levels and recommended actions.
- Propose interventions for off-track or at-risk KPIs.
- overall_realization_percent is the weighted average of KPI achievement.
- Respond with valid JSON matching the schema. No markdown fences.

KPI Targets:
${kpiContext}
${financialContext}`;

    const userPrompt = `Analyze the realization status of these KPI targets.

${query ? `Additional context: ${query}` : ''}

Generate a JSON object with:
- kpi_variances: Status and variance for each KPI
- overall_realization_percent: Weighted achievement percentage (0-100)
- risk_flags: Identified risks with severity and recommended actions
- interventions: Recommended corrective actions
- trend_summary: Brief narrative of overall trends
- implementation_status: Current phase (planning, implementing, completed)
- confidence: Your confidence in this analysis (0-1)`;

    try {
      const result = await this.secureInvoke<RealizationAnalysis>(
        context.workspace_id,
        `${systemPrompt}\n\n${userPrompt}`,
        RealizationAnalysisSchema as z.ZodType<RealizationAnalysis>,
        {
          trackPrediction: true,
          confidenceThresholds: { low: 0.6, high: 0.85 },
          context: {
            agent: 'realization',
            organization_id: context.organization_id,
            kpi_count: kpiTargets.length,
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
    const offTrack = analysis.kpi_variances.filter(k => k.status === 'off_track').length;
    const atRisk = analysis.kpi_variances.filter(k => k.status === 'at_risk').length;

    try {
      await this.memorySystem.storeSemanticMemory(
        context.workspace_id,
        'realization',
        'semantic',
        `Realization: ${analysis.overall_realization_percent}% achieved. ` +
        `${analysis.kpi_variances.length} KPIs tracked, ` +
        `${offTrack} off-track, ${atRisk} at-risk. ` +
        `${analysis.interventions.length} interventions recommended.`,
        {
          overall_realization_percent: analysis.overall_realization_percent,
          implementation_status: analysis.implementation_status,
          kpi_count: analysis.kpi_variances.length,
          off_track_count: offTrack,
          at_risk_count: atRisk,
          risk_flag_count: analysis.risk_flags.length,
          intervention_count: analysis.interventions.length,
          realization_data: true,
          organization_id: context.organization_id,
          importance: analysis.confidence,
        },
        context.organization_id,
      );
    } catch (err) {
      logger.warn('Failed to store realization data in memory', {
        error: (err as Error).message,
      });
    }
  }

  // -------------------------------------------------------------------------
  // SDUI Output
  // -------------------------------------------------------------------------

  private buildSDUISections(
    analysis: RealizationAnalysis,
  ): Array<Record<string, unknown>> {
    const sections: Array<Record<string, unknown>> = [];

    const offTrack = analysis.kpi_variances.filter(k => k.status === 'off_track').length;
    const onTrack = analysis.kpi_variances.filter(
      k => k.status === 'on_track' || k.status === 'exceeded',
    ).length;

    sections.push({
      type: 'component',
      component: 'AgentResponseCard',
      version: 1,
      props: {
        response: {
          agentId: 'realization',
          agentName: 'Realization Agent',
          timestamp: new Date().toISOString(),
          content:
            `**Realization Dashboard**\n` +
            `Overall Achievement: ${analysis.overall_realization_percent}%\n` +
            `KPIs On Track: ${onTrack}/${analysis.kpi_variances.length}\n` +
            `KPIs Off Track: ${offTrack}/${analysis.kpi_variances.length}\n` +
            `Risk Flags: ${analysis.risk_flags.length}\n` +
            `Status: ${analysis.implementation_status}`,
          confidence: analysis.confidence,
          status: 'completed',
        },
        showReasoning: false,
        showActions: true,
        stage: 'realization',
      },
    });

    const kpiData = analysis.kpi_variances.map(kv => ({
      name: kv.kpi_name,
      value: kv.actual_value,
      unit: kv.unit,
      source: `Target: ${kv.target_value} | Variance: ${kv.variance_percent > 0 ? '+' : ''}${kv.variance_percent}% | ${kv.status}`,
    }));

    sections.push({
      type: 'component',
      component: 'KPIForm',
      version: 1,
      props: {
        kpis: kpiData,
        title: 'KPI Variance Analysis',
        readonly: true,
      },
    });

    if (analysis.risk_flags.length > 0) {
      sections.push({
        type: 'component',
        component: 'RiskFlagList',
        version: 1,
        props: {
          risks: analysis.risk_flags,
          title: 'Risk Flags',
        },
      });
    }

    if (analysis.interventions.length > 0) {
      sections.push({
        type: 'component',
        component: 'InterventionList',
        version: 1,
        props: {
          interventions: analysis.interventions,
          title: 'Recommended Interventions',
        },
      });
    }

    return sections;
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private deriveWarnings(analysis: RealizationAnalysis): string[] {
    const warnings: string[] = [];

    const criticalRisks = analysis.risk_flags.filter(r => r.severity === 'critical');
    if (criticalRisks.length > 0) {
      warnings.push(
        `${criticalRisks.length} critical risk(s) detected: ` +
        criticalRisks.map(r => r.description).join('; '),
      );
    }

    const offTrack = analysis.kpi_variances.filter(k => k.status === 'off_track');
    if (offTrack.length > analysis.kpi_variances.length / 2) {
      warnings.push(
        `Majority of KPIs (${offTrack.length}/${analysis.kpi_variances.length}) are off track.`,
      );
    }

    return warnings;
  }

  private toConfidenceLevel(score: number): ConfidenceLevel {
    if (score >= 0.85) return 'very_high';
    if (score >= 0.7) return 'high';
    if (score >= 0.5) return 'medium';
    if (score >= 0.3) return 'low';
    return 'very_low';
  }

  private buildOutput(
    result: Record<string, unknown>,
    status: AgentOutput['status'],
    confidence: ConfidenceLevel,
    startTime: number,
    extra?: { reasoning?: string; suggested_next_actions?: string[]; warnings?: string[] },
  ): AgentOutput {
    const metadata: AgentOutputMetadata = {
      execution_time_ms: Date.now() - startTime,
      model_version: this.version,
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
