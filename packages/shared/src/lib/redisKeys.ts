/**
 * Small helper to enforce tenant namespaced redis keys.
 * Always call `ns(organizationId, key)` to avoid accidental cross-tenant keys.
 */
export function ns(organizationId: string | undefined | null, key: string): string {
  const org = (organizationId || 'public').toString();
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
