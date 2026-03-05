import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthError, ValidationError } from "../base/index.js";
import { HubSpotAdapter } from "./HubSpotAdapter.js";

const BASE_CONFIG = {
  provider: "hubspot",
  baseUrl: "https://api.hubapi.com",
  retryAttempts: 2,
};

describe("HubSpotAdapter", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("validates successfully with active credentials", async () => {
    const adapter = new HubSpotAdapter(BASE_CONFIG);
    await adapter.connect({ accessToken: "token", tenantId: "tenant-a" });

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ results: [] }), { status: 200 })
    );

    await expect(adapter.validate()).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/crm/v3/objects/contacts?limit=1"),
      expect.objectContaining({ method: "GET" })
    );
  });

  it("returns false when validate receives auth failure", async () => {
    const adapter = new HubSpotAdapter(BASE_CONFIG);
    await adapter.connect({ accessToken: "token", tenantId: "tenant-a" });

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "Unauthorized" }), { status: 401 })
    );

    await expect(adapter.validate()).resolves.toBe(false);
  });

  it("fetches entities and maps tenant metadata", async () => {
    const adapter = new HubSpotAdapter(BASE_CONFIG);
    await adapter.connect({ accessToken: "token", tenantId: "tenant-a" });

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({
        results: [{
          id: "42",
          createdAt: "2024-01-01T00:00:00.000Z",
          updatedAt: "2024-01-02T00:00:00.000Z",
          properties: { firstname: "Ada", lastname: "Lovelace" },
        }],
      }), { status: 200 })
    );

    const entities = await adapter.fetchEntities("contacts", { limit: 1 });

    expect(entities).toHaveLength(1);
    expect(entities[0]).toMatchObject({
      id: "hubspot:contacts:42",
      externalId: "42",
      type: "contacts",
      metadata: {
        tenantId: "tenant-a",
        organizationId: "tenant-a",
      },
    });
  });

  it("returns null when a single entity is not found", async () => {
    const adapter = new HubSpotAdapter(BASE_CONFIG);
    await adapter.connect({ accessToken: "token", tenantId: "tenant-a" });

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "Not found" }), { status: 404 })
    );

    await expect(adapter.fetchEntity("contacts", "404")).resolves.toBeNull();
  });

  it("retries push updates on rate limits and succeeds", async () => {
    const adapter = new HubSpotAdapter(BASE_CONFIG);
    await adapter.connect({ accessToken: "token", tenantId: "tenant-a" });

    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "Too many requests" }), {
          status: 429,
          headers: { "retry-after": "0" },
        })
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "42" }), { status: 200 }));

    await expect(
      adapter.pushUpdate("contacts", "42", { firstname: "Grace" })
    ).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("fails validation for unsupported entity types", async () => {
    const adapter = new HubSpotAdapter(BASE_CONFIG);
    await adapter.connect({ accessToken: "token", tenantId: "tenant-a" });

    await expect(adapter.fetchEntities("custom")).rejects.toBeInstanceOf(ValidationError);
  });

  it("requires credentials at connect time", async () => {
    const adapter = new HubSpotAdapter({ provider: "hubspot" });

    await expect(
      adapter.connect({ accessToken: "", tenantId: "tenant-a" })
    ).rejects.toBeInstanceOf(AuthError);
  });
});
