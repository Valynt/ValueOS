/**
 * SDUI Cache Service
 *
 * Minimal Redis-backed cache for SDUI schema operations.
 * Replaces the browser/server chimera CacheService for SDUI use cases.
 * Implements content-addressable storage (CAS) for schema versioning.
 *
 * ADR-0012 follow-up: server-side caching uses Redis directly, no browser
 * storage backends.
 */

import { logger } from "../../lib/logger.js";
import { getRedisClient } from "../lib/redisClient.js";

const SCHEMA_CAS_TTL = 60 * 60 * 24 * 7; // 7 days — content-addressed, immutable
const SCHEMA_HEAD_TTL = 60 * 60 * 24;     // 24 hours — head pointer
const SCHEMA_TTL = 60 * 5;                // 5 minutes — legacy TTL cache

// SECURITY: CAS keys are content-addressed by hash — the hash already encodes
// the content uniquely, so cross-tenant collision is not possible for the data
// payload itself. However, the head pointer (workspaceId → hash mapping) must
// be tenant-scoped because workspaceId values are not globally unique.
// CAS entries are intentionally shared (same content = same hash) but head
// pointers must be isolated per tenant.

function casKey(hash: string): string {
  // Content-addressed: hash is globally unique by definition; no tenant prefix needed.
  return `sdui:cas:${hash}`;
}

function headKey(tenantId: string, workspaceId: string): string {
  // SECURITY: tenant-scoped so one tenant cannot read or overwrite another's
  // workspace head pointer even if workspaceId values collide.
  return `sdui:head:${tenantId}:${workspaceId}`;
}

function legacyKey(prefix: string, workspaceId: string): string {
  return `${prefix}${workspaceId}`;
}

export class SDUICacheService {
  // -------------------------------------------------------------------------
  // Legacy TTL-based cache (get / set / delete)
  // -------------------------------------------------------------------------

  async get<T>(key: string): Promise<T | null> {
    try {
      const redis = await getRedisClient();
      const raw = await redis.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch (err) {
      logger.warn("SDUICacheService.get failed", { key, error: (err as Error).message });
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds = SCHEMA_TTL): Promise<void> {
    try {
      const redis = await getRedisClient();
      await redis.set(key, JSON.stringify(value), { EX: ttlSeconds });
    } catch (err) {
      logger.warn("SDUICacheService.set failed", { key, error: (err as Error).message });
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const redis = await getRedisClient();
      await redis.del(key);
    } catch (err) {
      logger.warn("SDUICacheService.delete failed", { key, error: (err as Error).message });
    }
  }

  // -------------------------------------------------------------------------
  // Content-Addressable Storage (CAS)
  // -------------------------------------------------------------------------

  /** Store a value by content hash. Immutable — long TTL. */
  async setCAS<T>(hash: string, value: T): Promise<void> {
    try {
      const redis = await getRedisClient();
      await redis.set(casKey(hash), JSON.stringify(value), { EX: SCHEMA_CAS_TTL });
    } catch (err) {
      logger.warn("SDUICacheService.setCAS failed", { hash, error: (err as Error).message });
    }
  }

  /** Retrieve a value by content hash. */
  async getCAS<T>(hash: string): Promise<T | null> {
    try {
      const redis = await getRedisClient();
      const raw = await redis.get(casKey(hash));
      return raw ? (JSON.parse(raw) as T) : null;
    } catch (err) {
      logger.warn("SDUICacheService.getCAS failed", { hash, error: (err as Error).message });
      return null;
    }
  }

  /** Update the head pointer for a workspace to a new content hash. */
  async setHead(workspaceId: string, hash: string, tenantId?: string): Promise<void> {
    try {
      const redis = await getRedisClient();
      const entry = { hash, updatedAt: Date.now() };
      const tid = tenantId ?? "unknown";
      await redis.set(headKey(tid, workspaceId), JSON.stringify(entry), { EX: SCHEMA_HEAD_TTL });
    } catch (err) {
      logger.warn("SDUICacheService.setHead failed", { workspaceId, error: (err as Error).message });
    }
  }

  /** Get the current head pointer for a workspace. */
  async getHead(workspaceId: string, tenantId?: string): Promise<{ hash: string; updatedAt: number } | null> {
    try {
      const redis = await getRedisClient();
      const tid = tenantId ?? "unknown";
      const raw = await redis.get(headKey(tid, workspaceId));
      return raw ? (JSON.parse(raw) as { hash: string; updatedAt: number }) : null;
    } catch (err) {
      logger.warn("SDUICacheService.getHead failed", { workspaceId, error: (err as Error).message });
      return null;
    }
  }

  /**
   * Resolve head → hash → content in one call.
   * Returns null if either the head or the content is missing.
   */
  async getByResourceId<T>(
    workspaceId: string,
    tenantId?: string,
  ): Promise<{ hash: string; value: T; updatedAt: number } | null> {
    const head = await this.getHead(workspaceId, tenantId);
    if (!head) return null;
    const value = await this.getCAS<T>(head.hash);
    if (!value) return null;
    return { hash: head.hash, value, updatedAt: head.updatedAt };
  }

  /** Convenience key builder for legacy callers. */
  static legacyKey(prefix: string, workspaceId: string): string {
    return legacyKey(prefix, workspaceId);
  }
}
