import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthError, IntegrationError, ValidationError } from "../base/index.js";
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
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("validates successfully with active credentials", async () => {
    const adapter = new HubSpotAdapter(BASE_CONFIG);
    await adapter.connect({ accessToken: "token", tenantId: "tenant-a" });

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ results: [] }), { status: 200 })
    );

    await expect(adapter.validate()).resolves.toBe(true);
    // fetch receives a URL object; compare via toString()
    const [calledUrl] = fetchMock.mock.calls[0];
    expect(String(calledUrl)).toContain("/crm/v3/owners?limit=1&archived=false");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.anything(),
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
      provider: "hubspot",
      type: "contacts",
      data: {
        firstname: "Ada",
        lastname: "Lovelace",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-02T00:00:00.000Z",
        archived: false,
      },
      metadata: {
        tenantId: "tenant-a",
        organizationId: "tenant-a",
      },
    });
  });

  it("fetches single entities and maps normalized fields", async () => {
    const adapter = new HubSpotAdapter(BASE_CONFIG);
    await adapter.connect({ accessToken: "token", tenantId: "tenant-a" });

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({
        id: "abc123",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-03T00:00:00.000Z",
        archived: true,
        properties: { dealname: "New Expansion" },
      }), { status: 200 })
    );

    const entity = await adapter.fetchEntity("deals", "abc123");

    expect(entity).toMatchObject({
      id: "hubspot:deals:abc123",
      externalId: "abc123",
      provider: "hubspot",
      type: "deals",
      data: {
        dealname: "New Expansion",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-03T00:00:00.000Z",
        archived: true,
      },
      metadata: {
        tenantId: "tenant-a",
        organizationId: "tenant-a",
        version: "2024-01-03T00:00:00.000Z",
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
    vi.useFakeTimers();
    const timeoutSpy = vi.spyOn(globalThis, "setTimeout");
    const adapter = new HubSpotAdapter(BASE_CONFIG);
    await adapter.connect({ accessToken: "token", tenantId: "tenant-a" });

    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "Too many requests" }), {
          status: 429,
          headers: { "retry-after": "2" },
        })
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "42" }), { status: 200 }));

    const pushUpdatePromise = adapter.pushUpdate("contacts", "42", { firstname: "Grace" });

    await vi.advanceTimersByTimeAsync(2000);
    await expect(pushUpdatePromise).resolves.toBeUndefined();

    expect(timeoutSpy).toHaveBeenCalledWith(expect.any(Function), 2000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries push updates on retryable 5xx responses", async () => {
    vi.useFakeTimers();
    const adapter = new HubSpotAdapter(BASE_CONFIG);
    await adapter.connect({ accessToken: "token", tenantId: "tenant-a" });

    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "temporary" }), { status: 500 })
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "42" }), { status: 200 }));

    const pushPromise = adapter.pushUpdate("contacts", "42", { firstname: "Grace" });
    await vi.runAllTimersAsync();
    await expect(pushPromise).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry push updates on validation errors", async () => {
    const adapter = new HubSpotAdapter(BASE_CONFIG);
    await adapter.connect({ accessToken: "token", tenantId: "tenant-a" });

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "invalid" }), { status: 400 })
    );

    await expect(
      adapter.pushUpdate("contacts", "42", { firstname: "Grace" })
    ).rejects.toBeInstanceOf(ValidationError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("throws timeout errors as retryable integration errors", async () => {
    const adapter = new HubSpotAdapter({ ...BASE_CONFIG, timeout: 1 });
    await adapter.connect({ accessToken: "token", tenantId: "tenant-a" });

    fetchMock.mockImplementation(async (_input, init) => {
      if (!init?.signal) {
        throw new Error("Expected signal to be present");
      }

      await new Promise((resolve) => {
        init.signal?.addEventListener("abort", resolve, { once: true });
      });

      throw new DOMException("Aborted", "AbortError");
    });

    await expect(adapter.validate()).rejects.toMatchObject({
      code: "TIMEOUT",
      retryable: true,
    });
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
