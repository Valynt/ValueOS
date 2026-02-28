/**
 * TargetAgent
 *
 * Sits in the DRAFTING phase of the value lifecycle. Retrieves hypotheses
 * stored by OpportunityAgent, uses the LLM to generate measurable KPI
 * targets for each hypothesis, validates causal links via the causal engine,
 * and produces financial model inputs for the downstream FinancialModeling
 * agent.
 *
 * Output includes KPI definitions, a value driver tree, causal traces,
 * and SDUI sections (KPIForm + ValueTreeCard).
 */

import { z } from 'zod';

import { getAdvancedCausalEngine } from '../../../services/reasoning/AdvancedCausalEngine.js';
import type {
  AgentOutput,
  AgentOutputMetadata,
  ConfidenceLevel,
  LifecycleContext,
} from '../../../types/agent.js';
import { logger } from '../../logger.js';

import { BaseAgent } from './BaseAgent.js';

// ---------------------------------------------------------------------------
// Zod schemas for LLM output validation
// ---------------------------------------------------------------------------

const KPIDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  unit: z.enum(['currency', 'percentage', 'number', 'hours', 'headcount', 'ratio']),
  measurement_method: z.string(),
  baseline: z.object({
    value: z.number(),
    source: z.string(),
    as_of_date: z.string(),
  }),
  target: z.object({
    value: z.number(),
    timeframe_months: z.number().int().positive(),
    confidence: z.number().min(0).max(1),
  }),
  category: z.enum(['revenue', 'cost', 'efficiency', 'risk']),
  hypothesis_id: z.string(),
});

const ValueDriverSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  value: z.string().optional(),
  type: z.enum(['root', 'branch', 'leaf']),
  status: z.enum(['active', 'at_risk', 'achieved']).default('active'),
  children: z.array(z.lazy((): z.ZodTypeAny => ValueDriverSchema)).default([]),
});

const FinancialModelInputSchema = z.object({
  hypothesis_id: z.string(),
  hypothesis_title: z.string(),
  category: z.enum(['revenue', 'cost', 'efficiency', 'risk']),
  baseline_value: z.number(),
  target_value: z.number(),
  unit: z.string(),
  timeframe_months: z.number().int().positive(),
  assumptions: z.array(z.string()),
  sensitivity_variables: z.array(z.string()),
});

const TargetAnalysisSchema = z.object({
  kpi_definitions: z.array(KPIDefinitionSchema).min(1),
  value_driver_tree: z.array(ValueDriverSchema).min(1),
  financial_model_inputs: z.array(FinancialModelInputSchema).min(1),
  measurement_plan: z.string(),
  risks: z.array(z.object({
    description: z.string(),
    likelihood: z.enum(['low', 'medium', 'high']),
    mitigation: z.string(),
  })),
});

type TargetAnalysis = z.infer<typeof TargetAnalysisSchema>;
type KPIDefinition = z.infer<typeof KPIDefinitionSchema>;

// ---------------------------------------------------------------------------
// Causal trace types
// ---------------------------------------------------------------------------

interface CausalTrace {
  impactCascade: Array<{
    action: string;
    targetKpi: string;
    effect: { direction: string; magnitude: number; confidence: number };
    linkedOpportunity?: string;
  }>;
  verified: boolean;
  confidence: number;
}

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

export class TargetAgent extends BaseAgent {
  private causalEngine = getAdvancedCausalEngine();

