/**
 * Usage Metering Service
 * Submits aggregated usage to Stripe with idempotency
 */

import { type SupabaseClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

import { getRedisClient } from '../../lib/redis.js';
import { createLogger } from '../../lib/logger.js';
import {
  billingDuplicateSubmissionPreventedTotal,
  billingInboundRateLimitedTotal,
  billingRateLimitRedisUnavailableTotal,
  billingStripeRateLimitedTotal,
  recordStripeSubmissionError,
} from '../../metrics/billingMetrics.js';
import { UsageAggregate } from '../../types/billing';

import StripeService from './StripeService.js';

const logger = createLogger({ component: 'UsageMeteringService' });

// ---------------------------------------------------------------------------
// Rate limit configuration
// ---------------------------------------------------------------------------

const INBOUND_RATE_LIMIT_PER_TENANT = Number(
  process.env.BILLING_INBOUND_RATE_LIMIT_PER_TENANT ?? '1000',
);
const INBOUND_RATE_WINDOW_SECONDS = 60;
const MAX_CONCURRENT_STRIPE_SUBMISSIONS = Number(
  process.env.BILLING_MAX_CONCURRENT_STRIPE_SUBMISSIONS ?? '10',
);
const STRIPE_TOKENS_PER_SECOND = Number(
  process.env.BILLING_STRIPE_TOKENS_PER_SECOND ?? '80',
);

// ---------------------------------------------------------------------------
// Redis rate limiter helpers
// ---------------------------------------------------------------------------

async function checkRedisRateLimit(
  key: string,
  limitPerWindow: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  try {
    const redis = getRedisClient();
    const now = Math.floor(Date.now() / 1000);
    const windowKey = `${key}:${Math.floor(now / windowSeconds)}`;
    const pipeline = redis.pipeline();
    pipeline.incr(windowKey);
    pipeline.expire(windowKey, windowSeconds * 2);
    const results = await pipeline.exec();
    const count = (results?.[0]?.[1] as number) ?? 0;
    const remaining = Math.max(0, limitPerWindow - count);
    const resetAt = (Math.floor(now / windowSeconds) + 1) * windowSeconds;
    return { allowed: count <= limitPerWindow, remaining, resetAt };
  } catch (err) {
    logger.warn('Redis rate limiter unavailable — failing open', {
      key,
      error: (err as Error).message,
    });
    billingRateLimitRedisUnavailableTotal.inc();
    return { allowed: true, remaining: limitPerWindow, resetAt: Date.now() / 1000 + windowSeconds };
  }
}

async function checkStripeTokenBucket(): Promise<boolean> {
  const result = await checkRedisRateLimit('rate:stripe:global', STRIPE_TOKENS_PER_SECOND, 1);
  return result.allowed;
}

// Global semaphore key — shared across all pods so the cap is enforced
// at the cluster level, not per-process.
const STRIPE_SUBMISSION_SEMAPHORE_KEY = 'sem:stripe:submissions:global';

async function acquireStripeSubmissionSlot(): Promise<boolean> {
  try {
    const redis = getRedisClient();
    // Pipeline incr + expire together so the key always has a TTL even if
    // the process crashes immediately after incr. Using EXPIRE NX (Redis 7+,
    // ioredis 5) ensures the TTL is only set on first creation — subsequent
    // acquires do not reset it, preventing the cap from being exceeded if the
    // key expires while slots are still held.
    const pipeline = redis.pipeline();
    pipeline.incr(STRIPE_SUBMISSION_SEMAPHORE_KEY);
    // 'NX' = set TTL only if the key has no expiry yet (i.e. first acquire).
    pipeline.expire(STRIPE_SUBMISSION_SEMAPHORE_KEY, 120, 'NX');
    const results = await pipeline.exec();
    const count = (results?.[0]?.[1] as number) ?? 0;

    if (count > MAX_CONCURRENT_STRIPE_SUBMISSIONS) {
      await redis.decr(STRIPE_SUBMISSION_SEMAPHORE_KEY);
      return false;
    }
    return true;
  } catch (err) {
    logger.warn('Redis semaphore unavailable — failing open', { error: (err as Error).message });
    billingRateLimitRedisUnavailableTotal.inc();
    return true;
  }
}

async function releaseStripeSubmissionSlot(): Promise<void> {
  try {
    const redis = getRedisClient();
    await redis.decr(STRIPE_SUBMISSION_SEMAPHORE_KEY);
  } catch {
    // Non-fatal — key expires automatically
  }
}

function jitteredBackoffMs(attempt: number, baseMs = 500, maxMs = 30_000): number {
  const exp = Math.min(baseMs * 2 ** attempt, maxMs);
  return exp * (0.5 + Math.random() * 0.5);
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class UsageMeteringService {
  private supabase: SupabaseClient;
  private stripeService: ReturnType<typeof StripeService.getInstance>;
  private stripe: Stripe;
  private workerId: string;

  constructor(supabase: SupabaseClient, workerId?: string) {
    this.supabase = supabase;
    this.stripeService = StripeService.getInstance();
    this.stripe = this.stripeService.getClient();
    this.workerId = workerId ?? `worker-${process.pid}`;
  }

  // REQ-R1a: Per-tenant inbound rate limiting (Redis-backed, replaces static Map)
  async checkInboundRateLimit(tenantId: string): Promise<boolean> {
    const result = await checkRedisRateLimit(
      `rate:inbound:${tenantId}`,
      INBOUND_RATE_LIMIT_PER_TENANT,
      INBOUND_RATE_WINDOW_SECONDS,
    );
    if (!result.allowed) {
      logger.warn('Inbound rate limit exceeded', {
        tenantId,
        remaining: result.remaining,
        resetAt: new Date(result.resetAt * 1000).toISOString(),
      });
      billingInboundRateLimitedTotal.labels({ tenant_id: tenantId }).inc();
    }
    return result.allowed;
  }

  // REQ-R3b: Pre-Stripe validation — find any already-submitted aggregate for
  // this tenant+metric+period before calling Stripe.
  private async findExistingSubmission(aggregate: UsageAggregate): Promise<UsageAggregate | null> {
    const { data, error } = await this.supabase
      .from('usage_aggregates')
      .select('id, submitted_to_stripe, idempotency_key')
      .eq('tenant_id', aggregate.organization_id)
      .eq('metric', aggregate.metric)
      .eq('period_start', aggregate.period_start)
      .eq('period_end', aggregate.period_end)
      .eq('submitted_to_stripe', true)
      .limit(1)
      .maybeSingle();

    if (error) {
      logger.warn('Pre-Stripe validation query failed — proceeding with submission', {
        aggregateId: aggregate.id,
        error: error.message,
      });
      return null;
    }
    return data as UsageAggregate | null;
  }

  async submitUsageRecord(aggregate: UsageAggregate): Promise<void> {
    // Fast path: flag already set on this row
    if (aggregate.submitted_to_stripe) {
      logger.warn('Aggregate already submitted (flag set)', { aggregateId: aggregate.id });
      return;
    }

    // REQ-R3b: Pre-Stripe DB check
    const existing = await this.findExistingSubmission(aggregate);
    if (existing) {
      logger.warn('Duplicate submission prevented', {
        aggregateId: aggregate.id,
        existingId: existing.id,
        tenantId: aggregate.organization_id,
        metric: aggregate.metric,
      });
      billingDuplicateSubmissionPreventedTotal.labels({
        tenant_id: aggregate.organization_id,
        metric: aggregate.metric,
      }).inc();
      await this.supabase
        .from('usage_aggregates')
        .update({ submitted_to_stripe: true, submitted_at: new Date().toISOString() })
        .eq('id', aggregate.id);
      return;
    }

    try {
      logger.info('Submitting usage to Stripe', {
        aggregateId: aggregate.id,
        metric: aggregate.metric,
        amount: aggregate.total_amount,
      });

      if (!aggregate.subscription_item_id) {
        throw new Error('subscription_item_id required for Stripe usage submission');
      }

      // REQ-R1c: Global Stripe token bucket with exponential backoff
      let stripeAllowed = false;
      for (let attempt = 0; attempt < 5; attempt++) {
        stripeAllowed = await checkStripeTokenBucket();
        if (stripeAllowed) break;
        billingStripeRateLimitedTotal.inc();
        const backoff = jitteredBackoffMs(attempt);
        logger.info('Stripe token bucket full — backing off', {
          aggregateId: aggregate.id,
          attempt,
          backoffMs: Math.round(backoff),
        });
        await new Promise((r) => setTimeout(r, backoff));
      }

      if (!stripeAllowed) {
        throw new Error('Stripe rate limit: token bucket exhausted after backoff');
      }

      const usageRecord = await this.stripe.subscriptionItems.createUsageRecord(
        aggregate.subscription_item_id,
        {
          quantity: Math.ceil(aggregate.total_amount),
          timestamp: Math.floor(new Date(aggregate.period_end).getTime() / 1000),
          action: 'set',
        },
        { idempotencyKey: aggregate.idempotency_key },
      );

      // Optimistic lock: only update if not yet submitted (prevents race on retry)
      const { error } = await this.supabase
        .from('usage_aggregates')
        .update({
          submitted_to_stripe: true,
          submitted_at: new Date().toISOString(),
          stripe_usage_record_id: usageRecord.id,
        })
        .eq('id', aggregate.id)
        .eq('submitted_to_stripe', false);

      if (error) throw error;

      logger.info('Usage submitted successfully', {
        aggregateId: aggregate.id,
        usageRecordId: usageRecord.id,
      });
    } catch (error) {
      recordStripeSubmissionError();
      logger.error('Error submitting usage', error, { aggregateId: aggregate.id });
      throw error;
    }
  }

  // REQ-R1b: Batch loop bounded by Redis concurrency semaphore
  async submitPendingAggregates(): Promise<number> {
    logger.info('Processing pending usage aggregates');

    const { data: aggregates, error } = await this.supabase
      .from('usage_aggregates')
      .select('*')
      .eq('submitted_to_stripe', false)
      .order('created_at', { ascending: true })
      .limit(100);

    if (error) {
      logger.error('Error fetching pending aggregates', error);
      throw error;
    }

    if (!aggregates || aggregates.length === 0) {
      logger.info('No pending aggregates to submit');
      return 0;
    }

    logger.info(`Found ${aggregates.length} pending aggregates`);

    let submitted = 0;
    for (const aggregate of aggregates) {
      const slotAcquired = await acquireStripeSubmissionSlot();
      if (!slotAcquired) {
        logger.warn('Stripe submission concurrency limit reached — deferring remaining', {
          workerId: this.workerId,
          submitted,
          remaining: aggregates.length - submitted,
        });
        break;
      }
      try {
        await this.submitUsageRecord(aggregate as UsageAggregate);
        submitted++;
      } catch (err) {
        logger.error('Failed to submit aggregate', err, { aggregateId: aggregate.id });
      } finally {
        await releaseStripeSubmissionSlot();
      }
    }

    logger.info(`Submitted ${submitted}/${aggregates.length} aggregates`);
    return submitted;
  }

  async getSubmissionStatus(aggregateId: string): Promise<UsageAggregate | null> {
    const { data, error } = await this.supabase
      .from('usage_aggregates')
      .select('*')
      .eq('id', aggregateId)
      .single();

    if (error && error.code !== 'PGRST116') {
      logger.error('Error fetching aggregate', error);
      throw error;
    }
    return data;
  }

  async syncUsageFromStripe(
    subscriptionItemId: string,
    _startDate: Date,
    _endDate: Date,
  ): Promise<Stripe.UsageRecordSummary[]> {
    try {
      const usageRecords = await this.stripe.subscriptionItems.listUsageRecordSummaries(
        subscriptionItemId,
      );
      return usageRecords.data;
    } catch (error) {
      return this.stripeService.handleError(error, 'syncUsageFromStripe');
    }
  }
}

export { UsageMeteringService };
/** @deprecated Use named import `UsageMeteringService` instead. */
export default UsageMeteringService;
