export interface TenantContextMatchInput {
  expectedOrganizationId: string;
  contextOrganizationId: string;
  source: string;
}

/**
 * Hard guard against cross-tenant execution by ensuring context tenant identity
 * matches the authoritative tenant identity from the execution entrypoint.
 */
export function assertTenantContextMatch({
  expectedOrganizationId,
  contextOrganizationId,
  source,
}: TenantContextMatchInput): void {
  if (!expectedOrganizationId || !contextOrganizationId) {
    throw new Error(`${source}: missing tenant identity for execution context`);
  }

  if (expectedOrganizationId !== contextOrganizationId) {
    throw new Error(
      `${source}: tenant context mismatch (expected ${expectedOrganizationId}, got ${contextOrganizationId})`,
    );
  }
}
