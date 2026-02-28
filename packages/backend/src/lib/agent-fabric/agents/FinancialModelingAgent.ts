/**
 * FinancialModelingAgent
 *
 * Sits in the DRAFTING phase after TargetAgent. Retrieves KPI targets and
 * financial model inputs from memory, uses the LLM to build a Value Tree
 * with ROI projections, and validates all monetary calculations through
 * decimal.js to avoid floating-point drift.
 *
 * Output includes a Value Tree (JSON), sensitivity analysis, ROI summary,
 * and SDUI sections (ValueTreeCard + KPIForm).
 */

import Decimal from 'decimal.js';
import { BaseAgent } from './BaseAgent.js';
import { z } from 'zod';
import { logger } from '../../logger.js';
import type {
  AgentOutput,
  AgentOutputMetadata,
  ConfidenceLevel,
  LifecycleContext,
} from '../../../types/agent.js';

// Configure decimal.js for financial precision (matches economic kernel)
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

// ---------------------------------------------------------------------------
// Zod schemas for LLM output validation
// ---------------------------------------------------------------------------

interface ValueTreeNode {
  id: string;
  label: string;
  type: 'root' | 'category' | 'driver' | 'metric';
  value?: number;
  unit?: 'usd' | 'percent' | 'hours' | 'headcount' | 'ratio';
  time_basis?: 'monthly' | 'quarterly' | 'annual' | 'one-time';
  confidence: number;
  assumptions: string[];
  citations: string[];
  children: ValueTreeNode[];
}

// Recursive schema — define the base shape first, then wire up the lazy ref.
const baseNodeShape = {
  id: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(['root', 'category', 'driver', 'metric']),
  /** Raw numeric value from LLM — will be re-validated with decimal.js */
  value: z.number().optional(),
  unit: z.enum(['usd', 'percent', 'hours', 'headcount', 'ratio']).optional(),
  time_basis: z.enum(['monthly', 'quarterly', 'annual', 'one-time']).optional(),
  confidence: z.number().min(0).max(1),
  assumptions: z.array(z.string()).default([]),
  citations: z.array(z.string()).default([]),
} as const;

const ValueTreeNodeSchema: z.ZodType<ValueTreeNode> = z.lazy(() =>
  z.object({
    ...baseNodeShape,
    children: z.array(ValueTreeNodeSchema).default([]),
  }),
) as z.ZodType<ValueTreeNode>;

const SensitivityVariableSchema = z.object({
  name: z.string(),
  base_value: z.number(),
  low_value: z.number(),
  high_value: z.number(),
  unit: z.string(),
  impact_on_total: z.object({
    at_low: z.number(),
    at_high: z.number(),
  }),
});

const ROISummarySchema = z.object({
  total_value: z.number(),
  total_cost: z.number(),
  net_value: z.number(),
  roi_percent: z.number(),
  payback_months: z.number().int().positive(),
  confidence: z.number().min(0).max(1),
  currency: z.string().default('USD'),
});

const FinancialAnalysisSchema = z.object({
  value_tree: z.array(ValueTreeNodeSchema).min(1),
  roi_summary: ROISummarySchema,
  sensitivity_variables: z.array(SensitivityVariableSchema).min(1),
  key_assumptions: z.array(z.string()).min(1),
  methodology_notes: z.string(),
});

type FinancialAnalysis = z.infer<typeof FinancialAnalysisSchema>;

// ---------------------------------------------------------------------------
// Decimal-validated output types
// ---------------------------------------------------------------------------

