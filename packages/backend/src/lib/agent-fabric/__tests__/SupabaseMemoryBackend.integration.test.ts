/**
 * SupabaseMemoryBackend — integration tests
 *
 * Validates real Supabase round-trips:
 *   1. Cross-session retrieval: memory stored in session A is visible in session B
 *      (simulates pod restart / new MemorySystem instance).
 *   2. Tenant isolation: retrieval with a different organization_id returns empty.
 *
 * Skips automatically when SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are absent
 * (CI without a local Supabase instance). Run locally with `pnpm run dx` first.
 *
 * Issue: #1146
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// Skip guard — skip the entire suite when Supabase is not configured
// ---------------------------------------------------------------------------

const SUPABASE_URL =
  process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"];
const SUPABASE_KEY =
  process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? process.env["SUPABASE_SERVICE_KEY"];

const supabaseAvailable = Boolean(SUPABASE_URL && SUPABASE_KEY);

// Use describe.skipIf so the file still parses and reports correctly in CI
const describeIntegration = supabaseAvailable ? describe : describe.skip;

// ---------------------------------------------------------------------------
// Imports (after skip guard so missing env doesn't crash import-time init)
// ---------------------------------------------------------------------------

import type { Memory } from "../MemorySystem.js";
import { SupabaseMemoryBackend } from "../SupabaseMemoryBackend.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ORG_A = `integ-test-org-a-${Date.now()}`;
const ORG_B = `integ-test-org-b-${Date.now()}`;
const SESSION_1 = `integ-session-1-${Date.now()}`;
const SESSION_2 = `integ-session-2-${Date.now()}`;

function makeMemory(overrides: Partial<Memory> = {}): Memory {
  return {
    id: `mem-${Math.random().toString(36).slice(2)}`,
    agent_id: "OpportunityAgent",
    organization_id: ORG_A,
    workspace_id: SESSION_1,
    content: "Integration test: discovered fintech opportunity in payments vertical",
    memory_type: "episodic",
    importance: 0.75,
    created_at: new Date().toISOString(),
    accessed_at: new Date().toISOString(),
    access_count: 0,
    metadata: { organization_id: ORG_A, confidence: 0.85 },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Cleanup: delete rows written during the test run
// ---------------------------------------------------------------------------

const storedIds: string[] = [];

afterAll(async () => {
  if (!supabaseAvailable || storedIds.length === 0) return;

  // Import lazily so the module only loads when Supabase is available
  const { createServerSupabaseClient } = await import("../../supabase.js");
  const client = createServerSupabaseClient();

  await client
    .from("semantic_memory")
    .delete()
    .in("id", storedIds);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describeIntegration("SupabaseMemoryBackend (integration)", () => {
  let backendA: SupabaseMemoryBackend;
  let backendB: SupabaseMemoryBackend;

  beforeAll(() => {
    // Two separate instances simulate two different pods / process restarts
    backendA = new SupabaseMemoryBackend();
    backendB = new SupabaseMemoryBackend();
  });

  // -------------------------------------------------------------------------
  // 1. Cross-session retrieval
  // -------------------------------------------------------------------------

  it("stores a memory in session 1 and retrieves it in session 2 (cross-session)", async () => {
    const memory = makeMemory({ workspace_id: SESSION_1 });

    // Store via backendA (session 1)
    const storedId = await backendA.store(memory);
    storedIds.push(storedId);

    // Retrieve via backendB (session 2) — different instance, same org
    const results = await backendB.retrieve({
      agent_id: "OpportunityAgent",
      organization_id: ORG_A,
      workspace_id: SESSION_2, // different session — should still find it
      limit: 10,
    });

    const found = results.find((m) => m.content === memory.content);
    expect(found).toBeDefined();
    expect(found?.agent_id).toBe("OpportunityAgent");
    expect(found?.memory_type).toBe("episodic");
    expect(found?.importance).toBeCloseTo(0.75, 1);
  }, 15_000);

  // -------------------------------------------------------------------------
  // 2. Tenant isolation
  // -------------------------------------------------------------------------

  it("returns empty results when retrieving with a different organization_id", async () => {
    const memory = makeMemory({ organization_id: ORG_A, workspace_id: SESSION_1 });

    const storedId = await backendA.store(memory);
    storedIds.push(storedId);

    // Retrieve with ORG_B — must return nothing
    const results = await backendB.retrieve({
      agent_id: "OpportunityAgent",
      organization_id: ORG_B,
      limit: 50,
    });

    // None of the results should belong to ORG_A
    const leaked = results.filter((m) => m.content === memory.content);
    expect(leaked).toHaveLength(0);
  }, 15_000);

  // -------------------------------------------------------------------------
  // 3. store() rejects missing organization_id (guard at persistence boundary)
  // -------------------------------------------------------------------------

  it("throws when organization_id is missing", async () => {
    const memory = makeMemory({ organization_id: "" });

    await expect(backendA.store(memory)).rejects.toThrow("organization_id required");
  });

  // -------------------------------------------------------------------------
  // 4. retrieve() rejects missing organization_id
  // -------------------------------------------------------------------------

  it("throws when retrieve() is called without organization_id", async () => {
    await expect(
      backendA.retrieve({ agent_id: "OpportunityAgent", organization_id: "" }),
    ).rejects.toThrow("organization_id is required");
  });

  // -------------------------------------------------------------------------
  // 5. Multiple memories — importance ordering
  // -------------------------------------------------------------------------

  it("returns memories ordered by importance descending", async () => {
    const low = makeMemory({ importance: 0.3, content: "low importance signal" });
    const high = makeMemory({ importance: 0.95, content: "high importance signal" });

    const [idLow, idHigh] = await Promise.all([
      backendA.store(low),
      backendA.store(high),
    ]);
    storedIds.push(idLow, idHigh);

    const results = await backendB.retrieve({
      agent_id: "OpportunityAgent",
      organization_id: ORG_A,
      limit: 20,
    });

    // Find our two test memories in the results
    const testResults = results.filter(
      (m) => m.content === low.content || m.content === high.content,
    );

    expect(testResults.length).toBeGreaterThanOrEqual(2);

    // High importance should appear before low importance
    const highIdx = testResults.findIndex((m) => m.content === high.content);
    const lowIdx = testResults.findIndex((m) => m.content === low.content);
    expect(highIdx).toBeLessThan(lowIdx);
  }, 15_000);
});
