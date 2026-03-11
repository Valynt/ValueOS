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

vi.mock("@shared/lib/permissions", () => ({
  hasPermission: vi.fn().mockReturnValue(true),
  USER_ROLE_PERMISSIONS: { admin: ["users:read"] },
  USER_ROLES: { ADMIN: "admin", MEMBER: "member", VIEWER: "viewer" },
}));

// Supabase client factory — replaced per test via mockSupabase()
const supabaseMock = { from: vi.fn() };

vi.mock("@shared/lib/supabase", () => ({
  getRequestSupabaseClient: vi.fn(() => supabaseMock),
  createServerSupabaseClient: vi.fn(() => supabaseMock),
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

  it("passes the membership gate for an active user (proceeds to role expansion)", async () => {
    // All three queries fire in parallel. user_tenants → active; user_roles and
    // user_permissions → empty, so permission expansion returns false and we get
    // a 403 from the RBAC check — NOT from the membership gate.
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === "user_tenants") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: { status: "active" }, error: null }),
        };
      }
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

    // The membership gate passed (no early 403 with "inactive" message).
    // The final 403 comes from the RBAC permission check (no matching role).
    expect(res.status).toHaveBeenCalledWith(403);
    const jsonArg = (res.json as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as Record<string, string>;
    // Must be the RBAC denial message, not the membership gate message
    expect(jsonArg?.message).toMatch(/Permission denied/i);
    expect(jsonArg?.message).not.toMatch(/inactive/i);
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
