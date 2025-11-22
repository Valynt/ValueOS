/**
 * RBAC Middleware
 * 
 * SEC-201: Role-Based Access Control enforcement
 * 
 * Provides middleware for:
 * - Permission checking
 * - Role-based access
 * - Resource-level authorization
 * - Tenant isolation
 */

import { Request, Response, NextFunction } from 'express';
import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../lib/logger';
import { getSupabaseClient } from '../lib/supabase';

/**
 * Permission types
 */
export type Permission =
  // Data operations
  | 'data.read'
  | 'data.create'
  | 'data.update'
  | 'data.delete'
  | 'data.export'
  | 'data.import'
  
  // User management
  | 'users.read'
  | 'users.create'
  | 'users.update'
  | 'users.delete'
  | 'users.invite'
  
  // Permission management
  | 'permissions.read'
  | 'permissions.grant'
  | 'permissions.revoke'
  
  // Role management
  | 'roles.read'
  | 'roles.create'
  | 'roles.update'
  | 'roles.delete'
  | 'roles.assign'
  
  // Team management
  | 'teams.read'
  | 'teams.create'
  | 'teams.update'
  | 'teams.delete'
  | 'teams.manage_members'
  
  // Settings
  | 'settings.read'
  | 'settings.update'
  
  // Tenant management
  | 'tenants.read'
  | 'tenants.create'
  | 'tenants.update'
  | 'tenants.delete'
  | 'tenants.provision'
  
  // API keys
  | 'api_keys.read'
  | 'api_keys.create'
  | 'api_keys.rotate'
  | 'api_keys.revoke'
  
  // Audit logs
  | 'audit.read'
  | 'audit.export'
  
  // Agent operations
  | 'agents.execute'
  | 'agents.configure'
  
  // Billing
  | 'billing.read'
  | 'billing.manage';

/**
 * Role types
 */
export type Role =
  | 'super_admin'
  | 'admin'
  | 'manager'
  | 'member'
  | 'viewer'
  | 'guest';

/**
 * Permission scope
 */
export type PermissionScope = 'global' | 'tenant' | 'team' | 'self';

/**
 * Role-Permission mapping
 */
const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  super_admin: [
    // All permissions
    'data.read', 'data.create', 'data.update', 'data.delete', 'data.export', 'data.import',
    'users.read', 'users.create', 'users.update', 'users.delete', 'users.invite',
    'permissions.read', 'permissions.grant', 'permissions.revoke',
    'roles.read', 'roles.create', 'roles.update', 'roles.delete', 'roles.assign',
    'teams.read', 'teams.create', 'teams.update', 'teams.delete', 'teams.manage_members',
    'settings.read', 'settings.update',
    'tenants.read', 'tenants.create', 'tenants.update', 'tenants.delete', 'tenants.provision',
    'api_keys.read', 'api_keys.create', 'api_keys.rotate', 'api_keys.revoke',
    'audit.read', 'audit.export',
    'agents.execute', 'agents.configure',
    'billing.read', 'billing.manage',
  ],
  admin: [
    'data.read', 'data.create', 'data.update', 'data.delete', 'data.export', 'data.import',
    'users.read', 'users.create', 'users.update', 'users.delete', 'users.invite',
    'permissions.read', 'permissions.grant', 'permissions.revoke',
    'roles.read', 'roles.assign',
    'teams.read', 'teams.create', 'teams.update', 'teams.delete', 'teams.manage_members',
    'settings.read', 'settings.update',
    'api_keys.read', 'api_keys.create', 'api_keys.rotate', 'api_keys.revoke',
    'audit.read', 'audit.export',
    'agents.execute', 'agents.configure',
    'billing.read', 'billing.manage',
  ],
  manager: [
    'data.read', 'data.create', 'data.update', 'data.delete', 'data.export',
    'users.read', 'users.invite',
    'teams.read', 'teams.manage_members',
    'settings.read',
    'api_keys.read', 'api_keys.create',
    'audit.read',
    'agents.execute',
    'billing.read',
  ],
  member: [
    'data.read', 'data.create', 'data.update',
    'users.read',
    'teams.read',
    'settings.read',
    'agents.execute',
  ],
  viewer: [
    'data.read',
    'users.read',
    'teams.read',
    'settings.read',
  ],
  guest: [
    'data.read',
  ],
};

/**
 * Check if user has permission
 */
async function hasPermission(
  supabase: SupabaseClient,
  userId: string,
  tenantId: string,
  permission: Permission,
  scope: PermissionScope = 'tenant'
): Promise<boolean> {
  try {
    // Get user's roles
    const { data: userRoles, error: rolesError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('tenant_id', tenantId);

    if (rolesError) {
      logger.error('Failed to fetch user roles', rolesError, { userId, tenantId });
      return false;
    }

    if (!userRoles || userRoles.length === 0) {
      return false;
    }

    // Check if any role has the permission
    for (const userRole of userRoles) {
      const rolePermissions = ROLE_PERMISSIONS[userRole.role as Role];
      if (rolePermissions && rolePermissions.includes(permission)) {
        return true;
      }
    }

    // Check for explicit permission grants
    const { data: explicitPermissions, error: permError } = await supabase
      .from('user_permissions')
      .select('permission')
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .eq('permission', permission);

    if (permError) {
      logger.error('Failed to fetch user permissions', permError, { userId, tenantId });
      return false;
    }

    return explicitPermissions && explicitPermissions.length > 0;
  } catch (error) {
    logger.error('Permission check failed', error instanceof Error ? error : undefined, {
      userId,
      tenantId,
      permission,
    });
    return false;
  }
}

/**
 * Require permission middleware
 */
export function requirePermission(
  permission: Permission,
  scope: PermissionScope = 'tenant'
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as any;
      
      if (!user) {
        logger.warn('Permission check failed: No user', { permission });
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
      }

      const userId = user.id;
      const tenantId = user.tenant_id || req.headers['x-tenant-id'] as string;

      if (!tenantId) {
        logger.warn('Permission check failed: No tenant', { userId, permission });
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Tenant ID required',
        });
      }

      const supabase = getSupabaseClient();
      const allowed = await hasPermission(supabase, userId, tenantId, permission, scope);

      if (!allowed) {
        logger.warn('Permission denied', {
          userId,
          tenantId,
          permission,
          path: req.path,
          method: req.method,
        });

        return res.status(403).json({
          error: 'Forbidden',
          message: `Permission denied: ${permission}`,
        });
      }

      // Permission granted
      logger.debug('Permission granted', {
        userId,
        tenantId,
        permission,
      });

      next();
    } catch (error) {
      logger.error('Permission middleware error', error instanceof Error ? error : undefined);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Permission check failed',
      });
    }
  };
}

