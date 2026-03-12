import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthError, IntegrationError, ValidationError } from "../base/index.js";
import { SalesforceAdapter } from "./SalesforceAdapter.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE_CONFIG = {
  provider: "salesforce",
  baseUrl: "https://login.salesforce.com",
  credentials: {
    instanceUrl: "https://myorg.salesforce.com",
    accessToken: "initial-token",
    refreshToken: "refresh-token",
    clientId: "client-id",
    clientSecret: "client-secret",
  },
};

const TENANT_ID = "tenant-aaaa-0000-0000-0000-000000000001";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function sfQueryResponse<T>(records: T[]): Response {
  return jsonResponse({ totalSize: records.length, done: true, records });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SalesforceAdapter", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // -------------------------------------------------------------------------
  // connect / validate
  // -------------------------------------------------------------------------

  describe("connect", () => {
    it("connects successfully when token is valid", async () => {
      const adapter = new SalesforceAdapter(BASE_CONFIG);
      // validate() call during doConnect
      fetchMock.mockResolvedValueOnce(jsonResponse({ user_id: "u1" }));

      await expect(adapter.connect({ accessToken: "token", tenantId: TENANT_ID })).resolves.not.toThrow();
    });

    it("throws AuthError when no access token is provided", async () => {
      const adapter = new SalesforceAdapter({ provider: "salesforce" });

      await expect(
        adapter.connect({ accessToken: "", tenantId: TENANT_ID }),
      ).rejects.toBeInstanceOf(AuthError);
    });

    it("refreshes token when validate returns 401", async () => {
      const adapter = new SalesforceAdapter(BASE_CONFIG);

      // First validate() → 401 → triggers refresh
      fetchMock
        .mockResolvedValueOnce(new Response(JSON.stringify([{ message: "Session expired" }]), { status: 401 }))
        // token refresh
        .mockResolvedValueOnce(
          jsonResponse({
            access_token: "new-token",
            instance_url: "https://myorg.salesforce.com",
          }),
        )
        // second validate() after refresh
        .mockResolvedValueOnce(jsonResponse({ user_id: "u1" }));

      await expect(adapter.connect({ accessToken: "old-token", tenantId: TENANT_ID })).resolves.not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // fetchEntities
  // -------------------------------------------------------------------------

  describe("fetchEntities", () => {
    it("returns normalized Opportunity entities", async () => {
      const adapter = new SalesforceAdapter(BASE_CONFIG);
      fetchMock.mockResolvedValueOnce(jsonResponse({ user_id: "u1" })); // validate
      await adapter.connect({ accessToken: "token", tenantId: TENANT_ID });

      const sfOpps = [
        { Id: "opp-1", Name: "Deal A", StageName: "Prospecting", Amount: 50000, CloseDate: "2026-12-31" },
        { Id: "opp-2", Name: "Deal B", StageName: "Negotiation", Amount: 120000, CloseDate: "2026-09-30" },
      ];
      fetchMock.mockResolvedValueOnce(sfQueryResponse(sfOpps));

      const results = await adapter.fetchEntities("Opportunity");

      expect(results).toHaveLength(2);
      expect(results[0]?.provider).toBe("salesforce");
      expect(results[0]?.type).toBe("Opportunity");
      expect(results[0]?.externalId).toBe("opp-1");
      expect(results[0]?.data["Name"]).toBe("Deal A");
    });

    it("throws ValidationError for unsupported entity type", async () => {
      const adapter = new SalesforceAdapter(BASE_CONFIG);
      fetchMock.mockResolvedValueOnce(jsonResponse({ user_id: "u1" }));
      await adapter.connect({ accessToken: "token", tenantId: TENANT_ID });

      await expect(adapter.fetchEntities("Lead")).rejects.toBeInstanceOf(ValidationError);
    });
  });

  // -------------------------------------------------------------------------
  // fetchEntity
  // -------------------------------------------------------------------------

  describe("fetchEntity", () => {
    it("returns a single normalized entity", async () => {
      const adapter = new SalesforceAdapter(BASE_CONFIG);
      fetchMock.mockResolvedValueOnce(jsonResponse({ user_id: "u1" }));
      await adapter.connect({ accessToken: "token", tenantId: TENANT_ID });

      const sfAccount = { Id: "acc-1", Name: "Acme Corp", Industry: "Technology" };
      fetchMock.mockResolvedValueOnce(jsonResponse(sfAccount));

      const result = await adapter.fetchEntity("Account", "acc-1");

      expect(result).not.toBeNull();
      expect(result?.externalId).toBe("acc-1");
      expect(result?.data["Name"]).toBe("Acme Corp");
    });

    it("returns null for 404", async () => {
      const adapter = new SalesforceAdapter(BASE_CONFIG);
      fetchMock.mockResolvedValueOnce(jsonResponse({ user_id: "u1" }));
      await adapter.connect({ accessToken: "token", tenantId: TENANT_ID });

      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify([{ message: "Not found", errorCode: "NOT_FOUND" }]), { status: 404 }),
      );

      const result = await adapter.fetchEntity("Account", "nonexistent");
      expect(result).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // getOpportunities — tenant isolation
  // -------------------------------------------------------------------------

  describe("getOpportunities", () => {
    it("includes IsClosed = false in SOQL and sets tenantId on metadata", async () => {
      const adapter = new SalesforceAdapter(BASE_CONFIG);
      fetchMock.mockResolvedValueOnce(jsonResponse({ user_id: "u1" }));
      await adapter.connect({ accessToken: "token", tenantId: TENANT_ID });

      fetchMock.mockResolvedValueOnce(
        sfQueryResponse([{ Id: "opp-1", Name: "Open Deal", StageName: "Prospecting" }]),
      );

      const results = await adapter.getOpportunities(TENANT_ID);

      expect(results).toHaveLength(1);
      expect(results[0]?.metadata.tenantId).toBe(TENANT_ID);

      // Verify SOQL contains the IsClosed filter (URL-encoded)
      const calledUrl = (fetchMock.mock.calls[1] as [string])[0];
      expect(calledUrl).toContain("IsClosed");
    });

    it("applies stage filter when provided", async () => {
      const adapter = new SalesforceAdapter(BASE_CONFIG);
      fetchMock.mockResolvedValueOnce(jsonResponse({ user_id: "u1" }));
      await adapter.connect({ accessToken: "token", tenantId: TENANT_ID });

      fetchMock.mockResolvedValueOnce(sfQueryResponse([]));

      await adapter.getOpportunities(TENANT_ID, { stage: "Negotiation" });

      const calledUrl = (fetchMock.mock.calls[1] as [string])[0];
      expect(calledUrl).toContain("Negotiation");
    });
  });

  // -------------------------------------------------------------------------
  // syncValueCase
  // -------------------------------------------------------------------------

  describe("syncValueCase", () => {
    it("PATCHes the Opportunity with mapped fields", async () => {
      const adapter = new SalesforceAdapter(BASE_CONFIG);
      fetchMock.mockResolvedValueOnce(jsonResponse({ user_id: "u1" }));
      await adapter.connect({ accessToken: "token", tenantId: TENANT_ID });

      fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

      await expect(
        adapter.syncValueCase("case-123", "opp-456", {
          title: "Cloud Migration ROI",
          confidence: 0.87,
          estimatedValue: 4_200_000,
          stage: "Proposal/Price Quote",
        }),
      ).resolves.not.toThrow();

      const [, init] = fetchMock.mock.calls[1] as [string, RequestInit];
      const body = JSON.parse(init.body as string) as Record<string, unknown>;
      expect(body["Name"]).toBe("Cloud Migration ROI");
      expect(body["Amount"]).toBe(4_200_000);
      expect(body["Probability"]).toBe(87);
    });
  });

  // -------------------------------------------------------------------------
  // createActivity
  // -------------------------------------------------------------------------

  describe("createActivity", () => {
    it("creates a Task and returns the new ID", async () => {
      const adapter = new SalesforceAdapter(BASE_CONFIG);
      fetchMock.mockResolvedValueOnce(jsonResponse({ user_id: "u1" }));
      await adapter.connect({ accessToken: "token", tenantId: TENANT_ID });

      fetchMock.mockResolvedValueOnce(jsonResponse({ id: "task-789", success: true }));

      const taskId = await adapter.createActivity("opp-456", {
        subject: "ValueOS review call",
        description: "Reviewed ROI model",
        dueDate: "2026-06-15",
      });

      expect(taskId).toBe("task-789");
    });
  });

  // -------------------------------------------------------------------------
  // handleWebhookPayload
  // -------------------------------------------------------------------------

  describe("handleWebhookPayload", () => {
    it("parses a Change Data Capture event", async () => {
      const adapter = new SalesforceAdapter(BASE_CONFIG);
      fetchMock.mockResolvedValueOnce(jsonResponse({ user_id: "u1" }));
      await adapter.connect({ accessToken: "token", tenantId: TENANT_ID });

      const payload = {
        changeType: "UPDATE",
        entityName: "Opportunity",
        recordIds: ["opp-1"],
      };

      const result = adapter.handleWebhookPayload(payload, TENANT_ID);

      expect(result).not.toBeNull();
      expect(result?.type).toBe("Opportunity");
      expect(result?.externalId).toBe("opp-1");
      expect(result?.metadata.tenantId).toBe(TENANT_ID);
    });

    it("parses an Outbound Message sObject", async () => {
      const adapter = new SalesforceAdapter(BASE_CONFIG);
      fetchMock.mockResolvedValueOnce(jsonResponse({ user_id: "u1" }));
      await adapter.connect({ accessToken: "token", tenantId: TENANT_ID });

      const payload = {
        sObject: { type: "Account", Id: "acc-99", Name: "BigCo" },
      };

      const result = adapter.handleWebhookPayload(payload, TENANT_ID);

      expect(result?.type).toBe("Account");
      expect(result?.externalId).toBe("acc-99");
    });

    it("returns null for unrecognised payload", async () => {
      const adapter = new SalesforceAdapter(BASE_CONFIG);
      fetchMock.mockResolvedValueOnce(jsonResponse({ user_id: "u1" }));
      await adapter.connect({ accessToken: "token", tenantId: TENANT_ID });

      const result = adapter.handleWebhookPayload({ unknown: true }, TENANT_ID);
      expect(result).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Error mapping
  // -------------------------------------------------------------------------

  describe("error mapping", () => {
    it("throws AuthError on 403", async () => {
      const adapter = new SalesforceAdapter(BASE_CONFIG);
      fetchMock.mockResolvedValueOnce(jsonResponse({ user_id: "u1" }));
      await adapter.connect({ accessToken: "token", tenantId: TENANT_ID });

      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify([{ message: "Forbidden" }]), { status: 403 }),
      );

      await expect(adapter.fetchEntities("Account")).rejects.toBeInstanceOf(AuthError);
    });

    it("throws IntegrationError with retryable=true on 5xx", async () => {
      const adapter = new SalesforceAdapter(BASE_CONFIG);
      fetchMock.mockResolvedValueOnce(jsonResponse({ user_id: "u1" }));
      await adapter.connect({ accessToken: "token", tenantId: TENANT_ID });

      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify([{ message: "Server error" }]), { status: 500 }),
      );

      const error = await adapter.fetchEntities("Account").catch((e: unknown) => e);
      expect(error).toBeInstanceOf(IntegrationError);
      expect((error as IntegrationError).retryable).toBe(true);
    });
  });
});
