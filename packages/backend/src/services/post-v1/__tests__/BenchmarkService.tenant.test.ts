// @vitest-environment node
/**
 * BenchmarkService — tenant isolation tests (#1542)
 *
 * Verifies that all DB queries are scoped to organization_id and that
 * a cross-tenant read returns an empty result set.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock the FeatureFlags singleton that fires at core-services barrel import time
vi.mock("@valueos/core-services", async () => {
  const actual = await vi.importActual<typeof import("@valueos/core-services")>(
    "@valueos/core-services"
  );
  return { ...actual };
});

// Stub supabase createClient so FeatureFlagsService doesn't throw at import
vi.mock("@supabase/supabase-js", async () => {
  const actual = await vi.importActual<typeof import("@supabase/supabase-js")>(
    "@supabase/supabase-js"
  );
  return {
    ...actual,
    createClient: vi.fn(() => ({ from: vi.fn() })),
  };
});

import { BenchmarkService } from "@valueos/core-services";
import type { SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type ChainCall = { method: string; args: unknown[] };

function buildQueryChain(resolveData: unknown[] = []) {
  const calls: ChainCall[] = [];
  const resolved = { data: resolveData, error: null };

  const chain: Record<string, unknown> = {};
  const record =
    (method: string) =>
    (...args: unknown[]) => {
      calls.push({ method, args });
      return chain;
    };

  chain["select"] = record("select");
  chain["eq"] = record("eq");
  chain["not"] = vi.fn().mockResolvedValue(resolved);
  chain["order"] = record("order");
  chain["range"] = vi.fn().mockResolvedValue(resolved);
  chain["single"] = vi.fn().mockResolvedValue(resolved);
  chain["maybeSingle"] = vi.fn().mockResolvedValue({ data: null, error: null });
  chain["insert"] = vi.fn().mockReturnValue(chain);

  return { chain, calls };
}

function makeSupabase(fromImpl: (table: string) => unknown): SupabaseClient {
  return { from: fromImpl } as unknown as SupabaseClient;
}

const ORG_A = "org-tenant-a";
const ORG_B = "org-tenant-b";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("BenchmarkService — tenant isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws when constructed without organizationId", () => {
    const supabase = makeSupabase(() => ({}));
    expect(() => new BenchmarkService(supabase, "")).toThrow(/organizationId/);
  });

  it("getBenchmarks scopes query to organization_id", async () => {
    const { chain, calls } = buildQueryChain([]);
    const supabase = makeSupabase(() => chain);

    const svc = new BenchmarkService(supabase, ORG_A);
    await svc.getBenchmarks({ industry: "SaaS" });

    const eqCalls = calls.filter((c) => c.method === "eq");
    expect(
      eqCalls.some((c) => c.args[0] === "organization_id" && c.args[1] === ORG_A)
    ).toBe(true);
  });

  it("getBenchmarks for tenant B does not receive tenant A data", async () => {
    const { chain: chainA } = buildQueryChain([{ id: "b1", kpi_name: "ARR" }]);
    const { chain: chainB, calls: callsB } = buildQueryChain([]);

    const svcA = new BenchmarkService(makeSupabase(() => chainA), ORG_A);
    const svcB = new BenchmarkService(makeSupabase(() => chainB), ORG_B);

    await svcA.getBenchmarks({});
    const resultB = await svcB.getBenchmarks({});

    expect(resultB).toHaveLength(0);

    const eqCalls = callsB.filter((c) => c.method === "eq");
    expect(eqCalls.some((c) => c.args[1] === ORG_B)).toBe(true);
    expect(eqCalls.some((c) => c.args[1] === ORG_A)).toBe(false);
  });

  it("createBenchmark injects organization_id into the insert payload", async () => {
    const insertMock = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: "new" }, error: null }),
      }),
    });
    const supabase = makeSupabase(() => ({ insert: insertMock }));

    const svc = new BenchmarkService(supabase, ORG_A);
    await svc.createBenchmark({
      kpi_hypothesis_id: "h1",
      kpi_name: "NRR",
      industry: "SaaS",
      value: 110,
      unit: "%",
      source: "internal",
      data_date: "2025-01-01",
    });

    const [payload] = insertMock.mock.calls[0];
    expect(payload.organization_id).toBe(ORG_A);
  });

  it("getSupportedIndustries scopes query to organization_id", async () => {
    const { chain, calls } = buildQueryChain([]);
    const supabase = makeSupabase(() => chain);

    const svc = new BenchmarkService(supabase, ORG_A);
    await svc.getSupportedIndustries();

    const eqCalls = calls.filter((c) => c.method === "eq");
    expect(
      eqCalls.some((c) => c.args[0] === "organization_id" && c.args[1] === ORG_A)
    ).toBe(true);
  });

  it("getSupportedKPIs scopes query to organization_id", async () => {
    const { chain, calls } = buildQueryChain([]);
    const supabase = makeSupabase(() => chain);

    const svc = new BenchmarkService(supabase, ORG_A);
    await svc.getSupportedKPIs();

    const eqCalls = calls.filter((c) => c.method === "eq");
    expect(
      eqCalls.some((c) => c.args[0] === "organization_id" && c.args[1] === ORG_A)
    ).toBe(true);
  });
});
