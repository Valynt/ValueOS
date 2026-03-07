/**
 * FinancialModelingAgent
 *
 * Authority Level 4 agent in the MODELING phase. Takes confirmed hypotheses
 * from OpportunityAgent and builds financial models (ROI, NPV, IRR, payback,
 * sensitivity) using the economic kernel's decimal.js-backed math.
 *
 * The LLM structures the financial assumptions and cash flow projections;
 * the economic kernel computes the precise results. This separation ensures
 * financial calculations are deterministic and auditable while the LLM
 * handles domain reasoning.
 *
 * Output is stored in memory for TargetAgent to consume when setting KPI
 * targets, and for IntegrityAgent to validate.
 */

import Decimal from 'decimal.js';
import { z } from 'zod';

import {
  calculateIRR,
  calculateNPV,
  calculatePayback,
  calculateROI,
  roundTo,
  sensitivityAnalysis,
  toDecimalArray,
} from '../../../domain/economic-kernel/economic_kernel.js';
import { FinancialModelSnapshotRepository } from '../../../repositories/FinancialModelSnapshotRepository.js';
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

const CashFlowProjectionSchema = z.object({
  hypothesis_id: z.string(),
  hypothesis_description: z.string(),
  category: z.enum([
    'cost_reduction',
    'revenue_growth',
    'risk_mitigation',
    'efficiency',
    'productivity',
  ]),
  assumptions: z.array(z.string()).min(1),
  /** Period 0 = initial investment (negative), periods 1..n = projected returns */
  cash_flows: z.array(z.number()).min(2),
  currency: z.string().default('USD'),
  period_type: z.enum(['monthly', 'quarterly', 'annual']).default('annual'),
  discount_rate: z.number().min(0).max(1),
  total_investment: z.number(),
  total_benefit: z.number(),
  confidence: z.number().min(0).max(1),
  risk_factors: z.array(z.string()),
  data_sources: z.array(z.string()),
});

const FinancialModelingOutputSchema = z.object({
  projections: z.array(CashFlowProjectionSchema).min(1),
  portfolio_summary: z.string(),
  key_assumptions: z.array(z.string()),
  sensitivity_parameters: z.array(z.object({
    name: z.string(),
    base_value: z.number(),
    perturbations: z.array(z.number()).min(2),
  })).optional(),
  recommended_next_steps: z.array(z.string()),
});

type FinancialModelingOutput = z.infer<typeof FinancialModelingOutputSchema>;

// ---------------------------------------------------------------------------
// Computed financial model (after economic kernel processing)
// ---------------------------------------------------------------------------

interface ComputedModel {
  hypothesis_id: string;
  hypothesis_description: string;
  category: string;
  assumptions: string[];
  cash_flows: number[];
  currency: string;
  period_type: string;
  discount_rate: number;
  total_investment: number;
  total_benefit: number;
  confidence: number;
  risk_factors: string[];
  data_sources: string[];
  // Computed by economic kernel with decimal.js precision
  roi: number;
  npv: number;
  irr: number | null;
  irr_converged: boolean;
  payback_period: number | null;
  payback_fractional: number | null;
  sensitivity: Array<{
    parameter: string;
    base_npv: number;
    points: Array<{ multiplier: number; npv: number }>;
  }>;
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

    // Step 1: Retrieve hypotheses from OpportunityAgent memory
    const hypotheses = await this.retrieveHypotheses(context);

    if (hypotheses.length === 0) {
      return this.buildOutput(
        { error: 'No hypotheses found in memory. Run OpportunityAgent first.' },
        'failure', 'low', startTime,
      );
    }

    // Step 2: Load domain pack context for sector-specific financial parameters
    const domainContext = await this.loadDomainPackContext(context);

    // Step 3: Use LLM to structure financial assumptions and cash flow projections
    const llmOutput = await this.generateProjections(context, hypotheses, domainContext);
    if (!llmOutput) {
      return this.buildOutput(
        { error: 'Financial projection generation failed.' },
        'failure', 'low', startTime,
      );
    }

    // Step 4: Run projections through economic kernel for precise calculations
    const computedModels = this.computeFinancials(llmOutput);

    // Step 5: Store models in memory for TargetAgent and IntegrityAgent
    await this.storeModelsInMemory(context, computedModels, llmOutput);

