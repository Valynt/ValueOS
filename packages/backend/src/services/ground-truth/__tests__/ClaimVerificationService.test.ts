/**
 * ClaimVerificationService Tests (Task 11.5)
 *
 * Unit tests for match, contradiction, and unverifiable cases.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { claimVerificationService, type Claim } from "../ClaimVerificationService.js";
import { mcpGroundTruthService } from "../../MCPGroundTruthService.js";
import { benchmarkRetrievalService } from "../BenchmarkRetrievalService.js";
import { groundTruthCache } from "../GroundTruthCache.js";

// Mock dependencies
vi.mock("../../MCPGroundTruthService.js", () => ({
  mcpGroundTruthService: {
    getFinancialData: vi.fn(),
    resolveTickerFromDomain: vi.fn(),
  },
}));

vi.mock("../BenchmarkRetrievalService.js", () => ({
  benchmarkRetrievalService: {
    retrieveBenchmark: vi.fn(),
  },
}));

vi.mock("../GroundTruthCache.js", () => ({
  groundTruthCache: {
    get: vi.fn(),
    set: vi.fn(),
  },
}));

describe("ClaimVerificationService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (groundTruthCache.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (groundTruthCache.set as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
  });

  describe("verifyClaim - Match cases", () => {
    it("should verify claim as match when within SEC tolerance", async () => {
      const claim: Claim = {
        metric: "revenue",
        value: 383285000000, // Apple revenue ~383B
        cik: "0000320193",
        unit: "USD",
      };

      (mcpGroundTruthService.getFinancialData as ReturnType<typeof vi.fn>).mockResolvedValue({
        metrics: {
          revenue: { value: 383285000000 },
        },
        period: "2023",
      });

      const result = await claimVerificationService.verifyClaim(claim);

      expect(result.status).toBe("match");
      expect(result.confidence).toBeGreaterThan(0.9);
      expect(result.sources[0].tier).toBe("tier_1_sec");
    });

    it("should verify claim as match with small deviation", async () => {
      const claim: Claim = {
        metric: "revenue",
        value: 390000000000, // ~2% deviation
        cik: "0000320193",
      };

      (mcpGroundTruthService.getFinancialData as ReturnType<typeof vi.fn>).mockResolvedValue({
        metrics: {
          revenue: { value: 383285000000 },
        },
      });

      const result = await claimVerificationService.verifyClaim(claim);

      expect(result.status).toBe("match");
      expect(result.deviation).toBeLessThan(0.1);
    });
  });

  describe("verifyClaim - Contradiction cases", () => {
    it("should flag contradiction with major severity for large deviation", async () => {
      const claim: Claim = {
        metric: "revenue",
        value: 500000000000, // Way off from ~383B
        cik: "0000320193",
      };

      (mcpGroundTruthService.getFinancialData as ReturnType<typeof vi.fn>).mockResolvedValue({
        metrics: {
          revenue: { value: 383285000000 },
        },
      });

      const result = await claimVerificationService.verifyClaim(claim);

      expect(result.status).toBe("contradiction");
      expect(result.severity).toBe("major");
      expect(result.deviation).toBeGreaterThan(0.1);
    });

    it("should flag contradiction with moderate severity for medium deviation", async () => {
      const claim: Claim = {
        metric: "revenue",
        value: 450000000000, // ~17% deviation
        cik: "0000320193",
      };

      (mcpGroundTruthService.getFinancialData as ReturnType<typeof vi.fn>).mockResolvedValue({
        metrics: {
          revenue: { value: 383285000000 },
        },
      });

      const result = await claimVerificationService.verifyClaim(claim);

      expect(result.status).toBe("contradiction");
      expect(result.severity).toBe("moderate");
    });
  });

  describe("verifyClaim - Unverifiable cases", () => {
    it("should mark as unverifiable when no CIK and no industry", async () => {
      const claim: Claim = {
        metric: "revenue",
        value: 1000000,
        // No CIK, no industry
      };

      const result = await claimVerificationService.verifyClaim(claim);

      expect(result.status).toBe("unverifiable");
      expect(result.confidence).toBeLessThan(0.5);
      expect(result.sources).toHaveLength(0);
    });

    it("should mark as unverifiable when API returns no data", async () => {
      const claim: Claim = {
        metric: "revenue",
        value: 1000000,
        industry: "unknown-industry",
      };

      (benchmarkRetrievalService.retrieveBenchmark as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await claimVerificationService.verifyClaim(claim);

      expect(result.status).toBe("unverifiable");
      expect(result.explanation).toContain("No authoritative data");
    });

    it("should use benchmark when no CIK but industry available", async () => {
      const claim: Claim = {
        metric: "ARR",
        value: 5000000,
        industry: "SaaS",
        companySize: "medium",
      };

      (benchmarkRetrievalService.retrieveBenchmark as ReturnType<typeof vi.fn>).mockResolvedValue({
        industry: "SaaS",
        metricId: "ARR",
        metricName: "Annual Recurring Revenue",
        distribution: { p25: 1000000, p50: 5000000, p75: 10000000, p90: 50000000 },
        source: "benchmark-provider",
        date: "2024-01-15",
        sampleSize: 1000,
        confidence: 0.85,
        unit: "USD",
      });

      const result = await claimVerificationService.verifyClaim(claim);

      expect(result.status).toBe("match"); // Value matches p50
      expect(result.sources[0].tier).toBe("tier_2_benchmark");
    });
  });

  describe("verifyClaimBatch", () => {
    it("should verify multiple claims in batch", async () => {
      const claims: Claim[] = [
        { metric: "revenue", value: 383285000000, cik: "0000320193" },
        { metric: "net_income", value: 97000000000, cik: "0000320193" },
      ];

      (mcpGroundTruthService.getFinancialData as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          metrics: { revenue: { value: 383285000000 } },
        })
        .mockResolvedValueOnce({
          metrics: { net_income: { value: 96995000000 } },
        });

      const results = await claimVerificationService.verifyClaimBatch(claims);

      expect(results).toHaveLength(2);
      expect(results[0].status).toBe("match");
      expect(results[1].status).toBe("match");
    });
  });

  describe("caching", () => {
    it("should use cache when available", async () => {
      const claim: Claim = {
        metric: "revenue",
        value: 383285000000,
        cik: "0000320193",
      };

      const cachedResult = {
        claim,
        status: "match",
        confidence: 0.95,
        sources: [{ name: "SEC", tier: "tier_1_sec", date: "2024-01-15" }],
      };

      (groundTruthCache.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        hit: true,
        data: cachedResult,
        age: 1000,
      });

      const result = await claimVerificationService.verifyClaim(claim);

      expect(result.status).toBe("match");
      expect(mcpGroundTruthService.getFinancialData).not.toHaveBeenCalled();
    });
  });
});
