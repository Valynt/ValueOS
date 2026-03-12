import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthError, IntegrationError, ValidationError } from "../base/index.js";
import { SharePointAdapter } from "./SharePointAdapter.js";

const TENANT = "tenant-a";
const TOKEN = "sp-bearer-token";
const SITE_ID = "contoso.sharepoint.com,abc,def";
const DRIVE_ID = "drive-001";

const BASE_CONFIG = {
  provider: "sharepoint",
  credentials: { siteId: SITE_ID, driveId: DRIVE_ID },
};

describe("SharePointAdapter", () => {
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

  it("connects with a bearer token", async () => {
    const adapter = new SharePointAdapter(BASE_CONFIG);
    await expect(
      adapter.connect({ accessToken: TOKEN, tenantId: TENANT })
    ).resolves.toBeUndefined();
  });

  it("throws AuthError when no token is provided", async () => {
    const adapter = new SharePointAdapter(BASE_CONFIG);
    await expect(
      adapter.connect({ accessToken: "", tenantId: TENANT })
    ).rejects.toBeInstanceOf(AuthError);
  });

  // -------------------------------------------------------------------------
  // validate
  // -------------------------------------------------------------------------

  it("validates successfully by fetching the root site", async () => {
    const adapter = new SharePointAdapter(BASE_CONFIG);
    await adapter.connect({ accessToken: TOKEN, tenantId: TENANT });

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "root", name: "root" }), { status: 200 })
    );

    await expect(adapter.validate()).resolves.toBe(true);
    const [calledUrl] = fetchMock.mock.calls[0];
    expect(String(calledUrl)).toContain("/sites/root");
  });

  it("returns false when validate receives 401", async () => {
    const adapter = new SharePointAdapter(BASE_CONFIG);
    await adapter.connect({ accessToken: TOKEN, tenantId: TENANT });

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: "Unauthorized" } }), { status: 401 })
    );

    await expect(adapter.validate()).resolves.toBe(false);
  });

  // -------------------------------------------------------------------------
  // fetchEntities — site
  // -------------------------------------------------------------------------

  it("fetches sites and maps tenant metadata", async () => {
    const adapter = new SharePointAdapter(BASE_CONFIG);
    await adapter.connect({ accessToken: TOKEN, tenantId: TENANT });

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({
        value: [{
          id: SITE_ID,
          displayName: "Contoso Intranet",
          lastModifiedDateTime: "2024-03-01T00:00:00Z",
        }],
      }), { status: 200 })
    );

    const entities = await adapter.fetchEntities("site");

    expect(entities).toHaveLength(1);
    expect(entities[0]).toMatchObject({
      id: SITE_ID,
      externalId: SITE_ID,
      provider: "sharepoint",
      type: "site",
      metadata: {
        tenantId: TENANT,
        organizationId: TENANT,
        version: "2024-03-01T00:00:00Z",
      },
    });
  });

  // -------------------------------------------------------------------------
  // fetchEntities — list
  // -------------------------------------------------------------------------

  it("fetches lists using siteId from credentials", async () => {
    const adapter = new SharePointAdapter(BASE_CONFIG);
    await adapter.connect({ accessToken: TOKEN, tenantId: TENANT });

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({
        value: [{ id: "list-001", displayName: "Documents" }],
      }), { status: 200 })
    );

    const entities = await adapter.fetchEntities("list");

    expect(entities).toHaveLength(1);
    expect(entities[0]).toMatchObject({ id: "list-001", type: "list" });
    const [calledUrl] = fetchMock.mock.calls[0];
    expect(String(calledUrl)).toContain(`/sites/${SITE_ID}/lists`);
  });

  it("throws ValidationError when fetching lists without siteId", async () => {
    const adapter = new SharePointAdapter({ provider: "sharepoint" });
    await adapter.connect({ accessToken: TOKEN, tenantId: TENANT });

    await expect(adapter.fetchEntities("list")).rejects.toBeInstanceOf(ValidationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // fetchEntities — driveitem
  // -------------------------------------------------------------------------

  it("fetches drive items from root when no folderId is given", async () => {
    const adapter = new SharePointAdapter(BASE_CONFIG);
    await adapter.connect({ accessToken: TOKEN, tenantId: TENANT });

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({
        value: [{ id: "item-001", name: "report.docx" }],
      }), { status: 200 })
    );

    const entities = await adapter.fetchEntities("driveitem");

    expect(entities).toHaveLength(1);
    expect(entities[0]).toMatchObject({ id: "item-001", type: "driveitem" });
    const [calledUrl] = fetchMock.mock.calls[0];
    expect(String(calledUrl)).toContain(`/drives/${DRIVE_ID}/root/children`);
  });

  it("fetches drive items from a specific folder when folderId is given", async () => {
    const adapter = new SharePointAdapter(BASE_CONFIG);
    await adapter.connect({ accessToken: TOKEN, tenantId: TENANT });

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ value: [] }), { status: 200 })
    );

    await adapter.fetchEntities("driveitem", { filters: { folderId: "folder-001" } });

    const [calledUrl] = fetchMock.mock.calls[0];
    expect(String(calledUrl)).toContain(`/drives/${DRIVE_ID}/items/folder-001/children`);
  });

  // -------------------------------------------------------------------------
  // fetchEntity
  // -------------------------------------------------------------------------

  it("fetches a single site by id", async () => {
    const adapter = new SharePointAdapter(BASE_CONFIG);
    await adapter.connect({ accessToken: TOKEN, tenantId: TENANT });

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: SITE_ID, displayName: "Contoso" }), { status: 200 })
    );

    const entity = await adapter.fetchEntity("site", SITE_ID);
    expect(entity).toMatchObject({ id: SITE_ID, type: "site" });
  });

  it("returns null when entity is not found (404)", async () => {
    const adapter = new SharePointAdapter(BASE_CONFIG);
    await adapter.connect({ accessToken: TOKEN, tenantId: TENANT });

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { code: "itemNotFound", message: "Not found" } }), { status: 404 })
    );

    await expect(adapter.fetchEntity("site", "missing")).resolves.toBeNull();
  });



  // -------------------------------------------------------------------------
  // pushUpdate
  // -------------------------------------------------------------------------

  it("sends PATCH to the list item fields endpoint", async () => {
    const adapter = new SharePointAdapter(BASE_CONFIG);
    await adapter.connect({ accessToken: TOKEN, tenantId: TENANT });

    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 200 }));

    await expect(
      adapter.pushUpdate("list", "item-001", { listId: "list-001", Title: "Updated" })
    ).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ method: "PATCH" })
    );
    const [calledUrl] = fetchMock.mock.calls[0];
    expect(String(calledUrl)).toContain(`/sites/${SITE_ID}/lists/list-001/items/item-001/fields`);
  });

  it("throws ValidationError when pushUpdate is called without listId", async () => {
    const adapter = new SharePointAdapter(BASE_CONFIG);
    await adapter.connect({ accessToken: TOKEN, tenantId: TENANT });

    await expect(
      adapter.pushUpdate("list", "item-001", { Title: "No listId" })
    ).rejects.toBeInstanceOf(ValidationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws ValidationError when pushUpdate is called without siteId in credentials", async () => {
    const adapter = new SharePointAdapter({ provider: "sharepoint" });
    await adapter.connect({ accessToken: TOKEN, tenantId: TENANT });

    await expect(
      adapter.pushUpdate("list", "item-001", { listId: "list-001", Title: "x" })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  // -------------------------------------------------------------------------
  // Error mapping
  // -------------------------------------------------------------------------

  it("maps 403 to AuthError", async () => {
    const adapter = new SharePointAdapter(BASE_CONFIG);
    await adapter.connect({ accessToken: TOKEN, tenantId: TENANT });

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: "Forbidden" } }), { status: 403 })
    );

    await expect(adapter.fetchEntities("site")).rejects.toBeInstanceOf(AuthError);
  });

  it("maps 429 to RateLimitError with retry-after", async () => {
    const adapter = new SharePointAdapter(BASE_CONFIG);
    await adapter.connect({ accessToken: TOKEN, tenantId: TENANT });

    fetchMock.mockResolvedValueOnce(
      new Response("", { status: 429, headers: { "retry-after": "10" } })
    );

    await expect(adapter.fetchEntities("site")).rejects.toMatchObject({
      code: "RATE_LIMIT",
      retryable: true,
    });
  });

  it("maps 400 to ValidationError", async () => {
    const adapter = new SharePointAdapter(BASE_CONFIG);
    await adapter.connect({ accessToken: TOKEN, tenantId: TENANT });

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: "Bad request" } }), { status: 400 })
    );

    await expect(adapter.fetchEntities("site")).rejects.toBeInstanceOf(ValidationError);
  });

  it("throws timeout error as retryable IntegrationError", async () => {
    const adapter = new SharePointAdapter({ ...BASE_CONFIG, timeout: 1 });
    await adapter.connect({ accessToken: TOKEN, tenantId: TENANT });

    fetchMock.mockImplementation(async (_input, init) => {
      await new Promise((resolve) => {
        init?.signal?.addEventListener("abort", resolve, { once: true });
      });
      throw new DOMException("Aborted", "AbortError");
    });

    await expect(adapter.validate()).rejects.toMatchObject({
      code: "TIMEOUT",
      retryable: true,
    });
  });

  // -------------------------------------------------------------------------
  // Unsupported entity type
  // -------------------------------------------------------------------------

  it("throws ValidationError for unsupported entity types", async () => {
    const adapter = new SharePointAdapter(BASE_CONFIG);
    await adapter.connect({ accessToken: TOKEN, tenantId: TENANT });

    await expect(adapter.fetchEntities("document")).rejects.toBeInstanceOf(ValidationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("disconnect clears connection state", async () => {
    const adapter = new SharePointAdapter(BASE_CONFIG);
    await adapter.connect({ accessToken: TOKEN, tenantId: TENANT });
    await expect(adapter.disconnect()).resolves.toBeUndefined();
    await expect(adapter.validate()).rejects.toMatchObject({ code: "CONNECTION_ERROR" });
  });

  it("retries transient 5xx once and then succeeds", async () => {
    const adapter = new SharePointAdapter({ ...BASE_CONFIG, retryAttempts: 2 });
    await adapter.connect({ accessToken: TOKEN, tenantId: TENANT });

    fetchMock
      .mockRejectedValueOnce(new TypeError("network reset"))
      .mockResolvedValueOnce(new Response(JSON.stringify({ value: [] }), { status: 200 }));

    const result = await adapter.fetchEntities("site");
    expect(result).toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

});
