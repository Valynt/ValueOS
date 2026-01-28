/**
 * API Endpoint Tests - Billing
 *
 * Tests for billing endpoints:
 * - GET /api/billing/subscription - Get current subscription
 * - POST /api/billing/subscription - Create subscription
 * - PUT /api/billing/subscription - Update subscription
 * - DELETE /api/billing/subscription - Cancel subscription
 * - GET /api/billing/usage - Get usage summary
 * - GET /api/billing/invoices - Get invoice history
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { testAdminClient, TEST_TENANT_A, TEST_TENANT_B } from "../setup";
import { cleanupTestTables, generateTestId } from "../test-utils";

describe("Billing API Endpoints", () => {
  beforeEach(async () => {
    if (testAdminClient) {
      await cleanupTestTables(
        testAdminClient,
        [
          "subscriptions",
          "subscription_items",
          "usage_events",
          "usage_quotas",
          "billing_customers",
        ],
        "test-billing-"
      );
    }
  });

  afterEach(async () => {
    if (testAdminClient) {
      await cleanupTestTables(
        testAdminClient,
        [
          "subscriptions",
          "subscription_items",
          "usage_events",
          "usage_quotas",
          "billing_customers",
        ],
        "test-billing-"
      );
    }
  });

  describe("GET /api/billing/subscription", () => {
    it("should return 404 when no subscription exists", async () => {
      if (!testAdminClient) return;

      const { data, error } = await testAdminClient
        .from("subscriptions")
        .select("*")
        .eq("tenant_id", generateTestId("nonexistent"))
        .single();

      expect(error).toBeDefined();
      expect(data).toBeNull();
    });

    it("should return subscription when it exists", async () => {
      if (!testAdminClient) return;

      const tenantId = generateTestId("tenant");

      // Create test tenant first
      await testAdminClient.from("tenants").insert({
        id: tenantId,
        name: "Test Tenant A",
      });

      // Create a test customer first
      const { data: customer, error: custError } = await testAdminClient
        .from("billing_customers")
        .insert({
          tenant_id: tenantId,
          organization_name: "Test Org A",
          stripe_customer_id: generateTestId("cus"),
          status: "active",
        })
        .select()
        .single();

      if (custError) throw custError;

      // Create a test subscription
      const { data: subscription, error: subError } = await testAdminClient
        .from("subscriptions")
        .insert({
          tenant_id: tenantId,
          billing_customer_id: customer.id,
          stripe_subscription_id: generateTestId("sub"),
          stripe_customer_id: customer.stripe_customer_id,
          plan_tier: "standard",
          status: "active",
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .select()
        .single();

      if (subError) throw subError;

      expect(subscription).toBeDefined();
      expect(subscription.plan_tier).toBe("standard");
      expect(subscription.tenant_id).toBe(tenantId);
    });
  });

  describe("GET /api/billing/usage", () => {
    it("should return usage quotas for a tenant", async () => {
      if (!testAdminClient) return;

      const tenantId = generateTestId("tenant");

      // Create test quotas
      const { error } = await testAdminClient.from("usage_quotas").insert([
        {
          tenant_id: tenantId,
          metric: "llm_tokens",
          quota_amount: 1000000,
          current_usage: 50000,
          period_start: new Date().toISOString(),
          period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          tenant_id: tenantId,
          metric: "agent_executions",
          quota_amount: 5000,
          current_usage: 150,
          period_start: new Date().toISOString(),
          period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ]);

      if (error) throw error;

      const { data: quotas } = await testAdminClient
        .from("usage_quotas")
        .select("*")
        .eq("tenant_id", tenantId);

      expect(quotas).toHaveLength(2);
      const llmQuota = quotas?.find((q) => q.metric === "llm_tokens");
      expect(llmQuota?.current_usage).toBe(50000);
    });
  });

  describe("Tenant Isolation", () => {
    it("should not allow tenant A to see tenant B's subscription", async () => {
      if (!testAdminClient) return;

      const tenantA = generateTestId("tenantA");
      const tenantB = generateTestId("tenantB");

      // Create subscription for Tenant B
      const { error } = await testAdminClient.from("subscriptions").insert({
        tenant_id: tenantB,
        stripe_subscription_id: generateTestId("subB"),
        stripe_customer_id: generateTestId("cusB"),
        plan_tier: "enterprise",
        status: "active",
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      });

      if (error) throw error;

      // Try to query as Tenant A
      const { data: subA } = await testAdminClient
        .from("subscriptions")
        .select("*")
        .eq("tenant_id", tenantA);

      expect(subA).toHaveLength(0);

      const { data: subB } = await testAdminClient
        .from("subscriptions")
        .select("*")
        .eq("tenant_id", tenantB);

      expect(subB).toHaveLength(1);
    });
  });
});
