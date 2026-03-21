/**
 * Redis utility helpers for the backend.
 *
 * Centralizes access to the shared Redis client and adds a small helper
 * layer for JSON caching (get/set/delete by key or pattern) plus simple
 * connection status checks. Everything is built on top of the shared
 * `getRedisClient` so connection reuse and configuration stay consistent.
 */

import {
  getRedisClient as getSharedRedisClient,
  type RedisClientRole,
} from "@shared/lib/redisClient";
import { getRedisKey } from "@shared/lib/redisKeys";
import type { Redis } from "ioredis";

import { logger } from "./logger.js";
import { createCounter } from "./observability/index.js";

// Re-export the ioredis Redis type as RedisClientType for backward compatibility
export type RedisClientType = Redis;

const cachedClients = new Map<RedisClientRole, Redis>();
const instrumentedClients = new WeakSet<Redis>();
const redisClientReconnectsTotal = createCounter(
  "valuecanvas_redis_client_reconnects_total",
  "Redis client reconnect attempts by logical role",
  ["role"],
);

function attachRedisMetrics(client: Redis, role: RedisClientRole): void {
  if (instrumentedClients.has(client)) {
    return;
  }

  client.on("reconnecting", () => {
    redisClientReconnectsTotal.inc({ role });
  });

  instrumentedClients.add(client);
}

/**
 * Get (or establish) a shared Redis client.
 * Returns null if Redis is unavailable, allowing callers to gracefully
 * degrade to in-memory fallbacks.
 */
export async function getRedisClient(role: RedisClientRole = "control-plane"): Promise<Redis | null> {
  const existing = cachedClients.get(role);
  if (existing) {
    return existing;
  }

  try {
    const client = getSharedRedisClient(role);
    cachedClients.set(role, client);
    attachRedisMetrics(client, role);
    return client;
  } catch (error) {
    logger.warn("Redis unavailable, using in-memory fallback", {
      role,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Lightweight connection indicator.
 */
export function isRedisConnected(role: RedisClientRole = "control-plane"): boolean {
  const client = cachedClients.get(role) ?? null;
  return Boolean(client?.isOpen || (client as { isReady?: boolean } | null)?.isReady);
}

/**
 * Store JSON-serializable data with optional TTL (seconds).
 */
export async function setCache(
  key: string,
  value: unknown,
  ttlSeconds = 300,
  role: RedisClientRole = "control-plane",
): Promise<boolean> {
  const client = await getRedisClient(role);
  if (!client) return false;

  try {
    const payload = JSON.stringify(value);
    if (ttlSeconds > 0) {
      await client.set(key, payload, { EX: ttlSeconds });
    } else {
      await client.set(key, payload);
    }
    return true;
  } catch (error) {
    logger.error("Redis set failed", error as Error, { key, role });
    return false;
  }
}

/**
 * Fetch and parse cached JSON data.
 */
export async function getCache<T = unknown>(key: string, role: RedisClientRole = "control-plane"): Promise<T | null> {
  const client = await getRedisClient(role);
  if (!client) return null;

  try {
    const raw = await client.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (error) {
    logger.error("Redis get failed", error as Error, { key, role });
    return null;
  }
}

/**
 * Delete a single key.
 */
export async function deleteCache(key: string, role: RedisClientRole = "control-plane"): Promise<boolean> {
  const client = await getRedisClient(role);
  if (!client) return false;

  try {
    const deleted = await client.del(key);
    return deleted > 0;
  } catch (error) {
    logger.error("Redis delete failed", error as Error, { key, role });
    return false;
  }
}

/**
 * Delete all keys matching a pattern. Uses SCAN to avoid blocking Redis.
 */
export async function deleteCachePattern(
  pattern: string,
  role: RedisClientRole = "control-plane",
): Promise<number> {
  const client = await getRedisClient(role);
  if (!client) return 0;

  let cursor = "0";
  let deleted = 0;

  try {
    do {
      const [nextCursor, keys] = await client.scan(cursor, {
        MATCH: pattern,
        COUNT: 100,
      });
      cursor = nextCursor;

      if (keys.length) {
        deleted += await client.del(keys);
      }
    } while (cursor !== "0");

    return deleted;
  } catch (error) {
    logger.error("Redis pattern delete failed", error as Error, { pattern, role });
    return deleted;
  }
}

export { getRedisKey };
