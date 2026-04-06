/**
 * GenerateROIModel — Application Use Case
 *
 * Orchestrates the generation of a three-scenario ROI model (conservative, base, upside)
 * for a value case. Extracts orchestration previously scattered across routes and services.
 *
 * Responsibilities:
 *   1. Validate input
 *   2. Fetch accepted hypotheses and assumptions for the case
 *   3. Invoke ScenarioBuilder (domain service) to compute financial scenarios
 *   4. Persist scenarios and emit audit log
 *   5. Return the scenario set
 *
 * Routes call this use case; they do NOT directly call ScenarioBuilder.
 */

import { z } from 'zod';
import { createLogger } from '../../lib/logger.js';
import { auditLogService } from '../../services/security/AuditLogService.js';
import type { UseCase, RequestContext, UseCaseResult } from '../types.js';

const logger = createLogger({ component: 'GenerateROIModel' });

// ============================================================================
// Input / Output schemas
// ============================================================================

export const GenerateROIModelInputSchema = z.object({
  valueCaseId: z.string().uuid(),
  /** Explicit implementation cost in USD. Wins over assumptions register. */
  estimatedCostUsd: z.number().positive().optional(),
  /** Benefit realization horizon in years. Defaults to assumptions register or 3. */
  timelineYears: z.number().int().min(1).max(30).optional(),
  /** WACC / discount rate as decimal (e.g. 0.10 = 10%). Defaults to 0.10. */
  discountRate: z.number().min(0).max(1).optional(),
  /** Force rebuild even if a cached result exists. */
  forceRebuild: z.boolean().optional(),
});

export type GenerateROIModelInput = z.infer<typeof GenerateROIModelInputSchema>;

export interface ScenarioOutput {
  id: string;
  scenarioType: 'conservative' | 'base' | 'upside';
  roi: number | null;
  npv: number | null;
  paybackMonths: number | null;
  costInputUsd: number | null;
  timelineYears: number | null;
  investmentSource: 'explicit' | 'assumptions_register' | 'default' | null;
  evfDecomposition: {
    revenueUplift: number;
    costReduction: number;
    riskMitigation: number;
    efficiencyGain: number;
  };
}

export interface ROIModelResult {
  conservative: ScenarioOutput;
  base: ScenarioOutput;
  upside: ScenarioOutput;
  valueCaseId: string;
}

// ============================================================================
// Domain service port — injected, not imported directly
// ============================================================================

export interface Hypothesis {
  id: string;
  value_driver: string;
  estimated_impact_min: number;
  estimated_impact_max: number;
  confidence_score: number;
}

export interface Assumption {
  id: string;
  name: string;
  value: number;
  source_type: string;
}

export interface ScenarioBuilderPort {
  buildScenarios(input: {
    organizationId: string;
    caseId: string;
    acceptedHypotheses: Hypothesis[];
    assumptions: Assumption[];
    estimatedCostUsd?: number;
    timelineYears?: number;
    discountRate?: number;
    forceRebuild?: boolean;
  }): Promise<{
    conservative: { id: string; scenario_type: string; roi: number | null; npv: number | null; payback_months: number | null; cost_input_usd: number | null; timeline_years: number | null; investment_source: string | null; evf_decomposition_json: { revenue_uplift: number; cost_reduction: number; risk_mitigation: number; efficiency_gain: number } };
    base: { id: string; scenario_type: string; roi: number | null; npv: number | null; payback_months: number | null; cost_input_usd: number | null; timeline_years: number | null; investment_source: string | null; evf_decomposition_json: { revenue_uplift: number; cost_reduction: number; risk_mitigation: number; efficiency_gain: number } };
    upside: { id: string; scenario_type: string; roi: number | null; npv: number | null; payback_months: number | null; cost_input_usd: number | null; timeline_years: number | null; investment_source: string | null; evf_decomposition_json: { revenue_uplift: number; cost_reduction: number; risk_mitigation: number; efficiency_gain: number } };
  }>;
}

export interface HypothesisRepository {
  listAccepted(organizationId: string, valueCaseId: string): Promise<Hypothesis[]>;
}

