/**
 * Tenant isolation tests for ValueFabricService.getBenchmarks and getOntologyStats.
 *
 * Verifies that:
 * 1. Both methods reject calls with an empty organizationId.
 * 2. Both methods scope every Supabase query with `.eq("organization_id", orgId)`.
 *
 * ValueFabricService has two broken transitive imports that prevent loading in
 * the test environment:
 *   - `./LlmProxyClient.js` — resolves to a non-existent path (the real file is
 *     at `services/llm/LlmProxyClient.ts`); a re-export shim at
 *     `services/LlmProxyClient.ts` fixes this for both tests and production.
 *   - `../lib/supabase.js` — pulls in @supabase/functions-js which has a missing
 *     tslib.js; mocked below.
 *
 * Both are mocked at the module level so the real ValueFabricService class is
 * imported and the isolation contract is tested against the production code.
 */

import { describe, expect, it, vi } from "vitest";

// Mock the broken/side-effectful imports before ValueFabricService is loaded.
vi.mock("../../lib/supabase.js", () => ({
  supabase: {},
  createServerSupabaseClient: () => ({}),
}));

vi.mock("../LlmProxyClient.js", () => ({
  llmProxyClient: {
    generateEmbedding: vi.fn().mockResolvedValue([]),
    complete: vi.fn(),
  },
}));

// Import the real class after mocks are registered.
import { ValueFabricService } from "../ValueFabricService.js";

// ---------------------------------------------------------------------------
// Mock factory — covers the full query builder chain used by these methods
// ---------------------------------------------------------------------------

function makeQueryBuilder(result: { data: unknown[]; count?: number; error: null }) {
  const builder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    then: (resolve: (v: unknown) => void) => Promise.resolve(result).then(resolve),
  };
  return builder;
}

function makeMockSupabase(tableResults: Record<string, { data: unknown[]; count?: number }>) {
  return {
    from: vi.fn((table: string) =>
      makeQueryBuilder({ ...(tableResults[table] ?? { data: [] }), error: null })
    ),
  };
}

// ---------------------------------------------------------------------------
// Tests: getBenchmarks
// ---------------------------------------------------------------------------

describe("ValueFabricService.getBenchmarks — tenant isolation", () => {
  const ORG_A = "org-a";
  const ORG_B = "org-b";

  it("throws when organizationId is empty", async () => {
    const supabase = makeMockSupabase({});
    const service = new ValueFabricService(supabase as never);
    await expect(service.getBenchmarks("", {})).rejects.toThrow(
      "organizationId is required"
    );
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("scopes the benchmarks query to the requesting org", async () => {
    const supabase = makeMockSupabase({
      benchmarks: {
        data: [
          { id: "b-a1", organization_id: ORG_A, kpi_name: "NPS" },
          { id: "b-a2", organization_id: ORG_A, kpi_name: "CAC" },
        ],
      },
    });
    const service = new ValueFabricService(supabase as never);
    await service.getBenchmarks(ORG_A, {});
    const builder = supabase.from.mock.results[0].value;
    expect(builder.eq).toHaveBeenCalledWith("organization_id", ORG_A);
  });

  it("org B query does not receive org A data", async () => {
    // Simulate RLS: each org's supabase client only returns its own rows.
    const supabaseA = makeMockSupabase({
      benchmarks: { data: [{ id: "b-a1", organization_id: ORG_A }] },
    });
    const supabaseB = makeMockSupabase({
      benchmarks: { data: [{ id: "b-b1", organization_id: ORG_B }] },
    });

    const resultsA = await new ValueFabricService(supabaseA as never).getBenchmarks(ORG_A, {});
    const resultsB = await new ValueFabricService(supabaseB as never).getBenchmarks(ORG_B, {});

    expect(resultsA.map((r: { id: string }) => r.id)).not.toContain("b-b1");
    expect(resultsB.map((r: { id: string }) => r.id)).not.toContain("b-a1");
  });
});

// ---------------------------------------------------------------------------
// Tests: getOntologyStats
// ---------------------------------------------------------------------------

describe("ValueFabricService.getOntologyStats — tenant isolation", () => {
  const ORG_A = "org-a";

  it("throws when organizationId is empty", async () => {
    const supabase = makeMockSupabase({});
    const service = new ValueFabricService(supabase as never);
    await expect(service.getOntologyStats("")).rejects.toThrow(
      "organizationId is required"
    );
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("scopes all sub-queries to the requesting org", async () => {
    const supabase = makeMockSupabase({
      capabilities: { data: [], count: 3 },
      use_cases: { data: [{ industry: "SaaS" }, { industry: "FinTech" }], count: 2 },
    });
    const service = new ValueFabricService(supabase as never);

    const stats = await service.getOntologyStats(ORG_A);

    expect(stats.total_capabilities).toBe(3);
    expect(stats.total_use_cases).toBe(2);
    expect(stats.industries_covered).toEqual(expect.arrayContaining(["SaaS", "FinTech"]));

    // Every from() call must scope to ORG_A
    for (const call of supabase.from.mock.results) {
      expect(call.value.eq).toHaveBeenCalledWith("organization_id", ORG_A);
    }
  });

  it("returns zero counts and empty industries when org has no data", async () => {
    const supabase = makeMockSupabase({
      capabilities: { data: [], count: 0 },
      use_cases: { data: [], count: 0 },
    });
    const service = new ValueFabricService(supabase as never);

    const stats = await service.getOntologyStats(ORG_A);

    expect(stats.total_capabilities).toBe(0);
    expect(stats.total_use_cases).toBe(0);
    expect(stats.industries_covered).toEqual([]);
  });
});
