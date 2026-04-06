/**
 * GenerateROIModel — Unit Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GenerateROIModel } from '../GenerateROIModel.js';
import type {
  ScenarioBuilderPort,
  HypothesisRepository,
  AssumptionRepository,
  Hypothesis,
  Assumption,
} from '../GenerateROIModel.js';
import type { RequestContext } from '../../types.js';

const mockContext: RequestContext = {
  organizationId: 'org-123e4567-e89b-12d3-a456-426614174000',
  userId: 'user-abc',
  roles: ['member'],
  traceId: 'trace-roi',
  correlationId: 'corr-roi',
  planTier: 'enterprise',
};

const CASE_ID = '123e4567-e89b-12d3-a456-426614174001';

const mockHypotheses: Hypothesis[] = [
  {
    id: 'hyp-1',
    value_driver: 'cost_reduction',
    estimated_impact_min: 50000,
    estimated_impact_max: 150000,
    confidence_score: 0.8,
  },
];

const mockAssumptions: Assumption[] = [
  { id: 'asmp-1', name: 'implementation_cost', value: 100000, source_type: 'crm-derived' },
  { id: 'asmp-2', name: 'timeline_years', value: 3, source_type: 'analyst' },
];

const mockScenario = {
  id: 'scen-1',
  scenario_type: 'base' as const,
  roi: 0.5,
  npv: 75000,
  payback_months: 24,
  cost_input_usd: 100000,
  timeline_years: 3,
  investment_source: 'assumptions_register' as const,
  evf_decomposition_json: {
    revenue_uplift: 0,
    cost_reduction: 100000,
    risk_mitigation: 0,
    efficiency_gain: 0,
  },
};

function makeMocks() {
  const scenarioBuilder: ScenarioBuilderPort = {
    buildScenarios: vi.fn().mockResolvedValue({
      conservative: { ...mockScenario, id: 'scen-c', scenario_type: 'conservative' },
      base: { ...mockScenario, id: 'scen-b', scenario_type: 'base' },
      upside: { ...mockScenario, id: 'scen-u', scenario_type: 'upside' },
    }),
  };
  const hypothesisRepo: HypothesisRepository = {
    listAccepted: vi.fn().mockResolvedValue(mockHypotheses),
  };
  const assumptionRepo: AssumptionRepository = {
    list: vi.fn().mockResolvedValue(mockAssumptions),
  };
  return { scenarioBuilder, hypothesisRepo, assumptionRepo };
}

describe('GenerateROIModel', () => {
  it('returns three scenarios with correct structure', async () => {
    const { scenarioBuilder, hypothesisRepo, assumptionRepo } = makeMocks();
    const useCase = new GenerateROIModel(scenarioBuilder, hypothesisRepo, assumptionRepo);

    const result = await useCase.execute({ valueCaseId: CASE_ID }, mockContext);

    expect(result.data.valueCaseId).toBe(CASE_ID);
    expect(result.data.conservative.scenarioType).toBe('conservative');
    expect(result.data.base.scenarioType).toBe('base');
    expect(result.data.upside.scenarioType).toBe('upside');
  });

  it('passes explicit cost to ScenarioBuilder when provided', async () => {
    const { scenarioBuilder, hypothesisRepo, assumptionRepo } = makeMocks();
    const useCase = new GenerateROIModel(scenarioBuilder, hypothesisRepo, assumptionRepo);

    await useCase.execute({ valueCaseId: CASE_ID, estimatedCostUsd: 200000 }, mockContext);

    expect(scenarioBuilder.buildScenarios).toHaveBeenCalledWith(
      expect.objectContaining({ estimatedCostUsd: 200000 })
    );
  });

  it('throws UNPROCESSABLE_ENTITY when no accepted hypotheses exist', async () => {
    const { scenarioBuilder, assumptionRepo } = makeMocks();
    const emptyHypothesisRepo: HypothesisRepository = {
      listAccepted: vi.fn().mockResolvedValue([]),
    };
    const useCase = new GenerateROIModel(scenarioBuilder, emptyHypothesisRepo, assumptionRepo);

    await expect(
      useCase.execute({ valueCaseId: CASE_ID }, mockContext)
    ).rejects.toMatchObject({ code: 'UNPROCESSABLE_ENTITY' });
  });

  it('throws VALIDATION_ERROR for invalid valueCaseId', async () => {
    const { scenarioBuilder, hypothesisRepo, assumptionRepo } = makeMocks();
    const useCase = new GenerateROIModel(scenarioBuilder, hypothesisRepo, assumptionRepo);

    await expect(
      useCase.execute({ valueCaseId: 'not-a-uuid' }, mockContext)
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('maps evfDecomposition to camelCase output', async () => {
    const { scenarioBuilder, hypothesisRepo, assumptionRepo } = makeMocks();
    const useCase = new GenerateROIModel(scenarioBuilder, hypothesisRepo, assumptionRepo);

    const result = await useCase.execute({ valueCaseId: CASE_ID }, mockContext);

    expect(result.data.base.evfDecomposition).toMatchObject({
      revenueUplift: expect.any(Number),
      costReduction: expect.any(Number),
      riskMitigation: expect.any(Number),
      efficiencyGain: expect.any(Number),
    });
  });
});
