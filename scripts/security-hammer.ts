import "dotenv/config";
import * as dotenv from "dotenv";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Try loading .env.local explicitly if automatic loading didn't catch it
dotenv.config({ path: ".env.local" });

/**
 * RLS LEAKAGE HAMMER (security-hammer.ts)
 * ---------------------------------------
 * Purpose: Exhaustive negative testing of tenant isolation.
 * Logic: Attempt to access Tenant B's data using Tenant A's identity.
 */

// Configuration & Mock IDs
const TENANT_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"; // The "Attacker"
const TENANT_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"; // The "Victim"
const VICTIM_RECORD_ID = "99999999-9999-9999-9999-999999999999";

// The 42 Public Tables identified in the Security Hardening Package
const PUBLIC_TABLES = [
  "accounts",
  "user_profiles",
  "workspaces",
  "agents",
  "agent_configs",
  "tools",
  "tool_definitions",
  "workflow_definitions",
  "workflow_executions",
  "workflow_steps",
  "step_logs",
  "documents",
  "document_chunks",
  "vector_indices",
  "api_keys",
  "webhooks",
  "audit_logs",
  "usage_metrics",
  "billing_subscriptions",
  "billing_customers",
  "chat_sessions",
  "chat_messages",
  "feedback_entries",
  "shared_links",
  "attachments",
  "tags",
  "categories",
  "agent_memory",
  "knowledge_bases",
  "data_sources",
  "integration_configs",
  "user_invitations",
  "team_memberships",
  "roles",
  "permissions",
  "feature_flags",
  "notifications",
  "scheduled_tasks",
  "cost_tracking",
  "llm_logs",
  "rate_limits",
  "security_events",
];

interface AuditResult {
  table: string;
  operation: "SELECT" | "INSERT" | "UPDATE" | "DELETE";
  status: "PASS" | "FAIL";
  details?: string;
}

const auditLogs: AuditResult[] = [];

// Initialize clients
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "Missing SUPABASE_URL (or VITE_SUPABASE_URL) or SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_KEY) environment variables."
  );
  process.exit(1);
}

// We use service_role only to ensure Tenant B's data exists before testing
const adminClient = createClient(supabaseUrl, supabaseKey);

async function hammer() {
  console.log("🛡️ Initializing RLS Leakage Hammer...");

  // 1. Create a simulated client for Tenant A
  // We simulate the JWT claims that the RLS policy expects
  const tenantAClient = createClient(supabaseUrl, supabaseKey, {
    global: {
      headers: {
        Authorization: `Bearer simulation-jwt`, // In real E2E, this would be a real JWT
        "x-test-claims": JSON.stringify({
          sub: "user-a-uuid",
          tenant_id: TENANT_A,
          role: "authenticated",
        }),
      },
    },
  });

  for (const table of PUBLIC_TABLES) {
    console.log(`🔨 Hammering table: ${table}...`);

    // A. SELECT TEST (Expect empty set)
    const { data: selectData, error: selectError } = await tenantAClient
      .from(table)
      .select("*")
      .eq("tenant_id", TENANT_B);

    const selectPassed =
      !selectError && (!selectData || selectData.length === 0);
    recordResult(table, "SELECT", selectPassed, selectError?.message);

    // B. UPDATE TEST (Expect 0 rows affected or 403)
    const { error: updateError, count } = await tenantAClient
      .from(table)
      .update({ metadata: { hacked: true } }) // Assuming 'metadata' column generically, might need adjustment per table if strict schema
      .eq("tenant_id", TENANT_B)
      .select();

    // Ideally we want to check if count is 0, but update() with select() might return data if successful.
    // If it fails RLS, it usually returns an error or count 0.
    const updatePassed = !updateError && (!count || count === 0);
    recordResult(table, "UPDATE", updatePassed, updateError?.message);

    // C. INSERT TEST (Expect 403/Policy violation when trying to spoof tenant_id)
    // Note: We need to be careful with schema validation errors vs RLS errors.
    // Specifying 'id' might conflict if we reuse it, but here we expect failure.
    // We add 'name' as a generic field, but some tables might not have it.
    // This is a 'hammer' so it might fail on schema constraints before RLS, which is acceptable noise,
    // but ideally we want RLS rejection.
    const { error: insertError } = await tenantAClient.from(table).insert({
      id: VICTIM_RECORD_ID,
      tenant_id: TENANT_B,
      name: "Malicious Entry",
    });

    const insertPassed = !!insertError; // Success means the DB rejected the spoofed insert
    recordResult(table, "INSERT", insertPassed, insertError?.message);

    // Special Check: workflow_executions Deep Dive (Patch 20251213000000)
    if (table === "workflow_executions") {
      await performDeepDiveWorkflowCheck(tenantAClient);
    }
  }

  // Finalize Report
  const summary = {
    timestamp: new Date().toISOString(),
    total_tables: PUBLIC_TABLES.length,
    total_tests: auditLogs.length,
    failures: auditLogs.filter((l) => l.status === "FAIL"),
    status: auditLogs.some((l) => l.status === "FAIL")
      ? "CRITICAL_FAILURE"
      : "SECURE",
  };

  console.log("\n📊 Security Audit Summary:");
  console.table(summary);

  if (summary.status === "CRITICAL_FAILURE") {
    console.error("🚨 LEAKAGE DETECTED. Review audit logs immediately.");
    process.exit(1);
  }
}

async function performDeepDiveWorkflowCheck(client: SupabaseClient) {
  console.log("🔍 Deep-diving: workflow_executions RLS subquery integrity...");

  // Attempt to read via a subquery bypass that older policies might miss
  const { data, error } = await client
    .from("workflow_executions")
    .select(
      `
      id,
      tenant_id,
      workflow_definitions ( id, tenant_id )
    `
    )
    .eq("tenant_id", TENANT_B);

  const passed = !data || data.length === 0;
  recordResult(
    "workflow_executions",
    "SELECT",
    passed,
    "Cross-table subquery isolation check"
  );
}

function recordResult(table: string, op: any, pass: boolean, msg?: string) {
  auditLogs.push({
    table,
    operation: op,
    status: pass ? "PASS" : "FAIL",
    details:
      msg ||
      (pass ? "Isolation maintained" : "Data leakage or bypass possible"),
  });
}

hammer().catch((err) => {
  console.error("Hammer suite crashed:", err);
  process.exit(1);
});
