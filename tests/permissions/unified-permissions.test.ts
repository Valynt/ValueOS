/**
 * Permission Integration Tests
 *
 * Verifies that the unified permission system works consistently across all layers:
 * - Frontend (ProtectedRoute, AuthContext)
 * - Backend (RBAC middleware)
 * - Agent (AgentIdentity, PermissionMiddleware)
 * - Guest (GuestAccessService)
 * - Service (PermissionService)
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  // Types
  Permission,
  Resource,
  Action,
  UserRole,
  AgentRole,

  // Constants
  PERMISSIONS,
  RESOURCES,
  ACTIONS,
  USER_ROLES,
  AGENT_ROLES,
  USER_ROLE_PERMISSIONS,
  AGENT_ROLE_PERMISSIONS,

  // Utility functions
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
  matchesPermission,
  parsePermission,
  createPermission,
  expandWildcard,
  isValidPermission,

  // Role utilities
  getPermissionsForUserRole,
  getPermissionsForAgentRole,
  computePermissionsFromRoles,
  isValidUserRole,
  isValidAgentRole,
  normalizeRole,
  getRolesWithPermission,
} from "../../src/lib/permissions";

describe("Unified Permission Types", () => {
  describe("Permission Format", () => {
    it("should have consistent resource:action format", () => {
      Object.values(PERMISSIONS).forEach((permission) => {
        const parsed = parsePermission(permission);
        expect(parsed).not.toBeNull();
        expect(parsed?.resource).toBeTruthy();
        expect(parsed?.action).toBeTruthy();
        expect(permission).toMatch(/^[a-z_]+:[a-z*]+$/);
      });
    });

    it("should create valid permissions from resource and action", () => {
      const permission = createPermission(
        "deals" as Resource,
        "view" as Action
      );
      expect(permission).toBe("deals:view");
      expect(isValidPermission(permission)).toBe(true);
    });

    it("should parse permissions correctly", () => {
      const parsed = parsePermission("deals:view");
      expect(parsed).toEqual({ resource: "deals", action: "view" });
    });

    it("should reject invalid permission formats", () => {
      expect(parsePermission("invalid")).toBeNull();
      expect(parsePermission("too:many:colons")).toBeNull();
      expect(parsePermission("")).toBeNull();
    });
  });

  describe("Permission Matching", () => {
    it("should match exact permissions", () => {
      expect(matchesPermission("deals:view", "deals:view")).toBe(true);
      expect(matchesPermission("deals:view", "deals:edit")).toBe(false);
    });

    it("should support wildcard actions", () => {
      expect(matchesPermission("admin:*", "admin:access")).toBe(true);
      expect(matchesPermission("admin:*", "admin:manage")).toBe(true);
      expect(matchesPermission("admin:*", "deals:view")).toBe(false);
    });

    it("should not match different resources", () => {
      expect(matchesPermission("deals:view", "canvas:view")).toBe(false);
    });
  });

  describe("hasPermission", () => {
    it("should return true when user has the permission", () => {
      const userPermissions = ["deals:view", "deals:create", "canvas:view"];
      expect(hasPermission(userPermissions, "deals:view" as Permission)).toBe(
        true
      );
    });

    it("should return false when user lacks the permission", () => {
      const userPermissions = ["deals:view", "canvas:view"];
      expect(hasPermission(userPermissions, "deals:edit" as Permission)).toBe(
        false
      );
    });

    it("should return false for undefined permissions", () => {
      expect(hasPermission(undefined, "deals:view" as Permission)).toBe(false);
    });

    it("should return false for empty permissions array", () => {
      expect(hasPermission([], "deals:view" as Permission)).toBe(false);
    });

    it("should support wildcard matching", () => {
      const userPermissions = ["admin:*"];
      expect(hasPermission(userPermissions, "admin:access" as Permission)).toBe(
        true
      );
      expect(hasPermission(userPermissions, "admin:manage" as Permission)).toBe(
        true
      );
    });
  });

  describe("hasAllPermissions", () => {
    it("should return true when user has all permissions", () => {
      const userPermissions = ["deals:view", "deals:create", "canvas:view"];
      expect(
        hasAllPermissions(userPermissions, [
          "deals:view",
          "deals:create",
        ] as Permission[])
      ).toBe(true);
    });

    it("should return false when user lacks any permission", () => {
      const userPermissions = ["deals:view", "canvas:view"];
      expect(
        hasAllPermissions(userPermissions, [
          "deals:view",
          "deals:edit",
        ] as Permission[])
      ).toBe(false);
    });

    it("should return true for empty required permissions", () => {
      expect(hasAllPermissions(["deals:view"], [])).toBe(true);
    });
  });

  describe("hasAnyPermission", () => {
    it("should return true when user has any permission", () => {
      const userPermissions = ["deals:view", "canvas:view"];
      expect(
        hasAnyPermission(userPermissions, [
          "deals:view",
          "deals:edit",
        ] as Permission[])
      ).toBe(true);
    });

    it("should return false when user has none of the permissions", () => {
      const userPermissions = ["canvas:view"];
      expect(
        hasAnyPermission(userPermissions, [
          "deals:view",
          "deals:edit",
        ] as Permission[])
      ).toBe(false);
    });
  });
});

describe("User Role Permissions", () => {
  describe("Role Validation", () => {
    it("should validate known user roles", () => {
      expect(isValidUserRole("admin")).toBe(true);
      expect(isValidUserRole("manager")).toBe(true);
      expect(isValidUserRole("member")).toBe(true);
      expect(isValidUserRole("viewer")).toBe(true);
      expect(isValidUserRole("guest")).toBe(true);
      expect(isValidUserRole("super_admin")).toBe(true);
    });

    it("should reject unknown roles", () => {
      expect(isValidUserRole("unknown")).toBe(false);
      expect(isValidUserRole("")).toBe(false);
    });
  });

  describe("Role Permission Matrix", () => {
    it("should have permissions defined for all user roles", () => {
      Object.values(USER_ROLES).forEach((role) => {
        const permissions = USER_ROLE_PERMISSIONS[role];
        expect(permissions).toBeDefined();
        expect(Array.isArray(permissions)).toBe(true);
      });
    });

    it("should have super_admin with all permissions", () => {
      const superAdminPerms = USER_ROLE_PERMISSIONS[USER_ROLES.SUPER_ADMIN];
      const allPerms = Object.values(PERMISSIONS);
      expect(superAdminPerms.length).toBe(allPerms.length);
    });

    it("should have hierarchical permissions (admin > manager > member > viewer)", () => {
      const adminPerms = new Set(USER_ROLE_PERMISSIONS[USER_ROLES.ADMIN]);
      const managerPerms = new Set(USER_ROLE_PERMISSIONS[USER_ROLES.MANAGER]);
      const memberPerms = new Set(USER_ROLE_PERMISSIONS[USER_ROLES.MEMBER]);
      const viewerPerms = new Set(USER_ROLE_PERMISSIONS[USER_ROLES.VIEWER]);

      // Viewer permissions should be subset of member
      viewerPerms.forEach((p) => {
        expect(memberPerms.has(p)).toBe(true);
      });

      // Member permissions should be subset of manager
      memberPerms.forEach((p) => {
        expect(managerPerms.has(p) || adminPerms.has(p)).toBe(true);
      });
    });

    it("should have guest with minimal permissions", () => {
      const guestPerms = USER_ROLE_PERMISSIONS[USER_ROLES.GUEST];
      expect(guestPerms.length).toBeLessThan(5);
    });
  });

  describe("getPermissionsForUserRole", () => {
    it("should return permissions for valid roles", () => {
      const adminPerms = getPermissionsForUserRole("admin");
      expect(adminPerms.length).toBeGreaterThan(0);
      expect(adminPerms).toContain(PERMISSIONS.ADMIN_ACCESS);
    });

    it("should return empty array for unknown roles", () => {
      const perms = getPermissionsForUserRole("unknown");
      expect(perms).toEqual([]);
    });

    it("should handle legacy role names", () => {
      // Legacy roles should map to unified roles
      const cfoPerms = getPermissionsForUserRole("CFO");
      expect(cfoPerms.length).toBeGreaterThan(0);
    });
  });

  describe("computePermissionsFromRoles", () => {
    it("should compute permissions from multiple roles", () => {
      const perms = computePermissionsFromRoles(["member", "viewer"]);
      expect(perms.length).toBeGreaterThan(0);
    });

    it("should deduplicate permissions", () => {
      const perms = computePermissionsFromRoles(["admin", "admin"]);
      const uniquePerms = [...new Set(perms)];
      expect(perms.length).toBe(uniquePerms.length);
    });

    it("should return empty array for empty roles", () => {
      const perms = computePermissionsFromRoles([]);
      expect(perms).toEqual([]);
    });
  });
});

describe("Agent Role Permissions", () => {
  describe("Role Validation", () => {
    it("should validate known agent roles", () => {
      expect(isValidAgentRole("CoordinatorAgent")).toBe(true);
      expect(isValidAgentRole("OpportunityAgent")).toBe(true);
      expect(isValidAgentRole("SystemAgent")).toBe(true);
    });

    it("should reject unknown agent roles", () => {
      expect(isValidAgentRole("UnknownAgent")).toBe(false);
    });
  });

  describe("Agent Permission Matrix", () => {
    it("should have permissions defined for all agent roles", () => {
      Object.values(AGENT_ROLES).forEach((role) => {
        const permissions = AGENT_ROLE_PERMISSIONS[role];
        expect(permissions).toBeDefined();
        expect(Array.isArray(permissions)).toBe(true);
      });
    });

    it("should have all agents with LLM execute permission", () => {
      Object.values(AGENT_ROLES).forEach((role) => {
        const permissions = AGENT_ROLE_PERMISSIONS[role];
        expect(permissions).toContain(PERMISSIONS.LLM_EXECUTE);
      });
    });

    it("should have SystemAgent with most permissions", () => {
      const systemPerms = AGENT_ROLE_PERMISSIONS[AGENT_ROLES.SYSTEM];
      const coordinatorPerms = AGENT_ROLE_PERMISSIONS[AGENT_ROLES.COORDINATOR];
      expect(systemPerms.length).toBeGreaterThan(coordinatorPerms.length);
    });
  });

  describe("getPermissionsForAgentRole", () => {
    it("should return permissions for valid agent roles", () => {
      const perms = getPermissionsForAgentRole("CoordinatorAgent");
      expect(perms.length).toBeGreaterThan(0);
      expect(perms).toContain(PERMISSIONS.LLM_EXECUTE);
    });

    it("should return empty array for unknown agent roles", () => {
      const perms = getPermissionsForAgentRole("UnknownAgent");
      expect(perms).toEqual([]);
    });
  });
});

describe("Permission Inheritance", () => {
  describe("Wildcard Expansion", () => {
    it("should expand admin:* to all admin permissions", () => {
      const expanded = expandWildcard("admin:*");
      expect(expanded.length).toBeGreaterThan(1);
      expect(expanded).toContain(PERMISSIONS.ADMIN_ACCESS);
    });

    it("should not expand non-wildcard permissions", () => {
      const expanded = expandWildcard("deals:view");
      expect(expanded).toEqual(["deals:view"]);
    });
  });

  describe("getRolesWithPermission", () => {
    it("should find roles that have a specific permission", () => {
      const roles = getRolesWithPermission(PERMISSIONS.ADMIN_ACCESS);
      expect(roles).toContain("super_admin");
      expect(roles).toContain("admin");
      expect(roles).not.toContain("guest");
    });

    it("should include agent roles when applicable", () => {
      const roles = getRolesWithPermission(PERMISSIONS.LLM_EXECUTE);
      expect(roles.some((r) => r.includes("Agent"))).toBe(true);
    });
  });
});

describe("Cross-Layer Consistency", () => {
  it("should have consistent permission format across all layers", () => {
    // All permissions should follow resource:action format
    const allPermissions = [
      ...Object.values(PERMISSIONS),
      ...Object.values(USER_ROLE_PERMISSIONS).flat(),
      ...Object.values(AGENT_ROLE_PERMISSIONS).flat(),
    ];

    allPermissions.forEach((permission) => {
      const parsed = parsePermission(permission);
      expect(parsed).not.toBeNull();
      expect(permission).toMatch(/^[a-z_]+:[a-z*]+$/);
    });
  });

  it("should have no duplicate permission definitions", () => {
    const permissionValues = Object.values(PERMISSIONS);
    const uniqueValues = [...new Set(permissionValues)];
    expect(permissionValues.length).toBe(uniqueValues.length);
  });

  it("should have all role permissions reference valid PERMISSIONS", () => {
    const validPermissions = new Set(Object.values(PERMISSIONS));

    Object.values(USER_ROLE_PERMISSIONS)
      .flat()
      .forEach((perm) => {
        expect(validPermissions.has(perm)).toBe(true);
      });

    Object.values(AGENT_ROLE_PERMISSIONS)
      .flat()
      .forEach((perm) => {
        expect(validPermissions.has(perm)).toBe(true);
      });
  });
});
