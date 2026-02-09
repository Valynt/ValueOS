/**
 * Small helper to enforce tenant namespaced redis keys.
 * Always call `ns(organizationId, key)` to avoid accidental cross-tenant keys.
 */
export declare function ns(organizationId: string | undefined | null, key: string): string;
export declare const getRedisKey: typeof ns;
export default ns;
//# sourceMappingURL=redisKeys.d.ts.map