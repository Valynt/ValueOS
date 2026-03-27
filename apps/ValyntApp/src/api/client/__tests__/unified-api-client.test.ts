import { beforeEach, describe, expect, it, vi } from "vitest";

import { UnifiedApiClient } from "../unified-api-client";

vi.mock("@valueos/shared/config/client-config", () => ({
  getClientConfig: () => ({
    api: {
      baseUrl: "https://api.valueos.test",
      timeout: 1000,
      retryAttempts: 0,
    },
  }),
}));

vi.mock("../../../components/ui/use-toast", () => ({ toast: vi.fn() }));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFetchMock(body: unknown = { ok: true }) {
  return vi.fn().mockResolvedValue({
    ok: true,
    headers: { get: () => "application/json" },
    json: async () => body,
  });
}

function capturedHeaders(fetchMock: ReturnType<typeof vi.fn>): Record<string, string> {
  const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
  return (init?.headers ?? {}) as Record<string, string>;
}

// ---------------------------------------------------------------------------
// Existing: input sanitization
// ---------------------------------------------------------------------------

describe("UnifiedApiClient input sanitization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", makeFetchMock());
  });

  it("sanitizes path and query values before request construction", async () => {
    const client = new UnifiedApiClient({ baseUrl: "https://api.valueos.test" });

    await client.get("/api/tenants/<script>alert(1)</script>", {
      tenantId: "tenant-1<script>alert(1)</script>",
    });

    // eslint-disable-next-line no-restricted-globals
    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [requestedUrl] = fetchMock.mock.calls[0] ?? [];
    expect(String(requestedUrl)).not.toContain("<script>");
    // sanitizeInput with allowHtml: false strips script tags entirely
    expect(String(requestedUrl)).toContain("tenantId=tenant-1");
    expect(String(requestedUrl)).not.toContain("alert(1)");
  });
});

// ---------------------------------------------------------------------------
// P1 observability: X-Request-ID header
// ---------------------------------------------------------------------------

describe("UnifiedApiClient — X-Request-ID correlation header", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", makeFetchMock());
  });

  it("sets X-Request-ID on GET requests", async () => {
    const client = new UnifiedApiClient({ baseUrl: "https://api.valueos.test" });
    await client.get("/api/agents/jobs/job-1");

    const headers = capturedHeaders(vi.mocked(fetch));
    expect(headers["X-Request-ID"]).toBeTruthy();
    expect(typeof headers["X-Request-ID"]).toBe("string");
    expect(headers["X-Request-ID"].length).toBeGreaterThan(0);
  });

  it("sets X-Request-ID on POST requests", async () => {
    const client = new UnifiedApiClient({ baseUrl: "https://api.valueos.test" });
    await client.post("/api/agents/opportunity/invoke", { query: "test" });

    const headers = capturedHeaders(vi.mocked(fetch));
    expect(headers["X-Request-ID"]).toBeTruthy();
  });

  it("generates a unique X-Request-ID per request", async () => {
    const fetchMock = makeFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    const client = new UnifiedApiClient({ baseUrl: "https://api.valueos.test" });
    await client.get("/api/agents/jobs/job-1");
    await client.get("/api/agents/jobs/job-2");

    const id1 = (fetchMock.mock.calls[0]?.[1] as RequestInit & { headers: Record<string, string> })
      ?.headers?.["X-Request-ID"];
    const id2 = (fetchMock.mock.calls[1]?.[1] as RequestInit & { headers: Record<string, string> })
      ?.headers?.["X-Request-ID"];

    expect(id1).toBeTruthy();
    expect(id2).toBeTruthy();
    expect(id1).not.toBe(id2);
  });

  it("includes X-Request-ID in the response metadata", async () => {
    const client = new UnifiedApiClient({ baseUrl: "https://api.valueos.test" });
    const response = await client.get("/api/agents/jobs/job-1");

    expect(response.metadata?.requestId).toBeTruthy();
    expect(typeof response.metadata?.requestId).toBe("string");
  });
});
