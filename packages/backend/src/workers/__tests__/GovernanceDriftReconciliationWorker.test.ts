import { describe, expect, it } from 'vitest';

import { runGovernanceDriftReconciliationJob } from '../GovernanceDriftReconciliationWorker.js';
import type { GovernanceContext } from '../../lib/rules.js';

function ctx(overrides: Partial<GovernanceContext> = {}): GovernanceContext {
  return {
    actor: { userId: 'u1', tenantId: 't1', roles: ['member'] },
    action: { type: 'value_trees:edit', name: 'value_trees:edit', payload: { reason: 'ok' } },
    environment: { stage: 'dev', nowIso: new Date().toISOString() },
    ...overrides,
  };
}

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
