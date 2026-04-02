/**
 * RLS Policy Security Tests
 * Validates Row-Level Security policies for billing tables
 *
 * Execution classification: fail-fast on missing real infra.
 * This suite only runs in real integration mode and intentionally throws when
 * VALUEOS_TEST_REAL_INTEGRATION + Supabase env vars are unavailable.
 *
 * CRITICAL: These tests verify that multi-tenant data isolation is properly enforced.
 * Failures here could lead to data breaches and unauthorized access to billing information.
 */

// @vitest-environment node

import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createBillingCustomer,
  createInvoice,
  createSubscription,
  createUsageEvent,
} from "../__helpers__/billing-factories";
import {
  cleanupBillingTables,
  createTestUser,
  executeAsUser,
  getTestSupabaseClient,
  seedTestData,
  supabaseAvailable
} from "../__helpers__/db-helpers";

// Fail hard if Supabase is unavailable — a missing secret must not produce a
// green CI run with zero tests executed. Set VALUEOS_TEST_REAL_INTEGRATION=true
// and provide SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in CI secrets.
if (!supabaseAvailable) {
  throw new Error(
    "RLS Policy Security Tests require a real Supabase instance. " +
    "Set VALUEOS_TEST_REAL_INTEGRATION=true and provide SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY."
  );
}

