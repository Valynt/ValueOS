/**
 * SECEdgarClient Unit Tests
 *
 * Tests for SEC EDGAR API integration with circuit breaker.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { SECEdgarClient } from "../../../services/ground-truth/SECEdgarClient.js";

// Mock logger
vi.mock("../../../lib/logger.js", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
}));

describe("SECEdgarClient", () => {
  let client: SECEdgarClient;

  beforeEach(() => {
    client = new SECEdgarClient();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getCIK", () => {
    it("should return null when company not found", async () => {
      // Mock fetch to return empty tickers
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({}),
      } as unknown as Response);

      const cik = await client.getCIK("NonExistentCorp");
      expect(cik).toBeNull();
    });

    it("should return padded CIK when company found", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          "0": { ticker: "AAPL", title: "Apple Inc.", cik_str: "320193" },
        }),
      } as unknown as Response);

      const cik = await client.getCIK("Apple");
      expect(cik).toBe("0000320193");
    });

    it("should return null on API error", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      const cik = await client.getCIK("TestCorp");
      expect(cik).toBeNull();
    });
  });

  describe("fetchLatest10K", () => {
    it("should return 10-K filing metadata", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          filings: {
            recent: {
              form: ["10-K", "10-Q"],
              filingDate: ["2024-01-15", "2024-04-15"],
              accessionNumber: ["0000320193-24-000001", "0000320193-24-000002"],
              primaryDocument: ["aapl-20230930.htm", "aapl-20231230.htm"],
            },
          },
        }),
      } as unknown as Response);

      const filing = await client.fetchLatest10K("0000320193");

      expect(filing).not.toBeNull();
      expect(filing?.form).toBe("10-K");
      expect(filing?.cik).toBe("0000320193");
      expect(filing?.primary_document_url).toContain("sec.gov");
    });

    it("should return null when no 10-K found", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          filings: {
            recent: {
              form: ["10-Q", "8-K"],
              filingDate: ["2024-04-15"],
              accessionNumber: ["0000320193-24-000002"],
              primaryDocument: ["doc.htm"],
            },
          },
        }),
      } as unknown as Response);

      const filing = await client.fetchLatest10K("0000320193");
      expect(filing).toBeNull();
    });

    it("should return null for 404 response (non-public company)", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      } as Response);

      const filing = await client.fetchLatest10K("0000000000");
      expect(filing).toBeNull();
    });
  });

  describe("fetchLatest10Q", () => {
    it("should return 10-Q filing metadata", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          filings: {
            recent: {
              form: ["10-K", "10-Q"],
              filingDate: ["2024-01-15", "2024-04-15"],
              accessionNumber: ["0000320193-24-000001", "0000320193-24-000002"],
              primaryDocument: ["aapl-20230930.htm", "aapl-20231230.htm"],
            },
          },
        }),
      } as unknown as Response);

      const filing = await client.fetchLatest10Q("0000320193");

      expect(filing).not.toBeNull();
      expect(filing?.form).toBe("10-Q");
    });
  });

  describe("circuit breaker", () => {
    it("should start with closed circuit", () => {
      const status = client.getCircuitStatus();
      expect(status.isOpen).toBe(false);
      expect(status.failures).toBe(0);
    });

    it("should open circuit after repeated failures", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      // Trigger multiple failures
      for (let i = 0; i < 6; i++) {
        try {
          await client.getCIK("TestCorp");
        } catch {
          // Expected
        }
      }

      const status = client.getCircuitStatus();
      expect(status.isOpen).toBe(true);
      expect(status.failures).toBeGreaterThanOrEqual(5);
    });
  });

  describe("User-Agent header", () => {
    it("should include required User-Agent header", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({}),
      } as unknown as Response);
      global.fetch = fetchMock;

      await client.getCIK("TestCorp");

      expect(fetchMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            "User-Agent": expect.any(String),
          }),
        })
      );
    });
  });
});
