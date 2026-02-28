/**
 * ExpansionAgent
 *
 * Final stage of the value lifecycle. Reads proof points, variance reports,
 * and expansion signals written by RealizationAgent, then uses the LLM to
 * identify upsell/cross-sell opportunities, new value cycles, and gap
 * analyses based on realized outcomes.
 *
 * Successful expansion opportunities are stored in memory as new seeds
 * that can re-enter the pipeline via OpportunityAgent, closing the
 * value lifecycle loop.
 *
 * Output includes expansion opportunities, gap analysis, a new-cycle
 * recommendation, and SDUI sections (AgentResponseCard + DiscoveryCard
 * + InteractiveChart).
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

const ExpansionOpportunitySchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  description: z.string().min(1),
  type: z.enum(['upsell', 'cross_sell', 'new_use_case', 'geographic_expansion', 'deeper_adoption']),
  source_kpi_id: z.string(),
  estimated_additional_value: z.object({
    low: z.number(),
    high: z.number(),
    unit: z.enum(['usd', 'percent', 'hours', 'headcount']),
    timeframe_months: z.number().int().positive(),
  }),
  confidence: z.number().min(0).max(1),
  evidence: z.array(z.string()).min(1),
  prerequisites: z.array(z.string()),
  stakeholders: z.array(z.string()),
});

const GapAnalysisItemSchema = z.object({
  kpi_id: z.string(),
  kpi_name: z.string(),
  gap_type: z.enum(['underperformance', 'missing_data', 'methodology_issue', 'scope_limitation']),
  description: z.string(),
  root_cause: z.string(),
  recommended_action: z.string(),
  priority: z.enum(['low', 'medium', 'high']),
});

const ExpansionAnalysisSchema = z.object({
  opportunities: z.array(ExpansionOpportunitySchema),
  gap_analysis: z.array(GapAnalysisItemSchema),
  portfolio_summary: z.string(),
  total_expansion_potential: z.object({
    low: z.number(),
    high: z.number(),
    currency: z.string(),
  }),
  new_cycle_recommendations: z.array(z.object({
    title: z.string(),
    rationale: z.string(),
    priority: z.enum(['low', 'medium', 'high']),
    seed_query: z.string(),
  })),
  recommended_next_steps: z.array(z.string()),
});

type ExpansionAnalysis = z.infer<typeof ExpansionAnalysisSchema>;

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

export class ExpansionAgent extends BaseAgent {
  async execute(context: LifecycleContext): Promise<AgentOutput> {
    const startTime = Date.now();
    const isValid = await this.validateInput(context);
    if (!isValid) {
      throw new Error('Invalid input context');
    }

    // Step 1: Retrieve proof points and expansion signals from RealizationAgent
    const proofPoints = await this.retrieveProofPoints(context);
    const expansionSignals = await this.retrieveExpansionSignals(context);
    const varianceReport = await this.retrieveVarianceReport(context);

    // Step 2: Retrieve original hypotheses for context
    const hypotheses = await this.retrieveHypotheses(context);

    if (proofPoints.length === 0 && expansionSignals.length === 0) {
      return this.buildOutput(
        { error: 'No proof points or expansion signals found. Run RealizationAgent first.' },
        'failure', 'low', startTime,
      );
    }

    // Step 3: Generate expansion analysis via LLM
    const analysis = await this.analyzeExpansion(
      context, proofPoints, expansionSignals, varianceReport, hypotheses,
    );
    if (!analysis) {
      return this.buildOutput(
        { error: 'Expansion analysis failed. Retry or provide more context.' },
        'failure', 'low', startTime,
      );
    }

    // Step 4: Store expansion opportunities as seeds for new cycles
    await this.storeExpansionInMemory(context, analysis);

    // Step 5: Build SDUI sections
    const sduiSections = this.buildSDUISections(analysis);

    // Step 6: Determine confidence
    const avgConfidence = analysis.opportunities.length > 0
      ? analysis.opportunities.reduce((sum, o) => sum + o.confidence, 0) / analysis.opportunities.length
      : 0.5;
    const confidenceLevel = this.toConfidenceLevel(avgConfidence);

    const result = {
      opportunities: analysis.opportunities,
      gap_analysis: analysis.gap_analysis,
      portfolio_summary: analysis.portfolio_summary,
      total_expansion_potential: analysis.total_expansion_potential,
      new_cycle_recommendations: analysis.new_cycle_recommendations,
      opportunities_count: analysis.opportunities.length,
      gaps_identified: analysis.gap_analysis.length,
      new_cycles_recommended: analysis.new_cycle_recommendations.length,
      sdui_sections: sduiSections,
    };

    return this.buildOutput(result, 'success', confidenceLevel, startTime, {
      reasoning: `Identified ${analysis.opportunities.length} expansion opportunities ` +
        `with potential value $${analysis.total_expansion_potential.low.toLocaleString()}-$${analysis.total_expansion_potential.high.toLocaleString()} ${analysis.total_expansion_potential.currency}. ` +
        `${analysis.gap_analysis.length} gaps analyzed. ` +
        `${analysis.new_cycle_recommendations.length} new value cycles recommended.`,
      suggested_next_actions: analysis.recommended_next_steps,
    });
  }

  // -------------------------------------------------------------------------
  // Memory Retrieval
  // -------------------------------------------------------------------------

  private async retrieveProofPoints(
    context: LifecycleContext,
  ): Promise<Array<{ id: string; content: string; metadata: Record<string, unknown> }>> {
    try {
      const memories = await this.memorySystem.retrieve({
        agent_id: 'realization',
        memory_type: 'semantic',
        limit: 20,
        organization_id: context.organization_id,
      });
      return memories
        .filter(m => m.metadata?.type === 'proof_point')
        .map(m => ({ id: m.id, content: m.content, metadata: m.metadata || {} }));
    } catch (err) {
      logger.warn('ExpansionAgent: failed to retrieve proof points', {
        error: (err as Error).message,
      });
      return [];
    }
  }

  private async retrieveExpansionSignals(
    context: LifecycleContext,
  ): Promise<Array<{ id: string; content: string; metadata: Record<string, unknown> }>> {
    try {
      const memories = await this.memorySystem.retrieve({
        agent_id: 'realization',
        memory_type: 'semantic',
        limit: 10,
        organization_id: context.organization_id,
      });
      return memories
        .filter(m => m.metadata?.type === 'expansion_signal')
        .map(m => ({ id: m.id, content: m.content, metadata: m.metadata || {} }));
    } catch (err) {
      logger.warn('ExpansionAgent: failed to retrieve expansion signals', {
        error: (err as Error).message,
      });
      return [];
    }
  }

  private async retrieveVarianceReport(
    context: LifecycleContext,
  ): Promise<{ content: string; metadata: Record<string, unknown> } | null> {
    try {
      const memories = await this.memorySystem.retrieve({
        agent_id: 'realization',
        memory_type: 'semantic',
        limit: 5,
        organization_id: context.organization_id,
      });
      const report = memories.find(m => m.metadata?.type === 'variance_report');
      return report ? { content: report.content, metadata: report.metadata || {} } : null;
    } catch (err) {
      logger.warn('ExpansionAgent: failed to retrieve variance report', {
        error: (err as Error).message,
      });
      return null;
    }
  }

  private async retrieveHypotheses(
    context: LifecycleContext,
  ): Promise<Array<{ id: string; content: string; metadata: Record<string, unknown> }>> {
    try {
      const memories = await this.memorySystem.retrieve({
        agent_id: 'opportunity',
        memory_type: 'semantic',
        limit: 10,
        organization_id: context.organization_id,
      });
      return memories
        .filter(m => m.metadata?.verified === true && m.metadata?.category)
        .map(m => ({ id: m.id, content: m.content, metadata: m.metadata || {} }));
    } catch (err) {
      logger.warn('ExpansionAgent: failed to retrieve hypotheses', {
        error: (err as Error).message,
      });
      return [];
    }
  }

  // -------------------------------------------------------------------------
  // LLM Expansion Analysis
  // -------------------------------------------------------------------------

  private async analyzeExpansion(
    context: LifecycleContext,
    proofPoints: Array<{ id: string; content: string; metadata: Record<string, unknown> }>,
    expansionSignals: Array<{ id: string; content: string; metadata: Record<string, unknown> }>,
    varianceReport: { content: string; metadata: Record<string, unknown> } | null,
    hypotheses: Array<{ id: string; content: string; metadata: Record<string, unknown> }>,
  ): Promise<ExpansionAnalysis | null> {
    const proofContext = proofPoints.map((p, i) => {
      const m = p.metadata;
      return `${i + 1}. ${p.content}
   Direction: ${m.direction}, Confidence: ${m.confidence}
   Variance: ${m.variance_percentage}%`;
    }).join('\n\n');

    const signalContext = expansionSignals.length > 0
      ? `\n\nExpansion signals from RealizationAgent:\n${expansionSignals.map(s => `- ${s.content}`).join('\n')}`
      : '';

    const varianceContext = varianceReport
      ? `\n\nVariance report: ${varianceReport.content}`
      : '';

    const hypothesisContext = hypotheses.length > 0
      ? `\n\nOriginal hypotheses:\n${hypotheses.map(h => `- ${h.content} (category: ${h.metadata.category})`).join('\n')}`
      : '';

    const systemPrompt = `You are a Value Expansion analyst. Your job is to identify growth opportunities from realized value data and recommend new value cycles.

Rules:
- Analyze proof points to find KPIs that exceeded targets — these indicate expansion potential.
- Analyze underperforming KPIs for gap analysis — identify root causes and remediation.
- Each expansion opportunity must have a concrete estimated_additional_value range.
- Types: upsell (more of the same), cross_sell (adjacent solutions), new_use_case (novel application), geographic_expansion, deeper_adoption.
- New cycle recommendations should include a seed_query that OpportunityAgent can use to start a new discovery cycle.
- Evidence must reference specific proof points or signals, not generic claims.
- total_expansion_potential aggregates across all identified opportunities.
- Gap analysis should be actionable with clear root causes and recommended actions.

Respond with valid JSON matching the schema. No markdown fences or commentary.`;

    const userPrompt = `Analyze expansion potential from these realized outcomes:\n\n${proofContext}${signalContext}${varianceContext}${hypothesisContext}\n\nIdentify expansion opportunities, perform gap analysis on underperforming areas, and recommend new value cycles.`;

    try {
      return await this.secureInvoke<ExpansionAnalysis>(
        context.workspace_id,
        `${systemPrompt}\n\n${userPrompt}`,
        ExpansionAnalysisSchema,
        {
          trackPrediction: true,
          confidenceThresholds: { low: 0.5, high: 0.8 },
          context: {
            agent: 'expansion',
            organization_id: context.organization_id,
            proof_point_count: proofPoints.length,
            signal_count: expansionSignals.length,
          },
        },
      );
    } catch (err) {
      logger.error('ExpansionAgent: analysis failed', {
        error: (err as Error).message,
        workspace_id: context.workspace_id,
      });
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // Memory Storage
  // -------------------------------------------------------------------------

  /**
   * Store expansion opportunities as seeds for new OpportunityAgent cycles.
   */
  private async storeExpansionInMemory(
    context: LifecycleContext,
    analysis: ExpansionAnalysis,
  ): Promise<void> {
    // Store each expansion opportunity
    for (const opportunity of analysis.opportunities) {
      try {
        await this.memorySystem.storeSemanticMemory(
          context.workspace_id,
          'expansion',
          'semantic',
          `ExpansionOpportunity: ${opportunity.title} — ${opportunity.description} (type: ${opportunity.type}, value: ${opportunity.estimated_additional_value.low}-${opportunity.estimated_additional_value.high} ${opportunity.estimated_additional_value.unit})`,
          {
            type: 'expansion_opportunity',
            opportunity_id: opportunity.id,
            opportunity_type: opportunity.type,
            source_kpi_id: opportunity.source_kpi_id,
            estimated_additional_value: opportunity.estimated_additional_value,
            confidence: opportunity.confidence,
            prerequisites: opportunity.prerequisites,
            stakeholders: opportunity.stakeholders,
            organization_id: context.organization_id,
            importance: opportunity.confidence,
          },
          context.organization_id,
        );
      } catch (err) {
        logger.warn('ExpansionAgent: failed to store expansion opportunity', {
          opportunity_id: opportunity.id,
          error: (err as Error).message,
        });
      }
    }

    // Store gap analysis items
    for (const gap of analysis.gap_analysis) {
      try {
        await this.memorySystem.storeSemanticMemory(
          context.workspace_id,
          'expansion',
          'semantic',
          `GapAnalysis: ${gap.kpi_name} — ${gap.description} (root cause: ${gap.root_cause})`,
          {
            type: 'gap_analysis',
            kpi_id: gap.kpi_id,
            gap_type: gap.gap_type,
            root_cause: gap.root_cause,
            recommended_action: gap.recommended_action,
            priority: gap.priority,
            organization_id: context.organization_id,
            importance: gap.priority === 'high' ? 0.9 : gap.priority === 'medium' ? 0.7 : 0.5,
          },
          context.organization_id,
        );
      } catch (err) {
        logger.warn('ExpansionAgent: failed to store gap analysis', {
          kpi_id: gap.kpi_id,
          error: (err as Error).message,
        });
      }
    }

    // Store new cycle seeds — these can be picked up by OpportunityAgent
    for (const cycle of analysis.new_cycle_recommendations) {
      try {
        await this.memorySystem.storeSemanticMemory(
          context.workspace_id,
          'expansion',
          'semantic',
          `NewCycleSeed: ${cycle.title} — ${cycle.rationale}`,
          {
            type: 'new_cycle_seed',
            seed_query: cycle.seed_query,
            priority: cycle.priority,
            organization_id: context.organization_id,
            importance: cycle.priority === 'high' ? 0.95 : cycle.priority === 'medium' ? 0.8 : 0.6,
          },
          context.organization_id,
        );
      } catch (err) {
        logger.warn('ExpansionAgent: failed to store new cycle seed', {
          title: cycle.title,
          error: (err as Error).message,
        });
      }
    }
  }

  // -------------------------------------------------------------------------
  // SDUI Output
  // -------------------------------------------------------------------------

  private buildSDUISections(analysis: ExpansionAnalysis): Array<Record<string, unknown>> {
    const sections: Array<Record<string, unknown>> = [];

    // Summary card
    sections.push({
      type: 'component',
      component: 'AgentResponseCard',
      version: 1,
      props: {
        response: {
          agentId: 'expansion',
          agentName: 'Expansion Agent',
          timestamp: new Date().toISOString(),
          content: `${analysis.portfolio_summary}\n\nTotal expansion potential: $${analysis.total_expansion_potential.low.toLocaleString()}-$${analysis.total_expansion_potential.high.toLocaleString()} ${analysis.total_expansion_potential.currency}.`,
          confidence: analysis.opportunities.length > 0
            ? analysis.opportunities.reduce((s, o) => s + o.confidence, 0) / analysis.opportunities.length
            : 0.5,
          status: 'completed',
        },
        showReasoning: true,
        showActions: true,
        stage: 'expansion',
      },
    });

    // One DiscoveryCard per expansion opportunity
    for (const opportunity of analysis.opportunities) {
      sections.push({
        type: 'component',
        component: 'DiscoveryCard',
        version: 1,
        props: {
          title: opportunity.title,
          description: opportunity.description,
          category: opportunity.type,
          tags: opportunity.stakeholders,
          confidence: opportunity.confidence,
          status: 'new' as const,
        },
      });
    }

    // Expansion potential chart
    if (analysis.opportunities.length > 0) {
      sections.push({
        type: 'component',
        component: 'InteractiveChart',
        version: 1,
        props: {
          type: 'bar',
          data: analysis.opportunities.map(o => ({
            name: o.title,
            low: o.estimated_additional_value.low,
            high: o.estimated_additional_value.high,
          })),
          title: 'Expansion Opportunity Value Ranges',
          xAxisLabel: 'Opportunity',
          yAxisLabel: `Value (${analysis.opportunities[0]?.estimated_additional_value.unit || 'usd'})`,
          showLegend: true,
          showTooltip: true,
        },
      });
    }

    // Gap analysis narrative
    if (analysis.gap_analysis.length > 0) {
      const gapText = analysis.gap_analysis
        .map(g => `**${g.priority.toUpperCase()}** ${g.kpi_name}: ${g.description}\n   Root cause: ${g.root_cause}\n   Action: ${g.recommended_action}`)
        .join('\n\n');

      sections.push({
        type: 'component',
        component: 'NarrativeBlock',
        version: 1,
        props: {
          content: gapText,
          type: 'analysis',
          confidence: 0.7,
        },
      });
    }

    return sections;
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

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
    extra?: { reasoning?: string; suggested_next_actions?: string[] },
  ): AgentOutput {
    const metadata: AgentOutputMetadata = {
      execution_time_ms: Date.now() - startTime,
      model_version: this.version,
      timestamp: new Date().toISOString(),
    };
    return {
      agent_id: this.name,
      agent_type: 'expansion',
      lifecycle_stage: 'expansion',
      status,
      result,
      confidence,
      reasoning: extra?.reasoning,
      suggested_next_actions: extra?.suggested_next_actions,
      metadata,
    };
  }
}
