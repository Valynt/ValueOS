import { beforeEach, describe, expect, it, vi } from "vitest";
import { ResearchAnalyzer } from "../index.js";

// Mock the logger and metrics from @valueos/agent-base
vi.mock("@valueos/agent-base", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
  metrics: {
    httpRequestsTotal: { inc: vi.fn() },
    httpRequestDuration: { startTimer: vi.fn(() => vi.fn()) },
    agentQueriesTotal: { inc: vi.fn() },
    agentQueryDuration: { observe: vi.fn() },
    customMetrics: new Map(),
    healthStatus: 1,
  },
  createServer: vi.fn(() => Promise.resolve()),
  getConfig: vi.fn(() => ({ PORT: 3000 })),
}));

describe("ResearchAnalyzer", () => {
  let analyzer: ResearchAnalyzer;

  beforeEach(() => {
    analyzer = new ResearchAnalyzer();
  });

  describe("analyzeResearch", () => {
    it("should analyze research for market analysis query", async () => {
      const query = "market analysis";
      const context = { userId: "user123", organizationId: "org456" };

      const result = await analyzer.analyzeResearch(query, context);

      expect(result).toHaveProperty("researches");
      expect(result).toHaveProperty("analysis");
      expect(result).toHaveProperty("timestamp");
      expect(Array.isArray(result.researches)).toBe(true);
      expect(result.researches.length).toBeGreaterThan(0);
      expect(result.analysis).toContain(query);
    });

    it("should generate market research", async () => {
      const query = "market analysis";
      const result = await analyzer.analyzeResearch(query);

      const marketResearch = result.researches.find((r: any) => r.category === "Market");
      expect(marketResearch).toBeDefined();
      expect(marketResearch?.title).toContain("Market Research");
      expect(marketResearch?.confidence).toBe(0.88);
    });

    it("should generate survey design research", async () => {
      const query = "customer survey data";
      const result = await analyzer.analyzeResearch(query);

      const dataResearch = result.researches.find((r: any) => r.category === "Data");
      expect(dataResearch).toBeDefined();
      expect(dataResearch?.title).toContain("Survey Design");
      expect(dataResearch?.confidence).toBe(0.85);
    });

    it("should generate trend analysis research", async () => {
      const query = "future trends forecast";
      const result = await analyzer.analyzeResearch(query);

      const trendResearch = result.researches.find((r: any) => r.category === "Trend");
      expect(trendResearch).toBeDefined();
      expect(trendResearch?.title).toContain("Trend Analysis");
      expect(trendResearch?.confidence).toBe(0.82);
    });

    it("should generate qualitative research", async () => {
      const query = "qualitative interview";
      const result = await analyzer.analyzeResearch(query);

      const qualResearch = result.researches.find((r: any) => r.category === "Qualitative");
      expect(qualResearch).toBeDefined();
      expect(qualResearch?.title).toContain("Qualitative Research");
      expect(qualResearch?.confidence).toBe(0.78);
    });

    it("should provide default research for unrecognized query", async () => {
      const query = "random query";
      const result = await analyzer.analyzeResearch(query);

      expect(result.researches.length).toBe(1);
      expect(result.researches[0].title).toBe("General Research Methodology");
      expect(result.researches[0].confidence).toBe(0.75);
    });

    it("should handle empty query", async () => {
      const query = "";
      const result = await analyzer.analyzeResearch(query);

      expect(result.researches.length).toBe(1);
      expect(result.researches[0].title).toBe("General Research Methodology");
    });
  });
});
