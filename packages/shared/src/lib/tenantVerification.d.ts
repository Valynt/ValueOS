/**
 * Tenant Verification Module
 *
 * SECURITY CRITICAL: Prevents cross-tenant data access
 *
 * This module provides functions to verify that users belong to the tenants
 * they are trying to access. All data access operations MUST verify tenant
 * membership to prevent unauthorized cross-tenant access.
 */
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
export declare function verifyTenantMembership(userId: string, tenantId: string): Promise<boolean>;
/**
 * Verify user belongs to multiple tenants (batch operation)
 *
 * @param userId - User ID to verify
 * @param tenantIds - Array of tenant IDs to verify against
 * @returns Promise<Map<string, boolean>> - Map of tenantId to membership status
 */
export declare function verifyTenantMembershipBatch(userId: string, tenantIds: string[]): Promise<Map<string, boolean>>;
/**
 * Get user's tenant ID (organization ID)
 *
 * @param userId - User ID
 * @returns Promise<string | null> - Tenant ID or null if not found
 */
export declare function getUserTenantId(userId: string): Promise<string | null>;
/**
 * Verify tenant exists and is active
 *
 * @param tenantId - Tenant ID to verify
 * @returns Promise<boolean> - true if tenant exists and is active
 */
export declare function verifyTenantExists(tenantId: string): Promise<boolean>;
/**
 * Security error for tenant violations
 */
export declare class TenantSecurityError extends Error {
    readonly userId: string;
    readonly requestedTenantId: string;
    readonly userTenantId?: string;
    constructor(message: string, userId: string, requestedTenantId: string, userTenantId?: string);
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
export declare function assertTenantMembership(userId: string, tenantId: string): Promise<void>;
/**
 * Middleware helper: Extract and verify tenant from request
 *
 * @param userId - User ID from authenticated request
 * @param tenantIdFromRequest - Tenant ID from request (path, query, or body)
 * @returns Promise<boolean> - true if verified, false otherwise
 */
export declare function verifyRequestTenant(userId: string, tenantIdFromRequest: string): Promise<boolean>;
//# sourceMappingURL=tenantVerification.d.ts.map