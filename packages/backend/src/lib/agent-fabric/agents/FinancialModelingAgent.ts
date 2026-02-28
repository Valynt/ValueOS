/**
 * FinancialModelingAgent
 *
 * Encapsulates financial assumption generation, ROI calculations,
 * and value tree construction within the agent-fabric pipeline.
 * Retrieves hypotheses and KPI targets from memory, uses the LLM
 * to generate financial models grounded in domain pack defaults
 * and MCP Ground Truth data, then stores structured outputs for
 * downstream agents (Integrity, Realization).
 *
 * Output includes per-hypothesis financial models, sensitivity
 * analysis, and SDUI sections (ValueTreeCard + financial summary).
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
import { loadDomainContext, formatDomainContextForPrompt } from '../../../agents/context/loadDomainContext.js';
import type { DomainContext } from '../../../agents/context/loadDomainContext.js';

// ---------------------------------------------------------------------------
// Zod schemas for LLM output validation
// ---------------------------------------------------------------------------

const FinancialAssumptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  value: z.number(),
  unit: z.string(),
  source: z.string(),
  confidence: z.number().min(0).max(1),
  sensitivity: z.enum(['low', 'medium', 'high']),
});

const CostLineItemSchema = z.object({
  category: z.enum(['software', 'implementation', 'personnel', 'training', 'infrastructure', 'other']),
  description: z.string(),
  amount: z.number().min(0),
  currency: z.string().default('USD'),
  frequency: z.enum(['one_time', 'monthly', 'quarterly', 'annual']),
});

const BenefitLineItemSchema = z.object({
  hypothesis_id: z.string(),
  category: z.enum(['revenue_increase', 'cost_savings', 'efficiency_gain', 'risk_reduction']),
  description: z.string(),
  amount_low: z.number(),
  amount_high: z.number(),
  currency: z.string().default('USD'),
  timeframe_months: z.number().int().positive(),
  confidence: z.number().min(0).max(1),
});

const SensitivityVariableSchema = z.object({
  variable: z.string(),
  base_value: z.number(),
  low_value: z.number(),
  high_value: z.number(),
  impact_on_roi_low: z.number(),
  impact_on_roi_high: z.number(),
});

const FinancialModelSchema = z.object({
  assumptions: z.array(FinancialAssumptionSchema).min(1),
  costs: z.array(CostLineItemSchema).min(1),
  benefits: z.array(BenefitLineItemSchema).min(1),
  roi_percent: z.number(),
  npv: z.number(),
  payback_months: z.number().int().positive(),
  irr_percent: z.number().optional(),
  total_cost_of_ownership: z.number().min(0),
  total_expected_benefit_low: z.number(),
  total_expected_benefit_high: z.number(),
  time_horizon_months: z.number().int().positive(),
  sensitivity_analysis: z.array(SensitivityVariableSchema),
  risk_adjusted_roi_percent: z.number(),
  executive_summary: z.string(),
});

type FinancialModel = z.infer<typeof FinancialModelSchema>;

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

export class FinancialModelingAgent extends BaseAgent {
  async execute(context: LifecycleContext): Promise<AgentOutput> {
    const startTime = Date.now();
    const isValid = await this.validateInput(context);
    if (!isValid) {
      throw new Error('Invalid input context');
    }

    // Step 1: Retrieve hypotheses and KPI targets from memory
    const hypotheses = await this.retrieveHypotheses(context);
    const kpiTargets = await this.retrieveKPITargets(context);

    if (hypotheses.length === 0) {
      return this.buildOutput(
        { error: 'No hypotheses found in memory. Run OpportunityAgent first.' },
        'failure', 'low', startTime,
      );
    }

    // Step 2: Fetch financial grounding data (best-effort)
    const entityId = this.extractEntityId(context);
    const financialData = await this.fetchGroundTruth(entityId);

    // Step 3: Load domain pack context
    const domainContext = await this.loadDomainPackContext(context);

    // Step 4: Generate financial model via LLM
    const model = await this.generateFinancialModel(
      context, hypotheses, kpiTargets, financialData, domainContext,
    );
    if (!model) {
      return this.buildOutput(
        { error: 'Financial model generation failed. Retry or provide more context.' },
        'failure', 'low', startTime,
      );
    }

    // Step 5: Store financial model in memory
    await this.storeFinancialModelInMemory(context, model);

    // Step 6: Build SDUI sections
    const sduiSections = this.buildSDUISections(model, financialData);

    // Step 7: Determine confidence from assumption confidence scores
    const avgConfidence = model.assumptions.reduce((sum, a) => sum + a.confidence, 0)
      / model.assumptions.length;
    const confidenceLevel = this.toConfidenceLevel(avgConfidence);

    const result = {
      assumptions: model.assumptions,
      costs: model.costs,
      benefits: model.benefits,
      roi_percent: model.roi_percent,
      npv: model.npv,
      payback_months: model.payback_months,
      irr_percent: model.irr_percent,
      total_cost_of_ownership: model.total_cost_of_ownership,
      total_expected_benefit_low: model.total_expected_benefit_low,
      total_expected_benefit_high: model.total_expected_benefit_high,
      time_horizon_months: model.time_horizon_months,
      sensitivity_analysis: model.sensitivity_analysis,
      risk_adjusted_roi_percent: model.risk_adjusted_roi_percent,
      executive_summary: model.executive_summary,
      financial_grounding: financialData ? {
        entity: financialData.entityName,
        period: financialData.period,
        sources: financialData.sources,
      } : null,
      sdui_sections: sduiSections,
    };

    return this.buildOutput(result, 'success', confidenceLevel, startTime, {
      reasoning: `Financial model: ROI ${model.roi_percent.toFixed(1)}%, ` +
        `NPV $${model.npv.toLocaleString()}, payback ${model.payback_months} months. ` +
        `Risk-adjusted ROI: ${model.risk_adjusted_roi_percent.toFixed(1)}%. ` +
        `Based on ${model.assumptions.length} assumptions and ${model.benefits.length} benefit lines.` +
        (financialData ? ` Grounded with ${financialData.sources.join(', ')} data.` : ''),
      suggested_next_actions: [
        'Review financial assumptions with stakeholders',
        'Run sensitivity analysis on key variables',
        'Proceed to IntegrityAgent for validation',
      ],
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
      logger.warn('FinancialModelingAgent: failed to load domain pack context', {
        value_case_id: valueCaseId,
        error: (err as Error).message,
      });
      return empty;
    }
  }

  // -------------------------------------------------------------------------
  // Ground Truth
  // -------------------------------------------------------------------------

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

  private async fetchGroundTruth(entityId: string | null): Promise<FinancialDataResult | null> {
    if (!entityId) return null;

    try {
      const result = await mcpGroundTruthService.getFinancialData({
        entityId,
        metrics: ['revenue', 'netIncome', 'operatingMargin', 'totalAssets', 'employeeCount', 'costOfRevenue'],
        includeIndustryBenchmarks: true,
      });
      if (result) {
        logger.info('Financial grounding data retrieved', {
          entity: result.entityName,
          metrics_count: Object.keys(result.metrics).length,
        });
      }
      return result;
    } catch (err) {
      logger.warn('Financial grounding fetch failed, proceeding without', {
        entity_id: entityId,
        error: (err as Error).message,
      });
      return null;
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
  // LLM Financial Model Generation
  // -------------------------------------------------------------------------

  private async generateFinancialModel(
    context: LifecycleContext,
    hypotheses: Array<{ id: string; content: string; metadata: Record<string, unknown> }>,
    kpis: Array<{ id: string; content: string; metadata: Record<string, unknown> }>,
    financialData: FinancialDataResult | null,
    domainContext?: DomainContext,
  ): Promise<FinancialModel | null> {
    const hypothesesContext = hypotheses.map((h, i) => {
      const m = h.metadata;
      const impact = m.estimated_impact as Record<string, unknown> | undefined;
      return `${i + 1}. [${h.id}] ${h.content}\n   Category: ${m.category}\n   ` +
        `Impact: ${impact?.low || '?'}-${impact?.high || '?'} ${impact?.unit || ''} over ${impact?.timeframe_months || '?'} months\n   ` +
        `Confidence: ${m.confidence || 'unknown'}`;
    }).join('\n\n');

    const kpiContext = kpis.map((k, i) => {
      const m = k.metadata;
      const baseline = m.baseline as Record<string, unknown> | undefined;
      const target = m.target as Record<string, unknown> | undefined;
      return `${i + 1}. ${k.content}\n   Baseline: ${baseline?.value || '?'} → Target: ${target?.value || '?'} (${m.unit || ''})\n   ` +
        `Timeframe: ${target?.timeframe_months || '?'} months`;
    }).join('\n\n');

    let groundingFragment = '';
    if (financialData) {
      const metricsStr = Object.entries(financialData.metrics)
        .map(([k, v]) => `  ${k}: ${v.value} ${v.unit} (source: ${v.source}, confidence: ${v.confidence})`)
        .join('\n');
      groundingFragment = `\n\nFinancial grounding data for ${financialData.entityName} (${financialData.period}):\n${metricsStr}`;

      if (financialData.industryBenchmarks) {
        const benchStr = Object.entries(financialData.industryBenchmarks)
          .map(([k, v]) => `  ${k}: median=${v.median}, p25=${v.p25}, p75=${v.p75}`)
          .join('\n');
        groundingFragment += `\n\nIndustry benchmarks:\n${benchStr}`;
      }
    }

    let domainFragment = '';
    if (domainContext) {
      const formatted = formatDomainContextForPrompt(domainContext);
      if (formatted) {
        domainFragment = `\n\n${formatted}`;
      }
    }

    const systemPrompt = `You are a Value Engineering financial modeler. Build a financial model for the given value hypotheses.

Generate:
- assumptions: Key financial assumptions with values, sources, and sensitivity ratings
- costs: Implementation and ongoing cost line items
- benefits: Per-hypothesis benefit projections (low/high range)
- roi_percent: Return on investment percentage
- npv: Net present value (use 10% discount rate unless specified)
- payback_months: Months to break even
- irr_percent: Internal rate of return (optional)
- total_cost_of_ownership: Sum of all costs over the time horizon
- total_expected_benefit_low/high: Aggregate benefit range
- time_horizon_months: Analysis period
- sensitivity_analysis: How key variables affect ROI
- risk_adjusted_roi_percent: ROI adjusted for risk factors
- executive_summary: One-paragraph summary for executives

Use conservative estimates. Ground assumptions in provided financial data when available. Each assumption must cite its source. Respond with valid JSON. No markdown fences.${groundingFragment}${domainFragment}`;

    const userPrompt = `Build a financial model for these value hypotheses:

${hypothesesContext}

KPI Targets:
${kpiContext || 'No KPI targets available.'}

${context.user_inputs?.additional_context ? `Additional context: ${context.user_inputs.additional_context}` : ''}
${context.user_inputs?.time_horizon_months ? `Time horizon: ${context.user_inputs.time_horizon_months} months` : 'Time horizon: 36 months (default)'}
${context.user_inputs?.discount_rate ? `Discount rate: ${context.user_inputs.discount_rate}` : 'Discount rate: 10% (default)'}`;

    try {
      return await this.secureInvoke<FinancialModel>(
        context.workspace_id,
        `${systemPrompt}\n\n${userPrompt}`,
        FinancialModelSchema,
        {
          trackPrediction: true,
          confidenceThresholds: { low: 0.7, high: 0.9 },
          context: {
            agent: 'financial-modeling',
            organization_id: context.organization_id,
            hypothesis_count: hypotheses.length,
            has_grounding: !!financialData,
          },
        },
      );
    } catch (err) {
      logger.error('Financial model generation failed', {
        error: (err as Error).message,
        workspace_id: context.workspace_id,
      });
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // Memory Storage
  // -------------------------------------------------------------------------

  private async storeFinancialModelInMemory(
    context: LifecycleContext,
    model: FinancialModel,
  ): Promise<void> {
    try {
      await this.memorySystem.storeSemanticMemory(
        context.workspace_id,
        'financial-modeling',
        'semantic',
        `Financial model: ROI ${model.roi_percent.toFixed(1)}%, NPV $${model.npv.toLocaleString()}, ` +
          `payback ${model.payback_months} months. TCO: $${model.total_cost_of_ownership.toLocaleString()}.`,
        {
          type: 'financial_model',
          roi_percent: model.roi_percent,
          npv: model.npv,
          payback_months: model.payback_months,
          irr_percent: model.irr_percent,
          total_cost_of_ownership: model.total_cost_of_ownership,
          total_benefit_low: model.total_expected_benefit_low,
          total_benefit_high: model.total_expected_benefit_high,
          risk_adjusted_roi: model.risk_adjusted_roi_percent,
          time_horizon_months: model.time_horizon_months,
          assumption_count: model.assumptions.length,
          organization_id: context.organization_id,
          importance: 0.95,
        },
        context.organization_id,
      );
    } catch (err) {
      logger.warn('Failed to store financial model in memory', { error: (err as Error).message });
    }

    // Store each assumption for downstream validation
    for (const assumption of model.assumptions) {
      try {
        await this.memorySystem.storeSemanticMemory(
          context.workspace_id,
          'financial-modeling',
          'semantic',
          `Financial assumption: ${assumption.label} = ${assumption.value} ${assumption.unit} (source: ${assumption.source})`,
          {
            type: 'financial_assumption',
            assumption_id: assumption.id,
            value: assumption.value,
            unit: assumption.unit,
            source: assumption.source,
            confidence: assumption.confidence,
            sensitivity: assumption.sensitivity,
            organization_id: context.organization_id,
            importance: assumption.confidence,
          },
          context.organization_id,
        );
      } catch (err) {
        logger.warn('Failed to store financial assumption in memory', {
          assumption_id: assumption.id,
          error: (err as Error).message,
        });
      }
    }
  }

  // -------------------------------------------------------------------------
  // SDUI Output
  // -------------------------------------------------------------------------

  private buildSDUISections(
    model: FinancialModel,
    financialData: FinancialDataResult | null,
  ): Array<Record<string, unknown>> {
    const sections: Array<Record<string, unknown>> = [];

    const avgConfidence = model.assumptions.reduce((sum, a) => sum + a.confidence, 0)
      / model.assumptions.length;

    // Summary card
    sections.push({
      type: 'component',
      component: 'AgentResponseCard',
      version: 1,
      props: {
        response: {
          agentId: 'financial-modeling',
          agentName: 'Financial Modeling Agent',
          timestamp: new Date().toISOString(),
          content: model.executive_summary,
          confidence: avgConfidence,
          status: 'completed',
        },
        showReasoning: true,
        showActions: true,
        stage: 'financial-modeling',
      },
    });

    // Financial KPIs
    sections.push({
      type: 'component',
      component: 'KPIForm',
      version: 1,
      props: {
        title: 'Financial Model Summary',
        readonly: true,
        kpis: [
          { name: 'ROI', value: `${model.roi_percent.toFixed(1)}%`, unit: 'percent' },
          { name: 'NPV', value: `$${model.npv.toLocaleString()}`, unit: 'currency' },
          { name: 'Payback Period', value: `${model.payback_months}`, unit: 'months' },
          { name: 'Risk-Adjusted ROI', value: `${model.risk_adjusted_roi_percent.toFixed(1)}%`, unit: 'percent' },
          { name: 'Total Cost of Ownership', value: `$${model.total_cost_of_ownership.toLocaleString()}`, unit: 'currency' },
          { name: 'Expected Benefit Range', value: `$${model.total_expected_benefit_low.toLocaleString()} - $${model.total_expected_benefit_high.toLocaleString()}`, unit: 'currency' },
        ],
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
          label: 'Financial Model Confidence',
          trend: 'stable' as const,
        },
        size: 'lg',
        showTrend: false,
        showLabel: true,
      },
    });

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
      agent_type: 'financial-modeling',
      lifecycle_stage: 'target',
      status,
      result,
      confidence,
      reasoning: extra?.reasoning,
      suggested_next_actions: extra?.suggested_next_actions,
      metadata,
    };
  }
}
