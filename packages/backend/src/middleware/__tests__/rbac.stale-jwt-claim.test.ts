/**
 * JWT stale-claim test (Fix 7 / reviewer item).
 *
 * Scenario: a user's role is changed in the DB (e.g. admin → viewer), but
 * their JWT still carries the old role claim. The permission check in rbac.ts
 * must use DB state, not the JWT claim.
 *
 * This is distinct from token revocation (covered in authFallback.test.ts).
 * Token revocation blocks the JWT entirely. Here the JWT is still valid —
 * only the role embedded in it is stale. The system must not honour the
 * stale claim.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@shared/lib/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

vi.mock("@shared/lib/permissions", () => {
  // Real matching logic — required so denial tests work correctly.
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
    USER_ROLE_PERMISSIONS: {
      admin: ["billing:manage", "users:read", "team:manage"],
      member: ["users:read"],
      viewer: [],
    },
    USER_ROLES: { ADMIN: "admin", MEMBER: "member", VIEWER: "viewer" },
  };
});

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

function buildRes() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as import("express").Response;
}

/**
 * Build a request where the JWT claim says `jwtRole` but the DB has `dbRole`.
 * This simulates a stale JWT in flight after a role change.
 */
function buildReqWithStaleClaim(jwtRole: string) {
  return {
    // JWT claim — set by auth middleware from the token payload.
    user: { id: "user-1", tenant_id: "tenant-1", role: jwtRole },
    tenantId: "tenant-1",
    path: "/test",
    method: "GET",
  } as unknown as import("express").Request;
}

/**
 * Wire supabaseMock to return `dbRole` from user_roles (the DB truth),
 * regardless of what the JWT claim says.
 */
function mockDbRole(dbRole: string | null) {
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
            table === "user_roles" && dbRole
              ? { data: [{ role: dbRole }], error: null }
              : { data: [], error: null },
          ),
        ),
      ),
    };
  });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("rbac — JWT stale-claim isolation (Fix 7)", () => {
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    next = vi.fn();
    vi.clearAllMocks();
  });

  it("denies access when JWT claims admin but DB has viewer", async () => {
    // JWT says admin — would grant billing:manage if the claim were trusted.
    // DB says viewer — no permissions.
    mockDbRole("viewer");

    const mw = requirePermission("billing:manage" as any);
    const req = buildReqWithStaleClaim("admin"); // stale JWT claim
    const res = buildRes();

    await mw(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("denies access when JWT claims admin but DB has no role row (user removed)", async () => {
    // DB has no user_roles row — user was removed from the tenant.
    mockDbRole(null);

    const mw = requirePermission("users:read" as any);
    const req = buildReqWithStaleClaim("admin");
    const res = buildRes();

    await mw(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("grants access when JWT claims viewer but DB has admin (role upgraded)", async () => {
    // Inverse: JWT is behind the DB. The DB is the source of truth in both directions.
    mockDbRole("admin");

    const mw = requirePermission("billing:manage" as any);
    const req = buildReqWithStaleClaim("viewer"); // stale JWT claim (old, lower role)
    const res = buildRes();

    await mw(req, res, next);

    // DB says admin → billing:manage is granted, regardless of the stale JWT.
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalledWith(403);
  });

  it("req.user.role is never read by the permission check", async () => {
    // Verify the middleware does not access req.user.role at all.
    // We use a Proxy to detect any property access on req.user.
    const accessedProps: string[] = [];
    const userProxy = new Proxy(
      { id: "user-1", tenant_id: "tenant-1", role: "admin" },
      {
        get(target, prop) {
          accessedProps.push(String(prop));
          return target[prop as keyof typeof target];
        },
      },
    );

    mockDbRole("viewer");

    const mw = requirePermission("billing:manage" as any);
    const req = {
      user: userProxy,
      tenantId: "tenant-1",
      path: "/test",
      method: "GET",
    } as unknown as import("express").Request;
    const res = buildRes();

    await mw(req, res, next);

    // "role" must not appear in the accessed properties — only "id" and
    // "tenant_id" are needed to identify the user for the DB query.
    expect(accessedProps).not.toContain("role");
  });
});
