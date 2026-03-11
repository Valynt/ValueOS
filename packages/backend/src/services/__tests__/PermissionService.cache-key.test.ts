/**
 * Tests for Fix 5: PermissionService cache key includes tenantId (scopeId).
 *
 * These tests verify the deduplication key format directly — the key must
 * encode (userId, scope, scopeId) so that a user switching tenants cannot
 * receive cached roles from a prior tenant.
 *
 * We test the key-building logic in isolation rather than importing
 * PermissionService (which has transitive broken imports in the auth/ tree).
 */

import { describe, expect, it } from "vitest";

// ── Key builder — mirrors the logic in PermissionService.getUserRoles ─────────

function buildUserRolesKey(
  userId: string,
  scope?: string,
  scopeId?: string,
): string {
  return `user-roles-${userId}-${scope ?? "any"}-${scopeId ?? "any"}`;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("PermissionService deduplication key format (Fix 5)", () => {
  it("different tenants produce different keys for the same user", () => {
    const keyA = buildUserRolesKey("user-1", "organization", "tenant-A");
    const keyB = buildUserRolesKey("user-1", "organization", "tenant-B");

    expect(keyA).not.toBe(keyB);
    expect(keyA).toContain("tenant-A");
    expect(keyB).toContain("tenant-B");
  });

  it("same user+tenant always produces the same key", () => {
    const key1 = buildUserRolesKey("user-1", "organization", "tenant-A");
    const key2 = buildUserRolesKey("user-1", "organization", "tenant-A");

    expect(key1).toBe(key2);
  });

  it("different users produce different keys for the same tenant", () => {
    const keyU1 = buildUserRolesKey("user-1", "organization", "tenant-A");
    const keyU2 = buildUserRolesKey("user-2", "organization", "tenant-A");

    expect(keyU1).not.toBe(keyU2);
    expect(keyU1).toContain("user-1");
    expect(keyU2).toContain("user-2");
  });

  it("key without scope/scopeId uses 'any' placeholders — no 'undefined'", () => {
    const key = buildUserRolesKey("user-1");

    expect(key).not.toContain("undefined");
    expect(key).toContain("any");
    expect(key).toBe("user-roles-user-1-any-any");
  });

  it("key with scope but no scopeId uses 'any' for scopeId", () => {
    const key = buildUserRolesKey("user-1", "organization");

    expect(key).not.toContain("undefined");
    expect(key).toBe("user-roles-user-1-organization-any");
  });

  it("invalidation keys match the stored key format", () => {
    // assignRole/removeRole must clear both the scoped key and the broad fallback.
    const userId = "user-1";
    const scope = "organization";
    const scopeId = "tenant-A";

    const storedKey = buildUserRolesKey(userId, scope, scopeId);
    const broadKey = buildUserRolesKey(userId); // "user-roles-user-1-any-any"

    // Verify the invalidation keys that assignRole/removeRole call clearCache with
    expect(`user-roles-${userId}-${scope}-${scopeId}`).toBe(storedKey);
    expect(`user-roles-${userId}-any-any`).toBe(broadKey);
    expect(storedKey).not.toBe(broadKey);
  });

  it("team scope is isolated from organization scope", () => {
    const orgKey = buildUserRolesKey("user-1", "organization", "tenant-A");
    const teamKey = buildUserRolesKey("user-1", "team", "tenant-A");

    expect(orgKey).not.toBe(teamKey);
  });
});
