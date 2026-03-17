interface AssertTenantContextMatchParams {
  expectedTenantId: string;
  /** Alias for expectedTenantId — accepted for backward compatibility. */
  expectedOrganizationId?: string;
  /** Alias for actualTenantId — accepted for backward compatibility. */
  contextOrganizationId?: string;
  actualTenantId: string | null | undefined;
  source: string;
}

/**
 * Enforces tenant context consistency across execution boundaries.
 * Throws when a context carries a tenant that does not match the
 * authoritative tenant for the current execution.
 */
export function assertTenantContextMatch({
  expectedTenantId,
  actualTenantId,
  source,
}: AssertTenantContextMatchParams): void {
  if (!expectedTenantId) {
    throw new Error(`Missing authoritative tenant id in ${source}`);
  }

  if (!actualTenantId) {
    return;
  }

  if (actualTenantId !== expectedTenantId) {
    throw new Error(
      `Tenant context mismatch in ${source}: expected ${expectedTenantId}, received ${actualTenantId}`,
    );
  }
}
