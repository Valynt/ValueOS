import { logger } from '../lib/logger';
import { AuthorizationError } from './errors';

export type SecretPermission =
  | 'secrets:read'
  | 'secrets:list'
  | 'secrets:write'
  | 'secrets:rotate'
  | 'secrets:delete';

export interface RbacUser {
  id: string;
  roles?: string[];
  permissions?: string[];
  tenantRoles?: Record<string, string[]>;
}

const ROLE_PERMISSIONS: Record<string, SecretPermission[]> = {
  ROLE_ADMIN: ['secrets:read', 'secrets:list', 'secrets:write', 'secrets:rotate', 'secrets:delete'],
  ROLE_EDITOR: ['secrets:read', 'secrets:list', 'secrets:write', 'secrets:rotate'],
  ROLE_OPERATOR: ['secrets:read', 'secrets:list', 'secrets:write'],
  ROLE_AUDITOR: ['secrets:read', 'secrets:list'],
  ROLE_VIEWER: ['secrets:read', 'secrets:list'],
};

export class RbacService {
  can(user: RbacUser | undefined, permission: SecretPermission, tenantId?: string): boolean {
    if (!user) {
      return false;
    }

    const effectiveRoles = new Set<string>(user.roles || []);
    const tenantRoles = tenantId ? user.tenantRoles?.[tenantId] : undefined;

    if (tenantRoles) {
      tenantRoles.forEach(role => effectiveRoles.add(role));
    }

    const effectivePermissions = new Set<string>(user.permissions || []);

    for (const role of effectiveRoles) {
      const rolePermissions = ROLE_PERMISSIONS[role];
      if (rolePermissions) {
        rolePermissions.forEach(p => effectivePermissions.add(p));
      }
    }

    return effectivePermissions.has(permission);
  }

  assertCan(user: RbacUser | undefined, permission: SecretPermission, tenantId?: string): void {
    if (this.can(user, permission, tenantId)) {
      return;
    }

    logger.warn('RBAC denial for secrets operation', {
      userId: user?.id,
      permission,
      tenantId,
    });

    throw new AuthorizationError(`Forbidden: missing ${permission}`);
  }
}
