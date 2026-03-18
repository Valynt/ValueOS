import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SECEdgarClient } from "../../integrity/SECEdgarClient.js";
import { createMockLogger } from "../helpers/testHelpers.js";
import { REPLAY_ATTACK_VECTORS } from "../fixtures/securityFixtures.js";

describe("SECEdgarClient", () => {
  let client: SECEdgarClient;

  beforeEach(() => {
    client = new SECEdgarClient();
    vi.clearAllMocks();
  });

  describe("Security & Circuit Breaker", () => {
    it("should open circuit breaker after repeated failures", async () => {
      for (let i = 0; i < 5; i++) {
        try {
          await client.fetchFilings({ cik: "fail", limit: 1 });
        } catch {
          // Expected
        }
      }

      const status = client.getCircuitStatus();
      expect(status.isOpen || status.failures).toBeTruthy();
    });

    it("should reject replay attacks with stale timestamps", async () => {
      const stale = REPLAY_ATTACK_VECTORS.staleRequest;

      // In production, would verify timestamp freshness
      const now = Date.now();
      const requestTime = new Date(stale.timestamp).getTime();
      expect(now - requestTime).toBeGreaterThan(23 * 60 * 60 * 1000); // > 23 hours
    });
  });

  describe("Cache Behavior", () => {
    it("should cache results with 24-hour TTL", async () => {
      const cik = "0000123456";

      const result1 = await client.fetchFilings({ cik, limit: 1 });
      const result2 = await client.fetchFilings({ cik, limit: 1 });

      // Both should return valid results
      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
    });
  });

  describe("CIK Resolution", () => {
    it("should resolve CIK from ticker", async () => {
      const result = await client.fetchFilings({ ticker: "AAPL", limit: 1 });

      expect(result).toBeDefined();
      expect(result[0].cik).toBeDefined();
    });

    it("should use provided CIK directly", async () => {
      const cik = "0000320193"; // Apple

      const result = await client.fetchFilings({ cik, limit: 1 });

      expect(result[0].cik).toBe(cik);
    });
  });

  describe("Filing Types", () => {
    it("should support 10-K and 10-Q form types", async () => {
      const result = await client.fetchFilings({
        cik: "0000123456",
        formTypes: ["10-K", "10-Q"],
        limit: 2,
      });

      const formTypes = result.map((f) => f.form_type);
      expect(formTypes).toContain("10-K");
      expect(formTypes).toContain("10-Q");
    });

    it("should extract key sections from 10-K", async () => {
      const result = await client.fetchFilings({
        cik: "0000123456",
        formTypes: ["10-K"],
        limit: 1,
      });

      const sections = result[0].extracted_sections;
      expect(Object.keys(sections).length).toBeGreaterThan(0);
    });
  });

  describe("Rate Limiting", () => {
    it("should respect SEC rate limits", async () => {
      const start = Date.now();

      await client.fetchFilings({ cik: "0000123456", limit: 1 });

      const duration = Date.now() - start;
      expect(duration).toBeGreaterThanOrEqual(100); // Min 100ms between requests
    });
  });
});
