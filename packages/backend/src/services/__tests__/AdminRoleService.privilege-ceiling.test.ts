/**
 * Tests for Fix 6: role hierarchy ceiling in AdminRoleService.
 *
 * An actor may only assign permissions they themselves hold.
 * Owners bypass the check. Non-owners attempting to grant permissions
 * above their own level receive a ValidationError.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  supabase: { from: vi.fn() },
  auditLog: { logAudit: vi.fn().mockResolvedValue(undefined) },
  publish: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../lib/supabase", () => ({
  createServerSupabaseClient: () => mocks.supabase,
}));

vi.mock("../../lib/rbacInvalidation", () => ({
  publishRbacInvalidation: mocks.publish,
}));

vi.mock("../security/AuditLogService", () => ({
  auditLogService: mocks.auditLog,
}));

// USER_ROLE_PERMISSIONS: admin has billing:manage; member does not.
vi.mock("@shared/lib/permissions", () => ({
  USER_ROLE_PERMISSIONS: {
    owner: ["billing:manage", "users:read", "team:manage", "admin:manage"],
    admin: ["billing:manage", "users:read", "team:manage"],
    member: ["users:read"],
    viewer: [],
  },
}));

import { AdminRoleService } from "../auth/AdminRoleService.js";

// ValidationError.instanceof is broken because ServiceError calls
// Object.setPrototypeOf(this, ServiceError.prototype), resetting the chain.
// Use error.name checks throughout.
function isValidationError(e: unknown): boolean {
  return e instanceof Error && e.name === "ValidationError";
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const TENANT_ID = "tenant-1";
const ROLE_ID = "role-1";

function actorWithRole(role: string) {
  return { id: `actor-${role}`, email: `${role}@example.com`, name: role };
}

/**
 * Wire supabase.from() for the assertPrivilegeCeiling path.
 *
 * assertPrivilegeCeiling makes two queries:
 *   1. user_tenants — fetch actor's role (for rank check)
 *   2. user_tenants — fetch actor's role again (for permission expansion)
 *
 * Both return the same actor role. Subsequent calls (resolvePermissionIds,
 * upsert) return success.
 */
function mockActorRole(role: string) {
  let call = 0;
  mocks.supabase.from.mockImplementation((table: string) => {
    if (table === "user_tenants") {
      call++;
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { role }, error: null }),
      };
    }
    if (table === "permissions") {
      // resolvePermissionIds — return matching permission IDs
      return {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve: (v: unknown) => unknown) =>
          Promise.resolve(
            resolve({
              data: [
                { key: "billing:manage", id: "perm-billing" },
                { key: "users:read", id: "perm-users" },
                { key: "team:manage", id: "perm-team" },
                { key: "admin:manage", id: "perm-admin" },
              ],
              error: null,
            }),
          ),
        ),
      };
    }
    if (table === "role_permissions") {
      return {
        upsert: vi.fn().mockResolvedValue({ error: null }),
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({ error: null }),
      };
    }
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
  });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("AdminRoleService — privilege ceiling (Fix 6)", () => {
  let service: AdminRoleService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AdminRoleService();
    (service as any).supabase = mocks.supabase;
  });

  describe("assignPermissionsToRole", () => {
    it("allows an admin to assign permissions they hold", async () => {
      mockActorRole("admin");

      await expect(
        service.assignPermissionsToRole(actorWithRole("admin"), {
          tenantId: TENANT_ID,
          roleId: ROLE_ID,
          permissionKeys: ["billing:manage", "users:read"],
        }),
      ).resolves.not.toThrow();
    });

    it("blocks a member from assigning billing:manage (above their level)", async () => {
      mockActorRole("member");

      const err = await service
        .assignPermissionsToRole(actorWithRole("member"), {
          tenantId: TENANT_ID,
          roleId: ROLE_ID,
          permissionKeys: ["billing:manage"],
        })
        .catch((e: unknown) => e);

      expect(isValidationError(err)).toBe(true);
      expect((err as Error).message).toMatch(/exceeding your own privilege/i);
    });

    it("blocks a viewer from assigning any permission", async () => {
      mockActorRole("viewer");

      const err = await service
        .assignPermissionsToRole(actorWithRole("viewer"), {
          tenantId: TENANT_ID,
          roleId: ROLE_ID,
          permissionKeys: ["users:read"],
        })
        .catch((e: unknown) => e);

      expect(isValidationError(err)).toBe(true);
    });

    it("allows an owner to assign any permission including admin:manage", async () => {
      mockActorRole("owner");

      await expect(
        service.assignPermissionsToRole(actorWithRole("owner"), {
          tenantId: TENANT_ID,
          roleId: ROLE_ID,
          permissionKeys: ["admin:manage", "billing:manage"],
        }),
      ).resolves.not.toThrow();
    });

    it("allows assigning an empty permission list (no-op, no ceiling check needed)", async () => {
      mockActorRole("member");

      await expect(
        service.assignPermissionsToRole(actorWithRole("member"), {
          tenantId: TENANT_ID,
          roleId: ROLE_ID,
          permissionKeys: [],
        }),
      ).resolves.not.toThrow();
    });

    it("reports all forbidden permissions in the error message", async () => {
      mockActorRole("member");

      let errorMessage = "";
      try {
        await service.assignPermissionsToRole(actorWithRole("member"), {
          tenantId: TENANT_ID,
          roleId: ROLE_ID,
          permissionKeys: ["billing:manage", "team:manage"],
        });
      } catch (err) {
        errorMessage = (err as Error).message;
      }

      expect(errorMessage).toContain("billing:manage");
      expect(errorMessage).toContain("team:manage");
    });
  });

  describe("createCustomRole (calls assignPermissionsToRole internally)", () => {
    it("blocks a member from creating a role with billing:manage (ceiling propagates)", async () => {
      // createCustomRole first inserts the role, then calls assignPermissionsToRole.
      // Wire the roles insert to succeed, then the ceiling check to fire.
      let call = 0;
      mocks.supabase.from.mockImplementation((table: string) => {
        call++;
        if (table === "roles" && call <= 2) {
          // exists check + insert
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            insert: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { id: "new-role", name: "custom:tenant-1:testrole", description: null, created_at: new Date().toISOString() },
              error: null,
            }),
          };
        }
        if (table === "user_tenants") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: { role: "member" }, error: null }),
          };
        }
        if (table === "permissions") {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            then: vi.fn().mockImplementation((resolve: (v: unknown) => unknown) =>
              Promise.resolve(resolve({ data: [{ key: "billing:manage", id: "perm-billing" }], error: null })),
            ),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      });

      const err = await service
        .createCustomRole(actorWithRole("member"), {
          tenantId: TENANT_ID,
          name: "testrole",
          permissionKeys: ["billing:manage"],
        })
        .catch((e: unknown) => e);

      expect(isValidationError(err)).toBe(true);
      expect((err as Error).message).toMatch(/exceeding your own privilege/i);
    });
  });
});
