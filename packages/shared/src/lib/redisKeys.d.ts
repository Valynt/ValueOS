/**
 * Small helper to enforce tenant namespaced redis keys.
 * Always call `ns(organizationId, key)` to avoid accidental cross-tenant keys.
 */
export declare function ns(organizationId: string | undefined | null, key: string): string;

export declare const CACHE_TTL_TIERS_SECONDS: {
  readonly hot: 30;
  readonly warm: 120;
  readonly cold: 600;
};

export declare type CacheTtlTier = keyof typeof CACHE_TTL_TIERS_SECONDS;

export declare function tenantReadCacheKey(params: {
  tenantId: string | undefined | null;
  endpoint: string;
  scope?: string;
  queryHash?: string;
}): string;

export declare function tenantReadCachePattern(params: {
  tenantId: string | undefined | null;
  endpoint: string;
}): string;

export declare const getRedisKey: typeof ns;
export default ns;
//# sourceMappingURL=redisKeys.d.ts.map