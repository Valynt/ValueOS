/**
 * ExpansionAgent
 *
 * Sits in the EXPANSION phase of the value lifecycle. Analyzes realized
 * value from the current engagement, identifies upsell/cross-sell
 * opportunities, and generates account growth strategies.
 *
 * Retrieves realization data and KPI outcomes from memory, uses the LLM
 * to identify expansion opportunities, and produces SDUI sections
 * (DiscoveryCard + NarrativeBlock) for the downstream workflow.
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
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  type: z.enum(['upsell', 'cross_sell', 'renewal', 'expansion', 'advocacy']),
  estimated_value: z.object({
    low: z.number(),
    high: z.number(),
    unit: z.enum(['usd', 'percent', 'hours', 'headcount']),
    timeframe_months: z.number().int().positive(),
  }),
  confidence: z.number().min(0).max(1),
  prerequisites: z.array(z.string()),
  stakeholders: z.array(z.string()),
  evidence: z.array(z.string()).min(1),
  linked_kpi_ids: z.array(z.string()),
});

const AccountGrowthStrategySchema = z.object({
  strategy: z.string().min(1),
  rationale: z.string().min(1),
  priority: z.enum(['high', 'medium', 'low']),
  timeline_months: z.number().int().positive(),
  dependencies: z.array(z.string()),
});

const ExpansionAnalysisSchema = z.object({
  account_health_summary: z.string(),
  realized_value_recap: z.string(),
  opportunities: z.array(ExpansionOpportunitySchema).min(1),
  growth_strategies: z.array(AccountGrowthStrategySchema).min(1),
  risk_factors: z.array(z.object({
    description: z.string(),
    likelihood: z.enum(['low', 'medium', 'high']),
    mitigation: z.string(),
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

    // Step 1: Retrieve realized value data from memory
    const realizedData = await this.retrieveRealizedValue(context);

    // Step 2: Retrieve KPI outcomes from TargetAgent
    const kpiOutcomes = await this.retrieveKPIOutcomes(context);

    // Step 3: Generate expansion analysis via LLM
    const query = context.user_inputs?.query as string | undefined;
    const analysis = await this.generateExpansionAnalysis(
      context,
      realizedData,
      kpiOutcomes,
      query,
    );

    if (!analysis) {
      return this.buildOutput(
        { error: 'Expansion analysis generation failed. Retry or provide more context.' },
        'failure',
        'low',
        startTime,
      );
    }

    // Step 4: Store expansion opportunities in memory for downstream agents
    await this.storeExpansionInMemory(context, analysis);

    // Step 5: Build SDUI sections
    const sduiSections = this.buildSDUISections(analysis);

    // Step 6: Determine confidence
    const avgConfidence = analysis.opportunities.length > 0
      ? analysis.opportunities.reduce((sum, o) => sum + o.confidence, 0) / analysis.opportunities.length
      : 0.5;
    const confidenceLevel = this.toConfidenceLevel(avgConfidence);

    const result = {
      account_health_summary: analysis.account_health_summary,
      realized_value_recap: analysis.realized_value_recap,
      opportunities: analysis.opportunities,
      growth_strategies: analysis.growth_strategies,
      risk_factors: analysis.risk_factors,
      recommended_next_steps: analysis.recommended_next_steps,
      opportunities_count: analysis.opportunities.length,
      total_estimated_value: this.calculateTotalValue(analysis.opportunities),
      sdui_sections: sduiSections,
    };

    return this.buildOutput(result, 'success', confidenceLevel, startTime, {
      reasoning: `Identified ${analysis.opportunities.length} expansion opportunities ` +
        `with ${analysis.growth_strategies.length} growth strategies ` +
        `based on ${realizedData.length} realized value records and ${kpiOutcomes.length} KPI outcomes.`,
      suggested_next_actions: analysis.recommended_next_steps,
    });
  }

  // -------------------------------------------------------------------------
  // Memory Retrieval
  // -------------------------------------------------------------------------

  private async retrieveRealizedValue(context: LifecycleContext): Promise<Array<{
    id: string;
    content: string;
    metadata: Record<string, unknown>;
  }>> {
    try {
      const memories = await this.memorySystem.retrieve({
        agent_id: 'realization',
        memory_type: 'semantic',
        limit: 10,
        organization_id: context.organization_id,
      });

      return memories.map(m => ({
        id: m.id,
        content: m.content,
        metadata: m.metadata || {},
      }));
    } catch (err) {
      logger.warn('Failed to retrieve realized value from memory', {
        error: (err as Error).message,
      });
      return [];
    }
  }

  private async retrieveKPIOutcomes(context: LifecycleContext): Promise<Array<{
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
      logger.warn('Failed to retrieve KPI outcomes from memory', {
        error: (err as Error).message,
      });
      return [];
    }
  }

  // -------------------------------------------------------------------------
  // LLM Expansion Analysis
  // -------------------------------------------------------------------------

  private buildSystemPrompt(
    realizedData: Array<{ content: string; metadata: Record<string, unknown> }>,
    kpiOutcomes: Array<{ content: string; metadata: Record<string, unknown> }>,
  ): string {
    const realizedContext = realizedData.length > 0
      ? realizedData.map((r, i) => `${i + 1}. ${r.content}`).join('\n')
      : 'No realized value data available yet.';

    const kpiContext = kpiOutcomes.length > 0
      ? kpiOutcomes.map((k, i) => `${i + 1}. ${k.content}`).join('\n')
      : 'No KPI outcome data available yet.';

    return `You are a Value Engineering analyst specializing in account expansion and growth strategy.

Given the realized value data and KPI outcomes from the current engagement, generate:
1. An account health summary assessing the current relationship
2. A recap of realized value to date
3. Specific expansion opportunities (upsell, cross-sell, renewal, advocacy)
4. Account growth strategies with priorities and timelines
5. Risk factors that could impede expansion
6. Recommended next steps

Rules:
- Each opportunity must have supporting evidence
- Estimated values must be realistic and bounded (low/high range)
- Strategies must be prioritized (high/medium/low)
- Link opportunities to specific KPIs where possible
- Respond with valid JSON matching the schema. No markdown fences.

Realized Value Data:
${realizedContext}

KPI Outcomes:
${kpiContext}`;
  }

  private async generateExpansionAnalysis(
    context: LifecycleContext,
    realizedData: Array<{ content: string; metadata: Record<string, unknown> }>,
    kpiOutcomes: Array<{ content: string; metadata: Record<string, unknown> }>,
    query?: string,
  ): Promise<ExpansionAnalysis | null> {
    const systemPrompt = this.buildSystemPrompt(realizedData, kpiOutcomes);

    const userPrompt = `Analyze the account for expansion opportunities.

${query ? `Additional context: ${query}` : ''}

Generate a JSON object with:
- account_health_summary: Overall assessment of the account relationship
- realized_value_recap: Summary of value delivered so far
- opportunities: Array of expansion opportunities with type, value estimates, and evidence
- growth_strategies: Prioritized strategies for account growth
- risk_factors: Risks to expansion with likelihood and mitigation
- recommended_next_steps: Actionable next steps`;

    try {
      const result = await this.secureInvoke<ExpansionAnalysis>(
        context.workspace_id,
        `${systemPrompt}\n\n${userPrompt}`,
        ExpansionAnalysisSchema,
        {
          trackPrediction: true,
          confidenceThresholds: { low: 0.5, high: 0.8 },
          context: {
            agent: 'expansion',
            organization_id: context.organization_id,
            realized_data_count: realizedData.length,
            kpi_outcomes_count: kpiOutcomes.length,
          },
        },
      );

      return result;
    } catch (err) {
      logger.error('Expansion analysis generation failed', {
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
    try {
      const content = JSON.stringify({
        opportunities: analysis.opportunities,
        growth_strategies: analysis.growth_strategies,
        account_health: analysis.account_health_summary,
      });

      await this.memorySystem.storeSemanticMemory(
        context.workspace_id,
        'expansion',
        'semantic',
        content,
        {
          opportunity_count: analysis.opportunities.length,
          strategy_count: analysis.growth_strategies.length,
          total_estimated_value: this.calculateTotalValue(analysis.opportunities),
        },
        this.organizationId,
      );
    } catch (err) {
      logger.warn('Failed to store expansion data in memory', {
        error: (err as Error).message,
      });
    }
  }

  // -------------------------------------------------------------------------
  // SDUI
  // -------------------------------------------------------------------------

  private buildSDUISections(analysis: ExpansionAnalysis): Array<Record<string, unknown>> {
    const sections: Array<Record<string, unknown>> = [];

    // Discovery cards for each opportunity
    for (const opp of analysis.opportunities) {
      sections.push({
        component: 'DiscoveryCard',
        props: {
          title: opp.title,
          description: opp.description,
          badge: opp.type.replace('_', ' '),
          metrics: [
            {
              label: 'Estimated Value',
              value: `$${opp.estimated_value.low.toLocaleString()}–$${opp.estimated_value.high.toLocaleString()}`,
            },
            {
              label: 'Confidence',
              value: `${Math.round(opp.confidence * 100)}%`,
            },
            {
              label: 'Timeline',
              value: `${opp.estimated_value.timeframe_months} months`,
            },
          ],
          evidence: opp.evidence,
        },
      });
    }

    // Narrative block for growth strategy
    sections.push({
      component: 'NarrativeBlock',
      props: {
        title: 'Account Growth Strategy',
        content: analysis.growth_strategies
          .map(s => `**${s.strategy}** (${s.priority} priority, ${s.timeline_months}mo)\n${s.rationale}`)
          .join('\n\n'),
        variant: 'strategy',
      },
    });

    return sections;
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private calculateTotalValue(
    opportunities: ExpansionAnalysis['opportunities'],
  ): { low: number; high: number } {
    return opportunities.reduce(
      (acc, o) => ({
        low: acc.low + o.estimated_value.low,
        high: acc.high + o.estimated_value.high,
      }),
      { low: 0, high: 0 },
    );
  }

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
      model_version: 'expansion-v1',
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
      warnings: extra?.warnings,
      metadata,
    };
  }
}
