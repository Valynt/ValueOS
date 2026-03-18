/**
 * BenchmarkRetrievalService Tests (Task 11.3)
 *
 * Unit tests for benchmark retrieval with p25/p50/p75 ranges.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { benchmarkRetrievalService, type BenchmarkQuery, type Benchmark } from "../BenchmarkRetrievalService.js";
import { groundTruthCache } from "../GroundTruthCache.js";

// Mock the cache
vi.mock("../GroundTruthCache.js", () => ({
  groundTruthCache: {
    get: vi.fn(),
    set: vi.fn(),
  },
}));

describe("BenchmarkRetrievalService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (groundTruthCache.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (groundTruthCache.set as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
  });

  describe("retrieveBenchmark", () => {
    it("should return benchmark with p25/p50/p75/p90 percentiles", async () => {
      const query: BenchmarkQuery = {
        metric: "ARR",
        industry: "SaaS",
        sizeRange: "$1M-$10M",
      };

      const benchmark = await benchmarkRetrievalService.retrieveBenchmark(query);

      expect(benchmark).not.toBeNull();
      expect(benchmark?.metric).toBe("ARR");
      expect(benchmark?.industry).toBe("SaaS");
      expect(benchmark?.p25).toBeDefined();
      expect(benchmark?.p50).toBeDefined();
      expect(benchmark?.p75).toBeDefined();
      expect(benchmark?.p90).toBeDefined();
      expect(benchmark?.sampleSize).toBeGreaterThan(0);
    });

    it("should apply size adjustment for different company sizes", async () => {
      const baseQuery: BenchmarkQuery = {
        metric: "ARR",
        industry: "SaaS",
        sizeRange: "$1M-$10M",
      };

      const baseBenchmark = await benchmarkRetrievalService.retrieveBenchmark(baseQuery);

      const adjustedQuery: BenchmarkQuery = {
        ...baseQuery,
        sizeRange: "$10M-$50M",
      };

      const adjustedBenchmark = await benchmarkRetrievalService.retrieveBenchmark(adjustedQuery);

      expect(adjustedBenchmark?.p50).toBeGreaterThan(baseBenchmark?.p50 || 0);
    });

    it("should return fallback benchmark on API failure", async () => {
      // Simulate API failure by providing invalid query that triggers fallback
      const query: BenchmarkQuery = {
        metric: "UNKNOWN_METRIC",
        industry: "UNKNOWN_INDUSTRY",
      };

      const benchmark = await benchmarkRetrievalService.retrieveBenchmark(query);

      // Should still return a benchmark (fallback)
      expect(benchmark).not.toBeNull();
      expect(benchmark?.isFallback).toBe(true);
      expect(benchmark?.p25).toBeGreaterThan(0);
    });

    it("should use cache when available", async () => {
      const cachedBenchmark: Benchmark = {
        metric: "ARR",
        industry: "SaaS",
        p25: 1000000,
        p50: 5000000,
        p75: 10000000,
        p90: 20000000,
        sampleSize: 1000,
        dateRetrieved: "2024-01-15",
        isFallback: false,
      };

      (groundTruthCache.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        hit: true,
        data: cachedBenchmark,
        age: 1000,
      });

      const query: BenchmarkQuery = {
        metric: "ARR",
        industry: "SaaS",
      };

      const benchmark = await benchmarkRetrievalService.retrieveBenchmark(query);

      expect(benchmark).toEqual(cachedBenchmark);
      expect(groundTruthCache.set).not.toHaveBeenCalled(); // Should not set cache again
    });

    it("should store benchmark in cache after retrieval", async () => {
      const query: BenchmarkQuery = {
        metric: "ARR",
        industry: "SaaS",
      };

      await benchmarkRetrievalService.retrieveBenchmark(query);

      expect(groundTruthCache.set).toHaveBeenCalledWith(
        expect.stringContaining("benchmark:"),
        expect.objectContaining({
          data: expect.any(Object),
        }),
        expect.any(Number)
      );
    });
  });

  describe("getPersonaKPIs", () => {
    it("should return CFO-specific KPIs", async () => {
      const kpis = await benchmarkRetrievalService.getPersonaKPIs("CFO");

      expect(kpis).not.toBeNull();
      expect(kpis).toContain("revenue_growth");
      expect(kpis).toContain("gross_margin");
      expect(kpis).toContain("burn_rate");
    });

    it("should return CIO-specific KPIs", async () => {
      const kpis = await benchmarkRetrievalService.getPersonaKPIs("CIO");

      expect(kpis).not.toBeNull();
      expect(kpis).toContain("it_spend");
      expect(kpis).toContain("cloud_adoption");
    });

    it("should return VP Ops-specific KPIs", async () => {
      const kpis = await benchmarkRetrievalService.getPersonaKPIs("VP Ops");

      expect(kpis).not.toBeNull();
      expect(kpis).toContain("cycle_time");
      expect(kpis).toContain("throughput");
    });

    it("should return default KPIs for unknown persona", async () => {
      const kpis = await benchmarkRetrievalService.getPersonaKPIs("UnknownRole");

      expect(kpis).not.toBeNull();
      expect(kpis?.length).toBeGreaterThan(0);
    });
  });

  describe("adjustBenchmarkForSize", () => {
    it("should increase values for larger company sizes", async () => {
      const baseBenchmark: Benchmark = {
        metric: "ARR",
        industry: "SaaS",
        p25: 1000000,
        p50: 5000000,
        p75: 10000000,
        p90: 20000000,
        sampleSize: 1000,
        dateRetrieved: "2024-01-15",
      };

      const adjusted = await benchmarkRetrievalService.adjustBenchmarkForSize(
        baseBenchmark,
        "enterprise"
      );

      expect(adjusted.p25).toBeGreaterThan(baseBenchmark.p25);
      expect(adjusted.p50).toBeGreaterThan(baseBenchmark.p50);
      expect(adjusted.p75).toBeGreaterThan(baseBenchmark.p75);
      expect(adjusted.p90).toBeGreaterThan(baseBenchmark.p90);
    });

    it("should decrease values for smaller company sizes", async () => {
      const baseBenchmark: Benchmark = {
        metric: "ARR",
        industry: "SaaS",
        p25: 1000000,
        p50: 5000000,
        p75: 10000000,
        p90: 20000000,
        sampleSize: 1000,
        dateRetrieved: "2024-01-15",
      };

      const adjusted = await benchmarkRetrievalService.adjustBenchmarkForSize(
        baseBenchmark,
        "startup"
      );

      expect(adjusted.p25).toBeLessThan(baseBenchmark.p25);
      expect(adjusted.p50).toBeLessThan(baseBenchmark.p50);
      expect(adjusted.p75).toBeLessThan(baseBenchmark.p75);
      expect(adjusted.p90).toBeLessThan(baseBenchmark.p90);
    });

    it("should mark adjusted benchmark with size_adjusted flag", async () => {
      const baseBenchmark: Benchmark = {
        metric: "ARR",
        industry: "SaaS",
        p25: 1000000,
        p50: 5000000,
        p75: 10000000,
        p90: 20000000,
        sampleSize: 1000,
        dateRetrieved: "2024-01-15",
      };

      const adjusted = await benchmarkRetrievalService.adjustBenchmarkForSize(
        baseBenchmark,
        "mid_market"
      );

      expect(adjusted.isSizeAdjusted).toBe(true);
      expect(adjusted.originalSize).toBeDefined();
    });
  });
});
