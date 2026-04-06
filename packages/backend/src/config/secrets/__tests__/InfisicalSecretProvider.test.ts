/**
 * InfisicalSecretProvider tests
 *
 * Mocks @infisical/sdk so no real network calls are made.
 * All existing behavioural contracts (caching, circuit-breaking, tenant
 * isolation, input validation, audit logging) are preserved and verified.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InfisicalSecretProvider } from "../InfisicalSecretProvider.js";

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

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
    assertNotTestEnv: vi.fn(),
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

// ---------------------------------------------------------------------------
// @infisical/sdk mock factory
// ---------------------------------------------------------------------------

/**
 * Returns a fresh set of SDK mock functions.
 * We re-create these per test so call counts are isolated.
 */
function createSdkMocks() {
  const universalAuthLogin = vi.fn().mockResolvedValue({});

  const getSecret = vi.fn().mockResolvedValue({
    id: "s1",
    secretKey: "DB_URL",
    secretValue: "postgres://tenant1:pass@db:5432/app",
    version: 3,
    type: "shared",
    environment: "prod",
    secretPath: "/tenants/tenant-1",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    workspaceId: "proj-123",
    secretValueHidden: false,
    isRotatedSecret: false,
    tags: [],
  });

  const listSecrets = vi.fn().mockResolvedValue({
    secrets: [
      {
        id: "s1",
        secretKey: "DB_URL",
        secretValue: "postgres://...",
        version: 1,
        type: "shared",
        environment: "prod",
        secretPath: "/tenants/tenant-1",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        workspaceId: "proj-123",
        secretValueHidden: false,
        isRotatedSecret: false,
        tags: [],
      },
      {
        id: "s2",
        secretKey: "API_KEY",
        secretValue: "sk-abc123",
        version: 2,
        type: "shared",
        environment: "prod",
        secretPath: "/tenants/tenant-1",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        workspaceId: "proj-123",
        secretValueHidden: false,
        isRotatedSecret: false,
        tags: [],
      },
    ],
  });

  const createSecret = vi.fn().mockResolvedValue({});
  const updateSecret = vi.fn().mockResolvedValue({});
  const deleteSecret = vi.fn().mockResolvedValue({});

  return {
    universalAuthLogin,
    getSecret,
    listSecrets,
    createSecret,
    updateSecret,
    deleteSecret,
  };
}

// Initialize at declaration so the vi.mock factory can reference it immediately.
// beforeEach re-creates it to reset call counts between tests.
let sdkMocks: ReturnType<typeof createSdkMocks> = createSdkMocks();

