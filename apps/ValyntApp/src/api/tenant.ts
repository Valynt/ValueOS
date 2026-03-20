/**
 * Tenant API Client
 *
 * Provides typed API calls for tenant-related operations.
 * Uses feature flag to enable/disable real API calls.
 */

import { createLogger } from "../lib/logger";
import { supabase } from "../lib/supabase";
import { sanitizeInput } from "../security/InputSanitizer";

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

interface TenantMembershipRecord {
  tenant_id: string;
  role: string;
  status: TenantInfo["status"];
  tenants?: {
    name?: string;
    slug?: string;
    settings?: { brandColor?: string };
    created_at?: string;
  };
}

type AuthenticatedUserId = string & { readonly __authenticatedUserId: unique symbol };

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
 *
 * SECURITY: This queries user_tenants table which is RLS-protected.
 * The backend validates the user's session before returning data.
 */
async function resolveAuthenticatedUserId(
  guard?: TenantMembershipQueryGuard
): Promise<TenantApiResponse<AuthenticatedUserId>> {
  if (!supabase) {
    logger.error("Supabase client not configured");
    return {
      data: null,
      error: new Error("Database connection unavailable"),
    };
  }

  // getUser() verifies the JWT server-side but requires a network call to Supabase.
  // If that fails (e.g. transient network error or TypeError), fall back to
  // getSession() which reads the locally-stored session without a network round-trip.
  let user: { id: string } | null = null;
  try {
    const { data: getUserData, error: getUserError } = await supabase.auth.getUser();
    if (getUserError) {
      logger.warn("getUser() failed, falling back to getSession()", { error: getUserError });
      const { data: sessionData } = await supabase.auth.getSession();
      user = sessionData?.session?.user ?? null;
    } else {
      user = getUserData.user;
    }
  } catch (networkError) {
    logger.warn("getUser() threw, falling back to getSession()", { error: networkError });
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      user = sessionData?.session?.user ?? null;
    } catch {
      user = null;
    }
  }

  if (!user?.id) {
    logger.warn("Tenant query rejected because session user is missing");
    return { data: null, error: new Error("Authenticated user is required") };
  }

  const sanitizedSessionUserId = sanitizeInput(user.id, { allowHtml: false, maxLength: 128 });
  const sanitizedExpectedUserId = guard?.expectedUserId
    ? sanitizeInput(guard.expectedUserId, { allowHtml: false, maxLength: 128 })
    : undefined;

  if (sanitizedExpectedUserId && sanitizedExpectedUserId !== sanitizedSessionUserId) {
    logger.warn("Tenant query rejected because caller user does not match session user", {
      expectedUserId: sanitizedExpectedUserId,
      sessionUserId: sanitizedSessionUserId,
    });
    return { data: null, error: new Error("Caller identity does not match authenticated user") };
  }

  return { data: sanitizedSessionUserId as AuthenticatedUserId, error: null };
}

export async function fetchUserTenants(
  guard?: TenantMembershipQueryGuard
): Promise<TenantApiResponse<TenantInfo[]>> {
  if (!isTenantApiEnabled()) {
    logger.warn("Tenant API disabled, returning empty list");
    return { data: [], error: null };
  }

  const { data: authenticatedUserId, error: userError } = await resolveAuthenticatedUserId(guard);
  if (userError || !authenticatedUserId) {
    return { data: null, error: userError ?? new Error("Authenticated user is required") };
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
      .eq("user_id", authenticatedUserId)
      .eq("status", "active");

    if (error) {
      logger.error("Failed to fetch user tenants", error, { userId: authenticatedUserId });
      return { data: null, error };
    }

    if (!data || data.length === 0) {
      logger.info("User has no active tenants", { userId: authenticatedUserId });
      return { data: [], error: null };
    }

    const tenants: TenantInfo[] = (data as TenantMembershipRecord[]).map((row) => ({
      id: row.tenant_id,
      name: row.tenants?.name || "Unknown Tenant",
      slug: row.tenants?.slug || row.tenant_id,
      color: row.tenants?.settings?.brandColor || "#18C3A5",
      role: row.role || "member",
      status: row.status,
      createdAt: row.tenants?.created_at || new Date().toISOString(),
    }));

    logger.debug("Fetched user tenants", { userId: authenticatedUserId, count: tenants.length });
    return { data: tenants, error: null };
  } catch (err) {
    const error = err instanceof Error ? err : new Error("Unknown error fetching tenants");
    logger.error("Exception fetching user tenants", error, { userId: authenticatedUserId });
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
  if (!supabase) {
    return { data: null, error: new Error("Database connection unavailable") };
  }

  const sanitizedTenantId = sanitizeInput(tenantId, { allowHtml: false, maxLength: 128 });

  try {
    const { data, error } = await supabase
      .from("tenants")
      .select("id, name, slug, settings, created_at")
      .eq("id", sanitizedTenantId)
      .single();

    if (error) {
      logger.error("Failed to fetch tenant", error, { tenantId: sanitizedTenantId });
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
