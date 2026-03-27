/**
 * REQ-T2: Advisory lock idempotency tests
 *
 * Covers:
 * - Lock acquired: aggregation proceeds, skip counter not incremented
 * - Lock not acquired (concurrent run): early return, skip counter incremented
 * - Advisory lock RPC error: fail-open (returns true), aggregation proceeds
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mutable state
// ---------------------------------------------------------------------------

const _pgLock = vi.hoisted(() => ({
  acquired: true as boolean,
  queryError: null as Error | null,
}));

const _metrics = vi.hoisted(() => ({
  billingAggregationLockSkippedTotal: { inc: vi.fn() },
  billingDuplicateSubmissionPreventedTotal: { labels: vi.fn().mockReturnValue({ inc: vi.fn() }) },
  billingPendingAggregatesAgeSeconds: { set: vi.fn() },
  billingUsageRecordsUnaggregated: { set: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../../../../metrics/billingMetrics.js', () => _metrics);

vi.mock('../../../../lib/logger.js', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePgSupabase(overrides?: { lockAcquired?: boolean; rpcError?: Error | null }) {
  const acquired = overrides?.lockAcquired ?? _pgLock.acquired;
  const rpcErr = overrides?.rpcError ?? _pgLock.queryError;
  return {
    rpc: vi.fn().mockImplementation((fn: string) => {
      if (fn === 'try_advisory_xact_lock') {
        if (rpcErr) return Promise.resolve({ data: null, error: rpcErr });
        return Promise.resolve({ data: acquired, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    }),
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      insert: vi.fn().mockResolvedValue({ data: [{ id: 'agg-new' }], error: null }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    }),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('UsageAggregator — advisory lock (REQ-T2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _pgLock.acquired = true;
    _pgLock.queryError = null;
  });

  it('proceeds with aggregation when advisory lock is acquired', async () => {
    _pgLock.acquired = true;
    const { UsageAggregator } = await import('../../../../services/metering/UsageAggregator.js');
    const supabase = makePgSupabase({ lockAcquired: true });
    const aggregator = new UsageAggregator(supabase as never);

    const acquired = await aggregator.tryAcquireAggregationLock(
      'tenant-x', 'llm_tokens', '2025-01-01T00:00:00Z', '2025-01-31T23:59:59Z',
    );

    expect(acquired).toBe(true);
    expect(_metrics.billingAggregationLockSkippedTotal.inc).not.toHaveBeenCalled();
  });

  it('returns false when lock not acquired (concurrent run)', async () => {
    _pgLock.acquired = false;
    const { UsageAggregator } = await import('../../../../services/metering/UsageAggregator.js');
    const supabase = makePgSupabase({ lockAcquired: false });
    const aggregator = new UsageAggregator(supabase as never);

    const acquired = await aggregator.tryAcquireAggregationLock(
      'tenant-x', 'llm_tokens', '2025-01-01T00:00:00Z', '2025-01-31T23:59:59Z',
    );

    expect(acquired).toBe(false);
  });

  it('increments skip counter when aggregateEvents skips a locked window', async () => {
    // The skip counter is incremented inside createAggregate() when
    // tryAcquireAggregationLock returns false. Test via aggregateEvents()
    // so the full path is exercised.
    _pgLock.acquired = false;
    const { UsageAggregator } = await import('../../../../services/metering/UsageAggregator.js');

    // Supabase mock: claim_usage_events_batch returns one event so createAggregate is called.
    const supabase = {
      ...makePgSupabase({ lockAcquired: false }),
      rpc: vi.fn().mockImplementation((fn: string) => {
        if (fn === 'claim_usage_events_batch') {
          return Promise.resolve({
            data: [{
              id: 'evt-1',
              tenant_id: 'tenant-x',
              metric: 'llm_tokens',
              amount: '100',
              timestamp: '2025-01-15T00:00:00Z',
            }],
            error: null,
          });
        }
        if (fn === 'try_advisory_xact_lock') {
          return Promise.resolve({ data: false, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      }),
    };

    const aggregator = new UsageAggregator(supabase as never);
    await aggregator.aggregateEvents();

    expect(_metrics.billingAggregationLockSkippedTotal.inc).toHaveBeenCalledOnce();
  });

  it('fails open (returns true) when advisory lock RPC errors', async () => {
    _pgLock.queryError = new Error('connection timeout');
    const { UsageAggregator } = await import('../../../../services/metering/UsageAggregator.js');
    const supabase = makePgSupabase({ rpcError: new Error('connection timeout') });
    const aggregator = new UsageAggregator(supabase as never);

    const acquired = await aggregator.tryAcquireAggregationLock(
      'tenant-x', 'llm_tokens', '2025-01-01T00:00:00Z', '2025-01-31T23:59:59Z',
    );

    // Fail-open: aggregation must proceed rather than silently skip
    expect(acquired).toBe(true);
  });
});
