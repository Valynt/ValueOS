export interface UserClaims {
  sub: string;
  email: string;
  roles: string[];
  permissions: string[];
  org_id: string;
}

export function computePermissions(roles: string[]): string[] {
  // Full-admin roles: tenant "owner" and RBAC "ROLE_ADMIN".
  // Legacy "ADMIN" string maps to owner-equivalent during transition.
  if (
    roles.includes("owner") ||
    roles.includes("ROLE_ADMIN") ||
    roles.includes("ADMIN")
  ) {
    return ["admin", "read", "write", "delete"];
  }

  // Editor roles: tenant "admin" and RBAC "ROLE_EDITOR".
  if (roles.includes("admin") || roles.includes("ROLE_EDITOR")) {
    return ["read", "write", "delete"];
  }

  // Operator roles: tenant "member" and RBAC "ROLE_OPERATOR".
  // Legacy "ANALYST" maps to member-equivalent during transition.
  if (
    roles.includes("member") ||
    roles.includes("ROLE_OPERATOR") ||
    roles.includes("ANALYST")
  ) {
    return ["read", "write"];
  }

  // Read-only roles: tenant "viewer", RBAC "ROLE_AUDITOR" / "ROLE_VIEWER".
  return ["read"];
}
