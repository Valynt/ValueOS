import { z } from "zod";

/**
 * Canonical identity contract for backend runtime code.
 *
 * Primary key: organization_id
 * Accepted aliases (ingress-only): tenant_id, org_id, tid
 */
export const CANONICAL_ORGANIZATION_ID_KEY = "organization_id" as const;

export const LEGACY_ORGANIZATION_ID_ALIASES = [
  "tenant_id",
  "org_id",
  "tid",
] as const;

export type LegacyOrganizationIdAlias = (typeof LEGACY_ORGANIZATION_ID_ALIASES)[number];

export interface CanonicalIdentity {
  organization_id: string;
}

export type IdentityAliases = Partial<CanonicalIdentity> & {
  tenant_id?: string;
  org_id?: string;
  tid?: string;
};

export const IdentityAliasesSchema = z
  .object({
    organization_id: z.string().optional(),
    tenant_id: z.string().optional(),
    org_id: z.string().optional(),
    tid: z.string().optional(),
  })
  .strict();

export const resolveOrganizationId = (identity: IdentityAliases): string | null => {
  return identity.organization_id ?? identity.tenant_id ?? identity.org_id ?? identity.tid ?? null;
};

export const toCanonicalIdentity = (identity: IdentityAliases): CanonicalIdentity => {
  const organizationId = resolveOrganizationId(identity);
  if (!organizationId) {
    throw new Error(
      "Canonical identity translation failed: expected organization_id or a supported legacy alias (tenant_id, org_id, tid).",
    );
  }

  return { organization_id: organizationId };
};

/**
 * Adapter for unavoidable legacy auth metadata integrations.
 * Keep all legacy alias projection in this helper.
 */
export const withLegacyOrganizationAliases = <T extends Record<string, unknown>>(
  metadata: T,
  organizationId: string,
): T & CanonicalIdentity & { org_id: string; tenant_id: string } => ({
  ...metadata,
  organization_id: organizationId,
  org_id: organizationId,
  tenant_id: organizationId,
});


export const resolveOrganizationIdFromUnknown = (metadata: Record<string, unknown>): string | null => {
  const candidate = resolveOrganizationId({
    organization_id: typeof metadata.organization_id === "string" ? metadata.organization_id : undefined,
    tenant_id: typeof metadata.tenant_id === "string" ? metadata.tenant_id : undefined,
    org_id: typeof metadata.org_id === "string" ? metadata.org_id : undefined,
    tid: typeof metadata.tid === "string" ? metadata.tid : undefined,
  });

  return candidate;
};
