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

import { z } from 'zod';

import { formatDomainContextForPrompt, loadDomainContext } from '../../../agents/context/loadDomainContext.js';
import type { DomainContext } from '../../../agents/context/loadDomainContext.js';
import { featureFlags } from '../../../config/featureFlags.js';
import { mcpGroundTruthService } from '../../../services/domain-packs/MCPGroundTruthService.js';
import type { FinancialDataResult } from '../../../services/domain-packs/MCPGroundTruthService.js';
import { hypothesisOutputService } from '../../../services/value/HypothesisOutputService.js';
import type {
  AgentOutput,
  AgentOutputMetadata,
  ConfidenceLevel,
  LifecycleContext,
  PromptVersionReference,
} from '../../../types/agent.js';
import { logger } from '../../logger.js';

import { buildEventEnvelope, getDomainEventBus } from '../../../events/DomainEventBus.js';

import { BaseAgent } from './BaseAgent.js';
import { renderTemplate } from '../promptUtils.js';
import { resolvePromptTemplate } from '../prompts/PromptRegistry.js';

// ---------------------------------------------------------------------------
// Zod schemas for LLM output validation
// ---------------------------------------------------------------------------

const ValueHypothesisSchema = z.object({
  /**
   * Stable identifier. The LLM may omit it; generateHypotheses() fills in a
   * deterministic slug (`<category>-<1-based-index>`) after parsing so every
   * hypothesis always carries a non-empty, unique-within-opportunity id.
   */
  id: z.string().optional(),
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
    const generation = await this.generateHypotheses(context, query, financialData, domainContext);
    if (!generation) {
      return this.buildOutput(
        { error: 'LLM hypothesis generation failed. Retry or provide more context.' },
        'failure',
        'low',
        startTime,
      );
    }

    // Step 3: Store hypotheses in memory for downstream agents
    const { analysis, promptRefs } = generation;
    await this.storeHypothesesInMemory(context, analysis);

    // Publish evidence.attached for each hypothesis that has financial grounding
    if (financialData) {
      const opportunityId = (context.user_inputs?.opportunity_id as string | undefined)
        ?? context.workspace_id;
      await this.publishEvidenceAttached(context, opportunityId, analysis, financialData);
    }

    // Step 3b: Persist hypothesis output to Supabase for frontend retrieval
    const valueCaseId = context.user_inputs?.value_case_id as string | undefined;
    if (valueCaseId && context.organization_id) {
      await this.persistHypothesisOutput(context, valueCaseId, analysis);
    }

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

    // Publish domain event so downstream services (RecommendationEngine, etc.)
    // can react without polling.
    const opportunityId = (context.user_inputs?.opportunity_id as string | undefined)
      ?? context.workspace_id;
    await this.publishOpportunityUpdated(context, opportunityId, analysis, avgConfidence);

    return this.buildOutput(result, 'success', confidenceLevel, startTime, {
      prompt_version_refs: promptRefs,
      reasoning: `Generated ${analysis.hypotheses.length} value hypotheses for "${query}"` +
        (financialData ? ` with financial grounding from ${financialData.sources.join(', ')}` : ''),
      suggested_next_actions: analysis.recommended_next_steps,
    });
  }

  private async publishOpportunityUpdated(
    context: LifecycleContext,
    opportunityId: string,
    analysis: OpportunityAnalysis,
    avgConfidence: number,
  ): Promise<void> {
    try {
      const traceId = (context.metadata?.trace_id as string | undefined) ?? context.workspace_id;
      await getDomainEventBus().publish('opportunity.updated', {
        ...buildEventEnvelope({
          traceId,
          tenantId: context.organization_id,
          actorId: context.user_id,
        }),
        opportunityId,
        workspaceId: context.workspace_id,
        lifecycleStage: context.lifecycle_stage,
        hypothesisCount: analysis.hypotheses.length,
        averageConfidence: avgConfidence,
        recommendedNextSteps: analysis.recommended_next_steps,
      });
    } catch (err) {
      // Non-fatal: event bus failure must not break the agent response
      logger.warn('OpportunityAgent: failed to publish opportunity.updated event', {
        workspace_id: context.workspace_id,
        error: (err as Error).message,
      });
    }
  }

  private async publishEvidenceAttached(
    context: LifecycleContext,
    opportunityId: string,
    analysis: OpportunityAnalysis,
    financialData: FinancialDataResult,
  ): Promise<void> {
    const traceId = (context.metadata?.trace_id as string | undefined) ?? context.workspace_id;
    const avgConfidence = analysis.hypotheses.reduce((sum, h) => sum + h.confidence, 0)
      / analysis.hypotheses.length;

    // Publish all evidence events concurrently — each is independent and the
    // event bus is in-process, so parallel dispatch is safe. Per-item errors
    // are caught individually so one failure does not suppress the others.
    await Promise.all(
      analysis.hypotheses.map(async (hypothesis) => {
        try {
          await getDomainEventBus().publish('evidence.attached', {
            ...buildEventEnvelope({
              traceId,
              tenantId: context.organization_id,
              actorId: context.user_id,
            }),
            opportunityId,
            workspaceId: context.workspace_id,
            // id is always set by generateHypotheses() before this runs
            hypothesisId: hypothesis.id ?? `${hypothesis.category}-unknown`,
            evidenceType: 'financial_data',
            source: financialData.sources.join(', '),
            confidenceDelta: avgConfidence,
          });
        } catch (err) {
          logger.warn('OpportunityAgent: failed to publish evidence.attached event', {
            hypothesis: hypothesis.title,
            error: (err as Error).message,
          });
        }
      }),
    );
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
      return await loadDomainContext(context.organization_id, valueCaseId);
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
      return { analysis: result, promptRefs };
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
  private buildSystemPrompt(financialData: FinancialDataResult | null): {
    prompt: string;
    refs: PromptVersionReference[];
  } {
    const base = resolvePromptTemplate({ promptKey: 'opportunity.system.base' });
    const refs: PromptVersionReference[] = [base.reference];

    if (!financialData) {
      return { prompt: base.template, refs };
    }

    const metricsStr = Object.entries(financialData.metrics)
      .map(([k, v]) => `  ${k}: ${v.value} ${v.unit} (source: ${v.source}, confidence: ${v.confidence})`)
      .join('\n');

    const benchmarkTemplate = resolvePromptTemplate({ promptKey: 'opportunity.system.benchmarks' });
    const benchmarksSection = financialData.industryBenchmarks
      ? renderTemplate(benchmarkTemplate.template, {
          benchStr: Object.entries(financialData.industryBenchmarks)
            .map(([k, v]) => `  ${k}: median=${v.median}, p25=${v.p25}, p75=${v.p75}`)
            .join('\n'),
        })
      : '';

    if (financialData.industryBenchmarks) {
      refs.push(benchmarkTemplate.reference);
    }

    const groundingTemplate = resolvePromptTemplate({ promptKey: 'opportunity.system.grounding' });
    refs.push(groundingTemplate.reference);

    return {
      prompt: base.template + renderTemplate(groundingTemplate.template, {
        entityName: financialData.entityName,
        period: financialData.period,
        metricsStr,
        benchmarksSection,
      }),
      refs,
    };
  }

  /**
   * Call the LLM to generate structured opportunity analysis.
   */
  private async generateHypotheses(
    context: LifecycleContext,
    query: string,
    financialData: FinancialDataResult | null,
    domainContext?: DomainContext,
  ): Promise<{ analysis: OpportunityAnalysis; promptRefs: PromptVersionReference[] } | null> {
    const system = this.buildSystemPrompt(financialData);
    let systemPrompt = system.prompt;
    const userTemplate = resolvePromptTemplate({ promptKey: 'opportunity.user.analysis-request' });
    const promptRefs: PromptVersionReference[] = [...system.refs, userTemplate.reference];

    // Append domain pack context if available
    const domainFragment = domainContext ? formatDomainContextForPrompt(domainContext) : '';
    if (domainFragment) {
      systemPrompt += `\n\n${domainFragment}\n\nUse the domain pack KPIs and assumptions to ground your hypotheses. Reference specific KPI keys in kpi_targets fields.`;
    }

    const userPrompt = renderTemplate(userTemplate.template, {
      query,
      additionalContext: context.user_inputs?.additional_context
        ? `Additional context: ${context.user_inputs.additional_context}`
        : '',
    });

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

      // Ensure every hypothesis has a stable id. The LLM rarely emits one, so
      // we inject a deterministic slug: `<category>-<1-based-index>`. This is
      // stable across re-runs for the same analysis and unique within an
      // opportunity, making it safe to use as a lookup key downstream.
      result.hypotheses = result.hypotheses.map((h, i) => ({
        ...h,
        id: h.id ?? `${h.category}-${i + 1}`,
      }));

      return { analysis: result, promptRefs };
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
  ): Array<Record<string, unknown>> {
    const sections: Array<Record<string, unknown>> = [];

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
  // Persistence
  // -------------------------------------------------------------------------

  /**
   * Write hypothesis output to the hypothesis_outputs table so the
   * frontend can load it without re-running the agent.
   */
  private async persistHypothesisOutput(
    context: LifecycleContext,
    valueCaseId: string,
    analysis: OpportunityAnalysis,
  ): Promise<void> {
    const avgConfidence = analysis.hypotheses.reduce((sum, h) => sum + h.confidence, 0)
      / analysis.hypotheses.length;
    // Map the 5-level ConfidenceLevel to the 3-level DB enum
    const dbConfidence: 'high' | 'medium' | 'low' =
      avgConfidence >= 0.7 ? 'high' : avgConfidence >= 0.4 ? 'medium' : 'low';

    try {
      await hypothesisOutputService.create({
        case_id: valueCaseId,
        organization_id: context.organization_id,
        agent_run_id: context.workspace_id,
        hypotheses: analysis.hypotheses,
        kpis: analysis.hypotheses.flatMap((h) => h.kpi_targets),
        confidence: dbConfidence,
        reasoning: `Generated ${analysis.hypotheses.length} hypotheses for "${context.user_inputs?.query}"`,
      });
    } catch (err) {
      // Non-fatal: memory is already stored; log and continue
      logger.warn('Failed to persist hypothesis output to DB', {
        case_id: valueCaseId,
        organization_id: context.organization_id,
        error: (err as Error).message,
      });
    }
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  // ...existing code...
}
