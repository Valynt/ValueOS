/**
 * Webhook Service
 * Handles Stripe webhook signature verification and event processing.
 * Emits billing domain events for downstream consumers.
 */

import { createClient } from "@supabase/supabase-js";
import StripeService from "./StripeService.js"
import InvoiceService from "./InvoiceService.js"
import { STRIPE_CONFIG } from "../../config/billing.js"
import { createLogger } from "../../lib/logger.js"
import { getSupabaseConfig } from "@shared/lib/env";
import {
  recordBillingJobFailure,
  recordInvoiceEvent,
  recordStripeWebhook,
} from "../../metrics/billingMetrics";
import type { BillingEvent } from "@shared/types/billing-events";

const logger = createLogger({ component: "WebhookService" });

const { url: supabaseUrl, serviceRoleKey: supabaseServiceRoleKey } =
  getSupabaseConfig();

let supabase: any = null;

if (supabaseUrl && supabaseServiceRoleKey) {
  supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
} else {
  logger.warn(
    "Supabase billing not configured: VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing"
  );
}

class WebhookService {
  private stripe: any;

  /**
   * Listeners for billing domain events emitted during webhook processing.
   * Wire these to Kafka/EventProducer in service registration.
   */
  private eventListeners: Array<(event: BillingEvent) => void> = [];

  constructor() {
    // Initialize Stripe service only if billing is configured
    try {
      this.stripe = StripeService.getInstance().getClient();
    } catch (_error) {
      logger.warn("Stripe service not available, billing features disabled");
      this.stripe = null;
    }
  }

  /**
   * Register a listener for billing domain events.
   */
  onBillingEvent(listener: (event: BillingEvent) => void): void {
    this.eventListeners.push(listener);
  }

