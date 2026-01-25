import { describe, it, expect, vi, beforeEach } from "vitest";
import { FinancialModelingAnalyzer } from "../index";

// Mock the logger
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
  createServer: vi.fn((...args) => {
    if (args.length > 1) return Promise.resolve();
    return {};
  }),
  getConfig: vi.fn(() => ({ PORT: 3000 })),
}));

describe("FinancialModelingAnalyzer", () => {
  let analyzer: FinancialModelingAnalyzer;

  beforeEach(() => {
    analyzer = new FinancialModelingAnalyzer();
  });

  describe("analyzeFinancialModels", () => {
    it("should analyze financial models for ROI query", async () => {
      const query = "ROI analysis for new project";
      const context = { userId: "user123", organizationId: "org456" };

      const result = await analyzer.analyzeFinancialModels(query, context);

      expect(result).toHaveProperty("financial_models");
      expect(result).toHaveProperty("analysis");
      expect(result).toHaveProperty("timestamp");
      expect(Array.isArray(result.financial_models)).toBe(true);
      expect(result.financial_models.length).toBeGreaterThan(0);
      expect(result.analysis).toContain(query);
      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it("should generate ROI projection model", async () => {
      const query = "ROI return on investment";
      const result = await analyzer.analyzeFinancialModels(query);

      const roiModel = result.financial_models.find((model) =>
        model.title.includes("ROI Projection")
      );
      expect(roiModel).toBeDefined();
      expect(roiModel?.confidence).toBe(0.88);
      expect(roiModel?.category).toBe("Investment Analysis");
      expect(roiModel?.model_type).toBe("Cash Flow Model");
      expect(roiModel?.priority).toBe("High");
    });

    it("should generate business valuation model", async () => {
      const query = "business valuation";
      const result = await analyzer.analyzeFinancialModels(query);

      const valuationModel = result.financial_models.find((model) =>
        model.title.includes("Business Valuation")
      );
      expect(valuationModel).toBeDefined();
      expect(valuationModel?.confidence).toBe(0.85);
      expect(valuationModel?.category).toBe("Valuation");
      expect(valuationModel?.model_type).toBe("DCF Model");
    });

    it("should generate financial forecast model", async () => {
      const query = "budget forecast";
      const result = await analyzer.analyzeFinancialModels(query);

      const forecastModel = result.financial_models.find((model) =>
        model.title.includes("Financial Forecast")
      );
      expect(forecastModel).toBeDefined();
      expect(forecastModel?.confidence).toBe(0.82);
      expect(forecastModel?.category).toBe("Forecasting");
    });

    it("should provide default financial model for unrecognized query", async () => {
      const query = "random financial query";
      const result = await analyzer.analyzeFinancialModels(query);

      expect(result.financial_models.length).toBe(1);
      expect(result.financial_models[0].title).toBe("General Financial Model");
      expect(result.financial_models[0].confidence).toBe(0.75);
    });

    it("should include analysis summary", async () => {
      const query = "valuation model";
      const result = await analyzer.analyzeFinancialModels(query);

      expect(result.analysis).toContain("valuation model");
      expect(result.analysis).toContain("financial models");
      expect(result.analysis).toContain("projections");
    });
  });
});
