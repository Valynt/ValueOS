import { createCounter, createHistogram } from '../../config/telemetry';
import { createLogger } from '../../lib/logger';
import { getRedisClient } from '../../lib/redisClient';

const logger = createLogger({ component: 'tenant-cache' });

const cacheHitCounter = createCounter(
  'cache.lookup.hit',
  'Total cache hits for tenant-scoped resources'
);

const cacheMissCounter = createCounter(
  'cache.lookup.miss',
  'Total cache misses for tenant-scoped resources'
);

const cacheLatencyHistogram = createHistogram(
  'cache.lookup.duration',
  'Cache lookup duration in milliseconds'
);

export class TenantCache {
  constructor(private ttlSeconds = 300) {}

  buildUserProfileKey(tenantId: string, userId: string): string {
    return `tenant:${tenantId}:profile:${userId}`;
  }

  buildOrgConfigKey(tenantId: string): string {
    return `tenant:${tenantId}:org-config`;
  }

  async get<T>(key: string): Promise<T | null> {
    const start = Date.now();
    try {
      const client = await getRedisClient();
      const cached = await client.get(key);
      cacheLatencyHistogram.record(Date.now() - start, { key });

      if (!cached) {
        cacheMissCounter.add(1, { key });
        return null;
      }

      cacheHitCounter.add(1, { key });
      return JSON.parse(cached) as T;
    } catch (error) {
      logger.warn('Cache get failed, falling back to source', error as Error, { key });
      cacheLatencyHistogram.record(Date.now() - start, { key, error: 'true' });
      return null;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    try {
      const client = await getRedisClient();
      await client.setEx(key, this.ttlSeconds, JSON.stringify(value));
    } catch (error) {
      logger.warn('Cache set failed', error as Error, { key });
    }
  }

  async invalidate(key: string): Promise<void> {
    try {
      const client = await getRedisClient();
      await client.del(key);
    } catch (error) {
      logger.warn('Cache invalidation failed', error as Error, { key });
    }
  }
}

export const tenantCache = new TenantCache();
