import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HubSpotAdapter } from "./HubSpotAdapter";
import { IntegrationConfig } from "../base/index";

describe("HubSpotAdapter", () => {
  let adapter: HubSpotAdapter;
  const config: IntegrationConfig = {
    provider: "hubspot",
  };

  beforeEach(() => {
    adapter = new HubSpotAdapter(config);
    // Mock fetch
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("validate", () => {
    it("should return true when credentials are valid", async () => {
      adapter.connect({
        accessToken: "valid-token",
        tenantId: "test-tenant",
      });

      // Mock successful response
      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({}),
      });

      const result = await adapter.validate();
      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        "https://api.hubapi.com/crm/v3/objects/contacts?limit=1",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer valid-token",
          }),
        })
      );
    });

    it("should return false when credentials are invalid (401)", async () => {
      adapter.connect({
        accessToken: "invalid-token",
        tenantId: "test-tenant",
      });

      // Mock 401 response
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
      });

      const result = await adapter.validate();
      expect(result).toBe(false);
    });

    it("should throw error when rate limited", async () => {
      adapter.connect({
        accessToken: "valid-token",
        tenantId: "test-tenant",
      });

      // Mock 429 response
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
        headers: {
          get: () => "5", // Retry after 5 seconds
        },
      });

      await expect(adapter.validate()).rejects.toThrow(/Rate limit exceeded/);
    });

    it("should throw error on other failures", async () => {
      adapter.connect({
        accessToken: "valid-token",
        tenantId: "test-tenant",
      });

      // Mock 500 response
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      await expect(adapter.validate()).rejects.toThrow(/Request failed/);
    });

    it("should throw ConnectionError if not connected", async () => {
        await expect(adapter.validate()).rejects.toThrow(/Adapter not connected/);
    });
  });
});
