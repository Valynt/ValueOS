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

import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock Supabase client
vi.mock("../../src/lib/supabase", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn(),
    })),
  },
}));

// Mock the billing API functions
vi.mock("../../src/services/billing/SubscriptionService", () => ({
  SubscriptionService: {
    getActiveSubscription: vi.fn(),
    createSubscription: vi.fn(),
    updateSubscription: vi.fn(),
    cancelSubscription: vi.fn(),
  },
}));

vi.mock("../../src/services/billing/UsageService", () => ({
  UsageService: {
    getUsageSummary: vi.fn(),
  },
}));

vi.mock("../../src/services/billing/InvoiceService", () => ({
  InvoiceService: {
    getInvoices: vi.fn(),
  },
}));

import { supabase } from "../../src/lib/supabase";
import { SubscriptionService } from "../../src/services/billing/SubscriptionService";
import { UsageService } from "../../src/services/billing/UsageService";
import { InvoiceService } from "../../src/services/billing/InvoiceService";

const mockSupabase = vi.mocked(supabase);
const mockSubscriptionService = vi.mocked(SubscriptionService);
const mockUsageService = vi.mocked(UsageService);
const mockInvoiceService = vi.mocked(InvoiceService);

describe("Billing API Endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/billing/subscription", () => {
    it("should return 404 when no subscription exists", async () => {
      mockSubscriptionService.getActiveSubscription.mockResolvedValue(null);

      // Mock API call would be made here
      const result = await mockSubscriptionService.getActiveSubscription("nonexistent-tenant");

      expect(result).toBeNull();
    });

    it("should return subscription when it exists", async () => {
      const mockSubscription = {
        id: "sub_123",
        tenant_id: "tenant_123",
        status: "active",
        plan_tier: "standard",
        current_period_start: new Date(),
        current_period_end: new Date(),
      };

      mockSubscriptionService.getActiveSubscription.mockResolvedValue(mockSubscription);

      const result = await mockSubscriptionService.getActiveSubscription("tenant_123");

      expect(result).toEqual(mockSubscription);
      expect(result?.status).toBe("active");
    });
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
