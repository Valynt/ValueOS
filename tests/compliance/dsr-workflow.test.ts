/**
 * Data Subject Request (DSR) workflow tests.
 *
 * Validates GDPR Art. 15 (export) and Art. 17 (erasure) behaviors against a
 * real Supabase instance when service credentials are available.
 */

import crypto from "node:crypto";

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

type EraseSummary = {
  anonymized_to: string;
  erased_at: string;
  pii_assets_included: string[];
  pii_assets_excluded: Array<{ asset: string; reason: string }>;
  scrubbed_counts: Record<string, number>;
  deleted_counts: Record<string, number>;
  idempotent_replay?: boolean;
};

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

  async function resetSubjectData() {
    if (skip()) return;

    await adminClient
      .from("users")
      .update({
        email: testEmail,
        full_name: "DSR Test User",
        display_name: "DSR Tester",
        avatar_url: null,
        metadata: {},
      })
      .eq("id", testUserId)
      .eq("tenant_id", testTenantId);

    await adminClient
      .from("messages")
      .update({
        content: "Sensitive message content",
        metadata: {},
      })
      .eq("user_id", testUserId)
      .eq("tenant_id", testTenantId);
  }

  async function callEraseUserPii(requestToken: string) {
    return adminClient.rpc("erase_user_pii", {
      p_tenant_id: testTenantId,
      p_user_id: testUserId,
      p_redacted_ts: new Date().toISOString(),
      p_request_token: requestToken,
    });
  }

  beforeAll(async () => {
    if (skip()) return;

    const serviceKey =
      process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!;
    adminClient = createClient(process.env.VITE_SUPABASE_URL!, serviceKey);

    testTenantId = crypto.randomUUID();

    await adminClient.from("tenants").insert({
      id: testTenantId,
      name: "DSR Test Tenant",
      slug: `dsr-test-${Date.now()}`,
      status: "active",
    });

    const { data: user, error } = await adminClient.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: { tenant_id: testTenantId },
    });
    if (error) throw error;
    testUserId = user.user.id;

    await adminClient.from("users").insert({
      id: testUserId,
      email: testEmail,
      tenant_id: testTenantId,
      full_name: "DSR Test User",
      display_name: "DSR Tester",
    });

    await adminClient.from("messages").insert({
      user_id: testUserId,
      tenant_id: testTenantId,
      content: "Sensitive message content",
      role: "user",
      metadata: {},
    });
  });

  beforeEach(async () => {
    if (skip()) return;
    await resetSubjectData();
    await adminClient.from("dsr_erasure_requests").delete().eq("tenant_id", testTenantId);
  });

  afterAll(async () => {
    if (!adminClient) return;
    await adminClient.from("dsr_erasure_requests").delete().eq("tenant_id", testTenantId);
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

    const tables = [
      { table: "users", col: "id" },
      { table: "messages", col: "user_id" },
    ];

    for (const { table, col } of tables) {
      const { data } = await adminClient.from(table).select("*").eq(col, testUserId);
      expect(data).toBeDefined();
      expect(data!.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("should anonymize the user profile and scrub message content through erase_user_pii", async () => {
    if (skip()) return;

    const { data, error } = await callEraseUserPii(`erase-${crypto.randomUUID()}`);

    expect(error).toBeNull();

    const summary = data as EraseSummary;
    expect(summary.anonymized_to).toBe(`deleted+${testUserId}@redacted.local`);
    expect(summary.scrubbed_counts.users).toBe(1);
    expect(summary.scrubbed_counts.messages).toBeGreaterThanOrEqual(1);

    const { data: updated } = await adminClient
      .from("users")
      .select("*")
      .eq("id", testUserId)
      .maybeSingle();

    expect(updated?.email).toBe(`deleted+${testUserId}@redacted.local`);
    expect(updated?.full_name).toBeNull();
    expect(updated?.display_name).toBeNull();
    expect((updated?.metadata as Record<string, unknown>)?.anonymized).toBe(true);

    const { data: messages } = await adminClient
      .from("messages")
      .select("content")
      .eq("user_id", testUserId);

    expect(messages?.every((message) => message.content === "[redacted]"))?.toBe(true);
  });

  it("rolls back the erase transaction when a forced mid-step failure is injected", async () => {
    if (skip()) return;

    const requestToken = `erase-fail-${crypto.randomUUID()}`;
    await adminClient.from("dsr_erasure_requests").insert({
      tenant_id: testTenantId,
      user_id: testUserId,
      request_type: "erase",
      request_token: requestToken,
      status: "pending",
      test_fail_after_step: "after_messages",
    });

    const { error } = await callEraseUserPii(requestToken);

    expect(error).toBeTruthy();
    expect(error?.message).toContain("Forced DSR erasure failure after messages step");

    const { data: user } = await adminClient
      .from("users")
      .select("email, full_name, display_name, metadata")
      .eq("id", testUserId)
      .maybeSingle();

    expect(user?.email).toBe(testEmail);
    expect(user?.full_name).toBe("DSR Test User");
    expect((user?.metadata as Record<string, unknown>)?.anonymized).toBeUndefined();

    const { data: messages } = await adminClient
      .from("messages")
      .select("content")
      .eq("user_id", testUserId)
      .eq("tenant_id", testTenantId);

    expect(messages?.every((message) => message.content === "Sensitive message content"))?.toBe(true);
  });

  it("completes a retry once the failure is cleared and replays the stored summary on duplicate retry", async () => {
    if (skip()) return;

    const requestToken = `erase-retry-${crypto.randomUUID()}`;
    await adminClient.from("dsr_erasure_requests").insert({
      tenant_id: testTenantId,
      user_id: testUserId,
      request_type: "erase",
      request_token: requestToken,
      status: "pending",
      test_fail_after_step: "after_messages",
    });

    const firstAttempt = await callEraseUserPii(requestToken);
    expect(firstAttempt.error).toBeTruthy();

    await adminClient
      .from("dsr_erasure_requests")
      .update({ status: "failed", last_error: firstAttempt.error?.message, test_fail_after_step: null })
      .eq("tenant_id", testTenantId)
      .eq("request_type", "erase")
      .eq("request_token", requestToken);

    const secondAttempt = await callEraseUserPii(requestToken);
    expect(secondAttempt.error).toBeNull();

    const secondSummary = secondAttempt.data as EraseSummary;
    expect(secondSummary.idempotent_replay).toBe(false);
    expect(secondSummary.scrubbed_counts.users).toBe(1);

    const thirdAttempt = await callEraseUserPii(requestToken);
    expect(thirdAttempt.error).toBeNull();

    const replaySummary = thirdAttempt.data as EraseSummary;
    expect(replaySummary.idempotent_replay).toBe(true);
    expect(replaySummary.anonymized_to).toBe(`deleted+${testUserId}@redacted.local`);

    const { data: requestRecord } = await adminClient
      .from("dsr_erasure_requests")
      .select("status, result_summary, last_error")
      .eq("tenant_id", testTenantId)
      .eq("request_type", "erase")
      .eq("request_token", requestToken)
      .maybeSingle();

    expect(requestRecord?.status).toBe("completed");
    expect((requestRecord?.result_summary as EraseSummary | null)?.anonymized_to).toBe(
      `deleted+${testUserId}@redacted.local`,
    );
    expect(requestRecord?.last_error).toBeNull();
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
    expect((logs![0].event_data as Record<string, unknown>)?.target_email).toBe(testEmail);
  });
});
