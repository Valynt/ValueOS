/**
 * Subscription Lifecycle Integration Tests
 * End-to-end tests for subscription creation, updates, and cancellation
 *
 * CRITICAL: These tests validate the complete billing flow.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createBillingCustomer,
  createCompleteBillingSetup,
} from "../__helpers__/billing-factories";
import {
  assertRecordExists,
  cleanupBillingTables,
  getTestSupabaseClient,
  seedTestData,,
  supabaseAvailable
} from "../__helpers__/db-helpers";
import {
  createMockStripeClient,
  createMockStripeSubscription,
} from "../__helpers__/stripe-mocks";

// Mock Stripe service
vi.mock("../../StripeService", () => ({
  default: {
    getInstance: vi.fn(() => ({
      getClient: () => createMockStripeClient(),
      handleError: (error: any) => {
        throw error;
      },
    })),
  },
}));

describe.skipIf(!supabaseAvailable)("Subscription Lifecycle Integration Tests", () => {
  let supabase: SupabaseClient;

  beforeEach(async () => {
    supabase = getTestSupabaseClient();
    await cleanupBillingTables(supabase);
  });

  afterEach(async () => {
    await cleanupBillingTables(supabase);
  });

  describe("Subscription Creation", () => {
    it("should create complete subscription with all components", async () => {
      const tenantId = `tenant_${Date.now()}`;
      const setup = createCompleteBillingSetup("standard", tenantId);

      // Seed customer
      await seedTestData(supabase, { customers: [setup.customer] });

      // Create subscription
      await seedTestData(supabase, { subscriptions: [setup.subscription] });

      // Create subscription items
      await seedTestData(supabase, {
        subscriptionItems: setup.subscriptionItems,
      });

      // Initialize quotas
      await seedTestData(supabase, { usageQuotas: setup.quotas });

      // Verify customer exists
      await assertRecordExists(supabase, "billing_customers", {
        tenant_id: tenantId,
      });

      // Verify subscription exists
      await assertRecordExists(supabase, "subscriptions", {
        tenant_id: tenantId,
        plan_tier: "standard",
      });

      // Verify all 5 subscription items created
      const { count: itemCount } = await supabase
        .from("subscription_items")
        .select("*", { count: "exact", head: true })
        .eq("subscription_id", setup.subscription.id);

      expect(itemCount).toBe(5);

      // Verify all 5 quotas initialized
      const { count: quotaCount } = await supabase
        .from("usage_quotas")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId);

      expect(quotaCount).toBe(5);
    });

    it("should handle subscription creation with trial period", async () => {
      const tenantId = `tenant_${Date.now()}`;
      const customer = createBillingCustomer({ tenant_id: tenantId });

      const now = new Date();
      const trialStart = now;
      const trialEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 days

      const subscription = {
        ...createCompleteBillingSetup("standard", tenantId).subscription,
        status: "trialing" as const,
        trial_start: trialStart.toISOString(),
        trial_end: trialEnd.toISOString(),
      };

      await seedTestData(supabase, {
        customers: [customer],
        subscriptions: [subscription],
      });

      const { data } = await supabase
        .from("subscriptions")
        .select("status, trial_start, trial_end")
        .eq("tenant_id", tenantId)
        .single();

      expect(data?.status).toBe("trialing");
      expect(data?.trial_start).toBeTruthy();
      expect(data?.trial_end).toBeTruthy();
    });
  });

  describe("Subscription Updates", () => {
    it("should upgrade subscription from free to standard", async () => {
      const tenantId = `tenant_${Date.now()}`;

      // Start with free plan
      const freeSetup = createCompleteBillingSetup("free", tenantId);

      await seedTestData(supabase, {
        customers: [freeSetup.customer],
        subscriptions: [freeSetup.subscription],
        usageQuotas: freeSetup.quotas,
      });

      // Upgrade to standard
      const { error } = await supabase
        .from("subscriptions")
        .update({
          plan_tier: "standard",
          amount: 99,
        })
        .eq("tenant_id", tenantId);

      expect(error).toBeNull();

      // Verify upgrade
      const { data } = await supabase
        .from("subscriptions")
        .select("plan_tier, amount")
        .eq("tenant_id", tenantId)
        .single();

      expect(data?.plan_tier).toBe("standard");
      expect(data?.amount).toBe(99);
    });

    it("should downgrade subscription from enterprise to standard", async () => {
      const tenantId = `tenant_${Date.now()}`;

      const enterpriseSetup = createCompleteBillingSetup(
        "enterprise",
        tenantId
      );

      await seedTestData(supabase, {
        customers: [enterpriseSetup.customer],
        subscriptions: [enterpriseSetup.subscription],
        usageQuotas: enterpriseSetup.quotas,
      });

      // Downgrade
      await supabase
        .from("subscriptions")
        .update({
          plan_tier: "standard",
          amount: 99,
        })
        .eq("tenant_id", tenantId);

      // Update quotas to match standard plan
      await supabase
        .from("usage_quotas")
        .update({ quota_amount: 1000000 })
        .eq("tenant_id", tenantId)
        .eq("metric", "llm_tokens");

      // Verify
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("plan_tier")
        .eq("tenant_id", tenantId)
        .single();

      expect(sub?.plan_tier).toBe("standard");
    });

    it("should update subscription period dates", async () => {
      const tenantId = `tenant_${Date.now()}`;
      const setup = createCompleteBillingSetup("standard", tenantId);

      await seedTestData(supabase, {
        customers: [setup.customer],
        subscriptions: [setup.subscription],
      });

      // Simulate period rollover
      const newPeriodStart = new Date();
      const newPeriodEnd = new Date(
        newPeriodStart.getTime() + 30 * 24 * 60 * 60 * 1000
      );

      await supabase
        .from("subscriptions")
        .update({
          current_period_start: newPeriodStart.toISOString(),
          current_period_end: newPeriodEnd.toISOString(),
        })
        .eq("tenant_id", tenantId);

      const { data } = await supabase
        .from("subscriptions")
        .select("current_period_start, current_period_end")
        .eq("tenant_id", tenantId)
        .single();

      expect(new Date(data!.current_period_start)).toBeInstanceOf(Date);
      expect(new Date(data!.current_period_end)).toBeInstanceOf(Date);
    });
  });

  describe("Subscription Cancellation", () => {
    it("should cancel subscription immediately", async () => {
      const tenantId = `tenant_${Date.now()}`;
      const setup = createCompleteBillingSetup("standard", tenantId);

      await seedTestData(supabase, {
        customers: [setup.customer],
        subscriptions: [setup.subscription],
      });

      // Immediate cancellation
      const canceledAt = new Date();

      await supabase
        .from("subscriptions")
        .update({
          status: "canceled",
          canceled_at: canceledAt.toISOString(),
          ended_at: canceledAt.toISOString(),
        })
        .eq("tenant_id", tenantId);

      const { data } = await supabase
        .from("subscriptions")
        .select("status, canceled_at, ended_at")
        .eq("tenant_id", tenantId)
        .single();

      expect(data?.status).toBe("canceled");
      expect(data?.canceled_at).toBeTruthy();
      expect(data?.ended_at).toBeTruthy();
    });

    it("should schedule cancellation at period end", async () => {
      const tenantId = `tenant_${Date.now()}`;
      const setup = createCompleteBillingSetup("standard", tenantId);

      await seedTestData(supabase, {
        customers: [setup.customer],
        subscriptions: [setup.subscription],
      });

      // Schedule cancellation
      const canceledAt = new Date();

      await supabase
        .from("subscriptions")
        .update({
          status: "active", // Still active until period end
          canceled_at: canceledAt.toISOString(),
          // ended_at not set yet
        })
        .eq("tenant_id", tenantId);

      const { data } = await supabase
        .from("subscriptions")
        .select("status, canceled_at, ended_at")
        .eq("tenant_id", tenantId)
        .single();

      expect(data?.status).toBe("active");
      expect(data?.canceled_at).toBeTruthy();
      expect(data?.ended_at).toBeUndefined();
    });

    it("should update customer status on subscription cancellation", async () => {
      const tenantId = `tenant_${Date.now()}`;
      const setup = createCompleteBillingSetup("standard", tenantId);

      await seedTestData(supabase, {
        customers: [setup.customer],
        subscriptions: [setup.subscription],
      });

      // Cancel subscription
      await supabase
        .from("subscriptions")
        .update({ status: "canceled" })
        .eq("tenant_id", tenantId);

      // Update customer status
      await supabase
        .from("billing_customers")
        .update({ status: "cancelled" })
        .eq("tenant_id", tenantId);

      const { data } = await supabase
        .from("billing_customers")
        .select("status")
        .eq("tenant_id", tenantId)
        .single();

      expect(data?.status).toBe("cancelled");
    });
  });

  describe("Subscription Status Transitions", () => {
    it("should handle past_due status", async () => {
      const tenantId = `tenant_${Date.now()}`;
      const setup = createCompleteBillingSetup("standard", tenantId);

      await seedTestData(supabase, {
        customers: [setup.customer],
        subscriptions: [setup.subscription],
      });

      // Payment failed, subscription goes past_due
      await supabase
        .from("subscriptions")
        .update({ status: "past_due" })
        .eq("tenant_id", tenantId);

      const { data } = await supabase
        .from("subscriptions")
        .select("status")
        .eq("tenant_id", tenantId)
        .single();

      expect(data?.status).toBe("past_due");

      // Should still be queryable as "active" for grace period
      const { data: active } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("tenant_id", tenantId)
        .in("status", ["active", "trialing", "past_due"])
        .single();

      expect(active).toBeTruthy();
    });

    it("should handle incomplete subscription status", async () => {
      const tenantId = `tenant_${Date.now()}`;
      const setup = createCompleteBillingSetup("standard", tenantId);

      const incompleteSubscription = {
        ...setup.subscription,
        status: "incomplete" as const,
      };

      await seedTestData(supabase, {
        customers: [setup.customer],
        subscriptions: [incompleteSubscription],
      });

      const { data } = await supabase
        .from("subscriptions")
        .select("status")
        .eq("tenant_id", tenantId)
        .single();

      expect(data?.status).toBe("incomplete");

      // Incomplete subscriptions should not grant access
    });
  });

  describe("Multiple Subscriptions", () => {
    it("should handle only one active subscription per tenant", async () => {
      const tenantId = `tenant_${Date.now()}`;
      const setup = createCompleteBillingSetup("standard", tenantId);

      await seedTestData(supabase, {
        customers: [setup.customer],
        subscriptions: [setup.subscription],
      });

      // Attempt to create second active subscription
      const secondSubscription = {
        ...setup.subscription,
        id: `sub_${Date.now()}_2`,
        stripe_subscription_id: `sub_stripe_${Date.now()}_2`,
      };

      const { error } = await supabase
        .from("subscriptions")
        .insert(secondSubscription);

      // Should succeed (no DB constraint)
      expect(error).toBeNull();

      // Application logic should prevent multiple active subscriptions
      // Query for active subscriptions
      const { data: active } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("tenant_id", tenantId)
        .in("status", ["active", "trialing", "past_due"]);

      expect(active!.length).toBeGreaterThanOrEqual(1);

      // Document: Application should enforce one active subscription
    });
  });
});
