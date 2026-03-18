/**
 * XBRLParser Tests (Task 11.2)
 *
 * Unit tests for XBRL parser with sample company facts data.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { xbrlParser } from "../XBRLParser.js";

const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

describe("XBRLParser", () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  describe("parseCompanyFacts", () => {
    it("should parse GAAP-tagged financial facts", async () => {
      const mockFacts = {
        facts: {
          "us-gaap": {
            RevenueFromContractWithCustomerExcludingAssessedTax: {
              label: "Revenue",
              description: "Revenue from contracts with customers",
              units: {
                USD: [
                  { val: 383285000000, fy: 2023, fp: "FY", form: "10-K" },
                  { val: 394328000000, fy: 2022, fp: "FY", form: "10-K" },
                ],
              },
            },
            NetIncomeLoss: {
              label: "Net Income",
              description: "Net income or loss",
              units: {
                USD: [
                  { val: 96995000000, fy: 2023, fp: "FY", form: "10-K" },
                  { val: 99803000000, fy: 2022, fp: "FY", form: "10-K" },
                ],
              },
            },
          },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockFacts,
      } as Response);

      const metrics = await xbrlParser.parseCompanyFacts("0000320193");

      expect(metrics).not.toBeNull();
      expect(metrics?.revenue).toHaveLength(2);
      expect(metrics?.revenue[0].value).toBe(383285000000);
      expect(metrics?.revenue[0].unit).toBe("USD");
    });

    it("should handle missing company facts", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response);

      const metrics = await xbrlParser.parseCompanyFacts("0000000000");
      expect(metrics).toBeNull();
    });

    it("should extract 5-year historical trends", async () => {
      const mockFacts = {
        facts: {
          "us-gaap": {
            RevenueFromContractWithCustomerExcludingAssessedTax: {
              units: {
                USD: [
                  { val: 383285000000, fy: 2023, fp: "FY" },
                  { val: 394328000000, fy: 2022, fp: "FY" },
                  { val: 365817000000, fy: 2021, fp: "FY" },
                  { val: 274515000000, fy: 2020, fp: "FY" },
                  { val: 260174000000, fy: 2019, fp: "FY" },
                ],
              },
            },
          },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockFacts,
      } as Response);

      const metrics = await xbrlParser.parseCompanyFacts("0000320193");

      expect(metrics?.revenue).toHaveLength(5);
      expect(metrics?.revenue[0].year).toBe(2023);
      expect(metrics?.revenue[4].year).toBe(2019);
    });
  });

  describe("getMetricHistory", () => {
    it("should return metric history for specific metric", async () => {
      const mockFacts = {
        facts: {
          "us-gaap": {
            RevenueFromContractWithCustomerExcludingAssessedTax: {
              units: {
                USD: [
                  { val: 383285000000, fy: 2023, fp: "FY" },
                  { val: 394328000000, fy: 2022, fp: "FY" },
                ],
              },
            },
          },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockFacts,
      } as Response);

      const history = await xbrlParser.getMetricHistory("0000320193", "revenue");

      expect(history).not.toBeNull();
      expect(history).toHaveLength(2);
      expect(history?.[0].value).toBe(383285000000);
    });

    it("should handle unknown metric names", async () => {
      const mockFacts = {
        facts: {
          "us-gaap": {},
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockFacts,
      } as Response);

      const history = await xbrlParser.getMetricHistory("0000320193", "unknown_metric");
      expect(history).toBeNull();
    });
  });

  describe("getFinancialSummary", () => {
    it("should return comprehensive financial summary", async () => {
      const mockFacts = {
        facts: {
          "us-gaap": {
            RevenueFromContractWithCustomerExcludingAssessedTax: {
              units: {
                USD: [{ val: 383285000000, fy: 2023, fp: "FY" }],
              },
            },
            NetIncomeLoss: {
              units: {
                USD: [{ val: 96995000000, fy: 2023, fp: "FY" }],
              },
            },
            Assets: {
              units: {
                USD: [{ val: 352755000000, fy: 2023, fp: "FY" }],
              },
            },
            Liabilities: {
              units: {
                USD: [{ val: 290437000000, fy: 2023, fp: "FY" }],
              },
            },
          },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockFacts,
      } as Response);

      const summary = await xbrlParser.getFinancialSummary("0000320193");

      expect(summary).not.toBeNull();
      expect(summary?.revenue).toHaveLength(1);
      expect(summary?.net_income).toHaveLength(1);
      expect(summary?.total_assets).toHaveLength(1);
      expect(summary?.total_liabilities).toHaveLength(1);
    });
  });

  describe("metric name mapping", () => {
    it("should map common metric names to XBRL tags", async () => {
      const mockFacts = {
        facts: {
          "us-gaap": {
            RevenueFromContractWithCustomerExcludingAssessedTax: {
              units: {
                USD: [{ val: 1000000, fy: 2023, fp: "FY" }],
              },
            },
            SalesRevenueNet: {
              units: {
                USD: [{ val: 2000000, fy: 2023, fp: "FY" }],
              },
            },
          },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockFacts,
      } as Response);

      // Both "revenue" and "sales" should find appropriate metrics
      const history = await xbrlParser.getMetricHistory("0000320193", "revenue");
      expect(history).not.toBeNull();
      expect(history?.length).toBeGreaterThan(0);
    });
  });

  describe("deduplication", () => {
    it("should deduplicate facts from same fiscal year", async () => {
      const mockFacts = {
        facts: {
          "us-gaap": {
            RevenueFromContractWithCustomerExcludingAssessedTax: {
              units: {
                USD: [
                  { val: 383285000000, fy: 2023, fp: "FY" },
                  { val: 383285000000, fy: 2023, fp: "Q1" }, // Duplicate for FY
                  { val: 97452000000, fy: 2023, fp: "Q4" },
                ],
              },
            },
          },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockFacts,
      } as Response);

      const history = await xbrlParser.getMetricHistory("0000320193", "revenue");

      // Should deduplicate and only return FY values
      expect(history?.length).toBe(1);
      expect(history?.[0].value).toBe(383285000000);
    });
  });
});
