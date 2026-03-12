import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthError, IntegrationError, ValidationError } from "../base/index.js";
import { ServiceNowAdapter } from "./ServiceNowAdapter.js";

const INSTANCE_URL = "https://dev12345.service-now.com";
const BASE_CONFIG = { provider: "servicenow", baseUrl: INSTANCE_URL };
const TENANT = "tenant-a";
const TOKEN = "sn-bearer-token";

describe("ServiceNowAdapter", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // -------------------------------------------------------------------------
  // connect
  // -------------------------------------------------------------------------

  it("connects with bearer token", async () => {
    const adapter = new ServiceNowAdapter(BASE_CONFIG);
    await expect(
      adapter.connect({ accessToken: TOKEN, tenantId: TENANT })
    ).resolves.toBeUndefined();
  });

  it("connects with basic auth credentials", async () => {
    const adapter = new ServiceNowAdapter({
      provider: "servicenow",
      credentials: { instanceUrl: INSTANCE_URL, username: "admin", password: "pass" },
    });
    await expect(
      adapter.connect({ accessToken: "", tenantId: TENANT })
    ).resolves.toBeUndefined();
  });

  it("throws AuthError when no instanceUrl is provided", async () => {
    const adapter = new ServiceNowAdapter({ provider: "servicenow" });
    await expect(
      adapter.connect({ accessToken: TOKEN, tenantId: TENANT })
    ).rejects.toBeInstanceOf(AuthError);
  });

  it("throws AuthError when neither token nor username+password is provided", async () => {
    const adapter = new ServiceNowAdapter(BASE_CONFIG);
    await expect(
      adapter.connect({ accessToken: "", tenantId: TENANT })
    ).rejects.toBeInstanceOf(AuthError);
  });

  // -------------------------------------------------------------------------
  // validate
  // -------------------------------------------------------------------------

  it("validates successfully with working credentials", async () => {
    const adapter = new ServiceNowAdapter(BASE_CONFIG);
    await adapter.connect({ accessToken: TOKEN, tenantId: TENANT });

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ result: [] }), { status: 200 })
    );

    await expect(adapter.validate()).resolves.toBe(true);
    const [calledUrl] = fetchMock.mock.calls[0];
    expect(String(calledUrl)).toContain("/api/now/v2/table/incident");
    expect(String(calledUrl)).toContain("sysparm_limit=1");
  });

  it("returns false when validate receives 401", async () => {
    const adapter = new ServiceNowAdapter(BASE_CONFIG);
    await adapter.connect({ accessToken: TOKEN, tenantId: TENANT });

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: "Unauthorized" } }), { status: 401 })
    );

    await expect(adapter.validate()).resolves.toBe(false);
  });

  // -------------------------------------------------------------------------
  // fetchEntities
  // -------------------------------------------------------------------------

  it("fetches entities and maps tenant metadata", async () => {
    const adapter = new ServiceNowAdapter(BASE_CONFIG);
    await adapter.connect({ accessToken: TOKEN, tenantId: TENANT });

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({
        result: [{
          sys_id: "abc123",
          sys_created_on: "2024-01-01 00:00:00",
          sys_updated_on: "2024-01-02 00:00:00",
          short_description: "Disk full",
        }],
      }), { status: 200 })
    );

    const entities = await adapter.fetchEntities("incident", { limit: 10 });

    expect(entities).toHaveLength(1);
    expect(entities[0]).toMatchObject({
      id: "abc123",
      externalId: "abc123",
      provider: "servicenow",
      type: "incident",
      metadata: {
        tenantId: TENANT,
        organizationId: TENANT,
        version: "2024-01-02 00:00:00",
      },
    });
  });

  it("appends sysparm_query when since option is provided", async () => {
    const adapter = new ServiceNowAdapter(BASE_CONFIG);
    await adapter.connect({ accessToken: TOKEN, tenantId: TENANT });

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ result: [] }), { status: 200 })
    );

    const since = new Date("2024-06-01T00:00:00.000Z");
    await adapter.fetchEntities("incident", { since });

    const [calledUrl] = fetchMock.mock.calls[0];
    expect(String(calledUrl)).toContain("sysparm_query=sys_updated_on%3E%3D");
  });

  it("throws ValidationError for unsupported entity types", async () => {
    const adapter = new ServiceNowAdapter(BASE_CONFIG);
    await adapter.connect({ accessToken: TOKEN, tenantId: TENANT });

    await expect(adapter.fetchEntities("ticket")).rejects.toBeInstanceOf(ValidationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // fetchEntity
  // -------------------------------------------------------------------------

  it("fetches a single entity by sys_id", async () => {
    const adapter = new ServiceNowAdapter(BASE_CONFIG);
    await adapter.connect({ accessToken: TOKEN, tenantId: TENANT });

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({
        result: { sys_id: "abc123", short_description: "Disk full" },
      }), { status: 200 })
    );

    const entity = await adapter.fetchEntity("incident", "abc123");
    expect(entity).toMatchObject({ id: "abc123", type: "incident" });
  });

  it("returns null when entity is not found", async () => {
    const adapter = new ServiceNowAdapter(BASE_CONFIG);
    await adapter.connect({ accessToken: TOKEN, tenantId: TENANT });

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: "No Record found" } }), { status: 404 })
    );

    await expect(adapter.fetchEntity("incident", "missing")).resolves.toBeNull();
  });

  // -------------------------------------------------------------------------
  // pushUpdate
  // -------------------------------------------------------------------------

  it("sends PATCH to the correct table URL", async () => {
    const adapter = new ServiceNowAdapter(BASE_CONFIG);
    await adapter.connect({ accessToken: TOKEN, tenantId: TENANT });

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ result: { sys_id: "abc123" } }), { status: 200 })
    );

    await expect(
      adapter.pushUpdate("incident", "abc123", { state: "2" })
    ).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ method: "PATCH" })
    );
    const [calledUrl] = fetchMock.mock.calls[0];
    expect(String(calledUrl)).toContain("/api/now/v2/table/incident/abc123");
  });

  // -------------------------------------------------------------------------
  // Error mapping
  // -------------------------------------------------------------------------

  it("maps 403 to AuthError", async () => {
    const adapter = new ServiceNowAdapter(BASE_CONFIG);
    await adapter.connect({ accessToken: TOKEN, tenantId: TENANT });

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: "Forbidden" } }), { status: 403 })
    );

    await expect(adapter.fetchEntities("incident")).rejects.toBeInstanceOf(AuthError);
  });

  it("maps 429 to RateLimitError with retry-after", async () => {
    const adapter = new ServiceNowAdapter(BASE_CONFIG);
    await adapter.connect({ accessToken: TOKEN, tenantId: TENANT });

    fetchMock.mockResolvedValueOnce(
      new Response("", { status: 429, headers: { "retry-after": "5" } })
    );

    await expect(adapter.fetchEntities("incident")).rejects.toMatchObject({
      code: "RATE_LIMIT",
      retryable: true,
    });
  });

  it("maps 400 to ValidationError", async () => {
    const adapter = new ServiceNowAdapter(BASE_CONFIG);
    await adapter.connect({ accessToken: TOKEN, tenantId: TENANT });

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: "Bad field" } }), { status: 400 })
    );

    await expect(
      adapter.pushUpdate("incident", "abc123", { bad_field: "x" })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("throws timeout error as retryable IntegrationError", async () => {
    const adapter = new ServiceNowAdapter({ ...BASE_CONFIG, timeout: 1 });
    await adapter.connect({ accessToken: TOKEN, tenantId: TENANT });

    fetchMock.mockImplementation(async (_input, init) => {
      await new Promise((resolve) => {
        init?.signal?.addEventListener("abort", resolve, { once: true });
      });
      throw new DOMException("Aborted", "AbortError");
    });

    await expect(adapter.validate()).rejects.toMatchObject<Partial<IntegrationError>>({
      code: "TIMEOUT",
      retryable: true,
    });
  });

  // -------------------------------------------------------------------------
  // Auth header
  // -------------------------------------------------------------------------

  it("sends Bearer token in Authorization header", async () => {
    const adapter = new ServiceNowAdapter(BASE_CONFIG);
    await adapter.connect({ accessToken: TOKEN, tenantId: TENANT });

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ result: [] }), { status: 200 })
    );

    await adapter.fetchEntities("incident");

    const [, init] = fetchMock.mock.calls[0];
    expect((init?.headers as Record<string, string>)["Authorization"]).toBe(`Bearer ${TOKEN}`);
  });

  it("sends Basic auth header when username+password are used", async () => {
    const adapter = new ServiceNowAdapter({
      provider: "servicenow",
      credentials: { instanceUrl: INSTANCE_URL, username: "admin", password: "secret" },
    });
    await adapter.connect({ accessToken: "", tenantId: TENANT });

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ result: [] }), { status: 200 })
    );

    await adapter.fetchEntities("incident");

    const [, init] = fetchMock.mock.calls[0];
    const authHeader = (init?.headers as Record<string, string>)["Authorization"];
    expect(authHeader).toMatch(/^Basic /);
    const decoded = Buffer.from(authHeader.slice(6), "base64").toString();
    expect(decoded).toBe("admin:secret");
  });
});
