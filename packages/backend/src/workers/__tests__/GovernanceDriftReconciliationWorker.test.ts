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

  it('producer includes actor roles so scheduled evaluator jobs can detect ROLE_PERMISSION_STALENESS', async () => {
    vi.resetModules();
    const queueAdd = vi.fn().mockResolvedValue(undefined);

    const membershipsQuery = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue({ data: [{ tenant_id: 'tenant-1', user_id: 'user-1' }], error: null }) };
    const userRolesQuery = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() };
    userRolesQuery.eq.mockReturnValueOnce(userRolesQuery).mockReturnValueOnce(Promise.resolve({ data: [{ role: 'admin' }], error: null }));
    const userPermsQuery = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() };
    userPermsQuery.eq.mockReturnValueOnce(userPermsQuery).mockReturnValueOnce(Promise.resolve({ data: [], error: null }));
    const workflowQuery = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue({ data: [{ workflow_id: 'wf-1', current_stage: 'review' }], error: null }) };

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'user_tenants') return membershipsQuery;
        if (table === 'user_roles') return userRolesQuery;
        if (table === 'user_permissions') return userPermsQuery;
        if (table === 'workflow_executions') return workflowQuery;
        throw new Error(`Unexpected table ${table}`);
      }),
    };

    vi.doMock('../../lib/supabase/privileged/index.js', () => ({ createWorkerServiceSupabaseClient: vi.fn(() => supabase) }));
    vi.doMock('bullmq', () => ({ Queue: vi.fn(() => ({ add: queueAdd })), Worker: vi.fn() }));
    vi.doMock('ioredis', () => ({ default: vi.fn(() => ({ on: vi.fn(), quit: vi.fn() })) }));

    const module = await import('../GovernanceDriftReconciliationWorker.js');
    await module.produceGovernanceDriftReconciliationJobs(1);

    const evaluateJobPayload = queueAdd.mock.calls.find((call) => call[0] === 'evaluate-governance-drift')?.[1];
    expect(evaluateJobPayload?.context.actor.roles).toEqual(['admin']);

    const result = await module.runGovernanceDriftReconciliationJob({
      id: 'scheduled-job-1',
      attemptsMade: 0,
      data: {
        kind: 'evaluate',
        idempotencyKey: 'scheduled-k1',
        context: evaluateJobPayload.context,
        grantedPermissions: [],
        remediationMode: 'approval-gated',
      },
    });

    expect(result.some((record) => record.driftType === 'ROLE_PERMISSION_STALENESS')).toBe(true);
  });
});

describe('producer failure hardening', () => {
  it('query error triggers failure path with structured tenant/user context', async () => {
    vi.resetModules();
    const from = vi.fn((table: string) => {
      if (table === 'user_tenants') {
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue({ data: [{ tenant_id: 'tenant-1', user_id: 'user-1' }], error: null }) };
      }
      if (table === 'user_roles') {
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), then: undefined, limit: undefined } as never;
      }
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() } as never;
    });
    const userRolesQuery = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() };
    userRolesQuery.eq.mockReturnValueOnce(userRolesQuery).mockReturnValueOnce(Promise.resolve({ data: null, error: { message: 'roles exploded' } }));
    const userPermsQuery = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() };
    userPermsQuery.eq.mockReturnValueOnce(userPermsQuery).mockReturnValueOnce(Promise.resolve({ data: [], error: null }));
    const supabase = { from: vi.fn((table: string) => table === 'user_tenants' ? { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue({ data: [{ tenant_id: 'tenant-1', user_id: 'user-1' }], error: null }) } : table === 'user_roles' ? userRolesQuery : userPermsQuery) };

    vi.doMock('../../lib/supabase/privileged/index.js', () => ({ createWorkerServiceSupabaseClient: vi.fn(() => supabase) }));
    vi.doMock('bullmq', () => ({ Queue: vi.fn(() => ({ add: vi.fn() })), Worker: vi.fn() }));
    vi.doMock('ioredis', () => ({ default: vi.fn(() => ({ on: vi.fn(), quit: vi.fn() })) }));

    const module = await import('../GovernanceDriftReconciliationWorker.js');
    await expect(module.produceGovernanceDriftReconciliationJobs(1)).rejects.toThrow('tenant=tenant-1 user=user-1');
  });

  it.each([
    ['approval-gated' as const],
    ['auto-safe' as const],
  ])('producer enqueues evaluate jobs with remediation mode %s', async (mode) => {
    vi.resetModules();
    process.env.GOVERNANCE_DRIFT_RECONCILIATION_MODE = mode;

    const queueAdd = vi.fn().mockResolvedValue(undefined);
    const userTenantsQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [{ tenant_id: 'tenant-1', user_id: 'user-1' }], error: null }),
    };
    const userRolesQuery = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() };
    userRolesQuery.eq.mockReturnValueOnce(userRolesQuery).mockReturnValueOnce(Promise.resolve({ data: [], error: null }));
    const userPermsQuery = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() };
    userPermsQuery.eq.mockReturnValueOnce(userPermsQuery).mockReturnValueOnce(Promise.resolve({ data: [], error: null }));
    const workflowExecutionsQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [{ workflow_id: 'wf-1', current_stage: 'approve' }], error: null }),
    };

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'user_tenants') return userTenantsQuery;
        if (table === 'user_roles') return userRolesQuery;
        if (table === 'user_permissions') return userPermsQuery;
        if (table === 'workflow_executions') return workflowExecutionsQuery;
        throw new Error(`unexpected table ${table}`);
      }),
    };

    vi.doMock('../../lib/supabase/privileged/index.js', () => ({ createWorkerServiceSupabaseClient: vi.fn(() => supabase) }));
    vi.doMock('bullmq', () => ({ Queue: vi.fn(() => ({ add: queueAdd })), Worker: vi.fn() }));
    vi.doMock('ioredis', () => ({ default: vi.fn(() => ({ on: vi.fn(), quit: vi.fn() })) }));

    const module = await import('../GovernanceDriftReconciliationWorker.js');
    await module.produceGovernanceDriftReconciliationJobs(1);
    expect(queueAdd).toHaveBeenCalledWith(
      'evaluate-governance-drift',
      expect.objectContaining({ remediationMode: mode }),
      expect.any(Object),
    );
  });

  it('producer fails fast on invalid remediation mode env var', async () => {
    vi.resetModules();
    process.env.GOVERNANCE_DRIFT_RECONCILIATION_MODE = 'unsafe-mode';

    vi.doMock('../../lib/supabase/privileged/index.js', () => ({ createWorkerServiceSupabaseClient: vi.fn() }));
    vi.doMock('bullmq', () => ({ Queue: vi.fn(() => ({ add: vi.fn() })), Worker: vi.fn() }));
    vi.doMock('ioredis', () => ({ default: vi.fn(() => ({ on: vi.fn(), quit: vi.fn() })) }));

    const module = await import('../GovernanceDriftReconciliationWorker.js');
    await expect(module.produceGovernanceDriftReconciliationJobs(1)).rejects.toThrow(
      'GOVERNANCE_DRIFT_RECONCILIATION_MODE must be one of auto-safe|approval-gated; received unsafe-mode',
    );
  });
});
