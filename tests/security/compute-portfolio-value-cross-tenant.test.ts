/**
 * Cross-tenant isolation test for compute_portfolio_value()
 *
 * Verifies that the patched function (20260328000000) prevents a user in
 * tenant A from reading portfolio data belonging to tenant B by passing
 * tenant B's ID as the p_tenant_id argument.
 *
 * Requires a live Supabase instance with:
 *   VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   SUPABASE_ANON_KEY
 *
 * Skipped automatically when these env vars are absent (unit CI).
 * Runs in the tenant-isolation-gate CI job which sets them.
 */

import crypto from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// ─── env guard ───────────────────────────────────────────────────────────────

const SUPABASE_URL        = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY    = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY            = process.env.SUPABASE_ANON_KEY;

const SKIP = !SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY;

// ─── fixture ─────────────────────────────────────────────────────────────────

interface UserCtx {
  userId:      string;
  tenantId:    string;
  accessToken: string;
  client:      SupabaseClient;
}

async function bootstrapUser(
  admin:    SupabaseClient,
  tenantId: string,
  label:    string,
): Promise<UserCtx> {
  const email    = `portfolio-test-${label}-${Date.now()}@example.com`;
  const password = "TestPassword123!";

  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !created.user) throw new Error(`createUser failed: ${error?.message}`);

  // Register membership in user_tenants (the RLS authority).
  const { error: membershipError } = await admin.from("user_tenants").insert({
    user_id:   created.user.id,
    tenant_id: tenantId,
    status:    "active",
    role:      "member",
  });
  if (membershipError) {
    throw new Error(`user_tenants insert failed: ${membershipError.message}`);
  }

  // Sign in to get a real JWT.
  const anonClient = createClient(SUPABASE_URL!, ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: session, error: signInError } = await anonClient.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError || !session.session) {
    throw new Error(`signIn failed: ${signInError?.message}`);
  }

  const client = createClient(SUPABASE_URL!, ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${session.session.access_token}` } },
  });

  return {
    userId:      created.user.id,
    tenantId,
    accessToken: session.session.access_token,
    client,
  };
}

// ─── tests ───────────────────────────────────────────────────────────────────

describe.skipIf(SKIP)("compute_portfolio_value — cross-tenant isolation", () => {
  let admin:   SupabaseClient;
  let userA:   UserCtx;
  let userB:   UserCtx;
  let tenantA: string;
  let tenantB: string;

  // IDs to clean up after the suite.
  const cleanupUserIds:   string[] = [];
  const cleanupTenantIds: string[] = [];
  const cleanupCaseIds:   string[] = [];

  beforeAll(async () => {
    admin   = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!);
    tenantA = crypto.randomUUID();
    tenantB = crypto.randomUUID();

    // Provision tenants.
    await admin.from("tenants").insert([
      { id: tenantA, name: `Test Tenant A ${Date.now()}`, status: "active" },
      { id: tenantB, name: `Test Tenant B ${Date.now()}`, status: "active" },
    ]);
    cleanupTenantIds.push(tenantA, tenantB);

    userA = await bootstrapUser(admin, tenantA, "a");
    userB = await bootstrapUser(admin, tenantB, "b");
    cleanupUserIds.push(userA.userId, userB.userId);

    // Insert a value_case for tenant B so there is data to potentially leak.
    const { data: inserted, error: caseError } = await admin
      .from("value_cases")
      .insert({
        organization_id: tenantB,
        tenant_id:       tenantB,
        name:            "Tenant B confidential case",
        status:          "committed",
        quality_score:   0.9,
        metadata:        { projected_value: 999999 },
      })
      .select("id")
      .single();

    if (caseError || !inserted) {
      throw new Error(`Failed to seed value_case: ${caseError?.message}`);
    }
    cleanupCaseIds.push(inserted.id);
  });

  afterAll(async () => {
    // Clean up in dependency order.
    if (cleanupCaseIds.length) {
      await admin.from("value_cases").delete().in("id", cleanupCaseIds);
    }
    for (const uid of cleanupUserIds) {
      await admin.from("user_tenants").delete().eq("user_id", uid);
      await admin.auth.admin.deleteUser(uid);
    }
    if (cleanupTenantIds.length) {
      await admin.from("tenants").delete().in("id", cleanupTenantIds);
    }
  });

  it("returns real data when the user requests their own tenant", async () => {
    const { data, error } = await userB.client.rpc("compute_portfolio_value", {
      p_tenant_id: tenantB,
    });

    expect(error).toBeNull();
    // Tenant B has one published case with projected_value 999999.
    expect(data).toBeDefined();
    expect((data as { caseCount: number }).caseCount).toBe(1);
    expect((data as { totalValue: number }).totalValue).toBe(999999);
  });

  it("returns zero values when user A requests tenant B's portfolio", async () => {
    // This is the cross-tenant attack vector. Before the patch, this would
    // return tenant B's real data. After the patch it must return zeros.
    const { data, error } = await userA.client.rpc("compute_portfolio_value", {
      p_tenant_id: tenantB,
    });

    expect(error).toBeNull();

    const result = data as { totalValue: number; caseCount: number; avgConfidence: number };
    expect(result.caseCount).toBe(0);
    expect(result.totalValue).toBe(0);
    expect(result.avgConfidence).toBe(0);
  });

  it("returns zero values when called with a completely unknown tenant ID", async () => {
    const unknownTenant = crypto.randomUUID();

    const { data, error } = await userA.client.rpc("compute_portfolio_value", {
      p_tenant_id: unknownTenant,
    });

    expect(error).toBeNull();

    const result = data as { totalValue: number; caseCount: number; avgConfidence: number };
    expect(result.caseCount).toBe(0);
    expect(result.totalValue).toBe(0);
  });

  it("returns an error when called without authentication", async () => {
    // Unauthenticated call — auth.uid() returns NULL, function must raise.
    const anonClient = createClient(SUPABASE_URL!, ANON_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data, error } = await anonClient.rpc("compute_portfolio_value", {
      p_tenant_id: tenantB,
    });

    // Expect either an error or empty/zero result — never real data.
    if (error) {
      expect(error.message).toMatch(/unauthenticated|insufficient_privilege|permission denied/i);
    } else {
      const result = data as { caseCount: number };
      expect(result.caseCount).toBe(0);
    }
  });
});
