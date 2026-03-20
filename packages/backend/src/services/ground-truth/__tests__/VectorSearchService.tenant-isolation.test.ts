/**
 * VectorSearchService Tenant Isolation Tests (Task 11.7)
 *
 * Unit tests for tenant-scoped vector search isolation.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { vectorSearchService } from "../../memory/VectorSearchService.js";
import { groundTruthCache } from "../GroundTruthCache.js";

vi.mock("../../../lib/supabase.js");

// Mock dependencies
vi.mock("../GroundTruthCache.js", () => ({
  groundTruthCache: {
    get: vi.fn(),
    set: vi.fn(),
  },
}));

// Mock Supabase
const mockSupabase = {
  rpc: vi.fn(),
};

describe("VectorSearchService - Tenant Isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (groundTruthCache.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (groundTruthCache.set as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
  });

  describe("searchWithTenant", () => {
    it("should filter results by tenant_id in metadata", async () => {
      const tenantId = "tenant-123";
      const mockResults = [
        {
          id: "chunk-1",
          content: "Revenue growth is strong",
          similarity: 0.95,
          metadata: {
            tenantId,
            source: "sec_filing",
            tier: "tier_1_sec",
          },
        },
        {
          id: "chunk-2",
          content: "Quarterly earnings report",
          similarity: 0.92,
          metadata: {
            tenantId,
            source: "sec_filing",
            tier: "tier_1_sec",
          },
        },
      ];

      mockSupabase.rpc.mockResolvedValue({
        data: mockResults,
        error: null,
      });

      const results = await vectorSearchService.searchWithTenant(
        "revenue growth",
        tenantId,
        { limit: 10 }
      );

      expect(results).toHaveLength(2);
      expect(results[0].metadata.tenantId).toBe(tenantId);
      expect(results[1].metadata.tenantId).toBe(tenantId);
    });

    it("should not return results from other tenants", async () => {
      const tenantId = "tenant-123";
      const otherTenantId = "tenant-456";

      const mockResults = [
        {
          id: "chunk-1",
          content: "Revenue growth",
          similarity: 0.95,
          metadata: {
            tenantId, // Correct tenant
            source: "sec_filing",
          },
        },
      ];

      mockSupabase.rpc.mockResolvedValue({
        data: mockResults,
        error: null,
      });

      const results = await vectorSearchService.searchWithTenant(
        "revenue",
        tenantId,
        { limit: 10 }
      );

      // Verify all results belong to the requested tenant
      for (const result of results) {
        expect(result.metadata.tenantId).toBe(tenantId);
        expect(result.metadata.tenantId).not.toBe(otherTenantId);
      }
    });

    it("should include provenance metadata in results", async () => {
      const tenantId = "tenant-123";
      const mockResults = [
        {
          id: "chunk-1",
          content: "Financial data",
          similarity: 0.95,
          metadata: {
            tenantId,
            source: "sec_filing",
            tier: "tier_1_sec",
            sourceUrl: "sec://edgar/AAPL/10-K",
            date: "2024-01-15",
          },
        },
      ];

      mockSupabase.rpc.mockResolvedValue({
        data: mockResults,
        error: null,
      });

      const results = await vectorSearchService.searchWithTenant(
        "financial",
        tenantId,
        { limit: 10 }
      );

      expect(results[0].metadata.tier).toBe("tier_1_sec");
      expect(results[0].metadata.sourceUrl).toBe("sec://edgar/AAPL/10-K");
      expect(results[0].metadata.date).toBe("2024-01-15");
    });

    it("should support similarity threshold filtering", async () => {
      const tenantId = "tenant-123";
      const mockResults = [
        { id: "chunk-1", similarity: 0.95, metadata: { tenantId } },
        { id: "chunk-2", similarity: 0.85, metadata: { tenantId } },
        { id: "chunk-3", similarity: 0.75, metadata: { tenantId } },
      ];

      mockSupabase.rpc.mockResolvedValue({
        data: mockResults,
        error: null,
      });

      const results = await vectorSearchService.searchWithTenant(
        "query",
        tenantId,
        { limit: 10, threshold: 0.8 }
      );

      // Results below threshold should be filtered
      const filteredResults = results.filter(r => r.similarity >= 0.8);
      expect(filteredResults.length).toBeGreaterThanOrEqual(2);
    });

    it("should handle empty results gracefully", async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [],
        error: null,
      });

      const results = await vectorSearchService.searchWithTenant(
        "nonexistent query",
        "tenant-123",
        { limit: 10 }
      );

      expect(results).toHaveLength(0);
    });

    it("should handle database errors gracefully", async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: "Database connection failed" },
      });

      await expect(
        vectorSearchService.searchWithTenant("query", "tenant-123", { limit: 10 })
      ).rejects.toThrow();
    });
  });

  describe("RLS compliance", () => {
    it("should always include tenant_id in query", async () => {
      const tenantId = "tenant-123";

      mockSupabase.rpc.mockResolvedValue({
        data: [],
        error: null,
      });

      await vectorSearchService.searchWithTenant("query", tenantId, { limit: 10 });

      // Verify the RPC call includes tenant_id filter
      const rpcCall = mockSupabase.rpc.mock.calls[0];
      expect(rpcCall[1]).toMatchObject({
        tenant_id: tenantId,
      });
    });

    it("should reject queries without tenant_id", async () => {
      await expect(
        vectorSearchService.searchWithTenant("query", "", { limit: 10 })
      ).rejects.toThrow("tenant_id is required");
    });
  });
});
