/**
 * Cache Module Index
 *
 * Exports all caching-related functionality
 */

export type { CacheLayer, CacheConfig, CacheEntry, CacheStats } from "./MultiLevelCache";

export {
  MultiLevelCache,
  MemoryCache,
  SessionCache,
  CacheFactory,
  globalCache,
  cached,
} from "./MultiLevelCache";
