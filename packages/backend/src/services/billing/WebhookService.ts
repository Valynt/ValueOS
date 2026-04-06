/**
 * Webhook Service
 * Handles Stripe webhook signature verification and event processing.
 * Emits billing domain events for downstream consumers.
 */

import type { BillingEvent } from "@shared/types/billing-events";
import { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";

import { GRACE_PERIOD_MS, STRIPE_CONFIG } from "../../config/billing.js";
import { createLogger } from "../../lib/logger.js";
import { createBillingPlatformSupabaseClient } from "../../lib/supabase/privileged/billing.js";
import {
  recordBillingJobFailure,
  recordInvoiceEvent,
  recordStripeWebhook,
  recordWebhookUnresolvedTenant,
  webhookProcessingFailuresTotal,
  webhooksProcessedTotal,
  webhooksReceivedTotal,
} from "../../metrics/billingMetrics";
import { securityAuditService } from "../post-v1/SecurityAuditService.js";

import InvoiceService from "./InvoiceService.js";
import StripeService from "./StripeService.js";
import { storeWebhookPayload } from "./WebhookPayloadStore.js";

const logger = createLogger({ component: "WebhookService" });
const TENANT_RESOLUTION_MAX_RETRIES = 5;
const TENANT_RESOLUTION_RETRY_DELAYS_MS = [
  60_000,
  5 * 60_000,
  15 * 60_000,
  60 * 60_000,
  6 * 60 * 60_000,
];

class TenantResolutionDeferredError extends Error {
  readonly stripeCustomerId: string;
  readonly invoiceId: string;
  readonly eventId: string;

  constructor(params: {
    stripeCustomerId: string;
    invoiceId: string;
    eventId: string;
  }) {
    super(
      `payment_succeeded: no billing_customers row for Stripe customer ${params.stripeCustomerId} (invoice ${params.invoiceId})`
    );
    this.name = "TenantResolutionDeferredError";
    this.stripeCustomerId = params.stripeCustomerId;
    this.invoiceId = params.invoiceId;
    this.eventId = params.eventId;
  }
}

export class WebhookService {
  private stripe: Stripe | null;
  private supabase: SupabaseClient;

  /**
   * Listeners for billing domain events emitted during webhook processing.
   * Wire these to Kafka/EventProducer in service registration.
   */
  private eventListeners: Array<(event: BillingEvent) => void> = [];

  constructor(supabase?: SupabaseClient) {
    this.supabase =
      supabase ??
      createBillingPlatformSupabaseClient({
        justification: "service-role:justified billing webhook processing",
      });
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

    await this.supabase.from("tenants").update(payload).eq("id", tenantId);

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
      logger.error(
        "Webhook signature verification failed",
        error instanceof Error ? error : undefined
      );
      throw new Error(
        `Webhook verification failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Process a verified Stripe webhook event exactly once.
   *
   * Idempotency is enforced by a single INSERT ... ON CONFLICT DO NOTHING at
   * the database level. The previous implementation performed two sequential
   * upserts (one here, one inside processEvent), creating a race window where
   * concurrent deliveries of the same event could both observe "not a
   * duplicate" and execute the handler twice. This version uses one atomic
   * insert so only the request that wins the DB constraint proceeds.
   *
   * Returns isDuplicate: true when the event was already recorded (conflict),
   * meaning no handler was invoked.
   */
  async processWebhook(
    event: Stripe.Event
  ): Promise<{ isDuplicate: boolean; processed: boolean }> {
    const isDuplicate = await this.processEvent(event);
    return { isDuplicate, processed: true };
  }

  /**
   * Core event processing with a single atomic idempotency check.
   *
   * Uses a raw INSERT ... ON CONFLICT DO NOTHING via Supabase's upsert with
   * ignoreDuplicates:true, but we then explicitly query for the existing row
   * to distinguish "new insert" from "conflict on duplicate". This gives us:
   *   - DB-level uniqueness enforcement (stripe_event_id UNIQUE constraint)
   *   - Explicit duplicate detection with structured logging
   *   - No silent drops: every duplicate is logged with its existing status
   *
   * Returns true when the event was a duplicate (no handler invoked), false
   * when the event was new and the handler ran.
   */
  async processEvent(event: Stripe.Event): Promise<boolean> {
    if (!supabase) {
      throw new Error("Supabase billing not configured");
    }

    // Count every inbound event regardless of outcome
    webhooksReceivedTotal.labels({ event_type: event.type }).inc();

    // ── Step 1: Idempotency gate ───────────────────────────────────────────
    // Attempt a lightweight insert (no payload columns yet) using the DB
    // UNIQUE constraint on stripe_event_id as the authoritative gate.
    // ignoreDuplicates:true maps to INSERT ... ON CONFLICT DO NOTHING.
    // Payload storage is deferred to step 2 so duplicate deliveries (the
    // common case for Stripe retries) never trigger a Storage upload.
    const { data: inserted, error: insertError } = await supabase
      .from("webhook_events")
      .upsert(
        {
          stripe_event_id: event.id,
          event_type: event.type,
          payload: event,
          status: "pending",
          processed: false,
          received_at: new Date().toISOString(),
        },
        {
          onConflict: "stripe_event_id",
          ignoreDuplicates: true,
        }
      )
      .select("id, processed, status")
      .single();

    if (insertError && (insertError as { code?: string }).code !== "PGRST116") {
      // PGRST116 = "no rows returned" — expected on conflict (DO NOTHING).
      // Any other error is unexpected and should propagate.
      logger.error("Unexpected error inserting webhook event", insertError, {
        eventId: event.id,
        type: event.type,
      });
      throw new Error(`Failed to record webhook event: ${insertError.message}`);
    }

    // null → conflict (DO NOTHING fired) — fetch the existing row to log its state
    let shouldProceedWithRetry = false;
    if (!inserted) {
      const { data: existing } = await supabase
        .from("webhook_events")
        .select("id, processed, status, retry_count, next_retry_at")
        .eq("stripe_event_id", event.id)
        .single();

      const nextRetryAt = existing?.next_retry_at
        ? new Date(existing.next_retry_at).getTime()
        : null;
      const retryReady = !nextRetryAt || nextRetryAt <= Date.now();

      if (
        existing?.status === "pending_retry" &&
        !existing?.processed &&
        retryReady
      ) {
        logger.info("Webhook pending retry due — reprocessing event", {
          eventId: event.id,
          type: event.type,
          retryCount: existing?.retry_count ?? 0,
          nextRetryAt: existing?.next_retry_at ?? null,
        });
        shouldProceedWithRetry = true;
      } else {
        logger.info("Webhook duplicate detected — skipping handler", {
          eventId: event.id,
          type: event.type,
          existingStatus: existing?.status ?? "unknown",
          existingProcessed: existing?.processed ?? null,
        });
        recordStripeWebhook(event.type, "duplicate");
        webhooksProcessedTotal
          .labels({ event_type: event.type, status: "duplicate" })
          .inc();
        return true; // isDuplicate
      }
    }

    // Row existed but was already processed (e.g. redelivery after success)
    if (
      !shouldProceedWithRetry &&
      (inserted?.processed || inserted?.status === "processed")
    ) {
      logger.info("Webhook event already processed — skipping handler", {
        eventId: event.id,
        type: event.type,
        status: inserted.status,
      });
      recordStripeWebhook(event.type, "duplicate");
      webhooksProcessedTotal
        .labels({ event_type: event.type, status: "duplicate" })
        .inc();
      return true; // isDuplicate
    }

    // ── Step 2: Durable payload storage (new events only) ─────────────────
    // Only reached when this delivery won the idempotency insert above.
    // Payloads ≤256kb are stored inline; larger payloads go to Supabase Storage.
    const payloadStorage = await storeWebhookPayload(event.id, event);

    // Attach payload storage references to the row now that we know it's new.
    if (
      payloadStorage.mode === "external" ||
      payloadStorage.rawPayload !== null
    ) {
      const { error: payloadUpdateError } = await supabase
        .from("webhook_events")
        .update({
          raw_payload: payloadStorage.rawPayload,
          payload_ref: payloadStorage.payloadRef,
        })
        .eq("stripe_event_id", event.id);

      if (payloadUpdateError) {
        // Non-fatal: the handler can still run, but the payload reference is lost.
        // A DLQ replay for this event would have no payload to re-enqueue.
        logger.warn("Failed to attach payload reference to webhook event row", {
          eventId: event.id,
          payloadMode: payloadStorage.mode,
          error: payloadUpdateError.message,
        });
      }
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
      webhooksProcessedTotal
        .labels({ event_type: event.type, status: "success" })
        .inc();
      return false; // not a duplicate
    } catch (error) {
      if (error instanceof TenantResolutionDeferredError) {
        await this.deferForTenantResolution(event, error);
        recordStripeWebhook(event.type, "failed");
        webhooksProcessedTotal
          .labels({ event_type: event.type, status: "failed" })
          .inc();
        return false;
      }

      logger.error(
        "Error processing webhook event",
        error instanceof Error ? error : undefined,
        { eventId: event.id }
      );
      recordStripeWebhook(event.type, "failed");
      webhooksProcessedTotal
        .labels({ event_type: event.type, status: "failed" })
        .inc();
      webhookProcessingFailuresTotal.labels({ event_type: event.type }).inc();
      recordBillingJobFailure("stripe_webhook", (error as Error).message);
      await this.markEventFailed(event.id, (error as Error).message);
      throw error;
    }
  }

  private async deferForTenantResolution(
    event: Stripe.Event,
    error: TenantResolutionDeferredError
  ): Promise<void> {
    const { data: existing } = await supabase
      .from("webhook_events")
      .select("retry_count")
      .eq("stripe_event_id", event.id)
      .single();

    const nextRetryCount = Number(existing?.retry_count ?? 0) + 1;
    const retryIndex = Math.min(
      nextRetryCount - 1,
      TENANT_RESOLUTION_RETRY_DELAYS_MS.length - 1
    );
    const nextAttemptAt = new Date(
      Date.now() + TENANT_RESOLUTION_RETRY_DELAYS_MS[retryIndex]
    ).toISOString();
    const idempotencyKey = event.request?.idempotency_key ?? event.id;

    if (nextRetryCount > TENANT_RESOLUTION_MAX_RETRIES) {
      await supabase
        .from("webhook_events")
        .update({
          status: "failed",
          retry_count: nextRetryCount,
          failed_at: new Date().toISOString(),
          error_message: error.message,
          idempotency_key: idempotencyKey,
        })
        .eq("stripe_event_id", event.id);

      await this.supabase.from("webhook_dead_letter_queue").insert({
        stripe_event_id: event.id,
        event_type: event.type,
        payload: event,
        error_message: error.message,
        retry_count: nextRetryCount,
        original_received_at: new Date().toISOString(),
        moved_at: new Date().toISOString(),
      });

      await securityAuditService.logRequestEvent({
        requestId: `billing-webhook-retry-exhausted-${event.id}-${Date.now()}`,
        actor: "stripe_webhook",
        action: "billing_webhook_retry_exhausted",
        resource: "billing_webhook_event",
        requestPath: `/api/billing/webhooks/${event.type}`,
        eventType: "billing.webhook.retry_exhausted",
        severity: "high",
        statusCode: 503,
        eventData: {
          event_id: event.id,
          event_type: event.type,
          idempotency_key: idempotencyKey,
          retry_count: nextRetryCount,
          stripe_customer_id: error.stripeCustomerId,
          invoice_id: error.invoiceId,
        },
      });
      return;
    }

    await supabase
      .from("webhook_events")
      .update({
        status: "pending_retry",
        retry_count: nextRetryCount,
        next_retry_at: nextAttemptAt,
        error_message: error.message,
        idempotency_key: idempotencyKey,
      })
      .eq("stripe_event_id", event.id);
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
        status: "processed",
      })
      .eq("stripe_event_id", eventId);
  }

  /**
   * Mark event as failed and increment retry counter.
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

      const current =
        (existing && (existing as { retry_count?: number }).retry_count) || 0;
      const newCount = Number(current) + 1;

      await supabase
        .from("webhook_events")
        .update({
          error_message: errorMessage,
          retry_count: newCount,
          status: "failed",
          failed_at: new Date().toISOString(),
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
    await new InvoiceService(this.supabase).storeInvoice(invoice);
    logger.info("Invoice event processed", { invoiceId: invoice.id });
    recordInvoiceEvent(event.type);
  }

  /**
   * Handle payment succeeded
   */
  private async handlePaymentSucceeded(event: Stripe.Event): Promise<void> {
    const invoice = event.data.object as Stripe.Invoice;

    // Update invoice status
    await new InvoiceService(this.supabase).updateInvoiceWithCustomerStatus(
      invoice,
      "active"
    );

    // Resolve tenant_id from customer — required to update enforcement state.
    // If the customer has no billing_customers row (provisioning race, data gap),
    // throw so the webhook is marked failed and retried rather than silently skipped.
    const tenantId = await this.resolveTenantId(invoice.customer);

    if (!tenantId) {
      recordWebhookUnresolvedTenant();
      logger.error(
        "Payment succeeded but tenant not found in billing_customers — enforcement state not updated",
        {
          stripeCustomerId: invoice.customer,
          invoiceId: invoice.id,
          eventId: event.id,
        }
      );
      throw new TenantResolutionDeferredError({
        stripeCustomerId: String(invoice.customer),
        invoiceId: invoice.id,
        eventId: event.id,
      });
    }

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

    logger.info("Payment succeeded processed", {
      invoiceId: invoice.id,
      tenantId,
    });
    recordInvoiceEvent(event.type);
  }

  /**
   * Handle payment failed
   */
  private async handlePaymentFailed(event: Stripe.Event): Promise<void> {
    const invoice = event.data.object as Stripe.Invoice;

    // Update invoice
    await new InvoiceService(this.supabase).updateInvoice(invoice);

    // Get customer and create alert
    const { data: customer } = await supabase
      .from("billing_customers")
      .select("tenant_id")
      .eq("stripe_customer_id", invoice.customer)
      .single();

    if (customer) {
      const graceStartedAt = new Date().toISOString();
      const graceExpiresAt = new Date(
        Date.now() + GRACE_PERIOD_MS
      ).toISOString();

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
      await this.supabase.from("usage_alerts").insert({
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
        if (
          subscription.status === "active" ||
          subscription.status === "trialing"
        ) {
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

        if (
          subscription.status === "past_due" ||
          subscription.status === "unpaid"
        ) {
          const graceStartedAt = new Date().toISOString();
          const graceExpiresAt = new Date(
            Date.now() + GRACE_PERIOD_MS
          ).toISOString();

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
    logger.info("Charge succeeded", {
      chargeId: (event.data.object as Stripe.Charge).id,
    });
  }

  /**
   * Handle charge failed
   */
  private async handleChargeFailed(event: Stripe.Event): Promise<void> {
    logger.warn("Charge failed", {
      chargeId: (event.data.object as Stripe.Charge).id,
    });
  }

  /**
   * Resolve tenant_id from a Stripe customer ID.
   */
  private async resolveTenantId(
    stripeCustomerId: string
  ): Promise<string | null> {
    if (!supabase) return null;
    const { data } = await supabase
      .from("billing_customers")
      .select("tenant_id")
      .eq("stripe_customer_id", stripeCustomerId)
      .single();
    return data?.tenant_id ?? null;
  }
}

export const webhookService = new WebhookService();
/** @deprecated Use named import `webhookService` instead. */
export default webhookService;
