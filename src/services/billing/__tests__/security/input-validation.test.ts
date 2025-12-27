/**
 * SQL Injection and Input Validation Tests
 * Validates that billing system properly sanitizes and validates all inputs
 *
 * CRITICAL: These tests prevent SQL injection and data corruption attacks.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  getTestSupabaseClient,
  cleanupBillingTables,
  seedTestData,
} from "../__helpers__/db-helpers";
import {
  createBillingCustomer,
  createUsageEvent,
} from "../__helpers__/billing-factories";
import type { SupabaseClient } from "@supabase/supabase-js";

describe("SQL Injection and Input Validation Tests", () => {
  let supabase: SupabaseClient;

  beforeEach(async () => {
    supabase = getTestSupabaseClient();
    await cleanupBillingTables(supabase);
  });

  afterEach(async () => {
    await cleanupBillingTables(supabase);
  });

  describe("Customer Data Input Validation", () => {
    it("should prevent SQL injection in organization name", async () => {
      const sqlInjectionAttempts = [
        "'; DROP TABLE billing_customers; --",
        "' OR '1'='1",
        "admin'--",
        "' UNION SELECT * FROM users--",
        "1'; UPDATE billing_customers SET status='active' WHERE '1'='1",
      ];

      for (const maliciousName of sqlInjectionAttempts) {
        const customer = createBillingCustomer({
          organization_name: maliciousName,
        });

        // Insert should succeed (parameterized queries prevent injection)
        const { error } = await supabase
          .from("billing_customers")
          .insert(customer);

        expect(error).toBeNull();

        // Verify data is stored literally, not executed
        const { data } = await supabase
          .from("billing_customers")
          .select("organization_name")
          .eq("id", customer.id)
          .single();

        expect(data?.organization_name).toBe(maliciousName);

        // Cleanup
        await supabase.from("billing_customers").delete().eq("id", customer.id);
      }
    });

    it("should prevent SQL injection in email field", async () => {
      const maliciousEmails = [
        "test@example.com'; DROP TABLE billing_customers--",
        "' OR 1=1--@example.com",
        "admin@example.com' UNION SELECT password FROM users--",
      ];

      for (const maliciousEmail of maliciousEmails) {
        const customer = createBillingCustomer({
          stripe_customer_email: maliciousEmail,
        });

        const { error } = await supabase
          .from("billing_customers")
          .insert(customer);

        expect(error).toBeNull();

        // Cleanup
        await supabase.from("billing_customers").delete().eq("id", customer.id);
      }
    });

    it("should handle special characters in metadata", async () => {
      const specialCharMetadata = {
        notes: 'Customer\'s "special" <notes> & comments',
        query: "SELECT * FROM users WHERE id = 'test'",
        script: "<script>alert('XSS')</script>",
        unicode: "Hello 世界 🌍",
      };

      const customer = createBillingCustomer({
        metadata: specialCharMetadata,
      });

      const { error } = await supabase
        .from("billing_customers")
        .insert(customer);

      expect(error).toBeNull();

      const { data } = await supabase
        .from("billing_customers")
        .select("metadata")
        .eq("id", customer.id)
        .single();

      expect(data?.metadata).toEqual(specialCharMetadata);
    });
  });

  describe("Usage Event Input Validation", () => {
    it("should reject negative usage amounts", async () => {
      const negativeUsage = createUsageEvent("llm_tokens", -1000);

      const { error } = await supabase
        .from("usage_events")
        .insert(negativeUsage);

      // Check constraint should prevent negative amounts
      expect(error).toBeTruthy();
      expect(error?.message).toContain("amount");
    });

    it("should handle extremely large usage amounts", async () => {
      const largeUsage = createUsageEvent("llm_tokens", 999999999999);

      const { error } = await supabase.from("usage_events").insert(largeUsage);

      // Should succeed (DECIMAL(15,4) can handle this)
      expect(error).toBeNull();
    });

    it("should prevent SQL injection in request_id", async () => {
      const maliciousRequestIds = [
        "req_123'; DELETE FROM usage_events--",
        "req_123' OR '1'='1",
        "req_123'; UPDATE usage_quotas SET quota_amount=999999999--",
      ];

      for (const requestId of maliciousRequestIds) {
        const event = createUsageEvent("llm_tokens", 100, {
          request_id: requestId,
        });

        const { error } = await supabase.from("usage_events").insert(event);

        expect(error).toBeNull();

        // Verify stored literally
        const { data } = await supabase
          .from("usage_events")
          .select("request_id")
          .eq("id", event.id)
          .single();

        expect(data?.request_id).toBe(requestId);

        // Cleanup
        await supabase.from("usage_events").delete().eq("id", event.id);
      }
    });

    it("should validate metric enum values", async () => {
      const invalidMetric = "invalid_metric_name" as any;

      const event = createUsageEvent(invalidMetric, 100);

      const { error } = await supabase.from("usage_events").insert(event);

      // CHECK constraint should reject invalid metric
      expect(error).toBeTruthy();
    });

    it("should sanitize metadata JSON in events", async () => {
      const maliciousMetadata = {
        sql: "'; DROP TABLE usage_events; --",
        xss: "<img src=x onerror=alert('XSS')>",
        path: "../../../etc/passwd",
        command: "$(rm -rf /)",
      };

      const event = createUsageEvent("llm_tokens", 100, {
        metadata: maliciousMetadata,
      });

      const { error } = await supabase.from("usage_events").insert(event);

      expect(error).toBeNull();

      // JSONB stores data safely
      const { data } = await supabase
        .from("usage_events")
        .select("metadata")
        .eq("id", event.id)
        .single();

      expect(data?.metadata).toEqual(maliciousMetadata);
    });
  });

  describe("Subscription Input Validation", () => {
    it("should validate subscription status enum", async () => {
      const customer = createBillingCustomer();
      await seedTestData(supabase, { customers: [customer] });

      const invalidSubscription = {
        billing_customer_id: customer.id,
        tenant_id: customer.tenant_id,
        stripe_subscription_id: "sub_test",
        stripe_customer_id: customer.stripe_customer_id,
        plan_tier: "standard",
        billing_period: "monthly",
        status: "hacked" as any, // Invalid status
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000
        ).toISOString(),
        amount: 99,
        currency: "usd",
      };

      const { error } = await supabase
        .from("subscriptions")
        .insert(invalidSubscription);

      // CHECK constraint should reject
      expect(error).toBeTruthy();
    });

    it("should validate plan_tier enum", async () => {
      const customer = createBillingCustomer();
      await seedTestData(supabase, { customers: [customer] });

      const invalidSubscription = {
        billing_customer_id: customer.id,
        tenant_id: customer.tenant_id,
        stripe_subscription_id: "sub_test",
        stripe_customer_id: customer.stripe_customer_id,
        plan_tier: "ultimate_premium" as any, // Invalid tier
        billing_period: "monthly",
        status: "active",
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000
        ).toISOString(),
        amount: 99,
        currency: "usd",
      };

      const { error } = await supabase
        .from("subscriptions")
        .insert(invalidSubscription);

      // CHECK constraint should reject
      expect(error).toBeTruthy();
    });
  });

  describe("Unicode and International Character Handling", () => {
    it("should handle international organization names", async () => {
      const internationalNames = [
        "Société Française",
        "日本企業株式会社",
        "Компания Россия",
        "شركة العربية",
        "Empresa Española",
        "Firma Österreich",
      ];

      for (const name of internationalNames) {
        const customer = createBillingCustomer({
          organization_name: name,
        });

        const { error } = await supabase
          .from("billing_customers")
          .insert(customer);

        expect(error).toBeNull();

        const { data } = await supabase
          .from("billing_customers")
          .select("organization_name")
          .eq("id", customer.id)
          .single();

        expect(data?.organization_name).toBe(name);

        // Cleanup
        await supabase.from("billing_customers").delete().eq("id", customer.id);
      }
    });

    it("should handle emoji and special unicode in metadata", async () => {
      const emojiMetadata = {
        feedback: "⭐⭐⭐⭐⭐ Excellent service! 🎉",
        location: "📍 New York, USA 🇺🇸",
        notes: "Customer wants: ✅ Premium, ❌ Basic",
      };

      const customer = createBillingCustomer({
        metadata: emojiMetadata,
      });

      const { error } = await supabase
        .from("billing_customers")
        .insert(customer);

      expect(error).toBeNull();

      const { data } = await supabase
        .from("billing_customers")
        .select("metadata")
        .eq("id", customer.id)
        .single();

      expect(data?.metadata).toEqual(emojiMetadata);
    });
  });

  describe("Boundary Value Testing", () => {
    it("should handle zero usage amount", async () => {
      const zeroUsage = createUsageEvent("llm_tokens", 0);

      const { error } = await supabase.from("usage_events").insert(zeroUsage);

      expect(error).toBeNull();
    });

    it("should handle maximum decimal precision for usage", async () => {
      const preciseUsage = createUsageEvent("storage_gb", 123.4567);

      const { error } = await supabase
        .from("usage_events")
        .insert(preciseUsage);

      expect(error).toBeNull();

      const { data } = await supabase
        .from("usage_events")
        .select("amount")
        .eq("id", preciseUsage.id)
        .single();

      // DECIMAL(15,4) should store 4 decimal places
      expect(data?.amount).toBeCloseTo(123.4567, 4);
    });

    it("should handle maximum length organization names", async () => {
      // Assuming TEXT column with practical limit
      const longName = "A".repeat(500);

      const customer = createBillingCustomer({
        organization_name: longName,
      });

      const { error } = await supabase
        .from("billing_customers")
        .insert(customer);

      expect(error).toBeNull();
    });
  });

  describe("NoSQL Injection in JSONB Fields", () => {
    it("should prevent NoSQL injection in metadata queries", async () => {
      const customer = createBillingCustomer({
        metadata: {
          plan: "free",
          $where: "function() { return true; }", // MongoDB-style injection
        },
      });

      await seedTestData(supabase, { customers: [customer] });

      // Query using metadata should be safe
      const { data } = await supabase
        .from("billing_customers")
        .select("*")
        .eq("metadata->plan", "free");

      expect(data).toBeTruthy();
      // PostreSQL JSONB queries are safe from this type of injection
    });
  });
});
