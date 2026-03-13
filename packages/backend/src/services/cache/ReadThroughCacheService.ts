import crypto from "node:crypto";

import {
  CACHE_TTL_TIERS_SECONDS,
  CacheTtlTier,
  tenantReadCacheKey,
  tenantReadCachePattern,
} from "@shared/lib/redisKeys";

import { readCacheEventsTotal } from "../../lib/metrics/httpMetrics.js";
import { getRedisClient } from "../../lib/redisClient.js";

interface RedisDeletionPipeline {
  unlink: (key: string) => RedisDeletionPipeline;
  del: (key: string) => RedisDeletionPipeline;
  exec: () => Promise<Array<number | null>>;
}

interface RedisWithScanAndMulti {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, options: { EX: number }) => Promise<unknown>;
  scan: (
    cursor: string,
    options: { MATCH: string; COUNT: number }
  ) => Promise<[string, string[]]>;
  multi: () => RedisDeletionPipeline;
}

export interface ReadCacheConfig {
  endpoint: string;
  tenantId: string;
  scope?: string;
  tier: CacheTtlTier;
  keyPayload?: unknown;
}

export class ReadThroughCacheService {
  private static readonly INVALIDATION_SCAN_BATCH_SIZE = 100;
  private static readonly INVALIDATION_DELETE_BATCH_SIZE = 100;

  private static async deleteKeysWithCommand(
    keys: string[],
    command: "unlink" | "del",
    createPipeline: () => RedisDeletionPipeline
  ): Promise<number> {
    let deleted = 0;

    for (
      let index = 0;
      index < keys.length;
      index += this.INVALIDATION_DELETE_BATCH_SIZE
    ) {
      const keyBatch = keys.slice(
        index,
        index + this.INVALIDATION_DELETE_BATCH_SIZE
      );
      const pipeline = createPipeline();

      for (const key of keyBatch) {
        if (command === "unlink") {
          pipeline.unlink(key);
        } else {
          pipeline.del(key);
        }
      }

      const result = await pipeline.exec();
      deleted += result.reduce(
        (count, item) => count + (typeof item === "number" ? item : 0),
        0
      );
    }

    return deleted;
  }

  private static async deleteKeys(
    redis: RedisWithScanAndMulti,
    keys: string[]
  ): Promise<number> {
    try {
      return await this.deleteKeysWithCommand(keys, "unlink", () => redis.multi());
    } catch {
      return this.deleteKeysWithCommand(keys, "del", () => redis.multi());
    }
  }

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
    const redis = (await getRedisClient()) as RedisWithScanAndMulti;
    const key = this.createKey(config);

    const cached = await redis.get(key);
    if (cached) {
      readCacheEventsTotal.inc({ endpoint: config.endpoint, event: "hit" });
      return JSON.parse(cached) as T;
    }

    readCacheEventsTotal.inc({ endpoint: config.endpoint, event: "miss" });
    const loaded = await loader();

    // If the loader returns undefined, skip caching to avoid calling
    // JSON.stringify(undefined), which returns undefined (not a string)
    // and would cause redis.set to fail at runtime.
    if (loaded === undefined) {
      return loaded as T;
    }

    const ttl = CACHE_TTL_TIERS_SECONDS[config.tier];
    await redis.set(key, JSON.stringify(loaded), { EX: ttl });
    return loaded;
  }

  static async invalidateEndpoint(
    tenantId: string,
    endpoint: string
  ): Promise<number> {
    const redis = (await getRedisClient()) as RedisWithScanAndMulti;
    const pattern = tenantReadCachePattern({ tenantId, endpoint });
    let cursor = "0";
    let deleted = 0;

    do {
      const [nextCursor, keys] = await redis.scan(cursor, {
        MATCH: pattern,
        COUNT: this.INVALIDATION_SCAN_BATCH_SIZE,
      });
      cursor = nextCursor;

      if (!keys.length) {
        continue;
      }

      deleted += await this.deleteKeys(redis, keys);
    } while (cursor !== "0");

    if (!deleted) {
      return 0;
    }

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

  // Prioritize headers (from the client/gateway) over internal req properties
  const tenant =
    (Array.isArray(tenantHeader) ? tenantHeader[0] : tenantHeader) ||
    (Array.isArray(organizationHeader) ? organizationHeader[0] : organizationHeader) ||
    req.tenantId;

  // Return undefined rather than a "public" sentinel so callers can
  // distinguish "no tenant" from a real tenant named "public".
  return tenant || undefined;
}