  async execute(context: LifecycleContext): Promise<AgentOutput> {
    const startTime = Date.now();
    const isValid = await this.validateInput(context);
    if (!isValid) {
      throw new Error('Invalid input context');
    }

    // Step 1: Retrieve hypotheses from OpportunityAgent via memory
    const hypotheses = await this.retrieveHypotheses(context);
    if (hypotheses.length === 0) {
      return this.buildOutput(
        {
          error: 'No opportunity hypotheses found in memory. Run OpportunityAgent first.',
          validated: false,
        },
        'failure',
        'low',
        startTime,
      );
    }

    // Step 2: Generate KPI targets and model inputs via LLM
    const query = context.user_inputs?.query as string | undefined;
    const analysis = await this.generateTargets(context, hypotheses, query);
    if (!analysis) {
      return this.buildOutput(
        { error: 'KPI target generation failed. Retry or provide more context.' },
        'failure',
        'low',
        startTime,
      );
    }

    // Step 3: Validate causal traces for each KPI against linked hypotheses
    const causalResults = await this.validateAllCausalTraces(analysis.kpi_definitions, hypotheses);
    const verifiedCount = causalResults.filter(c => c.verified).length;
    const allVerified = verifiedCount === causalResults.length;

    // Step 4: Store KPI targets and model inputs in memory for downstream agents
    await this.storeTargetsInMemory(context, analysis, causalResults);

    // Step 5: Build SDUI sections
    const sduiSections = this.buildSDUISections(analysis, causalResults);

    // Step 6: Determine confidence
    const avgConfidence = causalResults.length > 0
      ? causalResults.reduce((sum, c) => sum + c.confidence, 0) / causalResults.length
      : 0.5;
    const confidenceLevel = this.toConfidenceLevel(avgConfidence);

    const result = {
      validated: allVerified,
      kpi_definitions: analysis.kpi_definitions,
      value_driver_tree: analysis.value_driver_tree,
      financial_model_inputs: analysis.financial_model_inputs,
      measurement_plan: analysis.measurement_plan,
      risks: analysis.risks,
      causal_traces: causalResults,
      hypotheses_linked: hypotheses.length,
      kpis_verified: verifiedCount,
      kpis_total: analysis.kpi_definitions.length,
      sdui_sections: sduiSections,
    };

    const warnings: string[] = [];
    if (!allVerified) {
      warnings.push(
        `${causalResults.length - verifiedCount} of ${causalResults.length} KPIs lack verified causal links to opportunity hypotheses.`,
      );
    }

    return this.buildOutput(result, allVerified ? 'success' : 'partial_success', confidenceLevel, startTime, {
      reasoning: `Generated ${analysis.kpi_definitions.length} KPI targets from ${hypotheses.length} hypotheses. ` +
        `${verifiedCount}/${causalResults.length} causal traces verified.`,
      suggested_next_actions: [
        'Review KPI baselines and targets with stakeholders',
        'Run FinancialModeling agent to build ROI model',
        'Validate measurement methods with data team',
      ],
      warnings,
    });
  }

  // -------------------------------------------------------------------------
  // Hypothesis Retrieval
  // -------------------------------------------------------------------------

  /**
   * Retrieve verified hypotheses stored by OpportunityAgent.
   */
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

