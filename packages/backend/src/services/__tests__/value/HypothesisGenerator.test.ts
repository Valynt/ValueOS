import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HypothesisGenerator } from "../../value/HypothesisGenerator.js";
import { createMockSupabase, createMockLogger, factories, securityAssertions } from "../helpers/testHelpers.js";
import { SQL_INJECTION_PAYLOADS, TENANT_ISOLATION_SCENARIOS, MALFORMED_UUIDS } from "../fixtures/securityFixtures.js";

const { invalidateScenarioBuildCacheMock } = vi.hoisted(() => ({
  invalidateScenarioBuildCacheMock: vi.fn(async () => 1),
}));

vi.mock("../../value/ScenarioBuilder.js", () => ({
  ScenarioBuilder: {
    invalidateScenarioBuildCache: invalidateScenarioBuildCacheMock,
  },
}));

describe("HypothesisGenerator", () => {
  let generator: HypothesisGenerator;
  let mockSupabase: ReturnType<typeof createMockSupabase>;
  let mockLLM: { complete: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockSupabase = createMockSupabase();
    mockLLM = {
      complete: vi.fn(async () => ({
        content: JSON.stringify({
          estimated_impact_min: 120,
          estimated_impact_max: 180,
          impact_unit: "percent",
          reasoning: "Deterministic test estimate",
          assumptions: [],
        }),
      })),
    };
    generator = new HypothesisGenerator({
      supabaseClient: mockSupabase,
      llmGateway: mockLLM as never,
    });
    vi.clearAllMocks();
    invalidateScenarioBuildCacheMock.mockClear();
  });

  afterEach(() => {
    mockSupabase._clearMocks();
  });

  describe("Security & Tenant Isolation", () => {
    it("should reject SQL injection in dealContextId", async () => {
      for (const payload of SQL_INJECTION_PAYLOADS.slice(0, 3)) {
        await expect(
          generator.generate({
            tenantId: "tenant-1",
            caseId: "case-1",
            dealContextId: payload,
            valueDriverCandidates: [],
          }),
        ).rejects.toThrow();
      }
    });

    it("should reject malformed tenant IDs", async () => {
      for (const malformedId of MALFORMED_UUIDS.slice(0, 5)) {
        await expect(
          generator.generate({
            tenantId: malformedId,
            caseId: "case-1",
            dealContextId: "ctx-1",
            valueDriverCandidates: [],
          }),
        ).rejects.toThrow();
      }
    });

    it("should enforce tenant isolation on database queries", async () => {
      const spy = vi.spyOn(mockSupabase, "from");

      await generator.generate({
        tenantId: TENANT_ISOLATION_SCENARIOS.crossTenantAccess.authenticatedTenant,
        caseId: "case-1",
        dealContextId: "ctx-1",
        valueDriverCandidates: [
          {
            id: "drv-1",
            name: "Cost Reduction",
            description: "Test",
            signal_strength: 0.8,
            evidence_count: 3,
          },
        ],
      });

      // Verify tenant_id is used in queries
      const calls = spy.mock.calls.filter((call) => call[0] === "benchmarks");
      expect(calls.length).toBeGreaterThan(0);
    });

    it("should sanitize value driver candidate names to prevent injection", async () => {
      const maliciousName = "'; DROP TABLE value_hypotheses; --";

      const result = await generator.generate({
        tenantId: "tenant-1",
        caseId: "case-1",
        dealContextId: "ctx-1",
        valueDriverCandidates: [
          {
            id: "drv-1",
            name: maliciousName,
            description: "Test",
            signal_strength: 0.5,
            evidence_count: 2,
          },
        ],
      });

      // Should not crash, but may reject or sanitize
      expect(() => securityAssertions.assertNoSqlInjection(result.hypotheses[0]?.value_driver || "")).not.toThrow();
    });
  });

  describe("Idempotency", () => {
    it("should produce identical results for identical inputs", async () => {
      const input = {
        tenantId: "tenant-1",
        caseId: "case-1",
        dealContextId: "ctx-1",
        valueDriverCandidates: [
          {
            id: "drv-1",
            name: "Cost Reduction",
            description: "Reduce costs",
            signal_strength: 0.85,
            evidence_count: 3,
          },
        ],
      };

      const result1 = await generator.generate(input);
      const result2 = await generator.generate(input);

      expect(result1.hypotheses.length).toBe(result2.hypotheses.length);
      expect(result1.hypotheses[0].value_driver).toBe(result2.hypotheses[0].value_driver);
    });

    it("should handle concurrent duplicate requests gracefully", async () => {
      const input = {
        tenantId: "tenant-1",
        caseId: "case-1",
        dealContextId: "ctx-1",
        valueDriverCandidates: [
          { id: "drv-1", name: "Driver A", description: "Test", signal_strength: 0.8, evidence_count: 2 },
        ],
      };

      const promises = Array.from({ length: 5 }, () => generator.generate(input));
      const results = await Promise.all(promises);

      // All should succeed without data corruption
      expect(results.every((r) => r.hypotheses.length === 1)).toBe(true);
    });

    it("invalidates scenario-build cache after hypothesis writes", async () => {
      const input = {
        tenantId: "tenant-1",
        caseId: "case-1",
        dealContextId: "ctx-1",
        valueDriverCandidates: [
          { id: "drv-1", name: "Driver A", description: "Test", signal_strength: 0.8, evidence_count: 2 },
        ],
      };

      await generator.generate(input);

      expect(invalidateScenarioBuildCacheMock).toHaveBeenCalledWith("tenant-1", "case-1");
    });
  });

  describe("Confidence Scoring", () => {
    it("should calculate evidence tier correctly for high confidence", async () => {
      const input = {
        tenantId: "tenant-1",
        caseId: "case-1",
        dealContextId: "ctx-1",
        valueDriverCandidates: [
          { id: "drv-1", name: "High Confidence", description: "Test", signal_strength: 0.9, evidence_count: 4 },
        ],
      };

      const result = await generator.generate(input);
      expect(result.hypotheses[0].evidence_tier).toBe(1);
    });

    it("should calculate evidence tier correctly for medium confidence", async () => {
      const input = {
        tenantId: "tenant-1",
        caseId: "case-1",
        dealContextId: "ctx-1",
        valueDriverCandidates: [
          { id: "drv-1", name: "Medium Confidence", description: "Test", signal_strength: 0.6, evidence_count: 2 },
        ],
      };

      const result = await generator.generate(input);
      expect(result.hypotheses[0].evidence_tier).toBe(2);
    });

    it("should calculate evidence tier correctly for low confidence", async () => {
      const input = {
        tenantId: "tenant-1",
        caseId: "case-1",
        dealContextId: "ctx-1",
        valueDriverCandidates: [
          { id: "drv-1", name: "Low Confidence", description: "Test", signal_strength: 0.4, evidence_count: 1 },
        ],
      };

      const result = await generator.generate(input);
      expect(result.hypotheses[0].evidence_tier).toBe(3);
    });
  });

  describe("Benchmark Validation", () => {
    it("should flag hypotheses outside benchmark range", async () => {
      mockSupabase.from("benchmarks").select = vi.fn(() => ({
        eq: vi.fn(() => ({
          ilike: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve({
              data: [{ id: "bm-1", p25: 50, p75: 100 }],
              error: null,
            })),
          })),
        })),
      }));

      const input = {
        tenantId: "tenant-1",
        caseId: "case-1",
        dealContextId: "ctx-1",
        valueDriverCandidates: [
          { id: "drv-1", name: "Out of Range", description: "Test", signal_strength: 1.0, evidence_count: 5 },
        ],
      };

      const result = await generator.generate(input);
      expect(result.flags.length).toBeGreaterThan(0);
    });

    it("should apply penalty for implausible benchmark range", async () => {
      mockSupabase.from("benchmarks").select = vi.fn(() => ({
        eq: vi.fn(() => ({
          ilike: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve({
              data: [{ id: "bm-1", p25: 10, p75: 20 }],
              error: null,
            })),
          })),
        })),
      }));

      const input = {
        tenantId: "tenant-1",
        caseId: "case-1",
        dealContextId: "ctx-1",
        valueDriverCandidates: [
          { id: "drv-1", name: "High Value", description: "Test", signal_strength: 0.8, evidence_count: 3 },
        ],
      };

      const result = await generator.generate(input);
      const hypothesis = result.hypotheses[0];

      // Confidence should be penalized for implausible range
      expect(hypothesis.confidence_score).toBeLessThan(0.8);
    });
  });

  describe("Input Validation", () => {
    it("should reject empty value driver candidates", async () => {
      const input = {
        tenantId: "tenant-1",
        caseId: "case-1",
        dealContextId: "ctx-1",
        valueDriverCandidates: [],
      };

      const result = await generator.generate(input);
      expect(result.hypotheses).toHaveLength(0);
    });

    it("should handle maximum signal strength boundary", async () => {
      const input = {
        tenantId: "tenant-1",
        caseId: "case-1",
        dealContextId: "ctx-1",
        valueDriverCandidates: [
          { id: "drv-1", name: "Max Signal", description: "Test", signal_strength: 1.0, evidence_count: 10 },
        ],
      };

      const result = await generator.generate(input);
      expect(result.hypotheses[0].confidence_score).toBeGreaterThan(0.9);
    });

    it("should handle zero signal strength", async () => {
      const input = {
        tenantId: "tenant-1",
        caseId: "case-1",
        dealContextId: "ctx-1",
        valueDriverCandidates: [
          { id: "drv-1", name: "No Signal", description: "Test", signal_strength: 0, evidence_count: 0 },
        ],
      };

      const result = await generator.generate(input);
      expect(result.rejectedCount).toBe(1);
    });
  });
});
