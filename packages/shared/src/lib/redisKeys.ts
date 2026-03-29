/**
 * Security error thrown when tenant context is missing for cache operations.
 * This prevents cross-tenant cache poisoning by rejecting cache operations
 * without explicit tenant context.
 */
export class MissingTenantContextError extends Error {
  constructor(
    message = "Tenant context is required for cache operations. 'public' namespace is not allowed.",
    public readonly operation: string = "cache"
  ) {
    super(message);
    this.name = "MissingTenantContextError";
  }
}

/**
 * Small helper to enforce tenant namespaced redis keys.
 * Always call `ns(organizationId, key)` to avoid accidental cross-tenant keys.
 * SECURITY: Throws MissingTenantContextError if organizationId is null/undefined.
 */
export function ns(organizationId: string | undefined | null, key: string): string {
  if (!organizationId) {
    throw new MissingTenantContextError(
      `Tenant context is required for cache key generation. Key: ${key}`,
      "ns"
    );
  }
  const org = organizationId.toString();
  const sanitized = key.replace(/^:+|:+$/g, '');
  return `${org}:${sanitized}`;
}

export const CACHE_TTL_TIERS_SECONDS = {
  hot: 30,
  warm: 120,
  cold: 600,
} as const;

export type CacheTtlTier = keyof typeof CACHE_TTL_TIERS_SECONDS;

export function tenantReadCacheKey(params: {
  tenantId: string | undefined | null;
  endpoint: string;
  scope?: string;
  queryHash?: string;
}): string {
  const scopeSegment = params.scope ? `:${params.scope}` : '';
  const querySegment = params.queryHash ? `:${params.queryHash}` : '';
  return ns(params.tenantId, `read-cache:${params.endpoint}${scopeSegment}${querySegment}`);
}

export function tenantReadCachePattern(params: {
  tenantId: string | undefined | null;
  endpoint: string;
}): string {
  return ns(params.tenantId, `read-cache:${params.endpoint}*`);
}

// Backwards-compatible helper name used by backend
export const getRedisKey = ns;

export default ns;
