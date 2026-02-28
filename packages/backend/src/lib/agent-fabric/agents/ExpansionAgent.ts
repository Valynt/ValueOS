/**
 * ExpansionAgent
 *
 * Sits in the EXPANSION phase of the value lifecycle. Retrieves
 * realization plans, validated hypotheses, and KPI targets from
 * upstream agents via memory, then uses the LLM to identify growth
 * opportunities — upsell/cross-sell paths, market expansion,
 * product line extensions, and account development strategies.
 *
 * Output includes expansion opportunities with ROI projections,
 * prioritization scores, and SDUI sections (AgentResponseCard +
 * expansion opportunity cards).
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
import { featureFlags } from '../../../config/featureFlags.js';
import { loadDomainContext } from '../../../agents/context/loadDomainContext.js';
import type { DomainContext } from '../../../agents/context/loadDomainContext.js';

// ---------------------------------------------------------------------------
// Zod schemas for LLM output validation
// ---------------------------------------------------------------------------

const ExpansionOpportunitySchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  type: z.enum([
    'upsell',
    'cross_sell',
    'market_expansion',
    'product_extension',
    'account_development',
    'partnership',
  ]),
  source_hypothesis_id: z.string().optional(),
  estimated_revenue_impact: z.object({
    low: z.number(),
    high: z.number(),
    currency: z.string().default('USD'),
    timeframe_months: z.number().int().positive(),
  }),
  effort_level: z.enum(['low', 'medium', 'high']),
  priority_score: z.number().min(0).max(1),
  prerequisites: z.array(z.string()),
  risks: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});

const ExpansionAnalysisSchema = z.object({
  opportunities: z.array(ExpansionOpportunitySchema).min(1),
  market_assessment: z.string(),
  account_health_indicators: z.array(z.object({
    indicator: z.string(),
    status: z.enum(['strong', 'moderate', 'weak']),
    description: z.string(),
  })),
  recommended_sequence: z.array(z.string()),
  total_addressable_expansion: z.object({
    low: z.number(),
    high: z.number(),
    currency: z.string().default('USD'),
    timeframe_months: z.number().int().positive(),
  }),
  retention_risk_factors: z.array(z.object({
    factor: z.string(),
    severity: z.enum(['low', 'medium', 'high']),
    mitigation: z.string(),
  })),
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

    // Step 1: Retrieve upstream context from memory
    const hypotheses = await this.retrieveHypotheses(context);
    const realizationPlans = await this.retrieveRealizationPlans(context);
    const kpiTargets = await this.retrieveKPITargets(context);

    if (hypotheses.length === 0 && realizationPlans.length === 0) {
      return this.buildOutput(
        { error: 'No hypotheses or realization plans found. Run upstream agents first.' },
        'failure', 'low', startTime,
      );
    }

    // Step 1b: Load domain pack context
    const domainContext = await this.loadDomainPackContext(context);

    // Step 2: Generate expansion analysis via LLM
    const analysis = await this.generateExpansionAnalysis(
      context, hypotheses, realizationPlans, kpiTargets, domainContext,
    );
    if (!analysis) {
      return this.buildOutput(
        { error: 'Expansion analysis failed. Retry or provide more context.' },
        'failure', 'low', startTime,
      );
    }

    // Step 3: Store expansion opportunities in memory
    await this.storeExpansionInMemory(context, analysis);

    // Step 4: Build SDUI sections
    const sduiSections = this.buildSDUISections(analysis);

    // Step 5: Determine confidence
    const avgConfidence = analysis.opportunities.reduce((sum, o) => sum + o.confidence, 0)
      / analysis.opportunities.length;
    const confidenceLevel = this.toConfidenceLevel(avgConfidence);

    const result = {
      opportunities: analysis.opportunities,
      market_assessment: analysis.market_assessment,
      account_health_indicators: analysis.account_health_indicators,
      recommended_sequence: analysis.recommended_sequence,
      total_addressable_expansion: analysis.total_addressable_expansion,
      retention_risk_factors: analysis.retention_risk_factors,
      opportunities_count: analysis.opportunities.length,
      sdui_sections: sduiSections,
    };

    return this.buildOutput(result, 'success', confidenceLevel, startTime, {
      reasoning: `Identified ${analysis.opportunities.length} expansion opportunities. ` +
        `Total addressable expansion: $${analysis.total_addressable_expansion.low.toLocaleString()}-` +
        `$${analysis.total_addressable_expansion.high.toLocaleString()} ` +
        `over ${analysis.total_addressable_expansion.timeframe_months} months.`,
      suggested_next_actions: analysis.recommended_sequence.slice(0, 3),
    });
  }

  // -------------------------------------------------------------------------
  // Domain Pack Context
  // -------------------------------------------------------------------------

  private async loadDomainPackContext(context: LifecycleContext): Promise<DomainContext> {
    const empty: DomainContext = { pack: undefined, kpis: [], assumptions: [], glossary: {}, complianceRules: [] };

    if (!featureFlags.ENABLE_DOMAIN_PACK_CONTEXT) return empty;

    const valueCaseId = context.user_inputs?.value_case_id as string | undefined;
    if (!valueCaseId || !context.organization_id) return empty;

    try {
      const supabaseClient = (context as Record<string, unknown>).supabaseClient as
        import('@supabase/supabase-js').SupabaseClient | undefined;
      return await loadDomainContext(context.organization_id, valueCaseId, supabaseClient);
    } catch (err) {
      logger.warn('ExpansionAgent: failed to load domain pack context', {
        value_case_id: valueCaseId,
        error: (err as Error).message,
      });
      return empty;
    }
  }

  // -------------------------------------------------------------------------
  // Memory Retrieval
  // -------------------------------------------------------------------------

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
      logger.warn('Failed to retrieve hypotheses from memory', { error: (err as Error).message });
      return [];
    }
  }

  private async retrieveRealizationPlans(
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
        .filter(m => m.metadata?.type === 'realization_plan' || m.metadata?.type === 'realization_summary')
        .map(m => ({ id: m.id, content: m.content, metadata: m.metadata || {} }));
    } catch (err) {
      logger.warn('Failed to retrieve realization plans from memory', { error: (err as Error).message });
      return [];
    }
  }

  private async retrieveKPITargets(
    context: LifecycleContext,
  ): Promise<Array<{ id: string; content: string; metadata: Record<string, unknown> }>> {
    try {
      const memories = await this.memorySystem.retrieve({
        agent_id: 'target',
        memory_type: 'semantic',
        limit: 20,
        organization_id: context.organization_id,
      });
      return memories
        .filter(m => m.metadata?.kpi_id)
        .map(m => ({ id: m.id, content: m.content, metadata: m.metadata || {} }));
    } catch (err) {
      logger.warn('Failed to retrieve KPI targets from memory', { error: (err as Error).message });
      return [];
    }
  }

  // -------------------------------------------------------------------------
  // LLM Expansion Analysis
  // -------------------------------------------------------------------------

  private async generateExpansionAnalysis(
    context: LifecycleContext,
    hypotheses: Array<{ id: string; content: string; metadata: Record<string, unknown> }>,
    realizationPlans: Array<{ id: string; content: string; metadata: Record<string, unknown> }>,
    kpis: Array<{ id: string; content: string; metadata: Record<string, unknown> }>,
    domainContext?: DomainContext,
  ): Promise<ExpansionAnalysis | null> {
    const hypothesesContext = hypotheses.map((h, i) => {
      const m = h.metadata;
      const impact = m.estimated_impact as Record<string, unknown> | undefined;
      return `${i + 1}. ${h.content}\n   Category: ${m.category || 'unknown'}\n   ` +
        `Impact: ${impact?.low || '?'}-${impact?.high || '?'} ${impact?.unit || ''}`;
    }).join('\n\n');

    const realizationContext = realizationPlans.map((r, i) =>
      `${i + 1}. ${r.content}\n   Timeline: ${r.metadata.timeline_months || '?'} months, ` +
      `Confidence: ${r.metadata.confidence || '?'}`,
    ).join('\n\n');

    const kpiContext = kpis.map((k, i) => {
      const m = k.metadata;
      const baseline = m.baseline as Record<string, unknown> | undefined;
      const target = m.target as Record<string, unknown> | undefined;
      return `${i + 1}. ${k.content}\n   ${baseline?.value || '?'} → ${target?.value || '?'}`;
    }).join('\n\n');

    let domainFragment = '';
    if (domainContext?.glossary && Object.keys(domainContext.glossary).length > 0) {
      domainFragment += `\n\nDomain terminology:\n${Object.entries(domainContext.glossary).map(([k, v]) => `- "${k}" → "${v}"`).join('\n')}`;
    }
    if (domainContext?.complianceRules && domainContext.complianceRules.length > 0) {
      domainFragment += `\n\nCompliance constraints:\n${domainContext.complianceRules.map(r => `- ${r}`).join('\n')}`;
    }

    const systemPrompt = `You are a Value Engineering expansion strategist. Your job is to identify growth opportunities based on validated value hypotheses and realization plans.

For each opportunity, provide:
- type: upsell, cross_sell, market_expansion, product_extension, account_development, or partnership
- estimated_revenue_impact: Revenue range with timeframe
- effort_level: low, medium, or high
- priority_score: 0.0-1.0 based on impact/effort ratio
- prerequisites: What must be in place first
- risks: Key risks to the expansion
- confidence: 0.0-1.0

Also provide:
- market_assessment: Overall market opportunity summary
- account_health_indicators: Signals about account/customer health
- recommended_sequence: Ordered list of which opportunities to pursue first
- total_addressable_expansion: Aggregate revenue potential
- retention_risk_factors: Factors that could cause churn

Be specific. Ground recommendations in the existing hypotheses and realization plans. Respond with valid JSON. No markdown fences.${domainFragment}`;

    const userPrompt = `Identify expansion opportunities based on:

Validated Hypotheses:
${hypothesesContext || 'None available.'}

Realization Plans:
${realizationContext || 'None available.'}

KPI Targets:
${kpiContext || 'None available.'}

${context.user_inputs?.additional_context ? `Additional context: ${context.user_inputs.additional_context}` : ''}`;

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
            hypothesis_count: hypotheses.length,
            realization_plan_count: realizationPlans.length,
          },
        },
      );
    } catch (err) {
      logger.error('Expansion analysis failed', {
        error: (err as Error).message,
        workspace_id: context.workspace_id,
      });
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // Memory Storage
  // -------------------------------------------------------------------------

  private async storeExpansionInMemory(
    context: LifecycleContext,
    analysis: ExpansionAnalysis,
  ): Promise<void> {
    // Store overall expansion summary
    try {
      await this.memorySystem.storeSemanticMemory(
        context.workspace_id,
        'expansion',
        'semantic',
        `Expansion analysis: ${analysis.opportunities.length} opportunities identified. ` +
          `Total addressable: $${analysis.total_addressable_expansion.low.toLocaleString()}-` +
          `$${analysis.total_addressable_expansion.high.toLocaleString()}.`,
        {
          type: 'expansion_summary',
          opportunities_count: analysis.opportunities.length,
          total_addressable_low: analysis.total_addressable_expansion.low,
          total_addressable_high: analysis.total_addressable_expansion.high,
          retention_risk_count: analysis.retention_risk_factors.length,
          organization_id: context.organization_id,
          importance: 0.85,
        },
        context.organization_id,
      );
    } catch (err) {
      logger.warn('Failed to store expansion summary in memory', { error: (err as Error).message });
    }

    // Store each opportunity individually
    for (const opp of analysis.opportunities) {
      try {
        await this.memorySystem.storeSemanticMemory(
          context.workspace_id,
          'expansion',
          'semantic',
          `Expansion opportunity: "${opp.title}" (${opp.type}) — ${opp.description}`,
          {
            type: 'expansion_opportunity',
            opportunity_id: opp.id,
            opportunity_type: opp.type,
            source_hypothesis_id: opp.source_hypothesis_id,
            revenue_impact_low: opp.estimated_revenue_impact.low,
            revenue_impact_high: opp.estimated_revenue_impact.high,
            effort_level: opp.effort_level,
            priority_score: opp.priority_score,
            confidence: opp.confidence,
            organization_id: context.organization_id,
            importance: opp.priority_score,
          },
          context.organization_id,
        );
      } catch (err) {
        logger.warn('Failed to store expansion opportunity in memory', {
          opportunity_id: opp.id,
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

    const avgConfidence = analysis.opportunities.reduce((sum, o) => sum + o.confidence, 0)
      / analysis.opportunities.length;

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
          content: `${analysis.market_assessment}\n\n` +
            `${analysis.opportunities.length} expansion opportunities identified. ` +
            `Total addressable: $${analysis.total_addressable_expansion.low.toLocaleString()}-` +
            `$${analysis.total_addressable_expansion.high.toLocaleString()}.`,
          confidence: avgConfidence,
          status: 'completed',
        },
        showReasoning: true,
        showActions: true,
        stage: 'expansion',
      },
    });

    // Confidence display
    sections.push({
      type: 'component',
      component: 'ConfidenceDisplay',
      version: 1,
      props: {
        data: {
          score: avgConfidence,
          label: 'Expansion Confidence',
          trend: 'stable' as const,
        },
        size: 'lg',
        showTrend: false,
        showLabel: true,
      },
    });

    // One DiscoveryCard per expansion opportunity
    for (const opp of analysis.opportunities) {
      sections.push({
        type: 'component',
        component: 'DiscoveryCard',
        version: 1,
        props: {
          title: opp.title,
          description: opp.description,
          category: opp.type,
          tags: [opp.effort_level, `priority: ${(opp.priority_score * 100).toFixed(0)}%`],
          confidence: opp.confidence,
          status: 'new' as const,
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
