/**
 * REQ-T1: UsageMeteringService rate limiting unit tests
 *
 * Covers:
 * - Inbound rate limit allow path (Redis returns allowed)
 * - Inbound rate limit deny path (Redis returns denied)
 * - Redis unavailability -> fail-open + counter increment
 * - Stripe token bucket exhaustion -> exponential backoff + error
 * - Pre-Stripe duplicate check -> skip + counter increment (REQ-R3b)
 * - Pre-Stripe check miss -> Stripe call proceeds
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mutable state
// ---------------------------------------------------------------------------

const _redis = vi.hoisted(() => ({
  pipelineCount: 1 as number,
  shouldThrow: false as boolean,
}));

const _metrics = vi.hoisted(() => ({
  billingInboundRateLimitedTotal: { labels: vi.fn().mockReturnValue({ inc: vi.fn() }) },
  billingRateLimitRedisUnavailableTotal: { inc: vi.fn() },
  billingStripeRateLimitedTotal: { inc: vi.fn() },
  billingDuplicateSubmissionPreventedTotal: { labels: vi.fn().mockReturnValue({ inc: vi.fn() }) },
  billingAggregationLockSkippedTotal: { inc: vi.fn() },
  billingWebhookExhaustedTotal: { labels: vi.fn().mockReturnValue({ inc: vi.fn() }) },
  recordStripeSubmissionError: vi.fn(),
}));

const _db = vi.hoisted(() => ({
  existingSubmission: null as Record<string, unknown> | null,
}));

const _stripe = vi.hoisted(() => ({
  createUsageRecord: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../../../lib/redis.js', () => ({
  getRedisClient: () => ({
    pipeline: () => ({
      incr: vi.fn().mockReturnThis(),
      expire: vi.fn().mockReturnThis(),
      exec: vi.fn().mockImplementation(() => {
        if (_redis.shouldThrow) return Promise.reject(new Error('Redis connection refused'));
        return Promise.resolve([[null, _redis.pipelineCount]]);
      }),
    }),
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
    decr: vi.fn().mockResolvedValue(0),
  }),
}));

vi.mock('../../../metrics/billingMetrics.js', () => _metrics);

vi.mock('../../../lib/logger.js', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

vi.mock('../StripeService.js', () => ({
  default: {
    getInstance: () => ({
      getClient: () => ({
        subscriptionItems: { createUsageRecord: _stripe.createUsageRecord },
      }),
    }),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSupabase() {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockImplementation(() =>
        Promise.resolve({ data: _db.existingSubmission, error: null }),
      ),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    }),
  };
}

function makeAggregate(overrides?: Record<string, unknown>) {
  return {
    id: 'agg-test-1',
    organization_id: 'tenant-abc',
    tenant_id: 'tenant-abc',
    subscription_item_id: 'si_test123',
    metric: 'llm_tokens',
    total_amount: 500,
    event_count: 5,
    period_start: '2025-01-01T00:00:00Z',
    period_end: '2025-01-31T23:59:59Z',
    submitted_to_stripe: false,
    idempotency_key: 'idem-key-abc',
    metadata: {},
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('UsageMeteringService — rate limiting (REQ-T1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _redis.pipelineCount = 1;
    _redis.shouldThrow = false;
    _db.existingSubmission = null;
    _stripe.createUsageRecord.mockResolvedValue({ id: 'ur_test' });
    process.env.BILLING_INBOUND_RATE_LIMIT_PER_TENANT = '1000';
    process.env.BILLING_STRIPE_TOKENS_PER_SECOND = '80';
    process.env.BILLING_MAX_CONCURRENT_STRIPE_SUBMISSIONS = '10';
  });

  describe('checkInboundRateLimit', () => {
    it('allows request when Redis counter is below limit', async () => {
      _redis.pipelineCount = 1;
      const { UsageMeteringService } = await import('../UsageMeteringService.js');
      const svc = new UsageMeteringService(makeSupabase() as never);

      const allowed = await svc.checkInboundRateLimit('tenant-1');

      expect(allowed).toBe(true);
      expect(_metrics.billingInboundRateLimitedTotal.labels).not.toHaveBeenCalled();
    });

    it('denies request and increments counter when limit exceeded', async () => {
      _redis.pipelineCount = 1001; // above 1000 limit
      const { UsageMeteringService } = await import('../UsageMeteringService.js');
      const svc = new UsageMeteringService(makeSupabase() as never);

      const allowed = await svc.checkInboundRateLimit('tenant-2');

      expect(allowed).toBe(false);
      expect(_metrics.billingInboundRateLimitedTotal.labels).toHaveBeenCalledWith({
        tenant_id: 'tenant-2',
      });
    });

    it('fails open and increments redis-unavailable counter when Redis throws', async () => {
      _redis.shouldThrow = true;
      const { UsageMeteringService } = await import('../UsageMeteringService.js');
      const svc = new UsageMeteringService(makeSupabase() as never);

      const allowed = await svc.checkInboundRateLimit('tenant-3');

      // Fail-open: must allow rather than blocking billing
      expect(allowed).toBe(true);
      expect(_metrics.billingRateLimitRedisUnavailableTotal.inc).toHaveBeenCalled();
    });
  });

  describe('submitUsageRecord — pre-Stripe duplicate check (REQ-R3b)', () => {
    it('skips Stripe call and increments counter when existing submission found', async () => {
      _db.existingSubmission = {
        id: 'agg-existing',
        submitted_to_stripe: true,
        idempotency_key: 'idem-existing',
      };
      const { UsageMeteringService } = await import('../UsageMeteringService.js');
      const svc = new UsageMeteringService(makeSupabase() as never);

      await svc.submitUsageRecord(makeAggregate() as never);

      expect(_stripe.createUsageRecord).not.toHaveBeenCalled();
      expect(_metrics.billingDuplicateSubmissionPreventedTotal.labels).toHaveBeenCalledWith({
        tenant_id: 'tenant-abc',
        metric: 'llm_tokens',
      });
    });

    it('proceeds with Stripe call when no existing submission found', async () => {
      _db.existingSubmission = null;
      const { UsageMeteringService } = await import('../UsageMeteringService.js');
      const svc = new UsageMeteringService(makeSupabase() as never);

      await svc.submitUsageRecord(makeAggregate() as never);

      expect(_stripe.createUsageRecord).toHaveBeenCalledOnce();
    });

    it('skips immediately when submitted_to_stripe flag is already set on the row', async () => {
      const { UsageMeteringService } = await import('../UsageMeteringService.js');
      const svc = new UsageMeteringService(makeSupabase() as never);

      await svc.submitUsageRecord(makeAggregate({ submitted_to_stripe: true }) as never);

      expect(_stripe.createUsageRecord).not.toHaveBeenCalled();
      expect(_metrics.billingDuplicateSubmissionPreventedTotal.labels).not.toHaveBeenCalled();
    });
  });

  describe('submitUsageRecord — Stripe token bucket (REQ-R1c)', () => {
    it('throws and increments stripe-rate-limited counter when token bucket exhausted', async () => {
      // 999 > 80 tokens/s limit — all 5 backoff attempts will be denied
      _redis.pipelineCount = 999;
      const { UsageMeteringService } = await import('../UsageMeteringService.js');
      const svc = new UsageMeteringService(makeSupabase() as never);

      await expect(svc.submitUsageRecord(makeAggregate() as never)).rejects.toThrow(
        /token bucket exhausted/,
      );

      expect(_metrics.billingStripeRateLimitedTotal.inc).toHaveBeenCalled();
      expect(_stripe.createUsageRecord).not.toHaveBeenCalled();
    });
  });
});
