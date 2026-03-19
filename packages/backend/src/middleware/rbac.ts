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

import { logger } from "@shared/lib/logger";
import {
  hasPermission as matchPermission,
  type Permission as UnifiedPermission,
  USER_ROLE_PERMISSIONS,
  USER_ROLES,
} from "@shared/lib/permissions";
import { createRequestRlsSupabaseClient, createServiceRoleSupabaseClient } from "../lib/supabase.js";
import { SupabaseClient } from "@supabase/supabase-js";
import { NextFunction, Request, Response } from "express";

import type { AuthenticatedRequest } from "./auth.js";

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
 * Resolved permission set for a user within a tenant.
 * Fetched once and evaluated locally for any number of permission checks.
 */
interface ResolvedPermissions {
  /** false when the user has no active membership — all checks must deny */
  active: boolean;
  /** union of system-role permissions + custom-role permissions + explicit grants */
  granted: string[];
}

/**
 * Fetch the complete permission set for a user in one logical operation.
 *
 * Round-trips:
 *   1. Parallel: user_tenants (status) + user_roles + user_permissions
 *   2. Sequential (only when system roles don't satisfy the check):
 *      memberships → membership_roles (custom RBAC graph)
 *
 * Callers that need to evaluate multiple permissions (requireAnyPermission,
 * requireAllPermissions) call this once and evaluate locally — no per-permission
 * DB round-trips.
 */
async function resolvePermissions(
  supabase: SupabaseClient,
  userId: string,
  tenantId: string,
): Promise<ResolvedPermissions> {
  // Round-trip 1: membership status + system roles + explicit grants in parallel.
  const [membershipResult, rolesResult, permissionsResult] = await Promise.all([
    supabase
      .from("user_tenants")
      .select("status")
      .eq("user_id", userId)
      .eq("tenant_id", tenantId)
      .maybeSingle(),
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

  const { data: tenantMembership, error: membershipStatusError } = membershipResult;
  const { data: userRoles, error: rolesError } = rolesResult;
  const { data: explicitPermissions, error: permError } = permissionsResult;

  // Verify active membership — user_tenants is the RLS authority.
  if (membershipStatusError) {
    logger.error("Failed to verify membership status", membershipStatusError, { userId, tenantId });
    return { active: false, granted: [] };
  }

  if (!tenantMembership || tenantMembership.status !== "active") {
    logger.warn("Permission denied: membership inactive or missing", {
      userId,
      tenantId,
      status: tenantMembership?.status ?? "not_found",
    });
    return { active: false, granted: [] };
  }

  if (rolesError) {
    logger.error("Failed to fetch user roles", rolesError, { userId, tenantId });
    return { active: false, granted: [] };
  }

  if (permError) {
    logger.error("Failed to fetch user permissions", permError, { userId, tenantId });
    // Continue — explicit grants are additive; a fetch failure is non-fatal.
  }

  // Expand system roles into their permission sets.
  const granted: string[] = [];

  for (const userRole of userRoles ?? []) {
    const rolePermissions = ROLE_PERMISSIONS[userRole.role as Role];
    if (rolePermissions) {
      granted.push(...rolePermissions);
    }
  }

  // Round-trip 2 (conditional): custom RBAC graph via memberships.
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
      for (const row of customRolePermissions ?? []) {
        const rolePerms = (row as Record<string, unknown>).role_permissions;
        const normalized = Array.isArray(rolePerms) ? rolePerms : [rolePerms];
        for (const rp of normalized) {
          const perm = Array.isArray(rp?.permissions) ? rp.permissions[0] : rp?.permissions;
          if (perm?.key) granted.push(perm.key);
        }
      }
    }
  }

  // Append explicit per-user grants.
  for (const ep of explicitPermissions ?? []) {
    if (ep.permission) granted.push(ep.permission);
  }

  return { active: true, granted };
}

/**
 * Check if user has a single permission.
 * For multi-permission checks use requireAnyPermission / requireAllPermissions
 * which call resolvePermissions once and evaluate locally.
 */
