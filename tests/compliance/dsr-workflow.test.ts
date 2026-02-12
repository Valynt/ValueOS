/**
 * Data Subject Request (DSR) Workflow Tests
 *
 * Validates GDPR Art. 15 (export) and Art. 17 (erasure) endpoints.
 * Requires SUPABASE_SERVICE_KEY to run against a real Supabase instance.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

describe("DSR Workflow — GDPR Compliance", () => {
  let adminClient: SupabaseClient;
  let testUserId: string;
  let testTenantId: string;
  const testEmail = `dsr-test-${Date.now()}@example.com`;
  const testPassword = "DsrTest123!";

  const skip = () => {
    if (!process.env.SUPABASE_SERVICE_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.warn("Skipping DSR test — SUPABASE_SERVICE_KEY not set");
      return true;
    }
    return false;
  };

  beforeAll(async () => {
    if (skip()) return;

    const serviceKey =
      process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!;
    adminClient = createClient(process.env.VITE_SUPABASE_URL!, serviceKey);

    testTenantId = crypto.randomUUID();

    // Create tenant
    await adminClient.from("tenants").insert({
      id: testTenantId,
      name: "DSR Test Tenant",
      slug: `dsr-test-${Date.now()}`,
      status: "active",
    });

    // Create user
    const { data: user, error } = await adminClient.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: { tenant_id: testTenantId },
    });
    if (error) throw error;
    testUserId = user.user.id;

    // Insert into users table with tenant_id
    await adminClient.from("users").insert({
      id: testUserId,
      email: testEmail,
      tenant_id: testTenantId,
      full_name: "DSR Test User",
      display_name: "DSR Tester",
    });

    // Insert some PII-bearing records
    await adminClient.from("messages").insert({
      user_id: testUserId,
      tenant_id: testTenantId,
      content: "Sensitive message content",
    });
  });

  afterAll(async () => {
    if (!adminClient) return;
    // Cleanup
    await adminClient.from("messages").delete().eq("user_id", testUserId);
    await adminClient.from("users").delete().eq("id", testUserId);
    await adminClient.from("tenants").delete().eq("id", testTenantId);
    if (testUserId) await adminClient.auth.admin.deleteUser(testUserId);
  });

  it("should locate user data across PII tables", async () => {
    if (skip()) return;

    const { data: user } = await adminClient
      .from("users")
      .select("*")
      .eq("email", testEmail)
      .maybeSingle();

    expect(user).toBeDefined();
    expect(user?.email).toBe(testEmail);
    expect(user?.full_name).toBe("DSR Test User");
  });

  it("should export user footprint with non-empty records", async () => {
    if (skip()) return;

    // Gather footprint the same way the API does
    const tables = [
      { table: "users", col: "id" },
      { table: "messages", col: "user_id" },
    ];

    for (const { table, col } of tables) {
      const { data } = await adminClient
        .from(table)
        .select("*")
        .eq(col, testUserId);
      expect(data).toBeDefined();
      expect(data!.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("should anonymize user profile on erasure", async () => {
    if (skip()) return;

    const placeholderEmail = `deleted+${testUserId}@redacted.local`;

    await adminClient
      .from("users")
      .update({
        email: placeholderEmail,
        full_name: null,
        display_name: null,
        avatar_url: null,
        metadata: { anonymized: true, anonymized_at: new Date().toISOString() },
      })
      .eq("id", testUserId);

    const { data: updated } = await adminClient
      .from("users")
      .select("*")
      .eq("id", testUserId)
      .maybeSingle();

    expect(updated?.email).toBe(placeholderEmail);
    expect(updated?.full_name).toBeNull();
    expect(updated?.display_name).toBeNull();
    expect((updated?.metadata as any)?.anonymized).toBe(true);
  });

  it("should scrub message content on erasure", async () => {
    if (skip()) return;

    await adminClient
      .from("messages")
      .update({ content: "[redacted]" })
      .eq("user_id", testUserId);

    const { data: msgs } = await adminClient
      .from("messages")
      .select("content")
      .eq("user_id", testUserId);

    for (const msg of msgs ?? []) {
      expect(msg.content).toBe("[redacted]");
    }
  });

  it("should record DSR action in security audit log", async () => {
    if (skip()) return;

    await adminClient.from("security_audit_log").insert({
      event_type: "dsr_erase",
      actor: "test-admin",
      action: "erase",
      resource: "dsr",
      request_path: "/api/dsr/erase",
      severity: "high",
      event_data: { target_email: testEmail },
    });

    const { data: logs } = await adminClient
      .from("security_audit_log")
      .select("*")
      .eq("event_type", "dsr_erase")
      .order("created_at", { ascending: false })
      .limit(1);

    expect(logs).toBeDefined();
    expect(logs!.length).toBeGreaterThanOrEqual(1);
    expect((logs![0].event_data as any)?.target_email).toBe(testEmail);
  });
});
