/**
 * Tests for Fix 3: suspended/missing membership blocks permission resolution.
 *
 * rbac.ts now checks user_tenants.status = 'active' before expanding roles.
 * A user with stale user_roles rows but an inactive/missing user_tenants row
 * must be denied.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Shared mocks ────────────────────────────────────────────────────────────

vi.mock("@shared/lib/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  createLogger: () => ({
    debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(),
  }),
}));

vi.mock("@shared/lib/permissions", () => {
  function matchesOne(granted: string, required: string): boolean {
    if (granted === required) return true;
    const [gr, ga] = granted.split(":");
    const [rr] = required.split(":");
    return (gr === rr || gr === "*") && ga === "*";
  }
  function hasPermission(grantedList: string[] | undefined, required: string): boolean {
    return (grantedList ?? []).some((g) => matchesOne(g, required));
  }
  return {
    hasPermission,
    USER_ROLE_PERMISSIONS: { admin: ["users:read"] },
    USER_ROLES: { ADMIN: "admin", MEMBER: "member", VIEWER: "viewer" },
  };
});

// Supabase client factory — replaced per test via mockSupabase()
const supabaseMock = { from: vi.fn() };

vi.mock("../../lib/supabase.js", () => ({
  assertNotTestEnv: vi.fn(),
  createRequestRlsSupabaseClient: vi.fn(() => supabaseMock),
  createServiceRoleSupabaseClient: vi.fn(() => supabaseMock),
  // Named export consumed by modules that import supabase directly
  supabase: { from: vi.fn(() => ({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), insert: vi.fn().mockResolvedValue({ data: null, error: null }), update: vi.fn().mockReturnThis(), delete: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: null, error: null }) })) },
}));

import { requirePermission } from "../rbac.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildReq(userId = "user-1", tenantId = "tenant-1") {
  return {
    user: { id: userId, tenant_id: tenantId },
    tenantId,
    path: "/test",
    method: "GET",
  } as unknown as import("express").Request;
}

function buildRes() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as import("express").Response;
}

/**
 * Wire supabaseMock.from() to return different data per table name.
 * All three queries (user_tenants, user_roles, user_permissions) now fire
 * in a single Promise.all batch, so we dispatch by table name.
 */
function mockSupabase(membershipStatus: "active" | "inactive" | null) {
  supabaseMock.from.mockImplementation((table: string) => {
    if (table === "user_tenants") {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: membershipStatus ? { status: membershipStatus } : null,
          error: null,
        }),
      };
    }
    // user_roles / user_permissions — empty results (inactive users never reach role expansion)
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      then: vi.fn().mockImplementation((resolve: (v: unknown) => unknown) =>
        Promise.resolve(resolve({ data: [], error: null })),
      ),
    };
  });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("requirePermission — membership status gate (Fix 3)", () => {
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    next = vi.fn();
    vi.clearAllMocks();
  });

  it("passes the membership gate for an active user with a matching role", async () => {
    // user_tenants → active; user_roles → admin (has users:read); memberships → null.
    // The full permission check should pass and call next().
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === "user_tenants") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: { status: "active" }, error: null }),
        };
      }
      if (table === "memberships") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve: (v: unknown) => unknown) =>
          Promise.resolve(
            resolve(
              table === "user_roles"
                ? { data: [{ role: "admin" }], error: null }
                : { data: [], error: null },
            ),
          ),
        ),
      };
    });

    const middleware = requirePermission("users:read" as any);
    const req = buildReq();
    const res = buildRes();

    await middleware(req, res, next);

    // Active membership + matching role → access granted.
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalledWith(403);
  });

  it("denies a user with inactive membership (suspended)", async () => {
    mockSupabase("inactive");

    const middleware = requirePermission("users:read" as any);
    const req = buildReq();
    const res = buildRes();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("denies a user with no membership row", async () => {
    mockSupabase(null);

    const middleware = requirePermission("users:read" as any);
    const req = buildReq();
    const res = buildRes();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when no user is attached to the request", async () => {
    const middleware = requirePermission("users:read" as any);
    const req = { path: "/test", method: "GET" } as unknown as import("express").Request;
    const res = buildRes();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 403 when membership status check itself errors", async () => {
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === "user_tenants") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: null,
            error: new Error("DB connection lost"),
          }),
        };
      }
      // Other parallel queries resolve normally — the membership error alone must deny
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        then: vi.fn().mockImplementation((resolve: (v: unknown) => unknown) =>
          Promise.resolve(resolve({ data: [], error: null })),
        ),
      };
    });

    const middleware = requirePermission("users:read" as any);
    const req = buildReq();
    const res = buildRes();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
