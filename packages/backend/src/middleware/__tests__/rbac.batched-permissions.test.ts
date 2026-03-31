/**
 * Tests for Fix 8: requireAnyPermission and requireAllPermissions resolve
 * the user's full permission set in a single logical operation rather than
 * making N sequential hasPermission() calls.
 *
 * Verified by counting supabase.from() invocations: regardless of how many
 * permissions are checked, the DB is queried exactly once per logical batch
 * (3 parallel queries for the initial fetch + at most 2 for the custom role
 * graph — never multiplied by the number of permissions).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@shared/lib/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

vi.mock("@shared/lib/permissions", () => {
  // Real permission matching logic — needed so denial tests work correctly.
  function matchesPermission(granted: string, required: string): boolean {
    if (granted === required) return true;
    const [gr, ga] = granted.split(":");
    const [rr] = required.split(":");
    if (gr !== rr && gr !== "*") return false;
    return ga === "*";
  }
  function hasPermission(userPermissions: string[] | undefined, required: string): boolean {
    return (userPermissions ?? []).some((g) => matchesPermission(g, required));
  }
  return {
    hasPermission,
    USER_ROLE_PERMISSIONS: {
      admin: ["users:read", "billing:manage", "team:manage"],
      member: ["users:read"],
      viewer: [],
    },
    USER_ROLES: { ADMIN: "admin", MEMBER: "member", VIEWER: "viewer" },
  };
});

const supabaseMock = { from: vi.fn() };

vi.mock("../../lib/supabase.js", () => ({
  createRequestRlsSupabaseClient: vi.fn(() => supabaseMock),
  createServiceRoleSupabaseClient: vi.fn(() => supabaseMock),
  // Named export consumed by modules that import supabase directly
  supabase: { from: vi.fn(() => ({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), insert: vi.fn().mockResolvedValue({ data: null, error: null }), update: vi.fn().mockReturnThis(), delete: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: null, error: null }) })) },
}));

import { requireAllPermissions, requireAnyPermission } from "../rbac.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildReq(userId = "u1", tenantId = "t1") {
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
 * Wire supabaseMock to return:
 *   user_tenants  → active membership
 *   user_roles    → [{ role: "admin" }]
 *   user_permissions → []
 *   memberships   → null (no custom roles)
 */
function mockActiveAdmin() {
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
    // user_roles → admin; user_permissions → []
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
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("requireAnyPermission — batched resolution (Fix 8)", () => {
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    next = vi.fn();
    vi.clearAllMocks();
    mockActiveAdmin();
  });

  it("calls supabase.from() the same number of times for 1 permission as for 3", async () => {
    // 1-permission check
    const mw1 = requireAnyPermission("users:read" as any);
    await mw1(buildReq(), buildRes(), next);
    const callsFor1 = supabaseMock.from.mock.calls.length;

    vi.clearAllMocks();
    mockActiveAdmin();

    // 3-permission check
    const mw3 = requireAnyPermission(
      "users:read" as any,
      "billing:manage" as any,
      "team:manage" as any,
    );
    await mw3(buildReq(), buildRes(), next);
    const callsFor3 = supabaseMock.from.mock.calls.length;

    // Both should make the same number of DB calls — permissions are evaluated
    // locally after a single resolvePermissions() fetch.
    expect(callsFor1).toBe(callsFor3);
  });

  it("grants access when the user holds at least one of the required permissions", async () => {
    const mw = requireAnyPermission("users:read" as any, "billing:manage" as any);
    const res = buildRes();
    await mw(buildReq(), res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalledWith(403);
  });

  it("denies access when the user holds none of the required permissions", async () => {
    // Override: user_roles returns viewer (no billing:manage)
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
          Promise.resolve(resolve({ data: [], error: null })),
        ),
      };
    });

    const mw = requireAnyPermission("billing:manage" as any);
    const res = buildRes();
    await mw(buildReq(), res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("denies access when membership is inactive regardless of permissions list", async () => {
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === "user_tenants") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: { status: "inactive" }, error: null }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve: (v: unknown) => unknown) =>
          Promise.resolve(resolve({ data: [], error: null })),
        ),
      };
    });

    const mw = requireAnyPermission("users:read" as any, "billing:manage" as any);
    const res = buildRes();
    await mw(buildReq(), res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});

describe("requireAllPermissions — batched resolution (Fix 8)", () => {
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    next = vi.fn();
    vi.clearAllMocks();
    mockActiveAdmin();
  });

  it("calls supabase.from() the same number of times for 1 permission as for 3", async () => {
    const mw1 = requireAllPermissions("users:read" as any);
    await mw1(buildReq(), buildRes(), next);
    const callsFor1 = supabaseMock.from.mock.calls.length;

    vi.clearAllMocks();
    mockActiveAdmin();

    const mw3 = requireAllPermissions(
      "users:read" as any,
      "billing:manage" as any,
      "team:manage" as any,
    );
    await mw3(buildReq(), buildRes(), next);
    const callsFor3 = supabaseMock.from.mock.calls.length;

    expect(callsFor1).toBe(callsFor3);
  });

  it("grants access when the user holds all required permissions", async () => {
    const mw = requireAllPermissions("users:read" as any, "billing:manage" as any);
    const res = buildRes();
    await mw(buildReq(), res, next);
    expect(next).toHaveBeenCalled();
  });

  it("denies access when the user is missing one required permission", async () => {
    // user_roles → viewer (no billing:manage)
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
          Promise.resolve(resolve({ data: [{ role: "viewer" }], error: null })),
        ),
      };
    });

    const mw = requireAllPermissions("users:read" as any, "billing:manage" as any);
    const res = buildRes();
    await mw(buildReq(), res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
