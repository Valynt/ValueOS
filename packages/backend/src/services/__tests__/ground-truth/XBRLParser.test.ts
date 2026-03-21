/**
 * XBRLParser Unit Tests
 *
 * Tests for SEC XBRL companyfacts API parser.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { XBRLParser } from "../../../services/ground-truth/XBRLParser.js";

// Mock logger
vi.mock("../../../lib/logger.js", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
}));

describe("XBRLParser", () => {
  let parser: XBRLParser;

  beforeEach(() => {
    parser = new XBRLParser();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("parseCompanyFacts", () => {
    it("should parse company facts from SEC API", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          cik: "0000320193",
          entityName: "Apple Inc.",
          facts: {
            "us-gaap": {
              Revenues: {
                label: "Revenues",
                description: "Amount of revenue",
                units: {
                  USD: [
                    { val: 394328000000, filed: "2023-11-03", fy: "2023", fp: "FY", form: "10-K" },
                    { val: 365817000000, filed: "2022-10-28", fy: "2022", fp: "FY", form: "10-K" },
                  ],
                },
              },
              NetIncomeLoss: {
                label: "Net Income",
                description: "Net income",
                units: {
                  USD: [
                    { val: 96995000000, filed: "2023-11-03", fy: "2023", fp: "FY", form: "10-K" },
                  ],
                },
              },
            },
          },
        }),
      } as unknown as Response);

      const result = await parser.parseCompanyFacts("0000320193");

      expect(result).not.toBeNull();
      expect(result?.cik).toBe("0000320193");
      expect(result?.company_name).toBe("Apple Inc.");
      expect(result?.facts).toHaveLength(2);
      expect(result?.facts[0].metric_name).toBe("revenue");
      expect(result?.facts[1].metric_name).toBe("net_income");
    });

    it("should deduplicate facts by metric and period", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          cik: "0000320193",
          entityName: "Apple Inc.",
          facts: {
            "us-gaap": {
              Revenues: {
                label: "Revenues",
                units: {
                  USD: [
                    { val: 394328000000, filed: "2023-11-03", fy: "2023", fp: "FY", form: "10-K" },
                    { val: 394328000000, filed: "2023-10-15", fy: "2023", fp: "FY", form: "10-K" }, // Duplicate
                  ],
                },
              },
            },
          },
        }),
      } as unknown as Response);

      const result = await parser.parseCompanyFacts("0000320193");

      // Should only have one fact for 2023
      const revenueFacts = result?.facts.filter(f => f.metric_name === "revenue");
      expect(revenueFacts).toHaveLength(1);
    });

    it("should return null on 404 (no XBRL data)", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      } as Response);

      const result = await parser.parseCompanyFacts("0000000000");
      expect(result).toBeNull();
    });

    it("should return null on API error", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      const result = await parser.parseCompanyFacts("0000320193");
      expect(result).toBeNull();
    });
  });

  describe("getMetricHistory", () => {
    it("should return sorted metric history", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          cik: "0000320193",
          entityName: "Apple Inc.",
          facts: {
            "us-gaap": {
              Revenues: {
                label: "Revenues",
                units: {
                  USD: [
                    { val: 394328000000, filed: "2023-11-03", fy: "2023", fp: "FY", form: "10-K" },
                    { val: 365817000000, filed: "2022-10-28", fy: "2022", fp: "FY", form: "10-K" },
                    { val: 365817000000, filed: "2022-09-15", fy: "2022", fp: "Q4", form: "10-Q" },
                    { val: 365817000000, filed: "2022-06-15", fy: "2022", fp: "Q3", form: "10-Q" },
                    { val: 365817000000, filed: "2022-03-15", fy: "2022", fp: "Q2", form: "10-Q" },
                  ],
                },
              },
            },
          },
        }),
      } as unknown as Response);

      const history = await parser.getMetricHistory("0000320193", "revenue");

      expect(history).not.toBeNull();
      expect(history).toHaveLength(2); // Only FY entries, deduplicated
      expect(history?.[0].period).toBe("2023"); // Most recent first
    });
  });

  describe("getFinancialSummary", () => {
    it("should return standard financial metrics", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          cik: "0000320193",
          entityName: "Apple Inc.",
          facts: {
            "us-gaap": {
              Revenues: {
                label: "Revenues",
                units: { USD: [{ val: 394328000000, filed: "2023-11-03", fy: "2023", fp: "FY", form: "10-K" }] },
              },
              NetIncomeLoss: {
                label: "Net Income",
                units: { USD: [{ val: 96995000000, filed: "2023-11-03", fy: "2023", fp: "FY", form: "10-K" }] },
              },
              Assets: {
                label: "Assets",
                units: { USD: [{ val: 352755000000, filed: "2023-11-03", fy: "2023", fp: "FY", form: "10-K" }] },
              },
              Liabilities: {
                label: "Liabilities",
                units: { USD: [{ val: 290437000000, filed: "2023-11-03", fy: "2023", fp: "FY", form: "10-K" }] },
              },
            },
          },
        }),
      } as unknown as Response);

      const summary = await parser.getFinancialSummary("0000320193");

      expect(summary).not.toBeNull();
      expect(summary?.revenue).toHaveLength(1);
      expect(summary?.net_income).toHaveLength(1);
      expect(summary?.total_assets).toHaveLength(1);
      expect(summary?.total_liabilities).toHaveLength(1);
    });

    it("should return null when no XBRL data", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      } as Response);

      const summary = await parser.getFinancialSummary("0000000000");
      expect(summary).toBeNull();
    });
  });

  describe("User-Agent header", () => {
    it("should include required User-Agent header", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          cik: "0000320193",
          entityName: "Apple Inc.",
          facts: {},
        }),
      } as unknown as Response);
      global.fetch = fetchMock;

      await parser.parseCompanyFacts("0000320193");

      expect(fetchMock).toHaveBeenCalledWith(
        "https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json",
        expect.objectContaining({
          headers: expect.objectContaining({
            "User-Agent": expect.any(String),
          }),
        })
      );
    });
  });
});
