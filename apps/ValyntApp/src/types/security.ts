export interface UserClaims {
  sub: string;
  email: string;
  roles: string[];
  permissions: string[];
  org_id: string;
}

export function computePermissions(roles: string[]): string[] {
  // Simple permission mapping
  const permissions: string[] = [];
  if (roles.includes("ADMIN")) {
    permissions.push("admin", "read", "write", "delete");
  } else if (roles.includes("ANALYST")) {
    permissions.push("read", "write");
  } else {
    permissions.push("read");
  }
  return permissions;
}
