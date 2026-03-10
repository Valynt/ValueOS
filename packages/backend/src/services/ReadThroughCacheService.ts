import crypto from "node:crypto";

import {
  CACHE_TTL_TIERS_SECONDS,
  CacheTtlTier,
  tenantReadCacheKey,
  tenantReadCachePattern,
} from "@shared/lib/redisKeys";

import { readCacheEventsTotal } from "../lib/metrics/httpMetrics.js";
import { getRedisClient } from "../lib/redisClient.js";

export interface ReadCacheConfig {
  endpoint: string;
  tenantId: string;
  scope?: string;
  tier: CacheTtlTier;
  keyPayload?: unknown;
}

export class ReadThroughCacheService {
  private static hashPayload(payload: unknown): string {
    const serialized = JSON.stringify(payload ?? {});
    return crypto.createHash("sha1").update(serialized).digest("hex");
  }

  private static createKey(config: ReadCacheConfig): string {
    const queryHash = this.hashPayload(config.keyPayload);
    return tenantReadCacheKey({
      tenantId: config.tenantId,
      endpoint: config.endpoint,
      scope: config.scope,
      queryHash,
    });
  }

  static async getOrLoad<T>(
    config: ReadCacheConfig,
    loader: () => Promise<T>
  ): Promise<T> {
    const redis = await getRedisClient();
    const key = this.createKey(config);

    const cached = await redis.get(key);
    if (cached) {
      readCacheEventsTotal.inc({ endpoint: config.endpoint, event: "hit" });
      return JSON.parse(cached) as T;
    }

    readCacheEventsTotal.inc({ endpoint: config.endpoint, event: "miss" });
    const loaded = await loader();
    const ttl = CACHE_TTL_TIERS_SECONDS[config.tier];
    await redis.set(key, JSON.stringify(loaded), { EX: ttl });
    return loaded;
  }

  static async invalidateEndpoint(
    tenantId: string,
    endpoint: string
  ): Promise<number> {
    const redis = await getRedisClient();
    const pattern = tenantReadCachePattern({ tenantId, endpoint });
    const keys = await redis.keys(pattern);
    if (!keys.length) {
      return 0;
    }

    const deleted = await redis.del(keys);
    readCacheEventsTotal.inc({ endpoint, event: "eviction" }, deleted);
    return deleted;
  }
}

export function getTenantIdFromRequest(req: {
  tenantId?: string;
  headers: Record<string, string | string[] | undefined>;
}): string | undefined {
  const tenantHeader = req.headers["x-tenant-id"];
  const organizationHeader = req.headers["x-organization-id"];
  const tenant =
    (Array.isArray(tenantHeader) ? tenantHeader[0] : tenantHeader) ||
    (Array.isArray(organizationHeader) ? organizationHeader[0] : organizationHeader) ||
    req.tenantId;

  // Return undefined rather than a "public" sentinel so callers can
  // distinguish "no tenant" from a real tenant named "public".
  return tenant || undefined;
}
