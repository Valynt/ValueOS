import { describe, expect, it, vi } from 'vitest';

import * as worker from '../GovernanceDriftReconciliationWorker.js';
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
    const result = await worker.runGovernanceDriftReconciliationJob({
      id: '1',
      attemptsMade: 0,
      data: {
        kind: 'evaluate',
        idempotencyKey: 'k1',
        context: ctx(),
        grantedPermissions: [],
        remediationMode: 'approval-gated',
      },
    });
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]?.escalatedForApproval).toBe(true);
  });

  it('no-ops when context is clean', async () => {
    const result = await worker.runGovernanceDriftReconciliationJob({
      id: '2',
      attemptsMade: 0,
      data: { kind: 'evaluate', idempotencyKey: 'k2', context: ctx(), grantedPermissions: ['value_trees:edit'], remediationMode: 'approval-gated' },
    });
    expect(result).toEqual([]);
  });

  it('auto-remediates safe drift in auto-safe mode', async () => {
    const result = await worker.runGovernanceDriftReconciliationJob({
      id: '3',
      attemptsMade: 0,
      data: {
        kind: 'evaluate',
        idempotencyKey: 'k3',
        context: ctx(),
        grantedPermissions: [],
        remediationMode: 'auto-safe',
      },
    });
    expect(result[0]?.remediated).toBe(true);
  });

  it('escalates unresolved high-risk drift path', async () => {
    const result = await worker.runGovernanceDriftReconciliationJob({
      id: '4',
      attemptsMade: 0,
      data: {
        kind: 'evaluate',
        idempotencyKey: 'k4',
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

  it('isolates tenant evaluation contexts with no cross-tenant bleed', async () => {
    const tenantA = await worker.runGovernanceDriftReconciliationJob({
      id: '5',
      attemptsMade: 0,
      data: { kind: 'evaluate', idempotencyKey: 'k5', context: ctx({ actor: { userId: 'ua', tenantId: 'tenant-a', roles: ['member'] } }), grantedPermissions: [], remediationMode: 'approval-gated' },
    });
    const tenantB = await worker.runGovernanceDriftReconciliationJob({
      id: '6',
      attemptsMade: 0,
      data: { kind: 'evaluate', idempotencyKey: 'k6', context: ctx({ actor: { userId: 'ub', tenantId: 'tenant-b', roles: ['member'] } }), grantedPermissions: ['value_trees:edit'], remediationMode: 'approval-gated' },
    });

    expect(tenantA.every((record) => record.tenantId === 'tenant-a')).toBe(true);
    expect(tenantB).toEqual([]);
  });

  it('runs producer mode and enqueues per tenant/workflow context', async () => {
    const spy = vi.spyOn(worker, 'produceGovernanceDriftReconciliationJobs').mockResolvedValue(3);
    const result = await worker.runGovernanceDriftReconciliationJob({ id: '7', attemptsMade: 0, data: { kind: 'produce' } });
    expect(spy).toHaveBeenCalledOnce();
    expect(result).toEqual([]);
    spy.mockRestore();
  });
});
