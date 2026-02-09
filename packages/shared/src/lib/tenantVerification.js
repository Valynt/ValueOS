/**
 * Tenant Verification Module
 *
 * SECURITY CRITICAL: Prevents cross-tenant data access
 *
 * This module provides functions to verify that users belong to the tenants
 * they are trying to access. All data access operations MUST verify tenant
 * membership to prevent unauthorized cross-tenant access.
 */
import { logger } from "./logger";
/**
 * Verify user belongs to tenant
 *
 * SECURITY CRITICAL: This function prevents cross-tenant data access.
 * It MUST be called before allowing any tenant-scoped data access.
 *
 * @param userId - User ID to verify
 * @param tenantId - Tenant ID (organization ID) to verify against
 * @returns Promise<boolean> - true if user belongs to tenant, false otherwise
 *
 * @example
 * ```typescript
 * const belongsToTenant = await verifyTenantMembership(userId, tenantId);
 * if (!belongsToTenant) {
 *   throw new SecurityError('Cross-tenant access denied');
 * }
 * ```
 */
export async function verifyTenantMembership(userId, tenantId) {
    try {
        // Import supabase client dynamically to avoid circular dependencies
        const { supabase } = await import("./supabase");
        const { data: membership, error: membershipError } = await supabase
            .from("user_tenants")
            .select("tenant_id, status")
            .eq("user_id", userId)
            .eq("tenant_id", tenantId)
            .maybeSingle();
        if (!membershipError && membership) {
            const membershipStatus = membership.status || "active";
            const belongsToTenant = membershipStatus === "active";
            if (!belongsToTenant) {
                logger.warn("Tenant membership inactive", {
                    userId: maskUserId(userId),
                    tenantId,
                    status: membershipStatus,
                });
            }
            return belongsToTenant;
        }
        if (membershipError) {
            logger.warn("Tenant membership lookup failed, falling back to legacy org check", {
                userId: maskUserId(userId),
                tenantId,
                errorCode: membershipError.code,
            });
        }
        // Legacy fallback: single-tenant users table
        const { data, error } = await supabase
            .from("users")
            .select("organization_id")
            .eq("id", userId)
            .single();
        if (error || !data) {
            logger.error("Failed to verify tenant membership via legacy org check", error, {
                userId: maskUserId(userId),
                tenantId,
            });
            return false; // Fail closed - deny access on error
        }
        const belongsToTenant = data.organization_id === tenantId;
        if (!belongsToTenant) {
            logger.warn("Cross-tenant access attempt detected", {
                userId: maskUserId(userId),
                userTenant: data.organization_id,
                requestedTenant: tenantId,
                severity: "HIGH",
                securityEvent: "CROSS_TENANT_ACCESS_ATTEMPT",
            });
        }
        return belongsToTenant;
    }
    catch (error) {
        logger.error("Tenant membership verification error", error instanceof Error ? error : undefined, {
            userId: maskUserId(userId),
            tenantId,
        });
        return false; // Fail closed on any error
    }
}
/**
 * Verify user belongs to multiple tenants (batch operation)
 *
 * @param userId - User ID to verify
 * @param tenantIds - Array of tenant IDs to verify against
 * @returns Promise<Map<string, boolean>> - Map of tenantId to membership status
 */
export async function verifyTenantMembershipBatch(userId, tenantIds) {
    const results = new Map();
    try {
        const { supabase } = await import("./supabase");
        const { data: memberships, error: membershipsError } = await supabase
            .from("user_tenants")
            .select("tenant_id, status")
            .eq("user_id", userId)
            .eq("status", "active");
        if (!membershipsError && memberships) {
            const allowed = new Set(memberships.map((membership) => membership.tenant_id));
            tenantIds.forEach((tenantId) => results.set(tenantId, allowed.has(tenantId)));
            return results;
        }
        if (membershipsError) {
            logger.warn("Batch tenant lookup failed, falling back to legacy org check", {
                userId: maskUserId(userId),
                errorCode: membershipsError.code,
            });
        }
        const { data, error } = await supabase
            .from("users")
            .select("organization_id")
            .eq("id", userId)
            .single();
        if (error || !data) {
            tenantIds.forEach((tenantId) => results.set(tenantId, false));
            return results;
        }
        const userTenantId = data.organization_id;
        tenantIds.forEach((tenantId) => {
            results.set(tenantId, tenantId === userTenantId);
        });
        return results;
    }
    catch (error) {
        logger.error("Batch tenant verification error", error instanceof Error ? error : undefined, {
            userId: maskUserId(userId),
            tenantCount: tenantIds.length,
        });
        // Fail closed - deny all on error
        tenantIds.forEach((tenantId) => results.set(tenantId, false));
        return results;
    }
}
/**
 * Get user's tenant ID (organization ID)
 *
 * @param userId - User ID
 * @returns Promise<string | null> - Tenant ID or null if not found
 */
