/**
 * P0 Security: Tenant Verification
 *
 * Verifies fail-closed behavior, cross-tenant blocking, and error handling
 * for the tenant verification utilities.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Module-level mock — hoisted before imports resolve
vi.mock("../lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

import { supabase } from "../lib/supabase";
import {
  assertTenantMembership,
  getUserTenantId,
  TenantSecurityError,
  verifyTenantExists,
  verifyTenantMembership,
} from "../lib/tenantVerification";

// Helper: build a chainable supabase query stub that resolves to `response`
function makeQueryStub(response: { data: unknown; error: unknown }) {
  const single = vi.fn().mockResolvedValue(response);
  const eq = vi.fn().mockReturnValue({ single });
  const select = vi.fn().mockReturnValue({ eq });
  return { select, eq, single };
}

const fromMock = vi.mocked(supabase.from);

afterEach(() => {
  vi.clearAllMocks();
});

describe("verifyTenantMembership", () => {
  it("returns true when user belongs to tenant", async () => {
    fromMock.mockReturnValue(
      makeQueryStub({ data: { organization_id: "org-1" }, error: null }) as ReturnType<typeof supabase.from>
    );
    expect(await verifyTenantMembership("user-1", "org-1")).toBe(true);
  });

  it("returns false when user belongs to a different tenant", async () => {
    fromMock.mockReturnValue(
      makeQueryStub({ data: { organization_id: "org-2" }, error: null }) as ReturnType<typeof supabase.from>
    );
    expect(await verifyTenantMembership("user-1", "org-1")).toBe(false);
  });

  it("returns false on database error (fail closed)", async () => {
    fromMock.mockReturnValue(
      makeQueryStub({ data: null, error: { message: "DB error", code: "DB_ERROR" } }) as ReturnType<typeof supabase.from>
    );
    expect(await verifyTenantMembership("user-1", "org-1")).toBe(false);
  });

  it("returns false when user not found", async () => {
    fromMock.mockReturnValue(
      makeQueryStub({ data: null, error: null }) as ReturnType<typeof supabase.from>
    );
    expect(await verifyTenantMembership("ghost", "org-1")).toBe(false);
  });

  it("returns false when supabase.from throws", async () => {
    fromMock.mockImplementation(() => {
      throw new Error("Connection refused");
    });
    expect(await verifyTenantMembership("user-1", "org-1")).toBe(false);
  });
});

describe("assertTenantMembership", () => {
  it("resolves without throwing when user belongs to tenant", async () => {
    fromMock.mockReturnValue(
      makeQueryStub({ data: { organization_id: "org-1" }, error: null }) as ReturnType<typeof supabase.from>
    );
    await expect(assertTenantMembership("user-1", "org-1")).resolves.toBeUndefined();
  });

  it("throws TenantSecurityError when user does not belong to tenant", async () => {
    fromMock.mockReturnValue(
      makeQueryStub({ data: { organization_id: "org-2" }, error: null }) as ReturnType<typeof supabase.from>
    );
    await expect(assertTenantMembership("user-1", "org-1")).rejects.toThrow(
      TenantSecurityError
    );
  });

  it("TenantSecurityError carries userId and tenantId", async () => {
    fromMock.mockReturnValue(
      makeQueryStub({ data: null, error: null }) as ReturnType<typeof supabase.from>
    );
    try {
      await assertTenantMembership("user-1", "org-1");
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(TenantSecurityError);
      const e = err as TenantSecurityError;
      expect(e.userId).toBe("user-1");
      expect(e.tenantId).toBe("org-1");
    }
  });
});

describe("getUserTenantId", () => {
  it("returns the organization_id for a valid user", async () => {
    fromMock.mockReturnValue(
      makeQueryStub({ data: { organization_id: "org-1" }, error: null }) as ReturnType<typeof supabase.from>
    );
    expect(await getUserTenantId("user-1")).toBe("org-1");
  });

  it("returns null when user not found", async () => {
    fromMock.mockReturnValue(
      makeQueryStub({ data: null, error: { message: "Not found", code: "PGRST116" } }) as ReturnType<typeof supabase.from>
    );
    expect(await getUserTenantId("ghost")).toBeNull();
  });

  it("returns null on database error", async () => {
    fromMock.mockReturnValue(
      makeQueryStub({ data: null, error: { message: "DB error" } }) as ReturnType<typeof supabase.from>
    );
    expect(await getUserTenantId("user-1")).toBeNull();
  });
});

describe("verifyTenantExists", () => {
  it("returns true for an active tenant", async () => {
    fromMock.mockReturnValue(
      makeQueryStub({ data: { id: "org-1", status: "active" }, error: null }) as ReturnType<typeof supabase.from>
    );
    expect(await verifyTenantExists("org-1")).toBe(true);
  });

  it("returns false for a suspended tenant", async () => {
    fromMock.mockReturnValue(
      makeQueryStub({ data: { id: "org-1", status: "suspended" }, error: null }) as ReturnType<typeof supabase.from>
    );
    expect(await verifyTenantExists("org-1")).toBe(false);
  });

  it("returns false when tenant not found", async () => {
    fromMock.mockReturnValue(
      makeQueryStub({ data: null, error: { message: "Not found", code: "PGRST116" } }) as ReturnType<typeof supabase.from>
    );
    expect(await verifyTenantExists("ghost-org")).toBe(false);
  });
});

describe("Cross-tenant access prevention", () => {
  it("blocks access when user belongs to a different tenant", async () => {
    fromMock.mockReturnValue(
      makeQueryStub({ data: { organization_id: "tenant-a" }, error: null }) as ReturnType<typeof supabase.from>
    );
    expect(await verifyTenantMembership("user-1", "tenant-b")).toBe(false);
  });

  it("allows access when user belongs to the requested tenant", async () => {
    fromMock.mockReturnValue(
      makeQueryStub({ data: { organization_id: "tenant-a" }, error: null }) as ReturnType<typeof supabase.from>
    );
    expect(await verifyTenantMembership("user-1", "tenant-a")).toBe(true);
  });
});

describe("Fail-closed behavior", () => {
  it("denies access on any thrown error", async () => {
    fromMock.mockImplementation(() => {
      throw new Error("Database connection failed");
    });
    expect(await verifyTenantMembership("user-1", "org-1")).toBe(false);
  });

  it("denies access when query times out (race)", async () => {
    const single = vi.fn().mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ data: { organization_id: "org-1" }, error: null }), 10_000))
    );
    const eq = vi.fn().mockReturnValue({ single });
    const select = vi.fn().mockReturnValue({ eq });
    fromMock.mockReturnValue({ select } as ReturnType<typeof supabase.from>);

    const result = await Promise.race([
      verifyTenantMembership("user-1", "org-1"),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 500)),
    ]);
    expect(result).toBe(false);
  });
});
