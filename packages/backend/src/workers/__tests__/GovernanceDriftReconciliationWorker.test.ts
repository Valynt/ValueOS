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
    const result = await worker.runGovernanceDriftReconciliationJob({ id: '1', attemptsMade: 0, data: { kind: 'evaluate', idempotencyKey: 'k1', context: ctx(), grantedPermissions: [], remediationMode: 'approval-gated' } });
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]?.escalatedForApproval).toBe(true);
  });

  it('multi-tenant sampling enqueues per-tenant contexts and tolerates partial failures', async () => {
    vi.resetModules();
    const queueAdd = vi.fn().mockResolvedValue(undefined);
    const membershipQuery = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), gt: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue({ data: [
      { tenant_id: 'tenant-a', user_id: 'user-a' },
      { tenant_id: 'tenant-b', user_id: 'user-b' },
    ], error: null }) };
    const rolesA = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() };
    rolesA.eq.mockReturnValueOnce(rolesA).mockReturnValueOnce(Promise.resolve({ data: [{ role: 'admin' }], error: null }));
    const rolesB = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() };
    rolesB.eq.mockReturnValueOnce(rolesB).mockReturnValueOnce(Promise.resolve({ data: null, error: { message: 'boom' } }));
    const perms = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() };
    perms.eq.mockReturnValueOnce(perms).mockReturnValue(Promise.resolve({ data: [], error: null }));
    const workflow = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue({ data: [{ workflow_id: 'wf-1', current_stage: 'review', action_name: 'proposal.publish' }], error: null }) };

    const supabase = { from: vi.fn((table: string) => {
      if (table === 'user_tenants') return membershipQuery;
      if (table === 'user_roles') return supabase.from.mock.calls.filter((c) => c[0] === 'user_roles').length === 1 ? rolesA : rolesB;
      if (table === 'user_permissions') return perms;
      if (table === 'workflow_executions') return workflow;
      throw new Error(table);
    }) };

    vi.doMock('../../lib/supabase/privileged/index.js', () => ({ createWorkerServiceSupabaseClient: vi.fn(() => supabase) }));
    vi.doMock('bullmq', () => ({ Queue: vi.fn(() => ({ add: queueAdd })), Worker: vi.fn() }));
    vi.doMock('ioredis', () => ({ default: vi.fn(() => ({ on: vi.fn(), quit: vi.fn() })) }));

    const module = await import('../GovernanceDriftReconciliationWorker.js');
    const enqueued = await module.produceGovernanceDriftReconciliationJobs({ cursor: 'tenant-0', batchSize: 5000 });
    expect(enqueued).toBe(1);
    const payload = queueAdd.mock.calls[0][1];
    expect(payload.context.actor.tenantId).toBe('tenant-a');
  });

  it('duplicate scheduling is idempotent via deterministic evaluate job id', async () => {
    vi.resetModules();
    const queueAdd = vi.fn().mockResolvedValue(undefined);
    const memberships = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), gt: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue({ data: [{ tenant_id: 'tenant-1', user_id: 'user-1' }], error: null }) };
    const roles = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() }; roles.eq.mockReturnValueOnce(roles).mockReturnValueOnce(Promise.resolve({ data: [], error: null }));
    const perms = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() }; perms.eq.mockReturnValueOnce(perms).mockReturnValueOnce(Promise.resolve({ data: [], error: null }));
    const workflows = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue({ data: [{ workflow_id: 'wf-1', current_stage: 'approve', action_name: 'proposal.publish' }], error: null }) };
    const supabase = { from: vi.fn((t: string) => t === 'user_tenants' ? memberships : t === 'user_roles' ? roles : t === 'user_permissions' ? perms : workflows) };
    vi.doMock('../../lib/supabase/privileged/index.js', () => ({ createWorkerServiceSupabaseClient: vi.fn(() => supabase) }));
    vi.doMock('bullmq', () => ({ Queue: vi.fn(() => ({ add: queueAdd })), Worker: vi.fn() }));
    vi.doMock('ioredis', () => ({ default: vi.fn(() => ({ on: vi.fn(), quit: vi.fn() })) }));
    const module = await import('../GovernanceDriftReconciliationWorker.js');
    await module.produceGovernanceDriftReconciliationJobs({ batchSize: 1 });
    await module.produceGovernanceDriftReconciliationJobs({ batchSize: 1 });
    const options = queueAdd.mock.calls[0][2];
    expect(options.jobId).toContain('gov-drift:tenant-1:user-1:proposal.publish:wf-1');
  });

  it('telemetry labels integrity: records carry tenant/action labels', async () => {
    const result = await worker.runGovernanceDriftReconciliationJob({
      id: 'eval-1', attemptsMade: 0, data: { kind: 'evaluate', idempotencyKey: 'ik', context: ctx({ actor: { userId: 'u2', tenantId: 'tenant-z', roles: ['member'] }, action: { type: 'proposal.publish', name: 'proposal.publish' } }), grantedPermissions: [], remediationMode: 'approval-gated' },
    });
    expect(result.every((r) => r.tenantId === 'tenant-z' && r.actionName === 'proposal.publish')).toBe(true);
  });
});
