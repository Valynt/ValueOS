/**
 * Webhook Retry Service
 * Handles retrying failed webhook events with exponential backoff
 */

import { createClient } from '@supabase/supabase-js';
import WebhookService from './WebhookService';
import { createLogger } from '../../lib/logger';

const logger = createLogger({ component: 'WebhookRetryService' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const MAX_RETRIES = 5;
const INITIAL_BACKOFF_MS = 1000; // 1 second
const MAX_BACKOFF_MS = 3600000; // 1 hour

interface WebhookEvent {
  id: string;
  stripe_event_id: string;
  event_type: string;
  payload: any;
  processed: boolean;
  error_message?: string;
  retry_count: number;
  next_retry_at?: string;
  received_at: string;
}

class WebhookRetryService {
  /**
   * Calculate next retry time with exponential backoff
   */
  private calculateNextRetry(retryCount: number): Date {
    const backoffMs = Math.min(
      INITIAL_BACKOFF_MS * Math.pow(2, retryCount),
      MAX_BACKOFF_MS
    );
    return new Date(Date.now() + backoffMs);
  }

  /**
   * Get failed events ready for retry
   */
  async getEventsForRetry(): Promise<WebhookEvent[]> {
    const { data, error } = await supabase
      .from('webhook_events')
      .select('*')
      .eq('processed', false)
      .lt('retry_count', MAX_RETRIES)
      .or(`next_retry_at.is.null,next_retry_at.lt.${new Date().toISOString()}`)
      .order('received_at', { ascending: true })
      .limit(10);

    if (error) {
      logger.error('Error fetching events for retry', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Retry a single webhook event
   */
  async retryEvent(event: WebhookEvent): Promise<boolean> {
    try {
      logger.info('Retrying webhook event', {
        eventId: event.stripe_event_id,
        retryCount: event.retry_count,
      });

      // Process the event
      await WebhookService.processEvent(event.payload);

      // Mark as processed
      await supabase
        .from('webhook_events')
        .update({
          processed: true,
          processed_at: new Date().toISOString(),
          error_message: null,
        })
        .eq('id', event.id);

      logger.info('Webhook event retry succeeded', {
        eventId: event.stripe_event_id,
      });

      return true;
    } catch (error) {
      const retryCount = event.retry_count + 1;
      const nextRetry = this.calculateNextRetry(retryCount);

      logger.error('Webhook event retry failed', error as Error, {
        eventId: event.stripe_event_id,
        retryCount,
        nextRetry: nextRetry.toISOString(),
      });

      // Update retry info
      await supabase
        .from('webhook_events')
        .update({
          retry_count: retryCount,
          next_retry_at: nextRetry.toISOString(),
          error_message: (error as Error).message,
        })
        .eq('id', event.id);

      // Check if max retries reached
      if (retryCount >= MAX_RETRIES) {
        logger.error('Max retries reached for webhook event', {
          eventId: event.stripe_event_id,
        });

        // Move to dead letter queue
        await this.moveToDeadLetterQueue(event);
      }

      return false;
    }
  }

  /**
   * Process all events ready for retry
   */
  async processRetries(): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
  }> {
    const events = await this.getEventsForRetry();

    logger.info(`Processing ${events.length} webhook retries`);

    let succeeded = 0;
    let failed = 0;

    for (const event of events) {
      const success = await this.retryEvent(event);
      if (success) {
        succeeded++;
      } else {
        failed++;
      }
    }

    logger.info('Webhook retry batch complete', {
      processed: events.length,
      succeeded,
      failed,
    });

    return {
      processed: events.length,
      succeeded,
      failed,
    };
  }

  /**
   * Move event to dead letter queue
   */
  private async moveToDeadLetterQueue(event: WebhookEvent): Promise<void> {
    const { error } = await supabase
      .from('webhook_dead_letter_queue')
      .insert({
        stripe_event_id: event.stripe_event_id,
        event_type: event.event_type,
        payload: event.payload,
        error_message: event.error_message,
        retry_count: event.retry_count,
        original_received_at: event.received_at,
        moved_at: new Date().toISOString(),
      });

    if (error) {
      logger.error('Error moving event to dead letter queue', error);
      throw error;
    }

    logger.info('Event moved to dead letter queue', {
      eventId: event.stripe_event_id,
    });
  }

  /**
   * Get dead letter queue events
   */
  async getDeadLetterQueue(limit: number = 50): Promise<any[]> {
    const { data, error } = await supabase
      .from('webhook_dead_letter_queue')
      .select('*')
      .order('moved_at', { ascending: false })
      .limit(limit);

    if (error) {
      logger.error('Error fetching dead letter queue', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Replay event from dead letter queue
   */
  async replayDeadLetterEvent(eventId: string): Promise<boolean> {
    const { data: event, error } = await supabase
      .from('webhook_dead_letter_queue')
      .select('*')
      .eq('id', eventId)
      .single();

    if (error) {
      logger.error('Error fetching dead letter event', error);
      throw error;
    }

    if (!event) {
      throw new Error('Event not found in dead letter queue');
    }

    try {
      // Process the event
      await WebhookService.processEvent(event.payload);

      // Remove from dead letter queue
      await supabase
        .from('webhook_dead_letter_queue')
        .delete()
        .eq('id', eventId);

      logger.info('Dead letter event replayed successfully', {
        eventId: event.stripe_event_id,
      });

      return true;
    } catch (error) {
      logger.error('Dead letter event replay failed', error as Error, {
        eventId: event.stripe_event_id,
      });
      return false;
    }
  }
}

export default new WebhookRetryService();
