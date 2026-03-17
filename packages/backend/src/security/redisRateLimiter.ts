/**
 * Redis-backed RateLimiterProvider example.
 *
 * Usage notes:
 * - This file intentionally depends only on a generic Redis client shape so you can
 *   pass an `ioredis` or `node-redis` client instance.
 * - Example creation: `setAuthRateLimiter(createRedisRateLimiter(redisClient))`
 */

import { RateLimiterProvider, RateLimitExceededError, RateLimitResult } from './index.js'

export interface RedisRateLimiterOptions {
  windowMs?: number;
  maxAttempts?: number;
  prefix?: string;
}

interface RedisLike {
  eval?: (...args: unknown[]) => Promise<unknown>;
  sendCommand?: (args: string[]) => Promise<unknown>;
  incr?: (key: string) => Promise<number>;
  pttl?: (key: string) => Promise<number>;
  pexpire?: (key: string, ms: number) => Promise<unknown>;
}

export function createRedisRateLimiter(redisClient: RedisLike, opts: RedisRateLimiterOptions = {}): RateLimiterProvider {
  const windowMs = opts.windowMs || Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000;
  const maxAttempts = opts.maxAttempts || Number(process.env.AUTH_RATE_LIMIT_MAX) || 5;
  const keyPrefix = opts.prefix || 'auth:';

  // Lua script: increment key, set TTL when first seen, return value
  const lua = `
    local v = redis.call('INCR', KEYS[1])
    if v == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
    return v
  `;

  return {
    async consume(identifier: string): Promise<RateLimitResult> {
      const key = keyPrefix + identifier;
      let val: number;

      try {
        // Prefer EVAL for atomic increment+expire
        if (typeof redisClient.eval === 'function') {
          val = Number(await redisClient.eval(lua, 1, key, String(windowMs)));
        } else if (typeof redisClient.sendCommand === 'function') {
          // node-redis v4 sendCommand
          val = Number(await redisClient.sendCommand(['EVAL', lua, '1', key, String(windowMs)]));
        } else {
          // Fallback: INCR then set PX if needed (not atomic)
          val = Number(await redisClient.incr(key));
          const ttl = await redisClient.pttl(key);
          if (ttl === -1) await redisClient.pexpire(key, windowMs);
        }
      } catch (err) {
        // If Redis unavailable, fail-closed/upstream should handle; here throw so caller can decide
        throw err;
      }

      if (val > maxAttempts) {
        const pttl = await redisClient.pttl(key);
        const retryAfter = pttl > 0 ? Math.ceil(pttl / 1000) : Math.ceil(windowMs / 1000);
        throw new RateLimitExceededError(retryAfter);
      }

      const pttl = await redisClient.pttl(key);
      const resetTime = Date.now() + (pttl > 0 ? pttl : windowMs);
      return { allowed: true, remaining: maxAttempts - val, resetTime };
    },

    async reset(identifier: string): Promise<void> {
      const key = keyPrefix + identifier;
      try { await redisClient.del(key); } catch (err) { /* swallow */ }
    }
  };
}

export default createRedisRateLimiter;
