import { beforeEach, describe, expect, it, vi } from "vitest";
import { OpportunityAnalyzer } from "../index.js";

// Mock the logger
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
  createServer: vi.fn((...args) => {
    if (args.length > 1) return Promise.resolve();
    return {};
  }),
  getConfig: vi.fn(() => ({ PORT: 3000 })),
}));

describe("OpportunityAnalyzer", () => {
  let analyzer: OpportunityAnalyzer;

  beforeEach(() => {
    analyzer = new OpportunityAnalyzer();
  });

  describe("analyzeOpportunities", () => {
    it("should analyze opportunities for market expansion query", async () => {
      const query = "market expansion opportunities";
      const context = { userId: "user123", organizationId: "org456" };

      const result = await analyzer.analyzeOpportunities(query, context);

      expect(result).toHaveProperty("opportunities");
      expect(result).toHaveProperty("analysis");
      expect(result).toHaveProperty("timestamp");
      expect(Array.isArray(result.opportunities)).toBe(true);
      expect(result.opportunities.length).toBeGreaterThan(0);
      expect(result.analysis).toContain(query);
      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it("should generate market expansion opportunity", async () => {
      const query = "market expansion";
      const result = await analyzer.analyzeOpportunities(query);

      const marketOpp = result.opportunities.find((opp: any) => opp.title.includes("Market Expansion"));
      expect(marketOpp).toBeDefined();
      expect(marketOpp?.confidence).toBe(0.85);
      expect(marketOpp?.category).toBe("Growth");
      expect(marketOpp?.estimatedValue).toBe(2500000);
    });

    it("should generate product innovation opportunity", async () => {
      const query = "product innovation";
      const result = await analyzer.analyzeOpportunities(query);

      const productOpp = result.opportunities.find((opp: any) =>
        opp.title.includes("Product Innovation")
      );
      expect(productOpp).toBeDefined();
      expect(productOpp?.confidence).toBe(0.78);
      expect(productOpp?.category).toBe("Innovation");
    });

    it("should generate strategic partnership opportunity", async () => {
      const query = "strategic partnership";
      const result = await analyzer.analyzeOpportunities(query);

      const partnershipOpp = result.opportunities.find((opp: any) =>
        opp.title.includes("Strategic Partnership")
      );
      expect(partnershipOpp).toBeDefined();
      expect(partnershipOpp?.confidence).toBe(0.92);
      expect(partnershipOpp?.category).toBe("Strategic");
    });

    it("should provide default opportunity for unrecognized query", async () => {
      const query = "random query";
      const result = await analyzer.analyzeOpportunities(query);

      expect(result.opportunities.length).toBe(1);
      expect(result.opportunities[0].title).toBe("General Business Opportunity");
      expect(result.opportunities[0].confidence).toBe(0.65);
    });

    it("should handle empty query", async () => {
      const query = "";
      const result = await analyzer.analyzeOpportunities(query);

      expect(result.opportunities.length).toBe(1);
      expect(result.opportunities[0].title).toBe("General Business Opportunity");
    });

    it("should include analysis summary", async () => {
      const query = "market expansion";
      const result = await analyzer.analyzeOpportunities(query);

      expect(result.analysis).toContain("market expansion");
      expect(result.analysis).toContain("opportunities");
      expect(result.analysis).toContain("market trends");
    });
  });
});
