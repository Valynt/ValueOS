import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveTickerFromDomain: vi.fn(),
  getFilingSections: vi.fn(),
  crawlWebsite: vi.fn(),
  extractAllEntities: vi.fn(),
}));

vi.mock("../../MCPGroundTruthService.js", () => ({
  mcpGroundTruthService: {
    resolveTickerFromDomain: mocks.resolveTickerFromDomain,
    getFilingSections: mocks.getFilingSections,
  },
}));

vi.mock("../../SemanticMemory.js", () => ({
  semanticMemory: {
    chunkText: vi.fn(() => ["chunk"]),
    storeChunk: vi.fn().mockResolvedValue("chunk-1"),
  },
}));

vi.mock("../WebCrawler.js", () => ({
  crawlWebsite: mocks.crawlWebsite,
}));

vi.mock("../SuggestionExtractor.js", () => ({
  extractAllEntities: mocks.extractAllEntities,
}));

vi.mock("../ValueHypothesisGenerator.js", () => ({
  generateValueHypotheses: vi.fn().mockResolvedValue([]),
}));

import {
  processResearchJob,
  type ResearchJobInput,
} from "../ResearchJobWorker.js";

type QueryRecord = {
  table: string;
  eqCalls: Array<[string, unknown]>;
};

function createSupabaseMock(records: QueryRecord[]) {
  return {
    from(table: string) {
      const record: QueryRecord = { table, eqCalls: [] };
      records.push(record);

      const chain = {
        select: vi.fn(() => chain),
        update: vi.fn(() => chain),
        upsert: vi.fn(() => ({ error: null })),
        maybeSingle: vi.fn(async () => ({
          data: { id: "ctx-1", metadata: {}, version: 1 },
          error: null,
        })),
        single: vi.fn(async () => ({
          data: { entity_status: {} },
          error: null,
        })),
        eq: vi.fn((column: string, value: unknown) => {
          record.eqCalls.push([column, value]);
          return chain;
        }),
      };

      return chain;
    },
  };
}

describe("ResearchJobWorker tenant isolation", () => {
  it("scopes company_research_jobs reads/writes with tenant_id in background processing", async () => {
    const records: QueryRecord[] = [];
    const supabase = createSupabaseMock(records);

    mocks.resolveTickerFromDomain.mockResolvedValue({ ticker: "ACME" });
    mocks.getFilingSections.mockRejectedValue(new Error("sec down"));
    mocks.crawlWebsite.mockResolvedValue({
      pages: [],
      totalChars: 0,
      durationMs: 10,
    });
    mocks.extractAllEntities.mockResolvedValue([]);

    const input: ResearchJobInput = {
      jobId: "job-1",
      tenantId: "tenant-abc",
      contextId: "ctx-1",
      website: "https://acme.com",
    };

    await processResearchJob(input, supabase as never, { complete: vi.fn() });

    const jobTableOps = records.filter(
      record => record.table === "company_research_jobs"
    );
    expect(jobTableOps.length).toBeGreaterThan(0);

    for (const op of jobTableOps) {
      expect(op.eqCalls).toContainEqual(["tenant_id", "tenant-abc"]);
    }
  });
});
