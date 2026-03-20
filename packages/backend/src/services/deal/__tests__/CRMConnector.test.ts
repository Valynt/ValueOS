/**
 * CRMConnector Tests
 *
 * Task: 9.1 - Unit test CRMConnector with mock HubSpot responses
 */

import { describe, expect, it, vi } from "vitest";

import { CRMConnector, CRMOpportunitySchema } from "../CRMConnector.js";

vi.mock("../../../lib/supabase.js");

describe("CRMConnector", () => {
  const connector = new CRMConnector();

  describe("fetchDealContext", () => {
    it("should return opportunity, account, and contacts", async () => {
      const result = await connector.fetchDealContext({
        tenantId: "tenant-1",
        crmConnectionId: "crm-1",
        opportunityId: "opp-1",
      });

      expect(result.opportunity).toBeDefined();
      expect(result.opportunity.id).toBe("opp-1");
      expect(result.account).toBeDefined();
      expect(result.contacts).toBeInstanceOf(Array);
      expect(result.contacts.length).toBeGreaterThan(0);
      expect(result.sourceType).toBe("crm-opportunity");
    });

    it("should include circuit breaker protection", () => {
      const status = connector.getCircuitStatus();
      expect(status.isOpen).toBe(false);
      expect(status.failures).toBe(0);
    });
  });

  describe("Zod schema validation", () => {
    it("should validate CRMOpportunity schema", () => {
      const valid = {
        id: "opp-1",
        name: "Test Opportunity",
        stage: "qualified",
      };

      const result = CRMOpportunitySchema.safeParse(valid);
      expect(result.success).toBe(true);
    });
  });
});
