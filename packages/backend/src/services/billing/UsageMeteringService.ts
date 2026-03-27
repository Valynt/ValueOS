/**
 * Usage Metering Service
 * Submits aggregated usage to Stripe with idempotency
 */

import { type SupabaseClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

import { getRedisClient } from '../../lib/redis.js';
import { createLogger } from '../../lib/logger.js'
import { recordStripeSubmissionError } from '../../metrics/billingMetrics.js'
import { UsageAggregate } from '../../types/billing';

import StripeService from './StripeService.js'

const logger = createLogger({ component: 'UsageMeteringService' });

class RateLimitError extends Error {
  readonly isRateLimit = true as const;
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitError';
  }
}

// Redis key: rate:tenant:{tenantId}:query-cost
// Stores the accumulated cost for the current sliding window as an integer string.
// TTL is set to QUERY_WINDOW_SECONDS on first write and refreshed on each increment.
const RATE_LIMIT_KEY_PREFIX = 'rate:tenant';
const RATE_LIMIT_KEY_SUFFIX = 'query-cost';

class UsageMeteringService {
  private supabase: SupabaseClient;
  private stripeService: ReturnType<typeof StripeService.getInstance>;
  private stripe: Stripe;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
    this.stripeService = StripeService.getInstance();
    this.stripe = this.stripeService.getClient();
  }

  private static QUERY_WINDOW_SECONDS = 60; // 1 minute sliding window
  private static MAX_COST_PER_WINDOW = 1000; // cost units per window

  /**
   * Check and increment per-tenant query cost using a Redis sliding window.
   *
   * Uses INCRBY + EXPIRE in a pipeline for atomicity within a single round-trip.
   * The key TTL is set only when the key is new (NX flag) so the window is
   * anchored to the first request and resets naturally on expiry.
   *
   * Fails open when Redis is unavailable — rate limiting should not block
   * billing submissions due to infrastructure unavailability.
   */
  private async checkAndIncrementTenantCost(tenantId: string, cost: number): Promise<void> {
    const redisKey = `${RATE_LIMIT_KEY_PREFIX}:${tenantId}:${RATE_LIMIT_KEY_SUFFIX}`;

    try {
      const redis = await getRedisClient('control-plane');
      if (!redis) {
        logger.warn('rate-limit-redis-unavailable', {
          tenantId,
          message: 'Redis unavailable for rate limiting — failing open',
        });
        return;
      }

      // INCRBY returns the new total after incrementing.
      // EXPIRE NX sets the TTL only if the key has no expiry (i.e. first write in window).
      const pipeline = redis.pipeline();
      pipeline.incrby(redisKey, cost);
      pipeline.expire(redisKey, UsageMeteringService.QUERY_WINDOW_SECONDS, 'NX');
      const results = await pipeline.exec();

      // results[0] is [cmdError, newTotal] — inspect both.
      // A command-level error (e.g. WRONGTYPE) means the counter is unreadable;
      // log it and fail open rather than silently skipping the limit check.
      const [cmdErr, newTotal] = (results?.[0] ?? [null, null]) as [Error | null, number | null];
      if (cmdErr) {
        logger.warn('rate-limit-incrby-failed', {
          tenantId,
          error: cmdErr.message,
          message: 'INCRBY command failed — failing open',
        });
        return;
      }
      if (newTotal !== null && newTotal > UsageMeteringService.MAX_COST_PER_WINDOW) {
        logger.warn('tenant-query-cost-limit-exceeded', {
          tenantId,
          newTotal,
          limit: UsageMeteringService.MAX_COST_PER_WINDOW,
        });
        throw new RateLimitError('Per-tenant query cost limit exceeded. Please retry later.');
      }
    } catch (err) {
      // Re-throw rate limit errors; swallow Redis infrastructure errors (fail open).
      if ((err as RateLimitError).isRateLimit) {
        throw err;
      }
      logger.warn('rate-limit-check-failed', {
        tenantId,
        error: (err as Error).message,
        message: 'Rate limit check failed — failing open',
      });
    }
  }
  // stripe and stripeService initialized in constructor

  /**
   * Submit usage record to Stripe
   */
  async submitUsageRecord(aggregate: UsageAggregate): Promise<void> {
    // Enforce per-tenant query cost limit (cost = total_quantity or 1)
    try {
      await this.checkAndIncrementTenantCost(aggregate.organization_id, aggregate.total_quantity || 1);
    } catch (err) {
      logger.error('Throttling usage record due to tenant IOPS/cost limit', { tenantId: aggregate.organization_id, error: err });
      throw err;
    }
    try {
      if (aggregate.submitted_to_stripe) {
        logger.warn('Aggregate already submitted', { aggregateId: aggregate.id });
        return;
      }

      logger.info('Submitting usage to Stripe', {
        aggregateId: aggregate.id,
        metric: aggregate.metric,
        amount: aggregate.total_amount,
      });

      // Submit to Stripe with idempotency
      if (!aggregate.subscription_item_id) {
        throw new Error('subscription_item_id required for Stripe usage submission');
      }
      const usageRecord = await this.stripe.subscriptionItems.createUsageRecord(
        aggregate.subscription_item_id,
        {
          quantity: Math.ceil(aggregate.total_amount),
          timestamp: Math.floor(new Date(aggregate.period_end).getTime() / 1000),
          action: 'set',
        },
        {
          idempotencyKey: aggregate.idempotency_key,
        }
      );

      // Mark as submitted
      const { error } = await this.supabase
        .from('usage_aggregates')
        .update({
          submitted_to_stripe: true,
          submitted_at: new Date().toISOString(),
          stripe_usage_record_id: usageRecord.id,
        })
        .eq('id', aggregate.id);

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

  /**
   * Submit all pending aggregates
   */
  async submitPendingAggregates(): Promise<number> {
    logger.info('Processing pending usage aggregates');

    // Get pending aggregates
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
      try {
        await this.submitUsageRecord(aggregate);
        submitted++;
      } catch (error) {
        logger.error('Failed to submit aggregate', error, { aggregateId: aggregate.id });
        // Continue with next aggregate
      }
    }

    logger.info(`Submitted ${submitted}/${aggregates.length} aggregates`);

    return submitted;
  }

  /**
   * Get submission status
   */
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

  /**
   * Sync usage from Stripe (for verification)
   */
  async syncUsageFromStripe(
    subscriptionItemId: string,
    _startDate: Date,
    _endDate: Date
  ): Promise<Stripe.UsageRecordSummary[]> {
    try {
      const usageRecords = await this.stripe.subscriptionItems.listUsageRecordSummaries(
        subscriptionItemId
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
