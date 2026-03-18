/**
 * SECEdgarClient Tests (Task 11.1)
 *
 * Unit tests for SEC EDGAR client with mocked API responses.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { SECEdgarClient, secEdgarClient, type SECFiling, type FilingContent } from "../SECEdgarClient.js";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

describe("SECEdgarClient", () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  describe("getCIK", () => {
    it("should resolve company name to CIK", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          hits: {
            hits: [
              {
                _source: {
                  cik: "0000320193",
                  name: "Apple Inc.",
                },
              },
            ],
          },
        }),
      } as Response);

      const cik = await secEdgarClient.getCIK("Apple");
      expect(cik).toBe("0000320193");
    });

    it("should return null if no CIK found", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          hits: {
            hits: [],
          },
        }),
      } as Response);

      const cik = await secEdgarClient.getCIK("NonExistentCompanyXYZ");
      expect(cik).toBeNull();
    });

    it("should handle API errors gracefully", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const cik = await secEdgarClient.getCIK("Apple");
      expect(cik).toBeNull();
    });
  });

  describe("fetchLatest10K", () => {
    it("should fetch latest 10-K filing", async () => {
      const mockFilings = {
        filings: {
          recent: {
            form: ["10-K", "10-Q", "8-K"],
            filingDate: ["2024-01-15", "2024-04-15", "2024-06-01"],
            accessionNumber: ["0000320193-24-000001", "0000320193-24-000002", "0000320193-24-000003"],
            primaryDocument: ["aapl-2023x10k.htm", "aapl-10q-2024q2.htm", "aapl-8k-20240601.htm"],
          },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockFilings,
      } as Response);

      const filing = await secEdgarClient.fetchLatest10K("0000320193");

      expect(filing).not.toBeNull();
      expect(filing?.form).toBe("10-K");
      expect(filing?.filingDate).toBe("2024-01-15");
      expect(filing?.accessionNumber).toBe("0000320193-24-000001");
    });

    it("should return null if no 10-K found", async () => {
      const mockFilings = {
        filings: {
          recent: {
            form: ["10-Q", "8-K"],
            filingDate: ["2024-04-15", "2024-06-01"],
            accessionNumber: ["0000320193-24-000002", "0000320193-24-000003"],
            primaryDocument: ["aapl-10q-2024q2.htm", "aapl-8k-20240601.htm"],
          },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockFilings,
      } as Response);

      const filing = await secEdgarClient.fetchLatest10K("0000320193");
      expect(filing).toBeNull();
    });
  });

  describe("fetchLatest10Q", () => {
    it("should fetch latest 10-Q filing", async () => {
      const mockFilings = {
        filings: {
          recent: {
            form: ["10-K", "10-Q", "10-Q"],
            filingDate: ["2024-01-15", "2024-04-15", "2024-07-15"],
            accessionNumber: ["0000320193-24-000001", "0000320193-24-000002", "0000320193-24-000004"],
            primaryDocument: ["aapl-2023x10k.htm", "aapl-10q-2024q2.htm", "aapl-10q-2024q3.htm"],
          },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockFilings,
      } as Response);

      const filing = await secEdgarClient.fetchLatest10Q("0000320193");

      expect(filing).not.toBeNull();
      expect(filing?.form).toBe("10-Q");
      expect(filing?.filingDate).toBe("2024-07-15");
    });
  });

  describe("fetchFilingContent", () => {
    it("should fetch filing content", async () => {
      const mockFiling: SECFiling = {
        cik: "0000320193",
        form: "10-K",
        filingDate: "2024-01-15",
        accessionNumber: "0000320193-24-000001",
        primaryDocument: "aapl-2023x10k.htm",
      };

      const mockHtml = `
        <html>
          <body>
            <div>Item 1. Business</div>
            <p>Apple Inc. designs, manufactures, and markets smartphones...</p>
            <div>Item 7. MD&A</div>
            <p>The Company's net sales increased 8% in 2023...</p>
          </body>
        </html>
      `;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => mockHtml,
      } as Response);

      const content = await secEdgarClient.fetchFilingContent(mockFiling);

      expect(content).not.toBeNull();
      expect(content?.fullText).toContain("Apple Inc.");
      expect(content?.sections.get("business")).toContain("smartphones");
    });

    it("should handle missing filing content", async () => {
      const mockFiling: SECFiling = {
        cik: "0000320193",
        form: "10-K",
        filingDate: "2024-01-15",
        accessionNumber: "0000320193-24-000001",
        primaryDocument: "missing.htm",
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
      } as Response);

      const content = await secEdgarClient.fetchFilingContent(mockFiling);
      expect(content).toBeNull();
    });
  });

  describe("circuit breaker", () => {
    it("should trigger circuit breaker after consecutive failures", async () => {
      // Simulate 5 consecutive failures
      for (let i = 0; i < 5; i++) {
        mockFetch.mockRejectedValueOnce(new Error("Network error"));
        await secEdgarClient.getCIK("Test");
      }

      // Next call should fail immediately due to circuit breaker
      mockFetch.mockClear();
      const result = await secEdgarClient.getCIK("Test");
      expect(result).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});
