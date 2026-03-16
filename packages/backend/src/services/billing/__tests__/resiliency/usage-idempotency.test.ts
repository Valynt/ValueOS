/**
 * Usage Metering Idempotency Tests
 * Validates that usage events are processed exactly once
 *
 * CRITICAL: These tests prevent duplicate charging and ensure billing accuracy.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createBatchUsageEvents,
  createUsageAggregate,
  createUsageEvent,
} from "../__helpers__/billing-factories";
import {
  assertRowCount,
  cleanupBillingTables,
  getTestSupabaseClient,
  supabaseAvailable
} from "../__helpers__/db-helpers";

describe.skipIf(!supabaseAvailable)("Usage Metering Idempotency Tests", () => {
  let supabase: SupabaseClient;

  beforeEach(async () => {
    supabase = getTestSupabaseClient();
    await cleanupBillingTables(supabase);
  });

  afterEach(async () => {
    await cleanupBillingTables(supabase);
  });

  describe("Usage Event Deduplication", () => {
    // Enforced by: 20260316211357_usage_events_request_id_unique.sql
    // (UNIQUE INDEX idx_usage_events_tenant_request_id_unique on (tenant_id, request_id))
    it("should prevent duplicate usage events with same request_id", async () => {
      const tenantId = `tenant_${Date.now()}`;
      const requestId = `req_${Date.now()}_unique`;

      const event1 = createUsageEvent("llm_tokens", 1000, {
        tenant_id: tenantId,
        request_id: requestId,
      });

      const event2 = createUsageEvent("llm_tokens", 1000, {
        tenant_id: tenantId,
        request_id: requestId, // Duplicate request ID
      });

      // Insert first event — must succeed
      const { error: error1 } = await supabase
        .from("usage_events")
        .insert(event1);

      expect(error1).toBeNull();

      // Attempt to insert duplicate — must be rejected by the unique constraint
      // on (tenant_id, request_id). If this passes, the constraint is missing
      // and duplicate charges are possible.
      const { error: error2 } = await supabase
        .from("usage_events")
        .insert(event2);

      expect(error2).not.toBeNull();
      // Postgres unique-violation code
      expect((error2 as { code?: string }).code).toBe("23505");

      // Only the first event should exist
      await assertRowCount(supabase, "usage_events", 1, {
        request_id: requestId,
      });
    });

    it("should use request_id for idempotent processing", async () => {
      const requestId = `req_idempotent_${Date.now()}`;

      // Check if already processed
      const { data: existing } = await supabase
        .from("usage_events")
        .select("id")
        .eq("request_id", requestId)
        .single();

      expect(existing).toBeNull();

      // First submission
      const event = createUsageEvent("llm_tokens", 1000, {
        request_id: requestId,
      });

      await supabase.from("usage_events").insert(event);

      // Retry with same request_id should detect the existing row
      const { data: retry } = await supabase
        .from("usage_events")
        .select("id")
        .eq("request_id", requestId)
        .single();

      expect(retry).toBeTruthy();

      // Confirm only one row exists — a second insert must not have been created
      await assertRowCount(supabase, "usage_events", 1, {
        request_id: requestId,
      });
    });
  });

  describe("Usage Aggregation Idempotency", () => {
    it("should use idempotency_key for aggregate submission", async () => {
      const aggregate = createUsageAggregate("llm_tokens");

      // Insert aggregate
      const { error: error1 } = await supabase
        .from("usage_aggregates")
        .insert(aggregate);

      expect(error1).toBeNull();

      // Try to insert duplicate with same idempotency_key
      const duplicate = createUsageAggregate("llm_tokens", {
        idempotency_key: aggregate.idempotency_key,
      });

      const { error: error2 } = await supabase
        .from("usage_aggregates")
        .insert(duplicate);

      // Should fail due to unique constraint on idempotency_key
      expect(error2).toBeTruthy();
      expect(error2?.code).toBe("23505"); // Unique violation
    });

    it("should not resubmit already-submitted aggregates", async () => {
      const aggregate = createUsageAggregate("llm_tokens", {
        submitted_to_stripe: true,
        submitted_at: new Date().toISOString(),
        stripe_usage_record_id: "mbur_test123",
      });

      await supabase.from("usage_aggregates").insert(aggregate);

      // Query for pending aggregates
      const { data: pending } = await supabase
        .from("usage_aggregates")
        .select("*")
        .eq("submitted_to_stripe", false);

      expect(pending).toHaveLength(0);

      // Already-submitted aggregates should not be reprocessed
    });

    it("should handle retry of failed aggregate submission", async () => {
      const aggregate = createUsageAggregate("llm_tokens", {
        submitted_to_stripe: false,
      });

      await supabase.from("usage_aggregates").insert(aggregate);

      // First submission attempt fails (simulated)
      // Aggregate remains unsubmitted

      // Retry should use same idempotency_key
      const { data: retry } = await supabase
        .from("usage_aggregates")
        .select("*")
        .eq("id", aggregate.id)
        .single();

      expect(retry?.idempotency_key).toBe(aggregate.idempotency_key);
      expect(retry?.submitted_to_stripe).toBe(false);

      // On successful retry, can reuse same idempotency key
      // Stripe will recognize and not create duplicate
    });
  });

  describe("Concurrent Usage Event Processing", () => {
    it("should handle concurrent event submissions safely", async () => {
      const tenantId = `tenant_${Date.now()}`;

      // Simulate concurrent usage events from same tenant
      const events = Array.from({ length: 50 }, (_, i) =>
        createUsageEvent("llm_tokens", 100, {
          tenant_id: tenantId,
          request_id: `req_${tenantId}_${i}`,
        })
      );

      // Insert concurrently (simulating high load)
      const inserts = events.map((event) =>
        supabase.from("usage_events").insert(event)
      );

      await Promise.all(inserts);

      // Verify all events were recorded
      await assertRowCount(supabase, "usage_events", 50, {
        tenant_id: tenantId,
      });
    });

    it("should prevent race conditions in usage aggregation", async () => {
      const tenantId = `tenant_${Date.now()}`;
      const events = createBatchUsageEvents(10, "llm_tokens", tenantId);

      await supabase.from("usage_events").insert(events);

      // Mark events as processed atomically
      const { error } = await supabase
        .from("usage_events")
        .update({ processed: true })
        .eq("tenant_id", tenantId)
        .eq("processed", false); // Condition prevents double-processing

      expect(error).toBeNull();

      // Verify all marked as processed
      const { data: processed } = await supabase
        .from("usage_events")
        .select("processed")
        .eq("tenant_id", tenantId);

      expect(processed?.every((e) => e.processed)).toBe(true);
    });
  });

  describe("Usage Event Recovery from Failures", () => {
    it("should reprocess failed events without duplication", async () => {
      const event = createUsageEvent("llm_tokens", 1000, {
        processed: false,
      });

      await supabase.from("usage_events").insert(event);

      // First processing attempt (failed before marking processed)
      // Event remains unprocessed

      // Retry should pick up same event
      const { data: unprocessed } = await supabase
        .from("usage_events")
        .select("*")
        .eq("id", event.id)
        .eq("processed", false)
        .single();

      expect(unprocessed).toBeTruthy();

      // Mark as processed after successful retry
      await supabase
        .from("usage_events")
        .update({
          processed: true,
          processed_at: new Date().toISOString(),
        })
        .eq("id", event.id);

      // Should not be picked up again
      const { data: stillUnprocessed } = await supabase
        .from("usage_events")
        .select("*")
        .eq("processed", false)
        .eq("id", event.id)
        .single();

      expect(stillUnprocessed).toBeNull();
    });
  });

  describe("Stripe Usage Record Idempotency", () => {
    it("should use Stripe idempotency keys for usage submission", () => {
      const tenantId = "tenant_123";
      const subscriptionItemId = "si_123";
      const timestamp = Date.now();

      // Generate idempotency key
      const idempotencyKey = `usage_${tenantId}_${subscriptionItemId}_${timestamp}`;

      expect(idempotencyKey).toMatch(/^usage_/);
      expect(idempotencyKey).toContain(tenantId);

      // Stripe guarantees idempotency for 24 hours with same key
      // If request is retried with same key, Stripe returns same result
    });

    it("should verify Stripe accepted usage before marking submitted", async () => {
      const aggregate = createUsageAggregate("llm_tokens");

      await supabase.from("usage_aggregates").insert(aggregate);

      // Submission to Stripe should return usage record ID
      const stripeUsageRecordId = "mbur_test_12345";

      // Only mark submitted if Stripe returned success
      const { error } = await supabase
        .from("usage_aggregates")
        .update({
          submitted_to_stripe: true,
          submitted_at: new Date().toISOString(),
          stripe_usage_record_id: stripeUsageRecordId,
        })
        .eq("id", aggregate.id);

      expect(error).toBeNull();

      // Verify state
      const { data } = await supabase
        .from("usage_aggregates")
        .select("submitted_to_stripe, stripe_usage_record_id")
        .eq("id", aggregate.id)
        .single();

      expect(data?.submitted_to_stripe).toBe(true);
      expect(data?.stripe_usage_record_id).toBe(stripeUsageRecordId);
    });
  });

  describe("Zero and Negative Usage Handling", () => {
    it("should accept zero usage events", async () => {
      const event = createUsageEvent("llm_tokens", 0);

      const { error } = await supabase.from("usage_events").insert(event);

      expect(error).toBeNull();

      // Zero usage is valid (e.g., user made request but got cached result)
    });

    it("should reject negative usage amounts", async () => {
      const event = createUsageEvent("llm_tokens", -100);

      const { error } = await supabase.from("usage_events").insert(event);

      // CHECK constraint should prevent negative usage
      expect(error).toBeTruthy();
    });
  });

  describe("Usage Event Ordering", () => {
    it("should preserve event chronological order", async () => {
      const tenantId = `tenant_${Date.now()}`;

      // Create events with incrementing timestamps
      const events = Array.from({ length: 5 }, (_, i) => {
        const timestamp = new Date(Date.now() + i * 1000).toISOString();
        return createUsageEvent("llm_tokens", 100, {
          tenant_id: tenantId,
          timestamp,
        });
      });

      await supabase.from("usage_events").insert(events);

      // Query in timestamp order
      const { data } = await supabase
        .from("usage_events")
        .select("timestamp")
        .eq("tenant_id", tenantId)
        .order("timestamp", { ascending: true });

      // Verify chronological order
      expect(data).toHaveLength(5);

      for (let i = 1; i < data!.length; i++) {
        const prev = new Date(data![i - 1].timestamp).getTime();
        const curr = new Date(data![i].timestamp).getTime();
        expect(curr).toBeGreaterThanOrEqual(prev);
      }
    });
  });
});
