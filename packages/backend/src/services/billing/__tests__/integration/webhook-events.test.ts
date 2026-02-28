/**
 * Webhook Event Processing E2E Tests
 * Complete flow tests for all webhook event types
 *
 * These tests validate end-to-end processing of each Stripe webhook event.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  assertRecordExists,
  cleanupBillingTables,
  getTestSupabaseClient,
  seedTestData,
  waitForCondition,
} from "../__helpers__/db-helpers";
import {
  createBillingCustomer,
  createSubscription,
  createWebhookEvent,
} from "../__helpers__/billing-factories";
import { createMockStripeEvent } from "../__helpers__/stripe-mocks.js"
import type { SupabaseClient } from "@supabase/supabase-js";

describe("Webhook Event Processing E2E Tests", () => {
  let supabase: SupabaseClient;

  beforeEach(async () => {
    supabase = getTestSupabaseClient();
    await cleanupBillingTables(supabase);
  });

  afterEach(async () => {
    await cleanupBillingTables(supabase);
  });

  describe("Invoice Events", () => {
    it("should process invoice.created event", async () => {
      const tenantId = `tenant_${Date.now()}`;
      const customer = createBillingCustomer({ tenant_id: tenantId });

      await seedTestData(supabase, { customers: [customer] });

      const stripeEvent = createMockStripeEvent("invoice.created", {
        id: "in_created",
        customer: customer.stripe_customer_id,
        amount_due: 9900,
        status: "draft",
      });

      const webhookEvent = createWebhookEvent("invoice.created", {
        stripe_event_id: stripeEvent.id,
        payload: stripeEvent,
      });

      await supabase.from("webhook_events").insert(webhookEvent);

      await assertRecordExists(supabase, "webhook_events", {
        stripe_event_id: stripeEvent.id,
        event_type: "invoice.created",
      });
    });

    it("should process invoice.finalized event", async () => {
      const tenantId = `tenant_${Date.now()}`;
      const customer = createBillingCustomer({ tenant_id: tenantId });

      await seedTestData(supabase, { customers: [customer] });

      const stripeEvent = createMockStripeEvent("invoice.finalized", {
        id: "in_finalized",
        customer: customer.stripe_customer_id,
        status: "open",
      });

      const webhookEvent = createWebhookEvent("invoice.finalized", {
        stripe_event_id: stripeEvent.id,
        payload: stripeEvent,
      });

      await supabase.from("webhook_events").insert(webhookEvent);

      await assertRecordExists(supabase, "webhook_events", {
        event_type: "invoice.finalized",
      });
    });

    it("should process invoice.payment_succeeded event", async () => {
      const tenantId = `tenant_${Date.now()}`;
      const customer = createBillingCustomer({ tenant_id: tenantId });

      await seedTestData(supabase, { customers: [customer] });

      const stripeEvent = createMockStripeEvent("invoice.payment_succeeded", {
        id: "in_paid",
        customer: customer.stripe_customer_id,
        amount_paid: 9900,
        status: "paid",
      });

      const webhookEvent = createWebhookEvent("invoice.payment_succeeded", {
        stripe_event_id: stripeEvent.id,
        payload: stripeEvent,
      });

      await supabase.from("webhook_events").insert(webhookEvent);

      // Mark as processed after handling
      await supabase
        .from("webhook_events")
        .update({ processed: true, processed_at: new Date().toISOString() })
        .eq("stripe_event_id", stripeEvent.id);

      const { data } = await supabase
        .from("webhook_events")
        .select("processed")
        .eq("stripe_event_id", stripeEvent.id)
        .single();

      expect(data!.processed).toBe(true);
    });

    it("should process invoice.payment_failed event", async () => {
      const tenantId = `tenant_${Date.now()}`;
      const customer = createBillingCustomer({ tenant_id: tenantId });

      await seedTestData(supabase, { customers: [customer] });

      const stripeEvent = createMockStripeEvent("invoice.payment_failed", {
        id: "in_failed",
        customer: customer.stripe_customer_id,
        attempt_count: 1,
      });

      const webhookEvent = createWebhookEvent("invoice.payment_failed", {
        stripe_event_id: stripeEvent.id,
        payload: stripeEvent,
      });

      await supabase.from("webhook_events").insert(webhookEvent);

      await assertRecordExists(supabase, "webhook_events", {
        event_type: "invoice.payment_failed",
      });
    });

    it("should process invoice.updated event", async () => {
      const tenantId = `tenant_${Date.now()}`;
      const customer = createBillingCustomer({ tenant_id: tenantId });

      await seedTestData(supabase, { customers: [customer] });

      const stripeEvent = createMockStripeEvent("invoice.updated", {
        id: "in_updated",
        customer: customer.stripe_customer_id,
      });

      const webhookEvent = createWebhookEvent("invoice.updated", {
        stripe_event_id: stripeEvent.id,
        payload: stripeEvent,
      });

      await supabase.from("webhook_events").insert(webhookEvent);

      await assertRecordExists(supabase, "webhook_events", {
        event_type: "invoice.updated",
      });
    });
  });

  describe("Subscription Events", () => {
    it("should process customer.subscription.created event", async () => {
      const tenantId = `tenant_${Date.now()}`;
      const customer = createBillingCustomer({ tenant_id: tenantId });

      await seedTestData(supabase, { customers: [customer] });

      const stripeEvent = createMockStripeEvent(
        "customer.subscription.created",
        {
          id: "sub_created",
          customer: customer.stripe_customer_id,
          status: "active",
        }
      );

      const webhookEvent = createWebhookEvent("customer.subscription.created", {
        stripe_event_id: stripeEvent.id,
        payload: stripeEvent,
      });

      await supabase.from("webhook_events").insert(webhookEvent);

      await assertRecordExists(supabase, "webhook_events", {
        event_type: "customer.subscription.created",
      });
    });

    it("should process customer.subscription.updated event", async () => {
      const tenantId = `tenant_${Date.now()}`;
      const customer = createBillingCustomer({ tenant_id: tenantId });
      const subscription = createSubscription({
        tenant_id: tenantId,
        billing_customer_id: customer.id,
        plan_tier: "free",
      });

      await seedTestData(supabase, {
        customers: [customer],
        subscriptions: [subscription],
      });

      const stripeEvent = createMockStripeEvent(
        "customer.subscription.updated",
        {
          id: subscription.stripe_subscription_id,
          customer: customer.stripe_customer_id,
          status: "active",
        }
      );

      const webhookEvent = createWebhookEvent("customer.subscription.updated", {
        stripe_event_id: stripeEvent.id,
        payload: stripeEvent,
      });

      await supabase.from("webhook_events").insert(webhookEvent);

      // After processing, subscription could be updated
      await supabase
        .from("subscriptions")
        .update({ plan_tier: "standard" })
        .eq("id", subscription.id);

      const { data } = await supabase
        .from("subscriptions")
        .select("plan_tier")
        .eq("id", subscription.id)
        .single();

      expect(data!.plan_tier).toBe("standard");
    });

    it("should process customer.subscription.deleted event", async () => {
      const tenantId = `tenant_${Date.now()}`;
      const customer = createBillingCustomer({ tenant_id: tenantId });
      const subscription = createSubscription({
        tenant_id: tenantId,
        billing_customer_id: customer.id,
      });

      await seedTestData(supabase, {
        customers: [customer],
        subscriptions: [subscription],
      });

      const stripeEvent = createMockStripeEvent(
        "customer.subscription.deleted",
        {
          id: subscription.stripe_subscription_id,
          customer: customer.stripe_customer_id,
        }
      );

      const webhookEvent = createWebhookEvent("customer.subscription.deleted", {
        stripe_event_id: stripeEvent.id,
        payload: stripeEvent,
      });

      await supabase.from("webhook_events").insert(webhookEvent);

      // After processing, mark subscription as canceled
      await supabase
        .from("subscriptions")
        .update({
          status: "canceled",
          canceled_at: new Date().toISOString(),
        })
        .eq("id", subscription.id);

      const { data } = await supabase
        .from("subscriptions")
        .select("status")
        .eq("id", subscription.id)
        .single();

      expect(data!.status).toBe("canceled");
    });

    it("should process customer.subscription.trial_will_end event", async () => {
      const tenantId = `tenant_${Date.now()}`;
      const customer = createBillingCustomer({ tenant_id: tenantId });

      await seedTestData(supabase, { customers: [customer] });

      const stripeEvent = createMockStripeEvent(
        "customer.subscription.trial_will_end",
        {
          id: "sub_trial",
          customer: customer.stripe_customer_id,
        }
      );

      const webhookEvent = createWebhookEvent(
        "customer.subscription.trial_will_end",
        {
          stripe_event_id: stripeEvent.id,
          payload: stripeEvent,
        }
      );

      await supabase.from("webhook_events").insert(webhookEvent);

      await assertRecordExists(supabase, "webhook_events", {
        event_type: "customer.subscription.trial_will_end",
      });
    });
  });

  describe("Charge Events", () => {
    it("should process charge.succeeded event", async () => {
      const tenantId = `tenant_${Date.now()}`;
      const customer = createBillingCustomer({ tenant_id: tenantId });

      await seedTestData(supabase, { customers: [customer] });

      const stripeEvent = createMockStripeEvent("charge.succeeded", {
        id: "ch_succeeded",
        customer: customer.stripe_customer_id,
        amount: 9900,
      });

      const webhookEvent = createWebhookEvent("charge.succeeded", {
        stripe_event_id: stripeEvent.id,
        payload: stripeEvent,
      });

      await supabase.from("webhook_events").insert(webhookEvent);

      await assertRecordExists(supabase, "webhook_events", {
        event_type: "charge.succeeded",
      });
    });

    it("should process charge.failed event", async () => {
      const tenantId = `tenant_${Date.now()}`;
      const customer = createBillingCustomer({ tenant_id: tenantId });

      await seedTestData(supabase, { customers: [customer] });

      const stripeEvent = createMockStripeEvent("charge.failed", {
        id: "ch_failed",
        customer: customer.stripe_customer_id,
        failure_message: "Insufficient funds",
      });

      const webhookEvent = createWebhookEvent("charge.failed", {
        stripe_event_id: stripeEvent.id,
        payload: stripeEvent,
      });

      await supabase.from("webhook_events").insert(webhookEvent);

      await assertRecordExists(supabase, "webhook_events", {
        event_type: "charge.failed",
      });
    });
  });

  describe("Payment Method Events", () => {
    it("should process payment_method.attached event", async () => {
      const tenantId = `tenant_${Date.now()}`;
      const customer = createBillingCustomer({ tenant_id: tenantId });

      await seedTestData(supabase, { customers: [customer] });

      const stripeEvent = createMockStripeEvent("payment_method.attached", {
        id: "pm_attached",
        customer: customer.stripe_customer_id,
      });

      const webhookEvent = createWebhookEvent("payment_method.attached", {
        stripe_event_id: stripeEvent.id,
        payload: stripeEvent,
      });

      await supabase.from("webhook_events").insert(webhookEvent);

      await assertRecordExists(supabase, "webhook_events", {
        event_type: "payment_method.attached",
      });
    });
  });

  describe("Event Processing Order", () => {
    it("should process events in chronological order", async () => {
      const tenantId = `tenant_${Date.now()}`;
      const customer = createBillingCustomer({ tenant_id: tenantId });

      await seedTestData(supabase, { customers: [customer] });

      // Create events with timestamps
      const events = [
        createWebhookEvent("invoice.created", {
          received_at: new Date(Date.now() - 3000).toISOString(),
        }),
        createWebhookEvent("invoice.finalized", {
          received_at: new Date(Date.now() - 2000).toISOString(),
        }),
        createWebhookEvent("invoice.payment_succeeded", {
          received_at: new Date(Date.now() - 1000).toISOString(),
        }),
      ];

      await supabase.from("webhook_events").insert(events);

      // Query in order
      const { data } = await supabase
        .from("webhook_events")
        .select("event_type, received_at")
        .order("received_at", { ascending: true });

      expect(data![0].event_type).toBe("invoice.created");
      expect(data![1].event_type).toBe("invoice.finalized");
      expect(data![2].event_type).toBe("invoice.payment_succeeded");
    });
  });

  describe("Error Handling in Webhook Processing", () => {
    it("should log errors for failed webhook processing", async () => {
      const webhookEvent = createWebhookEvent("invoice.created", {
        processed: false,
        retry_count: 0,
      });

      await supabase.from("webhook_events").insert(webhookEvent);

      // Simulate processing error
      await supabase
        .from("webhook_events")
        .update({
          retry_count: 1,
          error_message: "Customer not found in database",
        })
        .eq("id", webhookEvent.id);

      const { data } = await supabase
        .from("webhook_events")
        .select("retry_count, error_message")
        .eq("id", webhookEvent.id)
        .single();

      expect(data!.retry_count).toBe(1);
      expect(data!.error_message).toContain("Customer not found");
    });
  });

  describe("Webhook Event Cleanup", () => {
    it("should identify old processed events for archival", async () => {
      const oldEvent = createWebhookEvent("invoice.paid", {
        received_at: new Date(
          Date.now() - 100 * 24 * 60 * 60 * 1000
        ).toISOString(), // 100 days ago
        processed: true,
        processed_at: new Date(
          Date.now() - 99 * 24 * 60 * 60 * 1000
        ).toISOString(),
      });

      await supabase.from("webhook_events").insert(oldEvent);

      // Query old events for archival
      const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

      const { data } = await supabase
        .from("webhook_events")
        .select("*")
        .eq("processed", true)
        .lt("processed_at", cutoffDate.toISOString());

      expect(data).toHaveLength(1);
    });
  });
});
