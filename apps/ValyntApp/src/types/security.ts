export interface UserClaims {
  sub: string;
  email: string;
  roles: string[];
  permissions: string[];
  org_id: string;
}

/**
 * Normalize role names to a canonical uppercase form.
 *
 * The backend JWT uses lowercase ("admin", "owner") while some auth providers
 * prefix roles with "ROLE_" (e.g. "ROLE_ADMIN"). Normalizing before comparison
 * prevents admins from falling through to read-only permissions.
 */
function normalizeRole(role: string): string {
  return role.replace(/^ROLE_/i, "").toUpperCase();
}

export function computePermissions(roles: string[]): string[] {
  const normalized = roles.map(normalizeRole);
  const permissions: string[] = [];

  if (normalized.includes("OWNER") || normalized.includes("ADMIN")) {
    permissions.push("admin", "read", "write", "delete");
  } else if (normalized.includes("ANALYST") || normalized.includes("MEMBER")) {
    permissions.push("read", "write");
  } else if (normalized.includes("VIEWER")) {
    permissions.push("read");
  } else {
    permissions.push("read");
  }

  return permissions;
}