interface ValidatedROI {
  total_value: string;
  total_cost: string;
  net_value: string;
  roi_percent: string;
  payback_months: number;
  confidence: number;
  currency: string;
  /** True when net_value === total_value - total_cost within tolerance */
  arithmetic_verified: boolean;
}

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

    // Step 1: Retrieve financial model inputs from TargetAgent via memory
    const modelInputs = await this.retrieveModelInputs(context);
    if (modelInputs.length === 0) {
      return this.buildOutput(
        { error: 'No financial model inputs found in memory. Run TargetAgent first.' },
        'failure',
        'low',
        startTime,
      );
    }

    // Step 2: Generate Value Tree and ROI via LLM
    const query = context.user_inputs?.query as string | undefined;
    const analysis = await this.generateFinancialModel(context, modelInputs, query);
    if (!analysis) {
      return this.buildOutput(
        { error: 'Financial model generation failed. Retry or provide more context.' },
        'failure',
        'low',
        startTime,
      );
    }

    // Step 3: Validate monetary arithmetic with decimal.js
    const validatedROI = this.validateROIArithmetic(analysis.roi_summary);
    const treeTotal = this.computeTreeTotal(analysis.value_tree);

    // Step 4: Store results in memory for downstream agents (Integrity, Narrative)
    await this.storeModelInMemory(context, analysis, validatedROI);

    // Step 5: Build SDUI sections
    const sduiSections = this.buildSDUISections(analysis, validatedROI);

    // Step 6: Determine confidence
    const confidenceLevel = this.toConfidenceLevel(analysis.roi_summary.confidence);

    const warnings: string[] = [];
    if (!validatedROI.arithmetic_verified) {
      warnings.push(
        'ROI arithmetic did not pass decimal.js verification. ' +
        `LLM net_value=${analysis.roi_summary.net_value}, ` +
        `computed=${validatedROI.net_value}`,
      );
    }

    const result = {
      value_tree: analysis.value_tree,
      roi_summary: validatedROI,
      sensitivity_variables: analysis.sensitivity_variables,
      key_assumptions: analysis.key_assumptions,
      methodology_notes: analysis.methodology_notes,
      tree_total: treeTotal.toString(),
      model_inputs_used: modelInputs.length,
      sdui_sections: sduiSections,
    };

    return this.buildOutput(result, 'success', confidenceLevel, startTime, {
      reasoning:
        `Built Value Tree with ${this.countNodes(analysis.value_tree)} nodes ` +
        `from ${modelInputs.length} model inputs. ` +
        `ROI: ${validatedROI.roi_percent}%, payback: ${validatedROI.payback_months} months.`,
      suggested_next_actions: [
        'Run IntegrityAgent to validate claims and evidence',
        'Review sensitivity variables with finance team',
        'Adjust assumptions based on customer-specific data',
      ],
      warnings,
    });
  }

  // -------------------------------------------------------------------------
  // Memory Retrieval
  // -------------------------------------------------------------------------

  /**
   * Retrieve financial model inputs stored by TargetAgent.
   */
  private async retrieveModelInputs(context: LifecycleContext): Promise<Array<{
    id: string;
    content: string;
    metadata: Record<string, unknown>;
  }>> {
    try {
      const memories = await this.memorySystem.retrieve({
        agent_id: 'target',
        memory_type: 'semantic',
        limit: 20,
        organization_id: context.organization_id,
      });

      return memories
        .filter(m => {
          const meta = m.metadata || {};
          return meta.category && meta.financial_model_input === true;
        })
        .map(m => ({
          id: m.id,
          content: m.content,
          metadata: (m.metadata || {}) as Record<string, unknown>,
        }));
    } catch (err) {
      logger.warn('Failed to retrieve model inputs from memory', {
        error: (err as Error).message,
      });
      return [];
    }
  }

  // -------------------------------------------------------------------------
  // LLM Financial Model Generation
  // -------------------------------------------------------------------------

  private buildSystemPrompt(
    modelInputs: Array<{ content: string; metadata: Record<string, unknown> }>,
  ): string {
    const inputContext = modelInputs.map((m, i) => {
      const meta = m.metadata;
      return `${i + 1}. ${m.content}
   Category: ${meta.category}
   Baseline: ${meta.baseline_value} → Target: ${meta.target_value} ${meta.unit}
   Timeframe: ${meta.timeframe_months} months
   Assumptions: ${(meta.assumptions as string[] || []).join('; ')}
   Sensitivity vars: ${(meta.sensitivity_variables as string[] || []).join(', ')}`;
    }).join('\n\n');

    return `You are a Financial Modeling agent for a Value Engineering platform. Build a Value Tree and ROI model from KPI targets and financial model inputs.

Rules:
- The value_tree must be hierarchical: root → category → driver → metric.
- Every monetary value must be precise — use exact numbers, not rounded estimates.
- ROI summary must be internally consistent: net_value = total_value - total_cost.
- roi_percent = (net_value / total_cost) * 100.
- Sensitivity variables must show impact at low and high bounds.
- All assumptions must be explicit and falsifiable.
- Respond with valid JSON matching the schema. No markdown fences.

Financial Model Inputs:
${inputContext}`;
  }

  private async generateFinancialModel(
    context: LifecycleContext,
    modelInputs: Array<{ id: string; content: string; metadata: Record<string, unknown> }>,
    query?: string,
  ): Promise<FinancialAnalysis | null> {
    const systemPrompt = this.buildSystemPrompt(modelInputs);

    const userPrompt = `Build a financial model and Value Tree from these inputs.

${query ? `Additional context: ${query}` : ''}

Generate a JSON object with:
- value_tree: Hierarchical tree of value drivers with monetary values
- roi_summary: Total value, cost, net value, ROI %, payback period
- sensitivity_variables: Key variables with low/high impact ranges
- key_assumptions: List of assumptions underlying the model
- methodology_notes: Brief description of modeling approach`;

    try {
      const result = await this.secureInvoke<FinancialAnalysis>(
        context.workspace_id,
        `${systemPrompt}\n\n${userPrompt}`,
        FinancialAnalysisSchema as z.ZodType<FinancialAnalysis>,
        {
          trackPrediction: true,
          // Financial modeling requires higher confidence thresholds
          confidenceThresholds: { low: 0.7, high: 0.9 },
          context: {
            agent: 'financial-modeling',
            organization_id: context.organization_id,
            input_count: modelInputs.length,
          },
        },
      );

      return result;
    } catch (err) {
      logger.error('Financial model generation failed', {
        error: (err as Error).message,
        workspace_id: context.workspace_id,
      });
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // Decimal.js Arithmetic Validation
  // -------------------------------------------------------------------------

  /**
   * Re-derive net_value and roi_percent from total_value and total_cost
   * using decimal.js. Flags discrepancies from the LLM output.
   */
  private validateROIArithmetic(roi: z.infer<typeof ROISummarySchema>): ValidatedROI {
    const totalValue = new Decimal(roi.total_value);
    const totalCost = new Decimal(roi.total_cost);
    const computedNet = totalValue.minus(totalCost);
    const computedROI = totalCost.isZero()
      ? new Decimal(0)
      : computedNet.dividedBy(totalCost).times(100);

    const llmNet = new Decimal(roi.net_value);
    // Allow 0.01 tolerance for LLM rounding
    const tolerance = new Decimal('0.01');
    const arithmeticVerified = computedNet.minus(llmNet).abs().lessThanOrEqualTo(
      tolerance.times(Decimal.max(computedNet.abs(), new Decimal(1))),
    );

    return {
      total_value: totalValue.toFixed(2),
      total_cost: totalCost.toFixed(2),
      net_value: computedNet.toFixed(2),
      roi_percent: computedROI.toFixed(2),
      payback_months: roi.payback_months,
      confidence: roi.confidence,
      currency: roi.currency,
      arithmetic_verified: arithmeticVerified,
    };
  }

  /**
   * Sum all leaf-node USD values in the tree using decimal.js.
   */
  private computeTreeTotal(nodes: ValueTreeNode[]): Decimal {
    let total = new Decimal(0);
    for (const node of nodes) {
      if (node.children.length > 0) {
        total = total.plus(this.computeTreeTotal(node.children));
      } else if (node.value != null && node.unit === 'usd') {
        total = total.plus(new Decimal(node.value));
      }
    }
    return total;
  }

  // -------------------------------------------------------------------------
  // Memory Storage
  // -------------------------------------------------------------------------

  private async storeModelInMemory(
    context: LifecycleContext,
    analysis: FinancialAnalysis,
    validatedROI: ValidatedROI,
  ): Promise<void> {
    try {
      await this.memorySystem.storeSemanticMemory(
        context.workspace_id,
        'financial-modeling',
        'semantic',
        `Value Tree ROI Model: net value ${validatedROI.net_value} ${validatedROI.currency}, ` +
        `ROI ${validatedROI.roi_percent}%, payback ${validatedROI.payback_months} months`,
        {
          verified: validatedROI.arithmetic_verified,
          roi_summary: validatedROI,
          node_count: this.countNodes(analysis.value_tree),
          sensitivity_count: analysis.sensitivity_variables.length,
          key_assumptions: analysis.key_assumptions,
          organization_id: context.organization_id,
          importance: validatedROI.confidence,
        },
        context.organization_id,
      );
    } catch (err) {
      logger.warn('Failed to store financial model in memory', {
        error: (err as Error).message,
      });
    }
  }

  // -------------------------------------------------------------------------
  // SDUI Output
  // -------------------------------------------------------------------------

  private buildSDUISections(
    analysis: FinancialAnalysis,
    validatedROI: ValidatedROI,
  ): Array<Record<string, unknown>> {
    const sections: Array<Record<string, unknown>> = [];

    // ROI summary card
    sections.push({
      type: 'component',
      component: 'AgentResponseCard',
      version: 1,
      props: {
        response: {
          agentId: 'financial-modeling',
          agentName: 'Financial Modeling Agent',
          timestamp: new Date().toISOString(),
          content:
            `**ROI Summary**\n` +
            `Total Value: ${validatedROI.currency} ${validatedROI.total_value}\n` +
            `Total Cost: ${validatedROI.currency} ${validatedROI.total_cost}\n` +
            `Net Value: ${validatedROI.currency} ${validatedROI.net_value}\n` +
            `ROI: ${validatedROI.roi_percent}%\n` +
            `Payback: ${validatedROI.payback_months} months`,
          confidence: validatedROI.confidence,
          status: 'completed',
        },
        showReasoning: false,
        showActions: true,
        stage: 'financial-modeling',
      },
    });

    // Value Tree card
    sections.push({
      type: 'component',
      component: 'ValueTreeCard',
      version: 1,
      props: {
        tree: analysis.value_tree,
        title: 'Value Driver Tree',
        editable: false,
      },
    });

    // Sensitivity KPI form
    const sensitivityKPIs = analysis.sensitivity_variables.map(sv => ({
      name: sv.name,
      value: sv.base_value,
      unit: sv.unit,
      source: `Range: ${sv.low_value} – ${sv.high_value}`,
    }));

    if (sensitivityKPIs.length > 0) {
      sections.push({
        type: 'component',
        component: 'KPIForm',
        version: 1,
        props: {
          kpis: sensitivityKPIs,
          title: 'Sensitivity Variables',
          readonly: true,
        },
      });
    }

    return sections;
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private countNodes(nodes: ValueTreeNode[]): number {
    let count = 0;
    for (const node of nodes) {
      count += 1 + this.countNodes(node.children);
    }
    return count;
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
      agent_type: 'financial-modeling',
      lifecycle_stage: 'target', // financial modeling is part of the DRAFTING/target phase
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
