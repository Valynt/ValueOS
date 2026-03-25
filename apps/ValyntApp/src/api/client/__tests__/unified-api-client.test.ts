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

describe("UnifiedApiClient input sanitization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => "application/json" },
        json: async () => ({ ok: true }),
      })
    );
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
