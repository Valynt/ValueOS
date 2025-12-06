/**
 * Permission Service
 * Role-based access control and permission checking
 */

import { logger } from '../lib/logger';
import { TenantAwareService } from './TenantAwareService';
import { AuthorizationError, NotFoundError } from './errors';

export type Permission =
  | 'user.view'
  | 'user.edit'
  | 'team.view'
  | 'team.manage'
  | 'organization.manage'
  | 'members.manage'
  | 'billing.view'
  | 'billing.manage'
  | 'security.manage'
  | 'audit.view';

export interface Role {
  id: string;
  name: string;
  permissions: Permission[];
  isSystem: boolean;
}

export interface UserRole {
  userId: string;
  roleId: string;
  scope: 'user' | 'team' | 'organization';
  scopeId: string;
}

export class PermissionService extends TenantAwareService {
  private roleCache: Map<string, Role> = new Map();

  constructor() {
    super('PermissionService');
  }

  private async ensureTenantScopeAccess(
    scope: 'user' | 'team' | 'organization',
    scopeId: string,
    userId: string
  ): Promise<void> {
    if (scope === 'organization') {
      await this.validateTenantAccess(userId, scopeId);
    }
  }

  /**
   * Check if user has permission
   */
  async hasPermission(
    userId: string,
    permission: Permission,
    scope: 'user' | 'team' | 'organization',
    scopeId: string
  ): Promise<boolean> {
    this.log('debug', 'Checking permission', { userId, permission, scope, scopeId });

    await this.ensureTenantScopeAccess(scope, scopeId, userId);

    return this.executeRequest(
      async () => {
        const roles = await this.getUserRoles(userId, scope, scopeId);

        for (const role of roles) {
          const roleDetails = await this.getRole(role.roleId);
          if (roleDetails.permissions.includes(permission)) {
            return true;
          }
        }

        return false;
      },
      {
        deduplicationKey: `has-permission-${userId}-${permission}-${scope}-${scopeId}`,
      }
    );
  }

  /**
   * Check multiple permissions (requires ALL)
   */
  async hasAllPermissions(
    userId: string,
    permissions: Permission[],
    scope: 'user' | 'team' | 'organization',
    scopeId: string
  ): Promise<boolean> {
    await this.ensureTenantScopeAccess(scope, scopeId, userId);

    const checks = await Promise.all(
      permissions.map((p) => this.hasPermission(userId, p, scope, scopeId))
    );

    return checks.every((result) => result === true);
  }

  /**
   * Check if user has ANY of the permissions
   */
  async hasAnyPermission(
    userId: string,
    permissions: Permission[],
    scope: 'user' | 'team' | 'organization',
    scopeId: string
  ): Promise<boolean> {
    await this.ensureTenantScopeAccess(scope, scopeId, userId);

    const checks = await Promise.all(
      permissions.map((p) => this.hasPermission(userId, p, scope, scopeId))
    );

    return checks.some((result) => result === true);
  }

  /**
   * Require permission (throws if not authorized)
   */
  async requirePermission(
    userId: string,
    permission: Permission,
    scope: 'user' | 'team' | 'organization',
    scopeId: string
  ): Promise<void> {
    await this.ensureTenantScopeAccess(scope, scopeId, userId);

    const hasPermission = await this.hasPermission(userId, permission, scope, scopeId);

    if (!hasPermission) {
      throw new AuthorizationError(`Missing required permission: ${permission}`);
    }
  }

  /**
   * Get user roles
   */
  async getUserRoles(
    userId: string,
    scope?: 'user' | 'team' | 'organization',
    scopeId?: string
  ): Promise<UserRole[]> {
    if (scope && scopeId) {
      await this.ensureTenantScopeAccess(scope, scopeId, userId);
    }

    return this.executeRequest(
      async () => {
        let query = this.supabase
          .from('user_roles')
          .select('*')
          .eq('user_id', userId);

        if (scope) {
          query = query.eq('scope', scope);
        }

        if (scopeId) {
          query = query.eq('scope_id', scopeId);
        }

        const { data, error } = await query;

        if (error) throw error;
        return data || [];
      },
      {
        deduplicationKey: `user-roles-${userId}-${scope}-${scopeId}`,
      }
    );
  }

  /**
   * Get role details
   */
  async getRole(roleId: string): Promise<Role> {
    if (this.roleCache.has(roleId)) {
      return this.roleCache.get(roleId)!;
    }

    return this.executeRequest(
      async () => {
        const { data, error } = await this.supabase
          .from('roles')
          .select('*')
          .eq('id', roleId)
          .single();

        if (error) throw error;
        if (!data) throw new NotFoundError('Role');

        this.roleCache.set(roleId, data);
        return data;
      },
      {
        deduplicationKey: `role-${roleId}`,
      }
    );
  }

  /**
   * Assign role to user
   */
  async assignRole(
    userId: string,
    roleId: string,
    scope: 'user' | 'team' | 'organization',
    scopeId: string
  ): Promise<UserRole> {
    this.log('info', 'Assigning role', { userId, roleId, scope, scopeId });

    await this.ensureTenantScopeAccess(scope, scopeId, userId);

    return this.executeRequest(
      async () => {
        const { data, error } = await this.supabase
          .from('user_roles')
          .insert({
            user_id: userId,
            role_id: roleId,
            scope,
            scope_id: scopeId,
          })
          .select()
          .single();

        if (error) throw error;

        this.clearCache(`user-roles-${userId}`);
        this.clearCache();

        return data;
      },
      { skipCache: true }
    );
  }

  /**
   * Remove role from user
   */
  async removeRole(
    userId: string,
    roleId: string,
    scope: 'user' | 'team' | 'organization',
    scopeId: string
  ): Promise<void> {
    this.log('info', 'Removing role', { userId, roleId, scope, scopeId });

    await this.ensureTenantScopeAccess(scope, scopeId, userId);

    return this.executeRequest(
      async () => {
        const { error } = await this.supabase
          .from('user_roles')
          .delete()
          .eq('user_id', userId)
          .eq('role_id', roleId)
          .eq('scope', scope)
          .eq('scope_id', scopeId);

        if (error) throw error;

        this.clearCache(`user-roles-${userId}`);
        this.clearCache();
      },
      { skipCache: true }
    );
  }

  /**
   * Get all available permissions
   */
  getAvailablePermissions(): Permission[] {
    return [
      'user.view',
      'user.edit',
      'team.view',
      'team.manage',
      'organization.manage',
      'members.manage',
      'billing.view',
      'billing.manage',
      'security.manage',
      'audit.view',
    ];
  }
}

export const permissionService = new PermissionService();
