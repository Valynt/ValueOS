/**
 * OpportunityAgent
 *
 * Entry point for the value lifecycle. Takes a company name or deal context,
 * fetches grounding financial data via the MCP Ground Truth service, then
 * uses the LLM to generate value hypotheses — specific, measurable claims
 * about where the prospect can capture value.
 *
 * Output includes structured hypotheses, supporting evidence, and an SDUI
 * page schema that the frontend renders directly.
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
import { mcpGroundTruthService } from '../../../services/MCPGroundTruthService.js';
import type { FinancialDataResult } from '../../../services/MCPGroundTruthService.js';
import { featureFlags } from '../../../config/featureFlags.js';
import { formatDomainContextForPrompt, loadDomainContext } from '../../../agents/context/loadDomainContext.js';
import type { DomainContext } from '../../../agents/context/loadDomainContext.js';

// ---------------------------------------------------------------------------
// Zod schemas for LLM output validation
// ---------------------------------------------------------------------------

const ValueHypothesisSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  category: z.enum([
    'revenue_growth',
    'cost_reduction',
    'risk_mitigation',
    'operational_efficiency',
    'strategic_advantage',
  ]),
  estimated_impact: z.object({
    low: z.number(),
    high: z.number(),
    unit: z.enum(['usd', 'percent', 'hours', 'headcount']),
    timeframe_months: z.number().int().positive(),
  }),
  confidence: z.number().min(0).max(1),
  evidence: z.array(z.string()).min(1),
  assumptions: z.array(z.string()),
  kpi_targets: z.array(z.string()),
});

const OpportunityAnalysisSchema = z.object({
  company_summary: z.string(),
  industry_context: z.string(),
  hypotheses: z.array(ValueHypothesisSchema).min(1),
  stakeholder_roles: z.array(z.object({
    role: z.string(),
    relevance: z.string(),
    likely_concerns: z.array(z.string()),
  })),
  recommended_next_steps: z.array(z.string()),
});

type OpportunityAnalysis = z.infer<typeof OpportunityAnalysisSchema>;
type ValueHypothesis = z.infer<typeof ValueHypothesisSchema>;

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

export class OpportunityAgent extends BaseAgent {
  async execute(context: LifecycleContext): Promise<AgentOutput> {
    const startTime = Date.now();
    const isValid = await this.validateInput(context);
    if (!isValid) {
      throw new Error('Invalid input context');
    }

    const query = context.user_inputs?.query as string | undefined;
    if (!query || query.trim().length === 0) {
      return this.buildOutput(
        { error: 'No query provided. Supply a company name, deal context, or pain points.' },
        'failure',
        'low',
        startTime,
      );
    }

    // Step 1: Fetch grounding data from Ground Truth MCP (best-effort)
    const entityId = this.extractEntityId(context);
    const financialData = await this.fetchGroundTruth(entityId);

    // Step 1b: Load domain pack context (behind feature flag)
    const domainContext = await this.loadDomainPackContext(context);

    // Step 2: Generate hypotheses via LLM
    const analysis = await this.generateHypotheses(context, query, financialData, domainContext);
    if (!analysis) {
      return this.buildOutput(
        { error: 'LLM hypothesis generation failed. Retry or provide more context.' },
        'failure',
        'low',
        startTime,
      );
    }

    // Step 3: Store hypotheses in memory for downstream agents
    await this.storeHypothesesInMemory(context, analysis);

    // Step 4: Build SDUI page sections
    const sduiSections = this.buildSDUISections(analysis, financialData);

    // Step 5: Determine overall confidence
    const avgConfidence = analysis.hypotheses.reduce((sum, h) => sum + h.confidence, 0)
      / analysis.hypotheses.length;
    const confidenceLevel = this.toConfidenceLevel(avgConfidence);

    const result = {
      company_summary: analysis.company_summary,
      industry_context: analysis.industry_context,
      hypotheses: analysis.hypotheses,
      stakeholder_roles: analysis.stakeholder_roles,
      recommended_next_steps: analysis.recommended_next_steps,
      financial_grounding: financialData ? {
        entity: financialData.entityName,
        period: financialData.period,
        sources: financialData.sources,
        metrics_available: Object.keys(financialData.metrics),
      } : null,
      sdui_sections: sduiSections,
    };

    return this.buildOutput(result, 'success', confidenceLevel, startTime, {
      reasoning: `Generated ${analysis.hypotheses.length} value hypotheses for "${query}"` +
        (financialData ? ` with financial grounding from ${financialData.sources.join(', ')}` : ''),
      suggested_next_actions: analysis.recommended_next_steps,
    });
  }

  // -------------------------------------------------------------------------
  // Domain Pack Context
  // -------------------------------------------------------------------------

  /**
   * Load domain pack KPIs and assumptions for the current value case.
   * Returns empty context when the feature flag is off or no pack is attached.
   */
  private async loadDomainPackContext(context: LifecycleContext): Promise<DomainContext> {
    const empty: DomainContext = { pack: undefined, kpis: [], assumptions: [], glossary: {}, complianceRules: [] };

    if (!featureFlags.ENABLE_DOMAIN_PACK_CONTEXT) {
      return empty;
    }

    const valueCaseId = context.user_inputs?.value_case_id as string | undefined;
    if (!valueCaseId || !context.organization_id) {
      return empty;
    }

    try {
      // Pass supabase client from context if available (set by orchestrator)
      const supabaseClient = (context as Record<string, unknown>).supabaseClient as
        import('@supabase/supabase-js').SupabaseClient | undefined;
      return await loadDomainContext(context.organization_id, valueCaseId, supabaseClient);
    } catch (err) {
      logger.warn('Failed to load domain pack context, proceeding without it', {
        value_case_id: valueCaseId,
        error: (err as Error).message,
      });
      return empty;
    }
  }

  // -------------------------------------------------------------------------
  // Ground Truth
  // -------------------------------------------------------------------------

  /**
   * Extract a company identifier (CIK, ticker, or name) from the context.
   */
  private extractEntityId(context: LifecycleContext): string | null {
    const inputs = context.user_inputs || {};
    return (
      inputs.entity_id ||
      inputs.entityId ||
      inputs.ticker ||
      inputs.cik ||
      inputs.company_name ||
      null
    ) as string | null;
  }

  /**
   * Fetch financial data from the MCP Ground Truth service.
   * Returns null on failure — the agent can still generate hypotheses
   * without grounding data, just at lower confidence.
   */
  private async fetchGroundTruth(entityId: string | null): Promise<FinancialDataResult | null> {
    if (!entityId) return null;

    try {
      const result = await mcpGroundTruthService.getFinancialData({
        entityId,
        metrics: ['revenue', 'netIncome', 'operatingMargin', 'totalAssets', 'employeeCount'],
        includeIndustryBenchmarks: true,
      });
      if (result) {
        logger.info('Ground truth data retrieved', {
          entity: result.entityName,
          metrics_count: Object.keys(result.metrics).length,
        });
      }
      return result;
    } catch (err) {
      logger.warn('Ground truth fetch failed, proceeding without grounding', {
        entity_id: entityId,
        error: (err as Error).message,
      });
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // LLM Hypothesis Generation
  // -------------------------------------------------------------------------

  /**
   * Build the system prompt with optional financial grounding context.
   */
  private buildSystemPrompt(financialData: FinancialDataResult | null): string {
    let prompt = `You are a Value Engineering analyst. Your job is to identify specific, measurable value hypotheses for a B2B prospect.

Rules:
- Each hypothesis must have a concrete estimated_impact range (low/high) with units.
- Evidence must reference specific, verifiable facts — not generic claims.
- Confidence scores reflect how well-supported the hypothesis is (0.0–1.0).
- Categories: revenue_growth, cost_reduction, risk_mitigation, operational_efficiency, strategic_advantage.
- KPI targets should be specific metrics the prospect can track.
- Stakeholder roles should map to real buying committee positions.

Respond with valid JSON matching the schema. Do not include markdown fences or commentary.`;

    if (financialData) {
      const metricsStr = Object.entries(financialData.metrics)
        .map(([k, v]) => `  ${k}: ${v.value} ${v.unit} (source: ${v.source}, confidence: ${v.confidence})`)
        .join('\n');

      prompt += `\n\nGrounding data for ${financialData.entityName} (${financialData.period}):\n${metricsStr}`;

      if (financialData.industryBenchmarks) {
        const benchStr = Object.entries(financialData.industryBenchmarks)
          .map(([k, v]) => `  ${k}: median=${v.median}, p25=${v.p25}, p75=${v.p75}`)
          .join('\n');
        prompt += `\n\nIndustry benchmarks:\n${benchStr}`;
      }

      prompt += '\n\nUse this data to ground your hypotheses. Reference specific metrics and benchmarks in evidence fields.';
    }

    return prompt;
  }

  /**
   * Call the LLM to generate structured opportunity analysis.
   */
  private async generateHypotheses(
    context: LifecycleContext,
    query: string,
    financialData: FinancialDataResult | null,
    domainContext?: DomainContext,
  ): Promise<OpportunityAnalysis | null> {
    let systemPrompt = this.buildSystemPrompt(financialData);

    // Append domain pack context if available
    const domainFragment = domainContext ? formatDomainContextForPrompt(domainContext) : '';
    if (domainFragment) {
      systemPrompt += `\n\n${domainFragment}\n\nUse the domain pack KPIs and assumptions to ground your hypotheses. Reference specific KPI keys in kpi_targets fields.`;
    }

    const userPrompt = `Analyze this opportunity and generate value hypotheses:

${query}

${context.user_inputs?.additional_context ? `Additional context: ${context.user_inputs.additional_context}` : ''}

Generate a JSON object with:
- company_summary: Brief summary of the company/opportunity
- industry_context: Industry dynamics relevant to value creation
- hypotheses: Array of 3-5 value hypotheses with estimated impact, evidence, assumptions, and KPI targets
- stakeholder_roles: Key buying committee roles with their concerns
- recommended_next_steps: 3-5 concrete next actions`;

    try {
      const result = await this.secureInvoke<OpportunityAnalysis>(
        context.workspace_id,
        `${systemPrompt}\n\n${userPrompt}`,
        OpportunityAnalysisSchema,
        {
          trackPrediction: true,
          confidenceThresholds: { low: 0.5, high: 0.8 },
          context: {
            agent: 'opportunity',
            organization_id: context.organization_id,
            has_grounding: !!financialData,
          },
        },
      );

      return result;
    } catch (err) {
      logger.error('Hypothesis generation failed', {
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
   * Store each hypothesis as a semantic memory so downstream agents
   * (TargetAgent, FinancialModeling) can retrieve and build on them.
   */
  private async storeHypothesesInMemory(
    context: LifecycleContext,
    analysis: OpportunityAnalysis,
  ): Promise<void> {
    for (const hypothesis of analysis.hypotheses) {
      try {
        await this.memorySystem.storeSemanticMemory(
          context.workspace_id,
          'opportunity',
          'semantic',
          `Hypothesis: ${hypothesis.title} — ${hypothesis.description}`,
          {
            verified: true,
            category: hypothesis.category,
            estimated_impact: hypothesis.estimated_impact,
            confidence: hypothesis.confidence,
            evidence: hypothesis.evidence,
            assumptions: hypothesis.assumptions,
            kpi_targets: hypothesis.kpi_targets,
            relatedActions: [this.categoryToAction(hypothesis.category)],
            targetKpis: hypothesis.kpi_targets,
            organization_id: context.organization_id,
            importance: hypothesis.confidence,
          },
          context.organization_id,
        );
      } catch (err) {
        logger.warn('Failed to store hypothesis in memory', {
          title: hypothesis.title,
          error: (err as Error).message,
        });
      }
    }
  }

  /**
   * Map hypothesis category to an action string that TargetAgent's
   * causal trace validation can link against.
   */
  private categoryToAction(category: string): string {
    const mapping: Record<string, string> = {
      revenue_growth: 'increase_revenue',
      cost_reduction: 'reduce_costs',
      risk_mitigation: 'mitigate_risk',
      operational_efficiency: 'improve_efficiency',
      strategic_advantage: 'strategic_initiative',
    };
    return mapping[category] || 'business_improvement';
  }

  // -------------------------------------------------------------------------
  // SDUI Output
  // -------------------------------------------------------------------------

  /**
   * Build SDUI page sections from the analysis results.
   * Uses DiscoveryCard for each hypothesis and an AgentResponseCard for the summary.
   */
  private buildSDUISections(
    analysis: OpportunityAnalysis,
    financialData: FinancialDataResult | null,
  ): Array<Record<string, any>> {
    const sections: Array<Record<string, any>> = [];

    // Summary card
    sections.push({
      type: 'component',
      component: 'AgentResponseCard',
      version: 1,
      props: {
        response: {
          agentId: 'opportunity',
          agentName: 'Opportunity Agent',
          timestamp: new Date().toISOString(),
          content: `${analysis.company_summary}\n\n${analysis.industry_context}`,
          confidence: analysis.hypotheses.reduce((s, h) => s + h.confidence, 0) / analysis.hypotheses.length,
          status: 'completed',
        },
        showReasoning: false,
        showActions: true,
        stage: 'opportunity',
      },
    });

    // One DiscoveryCard per hypothesis
    for (const hypothesis of analysis.hypotheses) {
      sections.push({
        type: 'component',
        component: 'DiscoveryCard',
        version: 1,
        props: {
          title: hypothesis.title,
          description: hypothesis.description,
          category: hypothesis.category,
          tags: hypothesis.kpi_targets,
          confidence: hypothesis.confidence,
          status: 'new' as const,
        },
      });
    }

    // Financial grounding card (if available)
    if (financialData) {
      const metricsData = Object.entries(financialData.metrics).map(([name, m]) => ({
        name,
        value: m.value,
        unit: m.unit,
        source: m.source,
      }));

      sections.push({
        type: 'component',
        component: 'KPIForm',
        version: 1,
        props: {
          kpis: metricsData,
          title: `${financialData.entityName} — Financial Grounding`,
          readonly: true,
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
    result: Record<string, any>,
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
      agent_type: 'opportunity',
      lifecycle_stage: 'opportunity',
      status,
      result,
      confidence,
      reasoning: extra?.reasoning,
      suggested_next_actions: extra?.suggested_next_actions,
      metadata,
    };
  }
}
