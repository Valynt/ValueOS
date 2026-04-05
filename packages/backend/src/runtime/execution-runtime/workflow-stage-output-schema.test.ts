import { describe, expect, it } from 'vitest';

import type { WorkflowStage } from '../../types/workflow.js';
import { validateStageOutputSchema } from './workflow-stage-output-schema.js';

const baseStage: WorkflowStage = {
  id: 'stage-id',
  name: 'Stage',
  agent_type: 'financial-modeling',
  timeout_seconds: 60,
};

describe('workflow-stage-output-schema seam', () => {
  it('passes non-scenario stages without schema validation', () => {
    expect(validateStageOutputSchema(baseStage, { any: 'shape' })).toEqual({ valid: true });
  });

  it('validates scenario_building stage payload shape', () => {
    const stage: WorkflowStage = { ...baseStage, id: 'scenario_building' };
    const makeScenario = (scenarioType: 'conservative' | 'base' | 'upside') => ({
      id: '00000000-0000-0000-0000-000000000001',
      organization_id: '00000000-0000-0000-0000-000000000002',
      case_id: '00000000-0000-0000-0000-000000000003',
      scenario_type: scenarioType,
      assumptions_snapshot_json: {},
      roi: null,
      npv: null,
      payback_months: null,
      evf_decomposition_json: {
        revenue_uplift: 1,
        cost_reduction: 1,
        risk_mitigation: 1,
        efficiency_gain: 1,
      },
      sensitivity_results_json: [],
      cost_input_usd: null,
      timeline_years: null,
      investment_source: null,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    });

    const validOutput = {
      conservative: makeScenario('conservative'),
      base: makeScenario('base'),
      upside: makeScenario('upside'),
    };

    expect(validateStageOutputSchema(stage, validOutput)).toEqual({ valid: true });
  });

  it('returns schema issue details for invalid scenario payloads', () => {
    const stage: WorkflowStage = { ...baseStage, id: 'scenario_building' };
    const result = validateStageOutputSchema(stage, { conservative: {}, base: {}, upside: {} });

    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.schemaName).toBe('ScenarioBuildOutputSchema');
    expect(result.issues.length).toBeGreaterThan(0);
  });
});
