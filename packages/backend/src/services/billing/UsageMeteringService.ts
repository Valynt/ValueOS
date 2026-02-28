/**
 * Usage Metering Service
 * Submits aggregated usage to Stripe with idempotency
 */

import { type SupabaseClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

import { createLogger } from '../../lib/logger.js'
import { UsageAggregate } from '../../types/billing';

import StripeService from './StripeService.js'

const logger = createLogger({ component: 'UsageMeteringService' });

class UsageMeteringService {
  private supabase: SupabaseClient;
  private stripeService: ReturnType<typeof StripeService.getInstance>;
  private stripe: Stripe;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
    this.stripeService = StripeService.getInstance();
    this.stripe = this.stripeService.getClient();
  }
  // Per-tenant query cost tracking (in-memory, for demo; use Redis in prod)
  private static tenantQueryCosts: Map<string, { windowStart: number; cost: number }> = new Map();
  private static QUERY_WINDOW_MS = 60 * 1000; // 1 minute
  private static MAX_COST_PER_WINDOW = 1000; // Example: 1000 cost units per minute

  /**
   * Check and increment per-tenant query cost. Throws if over limit.
   */
  private checkAndIncrementTenantCost(tenantId: string, cost: number) {
    const now = Date.now();
    const entry = UsageMeteringService.tenantQueryCosts.get(tenantId);
    if (!entry || now - entry.windowStart > UsageMeteringService.QUERY_WINDOW_MS) {
      // Reset window
      UsageMeteringService.tenantQueryCosts.set(tenantId, { windowStart: now, cost });
      return;
    }
    if (entry.cost + cost > UsageMeteringService.MAX_COST_PER_WINDOW) {
      logger.warn('Tenant query cost limit exceeded', { tenantId, attempted: cost, windowCost: entry.cost });
      throw new Error('Per-tenant query cost limit exceeded. Please retry later.');
    }
    entry.cost += cost;
    UsageMeteringService.tenantQueryCosts.set(tenantId, entry);
  }
  // stripe and stripeService initialized in constructor

  /**
   * Submit usage record to Stripe
   */
  async submitUsageRecord(aggregate: UsageAggregate): Promise<void> {
    // Enforce per-tenant query cost limit (cost = total_quantity or 1)
    try {
      this.checkAndIncrementTenantCost(aggregate.organization_id, aggregate.total_quantity || 1);
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

export default UsageMeteringService;