describe("RLS Policy Security Tests", () => {
  let supabase: SupabaseClient;
  let tenant1Id: string;
  let tenant2Id: string;
  let user1Id: string;
  let user2Id: string;
  let user1Email: string;
  let user2Email: string;

  beforeEach(async () => {
    supabase = getTestSupabaseClient();
    await cleanupBillingTables(supabase);

    // Create two separate tenants
    tenant1Id = `tenant_${Date.now()}_1`;
    tenant2Id = `tenant_${Date.now()}_2`;

    // Create users for each tenant
    const user1 = await createTestUser(supabase, "user1@test.com", tenant1Id);
    const user2 = await createTestUser(supabase, "user2@test.com", tenant2Id);

    user1Id = user1.userId;
    user2Id = user2.userId;
    user1Email = user1.email;
    user2Email = user2.email;
  });

  afterEach(async () => {
    await cleanupBillingTables(supabase);
  });

  describe("billing_customers table", () => {
    it("should prevent cross-tenant access to billing customers", async () => {
      // Seed data for two different tenants
      const customer1 = createBillingCustomer({ tenant_id: tenant1Id });
      const customer2 = createBillingCustomer({ tenant_id: tenant2Id });

      await seedTestData(supabase, {
        customers: [customer1, customer2],
      });

      // Service role should see both
      const { data: allCustomers } = await supabase.from("billing_customers").select("*");

      expect(allCustomers).toHaveLength(2);

      // Check RLS for user1 (must only see tenant1 data)
      await executeAsUser(
        { id: user1Id, email: user1Email, tenantId: tenant1Id },
        async (client) => {
          const { data, error } = await client.from("billing_customers").select("*");

          expect(error).toBeNull();
          expect(data).toHaveLength(1);
          expect(data?.[0].tenant_id).toBe(tenant1Id);

          const tenant2Data = data?.filter((c) => c.tenant_id === tenant2Id);
          expect(tenant2Data).toHaveLength(0);
        }
      );
    });

    it("should allow users to view their own tenant billing data", async () => {
      const customer = createBillingCustomer({ tenant_id: tenant1Id });

      const { error } = await supabase.from("billing_customers").insert(customer);

      expect(error).toBeNull();

      await executeAsUser(
        { id: user1Id, email: user1Email, tenantId: tenant1Id },
        async (client) => {
          const { data, error } = await client
            .from("billing_customers")
            .select("*")
            .eq("tenant_id", tenant1Id)
            .single();

          expect(error).toBeNull();
          expect(data).toBeTruthy();
          expect(data?.tenant_id).toBe(tenant1Id);
        }
      );
    });

    it("should prevent users from modifying other tenant billing data", async () => {
      const customer1 = createBillingCustomer({ tenant_id: tenant1Id });
      const customer2 = createBillingCustomer({ tenant_id: tenant2Id });

      await seedTestData(supabase, {
        customers: [customer1, customer2],
      });

      // Attempt to update another tenant's customer as user1
      await executeAsUser(
        { id: user1Id, email: user1Email, tenantId: tenant1Id },
        async (client) => {
          const { error, count } = await client
            .from("billing_customers")
            .update({ status: "suspended" })
            .eq("tenant_id", tenant2Id)
            .select("id", { count: "exact" });

          expect(error).toBeNull();
          expect(count).toBe(0);
        }
      );
    });
  });

  describe("subscriptions table", () => {
    it("should isolate subscription data by tenant", async () => {
      const customer1 = createBillingCustomer({ tenant_id: tenant1Id });
      const customer2 = createBillingCustomer({ tenant_id: tenant2Id });

      const subscription1 = createSubscription({
        tenant_id: tenant1Id,
        billing_customer_id: customer1.id,
      });

      const subscription2 = createSubscription({
        tenant_id: tenant2Id,
        billing_customer_id: customer2.id,
      });

      await seedTestData(supabase, {
        customers: [customer1, customer2],
        subscriptions: [subscription1, subscription2],
      });

      // Filter by tenant should only return that tenant's subscriptions
      await executeAsUser(
        { id: user1Id, email: user1Email, tenantId: tenant1Id },
        async (client) => {
          const { data: tenant1Subs } = await client
            .from("subscriptions")
            .select("*")
            .eq("tenant_id", tenant1Id);

          expect(tenant1Subs).toHaveLength(1);
          expect(tenant1Subs?.[0].tenant_id).toBe(tenant1Id);

          // Should not see tenant2 subs
          const { data: tenant2Subs } = await client
            .from("subscriptions")
            .select("*")
            .eq("tenant_id", tenant2Id);

          expect(tenant2Subs).toHaveLength(0);
        }
      );
    });

    it("should prevent unauthorized subscription creation for other tenants", async () => {
      const customer = createBillingCustomer({ tenant_id: tenant2Id });

      await seedTestData(supabase, { customers: [customer] });

      // Attempting to create subscription for another tenant
      const maliciousSubscription = createSubscription({
        tenant_id: tenant2Id,
        billing_customer_id: customer.id,
      });

      // With proper RLS as user1, this should fail
      await executeAsUser(
        { id: user1Id, email: user1Email, tenantId: tenant1Id },
        async (client) => {
          const { error } = await client.from("subscriptions").insert(maliciousSubscription);

          expect(error).toBeTruthy();
          expect(error?.code).toBe("42501");
        }
      );
    });
  });

  describe("usage_events table", () => {
    it("should prevent users from viewing other tenant usage events", async () => {
      const events1 = Array.from({ length: 5 }, () =>
        createUsageEvent("llm_tokens", 100, { tenant_id: tenant1Id })
      );

      const events2 = Array.from({ length: 3 }, () =>
        createUsageEvent("llm_tokens", 100, { tenant_id: tenant2Id })
      );

      await seedTestData(supabase, {
        usageEvents: [...events1, ...events2],
      });

      // Query for tenant1 events
      await executeAsUser(
        { id: user1Id, email: user1Email, tenantId: tenant1Id },
        async (client) => {
          const { data: tenant1Events } = await client
            .from("usage_events")
            .select("*")
            .eq("tenant_id", tenant1Id);

          expect(tenant1Events).toHaveLength(5);
          expect(tenant1Events?.every((e) => e.tenant_id === tenant1Id)).toBe(true);

          // Should not see tenant2 events
          const { data: tenant2Events } = await client
            .from("usage_events")
            .select("*")
            .eq("tenant_id", tenant2Id);

          expect(tenant2Events).toHaveLength(0);
        }
      );
    });

    it("should prevent users from injecting usage events for other tenants", async () => {
      const maliciousEvent = createUsageEvent("llm_tokens", 999999, {
        tenant_id: tenant2Id,
        metadata: { attack: "unauthorized_usage" },
      });

      // With proper RLS, user1 should not be able to insert for tenant2
      await executeAsUser(
        { id: user1Id, email: user1Email, tenantId: tenant1Id },
        async (client) => {
          const { error } = await client.from("usage_events").insert(maliciousEvent);

          expect(error).toBeTruthy();
          expect(error?.code).toBe("42501");
        }
      );
    });
  });

  describe("invoices table", () => {
    it("should isolate invoice data by tenant", async () => {
      const customer1 = createBillingCustomer({ tenant_id: tenant1Id });
      const customer2 = createBillingCustomer({ tenant_id: tenant2Id });

      const invoice1 = createInvoice({
        tenant_id: tenant1Id,
        billing_customer_id: customer1.id,
      });

      const invoice2 = createInvoice({
        tenant_id: tenant2Id,
        billing_customer_id: customer2.id,
      });

      await seedTestData(supabase, {
        customers: [customer1, customer2],
        invoices: [invoice1, invoice2],
      });

      // Each tenant should only see their own invoices
      await executeAsUser(
        { id: user1Id, email: user1Email, tenantId: tenant1Id },
        async (client) => {
          const { data: tenant1Invoices } = await client
            .from("invoices")
            .select("*")
            .eq("tenant_id", tenant1Id);

          expect(tenant1Invoices).toHaveLength(1);
          expect(tenant1Invoices?.[0].tenant_id).toBe(tenant1Id);

          // Should not see tenant2 invoices
          const { data: tenant2Invoices } = await client
            .from("invoices")
            .select("*")
            .eq("tenant_id", tenant2Id);

          expect(tenant2Invoices).toHaveLength(0);
        }
      );
    });

    it("should prevent access to invoice PDFs and hosted URLs of other tenants", async () => {
      const customer = createBillingCustomer({ tenant_id: tenant2Id });
      const invoice = createInvoice({
        tenant_id: tenant2Id,
        billing_customer_id: customer.id,
        invoice_pdf_url: "https://invoice.stripe.com/secret/tenant2_invoice.pdf",
        hosted_invoice_url: "https://invoice.stripe.com/secret/tenant2",
      });

      await seedTestData(supabase, {
        customers: [customer],
        invoices: [invoice],
      });

      // Attempt to query invoice for other tenant
      await executeAsUser(
        { id: user1Id, email: user1Email, tenantId: tenant1Id },
        async (client) => {
          const { data: leakedInvoice } = await client
            .from("invoices")
            .select("invoice_pdf_url, hosted_invoice_url")
            .eq("tenant_id", tenant2Id)
            .single();

          expect(leakedInvoice).toBeNull();
        }
      );
    });
  });

  describe("usage_quotas table", () => {
    it("should prevent users from viewing other tenant quotas", async () => {
      const customer1 = createBillingCustomer({ tenant_id: tenant1Id });
      const customer2 = createBillingCustomer({ tenant_id: tenant2Id });
      const sub1 = createSubscription({
        tenant_id: tenant1Id,
        billing_customer_id: customer1.id,
      });
      const sub2 = createSubscription({
        tenant_id: tenant2Id,
        billing_customer_id: customer2.id,
      });

      const quota1 = {
        tenant_id: tenant1Id,
        subscription_id: sub1.id,
        metric: "llm_tokens" as const,
        quota_amount: 1000000,
        hard_cap: false,
        current_usage: 500000,
        period_start: new Date().toISOString(),
        period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      };

      const quota2 = {
        ...quota1,
        tenant_id: tenant2Id,
        subscription_id: sub2.id,
        current_usage: 900000,
      };

      await seedTestData(supabase, {
        customers: [customer1, customer2],
        subscriptions: [sub1, sub2],
        usageQuotas: [quota1, quota2],
      });

      await executeAsUser(
        { id: user1Id, email: user1Email, tenantId: tenant1Id },
        async (client) => {
          const { data: tenant1Quotas } = await client
            .from("usage_quotas")
            .select("*")
            .eq("tenant_id", tenant1Id);

          expect(tenant1Quotas).toHaveLength(1);
          expect(tenant1Quotas?.[0].current_usage).toBe(500000);

          // Should not see tenant2 quotas
          const { data: tenant2Quotas } = await client
            .from("usage_quotas")
            .select("*")
            .eq("tenant_id", tenant2Id);

          expect(tenant2Quotas).toHaveLength(0);
        }
      );
    });

    it("should prevent users from modifying other tenant quotas", async () => {
      const customer = createBillingCustomer({ tenant_id: tenant2Id });
      const subscription = createSubscription({
        tenant_id: tenant2Id,
        billing_customer_id: customer.id,
      });

      const quota = {
        tenant_id: tenant2Id,
        subscription_id: subscription.id,
        metric: "llm_tokens" as const,
        quota_amount: 100000,
        hard_cap: true,
        current_usage: 0,
        period_start: new Date().toISOString(),
        period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      };

      await seedTestData(supabase, {
        customers: [customer],
        subscriptions: [subscription],
        usageQuotas: [quota],
      });

      // Attempt to increase another tenant's quota (privilege escalation attack)
      await executeAsUser(
        { id: user1Id, email: user1Email, tenantId: tenant1Id },
        async (client) => {
          const { error, count } = await client
            .from("usage_quotas")
            .update({ quota_amount: 999999999 })
            .eq("tenant_id", tenant2Id)
            .select("id", { count: "exact" });

          expect(error).toBeNull();
          expect(count).toBe(0);
        }
      );
    });
  });

  describe("Admin access", () => {
    it("should allow admins to access all tenant data", async () => {
      const customer1 = createBillingCustomer({ tenant_id: tenant1Id });
      const customer2 = createBillingCustomer({ tenant_id: tenant2Id });

      await seedTestData(supabase, {
        customers: [customer1, customer2],
      });

      // Admin (service role) should see all customers
      const { data: allCustomers, error } = await supabase.from("billing_customers").select("*");

      if (error) {
        console.error("Admin access failed:", error);
      }

      expect(allCustomers).toHaveLength(2);
      expect(allCustomers?.map((c) => c.tenant_id).sort()).toEqual([tenant1Id, tenant2Id].sort());
    });
  });
});
