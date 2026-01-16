/**
 * Usage Metering Service
 * Submits aggregated usage to Stripe with idempotency
 */

import { createClient } from '@supabase/supabase-js';
import StripeService from './StripeService';
import { UsageAggregate } from '../../types/billing';
import { createLogger } from '../../lib/logger';

const logger = createLogger({ component: 'UsageMeteringService' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

class UsageMeteringService {
  private stripe = StripeService.getInstance().getClient();
  private stripeService = StripeService.getInstance();

  /**
   * Submit usage record to Stripe
   */
  async submitUsageRecord(aggregate: UsageAggregate): Promise<void> {
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
      const { error } = await supabase
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
    const { data: aggregates, error } = await supabase
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
    const { data, error } = await supabase
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
    startDate: Date,
    endDate: Date
  ): Promise<any[]> {
    try {
      const usageRecords = await this.stripe.subscriptionItems.listUsageRecordSummaries(
        subscriptionItemId,
        {
          starting_after: Math.floor(startDate.getTime() / 1000),
          ending_before: Math.floor(endDate.getTime() / 1000),
        }
      );

      return usageRecords.data;
    } catch (error) {
      return this.stripeService.handleError(error, 'syncUsageFromStripe');
    }
  }
}

export default new UsageMeteringService();
