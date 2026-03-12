import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthError, IntegrationError, ValidationError } from "../base/index.js";
import { SlackAdapter } from "./SlackAdapter.js";

const BASE_CONFIG = { provider: "slack" };

const TENANT = "tenant-a";
const TOKEN = "xoxb-test-token";

describe("SlackAdapter", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // -------------------------------------------------------------------------
  // validate
  // -------------------------------------------------------------------------

  it("validates successfully with a working bot token", async () => {
    const adapter = new SlackAdapter(BASE_CONFIG);
    await adapter.connect({ accessToken: TOKEN, tenantId: TENANT });

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, user_id: "U123", team: "T123" }), { status: 200 })
    );

    await expect(adapter.validate()).resolves.toBe(true);
    const [calledUrl] = fetchMock.mock.calls[0];
    expect(String(calledUrl)).toContain("auth.test");
  });

  it("returns false when validate receives an auth error", async () => {
    const adapter = new SlackAdapter(BASE_CONFIG);
    await adapter.connect({ accessToken: TOKEN, tenantId: TENANT });

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: false, error: "invalid_auth" }), { status: 200 })
    );

    await expect(adapter.validate()).resolves.toBe(false);
  });

  // -------------------------------------------------------------------------
  // fetchEntities — channel
  // -------------------------------------------------------------------------

  it("fetches channels and maps tenant metadata", async () => {
    const adapter = new SlackAdapter(BASE_CONFIG);
    await adapter.connect({ accessToken: TOKEN, tenantId: TENANT });

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({
        ok: true,
        channels: [{ id: "C001", name: "general", updated: 1700000000 }],
      }), { status: 200 })
    );

    const entities = await adapter.fetchEntities("channel");

    expect(entities).toHaveLength(1);
    expect(entities[0]).toMatchObject({
      id: "C001",
      externalId: "C001",
      provider: "slack",
      type: "channel",
      metadata: { tenantId: TENANT, organizationId: TENANT, version: "1700000000" },
    });
  });

  // -------------------------------------------------------------------------
  // fetchEntities — user
  // -------------------------------------------------------------------------

  it("fetches users and maps tenant metadata", async () => {
    const adapter = new SlackAdapter(BASE_CONFIG);
    await adapter.connect({ accessToken: TOKEN, tenantId: TENANT });

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({
        ok: true,
        members: [{ id: "U001", name: "ada", real_name: "Ada Lovelace", updated: 1700000001 }],
      }), { status: 200 })
    );

    const entities = await adapter.fetchEntities("user");

    expect(entities).toHaveLength(1);
    expect(entities[0]).toMatchObject({
      id: "U001",
      externalId: "U001",
      provider: "slack",
      type: "user",
      metadata: { tenantId: TENANT, organizationId: TENANT },
    });
  });

  // -------------------------------------------------------------------------
  // fetchEntities — message
  // -------------------------------------------------------------------------

  it("fetches messages when channelId filter is provided", async () => {
    const adapter = new SlackAdapter(BASE_CONFIG);
    await adapter.connect({ accessToken: TOKEN, tenantId: TENANT });

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({
        ok: true,
        messages: [{ ts: "1700000000.000100", user: "U001", text: "hello" }],
      }), { status: 200 })
    );

    const entities = await adapter.fetchEntities("message", { filters: { channelId: "C001" } });

    expect(entities).toHaveLength(1);
    expect(entities[0]).toMatchObject({
      id: "C001:1700000000.000100",
      externalId: "1700000000.000100",
      provider: "slack",
      type: "message",
      metadata: { tenantId: TENANT, organizationId: TENANT },
    });
  });

  it("throws ValidationError when fetching messages without channelId", async () => {
    const adapter = new SlackAdapter(BASE_CONFIG);
    await adapter.connect({ accessToken: TOKEN, tenantId: TENANT });

    await expect(adapter.fetchEntities("message")).rejects.toBeInstanceOf(ValidationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // fetchEntity
  // -------------------------------------------------------------------------

  it("fetches a single channel by id", async () => {
    const adapter = new SlackAdapter(BASE_CONFIG);
    await adapter.connect({ accessToken: TOKEN, tenantId: TENANT });

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({
        ok: true,
        channel: { id: "C001", name: "general" },
      }), { status: 200 })
    );

    const entity = await adapter.fetchEntity("channel", "C001");
    expect(entity).toMatchObject({ id: "C001", type: "channel" });
  });

  it("returns null when channel is not found", async () => {
    const adapter = new SlackAdapter(BASE_CONFIG);
    await adapter.connect({ accessToken: TOKEN, tenantId: TENANT });

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: false, error: "channel_not_found" }), { status: 200 })
    );

    await expect(adapter.fetchEntity("channel", "C_MISSING")).resolves.toBeNull();
  });

  it("throws ValidationError when fetching a single message entity", async () => {
    const adapter = new SlackAdapter(BASE_CONFIG);
    await adapter.connect({ accessToken: TOKEN, tenantId: TENANT });

    await expect(adapter.fetchEntity("message", "1700000000.000100")).rejects.toBeInstanceOf(ValidationError);
  });

  // -------------------------------------------------------------------------
  // pushUpdate — uses POST for chat.postMessage
  // -------------------------------------------------------------------------

  it("posts a message via chat.postMessage using POST", async () => {
    const adapter = new SlackAdapter(BASE_CONFIG);
    await adapter.connect({ accessToken: TOKEN, tenantId: TENANT });

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, ts: "1700000001.000200", channel: "C001" }), { status: 200 })
    );

    await expect(
      adapter.pushUpdate("channel", "C001", { text: "Hello from ValueOS" })
    ).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ method: "POST" })
    );
    const [, init] = fetchMock.mock.calls[0];
    expect(init?.body).toBeDefined();
    const body = JSON.parse(init!.body as string) as Record<string, string>;
    expect(body).toMatchObject({ channel: "C001", text: "Hello from ValueOS" });
  });

  it("includes thread_ts when provided in pushUpdate", async () => {
    const adapter = new SlackAdapter(BASE_CONFIG);
    await adapter.connect({ accessToken: TOKEN, tenantId: TENANT });

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );

    await adapter.pushUpdate("channel", "C001", { text: "reply", thread_ts: "1700000000.000100" });

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init!.body as string) as Record<string, string>;
    expect(body["thread_ts"]).toBe("1700000000.000100");
  });

  it("throws ValidationError when pushUpdate text is empty", async () => {
    const adapter = new SlackAdapter(BASE_CONFIG);
    await adapter.connect({ accessToken: TOKEN, tenantId: TENANT });

    await expect(
      adapter.pushUpdate("channel", "C001", { text: "   " })
    ).rejects.toBeInstanceOf(ValidationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Error mapping
  // -------------------------------------------------------------------------

  it("maps token_revoked to AuthError", async () => {
    const adapter = new SlackAdapter(BASE_CONFIG);
    await adapter.connect({ accessToken: TOKEN, tenantId: TENANT });

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: false, error: "token_revoked" }), { status: 200 })
    );

    await expect(adapter.fetchEntities("channel")).rejects.toBeInstanceOf(AuthError);
  });

  it("maps ratelimited to RateLimitError (retryable)", async () => {
    const adapter = new SlackAdapter(BASE_CONFIG);
    await adapter.connect({ accessToken: TOKEN, tenantId: TENANT });

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: false, error: "ratelimited" }), { status: 200 })
    );

    await expect(adapter.fetchEntities("channel")).rejects.toMatchObject({
      code: "RATE_LIMIT",
      retryable: true,
    });
  });

  it("maps HTTP 429 to RateLimitError with retry-after header", async () => {
    const adapter = new SlackAdapter(BASE_CONFIG);
    await adapter.connect({ accessToken: TOKEN, tenantId: TENANT });

    fetchMock.mockResolvedValueOnce(
      new Response("", { status: 429, headers: { "retry-after": "3" } })
    );

    await expect(adapter.fetchEntities("channel")).rejects.toMatchObject({
      code: "RATE_LIMIT",
      retryable: true,
    });
  });

  it("throws timeout error as retryable IntegrationError", async () => {
    const adapter = new SlackAdapter({ ...BASE_CONFIG, timeout: 1 });
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
  // Auth / connect
  // -------------------------------------------------------------------------

  it("throws AuthError when no token is provided", async () => {
    const adapter = new SlackAdapter(BASE_CONFIG);
    await expect(
      adapter.connect({ accessToken: "", tenantId: TENANT })
    ).rejects.toBeInstanceOf(AuthError);
  });

  it("throws ValidationError for unsupported entity types", async () => {
    const adapter = new SlackAdapter(BASE_CONFIG);
    await adapter.connect({ accessToken: TOKEN, tenantId: TENANT });

    await expect(adapter.fetchEntities("ticket")).rejects.toBeInstanceOf(ValidationError);
  });

  it("disconnect clears connection state", async () => {
    const adapter = new SlackAdapter(BASE_CONFIG);
    await adapter.connect({ accessToken: TOKEN, tenantId: TENANT });
    await expect(adapter.disconnect()).resolves.toBeUndefined();
    await expect(adapter.validate()).rejects.toMatchObject({ code: "CONNECTION_ERROR" });
  });

  it("retries transient 5xx once and then succeeds", async () => {
    const adapter = new SlackAdapter({ ...BASE_CONFIG, retryAttempts: 2 });
    await adapter.connect({ accessToken: TOKEN, tenantId: TENANT });

    fetchMock
      .mockRejectedValueOnce(new TypeError("network reset"))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, channels: [] }), { status: 200 }));

    const result = await adapter.fetchEntities("channel");
    expect(result).toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

});
