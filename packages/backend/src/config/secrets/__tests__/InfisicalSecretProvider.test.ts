import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { InfisicalSecretProvider } from "../InfisicalSecretProvider.js";
vi.mock("../../../lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

vi.mock("../../../lib/supabase", () => {
  const mockServerClient = {
    from: vi.fn(() => ({
      insert: vi.fn().mockResolvedValue({ error: null }),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    })),
  };

  return {
    supabase: null,
    createBrowserSupabaseClient: vi.fn(() => {
      throw new Error(
        "createBrowserSupabaseClient() is only available in browser tests"
      );
    }),
    createRequestSupabaseClient: vi.fn(() => mockServerClient),
    createServerSupabaseClient: vi.fn(() => mockServerClient),
    getSupabaseClient: vi.fn(() => mockServerClient),
  };
});

function createMockFetch() {
  return vi.fn(async (url: string | URL, opts?: RequestInit) => {
    const urlStr = String(url);

    // Auth
    if (urlStr.includes("/auth/universal-auth/login")) {
      return {
        ok: true,
        json: async () => ({
          accessToken: "test-access-token",
          expiresIn: 7200,
          tokenType: "Bearer",
        }),
        text: async () => "",
      };
    }

    // List secrets
    if (
      urlStr.includes("/api/v3/secrets/raw") &&
      !urlStr.includes("/api/v3/secrets/raw/")
    ) {
      return {
        ok: true,
        json: async () => ({
          secrets: [
            {
              id: "s1",
              secretKey: "DB_URL",
              secretValue: "postgres://...",
              version: 1,
              type: "shared",
              environment: "prod",
              secretPath: "/tenants/tenant-1",
            },
            {
              id: "s2",
              secretKey: "API_KEY",
              secretValue: "sk-abc123",
              version: 2,
              type: "shared",
              environment: "prod",
              secretPath: "/tenants/tenant-1",
            },
          ],
        }),
        text: async () => "",
      };
    }

    // Get single secret
    if (urlStr.includes("/api/v3/secrets/raw/")) {
      return {
        ok: true,
        json: async () => ({
          secret: {
            id: "s1",
            secretKey: "DB_URL",
            secretValue: "postgres://tenant1:pass@db:5432/app",
            version: 3,
            type: "shared",
            environment: "prod",
            secretPath: "/tenants/tenant-1",
          },
        }),
        text: async () => "",
      };
    }

    // DELETE
    if (opts?.method === "DELETE") {
      return { ok: true, json: async () => ({}), text: async () => "" };
    }

    // POST / PATCH
    if (opts?.method === "POST" || opts?.method === "PATCH") {
      return { ok: true, json: async () => ({}), text: async () => "" };
    }

    return { ok: true, json: async () => ({}), text: async () => "" };
  });
}

function createProvider(
  overrides?: Partial<ConstructorParameters<typeof InfisicalSecretProvider>[0]>
) {
  return new InfisicalSecretProvider({
    siteUrl: "https://app.infisical.com",
    clientId: "test-client-id",
    clientSecret: "test-client-secret",
    projectId: "proj-123",
    environment: "prod",
    cacheTTL: 2_000,
    ...overrides,
  });
}

describe("InfisicalSecretProvider", () => {
  let mockFetch: ReturnType<typeof createMockFetch>;
  let provider: InfisicalSecretProvider;

  beforeEach(() => {
    mockFetch = createMockFetch();
    vi.stubGlobal("fetch", mockFetch);
    provider = createProvider();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------- Auth ----------

  describe("authentication", () => {
    it("authenticates via Universal Auth on first request", async () => {
      await provider.getSecret("tenant-1", "DB_URL");

      // First call = auth, second = getSecret
      const authCall = mockFetch.mock.calls.find(([url]) =>
        String(url).includes("/auth/universal-auth/login")
      );
      expect(authCall).toBeDefined();
    });

    it("reuses cached token for subsequent requests", async () => {
      await provider.getSecret("tenant-1", "DB_URL");
      provider.clearCache();
      await provider.getSecret("tenant-1", "DB_URL");

      const authCalls = mockFetch.mock.calls.filter(([url]) =>
        String(url).includes("/auth/universal-auth/login")
      );
      expect(authCalls).toHaveLength(1);
    });

    it("throws on failed authentication", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({
          ok: false,
          status: 401,
          text: async () => "Unauthorized",
        }))
      );

      await expect(provider.getSecret("tenant-1", "DB_URL")).rejects.toThrow(
        /authentication failed/i
      );
    });
  });

  // ---------- getSecret ----------

  describe("getSecret", () => {
    it("fetches and returns secret value", async () => {
      const result = await provider.getSecret("tenant-1", "DB_URL");
      expect(result.value).toBe("postgres://tenant1:pass@db:5432/app");
    });

    it("passes correct tenant path as secretPath param", async () => {
      await provider.getSecret("tenant-1", "DB_URL");

      const getCall = mockFetch.mock.calls.find(([url]) =>
        String(url).includes("/api/v3/secrets/raw/")
      );
      expect(getCall).toBeDefined();
      const callUrl = new URL(String(getCall![0]));
      expect(callUrl.searchParams.get("secretPath")).toBe("/tenants/tenant-1");
    });

    it("uses cached value on second call", async () => {
      const r1 = await provider.getSecret("tenant-1", "DB_URL");
      const r2 = await provider.getSecret("tenant-1", "DB_URL");

      expect(r1.value).toBe(r2.value);

      // Only 1 auth + 1 getSecret call (second is cached)
      const getCalls = mockFetch.mock.calls.filter(([url]) =>
        String(url).includes("/api/v3/secrets/raw/")
      );
      expect(getCalls).toHaveLength(1);
    });

    it("rejects invalid tenant ID", async () => {
      await expect(provider.getSecret("../../bad", "DB_URL")).rejects.toThrow();
    });

    it("rejects invalid secret key", async () => {
      await expect(
        provider.getSecret("tenant-1", "bad key with spaces")
      ).rejects.toThrow();
    });
  });

  // ---------- listSecrets ----------

  describe("listSecrets", () => {
    it("returns array of secret keys for a tenant", async () => {
      const keys = await provider.listSecrets("tenant-1");
      expect(keys).toEqual(["DB_URL", "API_KEY"]);
    });

    it("passes correct secretPath for tenant isolation", async () => {
      await provider.listSecrets("tenant-42");

      const listCall = mockFetch.mock.calls.find(([url]) => {
        const u = String(url);
        return (
          u.includes("/api/v3/secrets/raw") &&
          !u.includes("/api/v3/secrets/raw/")
        );
      });
      expect(listCall).toBeDefined();
      const callUrl = new URL(String(listCall![0]));
      expect(callUrl.searchParams.get("secretPath")).toBe("/tenants/tenant-42");
    });
  });

  // ---------- setSecret ----------

  describe("setSecret", () => {
    it("creates a new secret when it does not exist", async () => {
      // Override fetch to return 404 on get (secret doesn't exist) then success on POST
      const customFetch = vi.fn(
        async (url: string | URL, opts?: RequestInit) => {
          const u = String(url);
          if (u.includes("/auth/universal-auth/login")) {
            return {
              ok: true,
              json: async () => ({
                accessToken: "t",
                expiresIn: 7200,
                tokenType: "Bearer",
              }),
              text: async () => "",
            };
          }
          // secretExists check → 404
          if (
            u.includes("/api/v3/secrets/raw/") &&
            (!opts?.method || opts.method === "GET")
          ) {
            return {
              ok: false,
              status: 404,
              text: async () => "Not found",
              json: async () => ({}),
            };
          }
          // POST create
          if (opts?.method === "POST") {
            return { ok: true, json: async () => ({}), text: async () => "" };
          }
          return { ok: true, json: async () => ({}), text: async () => "" };
        }
      );
      vi.stubGlobal("fetch", customFetch);

      const result = await provider.setSecret(
        "tenant-1",
        "NEW_KEY",
        { value: "new-val" },
        {
          tenantId: "tenant-1",
          secretPath: "/tenants/tenant-1/NEW_KEY",
          version: "1",
          createdAt: new Date().toISOString(),
          lastAccessed: new Date().toISOString(),
          sensitivityLevel: "high",
        }
      );
      expect(result).toBe(true);

      const postCall = customFetch.mock.calls.find(
        ([, opts]) => opts?.method === "POST"
      );
      expect(postCall).toBeDefined();
    });
  });

  // ---------- deleteSecret ----------

  describe("deleteSecret", () => {
    it("deletes a secret and invalidates cache", async () => {
      // Populate cache
      await provider.getSecret("tenant-1", "DB_URL");
      // Delete
      const result = await provider.deleteSecret("tenant-1", "DB_URL");
      expect(result).toBe(true);

      const delCall = mockFetch.mock.calls.find(
        ([, opts]) => opts?.method === "DELETE"
      );
      expect(delCall).toBeDefined();
    });
  });

  // ---------- healthCheck ----------

  describe("healthCheck", () => {
    it("returns true when auth succeeds", async () => {
      const healthy = await provider.healthCheck();
      expect(healthy).toBe(true);
    });

    it("returns false when auth fails", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({
          ok: false,
          status: 500,
          text: async () => "Internal Server Error",
        }))
      );

      const healthy = await provider.healthCheck();
      expect(healthy).toBe(false);
    });
  });

  // ---------- getProviderName ----------

  it('returns "infisical" as provider name', () => {
    expect(provider.getProviderName()).toBe("infisical");
  });

  // ---------- clearCache ----------

  describe("clearCache", () => {
    it("clears all cache when no tenantId provided", async () => {
      await provider.getSecret("tenant-1", "DB_URL");
      provider.clearCache();
      // Next call should hit the API again
      await provider.getSecret("tenant-1", "DB_URL");

      const getCalls = mockFetch.mock.calls.filter(([url]) =>
        String(url).includes("/api/v3/secrets/raw/")
      );
      expect(getCalls).toHaveLength(2);
    });

    it("clears only specified tenant cache", async () => {
      await provider.getSecret("tenant-1", "DB_URL");
      await provider.getSecret("tenant-2", "DB_URL");
      provider.clearCache("tenant-1");

      // tenant-1 should re-fetch, tenant-2 should be cached
      await provider.getSecret("tenant-1", "DB_URL");
      await provider.getSecret("tenant-2", "DB_URL");

      // tenant-1: 2 API calls, tenant-2: 1 API call
      const getCalls = mockFetch.mock.calls.filter(([url]) => {
        const u = String(url);
        return u.includes("/api/v3/secrets/raw/") && u.includes("tenant-1");
      });
      expect(getCalls).toHaveLength(2);
    });
  });

  // ---------- Tenant isolation -----------

  describe("tenant isolation", () => {
    it("different tenants use different secret paths", async () => {
      await provider.getSecret("tenant-A", "KEY");
      await provider.getSecret("tenant-B", "KEY");

      const apiCalls = mockFetch.mock.calls.filter(([url]) =>
        String(url).includes("/api/v3/secrets/raw/")
      );
      const paths = apiCalls.map(([url]) => {
        const u = new URL(String(url));
        return u.searchParams.get("secretPath");
      });

      expect(paths).toContain("/tenants/tenant-A");
      expect(paths).toContain("/tenants/tenant-B");
    });
  });
});
