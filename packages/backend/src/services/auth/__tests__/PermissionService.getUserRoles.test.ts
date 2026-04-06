// @vitest-environment node
/**
 * BUG-4 regression: getUserRoles must check active membership even when
 * called without scope/scopeId.
 *
 * Before the fix, calling getUserRoles(userId) with no scope bypassed
 * ensureTenantScopeAccess entirely, allowing suspended/removed users to
 * enumerate their roles.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Supabase mock ──────────────────────────────────────────────────────────

const supabaseMock = { from: vi.fn() };

vi.mock("../../../lib/supabase.js", () => ({
  assertNotTestEnv: vi.fn(), supabase: supabaseMock }));

// ── Logger mock ───────────────────────────────────────────────────────────

const noopLogger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };

vi.mock("@shared/lib/logger", () => ({ createLogger: () => noopLogger }));

// ── Stub the entire TenantAwareService re-export chain ────────────────────
// TenantAwareService (and its transitive deps) have broken relative imports
// that don't resolve in the test environment. Provide a minimal stub that
// implements only what PermissionService uses.

class AuthorizationError extends Error {
  constructor(msg: string) { super(msg); this.name = "AuthorizationError"; }
}
class NotFoundError extends Error {
  constructor(resource: string) { super(`${resource} not found`); this.name = "NotFoundError"; }
}

// Mock the re-export stubs we created so the chain stops here.
vi.mock("../errors.js", () => ({ AuthorizationError, NotFoundError }));

vi.mock("../TenantAwareService.js", () => {
  class TenantAwareService {
    protected supabase = supabaseMock;
    protected serviceName = "stub";
    protected logger = noopLogger;
    private _cache = new Map<string, { data: unknown; timestamp: number }>();

    protected async getUserTenants(userId: string): Promise<string[]> {
      const result = await (this.supabase.from("user_tenants") as unknown as {
        select: (s: string) => { eq: (k: string, v: string) => { eq: (k: string, v: string) => Promise<{ data: { tenant_id: string }[] | null; error: unknown }> } }
      }).select("tenant_id").eq("user_id", userId).eq("status", "active");

      if (result.error) throw result.error;
      if (!result.data || result.data.length === 0) {
        throw new AuthorizationError("No active tenant membership for user");
      }
      return result.data.map((r) => r.tenant_id);
    }

    protected async validateTenantAccess(userId: string, resourceTenantId: string): Promise<void> {
      const tenants = await this.getUserTenants(userId);
      if (!tenants.includes(resourceTenantId)) throw new NotFoundError("Resource");
    }

    protected async executeRequest<T>(op: () => Promise<T>, _cfg?: unknown): Promise<T> {
      return op();
    }

    protected clearCache(key?: string): void {
      if (key) this._cache.delete(key); else this._cache.clear();
    }

    protected log(_l: string, _m: string, _d?: unknown): void {}
  }
  return { TenantAwareService };
});

// ── Also mock the permissions lib ─────────────────────────────────────────

vi.mock("../../lib/permissions", () => ({ PERMISSIONS: {} }));

// ── Chain builder ──────────────────────────────────────────────────────────

function chain(finalValue: unknown) {
  const c: Record<string, unknown> = {};
  c.then = (resolve: (v: unknown) => void) => resolve(finalValue);
  const self = () => c;
  c.select = vi.fn(self);
  c.eq = vi.fn(self);
  c.in = vi.fn(self);
  c.single = vi.fn().mockResolvedValue(finalValue);
  c.insert = vi.fn(self);
  return c;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("PermissionService.getUserRoles — BUG-4 regression", () => {
  let PermissionService: typeof import("../PermissionService.js").PermissionService;

  beforeEach(async () => {
    vi.resetAllMocks();
    const mod = await import("../PermissionService.js");
    PermissionService = mod.PermissionService;
  });

  it("throws when user has no active memberships (unscoped call)", async () => {
    supabaseMock.from.mockReturnValue(chain({ data: [], error: null }));

    const service = new PermissionService();
    await expect(service.getUserRoles("suspended-user")).rejects.toThrow(
      /no active tenant membership/i,
    );
  });

  it("throws when user_tenants returns null data (unscoped call)", async () => {
    supabaseMock.from.mockReturnValue(chain({ data: null, error: null }));

    const service = new PermissionService();
    await expect(service.getUserRoles("removed-user")).rejects.toThrow(
      /no active tenant membership/i,
    );
  });

  it("returns roles when user has at least one active membership (unscoped call)", async () => {
    const mockRoles = [
      { userId: "active-user", roleId: "role-1", scope: "organization", scopeId: "tenant-1" },
    ];

    let callCount = 0;
    supabaseMock.from.mockImplementation(() => {
      callCount++;
      // First call: getUserTenants (user_tenants table)
      if (callCount === 1) return chain({ data: [{ tenant_id: "tenant-1" }], error: null });
      // Second call: user_roles query
      return chain({ data: mockRoles, error: null });
    });

    const service = new PermissionService();
    const roles = await service.getUserRoles("active-user");
    expect(roles).toEqual(mockRoles);
  });

  it("scoped call still validates tenant access (existing behaviour unchanged)", async () => {
    const mockRoles = [
      { userId: "user-1", roleId: "role-1", scope: "organization", scopeId: "tenant-1" },
    ];

    let callCount = 0;
    supabaseMock.from.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return chain({ data: [{ tenant_id: "tenant-1" }], error: null });
      return chain({ data: mockRoles, error: null });
    });

    const service = new PermissionService();
    const roles = await service.getUserRoles("user-1", "organization", "tenant-1");
    expect(roles).toEqual(mockRoles);
  });
});
