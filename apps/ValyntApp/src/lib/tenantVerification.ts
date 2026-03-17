/**
 * Tenant verification utilities.
 *
 * These functions verify tenant membership and existence by querying the
 * profiles table via the Supabase client. They fail closed — any error
 * returns false / null rather than throwing.
 */

import { supabase } from "./supabase";

export class TenantSecurityError extends Error {
  constructor(
    message: string,
    public readonly userId: string,
    public readonly tenantId: string
  ) {
    super(message);
    this.name = "TenantSecurityError";
  }
}

/** Returns true when the user's profile belongs to the given organization. */
export async function verifyTenantMembership(
  userId: string,
  tenantId: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", userId)
      .single();

    if (error || !data) return false;
    return (data as { organization_id: string }).organization_id === tenantId;
  } catch {
    return false;
  }
}

/**
 * Asserts that the user belongs to the tenant.
 * Throws TenantSecurityError if verification fails.
 */
export async function assertTenantMembership(
  userId: string,
  tenantId: string
): Promise<void> {
  const belongs = await verifyTenantMembership(userId, tenantId);
  if (!belongs) {
    throw new TenantSecurityError(
      `User ${userId} does not belong to tenant ${tenantId}`,
      userId,
      tenantId
    );
  }
}

/** Returns the organization_id for the given user, or null if not found. */
export async function getUserTenantId(userId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", userId)
      .single();

    if (error || !data) return null;
    return (data as { organization_id: string }).organization_id ?? null;
  } catch {
    return null;
  }
}

/** Returns true when the organization exists and is active. */
export async function verifyTenantExists(tenantId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("organizations")
      .select("id, status")
      .eq("id", tenantId)
      .single();

    if (error || !data) return false;
    return (data as { status: string }).status === "active";
  } catch {
    return false;
  }
}

// Legacy aliases kept for backward compatibility
export async function verifyTenant(tenantId: string): Promise<boolean> {
  return verifyTenantExists(tenantId);
}

export function getTenantId(): string | undefined {
  return undefined;
}