  private emitBillingEvent(event: BillingEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (err) {
        logger.error("Billing event listener error", err as Error);
      }
    }
  }

  /**
   * Verify webhook signature
   */
  verifySignature(payload: string | Buffer, signature: string): any {
    try {
      if (!STRIPE_CONFIG.webhookSecret) {
        throw new Error("STRIPE_WEBHOOK_SECRET not configured");
      }

      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        STRIPE_CONFIG.webhookSecret
      );

      return event;
    } catch (error: any) {
      logger.error("Webhook signature verification failed", error);
      throw new Error(`Webhook verification failed: ${error.message}`);
    }
  }

  /**
   * Process webhook event
   */
  async processEvent(event: any): Promise<void> {
    if (!supabase) {
      throw new Error("Supabase billing not configured");
    }

    // Store event with idempotency check using INSERT ... ON CONFLICT
    // This prevents race conditions where two concurrent requests both pass the check
    const { data: inserted, error: insertError } = await supabase
      .from("webhook_events")
      .upsert(
        {
          stripe_event_id: event.id,
          event_type: event.type,
          payload: event,
          processed: false,
          received_at: new Date().toISOString(),
        },
        {
          onConflict: "stripe_event_id",
          ignoreDuplicates: true,
        }
      )
      .select("id, processed")
      .single();

    // If no row returned or already processed, skip
    if (!inserted || inserted.processed) {
      logger.info("Event already processed or duplicate", {
        eventId: event.id,
      });
      return;
    }

    logger.info("Processing webhook event", {
      eventId: event.id,
      type: event.type,
    });

    try {
      switch (event.type) {
        case "invoice.created":
        case "invoice.finalized":
        case "invoice.updated":
          await this.handleInvoiceEvent(event);
          break;

        case "invoice.payment_succeeded":
          await this.handlePaymentSucceeded(event);
          break;

        case "invoice.payment_failed":
          await this.handlePaymentFailed(event);
          break;

        case "customer.subscription.created":
        case "customer.subscription.updated":
          await this.handleSubscriptionUpdated(event);
          break;

        case "customer.subscription.deleted":
          await this.handleSubscriptionDeleted(event);
          break;

        case "charge.succeeded":
          await this.handleChargeSucceeded(event);
          break;

        case "charge.failed":
          await this.handleChargeFailed(event);
          break;

        default:
          logger.info("Unhandled event type", { type: event.type });
      }

      await this.markEventProcessed(event.id);
      recordStripeWebhook(event.type, "processed");
    } catch (error) {
      logger.error(
        "Error processing webhook event",
        error instanceof Error ? error : undefined,
        { eventId: event.id }
      );
      recordStripeWebhook(event.type, "failed");
      recordBillingJobFailure("stripe_webhook", (error as Error).message);
      await this.markEventFailed(event.id, (error as Error).message);
      throw error;
    }
  }

  /**
   * Mark event as processed
   */
  private async markEventProcessed(eventId: string): Promise<void> {
    await supabase
      .from("webhook_events")
      .update({
        processed: true,
        processed_at: new Date().toISOString(),
      })
      .eq("stripe_event_id", eventId);
  }


  /**
   * Mark event as failed
   */
  private async markEventFailed(
    eventId: string,
    errorMessage: string
  ): Promise<void> {
    try {
      const { data: existing, error: fetchErr } = await supabase
        .from("webhook_events")
        .select("retry_count")
        .eq("stripe_event_id", eventId)
        .single();

      if (fetchErr && (fetchErr as any).code !== "PGRST116") {
        throw fetchErr;
      }

      const current = (existing && (existing as any).retry_count) || 0;
      const newCount = Number(current) + 1;

      await supabase
        .from("webhook_events")
        .update({
          error_message: errorMessage,
          retry_count: newCount,
        })
        .eq("stripe_event_id", eventId);
    } catch (err) {
      logger.error("Failed to mark webhook event failed", err as Error, {
        eventId,
      });
    }
  }

  /**
   * Handle invoice events
   */
  private async handleInvoiceEvent(event: any): Promise<void> {
    const invoice = event.data.object;
    await InvoiceService.storeInvoice(invoice);
    logger.info("Invoice event processed", { invoiceId: invoice.id });
    recordInvoiceEvent(event.type);
  }

  /**
   * Handle payment succeeded
   */
  private async handlePaymentSucceeded(event: any): Promise<void> {
    const invoice = event.data.object;

    // Update invoice status
    await InvoiceService.updateInvoiceWithCustomerStatus(invoice, "active");

    // Resolve tenant_id from customer
    const tenantId = await this.resolveTenantId(invoice.customer);

    if (tenantId) {
      this.emitBillingEvent({
        type: "billing.payment.status_updated",
        payload: {
          tenantId,
          externalInvoiceId: invoice.id,
          externalPaymentIntentId: invoice.payment_intent ?? undefined,
          status: "succeeded",
          occurredAt: new Date().toISOString(),
          idempotencyKey: event.id,
        },
      });
    }

    logger.info("Payment succeeded processed", { invoiceId: invoice.id });
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
      .from("billing_customers")
      .select("tenant_id")
      .eq("stripe_customer_id", invoice.customer)
      .single();

    if (customer) {
      // Create payment failed alert
      await supabase.from("usage_alerts").insert({
        tenant_id: customer.tenant_id,
        metric: "api_calls", // Generic metric for payment alerts
        threshold_percentage: 100,
        current_usage: 0,
        quota_amount: 0,
        alert_type: "critical",
        acknowledged: false,
        notification_sent: false,
      });

      this.emitBillingEvent({
        type: "billing.payment.status_updated",
        payload: {
          tenantId: customer.tenant_id,
          externalInvoiceId: invoice.id,
          externalPaymentIntentId: invoice.payment_intent ?? undefined,
          status: "failed",
          occurredAt: new Date().toISOString(),
          idempotencyKey: event.id,
        },
      });

      logger.warn("Payment failed", {
        tenantId: customer.tenant_id,
        invoiceId: invoice.id,
      });
    }
    recordInvoiceEvent(event.type);
  }

  /**
   * Handle subscription updated
   */
  private async handleSubscriptionUpdated(event: any): Promise<void> {
    const subscription = event.data.object;

    // Fetch previous state before updating
    const { data: prevSub } = await supabase
      .from("subscriptions")
      .select("status, plan_tier, price_version_id, tenant_id")
      .eq("stripe_subscription_id", subscription.id)
      .single();

    // Update subscription in database
    await supabase
      .from("subscriptions")
      .update({
        status: subscription.status,
        current_period_start: new Date(
          subscription.current_period_start * 1000
        ).toISOString(),
        current_period_end: new Date(
          subscription.current_period_end * 1000
        ).toISOString(),
        canceled_at: subscription.canceled_at
          ? new Date(subscription.canceled_at * 1000).toISOString()
          : null,
        updated_at: new Date().toISOString(),
      })
      .eq("stripe_subscription_id", subscription.id);

    if (prevSub && prevSub.status !== subscription.status) {
      this.emitBillingEvent({
        type: "billing.subscription.changed",
        payload: {
          tenantId: prevSub.tenant_id,
          before: {
            status: prevSub.status,
            priceVersionId: prevSub.price_version_id ?? "",
            planTier: prevSub.plan_tier,
          },
          after: {
            status: subscription.status,
            priceVersionId: prevSub.price_version_id ?? "",
            planTier: subscription.metadata?.plan_tier ?? prevSub.plan_tier,
          },
          effectiveAt: new Date().toISOString(),
          reason: `stripe_webhook:${event.type}`,
        },
      });
    }

    logger.info("Subscription updated", { subscriptionId: subscription.id });
  }

  /**
   * Handle subscription deleted
   */
  private async handleSubscriptionDeleted(event: any): Promise<void> {
    const subscription = event.data.object;

    // Update subscription status
    await supabase
      .from("subscriptions")
      .update({
        status: "canceled",
        ended_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("stripe_subscription_id", subscription.id);

    // Get customer and update status
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("tenant_id")
      .eq("stripe_subscription_id", subscription.id)
      .single();

    if (sub) {
      await supabase
        .from("billing_customers")
        .update({ status: "cancelled" })
        .eq("tenant_id", sub.tenant_id);
    }

    logger.info("Subscription deleted", { subscriptionId: subscription.id });
  }

  /**
   * Handle charge succeeded
   */
  private async handleChargeSucceeded(event: any): Promise<void> {
    logger.info("Charge succeeded", { chargeId: event.data.object.id });
  }

  /**
   * Handle charge failed
   */
  private async handleChargeFailed(event: any): Promise<void> {
    logger.warn("Charge failed", { chargeId: event.data.object.id });
  }

  /**
   * Resolve tenant_id from a Stripe customer ID.
   */
  private async resolveTenantId(stripeCustomerId: string): Promise<string | null> {
    if (!supabase) return null;
    const { data } = await supabase
      .from("billing_customers")
      .select("tenant_id")
      .eq("stripe_customer_id", stripeCustomerId)
      .single();
    return data?.tenant_id ?? null;
  }
}

export default new WebhookService();
