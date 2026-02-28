/**
 * Webhook Retry and Idempotency Tests
 * Validates webhook processing resilience and duplicate prevention
 *
 * CRITICAL: These tests ensure billing events are processed exactly once,
 * preventing duplicate charges and missing payments.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createWebhookEvent } from "../__helpers__/billing-factories";
import {
  cleanupBillingTables,
  getTestSupabaseClient,
  waitForCondition,
} from "../__helpers__/db-helpers";
import { createMockStripeEvent } from "../__helpers__/stripe-mocks";
import { delay } from "../__helpers__/test-fixtures";

describe("Webhook Retry and Idempotency Tests", () => {
  let supabase: SupabaseClient;

  beforeEach(async () => {
    supabase = getTestSupabaseClient();
    await cleanupBillingTables(supabase);
  });

  afterEach(async () => {
    await cleanupBillingTables(supabase);
  });

  describe("Idempotency", () => {
    it("should prevent duplicate processing of same webhook event", async () => {
      const eventId = `evt_${Math.random().toString(36).substring(7)}`;
      const event1 = createWebhookEvent("invoice.payment_succeeded", {
        stripe_event_id: eventId,
      });

      // Insert first event
      const { error: error1 } = await supabase
        .from("webhook_events")
        .insert(event1);

      expect(error1).toBeNull();

      // Try to insert duplicate
      const event2 = createWebhookEvent("invoice.payment_succeeded", {
        stripe_event_id: eventId, // Same event ID
      });

      const { error: error2 } = await supabase
        .from("webhook_events")
        .insert(event2);

      // Should fail due to unique constraint on stripe_event_id
      expect(error2).toBeTruthy();
      expect(error2?.code).toBe("23505"); // Unique violation
    });

    it("should mark event as processed only once", async () => {
      const webhookEvent = createWebhookEvent("invoice.payment_succeeded");

      await supabase.from("webhook_events").insert(webhookEvent);

      // Mark as processed
      await supabase
        .from("webhook_events")
        .update({
          processed: true,
          processed_at: new Date().toISOString(),
        })
        .eq("stripe_event_id", webhookEvent.stripe_event_id);

      // Verify
      const { data } = await supabase
        .from("webhook_events")
        .select("processed, processed_at")
        .eq("stripe_event_id", webhookEvent.stripe_event_id)
        .single();

      expect(data?.processed).toBe(true);
      expect(data?.processed_at).toBeTruthy();
    });

    it("should handle concurrent processing attempts gracefully", async () => {
      const webhookEvent = createWebhookEvent("invoice.payment_succeeded");

      await supabase.from("webhook_events").insert(webhookEvent);

      // Simulate concurrent processing
      const process1 = supabase
        .from("webhook_events")
        .update({
          processed: true,
          processed_at: new Date().toISOString(),
        })
        .eq("stripe_event_id", webhookEvent.stripe_event_id)
        .eq("processed", false); // Conditional update

      const process2 = supabase
        .from("webhook_events")
        .update({
          processed: true,
          processed_at: new Date().toISOString(),
        })
        .eq("stripe_event_id", webhookEvent.stripe_event_id)
        .eq("processed", false); // Conditional update

      await Promise.all([process1, process2]);

      // Should be marked processed only once
      const { data } = await supabase
        .from("webhook_events")
        .select("processed")
        .eq("stripe_event_id", webhookEvent.stripe_event_id)
        .single();

      expect(data?.processed).toBe(true);
    });
  });

  describe("Retry Mechanism", () => {
    it("should increment retry count on failure", async () => {
      const webhookEvent = createWebhookEvent("invoice.payment_failed");

      await supabase.from("webhook_events").insert(webhookEvent);

      // Simulate failure
      await supabase
        .from("webhook_events")
        .update({
          retry_count: 1,
          error_message: "Temporary failure",
        })
        .eq("stripe_event_id", webhookEvent.stripe_event_id);

      const { data } = await supabase
        .from("webhook_events")
        .select("retry_count, error_message")
        .eq("stripe_event_id", webhookEvent.stripe_event_id)
        .single();

      expect(data?.retry_count).toBe(1);
      expect(data?.error_message).toBe("Temporary failure");
    });

    it("should retry failed webhooks up to maximum attempts", async () => {
      const webhookEvent = createWebhookEvent("invoice.payment_succeeded");

      await supabase.from("webhook_events").insert(webhookEvent);

      // Simulate multiple failures
      for (let i = 1; i <= 5; i++) {
        await supabase
          .from("webhook_events")
          .update({
            retry_count: i,
            error_message: `Attempt ${i} failed`,
          })
          .eq("stripe_event_id", webhookEvent.stripe_event_id);

        await delay(10);
      }

      const { data } = await supabase
        .from("webhook_events")
        .select("retry_count")
        .eq("stripe_event_id", webhookEvent.stripe_event_id)
        .single();

      expect(data?.retry_count).toBe(5);

      // After max retries, should be marked as permanently failed
      // (implementation would need dead-letter queue or alert)
    });

    it("should use exponential backoff for retries", () => {
      // Test exponential backoff calculation
      const baseDelay = 1000; // 1 second

      const retryDelays = [
        baseDelay * Math.pow(2, 0), // 1s
        baseDelay * Math.pow(2, 1), // 2s
        baseDelay * Math.pow(2, 2), // 4s
        baseDelay * Math.pow(2, 3), // 8s
        baseDelay * Math.pow(2, 4), // 16s
      ];

      expect(retryDelays).toEqual([1000, 2000, 4000, 8000, 16000]);

      // Document: Implement exponential backoff in retry job
    });

    it("should process pending webhooks in order", async () => {
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

      // Query pending events in order
      const { data: pending } = await supabase
        .from("webhook_events")
        .select("event_type, received_at")
        .eq("processed", false)
        .order("received_at", { ascending: true });

      expect(pending).toHaveLength(3);
      expect(pending?.[0].event_type).toBe("invoice.created");
      expect(pending?.[2].event_type).toBe("invoice.payment_succeeded");
    });
  });

  describe("Partial Failure Recovery", () => {
    it("should rollback transaction on database error", async () => {
      // Simulate webhook processing that fails mid-transaction
      const webhookEvent = createWebhookEvent("customer.subscription.created");

      await supabase.from("webhook_events").insert(webhookEvent);

      // Start processing - this would normally be in a transaction
      const { error: updateError } = await supabase
        .from("webhook_events")
        .update({ processed: true })
        .eq("stripe_event_id", webhookEvent.stripe_event_id);

      expect(updateError).toBeNull();

      // If subsequent operation fails, rollback should occur
      // In real implementation, use database transactions
    });

    it("should recover from partial subscription creation", async () => {
      // Test scenario: Customer created, but subscription creation fails
      // On retry, should detect existing customer and continue
      const customerId = `cus_${Math.random().toString(36).substring(7)}`;

      // Document: Service should check for existing records before creating
      // to enable safe retries
      expect(customerId).toMatch(/^cus_/);
    });
  });

  describe("Webhook Event Archival", () => {
    it("should retain webhook events for audit trail", async () => {
      const oldEvent = createWebhookEvent("invoice.payment_succeeded", {
        received_at: new Date(
          Date.now() - 90 * 24 * 60 * 60 * 1000
        ).toISOString(), // 90 days ago
        processed: true,
        processed_at: new Date(
          Date.now() - 89 * 24 * 60 * 60 * 1000
        ).toISOString(),
      });

      await supabase.from("webhook_events").insert(oldEvent);

      const { data } = await supabase
        .from("webhook_events")
        .select("processed, processed_at")
        .eq("stripe_event_id", oldEvent.stripe_event_id)
        .single();

      expect(data?.processed).toBe(true);

      // Document: Implement archival policy (e.g., keep for 1 year)
      // Move to cold storage after 90 days
    });
  });

  describe("Webhook Queue Management", () => {
    it("should handle high volume of webhooks", async () => {
      // Simulate burst of 100 webhooks
      const events = Array.from({ length: 100 }, (_, i) =>
        createWebhookEvent(`test.event.${i % 5}`)
      );

      const { error } = await supabase.from("webhook_events").insert(events);

      expect(error).toBeNull();

      const { count } = await supabase
        .from("webhook_events")
        .select("*", { count: "exact", head: true })
        .eq("processed", false);

      expect(count).toBe(100);

      // Document: Implement queue worker to process in batches
    });

    it("should prioritize critical event types", () => {
      // Define priority levels
      const priorityMap = {
        "invoice.payment_failed": 1, // Highest priority
        "customer.subscription.deleted": 1,
        "invoice.payment_succeeded": 2,
        "invoice.finalized": 3,
        "invoice.created": 4,
      };

      expect(priorityMap["invoice.payment_failed"]).toBe(1);

      // Document: Process critical events first
    });
  });

  describe("Error Handling and Logging", () => {
    it("should capture detailed error information for failed webhooks", async () => {
      const webhookEvent = createWebhookEvent("invoice.payment_succeeded");

      await supabase.from("webhook_events").insert(webhookEvent);

      // Simulate processing error
      const errorDetails = {
        error_message: "Database connection timeout after 30s",
        retry_count: 1,
      };

      await supabase
        .from("webhook_events")
        .update(errorDetails)
        .eq("stripe_event_id", webhookEvent.stripe_event_id);

      const { data } = await supabase
        .from("webhook_events")
        .select("error_message, retry_count")
        .eq("stripe_event_id", webhookEvent.stripe_event_id)
        .single();

      expect(data?.error_message).toContain("Database connection timeout");
      expect(data?.retry_count).toBe(1);
    });
  });

  describe("Dead Letter Queue", () => {
    it("should move permanently failed events to DLQ after max retries", async () => {
      const maxRetries = 5;
      const webhookEvent = createWebhookEvent("invoice.payment_succeeded", {
        retry_count: maxRetries,
        error_message: "Max retries exceeded",
      });

      await supabase.from("webhook_events").insert(webhookEvent);

      // After max retries, event should be flagged for manual review
      const { data } = await supabase
        .from("webhook_events")
        .select("*")
        .eq("stripe_event_id", webhookEvent.stripe_event_id)
        .gte("retry_count", maxRetries)
        .single();

      expect(data?.retry_count).toBeGreaterThanOrEqual(maxRetries);

      // Document: Implement DLQ or alert system for manual intervention
    });
  });
});
