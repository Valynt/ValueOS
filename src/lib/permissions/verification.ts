/**
 * Backend Role Verification
 *
 * Ensures roles are verified from the database, not trusted from JWT claims.
 * This is critical for security - never trust client-provided role data.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { Permission, computePermissionsFromRoles } from "./index";

export interface VerifiedUserRoles {
  userId: string;
  tenantId: string;
  roles: string[];
  permissions: Permission[];
  verifiedAt: number;
}

export interface RoleVerificationOptions {
  /** Cache TTL in milliseconds (default: 5 minutes) */
  cacheTTL?: number;
  /** Whether to include explicit permission grants */
  includeExplicitPermissions?: boolean;
}

// In-memory cache for verified roles (per-request caching)
const roleVerificationCache = new Map<string, VerifiedUserRoles>();
const DEFAULT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Verify user roles from the database
 *
 * IMPORTANT: This function should be used instead of trusting user_metadata.roles
 * from JWT claims. Always verify roles server-side.
 *
 * @param supabase - Supabase client
 * @param userId - User ID to verify
 * @param tenantId - Tenant ID for multi-tenant isolation
 * @param options - Verification options
 * @returns Verified roles and computed permissions
 */
export async function verifyUserRoles(
  supabase: SupabaseClient,
  userId: string,
  tenantId: string,
  options: RoleVerificationOptions = {}
): Promise<VerifiedUserRoles> {
  const { cacheTTL = DEFAULT_CACHE_TTL, includeExplicitPermissions = true } =
    options;
  const cacheKey = `${userId}:${tenantId}`;
  const now = Date.now();

  // Check cache
  const cached = roleVerificationCache.get(cacheKey);
  if (cached && now - cached.verifiedAt < cacheTTL) {
    return cached;
  }

  // Fetch roles from database
  const rolesQuery = supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("tenant_id", tenantId);

  // Optionally fetch explicit permissions in parallel
  const permissionsQuery = includeExplicitPermissions
    ? supabase
        .from("user_permissions")
        .select("permission")
        .eq("user_id", userId)
        .eq("tenant_id", tenantId)
    : null;

  const [rolesResult, permissionsResult] = await Promise.all([
    rolesQuery,
    permissionsQuery,
  ]);

  if (rolesResult.error) {
    throw new Error(
      `Failed to verify user roles: ${rolesResult.error.message}`
    );
  }

  const roles = (rolesResult.data || []).map((r: { role: string }) => r.role);

  // Compute permissions from roles
  let permissions = computePermissionsFromRoles(roles);

  // Add explicit permissions if fetched
  if (
    includeExplicitPermissions &&
    permissionsResult &&
    !permissionsResult.error
  ) {
    const explicitPerms = (permissionsResult.data || []).map(
      (p: { permission: string }) => p.permission
    );
    permissions = [
      ...new Set([...permissions, ...explicitPerms]),
    ] as Permission[];
  }

  const verified: VerifiedUserRoles = {
    userId,
    tenantId,
    roles,
    permissions,
    verifiedAt: now,
  };

  // Cache the result
  roleVerificationCache.set(cacheKey, verified);

  return verified;
}

/**
 * Clear the role verification cache
 * Call this when roles are updated
 */
export function clearRoleVerificationCache(
  userId?: string,
  tenantId?: string
): void {
  if (userId && tenantId) {
    roleVerificationCache.delete(`${userId}:${tenantId}`);
  } else if (userId) {
    // Clear all entries for this user
    for (const key of roleVerificationCache.keys()) {
      if (key.startsWith(`${userId}:`)) {
        roleVerificationCache.delete(key);
      }
    }
  } else {
    roleVerificationCache.clear();
  }
}

/**
 * Middleware helper to attach verified roles to request
 *
 * Usage in Express:
 * ```typescript
 * app.use(async (req, res, next) => {
 *   if (req.user) {
 *     req.verifiedRoles = await verifyUserRoles(supabase, req.user.id, req.tenantId);
 *   }
 *   next();
 * });
 * ```
 */
export async function getVerifiedPermissions(
  supabase: SupabaseClient,
  userId: string,
  tenantId: string
): Promise<Permission[]> {
  const verified = await verifyUserRoles(supabase, userId, tenantId);
  return verified.permissions;
}

/**
 * Check if a user has a specific permission (verified from database)
 */
export async function hasVerifiedPermission(
  supabase: SupabaseClient,
  userId: string,
  tenantId: string,
  requiredPermission: Permission
): Promise<boolean> {
  const verified = await verifyUserRoles(supabase, userId, tenantId);
  return verified.permissions.includes(requiredPermission);
}

/**
 * Check if a user has all required permissions (verified from database)
 */
export async function hasAllVerifiedPermissions(
  supabase: SupabaseClient,
  userId: string,
  tenantId: string,
  requiredPermissions: Permission[]
): Promise<boolean> {
  const verified = await verifyUserRoles(supabase, userId, tenantId);
  return requiredPermissions.every((p) => verified.permissions.includes(p));
}

/**
 * Check if a user has any of the required permissions (verified from database)
 */
export async function hasAnyVerifiedPermission(
  supabase: SupabaseClient,
  userId: string,
  tenantId: string,
  requiredPermissions: Permission[]
): Promise<boolean> {
  const verified = await verifyUserRoles(supabase, userId, tenantId);
  return requiredPermissions.some((p) => verified.permissions.includes(p));
}
