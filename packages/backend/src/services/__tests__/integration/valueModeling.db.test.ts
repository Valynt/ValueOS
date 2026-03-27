/**
 * DB Integration Tests — Value Modeling Schema
 *
 * These tests run against a real local Supabase instance and verify:
 *   - The consolidating migration applied correctly
 *   - All expected tables exist with the right columns and constraints
 *   - Service-layer inserts succeed against the real schema
 *   - RLS isolates rows by organization_id
 *   - The source_type CHECK constraint enforces lowercase 'crm-derived'
 *
 * Prerequisites:
 *   - Local Supabase running (supabase start)
 *   - Migration applied (supabase db push)
 *   - SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY set in environment
 *
 * Run with:
 *   pnpm vitest run src/services/__tests__/integration/valueModeling.db.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Client setup
// ---------------------------------------------------------------------------

let db: SupabaseClient;

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://localhost:54321";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const TEST_ORG_ID = "00000000-0000-0000-0000-000000000001";
const OTHER_ORG_ID = "00000000-0000-0000-0000-000000000002";

// We need a real value_cases row to satisfy the FK. Use a fixed UUID.
const TEST_CASE_ID = "00000000-0000-0000-0000-000000000010";

beforeAll(async () => {
  if (!SERVICE_ROLE_KEY) {
    console.warn("SUPABASE_SERVICE_ROLE_KEY not set — skipping DB integration tests");
    return;
  }

  db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // Seed a value_cases row so FK constraints can be satisfied
  await db.from("value_cases").upsert({
    id: TEST_CASE_ID,
    organization_id: TEST_ORG_ID,
    name: "Integration Test Case",
    status: "draft",
  });
});

afterAll(async () => {
  if (!db) return;

  // Clean up test data in dependency order
  await db.from("promise_handoff_notes").delete().eq("organization_id", TEST_ORG_ID);
  await db.from("promise_checkpoints").delete().eq("organization_id", TEST_ORG_ID);
  await db.from("promise_kpi_targets").delete().eq("organization_id", TEST_ORG_ID);
  await db.from("promise_baselines").delete().eq("organization_id", TEST_ORG_ID);
  await db.from("sensitivity_analysis").delete().eq("organization_id", TEST_ORG_ID);
  await db.from("scenarios").delete().eq("organization_id", TEST_ORG_ID);
  await db.from("assumptions").delete().eq("organization_id", TEST_ORG_ID);
  await db.from("value_hypotheses").delete().eq("organization_id", TEST_ORG_ID);
  await db.from("value_cases").delete().eq("id", TEST_CASE_ID);
});

// ---------------------------------------------------------------------------
// Helper: skip if no DB connection
// ---------------------------------------------------------------------------

function skipIfNoDB() {
  if (!SERVICE_ROLE_KEY) {
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Schema existence tests
// ---------------------------------------------------------------------------

describe("Schema — table existence", () => {
  it("value_hypotheses table exists", async () => {
    if (skipIfNoDB()) return;

    const { error } = await db.from("value_hypotheses").select("id").limit(0);
    expect(error).toBeNull();
  });

  it("assumptions table exists with organization_id column", async () => {
    if (skipIfNoDB()) return;

    const { error } = await db.from("assumptions").select("id, organization_id").limit(0);
    expect(error).toBeNull();
  });

  it("scenarios table exists with provenance columns", async () => {
    if (skipIfNoDB()) return;

    const { error } = await db
      .from("scenarios")
      .select("id, organization_id, cost_input_usd, timeline_years, investment_source")
      .limit(0);
    expect(error).toBeNull();
  });

  it("sensitivity_analysis table exists", async () => {
    if (skipIfNoDB()) return;

    const { error } = await db.from("sensitivity_analysis").select("id, organization_id").limit(0);
    expect(error).toBeNull();
  });

  it("promise_baselines table exists", async () => {
    if (skipIfNoDB()) return;

    const { error } = await db.from("promise_baselines").select("id, organization_id").limit(0);
    expect(error).toBeNull();
  });

  it("promise_kpi_targets table exists", async () => {
    if (skipIfNoDB()) return;

    const { error } = await db.from("promise_kpi_targets").select("id, organization_id").limit(0);
    expect(error).toBeNull();
  });

  it("promise_checkpoints table exists", async () => {
    if (skipIfNoDB()) return;

    const { error } = await db.from("promise_checkpoints").select("id, organization_id").limit(0);
    expect(error).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// source_type CHECK constraint
// ---------------------------------------------------------------------------

describe("assumptions — source_type CHECK constraint", () => {
  it("rejects uppercase 'CRM-derived'", async () => {
    if (skipIfNoDB()) return;

    const { error } = await db.from("assumptions").insert({
      organization_id: TEST_ORG_ID,
      case_id: TEST_CASE_ID,
      name: "test_assumption",
      value: 100,
      source_type: "CRM-derived", // uppercase — must fail
      confidence_score: 0.8,
    });

    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/check/i);
  });

  it("accepts lowercase 'crm-derived'", async () => {
    if (skipIfNoDB()) return;

    const { error } = await db.from("assumptions").insert({
      organization_id: TEST_ORG_ID,
      case_id: TEST_CASE_ID,
      name: "test_crm_assumption",
      value: 100,
      source_type: "crm-derived",
      confidence_score: 0.8,
    });

    expect(error).toBeNull();
  });

  it("accepts all valid lowercase source_type values", async () => {
    if (skipIfNoDB()) return;

    const validTypes = [
      "customer-confirmed",
      "crm-derived",
      "call-derived",
      "note-derived",
      "benchmark-derived",
      "externally-researched",
      "inferred",
      "manually-overridden",
    ];

    for (const source_type of validTypes) {
      const { error } = await db.from("assumptions").insert({
        organization_id: TEST_ORG_ID,
        case_id: TEST_CASE_ID,
        name: `test_${source_type.replace(/-/g, "_")}`,
        value: 1,
        source_type,
        confidence_score: 0.5,
      });
      expect(error, `source_type '${source_type}' should be accepted`).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// value_hypotheses insert
// ---------------------------------------------------------------------------

describe("value_hypotheses — insert and retrieve", () => {
  it("inserts a hypothesis and retrieves it by organization_id + case_id", async () => {
    if (skipIfNoDB()) return;

    const hypothesisId = crypto.randomUUID();

    const { error: insertError } = await db.from("value_hypotheses").insert({
      id: hypothesisId,
      organization_id: TEST_ORG_ID,
      case_id: TEST_CASE_ID,
      value_driver: "Revenue Growth",
      description: "Increase revenue through upsell",
      estimated_impact_min: 50_000,
      estimated_impact_max: 150_000,
      impact_unit: "USD",
      evidence_tier: 2,
      confidence_score: 0.75,
      status: "pending",
      source_context_ids: [],
    });

    expect(insertError).toBeNull();

    const { data, error: fetchError } = await db
      .from("value_hypotheses")
      .select("*")
      .eq("id", hypothesisId)
      .eq("organization_id", TEST_ORG_ID)
      .single();

    expect(fetchError).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.value_driver).toBe("Revenue Growth");
    expect(data!.status).toBe("pending");
  });

  it("rejects invalid status value", async () => {
    if (skipIfNoDB()) return;

    const { error } = await db.from("value_hypotheses").insert({
      organization_id: TEST_ORG_ID,
      case_id: TEST_CASE_ID,
      value_driver: "Test",
      description: "",
      estimated_impact_min: 0,
      estimated_impact_max: 100,
      impact_unit: "USD",
      evidence_tier: 1,
      confidence_score: 0.5,
      status: "invalid_status", // must fail CHECK
      source_context_ids: [],
    });

    expect(error).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// scenarios — provenance columns
// ---------------------------------------------------------------------------

describe("scenarios — provenance columns", () => {
  it("inserts a scenario with cost_input_usd, timeline_years, investment_source", async () => {
    if (skipIfNoDB()) return;

    const scenarioId = crypto.randomUUID();

    const { error } = await db.from("scenarios").insert({
      id: scenarioId,
      organization_id: TEST_ORG_ID,
      case_id: TEST_CASE_ID,
      scenario_type: "base",
      assumptions_snapshot_json: {},
      evf_decomposition_json: { revenue_uplift: 0, cost_reduction: 0, risk_mitigation: 0, efficiency_gain: 0 },
      sensitivity_results_json: [],
      roi: 1.5,
      npv: 200_000,
      payback_months: 18,
      cost_input_usd: 100_000,
      timeline_years: 3,
      investment_source: "explicit",
    });

    expect(error).toBeNull();

    const { data } = await db
      .from("scenarios")
      .select("cost_input_usd, timeline_years, investment_source")
      .eq("id", scenarioId)
      .single();

    expect(data!.cost_input_usd).toBe(100_000);
    expect(data!.timeline_years).toBe(3);
    expect(data!.investment_source).toBe("explicit");
  });

  it("rejects invalid investment_source value", async () => {
    if (skipIfNoDB()) return;

    const { error } = await db.from("scenarios").insert({
      organization_id: TEST_ORG_ID,
      case_id: TEST_CASE_ID,
      scenario_type: "base",
      assumptions_snapshot_json: {},
      evf_decomposition_json: {},
      sensitivity_results_json: [],
      investment_source: "made_up", // must fail CHECK
    });

    expect(error).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// RLS — organization_id isolation
// ---------------------------------------------------------------------------

describe("RLS — organization_id isolation", () => {
  it("service_role can read across organizations", async () => {
    if (skipIfNoDB()) return;

    // Insert rows for two different orgs
    await db.from("value_hypotheses").insert([
      {
        organization_id: TEST_ORG_ID,
        case_id: TEST_CASE_ID,
        value_driver: "Org1 Driver",
        description: "",
        estimated_impact_min: 1,
        estimated_impact_max: 2,
        impact_unit: "USD",
        evidence_tier: 3,
        confidence_score: 0.5,
        status: "pending",
        source_context_ids: [],
      },
      {
        organization_id: OTHER_ORG_ID,
        case_id: TEST_CASE_ID,
        value_driver: "Org2 Driver",
        description: "",
        estimated_impact_min: 1,
        estimated_impact_max: 2,
        impact_unit: "USD",
        evidence_tier: 3,
        confidence_score: 0.5,
        status: "pending",
        source_context_ids: [],
      },
    ]);

    // Service role can see both
    const { data } = await db
      .from("value_hypotheses")
      .select("organization_id")
      .in("organization_id", [TEST_ORG_ID, OTHER_ORG_ID]);

    const orgIds = (data ?? []).map((r: { organization_id: string }) => r.organization_id);
    expect(orgIds).toContain(TEST_ORG_ID);
    expect(orgIds).toContain(OTHER_ORG_ID);
  });

  it("anon client cannot read rows belonging to another organization", async () => {
    if (skipIfNoDB()) return;

    const anonKey = process.env.SUPABASE_ANON_KEY;
    if (!anonKey) {
      console.warn("SUPABASE_ANON_KEY not set — skipping RLS isolation test");
      return;
    }

    // Seed a row for OTHER_ORG_ID using the service role client
    const { error: seedError } = await db.from("value_hypotheses").insert({
      organization_id: OTHER_ORG_ID,
      case_id: TEST_CASE_ID,
      value_driver: "Other Org Secret Driver",
      description: "",
      estimated_impact_min: 999,
      estimated_impact_max: 9999,
      impact_unit: "USD",
      evidence_tier: 1,
      confidence_score: 0.9,
      status: "accepted",
      source_context_ids: [],
    });
    expect(seedError).toBeNull();

    // Create an anon client (no JWT) — RLS should block all reads
    const anonClient = createClient(SUPABASE_URL, anonKey, {
      auth: { persistSession: false },
    });

    const { data, error } = await anonClient
      .from("value_hypotheses")
      .select("organization_id, value_driver")
      .eq("organization_id", OTHER_ORG_ID);

    // RLS must return an error or an empty result set.
    // An error is acceptable (e.g. permission denied); what is not acceptable
    // is a successful response containing rows from OTHER_ORG_ID.
    if (error) {
      // Any error from the anon client is a valid RLS enforcement outcome.
      return;
    }

    const leaked = (data ?? []).filter(
      (r: { organization_id: string }) => r.organization_id === OTHER_ORG_ID,
    );
    expect(leaked).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// No legacy tenant_id column
// ---------------------------------------------------------------------------

describe("Schema — no legacy tenant_id columns", () => {
  it("assumptions table does not have a tenant_id column", async () => {
    if (skipIfNoDB()) return;

    // Attempting to filter by tenant_id should produce an error or return nothing
    // (Postgres will error on unknown column in a typed query)
    const { error } = await db
      .from("assumptions")
      .select("id")
      .eq("tenant_id" as never, TEST_ORG_ID)
      .limit(1);

    // Either an error (column doesn't exist) or empty result is acceptable.
    // What's NOT acceptable is a successful query that returns data — that would
    // mean tenant_id still exists and RLS could be bypassed.
    if (!error) {
      // If no error, the column may still exist — fail the test
      const { data } = await db
        .from("assumptions")
        .select("*")
        .limit(1);

      const hasColumn = data && data.length > 0 && "tenant_id" in (data[0] as object);
      expect(hasColumn).toBe(false);
    }
  });

  it("scenarios table does not have a tenant_id column", async () => {
    if (skipIfNoDB()) return;

    const { data } = await db.from("scenarios").select("*").limit(1);
    if (data && data.length > 0) {
      expect("tenant_id" in (data[0] as object)).toBe(false);
    }
  });
});