      // Filter to verified hypotheses with required metadata
      return memories.filter(m => {
        const meta = m.metadata || {};
        return meta.verified === true && meta.category && meta.estimated_impact;
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
  // LLM KPI Generation
  // -------------------------------------------------------------------------

  /**
   * Build the system prompt with hypothesis context.
   */
  private buildSystemPrompt(hypotheses: Array<{ content: string; metadata: Record<string, unknown> }>): string {
    const hypothesisContext = hypotheses.map((h, i) => {
      const m = h.metadata;
      const impact = m.estimated_impact || {};
      return `${i + 1}. ${h.content}
   Category: ${m.category}
   Impact: ${impact.low}–${impact.high} ${impact.unit} over ${impact.timeframe_months} months
   KPI targets: ${(m.kpi_targets || []).join(', ')}
   Evidence: ${(m.evidence || []).join('; ')}`;
    }).join('\n\n');

    return `You are a Value Engineering analyst specializing in KPI definition and financial modeling.

Given the following value hypotheses from the Opportunity stage, generate:
1. Measurable KPI definitions with baselines, targets, and measurement methods
2. A value driver tree showing how KPIs roll up to business outcomes
3. Financial model inputs for ROI calculation
4. A measurement plan
5. Key risks

Rules:
- Each KPI must link to a specific hypothesis via hypothesis_id
- Baselines must be realistic and sourced
- Targets must be achievable within the stated timeframe
- Value driver tree uses root/branch/leaf hierarchy
- Financial model inputs must include sensitivity variables
- Respond with valid JSON matching the schema. No markdown fences.

Hypotheses:
${hypothesisContext}`;
  }

  /**
   * Call the LLM to generate KPI targets and model inputs.
   */
  private async generateTargets(
    context: LifecycleContext,
    hypotheses: Array<{ id: string; content: string; metadata: Record<string, unknown> }>,
    query?: string,
  ): Promise<TargetAnalysis | null> {
    const systemPrompt = this.buildSystemPrompt(hypotheses);

    const hypothesisIds = hypotheses.map((h, i) => `"hyp-${i + 1}" (${h.metadata.category})`).join(', ');
    const userPrompt = `Generate KPI targets and financial model inputs for these hypotheses.

Hypothesis IDs to reference: ${hypothesisIds}

${query ? `Additional context: ${query}` : ''}

Generate a JSON object with:
- kpi_definitions: Array of KPI definitions with baselines and targets
- value_driver_tree: Hierarchical tree of value drivers (root → branch → leaf)
- financial_model_inputs: Array of model inputs for ROI calculation
- measurement_plan: How to track and verify these KPIs
- risks: Key risks to achieving targets`;

    try {
      const result = await this.secureInvoke<TargetAnalysis>(
        context.workspace_id,
        `${systemPrompt}\n\n${userPrompt}`,
        TargetAnalysisSchema,
        {
          trackPrediction: true,
          confidenceThresholds: { low: 0.5, high: 0.8 },
          context: {
            agent: 'target',
            organization_id: context.organization_id,
            hypothesis_count: hypotheses.length,
          },
        },
      );

      return result;
    } catch (err) {
      logger.error('KPI target generation failed', {
        error: (err as Error).message,
        workspace_id: context.workspace_id,
      });
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // Causal Trace Validation
  // -------------------------------------------------------------------------

  /**
   * Validate causal links between each KPI and its source hypothesis.
   */
  private async validateAllCausalTraces(
    kpis: KPIDefinition[],
    hypotheses: Array<{ id: string; content: string; metadata: Record<string, unknown> }>,
  ): Promise<CausalTrace[]> {
    const results: CausalTrace[] = [];

    for (const kpi of kpis) {
      const trace = await this.validateCausalTrace(kpi, hypotheses);
      results.push(trace);
    }

    return results;
  }

  /**
   * Validate a single KPI's causal link to its hypothesis.
   */
  private async validateCausalTrace(
    kpi: KPIDefinition,
    hypotheses: Array<{ id: string; content: string; metadata: Record<string, unknown> }>,
  ): Promise<CausalTrace> {
    try {
      const action = this.categoryToAction(kpi.category);

      const causalInference = await this.causalEngine.inferCausalRelationship(
        action,
        kpi.name,
        {
          category: kpi.category,
          baseline: kpi.baseline.value,
          target: kpi.target.value,
          timeframe_months: kpi.target.timeframe_months,
        },
      );

      // Find the linked hypothesis
      const linked = hypotheses.find(h => {
        const meta = h.metadata || {};
        const relatedActions = meta.relatedActions || [];
        const targetKpis = meta.targetKpis || meta.kpi_targets || [];
        return (
          meta.verified === true &&
          (relatedActions.includes(action) || targetKpis.some((k: string) => kpi.name.toLowerCase().includes(k.toLowerCase())))
        );
      });

      return {
        impactCascade: [{
          action,
          targetKpi: kpi.name,
          effect: {
            direction: causalInference.effect.direction,
            magnitude: causalInference.effect.magnitude,
            confidence: causalInference.confidence,
          },
          linkedOpportunity: linked?.id,
        }],
        verified: !!linked,
        confidence: causalInference.confidence,
      };
    } catch (err) {
      logger.warn('Causal trace validation failed for KPI', {
        kpi: kpi.name,
        error: (err as Error).message,
      });
      return { impactCascade: [], verified: false, confidence: 0 };
    }
  }

  private categoryToAction(category: string): string {
    const mapping: Record<string, string> = {
      revenue: 'increase_revenue',
      cost: 'reduce_costs',
      efficiency: 'improve_efficiency',
      risk: 'mitigate_risk',
    };
    return mapping[category] || 'business_improvement';
  }

  // -------------------------------------------------------------------------
  // Memory Storage
  // -------------------------------------------------------------------------

  /**
   * Store KPI targets and financial model inputs in memory for downstream agents.
   */
  private async storeTargetsInMemory(
    context: LifecycleContext,
    analysis: TargetAnalysis,
    causalResults: CausalTrace[],
  ): Promise<void> {
    // Mitigation: Cap KPI definitions processed from LLM output to prevent memory exhaustion/DoS
    // Limit to 20 KPI definitions
    const cappedKpiDefinitions = analysis.kpi_definitions.slice(0, 20);
    for (let i = 0; i < cappedKpiDefinitions.length; i++) {
      const kpi = cappedKpiDefinitions[i];
      const causal = causalResults[i];
      try {
        await this.memorySystem.storeSemanticMemory(
          context.workspace_id,
          'target',
          'semantic',
          `KPI: ${kpi.name} — baseline: ${kpi.baseline.value} ${kpi.unit}, target: ${kpi.target.value} in ${kpi.target.timeframe_months}mo`,
          {
            kpi_id: kpi.id,
            category: kpi.category,
            unit: kpi.unit,
            baseline: kpi.baseline,
            target: kpi.target,
            measurement_method: kpi.measurement_method,
            hypothesis_id: kpi.hypothesis_id,
            causal_verified: causal?.verified ?? false,
            causal_confidence: causal?.confidence ?? 0,
            organization_id: context.organization_id,
            importance: kpi.target.confidence,
          },
          context.organization_id,
        );
      } catch (err) {
        logger.warn('Failed to store KPI in memory', {
          kpi: kpi.name,
          error: (err as Error).message,
        });
      }
    }

    // Store financial model inputs as a single memory entry
    try {
      await this.memorySystem.storeSemanticMemory(
        context.workspace_id,
        'target',
        'semantic',
        `Financial model inputs: ${analysis.financial_model_inputs.length} drivers across ${[...new Set(analysis.financial_model_inputs.map(f => f.category))].join(', ')}`,
        {
          type: 'financial_model_inputs',
          inputs: analysis.financial_model_inputs,
          measurement_plan: analysis.measurement_plan,
          risks: analysis.risks,
          organization_id: context.organization_id,
          importance: 0.9,
        },
        context.organization_id,
      );
    } catch (err) {
      logger.warn('Failed to store financial model inputs in memory', {
        error: (err as Error).message,
      });
    }
  }

  // -------------------------------------------------------------------------
  // SDUI Output
  // -------------------------------------------------------------------------

  /**
   * Build SDUI page sections from the analysis results.
   */
  private buildSDUISections(
    analysis: TargetAnalysis,
    causalResults: CausalTrace[],
  ): Array<Record<string, unknown>> {
    const sections: Array<Record<string, unknown>> = [];
    const verifiedCount = causalResults.filter(c => c.verified).length;

    // Summary card
    sections.push({
      type: 'component',
      component: 'AgentResponseCard',
      version: 1,
      props: {
        response: {
          agentId: 'target',
          agentName: 'Target Agent',
          timestamp: new Date().toISOString(),
          content: `${analysis.kpi_definitions.length} KPI targets defined. ${verifiedCount}/${causalResults.length} causally verified.\n\n${analysis.measurement_plan}`,
          confidence: causalResults.length > 0
            ? causalResults.reduce((s, c) => s + c.confidence, 0) / causalResults.length
            : 0.5,
          status: 'completed',
        },
        showReasoning: false,
        showActions: true,
        stage: 'target',
      },
    });

    // KPI form with all definitions
    const kpiFormData: Array<Record<string, unknown>> = analysis.kpi_definitions.map(kpi => ({
      id: kpi.id,
      label: kpi.name,
      unit: kpi.unit === 'currency' ? '$' : kpi.unit === 'percentage' ? '%' : kpi.unit,
      type: kpi.unit === 'currency' ? 'currency' as const
        : kpi.unit === 'percentage' ? 'percentage' as const
        : 'number' as const,
      target: kpi.target.value,
      min: kpi.baseline.value < kpi.target.value ? kpi.baseline.value : undefined,
      max: kpi.baseline.value > kpi.target.value ? kpi.baseline.value : undefined,
    }));

    const kpiValues: Record<string, number> = {};
    for (const kpi of analysis.kpi_definitions) {
      kpiValues[kpi.id] = kpi.baseline.value;
    }

    sections.push({
      type: 'component',
      component: 'KPIForm',
      version: 1,
      props: {
        kpis: kpiFormData,
        values: kpiValues,
        readOnly: false,
      },
    });

    // Value driver tree
    sections.push({
      type: 'component',
      component: 'ValueTreeCard',
      version: 1,
      props: {
        nodes: analysis.value_driver_tree,
        title: 'Value Driver Tree',
      },
    });

    return sections;
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  // ...existing code...
}
