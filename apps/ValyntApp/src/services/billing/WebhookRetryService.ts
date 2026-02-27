/**
 * Webhook Retry Service
 * Handles retrying failed webhook events with exponential backoff.
 * Retries reuse the same event identity and update counters atomically.
 * DLQ moves preserve full audit context.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import WebhookService from './WebhookService';
import { createLogger } from '../../lib/logger';
import { getSupabaseServerConfig } from '../../lib/env';

const logger = createLogger({ component: 'WebhookRetryService' });

const MAX_RETRIES = 5;
const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 3600000; // 1 hour

/** Strips key/token/secret patterns from error messages before persistence. */
function sanitizeErrorMessage(message: string): string {
  return message
    .replace(/\b(key|token|secret|password|credential)[=:]\S+/gi, '[REDACTED]')
    .replace(/\b(sk_live|sk_test|whsec_)\w+/g, '[REDACTED]')
    .slice(0, 500);
}

function initSupabaseClient(): SupabaseClient | null {
  try {
    const { url, serviceRoleKey } = getSupabaseServerConfig();
    if (url && serviceRoleKey) {
      return createClient(url, serviceRoleKey);
    }
  } catch {
    // safe to ignore in browser context
  }
  logger.warn('WebhookRetryService: Supabase not configured');
  return null;
}

const supabase = initSupabaseClient();

interface WebhookEvent {
  id: string;
  stripe_event_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  processed: boolean;
  error_message?: string;
  retry_count: number;
  next_retry_at?: string;
  received_at: string;
}

class WebhookRetryService {
  private calculateNextRetry(retryCount: number): Date {
    const backoffMs = Math.min(
      INITIAL_BACKOFF_MS * Math.pow(2, retryCount),
      MAX_BACKOFF_MS
    );
    return new Date(Date.now() + backoffMs);
  }

  async getEventsForRetry(): Promise<WebhookEvent[]> {
    if (!supabase) throw new Error('Supabase not configured');

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

    return (data as WebhookEvent[]) || [];
  }

  async retryEvent(event: WebhookEvent): Promise<boolean> {
    if (!supabase) throw new Error('Supabase not configured');

    try {
      logger.info('Retrying webhook event', {
        eventId: event.stripe_event_id,
        retryCount: event.retry_count,
      });

      await WebhookService.processEvent(event.payload);

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
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';

      logger.error('Webhook event retry failed', error instanceof Error ? error : undefined, {
        eventId: event.stripe_event_id,
        retryCount,
        nextRetry: nextRetry.toISOString(),
      });

      await supabase
        .from('webhook_events')
        .update({
          retry_count: retryCount,
          next_retry_at: nextRetry.toISOString(),
          error_message: sanitizeErrorMessage(errorMsg),
        })
        .eq('id', event.id);

      if (retryCount >= MAX_RETRIES) {
        logger.error('Max retries reached for webhook event', {
          eventId: event.stripe_event_id,
        });
        await this.moveToDeadLetterQueue(event, sanitizeErrorMessage(errorMsg), retryCount);
      }

      return false;
    }
  }

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

  private async moveToDeadLetterQueue(
    event: WebhookEvent,
    finalError?: string,
    finalRetryCount?: number,
  ): Promise<void> {
    if (!supabase) throw new Error('Supabase not configured');

    const { error } = await supabase
      .from('webhook_dead_letter_queue')
      .insert({
        stripe_event_id: event.stripe_event_id,
        event_type: event.event_type,
        payload: event.payload,
        error_message: finalError ?? event.error_message,
        retry_count: finalRetryCount ?? event.retry_count,
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

  async getDeadLetterQueue(limit: number = 50): Promise<Record<string, unknown>[]> {
    if (!supabase) throw new Error('Supabase not configured');

    const { data, error } = await supabase
      .from('webhook_dead_letter_queue')
      .select('*')
      .order('moved_at', { ascending: false })
      .limit(limit);

    if (error) {
      logger.error('Error fetching dead letter queue', error);
      throw error;
    }

    return (data as Record<string, unknown>[]) || [];
  }

  async replayDeadLetterEvent(eventId: string): Promise<boolean> {
    if (!supabase) throw new Error('Supabase not configured');

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

    const dlqEvent = event as Record<string, unknown>;

    try {
      await WebhookService.processEvent(dlqEvent.payload as Record<string, unknown>);

      await supabase
        .from('webhook_dead_letter_queue')
        .delete()
        .eq('id', eventId);

      logger.info('Dead letter event replayed successfully', {
        eventId: dlqEvent.stripe_event_id,
      });

      return true;
    } catch (replayError) {
      logger.error('Dead letter event replay failed', replayError instanceof Error ? replayError : undefined, {
        eventId: dlqEvent.stripe_event_id,
      });
      return false;
    }
  }
}

export default new WebhookRetryService();
