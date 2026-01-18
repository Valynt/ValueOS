import { logger } from "../lib/logger.js";
import { AuthorizationError } from "./errors.js";

export const SecretPermission = {
  READ: "secrets:read" as const,
  LIST: "secrets:list" as const,
  WRITE: "secrets:write" as const,
  ROTATE: "secrets:rotate" as const,
  DELETE: "secrets:delete" as const,
} as const;

export type SecretPermissionType = (typeof SecretPermission)[keyof typeof SecretPermission];

export interface RbacUser {
  id: string;
  roles?: string[];
  permissions?: string[];
  tenantRoles?: Record<string, string[]>;
}

const ROLE_PERMISSIONS: Record<string, SecretPermissionType[]> = {
  ROLE_ADMIN: [
    SecretPermission.READ,
    SecretPermission.LIST,
    SecretPermission.WRITE,
    SecretPermission.ROTATE,
    SecretPermission.DELETE,
  ],
  ROLE_EDITOR: [
    SecretPermission.READ,
    SecretPermission.LIST,
    SecretPermission.WRITE,
    SecretPermission.ROTATE,
  ],
  ROLE_OPERATOR: [SecretPermission.READ, SecretPermission.LIST, SecretPermission.WRITE],
  ROLE_AUDITOR: [SecretPermission.READ, SecretPermission.LIST],
  ROLE_VIEWER: [SecretPermission.READ, SecretPermission.LIST],
};

export class RbacService {
  can(user: RbacUser | undefined, permission: SecretPermissionType, tenantId?: string): boolean {
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

  assertCan(user: RbacUser | undefined, permission: SecretPermissionType, tenantId?: string): void {
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