/**
 * Require role middleware
 */
export function requireRole(role: Role | Role[]) {
  const roles = Array.isArray(role) ? role : [role];

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as any;
      
      if (!user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
      }

      const userId = user.id;
      const tenantId = user.tenant_id || req.headers['x-tenant-id'] as string;

      if (!tenantId) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Tenant ID required',
        });
      }

      const supabase = getSupabaseClient();

      // Get user's roles
      const { data: userRoles, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('tenant_id', tenantId);

      if (error) {
        logger.error('Failed to fetch user roles', error, { userId, tenantId });
        return res.status(500).json({
          error: 'Internal Server Error',
          message: 'Role check failed',
        });
      }

      const hasRole = userRoles?.some((ur) => roles.includes(ur.role as Role));

      if (!hasRole) {
        logger.warn('Role denied', {
          userId,
          tenantId,
          requiredRoles: roles,
          path: req.path,
        });

        return res.status(403).json({
          error: 'Forbidden',
          message: `Role required: ${roles.join(' or ')}`,
        });
      }

      next();
    } catch (error) {
      logger.error('Role middleware error', error instanceof Error ? error : undefined);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Role check failed',
      });
    }
  };
}

/**
 * Require resource ownership middleware
 */
export function requireOwnership(
  resourceType: string,
  getResourceId: (req: Request) => string
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as any;
      
      if (!user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
      }

      const userId = user.id;
      const resourceId = getResourceId(req);
      const supabase = getSupabaseClient();

      // Check if user owns the resource
      const { data, error } = await supabase
        .from(resourceType)
        .select('user_id, created_by')
        .eq('id', resourceId)
        .single();

      if (error || !data) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Resource not found',
        });
      }

      const ownerId = data.user_id || data.created_by;

      if (ownerId !== userId) {
        logger.warn('Ownership denied', {
          userId,
          resourceType,
          resourceId,
          ownerId,
        });

        return res.status(403).json({
          error: 'Forbidden',
          message: 'You do not own this resource',
        });
      }

      next();
    } catch (error) {
      logger.error('Ownership middleware error', error instanceof Error ? error : undefined);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Ownership check failed',
      });
    }
  };
}

/**
 * Require any permission (OR logic)
 */
export function requireAnyPermission(...permissions: Permission[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as any;
      
      if (!user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
      }

      const userId = user.id;
      const tenantId = user.tenant_id || req.headers['x-tenant-id'] as string;

      if (!tenantId) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Tenant ID required',
        });
      }

      const supabase = getSupabaseClient();

      // Check if user has any of the permissions
      for (const permission of permissions) {
        const allowed = await hasPermission(supabase, userId, tenantId, permission);
        if (allowed) {
          logger.debug('Permission granted (any)', {
            userId,
            tenantId,
            permission,
          });
          return next();
        }
      }

      logger.warn('All permissions denied', {
        userId,
        tenantId,
        permissions,
      });

      return res.status(403).json({
        error: 'Forbidden',
        message: `Permission denied: requires one of ${permissions.join(', ')}`,
      });
    } catch (error) {
      logger.error('Permission middleware error', error instanceof Error ? error : undefined);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Permission check failed',
      });
    }
  };
}

/**
 * Require all permissions (AND logic)
 */
export function requireAllPermissions(...permissions: Permission[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as any;
      
      if (!user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
      }

      const userId = user.id;
      const tenantId = user.tenant_id || req.headers['x-tenant-id'] as string;

      if (!tenantId) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Tenant ID required',
        });
      }

      const supabase = getSupabaseClient();

      // Check if user has all permissions
      for (const permission of permissions) {
        const allowed = await hasPermission(supabase, userId, tenantId, permission);
        if (!allowed) {
          logger.warn('Permission denied (all)', {
            userId,
            tenantId,
            permission,
            required: permissions,
          });

          return res.status(403).json({
            error: 'Forbidden',
            message: `Permission denied: requires all of ${permissions.join(', ')}`,
          });
        }
      }

      logger.debug('All permissions granted', {
        userId,
        tenantId,
        permissions,
      });

      next();
    } catch (error) {
      logger.error('Permission middleware error', error instanceof Error ? error : undefined);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Permission check failed',
      });
    }
  };
}

/**
 * Export permission checker for use in services
 */
export async function checkPermission(
  userId: string,
  tenantId: string,
  permission: Permission
): Promise<boolean> {
  const supabase = getSupabaseClient();
  return hasPermission(supabase, userId, tenantId, permission);
}
