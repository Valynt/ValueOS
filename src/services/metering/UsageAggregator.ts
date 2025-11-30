/**
 * Usage Aggregator
 * Runs as background job to aggregate usage events into batches
 */

import { createClient } from '@supabase/supabase-js';
import { BillingMetric } from '../../config/billing';
import { createLogger } from '../../lib/logger';

const logger = createLogger({ component: 'UsageAggregator' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

class UsageAggregator {
  /**
   * Aggregate unprocessed events
   */
  async aggregateEvents(): Promise<number> {
    logger.info('Starting usage aggregation');

    try {
      // Get unprocessed events
      const { data: events, error } = await supabase
        .from('usage_events')
        .select('*')
        .eq('processed', false)
        .order('timestamp', { ascending: true })
        .limit(10000);

      if (error) throw error;

      if (!events || events.length === 0) {
        logger.info('No events to aggregate');
        return 0;
      }

      logger.info(`Aggregating ${events.length} events`);

      // Group events by tenant and metric
      const groups = this.groupEvents(events);

      // Create aggregates
      let aggregated = 0;
      for (const [key, groupEvents] of Object.entries(groups)) {
        try {
          await this.createAggregate(groupEvents);
          aggregated += groupEvents.length;
        } catch (error) {
          logger.error('Failed to create aggregate', error as Error, { key });
        }
      }

      logger.info(`Aggregated ${aggregated} events into ${Object.keys(groups).length} batches`);

      return aggregated;
    } catch (error) {
      logger.error('Aggregation failed', error as Error);
      throw error;
    }
  }

  /**
   * Group events by tenant and metric
   */
  private groupEvents(events: any[]): Record<string, any[]> {
    const groups: Record<string, any[]> = {};

    events.forEach(event => {
      const key = `${event.tenant_id}:${event.metric}`;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(event);
    });

    return groups;
  }

  /**
   * Create aggregate from group
   */
  private async createAggregate(events: any[]): Promise<void> {
    if (events.length === 0) return;

    const firstEvent = events[0];
    const tenantId = firstEvent.tenant_id;
    const metric = firstEvent.metric as BillingMetric;

    // Calculate totals
    const totalAmount = events.reduce((sum, e) => sum + parseFloat(e.amount), 0);
    const eventCount = events.length;
    const periodStart = events[0].timestamp;
    const periodEnd = events[events.length - 1].timestamp;

    // Get subscription item
    const { data: subscriptionItem } = await supabase
      .from('subscription_items')
      .select('id')
      .eq('metric', metric)
      .in('subscription_id', 
        supabase
          .from('subscriptions')
          .select('id')
          .eq('tenant_id', tenantId)
          .in('status', ['active', 'trialing'])
      )
      .single();

    if (!subscriptionItem) {
      logger.warn('No subscription item found', { tenantId, metric });
      // Mark events as processed anyway
      await this.markEventsProcessed(events.map(e => e.id));
      return;
    }

    // Generate idempotency key
    const idempotencyKey = `aggregate_${tenantId}_${metric}_${Date.now()}`;

    // Create aggregate
    const { error } = await supabase
      .from('usage_aggregates')
      .insert({
        tenant_id: tenantId,
        subscription_item_id: subscriptionItem.id,
        metric,
        total_amount: totalAmount,
        event_count: eventCount,
        period_start: periodStart,
        period_end: periodEnd,
        submitted_to_stripe: false,
        idempotency_key: idempotencyKey,
      });

    if (error) throw error;

    // Mark events as processed
    await this.markEventsProcessed(events.map(e => e.id));

    logger.info('Aggregate created', {
      tenantId,
      metric,
      eventCount,
      totalAmount,
    });
  }

  /**
   * Mark events as processed
   */
  private async markEventsProcessed(eventIds: string[]): Promise<void> {
    const { error } = await supabase
      .from('usage_events')
      .update({
        processed: true,
        processed_at: new Date().toISOString(),
      })
      .in('id', eventIds);

    if (error) throw error;
  }
}

export default new UsageAggregator();
