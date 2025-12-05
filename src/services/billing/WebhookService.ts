/**
 * Webhook Service
 * Handles Stripe webhook signature verification and event processing
 */

import { createClient } from '@supabase/supabase-js';
import StripeService from './StripeService';
import InvoiceService from './InvoiceService';
import { STRIPE_CONFIG } from '../../config/billing';
import { createLogger } from '../../lib/logger';
import { recordStripeWebhook, recordInvoiceEvent, recordBillingJobFailure } from '../../metrics/billingMetrics';

const logger = createLogger({ component: 'WebhookService' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

class WebhookService {
  private stripe = StripeService.getInstance().getClient();

  /**
   * Verify webhook signature
   */
  verifySignature(payload: string | Buffer, signature: string): any {
    try {
      if (!STRIPE_CONFIG.webhookSecret) {
        throw new Error('STRIPE_WEBHOOK_SECRET not configured');
      }

      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        STRIPE_CONFIG.webhookSecret
      );

      return event;
    } catch (error: any) {
      logger.error('Webhook signature verification failed', error);
      throw new Error(`Webhook verification failed: ${error.message}`);
    }
  }

  /**
   * Process webhook event
   */
  async processEvent(event: any): Promise<void> {
    // Check if event already processed (idempotency)
    const { data: existing } = await supabase
      .from('webhook_events')
      .select('id')
      .eq('stripe_event_id', event.id)
      .single();

    if (existing) {
      logger.info('Event already processed', { eventId: event.id });
      return;
    }

    // Store event
    await this.storeWebhookEvent(event);

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
      logger.error('Error processing webhook event', error, { eventId: event.id });
      recordStripeWebhook(event.type, 'failed');
      recordBillingJobFailure('stripe_webhook', (error as Error).message);
      await this.markEventFailed(event.id, (error as Error).message);
      throw error;
    }
  }

  /**
   * Store webhook event
   */
  private async storeWebhookEvent(event: any): Promise<void> {
    const { error } = await supabase
      .from('webhook_events')
      .insert({
        stripe_event_id: event.id,
        event_type: event.type,
        payload: event,
        processed: false,
        received_at: new Date().toISOString(),
      });

    if (error) throw error;
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
   * Mark event as failed
   */
  private async markEventFailed(eventId: string, errorMessage: string): Promise<void> {
    await supabase
      .from('webhook_events')
      .update({
        error_message: errorMessage,
        retry_count: supabase.rpc('increment', { x: 1 }),
      })
      .eq('stripe_event_id', eventId);
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