export async function getUserTenantId(userId) {
    try {
        const { supabase } = await import("./supabase");
        const { data: membership, error: membershipError } = await supabase
            .from("user_tenants")
            .select("tenant_id, created_at, status")
            .eq("user_id", userId)
            .eq("status", "active")
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle();
        if (!membershipError && membership?.tenant_id) {
            return membership.tenant_id;
        }
        if (membershipError) {
            logger.warn("Tenant lookup failed, falling back to legacy org check", {
                userId: maskUserId(userId),
                error: membershipError.message,
            });
        }
        const { data, error } = await supabase
            .from("users")
            .select("organization_id")
            .eq("id", userId)
            .single();
        if (error || !data) {
            logger.warn("Failed to get user tenant ID", {
                userId: maskUserId(userId),
                error: error?.message,
            });
            return null;
        }
        return data.organization_id;
    }
    catch (error) {
        logger.error("Error getting user tenant ID", error instanceof Error ? error : undefined, {
            userId: maskUserId(userId),
        });
        return null;
    }
}
/**
 * Verify tenant exists and is active
 *
 * @param tenantId - Tenant ID to verify
 * @returns Promise<boolean> - true if tenant exists and is active
 */
export async function verifyTenantExists(tenantId) {
    try {
        const { supabase } = await import("./supabase");
        const { data: tenant, error: tenantError } = await supabase
            .from("tenants")
            .select("id, status")
            .eq("id", tenantId)
            .single();
        if (!tenantError && tenant) {
            return tenant.status === "active";
        }
        if (tenantError) {
            logger.warn("Tenant lookup failed, falling back to organizations table", {
                tenantId,
                errorCode: tenantError.code,
            });
        }
        const { data, error } = await supabase
            .from("organizations")
            .select("id, status")
            .eq("id", tenantId)
            .single();
        if (error || !data) {
            return false;
        }
        return data.status === "active" || data.status === "trial";
    }
    catch (error) {
        logger.error("Error verifying tenant exists", error instanceof Error ? error : undefined, {
            tenantId,
        });
        return false;
    }
}
/**
 * Mask user ID for logging (privacy protection)
 *
 * @param userId - User ID to mask
 * @returns Masked user ID
 */
function maskUserId(userId) {
    if (userId.length <= 8) {
        return "***";
    }
    return `${userId.substring(0, 4)}...${userId.substring(userId.length - 4)}`;
}
/**
 * Security error for tenant violations
 */
export class TenantSecurityError extends Error {
    constructor(message, userId, requestedTenantId, userTenantId) {
        super(message);
        this.userId = userId;
        this.requestedTenantId = requestedTenantId;
        this.userTenantId = userTenantId;
        this.name = "TenantSecurityError";
    }
}
/**
 * Assert user belongs to tenant (throws on failure)
 *
 * Use this in critical paths where tenant verification failure should
 * immediately halt execution.
 *
 * @param userId - User ID to verify
 * @param tenantId - Tenant ID to verify against
 * @throws TenantSecurityError if user doesn't belong to tenant
 */
export async function assertTenantMembership(userId, tenantId) {
    const belongsToTenant = await verifyTenantMembership(userId, tenantId);
    if (!belongsToTenant) {
        const userTenantId = await getUserTenantId(userId);
        throw new TenantSecurityError(`User ${maskUserId(userId)} does not belong to tenant ${tenantId}`, userId, tenantId, userTenantId || undefined);
    }
}
/**
 * Middleware helper: Extract and verify tenant from request
 *
 * @param userId - User ID from authenticated request
 * @param tenantIdFromRequest - Tenant ID from request (path, query, or body)
 * @returns Promise<boolean> - true if verified, false otherwise
 */
export async function verifyRequestTenant(userId, tenantIdFromRequest) {
    // Verify tenant exists first
    const tenantExists = await verifyTenantExists(tenantIdFromRequest);
    if (!tenantExists) {
        logger.warn("Request for non-existent tenant", {
            userId: maskUserId(userId),
            tenantId: tenantIdFromRequest,
        });
        return false;
    }
    // Verify user belongs to tenant
    return verifyTenantMembership(userId, tenantIdFromRequest);
}
//# sourceMappingURL=tenantVerification.js.map