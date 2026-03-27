/**
 * UsageMeteringService — Redis-backed rate limiter tests.
 *
 * Verifies that checkInboundRateLimit uses a Redis sliding window so rate
 * limits are coordinated across multiple instances (pods), and that the
 * service fails open when Redis is unavailable.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Redis mock ────────────────────────────────────────────────────────────────
const mockExec = vi.fn();
const mockIncr = vi.fn();
const mockExpire = vi.fn();
const mockPipeline = vi.fn(() => ({
  incr: mockIncr,
  expire: mockExpire,
  exec: mockExec,
}));

// UsageMeteringService now imports from lib/redisClient.js (synchronous shared client)
// rather than lib/redis.js (async, returns Promise<Redis|null>).
vi.mock('../../../lib/redisClient.js', () => ({
  getRedisClient: vi.fn(() => ({
    pipeline: mockPipeline,
  })),
}));

// ── Stripe / Supabase stubs ───────────────────────────────────────────────────
vi.mock('../StripeService.js', () => ({
  default: {
    getInstance: vi.fn(() => ({
      getClient: vi.fn(() => ({})),
    })),
  },
}));

vi.mock('../../../metrics/billingMetrics.js', () => ({
  billingDuplicateSubmissionPreventedTotal: { labels: vi.fn(() => ({ inc: vi.fn() })) },
  billingInboundRateLimitedTotal: { labels: vi.fn(() => ({ inc: vi.fn() })) },
  billingRateLimitRedisUnavailableTotal: { inc: vi.fn() },
  billingStripeRateLimitedTotal: { inc: vi.fn() },
  recordStripeSubmissionError: vi.fn(),
}));

// ── Import after mocks ────────────────────────────────────────────────────────
const { UsageMeteringService } = await import('../UsageMeteringService.js');

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeSupabase() {
  return {} as never;
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('UsageMeteringService Redis rate limiter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows requests within the rate limit window', async () => {
    // count = 500, limit = 1000 (BILLING_INBOUND_RATE_LIMIT_PER_TENANT default)
    mockExec.mockResolvedValue([[null, 500], [null, 1]]);

    const svc = new UsageMeteringService(makeSupabase());
    const allowed = await svc.checkInboundRateLimit('tenant-a');
    expect(allowed).toBe(true);
  });

  it('rejects requests when count exceeds the limit', async () => {
    // count = 1001, over the 1000 default limit
    mockExec.mockResolvedValue([[null, 1001], [null, 1]]);

    const svc = new UsageMeteringService(makeSupabase());
    const allowed = await svc.checkInboundRateLimit('tenant-b');
    expect(allowed).toBe(false);
  });

  it('two instances share the same window via Redis', async () => {
    const svcA = new UsageMeteringService(makeSupabase());
    const svcB = new UsageMeteringService(makeSupabase());

    // Instance A: count = 600 — allowed
    mockExec.mockResolvedValueOnce([[null, 600], [null, 1]]);
    expect(await svcA.checkInboundRateLimit('tenant-shared')).toBe(true);

    // Instance B: count = 1100 — over limit
    mockExec.mockResolvedValueOnce([[null, 1100], [null, 0]]);
    expect(await svcB.checkInboundRateLimit('tenant-shared')).toBe(false);
  });

  it('uses pipeline with INCR and EXPIRE', async () => {
    mockExec.mockResolvedValue([[null, 100], [null, 1]]);

    const svc = new UsageMeteringService(makeSupabase());
    await svc.checkInboundRateLimit('tenant-pipeline');

    expect(mockPipeline).toHaveBeenCalled();
    expect(mockIncr).toHaveBeenCalledWith(
      expect.stringContaining('rate:inbound:tenant-pipeline')
    );
    expect(mockExpire).toHaveBeenCalled();
  });

  it('fails open when Redis throws', async () => {
    const { getRedisClient } = await import('../../../lib/redisClient.js');
    vi.mocked(getRedisClient).mockImplementationOnce(() => {
      throw new Error('ECONNREFUSED');
    });

    const svc = new UsageMeteringService(makeSupabase());
    const allowed = await svc.checkInboundRateLimit('tenant-no-redis');
    expect(allowed).toBe(true);
  });

  it('fails open when pipeline.exec throws', async () => {
    mockExec.mockRejectedValueOnce(new Error('ECONNRESET'));

    const svc = new UsageMeteringService(makeSupabase());
    const allowed = await svc.checkInboundRateLimit('tenant-redis-error');
    expect(allowed).toBe(true);
  });

  it('window resets after TTL expiry (simulated by returning low count)', async () => {
    const svc = new UsageMeteringService(makeSupabase());

    // First window: near limit
    mockExec.mockResolvedValueOnce([[null, 950], [null, 1]]);
    expect(await svc.checkInboundRateLimit('tenant-reset')).toBe(true);

    // After TTL expiry, Redis returns a fresh low count
    mockExec.mockResolvedValueOnce([[null, 10], [null, 1]]);
    expect(await svc.checkInboundRateLimit('tenant-reset')).toBe(true);
  });
});
