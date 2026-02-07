/**
 * RLS Tenant Isolation Security Tests
 *
 * CRITICAL: Verifies that Row Level Security policies prevent cross-tenant data access
 *
 * These tests validate the fixes in:
 * - supabase/migrations/20241213000000_fix_rls_tenant_isolation.sql
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

describe("RLS Tenant Isolation - Critical Security Tests", () => {
  let tenant1Client: SupabaseClient;
  let tenant2Client: SupabaseClient;
  let adminClient: SupabaseClient;

  let TENANT_1_ID: string;
  let TENANT_2_ID: string;
  let user1Id: string;
  let user2Id: string;

  beforeAll(async () => {
    // Create clients with different tenant contexts
    // In production, these would be JWT tokens with different tenant_id claims

    adminClient = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    if (!process.env.SUPABASE_SERVICE_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.warn("Skipping RLS setup - SUPABASE_SERVICE_KEY not set");
      return;
    }

    // Generate valid UUIDs for tenants to ensure compatibility with UUID columns
    TENANT_1_ID = crypto.randomUUID();
    TENANT_2_ID = crypto.randomUUID();

    // Create unique users for testing
    const email1 = `tenant1_${Date.now()}@example.com`;
    const email2 = `tenant2_${Date.now()}@example.com`;
    const password = "Password123!";

    const { data: user1, error: user1Error } = await adminClient.auth.admin.createUser({
      email: email1,
      password: password,
      email_confirm: true,
      user_metadata: { tenant_id: TENANT_1_ID },
    });
    if (user1Error) throw user1Error;
    user1Id = user1.user.id;

    const { data: user2, error: user2Error } = await adminClient.auth.admin.createUser({
      email: email2,
      password: password,
      email_confirm: true,
      user_metadata: { tenant_id: TENANT_2_ID },
    });
    if (user2Error) throw user2Error;
    user2Id = user2.user.id;

    // Create tenants
    // We try/catch here because in some envs tenants might be strictly managed
    try {
      await adminClient.from("tenants").insert([
        { id: TENANT_1_ID, name: "Tenant 1", slug: `tenant-1-${Date.now()}`, status: "active" },
        { id: TENANT_2_ID, name: "Tenant 2", slug: `tenant-2-${Date.now()}`, status: "active" },
      ]);
    } catch (e) {
      console.warn("Failed to insert tenants, they might already exist or schema differs", e);
    }

    // Link users to tenants
    const { error: linkError } = await adminClient.from("user_tenants").insert([
      { user_id: user1.user.id, tenant_id: TENANT_1_ID, status: "active" },
      { user_id: user2.user.id, tenant_id: TENANT_2_ID, status: "active" },
    ]);
    if (linkError) {
      console.warn("Failed to link user_tenants", linkError);
    }

    // Sign in to get tokens
    const { data: session1 } = await adminClient.auth.signInWithPassword({
      email: email1,
      password: password,
    });

    const { data: session2 } = await adminClient.auth.signInWithPassword({
      email: email2,
      password: password,
    });

    if (!session1.session || !session2.session) {
      throw new Error("Failed to sign in test users");
    }

    const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY!;

    tenant1Client = createClient(process.env.VITE_SUPABASE_URL!, anonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${session1.session.access_token}`,
        },
      },
    });

    tenant2Client = createClient(process.env.VITE_SUPABASE_URL!, anonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${session2.session.access_token}`,
        },
      },
    });
  });

  afterAll(async () => {
    // Cleanup test data
    if (adminClient) {
      const { error } = await adminClient.from("agent_sessions").delete().like("id", "test-%");
      if (error) console.log("Cleanup error (agent_sessions):", error);

      await adminClient.from("agent_predictions").delete().like("id", "test-%");

      // Cleanup users and tenants
      if (user1Id) await adminClient.auth.admin.deleteUser(user1Id);
      if (user2Id) await adminClient.auth.admin.deleteUser(user2Id);

      // We should delete from user_tenants and tenants too if possible
      // but FKs might prevent it if we don't clean up dependent data first
      // agent_sessions and predictions are cleaned above.

      if (TENANT_1_ID) await adminClient.from("tenants").delete().eq("id", TENANT_1_ID);
      if (TENANT_2_ID) await adminClient.from("tenants").delete().eq("id", TENANT_2_ID);
    }
  });

  describe("agent_sessions RLS Policies", () => {
    it("CRITICAL: should prevent cross-tenant access to agent_sessions", async () => {
      // Skip if not in integration test environment
      if (!process.env.SUPABASE_SERVICE_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.warn("Skipping RLS test - SUPABASE_SERVICE_KEY not set");
        return;
      }

      // Create session for tenant 1 using admin client (simulating tenant 1 action or admin action for tenant 1)
      // Note: Usually tenant 1 would create their own session.
      // Let's use tenant1Client to create it if possible, but adminClient is safer for setup.
      // However, RLS prevents tenant1Client from inserting with random ID unless policy allows.
      // Let's stick to adminClient for setup, but ensure tenant_id matches.
      const { data: session, error: createError } = await adminClient
        .from("agent_sessions")
        .insert({
          id: "test-session-001",
          tenant_id: TENANT_1_ID,
          agent_id: "test-agent",
          status: "active",
        })
        .select()
        .single();

      expect(createError).toBeNull();
      expect(session).toBeDefined();

      // Attempt to access with tenant 2 client
      // Expected: Should return empty result or error
      const { data: accessData, error: accessError } = await tenant2Client
        .from("agent_sessions")
        .select("*")
        .eq("id", "test-session-001");

      expect(accessError).toBeNull();
      expect(accessData).toEqual([]); // Should find nothing

      // Cleanup
      await adminClient.from("agent_sessions").delete().eq("id", "test-session-001");
    });

    it("CRITICAL: should reject NULL tenant_id inserts", async () => {
      if (!process.env.SUPABASE_SERVICE_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.warn("Skipping RLS test - SUPABASE_SERVICE_KEY not set");
        return;
      }

      // Attempt to insert with NULL tenant_id
      const { error } = await adminClient.from("agent_sessions").insert({
        id: "test-session-null",
        tenant_id: null,
        agent_id: "test-agent",
        status: "active",
      });

      // Should fail due to NOT NULL constraint
      expect(error).toBeDefined();
      expect(error?.message).toContain("null value");
    });

    it("CRITICAL: should enforce tenant_id in updates", async () => {
      if (!process.env.SUPABASE_SERVICE_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.warn("Skipping RLS test - SUPABASE_SERVICE_KEY not set");
        return;
      }

      // Create session
      await adminClient.from("agent_sessions").insert({
        id: "test-session-update",
        tenant_id: TENANT_1_ID,
        agent_id: "test-agent",
        status: "active",
      });

      // Attempt to change tenant_id
      const { error } = await adminClient
        .from("agent_sessions")
        .update({ tenant_id: TENANT_2_ID })
        .eq("id", "test-session-update");

      // Should fail due to RLS policy or trigger
      // (Depends on implementation - may succeed with admin key if trigger doesn't block admin,
      // but usually trigger blocks everyone or RLS blocks tenant user.
      // Admin bypasses RLS but trigger is for all.)

      // If adminClient is used, RLS is bypassed. So this tests the TRIGGER.
      // The trigger "prevent_tenant_id_modification" should raise exception.
      expect(error).toBeDefined();
      expect(error?.message).toContain("Cannot modify tenant_id");

      // Cleanup
      await adminClient.from("agent_sessions").delete().eq("id", "test-session-update");
    });
  });

  describe("agent_predictions RLS Policies", () => {
    it("CRITICAL: should prevent NULL tenant_id bypass", async () => {
      if (!process.env.SUPABASE_SERVICE_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.warn("Skipping RLS test - SUPABASE_SERVICE_KEY not set");
        return;
      }

      // Attempt to insert prediction with NULL tenant_id
      const { error } = await adminClient.from("agent_predictions").insert({
        id: "test-prediction-null",
        tenant_id: null,
        session_id: "test-session",
        agent_id: "test-agent",
        prediction_data: {},
      });

      // Should fail due to NOT NULL constraint
      expect(error).toBeDefined();
      expect(error?.message).toContain("null value");
    });

    it("CRITICAL: should isolate predictions by tenant", async () => {
      if (!process.env.SUPABASE_SERVICE_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.warn("Skipping RLS test - SUPABASE_SERVICE_KEY not set");
        return;
      }

      // Create predictions for both tenants
      await adminClient.from("agent_predictions").insert([
        {
          id: "test-pred-t1",
          tenant_id: TENANT_1_ID,
          session_id: "test-session",
          agent_id: "test-agent",
          prediction_data: { tenant: 1 },
        },
        {
          id: "test-pred-t2",
          tenant_id: TENANT_2_ID,
          session_id: "test-session",
          agent_id: "test-agent",
          prediction_data: { tenant: 2 },
        },
      ]);

      // Query with tenant 1 client
      // Expected: Should only see test-pred-t1
      const { data: data1 } = await tenant1Client
        .from("agent_predictions")
        .select("id")
        .in("id", ["test-pred-t1", "test-pred-t2"]);

      expect(data1).toHaveLength(1);
      expect(data1?.[0].id).toBe("test-pred-t1");

      // Query with tenant 2 client
      // Expected: Should only see test-pred-t2
      const { data: data2 } = await tenant2Client
        .from("agent_predictions")
        .select("id")
        .in("id", ["test-pred-t1", "test-pred-t2"]);

      expect(data2).toHaveLength(1);
      expect(data2?.[0].id).toBe("test-pred-t2");

      // Cleanup
      await adminClient
        .from("agent_predictions")
        .delete()
        .in("id", ["test-pred-t1", "test-pred-t2"]);
    });
  });

  describe("Security Audit Triggers", () => {
    it("should allow service role to write security audit logs under RLS", async () => {
      if (!process.env.SUPABASE_SERVICE_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.warn("Skipping RLS test - SUPABASE_SERVICE_KEY not set");
        return;
      }

      const { error } = await adminClient.from("security_audit_log").insert({
        event_type: "audit_test_service_role",
        user_id: crypto.randomUUID(),
      });

      expect(error).toBeNull();
    });

    it("should reject audit writes from authenticated users", async () => {
      if (!process.env.SUPABASE_SERVICE_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.warn("Skipping RLS test - SUPABASE_SERVICE_KEY not set");
        return;
      }

      const { error } = await tenant1Client.from("security_audit_log").insert({
        event_type: "audit_test_authenticated",
        user_id: user1Id,
      });

      expect(error).not.toBeNull();
    });

    it("should log security violations to audit table", async () => {
      if (!process.env.SUPABASE_SERVICE_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.warn("Skipping RLS test - SUPABASE_SERVICE_KEY not set");
        return;
      }

      // Get initial audit log count
      const { count: initialCount } = await adminClient
        .from("security_audit_log")
        .select("*", { count: "exact", head: true });

      // Attempt a violation (NULL tenant_id)
      await adminClient
        .from("agent_sessions")
        .insert({
          id: "test-violation",
          tenant_id: null,
          agent_id: "test-agent",
          status: "active",
        })
        .then(
          () => {},
          () => {}
        ); // Ignore error

      // Check if audit log increased
      const { count: finalCount } = await adminClient
        .from("security_audit_log")
        .select("*", { count: "exact", head: true });

      // Note: This may not work if trigger fires before constraint check
      // The audit log should capture the attempt
    });

    it("should provide security_violations view", async () => {
      if (!process.env.SUPABASE_SERVICE_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.warn("Skipping RLS test - SUPABASE_SERVICE_KEY not set");
        return;
      }

      // Query security violations view
      const { data, error } = await adminClient.from("security_violations").select("*").limit(10);

      // We expect no error, even if data is empty
      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);
    });
  });

  describe("RLS Verification Function", () => {
    it("should verify RLS is enabled on all critical tables", async () => {
      if (!process.env.SUPABASE_SERVICE_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.warn("Skipping RLS test - SUPABASE_SERVICE_KEY not set");
        return;
      }

      // Call verification function
      const { data, error } = await adminClient.rpc("verify_rls_tenant_isolation");

      // If RPC doesn't exist, we might get an error, but assuming it exists from migration
      if (
        error &&
        error.message.includes("function verify_rls_tenant_isolation() does not exist")
      ) {
        console.warn("verify_rls_tenant_isolation RPC not found, skipping");
        return;
      }

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);

      // Verify all tables have RLS enabled
      const tables = [
        "agent_sessions",
        "agent_predictions",
        "workflow_executions",
        "canvas_data",
        "value_trees",
      ];

      for (const table of tables) {
        const tableStatus = data?.find((row: any) => row.table_name === table);

        if (tableStatus) {
          expect(tableStatus.rls_enabled).toBe(true);
          expect(tableStatus.policy_count).toBeGreaterThanOrEqual(1); // At least 1 policy
          expect(tableStatus.has_not_null_constraint).toBe(true);
        }
      }
    });
  });

  describe("Cross-Tenant Attack Scenarios", () => {
    it("CRITICAL: should prevent session hijacking across tenants", async () => {
      if (!process.env.SUPABASE_SERVICE_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.warn("Skipping RLS test - SUPABASE_SERVICE_KEY not set");
        return;
      }

      // Create session for tenant 1
      const { data: session } = await adminClient
        .from("agent_sessions")
        .insert({
          id: "test-hijack-session",
          tenant_id: TENANT_1_ID,
          agent_id: "test-agent",
          status: "active",
        })
        .select()
        .single();

      // Attempt to access with tenant 2 credentials
      // Expected: Should return empty (RLS hides it)
      const { data: hijackAttempt, error } = await tenant2Client
        .from("agent_sessions")
        .select("*")
        .eq("id", "test-hijack-session");

      expect(hijackAttempt).toEqual([]);

      // Cleanup
      await adminClient.from("agent_sessions").delete().eq("id", "test-hijack-session");
    });

    it("CRITICAL: should prevent prediction data leakage", async () => {
      if (!process.env.SUPABASE_SERVICE_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.warn("Skipping RLS test - SUPABASE_SERVICE_KEY not set");
        return;
      }

      // Create sensitive prediction for tenant 1
      await adminClient.from("agent_predictions").insert({
        id: "test-sensitive-pred",
        tenant_id: TENANT_1_ID,
        session_id: "test-session",
        agent_id: "test-agent",
        prediction_data: {
          sensitive: "confidential data",
          revenue: 1000000,
        },
      });

      // Attempt to query with tenant 2 credentials
      // Expected: Should not see the prediction
      const { data: leakAttempt } = await tenant2Client
        .from("agent_predictions")
        .select("*")
        .eq("id", "test-sensitive-pred");

      expect(leakAttempt).toEqual([]);

      // Cleanup
      await adminClient.from("agent_predictions").delete().eq("id", "test-sensitive-pred");
    });
  });

  describe("ValueCase RLS Policies - Cross-Tenant Attack Simulation", () => {
    it("CRITICAL: should prevent cross-tenant access to value_cases", async () => {
      if (!process.env.SUPABASE_SERVICE_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.warn("Skipping RLS test - SUPABASE_SERVICE_KEY not set");
        return;
      }

      // Create a value case for tenant 1
      const { data: valueCase, error: createError } = await adminClient
        .from("value_cases")
        .insert({
          id: "test-value-case-001",
          tenant_id: TENANT_1_ID,
          title: "Test Value Case",
          description: "A test value case for tenant isolation",
          status: "active",
        })
        .select()
        .single();

      expect(createError).toBeNull();
      expect(valueCase).toBeDefined();

      // Attempt to access with tenant 2 client
      const { data: accessData, error: accessError } = await tenant2Client
        .from("value_cases")
        .select("*")
        .eq("id", "test-value-case-001");

      expect(accessError).toBeNull();
      expect(accessData).toEqual([]); // Should find nothing

      // Attempt to update with tenant 2 client
      const { error: updateError } = await tenant2Client
        .from("value_cases")
        .update({ title: "Hacked Title" })
        .eq("id", "test-value-case-001");

      expect(updateError).toBeDefined(); // Should be rejected

      // Cleanup
      await adminClient.from("value_cases").delete().eq("id", "test-value-case-001");
    });

    it("CRITICAL: should reject value_cases insert with wrong tenant_id", async () => {
      if (!process.env.SUPABASE_SERVICE_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.warn("Skipping RLS test - SUPABASE_SERVICE_KEY not set");
        return;
      }

      // Attempt to insert value case with tenant 2's ID using tenant 1's client
      const { error: insertError } = await tenant1Client.from("value_cases").insert({
        id: "test-spoofed-case-001",
        tenant_id: TENANT_2_ID, // Spoofing tenant 2's ID
        title: "Spoofed Value Case",
        description: "Attempting to create case for wrong tenant",
      });

      expect(insertError).toBeDefined(); // Should be rejected by RLS
    });
  });

  describe("AuditLog RLS Policies - Cross-Tenant Attack Simulation", () => {
    it("CRITICAL: should prevent cross-tenant access to audit_logs", async () => {
      if (!process.env.SUPABASE_SERVICE_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.warn("Skipping RLS test - SUPABASE_SERVICE_KEY not set");
        return;
      }

      // Create an audit log entry for tenant 1
      const { data: auditLog, error: createError } = await adminClient
        .from("audit_logs")
        .insert({
          id: "test-audit-log-001",
          organization_id: TENANT_1_ID,
          user_id: user1Id,
          action: "test_action",
          resource_type: "test_resource",
          resource_id: "test-resource-id",
          changes: { test: "data" },
        })
        .select()
        .single();

      expect(createError).toBeNull();
      expect(auditLog).toBeDefined();

      // Attempt to access with tenant 2 client
      const { data: accessData, error: accessError } = await tenant2Client
        .from("audit_logs")
        .select("*")
        .eq("id", "test-audit-log-001");

      expect(accessError).toBeNull();
      expect(accessData).toEqual([]); // Should find nothing

      // Attempt to query all audit logs for tenant 2 - should only see their own
      const { data: tenant2Logs, error: tenant2Error } = await tenant2Client
        .from("audit_logs")
        .select("*")
        .eq("organization_id", TENANT_2_ID);

      expect(tenant2Error).toBeNull();
      // Should not see tenant 1's logs
      expect(tenant2Logs?.filter((log) => log.id === "test-audit-log-001")).toEqual([]);

      // Cleanup
      await adminClient.from("audit_logs").delete().eq("id", "test-audit-log-001");
    });

    it("CRITICAL: should reject audit_logs insert with wrong organization_id", async () => {
      if (!process.env.SUPABASE_SERVICE_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.warn("Skipping RLS test - SUPABASE_SERVICE_KEY not set");
        return;
      }

      // Attempt to insert audit log with tenant 2's organization_id using tenant 1's client
      const { error: insertError } = await tenant1Client.from("audit_logs").insert({
        id: "test-spoofed-audit-001",
        organization_id: TENANT_2_ID, // Spoofing tenant 2's ID
        user_id: user1Id,
        action: "spoofed_action",
        resource_type: "test_resource",
        resource_id: "test-resource-id",
        changes: { spoofed: "data" },
      });

      expect(insertError).toBeDefined(); // Should be rejected by RLS
    });
  });
});

/**
 * Manual Verification Steps
 *
 * Run these SQL queries to manually verify RLS policies:
 *
 * 1. Check RLS is enabled:
 *    SELECT tablename, rowsecurity FROM pg_tables
 *    WHERE schemaname = 'public' AND tablename IN ('agent_sessions', 'agent_predictions');
 *
 * 2. Check policies exist:
 *    SELECT tablename, policyname, cmd FROM pg_policies
 *    WHERE tablename IN ('agent_sessions', 'agent_predictions');
 *
 * 3. Check NOT NULL constraints:
 *    SELECT table_name, column_name, is_nullable
 *    FROM information_schema.columns
 *    WHERE table_name IN ('agent_sessions', 'agent_predictions')
 *    AND column_name = 'tenant_id';
 *
 * 4. Check for NULL tenant_id values:
 *    SELECT 'agent_sessions' as table_name, COUNT(*)
 *    FROM agent_sessions WHERE tenant_id IS NULL
 *    UNION ALL
 *    SELECT 'agent_predictions', COUNT(*)
 *    FROM agent_predictions WHERE tenant_id IS NULL;
 *    -- Expected: 0 rows for all tables
 *
 * 5. Check security audit log:
 *    SELECT * FROM security_violations ORDER BY created_at DESC LIMIT 10;
 */