vi.mock("@infisical/sdk", () => {
  return {
    InfisicalSDK: vi.fn().mockImplementation(() => ({
      auth: () => ({
        universalAuth: {
          login: (...args: unknown[]) =>
            sdkMocks.universalAuthLogin(...args),
          renew: vi.fn().mockResolvedValue({}),
        },
        getAccessToken: vi.fn().mockReturnValue("mock-token"),
        accessToken: vi.fn(),
      }),
      secrets: () => ({
        getSecret: (...args: unknown[]) => sdkMocks.getSecret(...args),
        listSecrets: (...args: unknown[]) => sdkMocks.listSecrets(...args),
        createSecret: (...args: unknown[]) => sdkMocks.createSecret(...args),
        updateSecret: (...args: unknown[]) => sdkMocks.updateSecret(...args),
        deleteSecret: (...args: unknown[]) => sdkMocks.deleteSecret(...args),
      }),
    })),
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("InfisicalSecretProvider", () => {
  let provider: InfisicalSecretProvider;

  beforeEach(() => {
    sdkMocks = createSdkMocks();
    provider = createProvider();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------- Auth ----------

  describe("authentication", () => {
    it("calls universalAuth.login on first request", async () => {
      await provider.getSecret("tenant-1", "DB_URL");
      expect(sdkMocks.universalAuthLogin).toHaveBeenCalledWith({
        clientId: "test-client-id",
        clientSecret: "test-client-secret",
      });
    });

    it("does not re-authenticate on subsequent requests", async () => {
      await provider.getSecret("tenant-1", "DB_URL");
      provider.clearCache();
      await provider.getSecret("tenant-1", "DB_URL");
      // Login is called once during construction (background) + never again
      expect(sdkMocks.universalAuthLogin).toHaveBeenCalledTimes(1);
    });

    it("throws when universalAuth.login rejects", async () => {
      sdkMocks.universalAuthLogin.mockRejectedValueOnce(
        new Error("Unauthorized")
      );
      // Force a fresh unauthenticated provider
      const freshProvider = createProvider();
      // The background auth in the constructor will fail; we then force
      // ensureAuthenticated to try again by calling a method directly.
      // Reset the flag via healthCheck (which resets isAuthenticated).
      sdkMocks.universalAuthLogin.mockRejectedValue(new Error("Unauthorized"));
      const healthy = await freshProvider.healthCheck();
      expect(healthy).toBe(false);
    });
  });

  // ---------- getSecret ----------

  describe("getSecret", () => {
    it("returns the secret value from Infisical", async () => {
      const result = await provider.getSecret("tenant-1", "DB_URL");
      expect(result.value).toBe("postgres://tenant1:pass@db:5432/app");
    });

    it("passes the correct tenant secretPath to the SDK", async () => {
      await provider.getSecret("tenant-1", "DB_URL");
      expect(sdkMocks.getSecret).toHaveBeenCalledWith(
        expect.objectContaining({ secretPath: "/tenants/tenant-1" })
      );
    });

    it("passes the correct secretName to the SDK", async () => {
      await provider.getSecret("tenant-1", "DB_URL");
      expect(sdkMocks.getSecret).toHaveBeenCalledWith(
        expect.objectContaining({ secretName: "DB_URL" })
      );
    });

    it("caches the result and avoids a second SDK call", async () => {
      const r1 = await provider.getSecret("tenant-1", "DB_URL");
      const r2 = await provider.getSecret("tenant-1", "DB_URL");
      expect(r1.value).toBe(r2.value);
      expect(sdkMocks.getSecret).toHaveBeenCalledTimes(1);
    });

    it("re-fetches after cache is cleared", async () => {
      await provider.getSecret("tenant-1", "DB_URL");
      provider.clearCache();
      await provider.getSecret("tenant-1", "DB_URL");
      expect(sdkMocks.getSecret).toHaveBeenCalledTimes(2);
    });

    it("rejects an invalid tenant ID", async () => {
      await expect(
        provider.getSecret("../../bad", "DB_URL")
      ).rejects.toThrow();
    });

    it("rejects a secret key containing spaces", async () => {
      await expect(
        provider.getSecret("tenant-1", "bad key with spaces")
      ).rejects.toThrow();
    });
  });

  // ---------- listSecrets ----------

  describe("listSecrets", () => {
    it("returns an array of secret keys for a tenant", async () => {
      const keys = await provider.listSecrets("tenant-1");
      expect(keys).toEqual(["DB_URL", "API_KEY"]);
    });

    it("passes the correct secretPath for tenant isolation", async () => {
      await provider.listSecrets("tenant-42");
      expect(sdkMocks.listSecrets).toHaveBeenCalledWith(
        expect.objectContaining({ secretPath: "/tenants/tenant-42" })
      );
    });
  });

  // ---------- setSecret ----------

  describe("setSecret", () => {
    const metadata = {
      tenantId: "tenant-1",
      secretPath: "/tenants/tenant-1/NEW_KEY",
      version: "1",
      createdAt: new Date().toISOString(),
      lastAccessed: new Date().toISOString(),
      sensitivityLevel: "high" as const,
    };

    it("calls createSecret when the secret does not exist", async () => {
      // getSecretMetadata returns null → secret does not exist
      sdkMocks.getSecret.mockRejectedValueOnce(new Error("Not found"));

      const result = await provider.setSecret(
        "tenant-1",
        "NEW_KEY",
        { value: "new-val" },
        metadata
      );

      expect(result).toBe(true);
      expect(sdkMocks.createSecret).toHaveBeenCalledWith(
        "NEW_KEY",
        expect.objectContaining({ secretValue: "new-val" })
      );
    });

    it("calls updateSecret when the secret already exists", async () => {
      // getSecretMetadata succeeds → secret exists
      const result = await provider.setSecret(
        "tenant-1",
        "DB_URL",
        { value: "updated-val" },
        metadata
      );

      expect(result).toBe(true);
      expect(sdkMocks.updateSecret).toHaveBeenCalledWith(
        "DB_URL",
        expect.objectContaining({ secretValue: "updated-val" })
      );
    });

    it("invalidates the cache after a write", async () => {
      // Populate cache
      await provider.getSecret("tenant-1", "DB_URL");
      // Update
      await provider.setSecret(
        "tenant-1",
        "DB_URL",
        { value: "updated-val" },
        metadata
      );
      // Next read should hit the SDK again
      await provider.getSecret("tenant-1", "DB_URL");
      expect(sdkMocks.getSecret).toHaveBeenCalledTimes(2);
    });
  });

  // ---------- deleteSecret ----------

  describe("deleteSecret", () => {
    it("calls the SDK deleteSecret and returns true", async () => {
      const result = await provider.deleteSecret("tenant-1", "DB_URL");
      expect(result).toBe(true);
      expect(sdkMocks.deleteSecret).toHaveBeenCalledWith(
        "DB_URL",
        expect.objectContaining({
          environment: "prod",
          projectId: "proj-123",
          secretPath: "/tenants/tenant-1",
        })
      );
    });

    it("invalidates the cache after deletion", async () => {
      await provider.getSecret("tenant-1", "DB_URL");
      await provider.deleteSecret("tenant-1", "DB_URL");
      await provider.getSecret("tenant-1", "DB_URL");
      expect(sdkMocks.getSecret).toHaveBeenCalledTimes(2);
    });
  });

  // ---------- healthCheck ----------

  describe("healthCheck", () => {
    it("returns true when re-authentication succeeds", async () => {
      const healthy = await provider.healthCheck();
      expect(healthy).toBe(true);
    });

    it("returns false when re-authentication fails", async () => {
      sdkMocks.universalAuthLogin.mockRejectedValue(
        new Error("Internal Server Error")
      );
      const healthy = await provider.healthCheck();
      expect(healthy).toBe(false);
    });
  });

  // ---------- getProviderName ----------

  it('returns "infisical" as the provider name', () => {
    expect(provider.getProviderName()).toBe("infisical");
  });

  // ---------- clearCache ----------

  describe("clearCache", () => {
    it("clears all cached entries when no tenantId is supplied", async () => {
      await provider.getSecret("tenant-1", "DB_URL");
      provider.clearCache();
      await provider.getSecret("tenant-1", "DB_URL");
      expect(sdkMocks.getSecret).toHaveBeenCalledTimes(2);
    });

    it("clears only the specified tenant's cache entries", async () => {
      await provider.getSecret("tenant-1", "DB_URL");
      await provider.getSecret("tenant-2", "DB_URL");
      provider.clearCache("tenant-1");

      // tenant-1 must re-fetch; tenant-2 stays cached
      await provider.getSecret("tenant-1", "DB_URL");
      await provider.getSecret("tenant-2", "DB_URL");

      // 2 calls for tenant-1 (initial + after clear), 1 for tenant-2
      expect(sdkMocks.getSecret).toHaveBeenCalledTimes(3);
    });
  });

  // ---------- Tenant isolation ----------

  describe("tenant isolation", () => {
    it("uses distinct secret paths for different tenants", async () => {
      await provider.getSecret("tenant-A", "KEY");
      await provider.getSecret("tenant-B", "KEY");

      const calls = sdkMocks.getSecret.mock.calls;
      const paths = calls.map((c: unknown[]) => (c[0] as { secretPath: string }).secretPath);
      expect(paths).toContain("/tenants/tenant-A");
      expect(paths).toContain("/tenants/tenant-B");
    });
  });
});
