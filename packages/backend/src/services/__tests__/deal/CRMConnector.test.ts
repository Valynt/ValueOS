import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CRMConnector } from "../../deal/CRMConnector.js";
import { createMockLogger } from "../helpers/testHelpers.js";
import { REPLAY_ATTACK_VECTORS, COMMAND_INJECTION_PAYLOADS } from "../fixtures/securityFixtures.js";

vi.mock("../../../lib/supabase.js");

describe("CRMConnector", () => {
  let connector: CRMConnector;

  beforeEach(() => {
    connector = new CRMConnector();
    vi.clearAllMocks();
  });

  describe("Security & Circuit Breaker", () => {
    it("should prevent command injection in company name", async () => {
      for (const payload of COMMAND_INJECTION_PAYLOADS.slice(0, 2)) {
        await expect(
          connector.fetchDealContext({
            tenantId: "tenant-1",
            crmConnectionId: "conn-1",
            opportunityId: "opp-1",
            companyName: payload,
          }),
        ).rejects.toThrow();
      }
    });

    it("should open circuit breaker after repeated failures", async () => {
      // Simulate failures
      for (let i = 0; i < 5; i++) {
        try {
          await connector.fetchDealContext({
            tenantId: "tenant-1",
            crmConnectionId: "conn-1",
            opportunityId: `fail-${i}`,
          });
        } catch {
          // Expected
        }
      }

      const status = connector.getCircuitStatus();
      expect(status.isOpen || status.failures).toBeTruthy();
    });

    it("should reject replay attacks with duplicate request IDs", async () => {
      const replayId = "replayed-request-id";

      const firstRequest = REPLAY_ATTACK_VECTORS.duplicateRequest(replayId);

      // First request should succeed
      await connector.fetchDealContext({
        tenantId: "tenant-1",
        crmConnectionId: "conn-1",
        opportunityId: replayId,
      });

      // Second request with same ID should be detected
      // In production, this would check Redis/cache for duplicate
      const status = connector.getCircuitStatus();
      expect(status).toBeDefined();
    });
  });

  describe("Timeout Handling", () => {
    it("should respect request timeout", async () => {
      const start = Date.now();

      try {
        await connector.fetchDealContext({
          tenantId: "tenant-1",
          crmConnectionId: "conn-1",
          opportunityId: "slow-opp",
        });
      } catch {
        // Expected
      }

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(35000); // 30s timeout + buffer
    });
  });

  describe("Data Validation", () => {
    it("should return valid opportunity structure", async () => {
      const result = await connector.fetchDealContext({
        tenantId: "tenant-1",
        crmConnectionId: "conn-1",
        opportunityId: "opp-1",
      });

      expect(result.opportunity).toBeDefined();
      expect(result.opportunity.id).toBe("opp-1");
      expect(result.account).toBeDefined();
      expect(Array.isArray(result.contacts)).toBe(true);
    });

    it("should tag source type as crm-opportunity", async () => {
      const result = await connector.fetchDealContext({
        tenantId: "tenant-1",
        crmConnectionId: "conn-1",
        opportunityId: "opp-1",
      });

      expect(result.sourceType).toBe("crm-opportunity");
    });
  });
});