export interface AssumptionRepository {
  list(organizationId: string, valueCaseId: string): Promise<Assumption[]>;
}

// ============================================================================
// Use Case Implementation
// ============================================================================

export class GenerateROIModel
  implements UseCase<GenerateROIModelInput, UseCaseResult<ROIModelResult>>
{
  constructor(
    private readonly scenarioBuilder: ScenarioBuilderPort,
    private readonly hypothesisRepository: HypothesisRepository,
    private readonly assumptionRepository: AssumptionRepository
  ) {}

  async execute(
    input: GenerateROIModelInput,
    context: RequestContext
  ): Promise<UseCaseResult<ROIModelResult>> {
    const startMs = Date.now();

    logger.info('GenerateROIModel: executing', {
      valueCaseId: input.valueCaseId,
      organizationId: context.organizationId,
      traceId: context.traceId,
    });

    // Validate input
    const parsed = GenerateROIModelInputSchema.safeParse(input);
    if (!parsed.success) {
      throw Object.assign(new Error('Invalid GenerateROIModel input'), {
        code: 'VALIDATION_ERROR',
        details: parsed.error.flatten(),
      });
    }

    // Fetch domain data
    const [hypotheses, assumptions] = await Promise.all([
      this.hypothesisRepository.listAccepted(context.organizationId, parsed.data.valueCaseId),
      this.assumptionRepository.list(context.organizationId, parsed.data.valueCaseId),
    ]);

    if (hypotheses.length === 0) {
      throw Object.assign(new Error('No accepted hypotheses found for this value case'), {
        code: 'UNPROCESSABLE_ENTITY',
        details: { valueCaseId: parsed.data.valueCaseId },
      });
    }

    // Invoke domain service — no hardcoded values, all dynamic
    const scenarios = await this.scenarioBuilder.buildScenarios({
      organizationId: context.organizationId,
      caseId: parsed.data.valueCaseId,
      acceptedHypotheses: hypotheses,
      assumptions,
      estimatedCostUsd: parsed.data.estimatedCostUsd,
      timelineYears: parsed.data.timelineYears,
      discountRate: parsed.data.discountRate,
      forceRebuild: parsed.data.forceRebuild,
    });

    // Map to output shape
    const mapScenario = (s: typeof scenarios.conservative): ScenarioOutput => ({
      id: s.id,
      scenarioType: s.scenario_type as ScenarioOutput['scenarioType'],
      roi: s.roi,
      npv: s.npv,
      paybackMonths: s.payback_months,
      costInputUsd: s.cost_input_usd,
      timelineYears: s.timeline_years,
      investmentSource: s.investment_source as ScenarioOutput['investmentSource'],
      evfDecomposition: {
        revenueUplift: s.evf_decomposition_json.revenue_uplift,
        costReduction: s.evf_decomposition_json.cost_reduction,
        riskMitigation: s.evf_decomposition_json.risk_mitigation,
        efficiencyGain: s.evf_decomposition_json.efficiency_gain,
      },
    });

    const result: ROIModelResult = {
      conservative: mapScenario(scenarios.conservative),
      base: mapScenario(scenarios.base),
      upside: mapScenario(scenarios.upside),
      valueCaseId: parsed.data.valueCaseId,
    };

    // Emit audit log
    await auditLogService.logAudit({
      action: 'roi_model.generated',
      actorId: context.userId,
      tenantId: context.organizationId,
      resourceType: 'value_case',
      resourceId: parsed.data.valueCaseId,
      metadata: {
        baseRoi: result.base.roi,
        investmentSource: result.base.investmentSource,
        hypothesesCount: hypotheses.length,
        traceId: context.traceId,
      },
    }).catch((err) => {
      logger.error('GenerateROIModel: audit log failed', { err, traceId: context.traceId });
    });

    const durationMs = Date.now() - startMs;
    logger.info('GenerateROIModel: complete', {
      valueCaseId: parsed.data.valueCaseId,
      baseRoi: result.base.roi,
      durationMs,
      traceId: context.traceId,
    });

    return {
      data: result,
      meta: { traceId: context.traceId, durationMs },
    };
  }
}
