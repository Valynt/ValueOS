/**
 * Tenant API Client
 *
 * Provides typed API calls for tenant-related operations.
 * Uses feature flag to enable/disable real API calls.
 */

import { createLogger } from "../lib/logger";
import { supabase } from "../lib/supabase";

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

/**
 * Check if tenant API is enabled via feature flag
 */
export function isTenantApiEnabled(): boolean {
  return import.meta.env.VITE_TENANTS_API_ENABLED !== "false";
}

/**
 * Fetch all tenants the current user has access to
 *
 * SECURITY: This queries user_tenants table which is RLS-protected.
 * The backend validates the user's session before returning data.
 */
export async function fetchUserTenants(userId: string): Promise<TenantApiResponse<TenantInfo[]>> {
  if (!isTenantApiEnabled()) {
    logger.warn("Tenant API disabled, returning empty list");
    return { data: [], error: null };
  }

  if (!supabase) {
    logger.error("Supabase client not configured");
    return {
      data: null,
      error: new Error("Database connection unavailable"),
    };
  }

  try {
    const { data, error } = await supabase
      .from("user_tenants")
      .select(
        `
        tenant_id,
        role,
        status,
        tenants:tenant_id (
          id,
          name,
          slug,
          settings
        )
      `
      )
      .eq("user_id", userId)
      .eq("status", "active");

    if (error) {
      logger.error("Failed to fetch user tenants", error, { userId });
      return { data: null, error };
    }

    if (!data || data.length === 0) {
      logger.info("User has no active tenants", { userId });
      return { data: [], error: null };
    }

    const tenants: TenantInfo[] = data.map((row: any) => ({
      id: row.tenant_id,
      name: row.tenants?.name || "Unknown Tenant",
      slug: row.tenants?.slug || row.tenant_id,
      color: row.tenants?.settings?.brandColor || "#18C3A5",
      role: row.role || "member",
      status: row.status,
      createdAt: row.tenants?.created_at || new Date().toISOString(),
    }));

    logger.debug("Fetched user tenants", { userId, count: tenants.length });
    return { data: tenants, error: null };
  } catch (err) {
    const error = err instanceof Error ? err : new Error("Unknown error fetching tenants");
    logger.error("Exception fetching user tenants", error, { userId });
    return { data: null, error };
  }
}

/**
 * Validate that a user has access to a specific tenant
 *
 * SECURITY: This is a client-side check. The backend MUST also validate.
 */
export async function validateTenantAccess(userId: string, tenantId: string): Promise<boolean> {
  const { data: tenants, error } = await fetchUserTenants(userId);

  if (error || !tenants) {
    logger.warn("Cannot validate tenant access", { userId, tenantId, error });
    return false;
  }

  const hasAccess = tenants.some((t) => t.id === tenantId);

  if (!hasAccess) {
    logger.warn("User does not have access to tenant", { userId, tenantId });
  }

  return hasAccess;
}

/**
 * Get tenant details by ID
 */
export async function getTenantById(tenantId: string): Promise<TenantApiResponse<TenantInfo>> {
  if (!supabase) {
    return { data: null, error: new Error("Database connection unavailable") };
  }

  try {
    const { data, error } = await supabase
      .from("tenants")
      .select("id, name, slug, settings, created_at")
      .eq("id", tenantId)
      .single();

    if (error) {
      logger.error("Failed to fetch tenant", error, { tenantId });
      return { data: null, error };
    }

    if (!data) {
      return { data: null, error: new Error("Tenant not found") };
    }

    const tenant: TenantInfo = {
      id: data.id,
      name: data.name,
      slug: data.slug,
      color: data.settings?.brandColor || "#18C3A5",
      role: "member",
      status: "active",
      createdAt: data.created_at,
    };

    return { data: tenant, error: null };
  } catch (err) {
    const error = err instanceof Error ? err : new Error("Unknown error");
    return { data: null, error };
  }
}