async function hasPermission(
  supabase: SupabaseClient,
  userId: string,
  tenantId: string,
  permission: Permission,
  _scope: PermissionScope = "tenant"
): Promise<boolean> {
  try {
    const { active, granted } = await resolvePermissions(supabase, userId, tenantId);
    if (!active) return false;
    return matchPermission(granted, permission);
  } catch (error) {
    logger.error(
      "Permission check failed",
      error instanceof Error ? error : undefined,
      { userId, tenantId, permission }
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
      const authReq = req as AuthenticatedRequest;
      const user = authReq.user;

      if (!user) {
        logger.warn("Permission check failed: No user", { permission });
        return res.status(401).json({
          error: "Unauthorized",
          message: "Authentication required",
        });
      }

      const userId = user.id;
      const tenantId = user.tenant_id || authReq.tenantId;

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

      const supabase = createRequestRlsSupabaseClient(req);
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

      return next();
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
      const authReq = req as AuthenticatedRequest;
      const user = authReq.user;

      if (!user) {
        return res.status(401).json({
          error: "Unauthorized",
          message: "Authentication required",
        });
      }

      const userId = user.id;
      const tenantId = user.tenant_id || authReq.tenantId;

      if (!tenantId) {
        return res.status(400).json({
          error: "Bad Request",
          message: "Tenant ID required",
        });
      }

      const supabase = createRequestRlsSupabaseClient(req);

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

          const customRoleNames = (customRoles || []).map((row: Record<string, unknown>) => {
            const roleObj = Array.isArray(row.roles) ? row.roles[0] : row.roles;
            const roleRecord = roleObj as Record<string, unknown> | undefined;
            return (roleRecord?.name as string)?.split(":", 3)?.[2] || roleRecord?.name;
          });

          hasRole = customRoleNames.some((customRoleName) => roles.includes(customRoleName as Role));
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

      return next();
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
      const authReq = req as AuthenticatedRequest;
      const user = authReq.user;

      if (!user) {
        return res.status(401).json({
          error: "Unauthorized",
          message: "Authentication required",
        });
      }

      const userId = user.id;
      const resourceId = getResourceId(req);
      const supabase = createRequestRlsSupabaseClient(req);

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

      return next();
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
      const authReq = req as AuthenticatedRequest;
      const user = authReq.user;

      if (!user) {
        return res.status(401).json({
          error: "Unauthorized",
          message: "Authentication required",
        });
      }

      const userId = user.id;
      const tenantId = user.tenant_id || authReq.tenantId;

      if (!tenantId) {
        return res.status(400).json({
          error: "Bad Request",
          message: "Tenant ID required",
        });
      }

      const supabase = createRequestRlsSupabaseClient(req);

      // Resolve the full permission set once, then evaluate all candidates locally.
      // Avoids N sequential hasPermission() calls (each making 3–5 DB round-trips).
      const { active, granted } = await resolvePermissions(supabase, userId, tenantId);

      if (active) {
        for (const permission of permissions) {
          if (matchPermission(granted, permission)) {
            logger.debug("Permission granted (any)", { userId, tenantId, permission });
            return next();
          }
        }
      }

      logger.warn("All permissions denied", { userId, tenantId, permissions });

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
      const authReq = req as AuthenticatedRequest;
      const user = authReq.user;

      if (!user) {
        return res.status(401).json({
          error: "Unauthorized",
          message: "Authentication required",
        });
      }

      const userId = user.id;
      const tenantId = user.tenant_id || authReq.tenantId;

      if (!tenantId) {
        return res.status(400).json({
          error: "Bad Request",
          message: "Tenant ID required",
        });
      }

      const supabase = createRequestRlsSupabaseClient(req);

      // Resolve the full permission set once, then evaluate all candidates locally.
      const { active, granted } = await resolvePermissions(supabase, userId, tenantId);

      if (active) {
        for (const permission of permissions) {
          if (!matchPermission(granted, permission)) {
            logger.warn("Permission denied (all)", { userId, tenantId, permission, required: permissions });
            return res.status(403).json({
              error: "Forbidden",
              message: `Permission denied: requires all of ${permissions.join(", ")}`,
            });
          }
        }
        logger.debug("All permissions granted", { userId, tenantId, permissions });
        return next();
      }

      logger.warn("Permission denied (all) — inactive membership", { userId, tenantId });
      return res.status(403).json({
        error: "Forbidden",
        message: `Permission denied: requires all of ${permissions.join(", ")}`,
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
 * Export permission checker for use in services
 */
export async function checkPermission(
  userId: string,
  tenantId: string,
  permission: Permission
): Promise<boolean> {
  const supabase = createServiceRoleSupabaseClient();
  return hasPermission(supabase, userId, tenantId, permission);
}

/**
 * Policy function type for ABAC
 * @param user The authenticated user object
 * @param resource The resource being accessed (optional)
 * @returns boolean or Promise<boolean> indicating access
 */
export type Policy<T = unknown> = (user: AuthenticatedRequest["user"], resource?: T) => boolean | Promise<boolean>;

/**
 * Require policy middleware (ABAC)
 */
export function requirePolicy<T>(
  policy: Policy<T>,
  resourceExtractor?: (req: Request) => T | Promise<T>
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as AuthenticatedRequest).user;

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

      return next();
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
