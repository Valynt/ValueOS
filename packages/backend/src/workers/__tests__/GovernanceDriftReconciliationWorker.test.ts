import { afterEach, describe, expect, it } from 'vitest';

import { getGovernanceDriftReconciliationIntervalMinutes, runGovernanceDriftReconciliationJob } from '../GovernanceDriftReconciliationWorker.js';
import type { GovernanceContext } from '../../lib/rules.js';

function ctx(overrides: Partial<GovernanceContext> = {}): GovernanceContext {
  return {
    actor: { userId: 'u1', tenantId: 't1', roles: ['member'] },
    action: { type: 'value_trees:edit', name: 'value_trees:edit', payload: { reason: 'ok' } },
    environment: { stage: 'dev', nowIso: new Date().toISOString() },
    ...overrides,
  };
}



describe('getGovernanceDriftReconciliationIntervalMinutes', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalInterval = process.env.GOVERNANCE_DRIFT_RECONCILIATION_INTERVAL_MINUTES;

  afterEach(() => {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;

    if (originalInterval === undefined) delete process.env.GOVERNANCE_DRIFT_RECONCILIATION_INTERVAL_MINUTES;
    else process.env.GOVERNANCE_DRIFT_RECONCILIATION_INTERVAL_MINUTES = originalInterval;
  });

  it('returns the configured interval when valid', () => {
    process.env.NODE_ENV = 'development';
    process.env.GOVERNANCE_DRIFT_RECONCILIATION_INTERVAL_MINUTES = '30';

    expect(getGovernanceDriftReconciliationIntervalMinutes()).toBe(30);
  });

  it('falls back in non-production when interval is an invalid string', () => {
    process.env.NODE_ENV = 'test';
    process.env.GOVERNANCE_DRIFT_RECONCILIATION_INTERVAL_MINUTES = 'abc';

    expect(getGovernanceDriftReconciliationIntervalMinutes()).toBe(15);
  });

  it('falls back in non-production when interval is zero or negative', () => {
    process.env.NODE_ENV = 'development';
    process.env.GOVERNANCE_DRIFT_RECONCILIATION_INTERVAL_MINUTES = '0';
    expect(getGovernanceDriftReconciliationIntervalMinutes()).toBe(15);

    process.env.GOVERNANCE_DRIFT_RECONCILIATION_INTERVAL_MINUTES = '-10';
    expect(getGovernanceDriftReconciliationIntervalMinutes()).toBe(15);
  });

  it('fails fast in production when interval is invalid', () => {
    process.env.NODE_ENV = 'production';
    process.env.GOVERNANCE_DRIFT_RECONCILIATION_INTERVAL_MINUTES = 'not-a-number';

    expect(() => getGovernanceDriftReconciliationIntervalMinutes()).toThrowError(/Invalid GOVERNANCE_DRIFT_RECONCILIATION_INTERVAL_MINUTES/);
  });

  it('uses fallback behavior in non-production for out-of-bounds values', () => {
    process.env.NODE_ENV = 'development';
    process.env.GOVERNANCE_DRIFT_RECONCILIATION_INTERVAL_MINUTES = '2000';

    expect(getGovernanceDriftReconciliationIntervalMinutes()).toBe(15);
  });
});

describe('GovernanceDriftReconciliationWorker', () => {
  it('detects drift and emits unresolved records in approval-gated mode', async () => {
    const result = await runGovernanceDriftReconciliationJob({
      id: '1',
      data: {
        context: ctx(),
        grantedPermissions: [],
        remediationMode: 'approval-gated',
      },
    });
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]?.escalatedForApproval).toBe(true);
  });

  it('no-ops when context is clean', async () => {
    const result = await runGovernanceDriftReconciliationJob({
      id: '2',
      data: { context: ctx(), grantedPermissions: ['value_trees:edit'], remediationMode: 'approval-gated' },
    });
    expect(result).toEqual([]);
  });

  it('auto-remediates safe drift in auto-safe mode', async () => {
    const result = await runGovernanceDriftReconciliationJob({
      id: '3',
      data: {
        context: ctx(),
        grantedPermissions: [],
        remediationMode: 'auto-safe',
      },
    });
    expect(result[0]?.remediated).toBe(true);
  });

  it('escalates unresolved high-risk drift path', async () => {
    const result = await runGovernanceDriftReconciliationJob({
      id: '4',
      data: {
        context: ctx({
          environment: { stage: 'prod', nowIso: new Date().toISOString() },
          action: { type: 'proposal.publish', name: 'proposal.publish', payload: {} },
          workflow: { workflowId: undefined, approvals: [] },
        }),
        grantedPermissions: ['proposal.publish'],
        remediationMode: 'auto-safe',
      },
    });
    expect(result.some((r) => r.escalatedForApproval)).toBe(true);
  });
});
