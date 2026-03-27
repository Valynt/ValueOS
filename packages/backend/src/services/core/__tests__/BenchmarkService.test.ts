import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock CacheService before importing BenchmarkService
// ---------------------------------------------------------------------------

const mockCacheGet = vi.fn();
const mockCacheSet = vi.fn();
const mockCacheClear = vi.fn();

vi.mock("../../CacheService.js", () => ({
  CacheService: vi.fn().mockImplementation(() => ({
    get: mockCacheGet,
    set: mockCacheSet,
    clear: mockCacheClear,
  })),
}));

// ---------------------------------------------------------------------------
// Mock Supabase client
// ---------------------------------------------------------------------------

const mockFrom = vi.fn();
const mockSupabase = { from: mockFrom } as unknown as import("@supabase/supabase-js").SupabaseClient;

function makeBenchmarks(values: number[]) {
  return values.map((v, i) => ({
    id: `b-${i}`,
    kpi_hypothesis_id: `hyp-${i}`,
    kpi_name: "Revenue Growth",
    industry: "SaaS",
    value: v,
    unit: "%",
    percentile: undefined,
    source: "internal",
    data_date: "2026-01-01",
  }));
}

import { BenchmarkService } from "../BenchmarkService.js";

describe("BenchmarkService — Redis cache migration", () => {
  let service: BenchmarkService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCacheGet.mockResolvedValue(null);
    mockCacheSet.mockResolvedValue(undefined);
    mockCacheClear.mockResolvedValue(undefined);

    // Default: getBenchmarks returns 3 values
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({
        data: makeBenchmarks([10, 20, 30]),
        error: null,
      }),
      insert: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: "new-b" }, error: null }),
      not: vi.fn().mockReturnThis(),
    });

    service = new BenchmarkService(mockSupabase, "org-123");
  });

  it("returns null from cache on miss and computes percentiles", async () => {
    mockCacheGet.mockResolvedValue(null);

    const result = await service.compareToBenchmark("Revenue Growth", 25, "%", { industry: "SaaS" });

    expect(mockCacheGet).toHaveBeenCalledOnce();
    expect(mockCacheSet).toHaveBeenCalledOnce();
    expect(result.kpi_name).toBe("Revenue Growth");
    expect(result.benchmark_p50).toBeDefined();
  });

  it("returns cached percentiles on hit without recomputing", async () => {
    const cachedPercentiles = { p25: 10, p50: 20, p75: 30, p90: 35 };
    mockCacheGet.mockResolvedValue(cachedPercentiles);

    const result = await service.compareToBenchmark("Revenue Growth", 25, "%", { industry: "SaaS" });

    expect(mockCacheGet).toHaveBeenCalledOnce();
    // set() must NOT be called — we used the cached value
    expect(mockCacheSet).not.toHaveBeenCalled();
    expect(result.benchmark_p50).toBe(20);
  });

  it("scopes the CacheService namespace to organizationId for tenant isolation", async () => {
    const { CacheService } = await import("../../CacheService.js");
    const constructorCalls = (CacheService as unknown as ReturnType<typeof vi.fn>).mock.calls;
    // The namespace passed to CacheService must include organizationId so that
    // clear() only invalidates keys for this tenant, even outside request context.
    expect(constructorCalls.length).toBeGreaterThan(0);
    expect(constructorCalls[0][0]).toContain("org-123");
  });

  it("calls cache.clear() on createBenchmark to invalidate all pods", async () => {
    await service.createBenchmark({
      kpi_hypothesis_id: "hyp-1",
      kpi_name: "Revenue Growth",
      industry: "SaaS",
      value: 25,
      unit: "%",
      source: "internal",
      data_date: "2026-01-01",
    });

    expect(mockCacheClear).toHaveBeenCalledOnce();
  });

  it("calls cache.clear() after importBenchmarks to invalidate all pods", async () => {
    // Mock findDuplicateBenchmark to return null (no duplicates)
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({ data: [], error: null }),
      insert: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: "new-b" }, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      not: vi.fn().mockReturnThis(),
    });

    await service.importBenchmarks([
      { kpi_hypothesis_id: "hyp-1", kpi_name: "Revenue Growth", industry: "SaaS", value: 25, unit: "%", source: "internal", data_date: "2026-01-01" },
    ]);

    // clear() must be called exactly once — not once per row (N+1 fix)
    expect(mockCacheClear).toHaveBeenCalledOnce();
  });

  it("throws if organizationId is missing", () => {
    expect(() => new BenchmarkService(mockSupabase, "")).toThrow(
      "BenchmarkService requires organizationId",
    );
  });
});
