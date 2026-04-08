/**
 * rbac-cache-ttl-env-respected — unit test
 *
 * When RBAC_CACHE_TTL_SECONDS=60 is set, the PermissionService singleton
 * must have cacheTTL === 60000 (value x 1000 to convert to milliseconds).
 */

import { afterEach, describe, expect, it, vi } from "vitest";

// ── Mocks for transitive dependencies ────────────────────────────────────────
vi.mock("../../../lib/supabase.js", () => ({
  assertNotTestEnv: vi.fn(),
  createServerSupabaseClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => ({ data: null, error: null }),
          maybeSingle: () => ({ data: null, error: null }),
        }),
      }),
    }),
  }),
  supabase: { from: () => ({}) },
}));

vi.mock("../../../lib/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock("../../../lib/rbacInvalidation.js", () => ({
  subscribeRbacInvalidation: vi.fn().mockResolvedValue(() => Promise.resolve()),
  publishRbacInvalidation: vi.fn(),
}));

// ── Tests ────────────────────────────────────────────────────────────────────
describe("rbac-cache-ttl-env-respected", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("cacheTTL equals env value x 1000 when RBAC_CACHE_TTL_SECONDS is set", async () => {
    vi.stubEnv("RBAC_CACHE_TTL_SECONDS", "60");

    // Dynamic import so the module reads the env at evaluation time
    const mod = await import("../PermissionService.js");
    const { PermissionService } = mod;

    // Construct a new instance with the env-derived value
    const envCacheTtlMs = Number(process.env.RBAC_CACHE_TTL_SECONDS) * 1000;
    const service = new PermissionService(envCacheTtlMs);

    // Access the private cacheTTL via bracket notation
     
    const ttl = (service as any).cacheTTL;
    expect(ttl).toBe(60000);
  });

  it("uses default TTL when RBAC_CACHE_TTL_SECONDS is not set", async () => {
    vi.stubEnv("RBAC_CACHE_TTL_SECONDS", "");

    const mod = await import("../PermissionService.js");
    const { PermissionService } = mod;

    // When no env value is provided, pass undefined — the constructor uses its default
    const service = new PermissionService(undefined);

     
    const ttl = (service as any).cacheTTL;
    // Default is ROLE_CACHE_TTL_MS which is defined at the top of the module.
    // We just verify it's a positive number and NOT 0 or NaN.
    expect(ttl).toBeGreaterThan(0);
    expect(Number.isFinite(ttl)).toBe(true);
  });

  it("the module-level singleton reads RBAC_CACHE_TTL_SECONDS", async () => {
    // Verify the wiring: the module bottom exports `permissionService` using the env
    vi.stubEnv("RBAC_CACHE_TTL_SECONDS", "120");

    const mod = await import("../PermissionService.js");
    // The exported singleton should have 120 * 1000 = 120000
     
    const ttl = (mod.permissionService as any).cacheTTL;
    expect(ttl).toBe(120000);
  });
});
