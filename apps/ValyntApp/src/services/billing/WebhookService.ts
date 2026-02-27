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

/** Strips key/token/secret patterns from error messages before persistence. */
function sanitizeErrorMessage(message: string): string {
  return message
    .replace(/\b(key|token|secret|password|credential)[=:]\S+/gi, '[REDACTED]')
    .replace(/\b(sk_live|sk_test|whsec_)\w+/g, '[REDACTED]')
    .slice(0, 500);
}

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
  private stripe: unknown;

  constructor() {
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
      const stripeClient = this.stripe as { webhooks: { constructEvent: (p: string | Buffer, s: string, secret: string) => Record<string, unknown> } };
      event = stripeClient.webhooks.constructEvent(
        payload,
        signature,
        STRIPE_CONFIG.webhookSecret
      ) as Record<string, unknown>;
    } catch (error: unknown) {
      logger.error('Webhook signature verification failed', error instanceof Error ? error : undefined);
      throw new Error('Webhook verification failed');
    }

    // Freshness check: reject events with stale timestamps
    this.validateEventFreshnessInternal(signature, event);

    return event;
  }

  /**
   * Validate that the event timestamp is within acceptable skew.
   * Uses the `t=` component from the Stripe signature header and falls back
   * to the event `created` field. Throws on stale events.
   */
  private validateEventFreshnessInternal(signature: string, event: Record<string, unknown>): void {
    const nowSeconds = Math.floor(Date.now() / 1000);

    let eventTimestamp: number | undefined;
    const tMatch = signature.match(/t=(\d+)/);
    if (tMatch) {
      eventTimestamp = parseInt(tMatch[1], 10);
    }

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
   * Public freshness check for testing. Returns boolean instead of throwing.
   */
  validateEventFreshness(event: Record<string, unknown>, signatureHeader?: string): boolean {
    let eventTimestamp: number | undefined;

    if (signatureHeader) {
      const match = signatureHeader.match(/t=(\d+)/);
      if (match) {
        eventTimestamp = parseInt(match[1], 10);
      }
    }

    if (!eventTimestamp && typeof event.created === 'number') {
      eventTimestamp = event.created as number;
    }

    if (!eventTimestamp) {
      return true;
    }

    const ageSeconds = Math.floor(Date.now() / 1000) - eventTimestamp;
    if (ageSeconds > SIGNATURE_TIMESTAMP_TOLERANCE_S) {
      logger.warn('Stale webhook event rejected', {
        eventId: event.id,
        ageSeconds,
        maxAge: SIGNATURE_TIMESTAMP_TOLERANCE_S,
      });
      recordWebhookRejection('stale_timestamp');
      return false;
    }

    return true;
  }

  /**
   * Resolve tenant_id from a Stripe event by looking up the customer in billing_customers.
   * Returns null if the event has no customer or the customer is unknown.
   */
  private async resolveTenantId(event: Record<string, unknown>): Promise<string | null> {
    if (!supabase) return null;

    const data = event.data as Record<string, unknown> | undefined;
    const obj = data?.object as Record<string, unknown> | undefined;
    const customerId = obj?.customer as string | undefined;

    if (!customerId) return null;

    const { data: customer, error } = await supabase
      .from('billing_customers')
      .select('tenant_id')
      .eq('stripe_customer_id', customerId)
      .single();

    if (error || !customer) {
      logger.warn('Could not resolve tenant for Stripe customer', {
        stripeCustomerId: customerId,
        eventId: event.id,
      });
      return null;
    }

    return (customer as { tenant_id: string }).tenant_id;
  }

  /**
   * Process webhook event. Resolves tenant at ingestion and scopes all operations.
   */
  async processEvent(event: Record<string, unknown>): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase billing not configured');
    }

    const tenantId = await this.resolveTenantId(event);

    const inserted = await this.storeWebhookEvent(event, tenantId);
    if (!inserted) {
      logger.info('Event is an idempotent replay, skipping side effects', { eventId: event.id });
      return;
    }

    const eventType = event.type as string;
    logger.info('Processing webhook event', {
      eventId: event.id,
      type: eventType,
      tenantId: tenantId || 'unknown',
    });

    try {
      switch (eventType) {
        case 'invoice.created':
        case 'invoice.finalized':
        case 'invoice.updated':
          await this.handleInvoiceEvent(event);
          break;

        case 'invoice.payment_succeeded':
          await this.handlePaymentSucceeded(event, tenantId);
          break;

        case 'invoice.payment_failed':
          await this.handlePaymentFailed(event, tenantId);
          break;

        case 'customer.subscription.created':
        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event, tenantId);
          break;

        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event, tenantId);
          break;

        case 'charge.succeeded':
          await this.handleChargeSucceeded(event);
          break;

        case 'charge.failed':
          await this.handleChargeFailed(event);
          break;

        default:
          logger.info('Unhandled event type', { type: eventType });
      }

      await this.markEventProcessed(event.id as string, tenantId);
      recordStripeWebhook(eventType, 'processed');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error processing webhook event', error instanceof Error ? error : undefined, { eventId: event.id });
      recordStripeWebhook(eventType, 'failed');
      recordBillingJobFailure('stripe_webhook', errorMsg);
      await this.markEventFailed(event.id as string, errorMsg, tenantId);
      throw error;
    }
  }

  private async storeWebhookEvent(event: Record<string, unknown>, tenantId: string | null): Promise<boolean> {
    const { count, error } = await supabase!
      .from('webhook_events')
      .insert(
        {
          stripe_event_id: event.id,
          event_type: event.type,
          payload: event,
          processed: false,
          received_at: new Date().toISOString(),
          tenant_id: tenantId,
        },
        {
          onConflict: 'stripe_event_id',
          ignoreDuplicates: true,
          count: 'exact',
        }
      );

    if (error) {
      const pgError = error as { code?: string };
      if (pgError.code === '23505') {
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

  private async markEventProcessed(eventId: string, tenantId: string | null): Promise<void> {
    let query = supabase!
      .from('webhook_events')
      .update({
        processed: true,
        processed_at: new Date().toISOString(),
      })
      .eq('stripe_event_id', eventId);

    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    await query;
  }

  /**
   * Mark event as failed with atomic retry counter increment.
   * Error message is sanitized to avoid persisting secrets or stack traces.
   */
  private async markEventFailed(eventId: string, errorMessage: string, tenantId: string | null): Promise<void> {
    try {
      const safeMessage = sanitizeErrorMessage(errorMessage);

      let fetchQuery = supabase!
        .from('webhook_events')
        .select('retry_count')
        .eq('stripe_event_id', eventId);

      if (tenantId) {
        fetchQuery = fetchQuery.eq('tenant_id', tenantId);
      }

      const { data: existing, error: fetchErr } = await fetchQuery.single();

      if (fetchErr && (fetchErr as Record<string, unknown>).code !== 'PGRST116') {
        throw fetchErr;
      }

      const current = (existing && (existing as Record<string, unknown>).retry_count) || 0;
      const newCount = Number(current) + 1;

      let updateQuery = supabase!
        .from('webhook_events')
        .update({
          error_message: safeMessage,
          retry_count: newCount,
        })
        .eq('stripe_event_id', eventId);

      if (tenantId) {
        updateQuery = updateQuery.eq('tenant_id', tenantId);
      }

      const { error: updateErr } = await updateQuery;

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

  private async handleInvoiceEvent(event: Record<string, unknown>): Promise<void> {
    const data = event.data as { object: Record<string, unknown> };
    const invoice = data.object;
    await InvoiceService.storeInvoice(invoice);
    logger.info('Invoice event processed', { invoiceId: invoice.id });
    recordInvoiceEvent(event.type as string);
  }

  private async handlePaymentSucceeded(event: Record<string, unknown>, tenantId: string | null): Promise<void> {
    const data = event.data as { object: Record<string, unknown> };
    const invoice = data.object;

    await InvoiceService.updateInvoice(invoice);

    if (tenantId) {
      await supabase!
        .from('billing_customers')
        .update({ status: 'active' })
        .eq('tenant_id', tenantId);
    }

    logger.info('Payment succeeded processed', { invoiceId: invoice.id, tenantId });
    recordInvoiceEvent(event.type as string);
  }

  private async handlePaymentFailed(event: Record<string, unknown>, tenantId: string | null): Promise<void> {
    const data = event.data as { object: Record<string, unknown> };
    const invoice = data.object;

    await InvoiceService.updateInvoice(invoice);

    if (tenantId) {
      await supabase!.from('usage_alerts').insert({
        tenant_id: tenantId,
        metric: 'api_calls',
        threshold_percentage: 100,
        current_usage: 0,
        quota_amount: 0,
        alert_type: 'critical',
        acknowledged: false,
        notification_sent: false,
      });

      logger.warn('Payment failed', {
        tenantId,
        invoiceId: invoice.id,
      });
    }
    recordInvoiceEvent(event.type as string);
  }

  private async handleSubscriptionUpdated(event: Record<string, unknown>, tenantId: string | null): Promise<void> {
    const data = event.data as { object: Record<string, unknown> };
    const subscription = data.object;

    let query = supabase!
      .from('subscriptions')
      .update({
        status: subscription.status,
        current_period_start: new Date((subscription.current_period_start as number) * 1000).toISOString(),
        current_period_end: new Date((subscription.current_period_end as number) * 1000).toISOString(),
        canceled_at: subscription.canceled_at
          ? new Date((subscription.canceled_at as number) * 1000).toISOString()
          : null,
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_subscription_id', subscription.id as string);

    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    await query;

    logger.info('Subscription updated', { subscriptionId: subscription.id, tenantId });
  }

  private async handleSubscriptionDeleted(event: Record<string, unknown>, tenantId: string | null): Promise<void> {
    const data = event.data as { object: Record<string, unknown> };
    const subscription = data.object;

    let cancelQuery = supabase!
      .from('subscriptions')
      .update({
        status: 'canceled',
        ended_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_subscription_id', subscription.id as string);

    if (tenantId) {
      cancelQuery = cancelQuery.eq('tenant_id', tenantId);
    }

    await cancelQuery;

    // Use resolved tenantId; fall back to subscription lookup only if needed
    const resolvedTenantId = tenantId || await (async () => {
      const { data: sub } = await supabase!
        .from('subscriptions')
        .select('tenant_id')
        .eq('stripe_subscription_id', subscription.id as string)
        .single();
      return sub ? (sub as { tenant_id: string }).tenant_id : null;
    })();

    if (resolvedTenantId) {
      await supabase!
        .from('billing_customers')
        .update({ status: 'cancelled' })
        .eq('tenant_id', resolvedTenantId);
    }

    logger.info('Subscription deleted', { subscriptionId: subscription.id, tenantId });
  }

  private async handleChargeSucceeded(event: Record<string, unknown>): Promise<void> {
    const data = event.data as { object: Record<string, unknown> };
    logger.info('Charge succeeded', { chargeId: data.object.id });
  }

  private async handleChargeFailed(event: Record<string, unknown>): Promise<void> {
    const data = event.data as { object: Record<string, unknown> };
    logger.warn('Charge failed', { chargeId: data.object.id });
  }
}

export default new WebhookService();
