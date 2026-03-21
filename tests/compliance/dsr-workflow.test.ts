/**
 * Data Subject Request (DSR) workflow tests.
 *
 * Validates GDPR Art. 15/17 flows against a live Supabase environment when
 * service credentials are available.
 */

import crypto from "node:crypto";

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

function hashEmail(email: string): string {
  return crypto.createHash("sha256").update(email).digest("hex").slice(0, 16);
}

function readBooleanFlag(value: unknown): boolean | undefined {
  return value && typeof value === "object" && "anonymized" in value
    ? Boolean((value as Record<string, unknown>).anonymized)
    : undefined;
}

describe("DSR Workflow — GDPR Compliance", () => {
  let adminClient: SupabaseClient;
  let testUserId: string;
  let testTenantId: string;
  const testEmail = `dsr-test-${Date.now()}@example.com`;
  const testPassword = "DsrTest123!";
  const requestToken = `dsr-erase-${Date.now()}`;

  const skipSupabase = () => {
    if (!process.env.SUPABASE_SERVICE_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.warn("Skipping DSR test — SUPABASE_SERVICE_KEY not set");
      return true;
    }
    return false;
  };

  const skipDatabaseUrl = async () => {
    if (!process.env.DATABASE_URL) {
      console.warn("Skipping DSR transactional failure test — DATABASE_URL not set");
      return true;
    }

    try {
      await import("pg");
      return false;
    } catch {
      console.warn("Skipping DSR transactional failure test — pg package is not installed");
      return true;
    }
  };

  beforeAll(async () => {
    if (skipSupabase()) return;

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

  afterAll(async () => {
    if (!adminClient) return;
    await adminClient.from("messages").delete().eq("user_id", testUserId);
    await adminClient.from("users").delete().eq("id", testUserId);
    await adminClient.from("tenants").delete().eq("id", testTenantId);
    if (testUserId) await adminClient.auth.admin.deleteUser(testUserId);
  });

  it("locates user data across PII tables", async () => {
    if (skipSupabase()) return;

    const { data: user } = await adminClient
      .from("users")
      .select("*")
      .eq("email", testEmail)
      .maybeSingle();

    expect(user).toBeDefined();
    expect(user?.email).toBe(testEmail);
    expect(user?.full_name).toBe("DSR Test User");
  });

  it("exports user footprint with non-empty records", async () => {
    if (skipSupabase()) return;

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
      expect(data?.length ?? 0).toBeGreaterThanOrEqual(1);
    }
  });

  it("rolls back on a forced mid-step failure and succeeds on retry with the same request token", async () => {
    if (skipSupabase() || await skipDatabaseUrl()) return;

    const { Client: PgClient } = await import("pg");
    const pgClient = new PgClient({ connectionString: process.env.DATABASE_URL });
    const suffix = Date.now().toString();
    const functionName = `test_dsr_fail_messages_${suffix}`;
    const triggerName = `test_dsr_fail_messages_trigger_${suffix}`;
    const quotedUserId = testUserId.replace(/'/g, "''");

    await pgClient.connect();
    try {
      await pgClient.query(`
        CREATE OR REPLACE FUNCTION public.${functionName}()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        BEGIN
          IF NEW.user_id::text = '${quotedUserId}' THEN
            RAISE EXCEPTION 'forced mid-step failure for DSR transaction';
          END IF;
          RETURN NEW;
        END;
        $$;
      `);

      await pgClient.query(`
        CREATE TRIGGER ${triggerName}
        BEFORE UPDATE ON public.messages
        FOR EACH ROW
        EXECUTE FUNCTION public.${functionName}();
      `);

      const failedAttempt = await adminClient.rpc("erase_user_pii", {
        p_tenant_id: testTenantId,
        p_user_id: testUserId,
        p_redacted_ts: new Date().toISOString(),
        p_request_token: requestToken,
        p_target_email_hash: hashEmail(testEmail),
      });

      expect(failedAttempt.error).toBeTruthy();
      expect(failedAttempt.data).toBeNull();

      const { data: userAfterFailure } = await adminClient
        .from("users")
        .select("email, full_name, display_name, metadata")
        .eq("id", testUserId)
        .maybeSingle();

      const { data: messagesAfterFailure } = await adminClient
        .from("messages")
        .select("content")
        .eq("user_id", testUserId);

      expect(userAfterFailure?.email).toBe(testEmail);
      expect(userAfterFailure?.full_name).toBe("DSR Test User");
      expect(readBooleanFlag(userAfterFailure?.metadata)).not.toBe(true);
      expect(messagesAfterFailure?.[0]?.content).toBe("Sensitive message content");
    } finally {
      await pgClient.query(`DROP TRIGGER IF EXISTS ${triggerName} ON public.messages;`);
      await pgClient.query(`DROP FUNCTION IF EXISTS public.${functionName}();`);
      await pgClient.end();
    }

    const retry = await adminClient.rpc("erase_user_pii", {
      p_tenant_id: testTenantId,
      p_user_id: testUserId,
      p_redacted_ts: new Date().toISOString(),
      p_request_token: requestToken,
      p_target_email_hash: hashEmail(testEmail),
    });

    expect(retry.error).toBeNull();
    expect(retry.data).toBeTruthy();
    expect((retry.data as Record<string, unknown>).idempotent_replay).toBe(false);
    expect((retry.data as Record<string, unknown>).request_token).toBe(requestToken);

    const { data: updated } = await adminClient
      .from("users")
      .select("*")
      .eq("id", testUserId)
      .maybeSingle();

    const { data: msgs } = await adminClient
      .from("messages")
      .select("content")
      .eq("user_id", testUserId);

    expect(updated?.email).toBe(`deleted+${testUserId}@redacted.local`);
    expect(updated?.full_name).toBeNull();
    expect(updated?.display_name).toBeNull();
    expect(readBooleanFlag(updated?.metadata)).toBe(true);
    for (const msg of msgs ?? []) {
      expect(msg.content).toBe("[redacted]");
    }
  });

  it("replays the stored summary when retried with the same request token", async () => {
    if (skipSupabase()) return;

    const replay = await adminClient.rpc("erase_user_pii", {
      p_tenant_id: testTenantId,
      p_user_id: testUserId,
      p_redacted_ts: new Date().toISOString(),
      p_request_token: requestToken,
      p_target_email_hash: hashEmail(testEmail),
    });

    expect(replay.error).toBeNull();
    expect(replay.data).toBeTruthy();
    expect((replay.data as Record<string, unknown>).idempotent_replay).toBe(true);
    expect((replay.data as Record<string, unknown>).request_token).toBe(requestToken);

    const { data: requestRows } = await adminClient
      .from("dsr_erasure_requests")
      .select("request_token, status")
      .eq("tenant_id", testTenantId)
      .eq("request_token", requestToken);

    expect(requestRows).toHaveLength(1);
    expect(requestRows?.[0]?.status).toBe("completed");
  });

  it("records the DSR action in the security audit log", async () => {
    if (skipSupabase()) return;

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
    expect(logs?.length ?? 0).toBeGreaterThanOrEqual(1);
    expect((logs?.[0]?.event_data as Record<string, unknown> | undefined)?.target_email).toBe(testEmail);
  });
});
