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

import { z } from 'zod';

import { ExpansionOpportunityRepository } from '../../../repositories/ExpansionOpportunityRepository.js';
import {
  BaseGraphWriter,
  valueGraphService as defaultValueGraphService,
} from '../../../services/value-graph/index.js';
import type {
  AgentOutput,
  AgentOutputMetadata,
  ConfidenceLevel,
  LifecycleContext,
} from '../../../types/agent.js';
import { logger } from '../../logger.js';
import { resolvePromptTemplate } from '../promptRegistry.js';
import { renderTemplate } from '../promptUtils.js';

import { BaseAgent } from './BaseAgent.js';


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
  public override readonly version = "1.0.0";

  private graphWriter = new BaseGraphWriter(this.valueGraphService ?? defaultValueGraphService, logger);

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

    // Step 4c: Write expansion_extends_node edges to Value Graph (fire-and-forget)
    await this.writeExpansionToGraph(analysis.opportunities, context);

    // Step 4b: Persist to expansion_opportunities table (non-fatal)
    if (context.value_case_id && context.organization_id) {
      try {
        const repo = new ExpansionOpportunityRepository();
        const runId = context.session_id ?? `run-${Date.now()}`;
        for (const opp of analysis.opportunities) {
          await repo.createOpportunity({
            organization_id: context.organization_id,
            value_case_id: context.value_case_id,
            session_id: context.session_id ?? null,
            agent_run_id: runId,
            title: opp.title,
            description: opp.description,
            type: opp.type,
            source_kpi_id: opp.source_kpi_id ?? null,
            estimated_value_low: opp.estimated_additional_value.low,
            estimated_value_high: opp.estimated_additional_value.high,
            estimated_value_unit: opp.estimated_additional_value.unit,
            estimated_value_timeframe_months: opp.estimated_additional_value.timeframe_months,
            confidence: opp.confidence,
            evidence: opp.evidence,
            prerequisites: opp.prerequisites,
            stakeholders: opp.stakeholders,
            portfolio_summary: analysis.portfolio_summary,
            total_expansion_value_low: analysis.total_expansion_potential.low,
            total_expansion_value_high: analysis.total_expansion_potential.high,
            total_expansion_currency: analysis.total_expansion_potential.currency,
            gap_analysis: analysis.gap_analysis,
            new_cycle_recommendations: analysis.new_cycle_recommendations,
            recommended_next_steps: analysis.recommended_next_steps,
            hallucination_check: analysis.hallucination_check ?? null,
            source_agent: this.name,
          });
        }
      } catch (err) {
        logger.warn('ExpansionAgent: failed to persist to expansion_opportunities — continuing', {
          caseId: context.value_case_id,
          error: (err as Error).message,
        });
      }
    }

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
        workspace_id: context.workspace_id,
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
        workspace_id: context.workspace_id,
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
        workspace_id: context.workspace_id,
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
        workspace_id: context.workspace_id,
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

    const systemPromptTemplate = resolvePromptTemplate('expansion_system');
    const userPromptTemplate = resolvePromptTemplate('expansion_user');
    this.setPromptVersionReferences(
      [
        { key: systemPromptTemplate.key, version: systemPromptTemplate.version },
        { key: userPromptTemplate.key, version: userPromptTemplate.version },
      ],
      [systemPromptTemplate.approval, userPromptTemplate.approval],
    );

    const systemPrompt = systemPromptTemplate.template;
    const userPrompt = renderTemplate(userPromptTemplate.template, {
      proofContext,
      signalContext,
      varianceContext,
      hypothesisContext,
    });

    try {
      return await this.secureInvoke<ExpansionAnalysis>(
        context.workspace_id,
        `${systemPrompt}\n\n${userPrompt}`,
        ExpansionAnalysisSchema,
         
        {
          trackPrediction: true,
          confidenceThresholds: { low: 0.5, high: 0.8 },
          userId: context.user_id,
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
  // Value Graph writes
  // -------------------------------------------------------------------------

  /**
   * Writes VgCapability nodes and expansion_extends_node edges for each
   * expansion opportunity of type 'new_use_case' or 'upsell'.
   * Skips capabilities that already exist in the graph (by name).
   * Per-opportunity isolation: one failure does not abort others.
   * All writes are fire-and-forget via BaseGraphWriter.safeWrite.
   */
  private async writeExpansionToGraph(
    opportunities: Array<{ title: string; description: string; type: string; confidence: number }>,
    context: LifecycleContext,
  ): Promise<void> {
    const opportunityId = this.graphWriter['resolveOpportunityId'](context);
    if (!opportunityId) return;

    const organizationId = context.organization_id;
    const safeCtx = { opportunityId, organizationId, agentName: 'ExpansionAgent' };
    const vgs = this.valueGraphService ?? defaultValueGraphService;

    // Load existing capability nodes to avoid duplicates
    let existingCapabilityNames = new Set<string>();
    try {
      const graph = await vgs.getGraphForOpportunity(opportunityId, organizationId);
      existingCapabilityNames = new Set(
        graph.nodes
          .filter(n => n.entity_type === 'vg_capability')
          .map(n => ((n.data as Record<string, unknown>).name as string | undefined)?.toLowerCase() ?? ''),
      );
    } catch {
      // Can't check for duplicates — proceed anyway (safeWrite will handle write errors)
    }

    for (const opp of opportunities) {
      if (opp.type !== 'new_use_case' && opp.type !== 'upsell') continue;

      // Skip if capability with same name already exists
      if (existingCapabilityNames.has(opp.title.toLowerCase())) continue;

      try {
        // 1. Write VgCapability node for the new capability
        const capability = await this.graphWriter['safeWrite'](
          () => vgs.writeCapability({
            opportunity_id: opportunityId,
            organization_id: organizationId,
            name: opp.title,
            description: opp.description,
            category: 'other',
          }),
          safeCtx,
        );
        if (!capability) continue;

        // 2. Write expansion_extends_node edge: UseCase → VgCapability
        await this.graphWriter['safeWrite'](
          () => vgs.writeEdge({
            opportunity_id: opportunityId,
            organization_id: organizationId,
            from_entity_type: 'use_case',
            from_entity_id: opportunityId,
            to_entity_type: 'vg_capability',
            to_entity_id: capability.id,
            edge_type: 'expansion_extends_node',
            confidence_score: opp.confidence,
            created_by_agent: 'ExpansionAgent',
          }),
          safeCtx,
        );
      } catch {
        // Per-opportunity isolation — continue to next
      }
    }
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  // ...existing code...
}
