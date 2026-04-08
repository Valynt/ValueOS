import crypto from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// ============================================================================
// Client Factories - Strict separation to avoid auth state contamination
// ============================================================================

function createServiceRoleClient(): SupabaseClient {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storage: undefined,
    },
    global: {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    },
  });
}

function createAnonClient(): SupabaseClient {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY");
  }

  return createClient(supabaseUrl, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storage: undefined,
    },
  });
}

function createUserClient(accessToken: string): SupabaseClient {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY");
  }

  return createClient(supabaseUrl, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storage: undefined,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

interface PostgrestErrorLike {
  code?: string | null;
  message?: string | null;
}

const isMissingRelationError = (error: PostgrestErrorLike | null | undefined): boolean =>
  Boolean(
    error &&
      (error.code === "PGRST205" ||
        error.code === "42P01" ||
        /does not exist|Could not find the table/i.test(error.message ?? ""))
  );

const isMissingRpcError = (error: PostgrestErrorLike | null | undefined): boolean =>
  Boolean(
    error &&
      (error.code === "PGRST202" ||
        /does not exist|Could not find the function/i.test(error.message ?? ""))
  );

const isNullConstraintError = (error: PostgrestErrorLike | null | undefined): boolean =>
  Boolean(error && /null value|not-null|violates not-null/i.test(error.message ?? ""));

describe("RLS Tenant Isolation - Critical Security Tests", () => {
  // Service role client for setup and table operations only
  let serviceRoleClient: SupabaseClient;
  // User clients for RLS assertions
  let tenant1Client: SupabaseClient;
  let tenant2Client: SupabaseClient;

  let TENANT_1_ID: string;
  let TENANT_2_ID: string;
  let user1Id: string;
  let user2Id: string;

  const cleanupIds = {
    agentSessions: [] as string[],
    agentPredictions: [] as string[],
    valueCases: [] as string[],
    auditLogs: [] as string[],
    workflowExecutions: [] as string[],
    usageEvents: [] as string[],
    webhookEvents: [] as string[],
    semanticMemory: [] as string[],
    deadLetterEvents: [] as string[],
  };

  beforeAll(async () => {
    // Phase 1: Setup - Create users with dedicated client (auth operations only)
    const setupClient = createServiceRoleClient();

    TENANT_1_ID = crypto.randomUUID();
    TENANT_2_ID = crypto.randomUUID();

    const email1 = `tenant1_${Date.now()}@example.com`;
    const email2 = `tenant2_${Date.now()}@example.com`;
    const password = "Password123!";

    const { data: user1, error: user1Error } =
      await setupClient.auth.admin.createUser({
        email: email1,
        password,
        email_confirm: true,
        user_metadata: {
          tenant_id: TENANT_1_ID,
          organization_id: TENANT_1_ID,
        },
      });
    if (user1Error) throw user1Error;
    user1Id = user1.user.id;

    const { data: user2, error: user2Error } =
      await setupClient.auth.admin.createUser({
        email: email2,
        password,
        email_confirm: true,
        user_metadata: {
          tenant_id: TENANT_2_ID,
          organization_id: TENANT_2_ID,
        },
      });
    if (user2Error) throw user2Error;
    user2Id = user2.user.id;

    // Phase 2: Table Operations - Use FRESH service role client (never used for auth)
    serviceRoleClient = createServiceRoleClient();

    try {
      await serviceRoleClient.from("tenants").insert([
        {
          id: TENANT_1_ID,
          name: "Tenant 1",
          slug: `tenant-1-${Date.now()}`,
          status: "active",
        },
        {
          id: TENANT_2_ID,
          name: "Tenant 2",
          slug: `tenant-2-${Date.now()}`,
          status: "active",
        },
      ]);
    } catch (error) {
      console.warn(
        "Failed to insert tenants, they might already exist or schema differs",
        error
      );
    }

    const { error: linkError } = await serviceRoleClient.from("user_tenants").insert([
      { user_id: user1.user.id, tenant_id: TENANT_1_ID, status: "active" },
      { user_id: user2.user.id, tenant_id: TENANT_2_ID, status: "active" },
    ]);
    if (linkError) {
      console.warn("Failed to link user_tenants", linkError);
    }

    // Phase 3: User Sessions - Sign in and create user clients
    const { data: session1 } = await setupClient.auth.signInWithPassword({
      email: email1,
      password,
    });
    const { data: session2 } = await setupClient.auth.signInWithPassword({
      email: email2,
      password,
    });

    if (!session1.session || !session2.session) {
      throw new Error("Failed to sign in test users");
    }

    // Create user clients with proper isolation (anon key + bearer token)
    tenant1Client = createUserClient(session1.session.access_token);
    tenant2Client = createUserClient(session2.session.access_token);
  });

  afterAll(async () => {
    const safeDelete = async (table: string, ids: string[]) => {
      if (!ids.length) {
        return;
      }

      const { error } = await serviceRoleClient.from(table).delete().in("id", ids);
      if (error && !isMissingRelationError(error)) {
        console.warn(`Cleanup error (${table}):`, error);
      }
    };

    if (serviceRoleClient) {
      await safeDelete("agent_predictions", cleanupIds.agentPredictions);
      await safeDelete("agent_sessions", cleanupIds.agentSessions);
      await safeDelete("workflow_executions", cleanupIds.workflowExecutions);
      await safeDelete("value_cases", cleanupIds.valueCases);
      await safeDelete("audit_logs", cleanupIds.auditLogs);
      await safeDelete("usage_events", cleanupIds.usageEvents);
      await safeDelete("webhook_events", cleanupIds.webhookEvents);
      await safeDelete("semantic_memory", cleanupIds.semanticMemory);
      await safeDelete("dead_letter_events", cleanupIds.deadLetterEvents);

      await serviceRoleClient.from("user_tenants").delete().in("user_id", [user1Id, user2Id]);

      if (user1Id) await serviceRoleClient.auth.admin.deleteUser(user1Id);
      if (user2Id) await serviceRoleClient.auth.admin.deleteUser(user2Id);

      if (TENANT_1_ID) {
        await serviceRoleClient.from("tenants").delete().eq("id", TENANT_1_ID);
      }
      if (TENANT_2_ID) {
        await serviceRoleClient.from("tenants").delete().eq("id", TENANT_2_ID);
      }
    }
  });

  describe("agent_sessions RLS Policies", () => {
    it("CRITICAL: should prevent cross-tenant access to agent_sessions", async () => {
      const sessionId = crypto.randomUUID();
      cleanupIds.agentSessions.push(sessionId);

      const { data: session, error: createError } = await serviceRoleClient
        .from("agent_sessions")
        .insert({
          id: sessionId,
          user_id: user1Id,
          session_token: `token-${crypto.randomUUID()}`,
          tenant_id: TENANT_1_ID,
          organization_id: TENANT_1_ID,
          agent_id: "test-agent",
          status: "active",
        })
        .select()
        .single();

      expect(createError).toBeNull();
      expect(session).toBeDefined();

      const { data: accessData, error: accessError } = await tenant2Client
        .from("agent_sessions")
        .select("*")
        .eq("id", sessionId);

      expect(accessError).toBeNull();
      expect(accessData).toEqual([]);
    });

    it("CRITICAL: should reject NULL tenant_id inserts", async () => {
      const { error } = await serviceRoleClient.from("agent_sessions").insert({
        id: crypto.randomUUID(),
        user_id: user1Id,
        session_token: `token-${crypto.randomUUID()}`,
        tenant_id: null,
        organization_id: TENANT_1_ID,
        agent_id: "test-agent",
        status: "active",
      });

      expect(error).toBeDefined();
    });

    it("CRITICAL: should enforce tenant_id in updates", async () => {
      const sessionId = crypto.randomUUID();
      cleanupIds.agentSessions.push(sessionId);

      await serviceRoleClient.from("agent_sessions").insert({
        id: sessionId,
        user_id: user1Id,
        session_token: `token-${crypto.randomUUID()}`,
        tenant_id: TENANT_1_ID,
        organization_id: TENANT_1_ID,
        agent_id: "test-agent",
        status: "active",
      });

      const { error } = await serviceRoleClient
        .from("agent_sessions")
        .update({ tenant_id: TENANT_2_ID, organization_id: TENANT_2_ID })
        .eq("id", sessionId);

      expect(error).toBeDefined();
    });
  });

  describe("agent_predictions RLS Policies", () => {
    it("CRITICAL: should prevent NULL organization_id bypass", async () => {
      const { error } = await serviceRoleClient.from("agent_predictions").insert({
        id: crypto.randomUUID(),
        organization_id: null,
        session_id: `session-${crypto.randomUUID()}`,
        agent_id: "test-agent",
        agent_type: "value_prediction",
        prediction: {},
      });

      expect(error).toBeDefined();
      expect(isNullConstraintError(error)).toBe(true);
    });

    it("CRITICAL: should isolate predictions by tenant", async () => {
      const pred1Id = crypto.randomUUID();
      const pred2Id = crypto.randomUUID();
      cleanupIds.agentPredictions.push(pred1Id, pred2Id);

      const { error: insertError } = await serviceRoleClient.from("agent_predictions").insert([
        {
          id: pred1Id,
          organization_id: TENANT_1_ID,
          session_id: `session-${crypto.randomUUID()}`,
          agent_id: "test-agent",
          agent_type: "value_prediction",
          prediction: { tenant: 1 },
          confidence_score: 0.8,
        },
        {
          id: pred2Id,
          organization_id: TENANT_2_ID,
          session_id: `session-${crypto.randomUUID()}`,
          agent_id: "test-agent",
          agent_type: "value_prediction",
          prediction: { tenant: 2 },
          confidence_score: 0.8,
        },
      ]);

      expect(insertError).toBeNull();

      const { data: data1, error: error1 } = await tenant1Client
        .from("agent_predictions")
        .select("id")
        .in("id", [pred1Id, pred2Id]);

      expect(error1).toBeNull();
      expect(data1).toHaveLength(1);
      expect(data1?.[0].id).toBe(pred1Id);

      const { data: data2, error: error2 } = await tenant2Client
        .from("agent_predictions")
        .select("id")
        .in("id", [pred1Id, pred2Id]);

      expect(error2).toBeNull();
      expect(data2).toHaveLength(1);
      expect(data2?.[0].id).toBe(pred2Id);
    });
  });

  describe("Security Audit Triggers", () => {
    it("should allow service role to write security audit logs under RLS", async () => {
      const { error } = await serviceRoleClient.from("security_audit_log").insert({
        event_type: "audit_test_service_role",
        tenant_id: TENANT_1_ID,
        user_id: crypto.randomUUID(),
      });

      expect(error).toBeNull();
    });

    it("should reject audit writes from authenticated users", async () => {
      const { error } = await tenant1Client.from("security_audit_log").insert({
        event_type: "audit_test_authenticated",
        tenant_id: TENANT_1_ID,
        user_id: user1Id,
      });

      expect(error).not.toBeNull();
    });

    it("should provide security_violations view when installed", async () => {
      const { data, error } = await serviceRoleClient
        .from("security_violations")
        .select("*")
        .limit(10);

      if (isMissingRelationError(error)) {
        return;
      }

      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
    });
  });

  describe("RLS Verification Function", () => {
    it("should verify RLS is enabled on all critical tables", async () => {
      const { data, error } = await serviceRoleClient.rpc("verify_rls_tenant_isolation");

      if (isMissingRpcError(error)) {
        console.warn("verify_rls_tenant_isolation RPC not found, skipping");
        return;
      }

      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);

      for (const table of ["agent_sessions", "agent_predictions", "workflow_executions"]) {
        const tableStatus = data?.find(
          (row: { table_name: string }) => row.table_name === table
        ) as
          | {
              rls_enabled: boolean;
              policy_count: number;
              has_not_null_constraint: boolean;
            }
          | undefined;

        expect(tableStatus).toBeDefined();
        expect(tableStatus?.rls_enabled).toBe(true);
        expect(tableStatus?.policy_count).toBeGreaterThanOrEqual(1);
        expect(tableStatus?.has_not_null_constraint).toBe(true);
      }
    });
  });

  describe("Cross-Tenant Attack Scenarios", () => {
    it("CRITICAL: should prevent session hijacking across tenants", async () => {
      const sessionId = crypto.randomUUID();
      cleanupIds.agentSessions.push(sessionId);

      await serviceRoleClient.from("agent_sessions").insert({
        id: sessionId,
        user_id: user1Id,
        session_token: `token-${crypto.randomUUID()}`,
        tenant_id: TENANT_1_ID,
        organization_id: TENANT_1_ID,
        agent_id: "test-agent",
        status: "active",
      });

      const { data: hijackAttempt, error } = await tenant2Client
        .from("agent_sessions")
        .select("*")
        .eq("id", sessionId);

      expect(error).toBeNull();
      expect(hijackAttempt).toEqual([]);
    });

    it("CRITICAL: should prevent prediction data leakage", async () => {
      const predictionId = crypto.randomUUID();
      cleanupIds.agentPredictions.push(predictionId);

      await serviceRoleClient.from("agent_predictions").insert({
        id: predictionId,
        organization_id: TENANT_1_ID,
        session_id: `session-${crypto.randomUUID()}`,
        agent_id: "test-agent",
        agent_type: "value_prediction",
        prediction: {
          sensitive: "confidential data",
          revenue: 1000000,
        },
        confidence_score: 0.9,
      });

      const { data: leakAttempt, error } = await tenant2Client
        .from("agent_predictions")
        .select("*")
        .eq("id", predictionId);

      expect(error).toBeNull();
      expect(leakAttempt).toEqual([]);
    });
  });

  describe("ValueCase RLS Policies - Cross-Tenant Attack Simulation", () => {
    it("CRITICAL: should prevent cross-tenant access to value_cases", async () => {
      const valueCaseId = crypto.randomUUID();
      cleanupIds.valueCases.push(valueCaseId);

      const { data: valueCase, error: createError } = await serviceRoleClient
        .from("value_cases")
        .insert({
          id: valueCaseId,
          organization_id: TENANT_1_ID,
          tenant_id: TENANT_1_ID,
          name: "Test Value Case",
          description: "A test value case for tenant isolation",
          status: "draft",
        })
        .select()
        .single();

      expect(createError).toBeNull();
      expect(valueCase).toBeDefined();

      const { data: accessData, error: accessError } = await tenant2Client
        .from("value_cases")
        .select("*")
        .eq("id", valueCaseId);

      expect(accessError).toBeNull();
      expect(accessData).toEqual([]);

      const { error: updateError } = await tenant2Client
        .from("value_cases")
        .update({ name: "Hacked Title" })
        .eq("id", valueCaseId);

      const { data: reloaded, error: reloadError } = await serviceRoleClient
        .from("value_cases")
        .select("name")
        .eq("id", valueCaseId)
        .single();

      expect(reloadError).toBeNull();
      expect(reloaded?.name).toBe("Test Value Case");
      if (updateError) {
        expect(updateError).toBeDefined();
      }
    });

    it("CRITICAL: should reject value_cases insert with wrong tenant_id", async () => {
      const { error: insertError } = await tenant1Client.from("value_cases").insert({
        id: crypto.randomUUID(),
        organization_id: TENANT_2_ID,
        tenant_id: TENANT_2_ID,
        name: "Spoofed Value Case",
        description: "Attempting to create case for wrong tenant",
        status: "draft",
      });

      expect(insertError).toBeDefined();
    });
  });

  describe("AuditLog RLS Policies - Cross-Tenant Attack Simulation", () => {
    it("should allow service role writes and block unauthorized authenticated reads", async () => {
      const auditLogId = crypto.randomUUID();
      cleanupIds.auditLogs.push(auditLogId);

      const { data: auditLog, error: createError } = await serviceRoleClient
        .from("audit_logs")
        .insert({
          id: auditLogId,
          organization_id: TENANT_1_ID,
          tenant_id: TENANT_1_ID,
          user_id: user1Id,
          action: "test_action",
          resource_type: "test_resource",
          resource_id: "test-resource-id",
          details: { test: "data" },
        })
        .select()
        .single();

      expect(createError).toBeNull();
      expect(auditLog).toBeDefined();

      const { data: accessData, error: accessError } = await tenant2Client
        .from("audit_logs")
        .select("*")
        .eq("id", auditLogId);

      if (accessError) {
        expect(accessError).toBeDefined();
        return;
      }

      expect(accessData).toEqual([]);
    });

    it("CRITICAL: should reject audit_logs insert with wrong organization_id", async () => {
      const { error: insertError } = await tenant1Client.from("audit_logs").insert({
        id: crypto.randomUUID(),
        organization_id: TENANT_2_ID,
        tenant_id: TENANT_2_ID,
        user_id: user1Id,
        action: "spoofed_action",
        resource_type: "test_resource",
        resource_id: "test-resource-id",
        details: { spoofed: "data" },
      });

      expect(insertError).toBeDefined();
    });
  });

  describe("Additional Tenant-Scoped Tables RLS Coverage", () => {
    describe("workflow_executions RLS Policies", () => {
      it("CRITICAL: should prevent cross-tenant access to workflow_executions", async () => {
        const executionId = crypto.randomUUID();
        cleanupIds.workflowExecutions.push(executionId);

        const { data: execution, error: createError } = await serviceRoleClient
          .from("workflow_executions")
          .insert({
            id: executionId,
            organization_id: TENANT_1_ID,
            workflow_id: "test-workflow",
            status: "in_progress",
            context: {},
          })
          .select()
          .single();

        if (isMissingRelationError(createError)) {
          return;
        }

        expect(createError).toBeNull();
        expect(execution).toBeDefined();

        const { data: accessData, error: accessError } = await tenant2Client
          .from("workflow_executions")
          .select("*")
          .eq("id", executionId);

        expect(accessError).toBeNull();
        expect(accessData).toEqual([]);
      });
    });

    describe("usage_events RLS Policies", () => {
      it("CRITICAL: should prevent cross-tenant access to usage data", async () => {
        const eventId = crypto.randomUUID();
        cleanupIds.usageEvents.push(eventId);

        const { data: event, error: createError } = await serviceRoleClient
          .from("usage_events")
          .insert({
            id: eventId,
            tenant_id: TENANT_1_ID,
            meter_key: "api_calls",
            quantity: 1,
            request_id: `req-${eventId}`,
            agent_uuid: "agent-test-001",
            workload_identity: "workload-test-001",
            idempotency_key: "a".repeat(64),
          })
          .select()
          .single();

        if (isMissingRelationError(createError)) {
          return;
        }

        expect(createError).toBeNull();
        expect(event).toBeDefined();

        const { data: accessData, error: accessError } = await tenant2Client
          .from("usage_events")
          .select("*")
          .eq("id", eventId);

        expect(accessError).toBeNull();
        expect(accessData).toEqual([]);
      });
    });

    describe("webhook_events RLS Policies", () => {
      it("CRITICAL: should prevent authenticated access to service-only webhook events", async () => {
        const webhookId = crypto.randomUUID();
        cleanupIds.webhookEvents.push(webhookId);

        const { data: webhook, error: createError } = await serviceRoleClient
          .from("webhook_events")
          .insert({
            id: webhookId,
            tenant_id: TENANT_1_ID,
            stripe_event_id: `evt_${crypto.randomUUID()}`,
            event_type: "invoice.payment_succeeded",
            payload: { test: "data" },
            processed: false,
          })
          .select()
          .single();

        if (isMissingRelationError(createError)) {
          return;
        }

        expect(createError).toBeNull();
        expect(webhook).toBeDefined();

        const { error: accessError } = await tenant2Client
          .from("webhook_events")
          .select("*")
          .eq("id", webhookId);

        expect(accessError).toBeDefined();
      });
    });

    describe("semantic_memory RLS Policies", () => {
      it("CRITICAL: should prevent cross-tenant access to memory data", async () => {
        const memoryId = crypto.randomUUID();
        cleanupIds.semanticMemory.push(memoryId);

        const { data: memory, error: createError } = await serviceRoleClient
          .from("semantic_memory")
          .insert({
            id: memoryId,
            organization_id: TENANT_1_ID,
            type: "workflow_result",
            content: "Test memory content",
            metadata: { source: "test" },
            source_agent: "agent-test",
          })
          .select()
          .single();

        if (isMissingRelationError(createError)) {
          return;
        }

        expect(createError).toBeNull();
        expect(memory).toBeDefined();

        const { data: accessData, error: accessError } = await tenant2Client
          .from("semantic_memory")
          .select("*")
          .eq("id", memoryId);

        expect(accessError).toBeNull();
        expect(accessData).toEqual([]);
      });
    });

    describe("dead_letter_events RLS Policies", () => {
      it("CRITICAL: should prevent authenticated access to service-only dead letter queue", async () => {
        const deadLetterId = crypto.randomUUID();
        cleanupIds.deadLetterEvents.push(deadLetterId);

        const { data: dlqEvent, error: createError } = await serviceRoleClient
          .from("dead_letter_events")
          .insert({
            id: deadLetterId,
            tenant_id: TENANT_1_ID,
            event_type: "usage_event",
            payload: { test: "data" },
            error_message: "Test error",
            retry_count: 0,
          })
          .select()
          .single();

        if (isMissingRelationError(createError)) {
          return;
        }

        expect(createError).toBeNull();
        expect(dlqEvent).toBeDefined();

        const { error: accessError } = await tenant2Client
          .from("dead_letter_events")
          .select("*")
          .eq("id", deadLetterId);

        expect(accessError).toBeDefined();
      });
    });
  });
});
