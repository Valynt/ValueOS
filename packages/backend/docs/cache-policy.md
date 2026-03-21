# Production cache policy

## Canonical policy

- **L1 near-cache** is allowed only for very short-lived hot reads and only when Redis is healthy.
- **L2 Redis** is the canonical shared cache for all cross-pod cacheable results.
- **No standalone process-local caches** may back cross-pod hot paths in production. If Redis is unavailable, the default production behavior is to **bypass the cache** or **fail closed** for security-sensitive middleware instead of silently changing consistency models.

## Inventory of in-process caches reviewed in this change

| Location | In-process mechanism | Classification | Notes |
|---|---|---|---|
| `src/services/cache/ReadThroughCacheService.ts` | `nearCache: Map<string, NearCacheEntry>` | **Remain** | Keep as L1 only for ultra-short TTL hot reads; do not use as standalone fallback when Redis is unavailable. |
| `src/services/cache/ReadThroughCacheService.ts` | `inFlightLoads: Map<string, Promise<unknown>>` | **Remain** | Request coalescing only; this is single-flight control, not shared result caching. |
| `src/services/cache/AgentCache.ts` | `nearCache: Map<string, CacheEntry>` | **Remain** | Keep as L1 only when Redis is healthy; disable for idempotency and other consistency-critical namespaces. |
| `src/services/memory/VectorSearchService.ts` | `cache: Map<string, SearchResult[]>` + `setTimeout` eviction | **Move to Redis** | Replaced with tenant-scoped `ReadThroughCacheService` entries so semantic search stays cross-pod consistent. |
| `src/services/auth/PermissionService.ts` | `roleCache: Map<string, CachedRole>` | **Remain** | Keep only as short-lived L1 near-cache backed by Redis; do not silently become the only cache in production. |
| `src/middleware/rateLimiter.ts` | `memoryStore: Map<string, { count, resetTime }>` | **Dev/test-only / operator override** | Production-sensitive endpoints must require the distributed store; memory fallback is only acceptable outside production or under explicit override. |
| `src/middleware/nonceStore.ts` | `memory: Map<string, number>` | **Dev/test-only** | Production replay protection must use Redis; local memory fallback is no longer acceptable in production. |
| `src/middleware/auth.ts` | `fallbackActivations: number[]` | **Dev/test-only** | Emergency JWT fallback alert counting may use process-local storage outside production only; production records must stay explicit about degraded telemetry. |

## Cache-key requirements

- All shared cache keys must carry **tenant scope**.
- Cache keys must hash **normalized request dimensions** so equivalent requests map to the same Redis entry.
- For agent outputs, normalized dimensions include the query, normalized context, parameters, and Ground Truth request options.
- For vector search, normalized dimensions include the embedding hash, threshold, limit, lineage flag, and tenant-scoped filters.

## Fallback rules

- **Read caches:** bypass caching and load from source when Redis is unavailable.
- **Security-sensitive middleware:** fail closed in production when Redis is required for correctness.
- **Metrics:** every namespace should report request outcomes, fill latency, evictions, hit rate, and fallback-mode transitions.
