/**
 * Tenant API Client
 *
 * Provides typed API calls for tenant-related operations.
 * Uses feature flag to enable/disable real API calls.
 */

import { apiClient } from "@/api/client";
import { createLogger } from "@/lib/logger";
import { supabase } from "@/lib/supabase";
import { sanitizeInput } from "@/security/InputSanitizer";

const logger = createLogger({ component: "TenantAPI" });

/**
 * Tenant information returned from API
 */
export interface TenantInfo {
  id: string;
  name: string;
  slug: string;
  color: string;
  role: string;
  status: "active" | "inactive" | "pending";
  createdAt: string;
}

/**
 * API response wrapper
 */
export interface TenantApiResponse<T> {
  data: T | null;
  error: Error | null;
}

interface TenantMembershipQueryGuard {
  expectedUserId?: string;
}

/**
 * Check if tenant API is enabled via feature flag
 */
export function isTenantApiEnabled(): boolean {
  return import.meta.env.VITE_TENANTS_API_ENABLED !== "false";
}

/**
 * Fetch all tenants the current user has access to
 */
export async function fetchUserTenants(
  guard?: TenantMembershipQueryGuard
): Promise<TenantApiResponse<TenantInfo[]>> {
  if (!isTenantApiEnabled()) {
    logger.warn("Tenant API disabled, returning empty list");
    return { data: [], error: null };
  }

  try {
    const response = await apiClient.get<{ data: TenantInfo[]; error: string | null }>("/v1/tenant/memberships");
    const tenants = response.data.data ?? [];

    if (guard?.expectedUserId) {
      if (!supabase) {
        return { data: null, error: new Error("Authenticated user is required") };
      }
      const { data: sessionData } = await supabase.auth.getSession();
      const expectedUserId = sanitizeInput(guard.expectedUserId, { allowHtml: false, maxLength: 128 });
      const sessionUserId = sanitizeInput(sessionData.session?.user?.id ?? "", { allowHtml: false, maxLength: 128 });

      if (!sessionUserId || expectedUserId !== sessionUserId) {
        return { data: null, error: new Error("Caller identity does not match authenticated user") };
      }
    }

    return { data: tenants, error: null };
  } catch (err) {
    const error = err instanceof Error ? err : new Error("Unknown error fetching tenants");
    logger.error("Exception fetching user tenants", error);
    return { data: null, error };
  }
}

/**
 * Validate that a user has access to a specific tenant
 *
 * SECURITY: This is a client-side check. The backend MUST also validate.
 */
export async function validateTenantAccess(tenantId: string, guard?: TenantMembershipQueryGuard): Promise<boolean> {
  const sanitizedTenantId = sanitizeInput(tenantId, { allowHtml: false, maxLength: 128 });
  const { data: tenants, error } = await fetchUserTenants(guard);

  if (error || !tenants) {
    logger.warn("Cannot validate tenant access", { tenantId: sanitizedTenantId, error });
    return false;
  }

  const hasAccess = tenants.some((t) => t.id === sanitizedTenantId);

  if (!hasAccess) {
    logger.warn("User does not have access to tenant", { tenantId: sanitizedTenantId });
  }

  return hasAccess;
}

/**
 * Get tenant details by ID
 */
export async function getTenantById(tenantId: string): Promise<TenantApiResponse<TenantInfo>> {
  const sanitizedTenantId = sanitizeInput(tenantId, { allowHtml: false, maxLength: 128 });

  try {
    const response = await apiClient.get<{ data: TenantInfo | null; error: string | null }>(
      `/v1/tenant/${encodeURIComponent(sanitizedTenantId)}`
    );

    if (!response.data.data) {
      return { data: null, error: new Error(response.data.error ?? "Tenant not found") };
    }

    return { data: response.data.data, error: null };
  } catch (err) {
    const error = err instanceof Error ? err : new Error("Unknown error");
    logger.error("Exception fetching tenant", error, { tenantId: sanitizedTenantId });
    return { data: null, error };
  }
}
