export interface UserClaims {
  sub: string;
  email: string;
  roles: string[];
  permissions: string[];
  org_id: string;
}

/**
 * 4-tier permission model (AUTH-R7):
 *
 * Tier     | Roles                              | Permissions
 * ---------|------------------------------------|---------------------------------
 * owner    | owner, ROLE_ADMIN, ADMIN (legacy)  | admin, read, write, delete
 * editor   | admin, ROLE_EDITOR                 | read, write, delete
 * member   | member, ROLE_OPERATOR, ANALYST     | read, write
 * viewer   | viewer, reader, ROLE_AUDITOR,      | read
 *          | ROLE_VIEWER                        |
 *
 * Note: tenant role `admin` ≠ RBAC `ROLE_ADMIN`. Tenant admin is editor-level;
 * ROLE_ADMIN (system admin) is owner-level. The ROLE_ prefix is preserved for
 * lookup to avoid this ambiguity. Legacy all-caps strings (ADMIN, ANALYST) are
 * resolved before falling through to the tenant-role lookup.
 */

type PermTier = "owner" | "editor" | "member" | "viewer";

const PERMISSIONS_BY_TIER: Record<PermTier, readonly string[]> = {
  owner: ["admin", "read", "write", "delete"],
  editor: ["read", "write", "delete"],
  member: ["read", "write"],
  viewer: ["read"],
};

/** RBAC roles (with ROLE_ prefix, matched case-insensitively). */
const RBAC_TIER: Record<string, PermTier> = {
  ROLE_ADMIN: "owner",
  ROLE_EDITOR: "editor",
  ROLE_OPERATOR: "member",
  ROLE_AUDITOR: "viewer",
  ROLE_VIEWER: "viewer",
};

/** Legacy all-caps role aliases used before ROLE_ prefix was adopted. */
const LEGACY_TIER: Record<string, PermTier> = {
  ADMIN: "owner",
  ANALYST: "member",
};

/** Tenant roles as issued by AdminUserService / useAdminPermissions. */
const TENANT_TIER: Record<string, PermTier> = {
  owner: "owner",
  admin: "editor", // tenant admin = editor-level (no system admin flag)
  member: "member",
  editor: "editor", // bare "editor" alias
  analyst: "member",
  viewer: "viewer",
  reader: "viewer",
};

function roleTier(role: string): PermTier | null {
  const trimmed = role.trim();

  // 1. RBAC roles: must start with ROLE_ (preserved case-insensitively)
  if (/^ROLE_/i.test(trimmed)) {
    return RBAC_TIER[trimmed.toUpperCase()] ?? null;
  }

  // 2. Legacy uppercase aliases (before ROLE_ prefix was standardised)
  //    Only exact uppercase strings reach here (e.g. "ADMIN", not "admin").
  if (trimmed === trimmed.toUpperCase() && trimmed.length > 0) {
    const legacy = LEGACY_TIER[trimmed];
    if (legacy) return legacy;
  }

  // 3. Tenant roles (lowercase match)
  return TENANT_TIER[trimmed.toLowerCase()] ?? null;
}

export function computePermissions(roles: string[]): string[] {
  const permissions = new Set<string>();

  for (const role of roles) {
    const tier = roleTier(role);
    if (tier === null) continue;
    for (const perm of PERMISSIONS_BY_TIER[tier]) {
      permissions.add(perm);
    }
  }

  return Array.from(permissions);
}
