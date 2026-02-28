import { logger } from "../lib/logger";

import { AuthorizationError } from "./errors";

export type Permission = SecretPermission | TeamPermission;

export type TeamPermission =
  | "team:invite"
  | "team:manage_roles"
  | "team:view"
  | "billing:view"
  | "billing:upgrade";

export interface RbacUser {
  id: string;
  roles?: string[];
  permissions?: string[];
  tenantRoles?: Record<string, string[]>;
}

const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  admin: [
    "secrets:read",
    "secrets:list",
    "secrets:write",
    "secrets:rotate",
    "secrets:delete",
    "team:invite",
    "team:manage_roles",
    "team:view",
    "billing:view",
    "billing:upgrade",
  ],
  member: [
    "secrets:read",
    "secrets:list",
    "secrets:write",
    "secrets:rotate",
    "team:view",
    "billing:view",
  ],
  viewer: ["secrets:read", "secrets:list", "team:view", "billing:view"],
};

export class RbacService {
  can(user: RbacUser | undefined, permission: Permission, tenantId?: string): boolean {
    if (!user) {
      return false;
    }

    const effectiveRoles = new Set<string>(user.roles || []);
    const tenantRoles = tenantId ? user.tenantRoles?.[tenantId] : undefined;

    if (tenantRoles) {
      tenantRoles.forEach((role) => effectiveRoles.add(role));
    }

    const effectivePermissions = new Set<string>(user.permissions || []);

    for (const role of effectiveRoles) {
      const rolePermissions = ROLE_PERMISSIONS[role];
      if (rolePermissions) {
        rolePermissions.forEach((p) => effectivePermissions.add(p));
      }
    }

    return effectivePermissions.has(permission);
  }

  assertCan(user: RbacUser | undefined, permission: Permission, tenantId?: string): void {
    if (this.can(user, permission, tenantId)) {
      return;
    }

    logger.warn("RBAC denial for secrets operation", {
      userId: user?.id,
      permission,
      tenantId,
    });

    throw new AuthorizationError(`Forbidden: missing ${permission}`);
  }
}
