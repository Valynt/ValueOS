import { describe, it, expect, vi, beforeEach } from "vitest";
import { ExpansionAnalyzer } from "../index";

// Mock the logger and metrics from @valueos/agents/base
vi.mock("@valueos/agents/base", () => ({
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

describe("ExpansionAnalyzer", () => {
  let analyzer: ExpansionAnalyzer;

  beforeEach(() => {
    analyzer = new ExpansionAnalyzer();
  });

  describe("analyzeExpansions", () => {
    it("should analyze expansions for market expansion query", async () => {
      const query = "market expansion";
      const context = { userId: "user123", organizationId: "org456" };

      const result = await analyzer.analyzeExpansions(query, context);

      expect(result).toHaveProperty("expansions");
      expect(result).toHaveProperty("analysis");
      expect(result).toHaveProperty("timestamp");
      expect(Array.isArray(result.expansions)).toBe(true);
      expect(result.expansions.length).toBeGreaterThan(0);
      expect(result.analysis).toContain(query);
    });

    it("should generate geographic market expansion", async () => {
      const query = "geographic market";
      const result = await analyzer.analyzeExpansions(query);

      const geoExpansion = result.expansions.find((e) => e.category === "Market Expansion");
      expect(geoExpansion).toBeDefined();
      expect(geoExpansion?.title).toContain("Geographic Market");
      expect(geoExpansion?.confidence).toBe(0.85);
    });

    it("should generate product diversification expansion", async () => {
      const query = "product diversification";
      const result = await analyzer.analyzeExpansions(query);

      const productExpansion = result.expansions.find((e) => e.category === "Product Expansion");
      expect(productExpansion).toBeDefined();
      expect(productExpansion?.title).toContain("Product Line Diversification");
      expect(productExpansion?.confidence).toBe(0.78);
    });

    it("should generate customer segment expansion", async () => {
      const query = "new customer segment";
      const result = await analyzer.analyzeExpansions(query);

      const custExpansion = result.expansions.find((e) => e.category === "Customer Expansion");
      expect(custExpansion).toBeDefined();
      expect(custExpansion?.title).toContain("Customer Segment");
      expect(custExpansion?.confidence).toBe(0.82);
    });

    it("should generate distribution channel expansion", async () => {
      const query = "distribution channel";
      const result = await analyzer.analyzeExpansions(query);

      const channelExpansion = result.expansions.find((e) => e.category === "Channel Expansion");
      expect(channelExpansion).toBeDefined();
      expect(channelExpansion?.title).toContain("Distribution Channel");
      expect(channelExpansion?.confidence).toBe(0.75);
    });

    it("should provide default expansion for unrecognized query", async () => {
      const query = "random query";
      const result = await analyzer.analyzeExpansions(query);

      expect(result.expansions.length).toBe(1);
      expect(result.expansions[0].title).toBe("Operational Scaling Strategy");
      expect(result.expansions[0].confidence).toBe(0.7);
    });

    it("should handle empty query", async () => {
      const query = "";
      const result = await analyzer.analyzeExpansions(query);

      expect(result.expansions.length).toBe(1);
      expect(result.expansions[0].title).toBe("Operational Scaling Strategy");
    });
  });
});
