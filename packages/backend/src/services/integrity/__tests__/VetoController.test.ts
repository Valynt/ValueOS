import { describe, expect, it } from 'vitest';

import { vetoController } from '../VetoController.js';

describe('VetoController', () => {
  it('rejects churn below zero', () => {
    const result = vetoController.evaluate({
      proposedPayload: { churn: -1 },
    });

    expect(result.vetoed).toBe(true);
    expect(result.reasonCodes).toContain('churn_below_zero');
  });

  it('rejects IRR above 500 unless stage flag allows exception', () => {
    const rejected = vetoController.evaluate({
      proposedPayload: { irr: 700 },
    });
    expect(rejected.vetoed).toBe(true);
    expect(rejected.reasonCodes).toContain('irr_above_stage_limit');

    const allowed = vetoController.evaluate({
      proposedPayload: { irr: 700 },
      stageFlags: { allowHighIrrException: true },
    });

    expect(allowed.vetoed).toBe(false);
    expect(allowed.overrideUsed).toBe(true);
  });

  it('requires justification when NPV deviation exceeds 20%', () => {
    const result = vetoController.evaluate({
      proposedPayload: { npv: 140, prior_session_npv: 100 },
      justificationText: '',
    });

    expect(result.vetoed).toBe(true);
    expect(result.reasonCodes).toContain('npv_deviation_requires_justification');

    const justified = vetoController.evaluate({
      proposedPayload: { npv: 140, prior_session_npv: 100 },
      justificationText: 'Adjusted with contract expansion evidence',
    });

    expect(justified.vetoed).toBe(false);
  });
});
