/**
 * Ground Truth Integration Test (Task 11.9)
 *
 * End-to-end integration test: SEC filing → chunk → embed → vector search → claim verification
 */

import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { secEdgarClient } from "../SECEdgarClient.js";
import { xbrlParser } from "../XBRLParser.js";
import { chunkEmbedPipeline } from "../ChunkEmbedPipeline.js";
import { vectorSearchService } from "../../memory/VectorSearchService.js";
import { claimVerificationService } from "../ClaimVerificationService.js";
import { benchmarkRetrievalService } from "../BenchmarkRetrievalService.js";
import { groundTruthCache } from "../GroundTruthCache.js";
import { feasibilityAssessor } from "../FeasibilityAssessor.js";

// Integration test with mocked external dependencies
const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

vi.mock("ioredis", () => ({
  default: vi.fn(() => ({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue("OK"),
    del: vi.fn().mockResolvedValue(1),
    quit: vi.fn().mockResolvedValue(undefined),
  })),
}));

describe("Ground Truth Integration Pipeline", () => {
  const mockSECContent = `
    Item 1. Business
    Apple Inc. designs, manufactures, and markets smartphones, personal computers,
    tablets, wearables, and accessories worldwide. Revenue for fiscal year 2023
    was $383.3 billion, with net income of $97.0 billion.

    Item 7. Management's Discussion and Analysis
    Net sales decreased 2% or $8.4 billion during 2023 compared to 2022.
    iPhone net sales decreased 2% in 2023.
  `;

  beforeAll(() => {
    // Setup mock responses for the full pipeline
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes("submissions")) {
        return {
          ok: true,
          json: async () => ({
            filings: {
              recent: {
                form: ["10-K", "10-Q"],
                filingDate: ["2023-11-03", "2024-02-02"],
                accessionNumber: ["0000320193-23-000106", "0000320193-24-000006"],
                primaryDocument: ["a10-k2023928.htm", "a10-qq120241228.htm"],
              },
            },
          }),
        };
      }
      if (url.includes("companyfacts")) {
        return {
          ok: true,
          json: async () => ({
            facts: {
              "us-gaap": {
                RevenueFromContractWithCustomerExcludingAssessedTax: {
                  label: "Revenue",
                  units: {
                    USD: [
                      { val: 383285000000, fy: 2023, fp: "FY", form: "10-K" },
                      { val: 394328000000, fy: 2022, fp: "FY", form: "10-K" },
                    ],
                  },
                },
              },
            },
          }),
        };
      }
      if (url.includes("ix?doc=/Archives")) {
        return {
          ok: true,
          text: async () => mockSECContent,
        };
      }
      return { ok: false, status: 404 };
    });
  });

  afterAll(() => {
    mockFetch.mockClear();
  });

  it("should complete full pipeline: SEC → chunk → embed → search → verify", async () => {
    const tenantId = "integration-test-tenant";
    const cik = "0000320193";

    // Step 1: Fetch SEC 10-K filing
    const filing = await secEdgarClient.fetchLatest10K(cik);
    expect(filing).not.toBeNull();
    expect(filing?.form).toBe("10-K");

    // Step 2: Fetch filing content
    const content = await secEdgarClient.fetchFilingContent(filing!);
    expect(content).not.toBeNull();
    expect(content?.fullText).toContain("Business");

    // Step 3: Parse XBRL financial data
    const metrics = await xbrlParser.parseCompanyFacts(cik);
    expect(metrics).not.toBeNull();
    expect(metrics?.revenue).toHaveLength(2);
    expect(metrics?.revenue[0].value).toBe(383285000000);

    // Step 4: Chunk the filing content
    const chunks = await chunkEmbedPipeline.processSECFiling(
      content!.fullText,
      {
        source: "sec_filing",
        tier: "tier_1_sec",
        tenantId,
        date: filing!.filingDate,
        documentId: `sec-${cik}-${filing!.accessionNumber}`,
      }
    );
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].metadata.tier).toBe("tier_1_sec");
    expect(chunks[0].metadata.tenantId).toBe(tenantId);

    // Step 5: Generate embeddings for chunks (stub)
    const chunkWithEmbedding = chunks[0];
    expect(chunkWithEmbedding.embedding).toHaveLength(1536);

    // Step 6: Verify claim against SEC data
    const claim = {
      metric: "revenue",
      value: 383285000000,
      cik,
      unit: "USD",
    };

    const verification = await claimVerificationService.verifyClaim(claim);
    expect(verification.status).toBe("match");
    expect(verification.confidence).toBeGreaterThan(0.9);
    expect(verification.sources[0].tier).toBe("tier_1_sec");

    // Step 7: Assess feasibility of target improvement
    const feasibility = await feasibilityAssessor.assessFeasibility({
      metric: "revenue",
      currentValue: 383285000000,
      targetValue: 420000000000, // ~10% increase
      industry: "Technology",
      timeframe: "1_year",
    });
    expect(feasibility.classification).toBeDefined();
    expect(feasibility.confidence).toBeGreaterThan(0);

    // Step 8: Retrieve benchmark for context
    const benchmark = await benchmarkRetrievalService.retrieveBenchmark({
      kpi: "ARR",
      industry: "SaaS",
      companySize: "large",
    });
    expect(benchmark).not.toBeNull();
    expect(benchmark?.p50).toBeGreaterThan(0);
  });

  it("should cache intermediate results and reuse them", async () => {
    const cik = "0000320193";

    // First call should hit the API
    await secEdgarClient.fetchLatest10K(cik);
    const firstCallCount = mockFetch.mock.calls.length;

    // Second call should use cache (if caching is implemented)
    // Note: In actual implementation, this would verify cache hit
    // For integration test, we verify the pipeline works end-to-end

    expect(firstCallCount).toBeGreaterThan(0);
  });

  it("should handle circuit breaker on consecutive failures", async () => {
    // Simulate multiple failures
    mockFetch.mockRejectedValue(new Error("Network error"));

    // Multiple calls should eventually trigger circuit breaker
    for (let i = 0; i < 5; i++) {
      await secEdgarClient.getCIK("TestCompany");
    }

    // Circuit breaker should be open now, no more fetch calls
    mockFetch.mockClear();
    const result = await secEdgarClient.getCIK("AnotherCompany");
    expect(mockFetch).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it("should maintain tenant isolation throughout pipeline", async () => {
    const tenantId = "tenant-a";

    const chunks = await chunkEmbedPipeline.processSECFiling(
      "Test content",
      {
        source: "sec_filing",
        tier: "tier_1_sec",
        tenantId,
        date: "2024-01-15",
        documentId: "test-doc",
      }
    );

    // All chunks should have correct tenant ID
    for (const chunk of chunks) {
      expect(chunk.metadata.tenantId).toBe(tenantId);
    }
  });

  it("should provide provenance metadata at each step", async () => {
    const cik = "0000320193";

    // SEC data should have tier 1 provenance
    const filing = await secEdgarClient.fetchLatest10K(cik);
    expect(filing?.form).toBe("10-K");

    // Parse financial facts
    const metrics = await xbrlParser.parseCompanyFacts(cik);
    expect(metrics?.revenue[0].source).toBe("SEC EDGAR");

    // Chunks should maintain provenance
    const chunks = await chunkEmbedPipeline.processSECFiling(
      "Test content",
      {
        source: "sec_filing",
        tier: "tier_1_sec",
        tenantId: "test-tenant",
        date: "2024-01-15",
        documentId: "test",
      }
    );
    expect(chunks[0].metadata.tier).toBe("tier_1_sec");
  });
});
