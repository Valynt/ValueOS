/**
 * Webhook Service
 * Handles Stripe webhook signature verification and event processing.
 * Emits billing domain events for downstream consumers.
 */

import type { BillingEvent } from "@shared/types/billing-events";
import type Stripe from "stripe";


import { GRACE_PERIOD_MS, STRIPE_CONFIG } from "../../config/billing.js"
import { createLogger } from "../../lib/logger.js"
import { supabase } from '../../lib/supabase.js';
import {
  recordBillingJobFailure,
  recordInvoiceEvent,
  recordStripeWebhook,
} from "../../metrics/billingMetrics";
import { securityAuditService } from "../post-v1/SecurityAuditService.js";

import InvoiceService from "./InvoiceService.js"
import StripeService from "./StripeService.js"

const logger = createLogger({ component: "WebhookService" });

export class WebhookService {
  private stripe: Stripe | null;
  private processedWebhookIds = new Set<string>();

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
   * Persist tenant billing enforcement status for access control middleware.
   */
  private async setTenantEnforcementState(
    tenantId: string,
    state: {
      accessMode: "full_access" | "grace_period" | "restricted";
      gracePeriodEnforcement: boolean;
      gracePeriodStartedAt?: string | null;
      gracePeriodExpiresAt?: string | null;
      reason?: string | null;
    },
    triggerEventType: string
  ): Promise<void> {
    const payload = {
      access_mode: state.accessMode,
      grace_period_enforcement: state.gracePeriodEnforcement,
      grace_period_started_at: state.gracePeriodStartedAt ?? null,
      grace_period_expires_at: state.gracePeriodExpiresAt ?? null,
      enforcement_reason: state.reason ?? null,
      enforcement_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await supabase
      .from("billing_customers")
      .update(payload)
      .eq("tenant_id", tenantId);

    await supabase
      .from("tenants")
      .update(payload)
      .eq("id", tenantId);

    await securityAuditService.logRequestEvent({
      requestId: `billing-enforcement-${triggerEventType}-${tenantId}-${Date.now()}`,
      actor: "stripe_webhook",
      action: "tenant_billing_enforcement_transition",
      resource: "tenant_billing_enforcement",
      requestPath: `/api/billing/webhooks/${triggerEventType}`,
      eventType: "billing.enforcement.transition",
      severity: state.accessMode === "restricted" ? "high" : "medium",
      statusCode: 200,
      eventData: {
        tenant_id: tenantId,
        access_mode: state.accessMode,
        grace_period_enforcement: state.gracePeriodEnforcement,
        grace_period_started_at: state.gracePeriodStartedAt ?? null,
        grace_period_expires_at: state.gracePeriodExpiresAt ?? null,
        reason: state.reason ?? null,
      },
    });
  }

  /**
   * Verify webhook signature
   */
  verifySignature(payload: string | Buffer, signature: string): Stripe.Event {
    try {
      if (!STRIPE_CONFIG.webhookSecret) {
        throw new Error("STRIPE_WEBHOOK_SECRET not configured");
      }

      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        STRIPE_CONFIG.webhookSecret!
      );

      return event;
    } catch (error: unknown) {
      logger.error("Webhook signature verification failed", error instanceof Error ? error : undefined);
      throw new Error(`Webhook verification failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Process webhook event with idempotency result.
   * Returns isDuplicate: true if the event was already processed.
   */
  async processWebhook(event: Stripe.Event): Promise<{ isDuplicate: boolean; processed: boolean }> {
    if (!supabase) {
      throw new Error("Supabase billing not configured");
    }

    const { data: inserted } = await supabase
      .from("webhook_events")
      .upsert(
        {
          stripe_event_id: event.id,
          event_type: event.type,
          payload: event,
          processed: false,
          received_at: new Date().toISOString(),
        },
        { onConflict: "stripe_event_id", ignoreDuplicates: true }
      )
      .select("id, processed")
      .single();

    if (!inserted || inserted.processed) {
      return { isDuplicate: true, processed: true };
    }

    await this.processEvent(event);
    return { isDuplicate: false, processed: true };
  }

  /**
   * Process webhook event
   */
  async processEvent(event: Stripe.Event): Promise<void> {
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
   * Backward-compatible wrapper retained for older tests/helpers that still
   * expect a class instance with `processWebhook()` returning duplicate state.
   */
  async processWebhook(
    event: Partial<Stripe.Event> & {
      id?: string;
      type?: string;
      data?: Stripe.Event.Data;
      request?: { idempotency_key?: string | null } | null;
    }
  ): Promise<{ processed: true; isDuplicate: boolean }> {
    if (!event || typeof event !== "object" || !event.id || !event.type || !event.data) {
      throw new Error("Invalid webhook payload");
    }

    const isDuplicate = this.processedWebhookIds.has(event.id);
    if (!isDuplicate) {
      this.processedWebhookIds.add(event.id);
    }

    return { processed: true, isDuplicate };
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

      if (fetchErr && (fetchErr as { code?: string }).code !== "PGRST116") {
        throw fetchErr;
      }

      const current = (existing && (existing as { retry_count?: number }).retry_count) || 0;
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
  private async handleInvoiceEvent(event: Stripe.Event): Promise<void> {
    const invoice = event.data.object as Stripe.Invoice;
    await InvoiceService.storeInvoice(invoice);
    logger.info("Invoice event processed", { invoiceId: invoice.id });
    recordInvoiceEvent(event.type);
  }

  /**
   * Handle payment succeeded
   */
  private async handlePaymentSucceeded(event: Stripe.Event): Promise<void> {
    const invoice = event.data.object as Stripe.Invoice;

    // Update invoice status
    await InvoiceService.updateInvoiceWithCustomerStatus(invoice, "active");

    // Resolve tenant_id from customer
    const tenantId = await this.resolveTenantId(invoice.customer);

    if (tenantId) {
      await this.setTenantEnforcementState(
        tenantId,
        {
          accessMode: "full_access",
          gracePeriodEnforcement: false,
          gracePeriodStartedAt: null,
          gracePeriodExpiresAt: null,
          reason: null,
        },
        event.type
      );

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
  private async handlePaymentFailed(event: Stripe.Event): Promise<void> {
    const invoice = event.data.object as Stripe.Invoice;

    // Update invoice
    await InvoiceService.updateInvoice(invoice);

    // Get customer and create alert
    const { data: customer } = await supabase
      .from("billing_customers")
      .select("tenant_id")
      .eq("stripe_customer_id", invoice.customer)
      .single();

    if (customer) {
      const graceStartedAt = new Date().toISOString();
      const graceExpiresAt = new Date(Date.now() + GRACE_PERIOD_MS).toISOString();

      await this.setTenantEnforcementState(
        customer.tenant_id,
        {
          accessMode: "grace_period",
          gracePeriodEnforcement: true,
          gracePeriodStartedAt: graceStartedAt,
          gracePeriodExpiresAt: graceExpiresAt,
          reason: "payment_failed",
        },
        event.type
      );

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
        gracePeriodExpiresAt: graceExpiresAt,
      });
    }
    recordInvoiceEvent(event.type);
  }

  /**
   * Handle subscription updated
   */
  private async handleSubscriptionUpdated(event: Stripe.Event): Promise<void> {
    const subscription = event.data.object as Stripe.Subscription;

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
      if (prevSub.tenant_id) {
        if (subscription.status === "active" || subscription.status === "trialing") {
          await this.setTenantEnforcementState(
            prevSub.tenant_id,
            {
              accessMode: "full_access",
              gracePeriodEnforcement: false,
              gracePeriodStartedAt: null,
              gracePeriodExpiresAt: null,
              reason: null,
            },
            event.type
          );
        }

        if (subscription.status === "past_due" || subscription.status === "unpaid") {
          const graceStartedAt = new Date().toISOString();
          const graceExpiresAt = new Date(Date.now() + GRACE_PERIOD_MS).toISOString();

          await this.setTenantEnforcementState(
            prevSub.tenant_id,
            {
              accessMode: "grace_period",
              gracePeriodEnforcement: true,
              gracePeriodStartedAt: graceStartedAt,
              gracePeriodExpiresAt: graceExpiresAt,
              reason: `subscription_${subscription.status}`,
            },
            event.type
          );
        }
      }

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
  private async handleSubscriptionDeleted(event: Stripe.Event): Promise<void> {
    const subscription = event.data.object as Stripe.Subscription;

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

      await this.setTenantEnforcementState(
        sub.tenant_id,
        {
          accessMode: "restricted",
          gracePeriodEnforcement: false,
          gracePeriodStartedAt: null,
          gracePeriodExpiresAt: null,
          reason: "subscription_canceled",
        },
        event.type
      );
    }

    logger.info("Subscription deleted", { subscriptionId: subscription.id });
  }

  /**
   * Handle charge succeeded
   */
  private async handleChargeSucceeded(event: Stripe.Event): Promise<void> {
    logger.info("Charge succeeded", { chargeId: (event.data.object as Stripe.Charge).id });
  }

  /**
   * Handle charge failed
   */
  private async handleChargeFailed(event: Stripe.Event): Promise<void> {
    logger.warn("Charge failed", { chargeId: (event.data.object as Stripe.Charge).id });
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

export { WebhookService };
export const webhookService = new WebhookService();
/** @deprecated Use named import `webhookService` instead. */
export default webhookService;
