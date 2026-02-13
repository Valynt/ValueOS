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

import { NextFunction, Request, Response } from "express";
import { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@shared/lib/logger";
import { createServerSupabaseClient, getRequestSupabaseClient } from "@shared/lib/supabase";
import {
  type Permission as UnifiedPermission,
  hasPermission as matchPermission,
  USER_ROLE_PERMISSIONS,
  USER_ROLES,
} from "@shared/lib/permissions";

// Re-export unified Permission type
export type Permission = UnifiedPermission;

/**
 * Role types - use unified roles
 */
export type Role = (typeof USER_ROLES)[keyof typeof USER_ROLES];

/**
 * Permission scope
 */
export type PermissionScope = "global" | "tenant" | "team" | "self";

/**
 * Role-Permission mapping - use unified source
 * @deprecated Use USER_ROLE_PERMISSIONS from '@/lib/permissions' instead
 */
const ROLE_PERMISSIONS = USER_ROLE_PERMISSIONS;

/**
 * Check if user has permission
 * Uses batched queries for better performance
 */
async function hasPermission(
  supabase: SupabaseClient,
  userId: string,
  tenantId: string,
  permission: Permission,
  _scope: PermissionScope = "tenant"
): Promise<boolean> {
  try {
    // Batch both queries in parallel for better performance
    const [rolesResult, permissionsResult] = await Promise.all([
      supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("tenant_id", tenantId),
      supabase
        .from("user_permissions")
        .select("permission")
        .eq("user_id", userId)
        .eq("tenant_id", tenantId),
    ]);

    const { data: userRoles, error: rolesError } = rolesResult;
    const { data: explicitPermissions, error: permError } = permissionsResult;

    if (rolesError) {
      logger.error("Failed to fetch user roles", rolesError, {
        userId,
        tenantId,
      });
      return false;
    }

    if (permError) {
      logger.error("Failed to fetch user permissions", permError, {
        userId,
        tenantId,
      });
      // Continue with role-based check even if explicit permissions fail
    }

    // Check if any system role has the permission (using unified permission matching with wildcard support)
    if (userRoles && userRoles.length > 0) {
      for (const userRole of userRoles) {
        const rolePermissions = ROLE_PERMISSIONS[userRole.role as Role];
        if (rolePermissions && matchPermission(rolePermissions, permission)) {
          return true;
        }
      }
    }

    // Resolve tenant membership roles for custom role matrix
    const { data: membership, error: membershipError } = await supabase
      .from("memberships")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("user_id", userId)
      .maybeSingle();

    if (membershipError) {
      logger.error("Failed to fetch membership", membershipError, { userId, tenantId });
    } else if (membership?.id) {
      const { data: customRolePermissions, error: customRoleError } = await supabase
        .from("membership_roles")
        .select("role_permissions(permissions(key))")
        .eq("membership_id", membership.id);

      if (customRoleError) {
        logger.error("Failed to fetch custom role permissions", customRoleError, { userId, tenantId });
      } else {
        const grantedPermissions: string[] = [];
        for (const row of customRolePermissions || []) {
          const rolePermissions = (row as any).role_permissions;
          const normalized = Array.isArray(rolePermissions) ? rolePermissions : [rolePermissions];
          for (const rp of normalized) {
            const perm = Array.isArray(rp?.permissions) ? rp.permissions[0] : rp?.permissions;
            if (perm?.key) {
              grantedPermissions.push(perm.key);
            }
          }
        }

        if (grantedPermissions.length > 0 && matchPermission(grantedPermissions, permission)) {
          return true;
        }
      }
    }

    // Check explicit permission grants
    if (explicitPermissions && explicitPermissions.length > 0) {
      const grantedPermissions = explicitPermissions.map((p) => p.permission);
      if (matchPermission(grantedPermissions, permission)) {
        return true;
      }
    }

    return false;
  } catch (error) {
    logger.error(
      "Permission check failed",
      error instanceof Error ? error : undefined,
      {
        userId,
        tenantId,
        permission,
      }
    );
    return false;
  }
}

/**
 * Require permission middleware
 */
export function requirePermission(
  permission: Permission,
  scope: PermissionScope = "tenant"
) {
  return async function requirePermissionMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const user = req.user as any;

      if (!user) {
        logger.warn("Permission check failed: No user", { permission });
        return res.status(401).json({
          error: "Unauthorized",
          message: "Authentication required",
        });
      }

      const userId = user.id;
      const tenantId = user.tenant_id || (req as any).tenantId;

      if (!tenantId) {
        logger.warn("Permission check failed: No tenant", {
          userId,
          permission,
        });
        return res.status(400).json({
          error: "Bad Request",
          message: "Tenant ID required",
        });
      }

      const supabase = getRequestSupabaseClient(req);
      const allowed = await hasPermission(
        supabase,
        userId,
        tenantId,
        permission,
        scope
      );

      if (!allowed) {
        logger.warn("Permission denied", {
          userId,
          tenantId,
          permission,
          path: req.path,
          method: req.method,
        });

        return res.status(403).json({
          error: "Forbidden",
          message: `Permission denied: ${permission}`,
        });
      }

      // Permission granted
      logger.debug("Permission granted", {
        userId,
        tenantId,
        permission,
      });

      next();
    } catch (error) {
      logger.error(
        "Permission middleware error",
        error instanceof Error ? error : undefined
      );
      return res.status(500).json({
        error: "Internal Server Error",
        message: "Permission check failed",
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
          error: "Unauthorized",
          message: "Authentication required",
        });
      }

      const userId = user.id;
      const tenantId = user.tenant_id || (req as any).tenantId;

      if (!tenantId) {
        return res.status(400).json({
          error: "Bad Request",
          message: "Tenant ID required",
        });
      }

      const supabase = getRequestSupabaseClient(req);

      // Get user's roles
      const { data: userRoles, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("tenant_id", tenantId);

      if (error) {
        logger.error("Failed to fetch user roles", error, { userId, tenantId });
        return res.status(500).json({
          error: "Internal Server Error",
          message: "Role check failed",
        });
      }

      let hasRole = userRoles?.some((ur: { role: string }) =>
        roles.includes(ur.role as Role)
      );

      if (!hasRole) {
        const { data: membership } = await supabase
          .from("memberships")
          .select("id")
          .eq("tenant_id", tenantId)
          .eq("user_id", userId)
          .maybeSingle();

        if (membership?.id) {
          const { data: customRoles } = await supabase
            .from("membership_roles")
            .select("roles(name)")
            .eq("membership_id", membership.id);

          const customRoleNames = (customRoles || []).map((row: any) => {
            const roleObj = Array.isArray(row.roles) ? row.roles[0] : row.roles;
            return roleObj?.name?.split(":", 3)?.[2] || roleObj?.name;
          });

          hasRole = customRoleNames.some((customRoleName: string) => roles.includes(customRoleName as Role));
        }
      }

      if (!hasRole) {
        logger.warn("Role denied", {
          userId,
          tenantId,
          requiredRoles: roles,
          path: req.path,
        });

        return res.status(403).json({
          error: "Forbidden",
          message: `Role required: ${roles.join(" or ")}`,
        });
      }

      next();
    } catch (error) {
      logger.error(
        "Role middleware error",
        error instanceof Error ? error : undefined
      );
      return res.status(500).json({
        error: "Internal Server Error",
        message: "Role check failed",
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
          error: "Unauthorized",
          message: "Authentication required",
        });
      }

      const userId = user.id;
      const resourceId = getResourceId(req);
      const supabase = getRequestSupabaseClient(req);

      // Check if user owns the resource
      const { data, error } = await supabase
        .from(resourceType)
        .select("user_id, created_by")
        .eq("id", resourceId)
        .single();

      if (error || !data) {
        return res.status(404).json({
          error: "Not Found",
          message: "Resource not found",
        });
      }

      const ownerId = data.user_id || data.created_by;

      if (ownerId !== userId) {
        logger.warn("Ownership denied", {
          userId,
          resourceType,
          resourceId,
          ownerId,
        });

        return res.status(403).json({
          error: "Forbidden",
          message: "You do not own this resource",
        });
      }

      next();
    } catch (error) {
      logger.error(
        "Ownership middleware error",
        error instanceof Error ? error : undefined
      );
      return res.status(500).json({
        error: "Internal Server Error",
        message: "Ownership check failed",
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
          error: "Unauthorized",
          message: "Authentication required",
        });
      }

      const userId = user.id;
      const tenantId = user.tenant_id || (req as any).tenantId;

      if (!tenantId) {
        return res.status(400).json({
          error: "Bad Request",
          message: "Tenant ID required",
        });
      }

      const supabase = getRequestSupabaseClient(req);

      // Check if user has any of the permissions
      for (const permission of permissions) {
        const allowed = await hasPermission(
          supabase,
          userId,
          tenantId,
          permission
        );
        if (allowed) {
          logger.debug("Permission granted (any)", {
            userId,
            tenantId,
            permission,
          });
          return next();
        }
      }

      logger.warn("All permissions denied", {
        userId,
        tenantId,
        permissions,
      });

      return res.status(403).json({
        error: "Forbidden",
        message: `Permission denied: requires one of ${permissions.join(", ")}`,
      });
    } catch (error) {
      logger.error(
        "Permission middleware error",
        error instanceof Error ? error : undefined
      );
      return res.status(500).json({
        error: "Internal Server Error",
        message: "Permission check failed",
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
          error: "Unauthorized",
          message: "Authentication required",
        });
      }

      const userId = user.id;
      const tenantId = user.tenant_id || (req as any).tenantId;

      if (!tenantId) {
        return res.status(400).json({
          error: "Bad Request",
          message: "Tenant ID required",
        });
      }

      const supabase = getRequestSupabaseClient(req);

      // Check if user has all permissions
      for (const permission of permissions) {
        const allowed = await hasPermission(
          supabase,
          userId,
          tenantId,
          permission
        );
        if (!allowed) {
          logger.warn("Permission denied (all)", {
            userId,
            tenantId,
            permission,
            required: permissions,
          });

          return res.status(403).json({
            error: "Forbidden",
            message: `Permission denied: requires all of ${permissions.join(", ")}`,
          });
        }
      }

      logger.debug("All permissions granted", {
        userId,
        tenantId,
        permissions,
      });

      next();
    } catch (error) {
      logger.error(
        "Permission middleware error",
        error instanceof Error ? error : undefined
      );
      return res.status(500).json({
        error: "Internal Server Error",
        message: "Permission check failed",
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
  const supabase = createServerSupabaseClient();
  return hasPermission(supabase, userId, tenantId, permission);
}

/**
 * Policy function type for ABAC
 * @param user The authenticated user object
 * @param resource The resource being accessed (optional)
 * @returns boolean or Promise<boolean> indicating access
 */
export type Policy<T = any> = (user: any, resource?: T) => boolean | Promise<boolean>;

/**
 * Require policy middleware (ABAC)
 */
export function requirePolicy<T>(
  policy: Policy<T>,
  resourceExtractor?: (req: Request) => T | Promise<T>
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;

      if (!user) {
        return res.status(401).json({
          error: "Unauthorized",
          message: "Authentication required",
        });
      }

      let resource: T | undefined;
      if (resourceExtractor) {
        resource = await resourceExtractor(req);
      }

      const allowed = await policy(user, resource);

      if (!allowed) {
        logger.warn("Policy denied", {
          userId: user.id,
          path: req.path,
        });

        return res.status(403).json({
          error: "Forbidden",
          message: "Access denied by policy",
        });
      }

      next();
    } catch (error) {
      logger.error(
        "Policy middleware error",
        error instanceof Error ? error : undefined
      );
      return res.status(500).json({
        error: "Internal Server Error",
        message: "Policy check failed",
      });
    }
  };
}
