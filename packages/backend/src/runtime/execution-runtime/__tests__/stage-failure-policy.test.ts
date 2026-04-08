import { describe, expect, it } from 'vitest';

import { classifyStageFailure, withRuntimeFailure } from '../stage-failure-policy.js';

describe('stage-failure-policy', () => {
  it('classifies policy/veto errors as policy-blocked', () => {
    const details = classifyStageFailure('Integrity veto triggered by policy guardrail');
    expect(details.class).toBe('policy-blocked');
    expect(details.machineReasonCode).toBe('POLICY_BLOCKED');
  });

  it('classifies missing data errors as data-missing', () => {
    const details = classifyStageFailure('Required artifact not found');
    expect(details.class).toBe('data-missing');
    expect(details.machineReasonCode).toBe('DATA_MISSING');
  });

  it('classifies timeout errors as dependency-unavailable', () => {
    const details = classifyStageFailure('Downstream service timeout');
    expect(details.class).toBe('dependency-unavailable');
    expect(details.machineReasonCode).toBe('DEPENDENCY_UNAVAILABLE');
  });

  it('attaches runtime failure into execution record io payload', () => {
    const details = classifyStageFailure('unexpected error');
    const updated = withRuntimeFailure({ id: 'exec-1', io: {} } as never, details);
    expect(updated.io).toMatchObject({ runtime_failure: details });
  });
});
