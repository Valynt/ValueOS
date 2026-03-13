export interface UserClaims {
  sub: string;
  email: string;
  roles: string[];
  permissions: string[];
  org_id: string;
}

// Backend canonical roles: "admin" | "member" | "viewer"
// Legacy aliases handled:
// - "owner"  -> "admin"
// - "editor" -> "member"
// - "reader" -> "viewer"
// Also supports auth-provider variants like "ROLE_ADMIN".
const ROLE_MAP: Record<string, string> = {
  admin: "admin",
  owner: "admin",

  member: "member",
  editor: "member",
  analyst: "member",

  viewer: "viewer",
  reader: "viewer",
};

function normalizeRole(role: string): string {
  const normalized = role.replace(/^ROLE_/i, "").trim().toLowerCase();
  return ROLE_MAP[normalized] ?? normalized;
}

export function computePermissions(roles: string[]): string[] {
  const normalized = roles.map(normalizeRole);
  const permissions = new Set<string>();

  if (normalized.includes("admin")) {
    permissions.add("admin");
    permissions.add("read");
    permissions.add("write");
    permissions.add("delete");
  } else if (normalized.includes("member")) {
    permissions.add("read");
    permissions.add("write");
  } else {
    // viewer or unknown -> read-only
    permissions.add("read");
  }

  return Array.from(permissions);
}