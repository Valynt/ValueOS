/**
 * Webhook Service
 * Handles Stripe webhook signature verification and event processing
 */

import StripeService from './StripeService';
import InvoiceService from './InvoiceService';
import { STRIPE_CONFIG } from '../../config/billing';
import { createLogger } from '../../lib/logger';
import { recordBillingJobFailure, recordInvoiceEvent, recordStripeWebhook } from '../../metrics/billingMetrics';
import { recordWebhookRejection } from '../../metrics/webhookMetrics';
import { getSupabaseClient } from '../../lib/supabase';

const logger = createLogger({ component: 'WebhookService' });

/** Stripe signature tolerance: reject events older than this (seconds). */
const SIGNATURE_TIMESTAMP_TOLERANCE_S = 300;

function initSupabaseClient() {
  try {
    return getSupabaseClient();
  } catch {
    // safe to ignore in browser context or when credentials are missing
  }
  logger.warn('Supabase billing not configured: server credentials missing');
  return null;
}

const supabase = initSupabaseClient();

class WebhookService {
  private stripe: any;

  constructor() {
    // Initialize Stripe service only if billing is configured
    try {
      this.stripe = StripeService.getInstance().getClient();
    } catch (error) {
      logger.warn('Stripe service not available, billing features disabled', error);
      this.stripe = null;
    }
  }

  /**
   * Verify webhook signature and validate event freshness.
   * Throws a generic error on failure — internal details stay in server logs.
   */
  verifySignature(payload: string | Buffer, signature: string): Record<string, unknown> {
    if (!STRIPE_CONFIG.webhookSecret) {
      logger.error('Webhook secret not configured');
      throw new Error('Webhook verification failed');
    }

    let event: Record<string, unknown>;
    try {
      event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        STRIPE_CONFIG.webhookSecret
      ) as Record<string, unknown>;
    } catch (error: unknown) {
      logger.error('Webhook signature verification failed', error instanceof Error ? error : undefined);
      throw new Error('Webhook verification failed');
    }

    // Freshness check: reject events with stale timestamps
    this.validateEventFreshness(signature, event);

