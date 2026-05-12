import { beforeEach, describe, expect, it, vi } from 'vitest';

const incCalls: Array<{ name: string; labels: Record<string, string> }> = [];
const mockCounterFactory = vi.fn((name: string) => ({
  inc: (labels: Record<string, string>) => {
    incCalls.push({ name, labels });
  },
}));

const mockLoggerWarn = vi.fn();
const mockLoggerError = vi.fn();

const mockFrom = vi.fn();
const mockCronClient = { from: mockFrom };

const mockQueueAdd = vi.fn().mockResolvedValue(undefined);
vi.mock('bullmq', () => ({ Queue: vi.fn(() => ({ add: mockQueueAdd })), Worker: vi.fn() }));
vi.mock('ioredis', () => ({ default: vi.fn(() => ({})) }));

vi.mock('../../lib/observability/index.js', () => ({ createCounter: mockCounterFactory }));
vi.mock('../../lib/logger.js', () => ({ logger: { warn: mockLoggerWarn, error: mockLoggerError, info: vi.fn() }, createLogger: () => ({ warn: mockLoggerWarn, error: mockLoggerError, info: vi.fn() }) }));
vi.mock('../../lib/supabase/privileged/index.js', () => ({ createCronSupabaseClient: vi.fn(() => mockCronClient) }));

function chain(result: unknown) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    range: vi.fn().mockResolvedValue(result),
  };
}

describe('GovernanceDriftReconciliationWorker', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    incCalls.length = 0;

    mockFrom.mockImplementation((table: string) => {
      if (table === 'tenants') return chain({ data: [{ id: 't1' }, { id: 't2' }], error: null });
      if (table === 'workflows') return chain({ data: [{ organization_id: 't1', id: 'w1', current_step: 'value_trees:edit' }, { organization_id: 't2', id: 'w2', current_step: 'proposal.publish' }], error: null });
      if (table === 'user_tenants') return chain({ data: [{ tenant_id: 't1', user_id: 'u1' }, { tenant_id: 't2', user_id: 'u2' }], error: null });
      return chain({ data: [], error: null });
    });
  });

  it('supports multi-tenant sampling in scan mode', async () => {
    const { runGovernanceDriftReconciliationJob } = await import('../GovernanceDriftReconciliationWorker.js');
    const result = await runGovernanceDriftReconciliationJob({ id: 'scan-1', data: { mode: 'scan', remediationMode: 'approval-gated', batchSize: 10, cursor: { tenantOffset: 0, workflowOffset: 0 } } });
    expect(result.length).toBeGreaterThan(0);
    expect(result.map((r) => r.tenantId)).toEqual(expect.arrayContaining(['t1', 't2']));
  });

  it('isolates partial backend/data failures per sample', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'tenants') return chain({ data: [{ id: 't1' }], error: null });
      if (table === 'workflows') return chain({ data: [{ organization_id: 't1', id: 'w1', current_step: 'x' }], error: null });
      if (table === 'user_tenants') return chain({ data: [], error: null });
      return chain({ data: [], error: null });
    });

    const { runGovernanceDriftReconciliationJob } = await import('../GovernanceDriftReconciliationWorker.js');
    const result = await runGovernanceDriftReconciliationJob({ id: 'scan-2', data: { mode: 'scan', remediationMode: 'auto-safe', batchSize: 5 } });
    expect(result).toBeDefined();
    expect(mockLoggerError).not.toHaveBeenCalled();
  });

  it('schedules idempotent repeatable reconciliation job id', async () => {
    const { scheduleGovernanceDriftReconciliationJob } = await import('../GovernanceDriftReconciliationWorker.js');
    await scheduleGovernanceDriftReconciliationJob();
    await scheduleGovernanceDriftReconciliationJob();

    expect(mockQueueAdd).toHaveBeenCalledTimes(2);
    expect(mockQueueAdd.mock.calls[0]?.[2]).toEqual(expect.objectContaining({ jobId: 'governance-drift-reconciliation-repeatable' }));
  });

  it('preserves telemetry label integrity for per-tenant/per-action metrics', async () => {
    const { runGovernanceDriftReconciliationJob } = await import('../GovernanceDriftReconciliationWorker.js');
    await runGovernanceDriftReconciliationJob({
      id: 'explicit-1',
      data: {
        mode: 'explicit-context',
        context: {
          actor: { userId: 'u1', tenantId: 'tenant-A', roles: ['member'] },
          action: { type: 'value_trees:edit', name: 'value_trees:edit' },
          environment: { stage: 'dev', nowIso: new Date().toISOString() },
        },
        grantedPermissions: [],
        remediationMode: 'approval-gated',
      },
    });

    const sampledLabels = incCalls.find((c) => c.name === 'governance_drift_reconciliation_sampled_total')?.labels;
    expect(sampledLabels).toMatchObject({ tenant_id: 'tenant-A', action_name: 'value_trees:edit' });
    expect(incCalls.some((c) => c.name === 'governance_drift_reconciliation_detected_total')).toBe(true);
  });
});
