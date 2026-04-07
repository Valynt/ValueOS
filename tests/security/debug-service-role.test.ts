import { createClient } from "@supabase/supabase-js";
import { describe, expect, it, beforeAll } from "vitest";
import crypto from "crypto";

describe("Debug Supabase Service Role", () => {
  let adminClient: ReturnType<typeof createClient>;

  beforeAll(() => {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceKey =
      process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

    console.log("URL:", supabaseUrl);
    console.log("Key present:", !!serviceKey);
    console.log("Key length:", serviceKey?.length);
    console.log("Key first 50:", serviceKey?.substring(0, 50));

    if (!supabaseUrl || !serviceKey) {
      throw new Error("Missing env vars");
    }

    adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  });

  it("should insert into webhook_events with service role", async () => {
    const testId = crypto.randomUUID();
    const { data, error } = await adminClient
      .from("webhook_events")
      .insert({
        id: testId,
        tenant_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12",
        stripe_event_id: "evt_test_debug_" + testId,
        event_type: "invoice.payment_succeeded",
        payload: { test: "data" },
        processed: false,
      })
      .select();

    console.log("Result:", { data, error });
    expect(error).toBeNull();
    expect(data).toBeDefined();
  });

  it("should insert into agent_sessions with service role", async () => {
    const testId = crypto.randomUUID();
    const { data, error } = await adminClient
      .from("agent_sessions")
      .insert({
        id: testId,
        user_id: "test-user-id",
        session_token: "test-token-" + testId,
        tenant_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12",
        organization_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12",
        agent_id: "test-agent",
        status: "active",
      })
      .select();

    console.log("Result:", { data, error });
    expect(error).toBeNull();
    expect(data).toBeDefined();
  });
});