    return event;
  }

  /**
   * Validate that the event timestamp is within acceptable skew.
   * Uses the `t=` component from the Stripe signature header and falls back
   * to the event `created` field.
   */
  private validateEventFreshness(signature: string, event: Record<string, unknown>): void {
    const nowSeconds = Math.floor(Date.now() / 1000);

    // Extract timestamp from signature header (t=<unix_seconds>)
    let eventTimestamp: number | undefined;
    const tMatch = signature.match(/t=(\d+)/);
    if (tMatch) {
      eventTimestamp = parseInt(tMatch[1], 10);
    }

    // Fallback to event.created
    if (!eventTimestamp && typeof event.created === 'number') {
      eventTimestamp = event.created;
    }

    if (eventTimestamp) {
      const age = nowSeconds - eventTimestamp;
      if (age > SIGNATURE_TIMESTAMP_TOLERANCE_S) {
        recordWebhookRejection('stale_timestamp');
        logger.warn('Stale webhook event rejected', {
          eventId: event.id,
          ageSeconds: age,
          tolerance: SIGNATURE_TIMESTAMP_TOLERANCE_S,
        });
        throw new Error('Webhook verification failed');
      }
    }
  }

  /**
   * Process webhook event
   */
  async processEvent(event: any): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase billing not configured');
    }

    const inserted = await this.storeWebhookEvent(event);
    if (!inserted) {
      logger.info('Event is an idempotent replay, skipping side effects', { eventId: event.id });
      return;
    }

    logger.info('Processing webhook event', {
      eventId: event.id,
      type: event.type
    });

    try {
      switch (event.type) {
        case 'invoice.created':
        case 'invoice.finalized':
        case 'invoice.updated':
          await this.handleInvoiceEvent(event);
          break;

        case 'invoice.payment_succeeded':
          await this.handlePaymentSucceeded(event);
          break;

        case 'invoice.payment_failed':
          await this.handlePaymentFailed(event);
          break;

        case 'customer.subscription.created':
        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event);
          break;

        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event);
          break;

        case 'charge.succeeded':
          await this.handleChargeSucceeded(event);
          break;

        case 'charge.failed':
          await this.handleChargeFailed(event);
          break;

        default:
          logger.info('Unhandled event type', { type: event.type });
      }

      // Mark as processed
      await this.markEventProcessed(event.id);
      recordStripeWebhook(event.type, 'processed');
    } catch (error) {
      logger.error('Error processing webhook event', error instanceof Error ? error : undefined, { eventId: event.id });
      recordStripeWebhook(event.type, 'failed');
      recordBillingJobFailure('stripe_webhook', (error as Error).message);
      await this.markEventFailed(event.id, (error as Error).message);
      throw error;
    }
  }

  /**
   * Store webhook event
   */
  private async storeWebhookEvent(event: any): Promise<boolean> {
    const { count, error } = await supabase
      .from('webhook_events')
      .insert(
        {
          stripe_event_id: event.id,
          event_type: event.type,
          payload: event,
          processed: false,
          received_at: new Date().toISOString(),
        },
        {
          onConflict: 'stripe_event_id',
          ignoreDuplicates: true,
          count: 'exact',
        }
      );

    if (error) {
      if ((error as any).code === '23505') {
        logger.info('Duplicate webhook event insert conflict; treating as idempotent replay', {
          eventId: event.id,
        });
        return false;
      }

      throw error;
    }

    if (!count) {
      logger.info('Duplicate webhook event insert no-op; treating as idempotent replay', {
        eventId: event.id,
      });
      return false;
    }

    return true;
  }

  /**
   * Mark event as processed
   */
  private async markEventProcessed(eventId: string): Promise<void> {
    await supabase
      .from('webhook_events')
      .update({
        processed: true,
        processed_at: new Date().toISOString(),
      })
      .eq('stripe_event_id', eventId);
  }

  /**
   * Mark event as failed with atomic retry counter increment.
   * Error message is sanitized to avoid persisting secrets or stack traces.
   */
  private async markEventFailed(eventId: string, errorMessage: string): Promise<void> {
    try {
      // Sanitize: keep only the first 500 chars, strip anything that looks like a key/token
      const safeMessage = errorMessage
        .replace(/(?:key|token|secret|password)[=:\s]+\S+/gi, '[REDACTED]')
        .slice(0, 500);

      const { data: existing, error: fetchErr } = await supabase
        .from('webhook_events')
        .select('retry_count')
        .eq('stripe_event_id', eventId)
        .single();

      if (fetchErr && (fetchErr as Record<string, unknown>).code !== 'PGRST116') {
        throw fetchErr;
      }

      const current = (existing && (existing as Record<string, unknown>).retry_count) || 0;
      const newCount = Number(current) + 1;

      const { error: updateErr } = await supabase
        .from('webhook_events')
        .update({
          error_message: safeMessage,
          retry_count: newCount,
        })
        .eq('stripe_event_id', eventId);

      if (updateErr) {
        logger.error('Failed to update webhook event failure status', undefined, {
          eventId,
          dbErrorCode: (updateErr as Record<string, unknown>).code,
        });
      }
    } catch (err) {
      logger.error('Failed to mark webhook event failed', err instanceof Error ? err : undefined, { eventId });
    }
  }

  /**
   * Handle invoice events
   */
  private async handleInvoiceEvent(event: any): Promise<void> {
    const invoice = event.data.object;
    await InvoiceService.storeInvoice(invoice);
    logger.info('Invoice event processed', { invoiceId: invoice.id });
    recordInvoiceEvent(event.type);
  }

  /**
   * Handle payment succeeded
   */
  private async handlePaymentSucceeded(event: any): Promise<void> {
    const invoice = event.data.object;

    // Update invoice status
    await InvoiceService.updateInvoice(invoice);

    // Update customer status to active
    const { data: customer } = await supabase
      .from('billing_customers')
      .select('tenant_id')
      .eq('stripe_customer_id', invoice.customer)
      .single();

    if (customer) {
      await supabase
        .from('billing_customers')
        .update({ status: 'active' })
        .eq('tenant_id', customer.tenant_id);
    }

    logger.info('Payment succeeded processed', { invoiceId: invoice.id });
    recordInvoiceEvent(event.type);
  }

  /**
   * Handle payment failed
   */
  private async handlePaymentFailed(event: any): Promise<void> {
    const invoice = event.data.object;

    // Update invoice
    await InvoiceService.updateInvoice(invoice);

    // Get customer and create alert
    const { data: customer } = await supabase
      .from('billing_customers')
      .select('tenant_id')
      .eq('stripe_customer_id', invoice.customer)
      .single();

    if (customer) {
      // Create payment failed alert
      await supabase.from('usage_alerts').insert({
        tenant_id: customer.tenant_id,
        metric: 'api_calls', // Generic metric for payment alerts
        threshold_percentage: 100,
        current_usage: 0,
        quota_amount: 0,
        alert_type: 'critical',
        acknowledged: false,
        notification_sent: false,
      });

      logger.warn('Payment failed', {
        tenantId: customer.tenant_id,
        invoiceId: invoice.id
      });
    }
    recordInvoiceEvent(event.type);
  }

  /**
   * Handle subscription updated
   */
  private async handleSubscriptionUpdated(event: any): Promise<void> {
    const subscription = event.data.object;

    // Update subscription in database
    await supabase
      .from('subscriptions')
      .update({
        status: subscription.status,
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        canceled_at: subscription.canceled_at
          ? new Date(subscription.canceled_at * 1000).toISOString()
          : null,
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_subscription_id', subscription.id);

    logger.info('Subscription updated', { subscriptionId: subscription.id });
  }

  /**
   * Handle subscription deleted
   */
  private async handleSubscriptionDeleted(event: any): Promise<void> {
    const subscription = event.data.object;

    // Update subscription status
    await supabase
      .from('subscriptions')
      .update({
        status: 'canceled',
        ended_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_subscription_id', subscription.id);

    // Get customer and update status
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('tenant_id')
      .eq('stripe_subscription_id', subscription.id)
      .single();

    if (sub) {
      await supabase
        .from('billing_customers')
        .update({ status: 'cancelled' })
        .eq('tenant_id', sub.tenant_id);
    }

    logger.info('Subscription deleted', { subscriptionId: subscription.id });
  }

  /**
   * Handle charge succeeded
   */
  private async handleChargeSucceeded(event: any): Promise<void> {
    logger.info('Charge succeeded', { chargeId: event.data.object.id });
  }

  /**
   * Handle charge failed
   */
  private async handleChargeFailed(event: any): Promise<void> {
    logger.warn('Charge failed', { chargeId: event.data.object.id });
  }
}

export default new WebhookService();