    // Step 5b: Persist snapshot to DB for frontend reads
    const valueCaseId = context.user_inputs?.value_case_id as string | undefined;
    if (valueCaseId) {
      await this.persistSnapshot(valueCaseId, context.organization_id, computedModels, llmOutput);
    }

    // Step 6: Build SDUI sections
    const sduiSections = this.buildSDUISections(computedModels, llmOutput);

    // Step 7: Aggregate results
    const totalNPV = computedModels.reduce((sum, m) => sum + m.npv, 0);
    const avgConfidence = computedModels.reduce((sum, m) => sum + m.confidence, 0) / computedModels.length;
    const positiveNPVCount = computedModels.filter(m => m.npv > 0).length;

    const result = {
      models: computedModels,
      portfolio_summary: llmOutput.portfolio_summary,
      key_assumptions: llmOutput.key_assumptions,
      total_npv: totalNPV,
      models_count: computedModels.length,
      positive_npv_count: positiveNPVCount,
      average_confidence: avgConfidence,
      sdui_sections: sduiSections,
    };

    return this.buildOutput(result, 'success', this.toConfidenceLevel(avgConfidence), startTime, {
      reasoning: `Built ${computedModels.length} financial models from ${hypotheses.length} hypotheses. ` +
        `Total portfolio NPV: $${Math.round(totalNPV).toLocaleString()}. ` +
        `${positiveNPVCount}/${computedModels.length} models have positive NPV. ` +
        `Average confidence: ${(avgConfidence * 100).toFixed(0)}%.`,
      suggested_next_actions: llmOutput.recommended_next_steps,
    });
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
        limit: 15,
        organization_id: context.organization_id,
      });
      return memories
        .filter(m => m.metadata?.verified === true && m.metadata?.category)
        .map(m => ({ id: m.id, content: m.content, metadata: m.metadata || {} }));
    } catch (err) {
      logger.warn('FinancialModelingAgent: failed to retrieve hypotheses', {
        error: (err as Error).message,
      });
      return [];
    }
  }

  /**
   * Load domain pack context if available. Domain packs provide
   * sector-specific discount rates, risk profiles, and benchmark ranges.
   */
  private async loadDomainPackContext(
    context: LifecycleContext,
  ): Promise<string> {
    try {
      const domainPack = context.workspace_data?.domain_pack as
        { sector?: string; discount_rate?: number; risk_profile?: string } | undefined;
      if (domainPack) {
        return `Sector: ${domainPack.sector || 'general'}. ` +
          `Default discount rate: ${domainPack.discount_rate ?? 0.1}. ` +
          `Risk profile: ${domainPack.risk_profile || 'moderate'}.`;
      }
    } catch {
      // Domain pack is optional
    }
    return 'No domain pack available. Use general financial assumptions.';
  }

  // -------------------------------------------------------------------------
  // LLM Projection Generation
  // -------------------------------------------------------------------------

  private async generateProjections(
    context: LifecycleContext,
    hypotheses: Array<{ id: string; content: string; metadata: Record<string, unknown> }>,
    domainContext: string,
  ): Promise<FinancialModelingOutput | null> {
    const hypothesisContext = hypotheses.map((h, i) => {
      const m = h.metadata;
      const impact = m.estimated_impact as { low?: number; high?: number; unit?: string } | undefined;
      return `${i + 1}. ${h.content}
   Category: ${m.category}
   Confidence: ${m.confidence ?? 'unknown'}
   ${impact ? `Estimated impact: ${impact.low}-${impact.high} ${impact.unit}` : ''}`;
    }).join('\n\n');

    const systemPrompt = `You are a Financial Modeling analyst for a Value Engineering platform. Build cash flow projections from confirmed hypotheses.

Rules:
- Each hypothesis gets one cash flow projection.
- cash_flows[0] is the initial investment (negative number).
- cash_flows[1..n] are projected returns per period.
- discount_rate should reflect the risk level (0.08-0.15 typical range).
- total_investment = absolute value of cash_flows[0].
- total_benefit = sum of cash_flows[1..n].
- confidence reflects data quality and assumption reliability (0.0-1.0).
- assumptions must be specific and falsifiable, not generic.
- risk_factors should identify what could invalidate the projection.
- data_sources should reference where the numbers come from.
- sensitivity_parameters: pick 2-3 key variables to test (e.g., discount_rate, revenue_growth, cost_savings).
  Each perturbation array should contain multipliers like [0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3].

Domain context: ${domainContext}

Respond with valid JSON matching the schema. No markdown fences or commentary.`;

    const userPrompt = `Build financial models for these confirmed hypotheses:\n\n${hypothesisContext}`;

    try {
      return await this.secureInvoke<FinancialModelingOutput>(
        context.workspace_id,
        `${systemPrompt}\n\n${userPrompt}`,
        FinancialModelingOutputSchema,
        {
          trackPrediction: true,
          confidenceThresholds: { low: 0.6, high: 0.85 },
          context: {
            agent: 'financial_modeling',
            organization_id: context.organization_id,
            hypothesis_count: hypotheses.length,
          },
        },
      );
    } catch (err) {
      logger.error('FinancialModelingAgent: projection generation failed', {
        error: (err as Error).message,
        workspace_id: context.workspace_id,
      });
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // Economic Kernel Computation (decimal.js precision)
  // -------------------------------------------------------------------------

  /**
   * Run each LLM-generated projection through the economic kernel.
   * The LLM provides the structure; the kernel provides the math.
   */
  private computeFinancials(output: FinancialModelingOutput): ComputedModel[] {
    return output.projections.map(proj => {
      const flows = toDecimalArray(proj.cash_flows);
      const rate = new Decimal(proj.discount_rate);

      // NPV via economic kernel
      const npv = calculateNPV(flows, rate);

      // IRR via Newton-Raphson
      const irrResult = calculateIRR(flows);

      // Payback period
      const paybackResult = calculatePayback(flows);

      // ROI
      const totalBenefits = new Decimal(proj.total_benefit);
      const totalCosts = new Decimal(proj.total_investment);
      let roi: Decimal;
      try {
        roi = calculateROI(totalBenefits, totalCosts);
      } catch {
        // total_investment is 0 — shouldn't happen but handle gracefully
        roi = new Decimal(0);
      }

      // Sensitivity analysis on discount rate
      const sensitivityResults: ComputedModel['sensitivity'] = [];
      if (output.sensitivity_parameters) {
        for (const param of output.sensitivity_parameters) {
          if (param.name.toLowerCase().includes('discount')) {
            const result = sensitivityAnalysis(
              param.name,
              new Decimal(param.base_value),
              param.perturbations.map(p => new Decimal(p)),
              (paramValue: Decimal) => calculateNPV(flows, paramValue),
            );
            sensitivityResults.push({
              parameter: result.parameterName,
              base_npv: Number(roundTo(result.baseOutput, 2)),
              points: result.points.map(p => ({
                multiplier: Number(p.parameterValue),
                npv: Number(roundTo(p.outputValue, 2)),
              })),
            });
          } else {
            // For non-discount parameters, scale the cash flows
            const result = sensitivityAnalysis(
              param.name,
              new Decimal(param.base_value),
              param.perturbations.map(p => new Decimal(p)),
              (multiplier: Decimal) => {
                const scaledFlows = flows.map((f, i) =>
                  i === 0 ? f : f.times(multiplier),
                );
                return calculateNPV(scaledFlows, rate);
              },
            );
            sensitivityResults.push({
              parameter: result.parameterName,
              base_npv: Number(roundTo(result.baseOutput, 2)),
              points: result.points.map(p => ({
                multiplier: Number(p.parameterValue),
                npv: Number(roundTo(p.outputValue, 2)),
              })),
            });
          }
        }
      }

      return {
        hypothesis_id: proj.hypothesis_id,
        hypothesis_description: proj.hypothesis_description,
        category: proj.category,
        assumptions: proj.assumptions,
        cash_flows: proj.cash_flows,
        currency: proj.currency,
        period_type: proj.period_type,
        discount_rate: proj.discount_rate,
        total_investment: proj.total_investment,
        total_benefit: proj.total_benefit,
        confidence: proj.confidence,
        risk_factors: proj.risk_factors,
        data_sources: proj.data_sources,
        roi: Number(roundTo(roi, 4)),
        npv: Number(roundTo(npv, 2)),
        irr: irrResult.converged ? Number(roundTo(irrResult.rate, 4)) : null,
        irr_converged: irrResult.converged,
        payback_period: paybackResult.period,
        payback_fractional: paybackResult.fractionalPeriod
          ? Number(roundTo(paybackResult.fractionalPeriod, 2))
          : null,
        sensitivity: sensitivityResults,
      };
    });
  }

  // -------------------------------------------------------------------------
  // Memory Storage
  // -------------------------------------------------------------------------

  private async storeModelsInMemory(
    context: LifecycleContext,
    models: ComputedModel[],
    llmOutput: FinancialModelingOutput,
  ): Promise<void> {
    // Store each computed model
    for (const model of models) {
      try {
        await this.memorySystem.storeSemanticMemory(
          context.workspace_id,
          'financial_modeling',
          'semantic',
          `FinancialModel: ${model.hypothesis_description} — ROI: ${(model.roi * 100).toFixed(1)}%, NPV: $${Math.round(model.npv).toLocaleString()}, ` +
            `IRR: ${model.irr !== null ? (model.irr * 100).toFixed(1) + '%' : 'N/A'}, ` +
            `Payback: ${model.payback_fractional !== null ? model.payback_fractional.toFixed(1) + ' periods' : 'N/A'}.`,
          {
            type: 'financial_model',
            hypothesis_id: model.hypothesis_id,
            category: model.category,
            roi: model.roi,
            npv: model.npv,
            irr: model.irr,
            irr_converged: model.irr_converged,
            payback_period: model.payback_period,
            payback_fractional: model.payback_fractional,
            total_investment: model.total_investment,
            total_benefit: model.total_benefit,
            discount_rate: model.discount_rate,
            currency: model.currency,
            period_type: model.period_type,
            confidence: model.confidence,
            assumptions: model.assumptions,
            risk_factors: model.risk_factors,
            organization_id: context.organization_id,
            importance: model.npv > 0 ? 0.85 : 0.6,
          },
          context.organization_id,
        );
      } catch (err) {
        logger.warn('FinancialModelingAgent: failed to store model', {
          hypothesis_id: model.hypothesis_id,
          error: (err as Error).message,
        });
      }
    }

    // Store portfolio summary
    try {
      const totalNPV = models.reduce((sum, m) => sum + m.npv, 0);
      await this.memorySystem.storeSemanticMemory(
        context.workspace_id,
        'financial_modeling',
        'semantic',
        `PortfolioSummary: ${models.length} models. Total NPV: $${Math.round(totalNPV).toLocaleString()}. ${llmOutput.portfolio_summary}`,
        {
          type: 'portfolio_summary',
          models_count: models.length,
          total_npv: totalNPV,
          key_assumptions: llmOutput.key_assumptions,
          organization_id: context.organization_id,
          importance: 0.9,
        },
        context.organization_id,
      );
    } catch (err) {
      logger.warn('FinancialModelingAgent: failed to store portfolio summary', {
        error: (err as Error).message,
      });
    }
  }

  // -------------------------------------------------------------------------
  // SDUI Output
  // -------------------------------------------------------------------------

  private buildSDUISections(
    models: ComputedModel[],
    llmOutput: FinancialModelingOutput,
  ): Array<Record<string, unknown>> {
    const sections: Array<Record<string, unknown>> = [];

    const totalNPV = models.reduce((sum, m) => sum + m.npv, 0);
    const avgConfidence = models.reduce((sum, m) => sum + m.confidence, 0) / models.length;
    const positiveCount = models.filter(m => m.npv > 0).length;

    // Summary card
    sections.push({
      type: 'component',
      component: 'AgentResponseCard',
      version: 1,
      props: {
        response: {
          agentId: 'financial_modeling',
          agentName: 'Financial Modeling Agent',
          timestamp: new Date().toISOString(),
          content: `${llmOutput.portfolio_summary}\n\nTotal portfolio NPV: $${Math.round(totalNPV).toLocaleString()}. ` +
            `${positiveCount}/${models.length} models have positive NPV.`,
          confidence: avgConfidence,
          status: 'completed',
        },
        showReasoning: true,
        showActions: true,
        stage: 'modeling',
      },
    });

    // Value tree chart — NPV per model
    sections.push({
      type: 'component',
      component: 'InteractiveChart',
      version: 1,
      props: {
        type: 'bar',
        data: models.map(m => ({
          name: m.hypothesis_description.slice(0, 40),
          npv: m.npv,
          roi: m.roi * 100,
        })),
        title: 'Financial Model NPV by Hypothesis',
        xAxisLabel: 'Hypothesis',
        yAxisLabel: `NPV (${models[0]?.currency || 'USD'})`,
        showLegend: true,
        showTooltip: true,
      },
    });

    // Value tree card with model details
    sections.push({
      type: 'component',
      component: 'ValueTreeCard',
      version: 1,
      props: {
        models: models.map(m => ({
          title: m.hypothesis_description,
          category: m.category,
          roi: `${(m.roi * 100).toFixed(1)}%`,
          npv: `$${Math.round(m.npv).toLocaleString()}`,
          irr: m.irr !== null ? `${(m.irr * 100).toFixed(1)}%` : 'N/A',
          payback: m.payback_fractional !== null
            ? `${m.payback_fractional.toFixed(1)} ${m.period_type} periods`
            : 'N/A',
          confidence: m.confidence,
          investment: `$${Math.round(m.total_investment).toLocaleString()}`,
          benefit: `$${Math.round(m.total_benefit).toLocaleString()}`,
        })),
        title: 'Value Tree',
      },
    });

    // Sensitivity chart (if available)
    const allSensitivity = models.flatMap(m => m.sensitivity);
    if (allSensitivity.length > 0) {
      const firstSensitivity = allSensitivity[0];
      if (firstSensitivity) {
        sections.push({
          type: 'component',
          component: 'InteractiveChart',
          version: 1,
          props: {
            type: 'line',
            data: firstSensitivity.points.map(p => ({
              name: `${p.multiplier}`,
              npv: p.npv,
            })),
            title: `Sensitivity: ${firstSensitivity.parameter}`,
            xAxisLabel: firstSensitivity.parameter,
            yAxisLabel: 'NPV',
            showLegend: false,
            showTooltip: true,
          },
        });
      }
    }

    return sections;
  }

  // -------------------------------------------------------------------------
  // Persistence
  // -------------------------------------------------------------------------

  /**
   * Persist an append-only financial model snapshot for the case.
   * Uses the best-performing model's ROI/NPV as the top-level summary fields.
   */
  private async persistSnapshot(
    caseId: string,
    organizationId: string,
    models: ComputedModel[],
    llmOutput: FinancialModelingOutput,
  ): Promise<void> {
    // Pick the model with the highest NPV as the representative summary
    const best = models.reduce((a, b) => (b.npv > a.npv ? b : a), models[0]);
    const avgPayback = models
      .map(m => m.payback_period)
      .filter((p): p is number => p !== null)
      .reduce((sum, p, _, arr) => sum + p / arr.length, 0) || null;

    try {
      const repo = new FinancialModelSnapshotRepository();
      await repo.createSnapshot({
        case_id: caseId,
        organization_id: organizationId,
        roi: best ? best.roi : undefined,
        npv: best ? best.npv : undefined,
        payback_period_months: avgPayback !== null ? Math.round(avgPayback * 12) : undefined,
        assumptions_json: llmOutput.key_assumptions,
        outputs_json: {
          models: models.map(m => ({
            hypothesis_id: m.hypothesis_id,
            roi: m.roi,
            npv: m.npv,
            irr: m.irr,
            payback_period: m.payback_period,
            confidence: m.confidence,
            category: m.category,
          })),
          portfolio_summary: llmOutput.portfolio_summary,
          total_npv: models.reduce((s, m) => s + m.npv, 0),
          average_confidence: models.reduce((s, m) => s + m.confidence, 0) / models.length,
        },
        source_agent: 'FinancialModelingAgent',
      });
      logger.info('FinancialModelingAgent: persisted snapshot', {
        case_id: caseId,
        organization_id: organizationId,
        model_count: models.length,
      });
    } catch (err) {
      // Non-fatal: memory store succeeded; log and continue.
      logger.error('FinancialModelingAgent: failed to persist snapshot', {
        case_id: caseId,
        error: (err as Error).message,
      });
    }
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  // ...existing code...
}
