export interface UserClaims {
  sub: string;
  email: string;
  roles: string[];
  permissions: string[];
  org_id: string;
}

// Role hierarchy matches the backend model in packages/shared/src/lib/permissions/roles.js.
// Canonical values: "admin" | "member" | "viewer"
// Legacy aliases handled: "owner" → admin, "editor" → member, "reader" → viewer, "ADMIN" → admin, "ANALYST" → member
const LEGACY_ROLE_MAP: Record<string, string> = {
  owner: "admin",
  editor: "member",
  reader: "viewer",
  // Legacy uppercase variants from old frontend code
  ADMIN: "admin",
  ANALYST: "member",
  VIEWER: "viewer",
};

function normalizeRole(role: string): string {
  return LEGACY_ROLE_MAP[role] ?? role;
}

export function computePermissions(roles: string[]): string[] {
  const normalized = roles.map(normalizeRole);
  const permissions = new Set<string>();

  // admin inherits all permissions
  if (normalized.includes("admin")) {
    permissions.add("admin");
    permissions.add("read");
    permissions.add("write");
    permissions.add("delete");
  } else if (normalized.includes("member")) {
    permissions.add("read");
    permissions.add("write");
  } else {
    // viewer or unknown — read-only
    permissions.add("read");
  }

  return Array.from(permissions);
}
