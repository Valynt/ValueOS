/**
 * UsageMeteringService — Redis-backed rate limiter tests.
 *
 * Verifies that checkAndIncrementTenantCost uses a shared Redis sliding window
 * so rate limits are coordinated across multiple instances (pods), and that
 * the service fails open when Redis is unavailable.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Redis mock ────────────────────────────────────────────────────────────────
// Shared store simulates a single Redis instance seen by all service instances.
const sharedStore = new Map<string, number>();

const mockExec = vi.fn();
const mockIncrby = vi.fn();
const mockExpire = vi.fn();
const mockPipeline = vi.fn(() => ({
  incrby: mockIncrby,
  expire: mockExpire,
  exec: mockExec,
}));

vi.mock('../../../lib/redis.js', () => ({
  getRedisClient: vi.fn().mockResolvedValue({
    pipeline: mockPipeline,
  }),
}));

// ── Stripe / Supabase stubs ───────────────────────────────────────────────────
vi.mock('../StripeService.js', () => ({
  default: {
    getInstance: vi.fn(() => ({
      getClient: vi.fn(() => ({
        billing: {
          meterEvents: {
            create: vi.fn().mockResolvedValue({}),
          },
        },
      })),
    })),
  },
}));

vi.mock('../../../metrics/billingMetrics.js', () => ({
  recordStripeSubmissionError: vi.fn(),
}));

// ── Import after mocks ────────────────────────────────────────────────────────
const { UsageMeteringService } = await import('../UsageMeteringService.js');

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeSupabase() {
  return {} as never;
}

/**
 * Configures mockExec to simulate a Redis INCRBY + EXPIRE pipeline.
 * Maintains a shared counter in `sharedStore` keyed by tenantId.
 */
function setupRedisPipeline(tenantId: string, increment: number) {
  mockIncrby.mockImplementation((_key: string, amount: number) => {
    const current = sharedStore.get(tenantId) ?? 0;
    sharedStore.set(tenantId, current + amount);
  });
  mockExpire.mockReturnValue(undefined);
  mockExec.mockResolvedValue([
    [null, sharedStore.get(tenantId) ?? increment],
    [null, 1],
  ]);
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('UsageMeteringService Redis rate limiter', () => {
  beforeEach(() => {
    sharedStore.clear();
    vi.clearAllMocks();
  });

  it('allows requests within the cost window', async () => {
    const svc = new UsageMeteringService(makeSupabase());
    const tenantId = 'tenant-rate-a';

    // Simulate accumulated cost of 500 — under the 1000 limit
    mockExec.mockResolvedValue([[null, 500], [null, 1]]);

    // Access private method via cast for unit testing
    await expect(
      (svc as never)['checkAndIncrementTenantCost'](tenantId, 500)
    ).resolves.toBeUndefined();
  });

  it('throws when accumulated cost exceeds MAX_COST_PER_WINDOW', async () => {
    const svc = new UsageMeteringService(makeSupabase());
    const tenantId = 'tenant-rate-b';

    // Simulate accumulated cost of 1001 — over the 1000 limit
    mockExec.mockResolvedValue([[null, 1001], [null, 1]]);

    await expect(
      (svc as never)['checkAndIncrementTenantCost'](tenantId, 1)
    ).rejects.toThrow('Per-tenant query cost limit exceeded');
  });

  it('two instances share the same cost window via Redis', async () => {
    const svcA = new UsageMeteringService(makeSupabase());
    const svcB = new UsageMeteringService(makeSupabase());
    const tenantId = 'tenant-rate-shared';

    // Instance A increments to 600
    mockExec.mockResolvedValueOnce([[null, 600], [null, 1]]);
    await (svcA as never)['checkAndIncrementTenantCost'](tenantId, 600);

    // Instance B increments by 500 — total would be 1100, over limit
    mockExec.mockResolvedValueOnce([[null, 1100], [null, 0]]);
    await expect(
      (svcB as never)['checkAndIncrementTenantCost'](tenantId, 500)
    ).rejects.toThrow('Per-tenant query cost limit exceeded');
  });

  it('uses pipeline with INCRBY and EXPIRE NX', async () => {
    const svc = new UsageMeteringService(makeSupabase());
    const tenantId = 'tenant-rate-pipeline';

    mockExec.mockResolvedValue([[null, 100], [null, 1]]);
    await (svc as never)['checkAndIncrementTenantCost'](tenantId, 100);

    expect(mockPipeline).toHaveBeenCalled();
    expect(mockIncrby).toHaveBeenCalledWith(
      expect.stringContaining(`rate:tenant:${tenantId}:query-cost`),
      100
    );
    expect(mockExpire).toHaveBeenCalledWith(
      expect.stringContaining(`rate:tenant:${tenantId}:query-cost`),
      60,   // QUERY_WINDOW_SECONDS
      'NX'  // Only set TTL if key has no expiry (first write in window)
    );
  });

  it('fails open when Redis is unavailable', async () => {
    const { getRedisClient } = await import('../../../lib/redis.js');
    vi.mocked(getRedisClient).mockResolvedValueOnce(null);

    const svc = new UsageMeteringService(makeSupabase());

    // Should not throw even though Redis returned null
    await expect(
      (svc as never)['checkAndIncrementTenantCost']('tenant-no-redis', 999)
    ).resolves.toBeUndefined();
  });

  it('fails open when pipeline.exec throws a Redis error', async () => {
    mockExec.mockRejectedValueOnce(new Error('ECONNRESET'));

    const svc = new UsageMeteringService(makeSupabase());

    // Infrastructure error should not propagate — fail open
    await expect(
      (svc as never)['checkAndIncrementTenantCost']('tenant-redis-error', 100)
    ).resolves.toBeUndefined();
  });

  it('fails open when INCRBY returns a command-level error', async () => {
    // Simulate a WRONGTYPE error: results[0][0] is an Error, results[0][1] is null.
    mockExec.mockResolvedValueOnce([[new Error('WRONGTYPE Operation against a key holding the wrong kind of value'), null], [null, 1]]);

    const svc = new UsageMeteringService(makeSupabase());

    // Should not throw — command error is logged and fails open
    await expect(
      (svc as never)['checkAndIncrementTenantCost']('tenant-wrongtype', 100)
    ).resolves.toBeUndefined();
  });

  it('window resets after TTL expiry (simulated by returning low total)', async () => {
    const svc = new UsageMeteringService(makeSupabase());
    const tenantId = 'tenant-rate-reset';

    // First window: near limit
    mockExec.mockResolvedValueOnce([[null, 950], [null, 1]]);
    await (svc as never)['checkAndIncrementTenantCost'](tenantId, 950);

    // After TTL expiry, Redis returns a fresh low total (key was deleted by TTL)
    mockExec.mockResolvedValueOnce([[null, 100], [null, 1]]);
    await expect(
      (svc as never)['checkAndIncrementTenantCost'](tenantId, 100)
    ).resolves.toBeUndefined();
  });
});
