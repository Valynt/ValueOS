/**
 * OAuth State Store
 *
 * Stores opaque nonces for OAuth CSRF protection. Each nonce maps to
 * { tenantId, provider, redirectUri } and is consumed exactly once.
 *
 * Uses Redis when available, falls back to in-memory Map.
 * Nonces expire after 10 minutes.
 */

import crypto from "crypto";
import { createLogger } from "../../lib/logger.js";
import type { CrmProvider } from "./types.js";

const logger = createLogger({ component: "OAuthStateStore" });

const STATE_TTL_SECONDS = 600; // 10 minutes
const REDIS_PREFIX = "oauth_state:";

export interface OAuthStateMeta {
  tenantId: string;
  provider: CrmProvider;
  redirectUri: string;
  createdAt: number;
}

// In-memory fallback store
const memoryStore = new Map<string, { meta: OAuthStateMeta; expiresAt: number }>();

let redisClient: {
  set(key: string, value: string, options?: { EX?: number }): Promise<unknown>;
  get(key: string): Promise<string | null>;
  del(key: string): Promise<unknown>;
} | null = null;

/**
 * Optionally inject a Redis client for distributed state storage.
 * Call once at startup if Redis is available.
 */
export function setOAuthStateRedis(client: typeof redisClient): void {
  redisClient = client;
}

/**
 * Generate an opaque nonce and persist the associated metadata.
 * Returns the nonce to be used as the OAuth `state` parameter.
 */
export async function createOAuthState(meta: OAuthStateMeta): Promise<string> {
  const nonce = crypto.randomBytes(32).toString("hex");

  if (redisClient) {
    try {
      await redisClient.set(
        `${REDIS_PREFIX}${nonce}`,
        JSON.stringify(meta),
        { EX: STATE_TTL_SECONDS }
      );
      return nonce;
    } catch (err) {
      logger.warn("Redis OAuth state write failed, falling back to memory", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // In-memory fallback
  memoryStore.set(nonce, {
    meta,
    expiresAt: Date.now() + STATE_TTL_SECONDS * 1000,
  });

  return nonce;
}

/**
 * Consume a nonce: look up its metadata, delete it (one-time use), and return
 * the metadata. Returns null if the nonce is missing, expired, or already consumed.
 */
export async function consumeOAuthState(
  nonce: string,
  expectedProvider: CrmProvider
): Promise<OAuthStateMeta | null> {
  if (redisClient) {
    try {
      const raw = await redisClient.get(`${REDIS_PREFIX}${nonce}`);
      if (!raw) return null;

      // Delete immediately — one-time consumption
      await redisClient.del(`${REDIS_PREFIX}${nonce}`);

      const meta: OAuthStateMeta = JSON.parse(raw);

      if (meta.provider !== expectedProvider) {
        logger.warn("OAuth state provider mismatch", {
          expected: expectedProvider,
          actual: meta.provider,
          tenantId: meta.tenantId,
        });
        return null;
      }

      return meta;
    } catch (err) {
      logger.warn("Redis OAuth state read failed, trying memory", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // In-memory fallback
  const entry = memoryStore.get(nonce);
  if (!entry) return null;

  // Delete immediately
  memoryStore.delete(nonce);

  // Check expiry
  if (Date.now() > entry.expiresAt) {
    logger.warn("OAuth state expired", { tenantId: entry.meta.tenantId });
    return null;
  }

  // Check provider match
  if (entry.meta.provider !== expectedProvider) {
    logger.warn("OAuth state provider mismatch", {
      expected: expectedProvider,
      actual: entry.meta.provider,
    });
    return null;
  }

  return entry.meta;
}

/**
 * Purge expired entries from the in-memory store.
 * Called periodically or on demand. Redis entries auto-expire via TTL.
 */
export function purgeExpiredStates(): number {
  const now = Date.now();
  let purged = 0;
  for (const [key, entry] of memoryStore) {
    if (now > entry.expiresAt) {
      memoryStore.delete(key);
      purged++;
    }
  }
  return purged;
}
