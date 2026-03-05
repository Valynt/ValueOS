import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthError, ConnectionError, RateLimitError, ValidationError } from "../base/errors.js";
import type { IntegrationCredentials } from "../base/types.js";
import { HubSpotAdapter } from "./HubSpotAdapter.js";

const { apiRequestMock, clientCtorMock, ClientMock } = vi.hoisted(() => {
  const apiRequest = vi.fn();
  const clientCtor = vi.fn();

  function Client(this: unknown, options: unknown) {
    clientCtor(options);
    return { apiRequest };
  }

  return {
    apiRequestMock: apiRequest,
    clientCtorMock: clientCtor,
    ClientMock: Client,
  };
});

vi.mock("@hubspot/api-client", () => ({
  Client: ClientMock,
}));

const credentials: IntegrationCredentials = {
  accessToken: "token-123",
  tenantId: "tenant-alpha",
};

describe("HubSpotAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("initializes and tears down HubSpot client", async () => {
    const adapter = new HubSpotAdapter({ provider: "hubspot" });

    await adapter.connect(credentials);
    expect(clientCtorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: "token-123",
      })
    );

    await adapter.disconnect();
    await expect(adapter.fetchEntities("contacts")).rejects.toBeInstanceOf(ConnectionError);
  });

  it("returns false on authentication failures in validate", async () => {
    const adapter = new HubSpotAdapter({ provider: "hubspot" });
    await adapter.connect(credentials);

    apiRequestMock.mockRejectedValueOnce({ code: 401 });

    await expect(adapter.validate()).resolves.toBe(false);
  });

  it("maps fetched entities with tenant metadata", async () => {
    const adapter = new HubSpotAdapter({ provider: "hubspot" });
    await adapter.connect(credentials);

    apiRequestMock.mockResolvedValueOnce({
      status: 200,
      body: {
        results: [{
          id: "123",
          properties: {
            firstname: "Ada",
            lastname: "Lovelace",
            email: "ada@example.com",
          },
          updatedAt: "2024-01-01T00:00:00.000Z",
        }],
      },
    });

    const entities = await adapter.fetchEntities("contacts", { limit: 1 });

    expect(entities).toHaveLength(1);
    expect(entities[0]).toMatchObject({
      id: "hubspot:contacts:123",
      externalId: "123",
      provider: "hubspot",
      type: "contacts",
      metadata: {
        tenantId: "tenant-alpha",
        version: "2024-01-01T00:00:00.000Z",
      },
    });
    expect(apiRequestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        path: "/crm/v3/objects/contacts",
      })
    );
  });

  it("returns null when fetching a missing entity", async () => {
    const adapter = new HubSpotAdapter({ provider: "hubspot" });
    await adapter.connect(credentials);

    apiRequestMock.mockRejectedValueOnce({ code: 404 });

    await expect(adapter.fetchEntity("deals", "missing")).resolves.toBeNull();
  });

  it("retries and surfaces rate limit errors from pushUpdate", async () => {
    const adapter = new HubSpotAdapter({ provider: "hubspot", retryAttempts: 2 });
    await adapter.connect(credentials);

    apiRequestMock.mockRejectedValue({ code: 429, headers: { "retry-after": "2" } });

    await expect(adapter.pushUpdate("deals", "deal-1", { amount: 2000 })).rejects.toBeInstanceOf(RateLimitError);
    expect(apiRequestMock).toHaveBeenCalledTimes(2);
  });

  it("throws validation error for unsupported entity types", async () => {
    const adapter = new HubSpotAdapter({ provider: "hubspot" });
    await adapter.connect(credentials);

    await expect(adapter.fetchEntities("line_items")).rejects.toBeInstanceOf(ValidationError);
  });

  it("maps 401 update failures to auth errors", async () => {
    const adapter = new HubSpotAdapter({ provider: "hubspot", retryAttempts: 1 });
    await adapter.connect(credentials);

    apiRequestMock.mockRejectedValue({ code: 401 });

    await expect(adapter.pushUpdate("contacts", "42", { firstname: "Grace" })).rejects.toBeInstanceOf(AuthError);
  });
});
