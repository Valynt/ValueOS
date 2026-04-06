/**
 * CRMConnector Tests
 *
 * Task: 9.1 - Unit test CRMConnector with mock HubSpot responses
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CRMConnector, CRMOpportunitySchema } from "../CRMConnector.js";

// Mock the Supabase client used by CRMConnector to load crm_connections
// vi.mock is hoisted — use vi.hoisted() so the factory can reference the mock
const { mockSupabaseClient } = vi.hoisted(() => {
  const connData = { provider: "hubspot", tenant_id: "tenant-1", access_token: "tok", refresh_token: "ref", token_expiry: null };
  const client = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: connData, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: connData, error: null }),
  };
  return { mockSupabaseClient: client };
});

vi.mock("../../../lib/supabase.js", () => ({
  assertNotTestEnv: vi.fn(),
  createServerSupabaseClient: vi.fn(() => mockSupabaseClient),
  createServiceRoleSupabaseClient: vi.fn(() => mockSupabaseClient),
  // Named export used by some transitive imports
  supabase: mockSupabaseClient,
}));

// Mock the CRM provider registry so no real HTTP calls are made
// Use the canonical shape that mapCanonicalOpportunity expects (externalId, not id)
const mockOpportunity = {
  externalId: "opp-1",
  id: "opp-1",
  name: "Test Opp",
  stage: "qualified",
  amount: 50000,
  currency: "USD",
  closeDate: "2025-12-31",
  companyId: null,
  companyName: "Acme Corp",
  probability: null,
  ownerName: null,
  properties: {},
  provider: "hubspot",
};

vi.mock("../../../services/crm/CrmProviderRegistry.js", () => ({
  getCrmProvider: vi.fn(() => ({
    // Support both naming conventions used across CRMConnector versions
    fetchOpportunity: vi.fn().mockResolvedValue(mockOpportunity),
    fetchOpportunityById: vi.fn().mockResolvedValue(mockOpportunity),
    fetchAccount: vi.fn().mockResolvedValue({ id: "acc-1", name: "Acme Corp" }),
    fetchContacts: vi.fn().mockResolvedValue([{ id: "c-1", firstName: "Jane", lastName: "Doe" }]),
    refreshTokens: vi.fn().mockResolvedValue({ access_token: "new-tok", refresh_token: "new-ref" }),
  })),
}));

vi.mock("../../../services/crm/CrmConnectionService.js", () => ({
  CrmConnectionService: vi.fn().mockImplementation(() => ({
    getTokens: vi.fn().mockResolvedValue({ access_token: "tok", refresh_token: "ref", provider: "hubspot" }),
    getConnection: vi.fn().mockResolvedValue({ provider: "hubspot", access_token: "tok", refresh_token: "ref" }),
    updateTokens: vi.fn().mockResolvedValue(undefined),
    saveTokens: vi.fn().mockResolvedValue(undefined),
  })),
}));

describe("CRMConnector", () => {
  beforeEach(() => {
    // Block all outbound fetch calls — CRMConnector.fetchHubSpotContacts uses
    // global fetch directly. First call returns deal→contact associations;
    // second call returns the individual contact record.
    // Any further calls are unexpected and will fail the test explicitly.
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          results: [{ id: "c-1", type: "deal_to_contact" }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          id: "c-1",
          properties: {
            firstname: "Jane",
            lastname: "Doe",
            email: "jane@acme.com",
            jobtitle: "VP Engineering",
            phone: "",
          },
        }),
      })
      .mockRejectedValue(new Error("Unexpected fetch call — add a mockResolvedValueOnce for this request"));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("fetchDealContext", () => {
    it("should return opportunity, account, and contacts", async () => {
      const connector = new CRMConnector();
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
      const connector = new CRMConnector();
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
