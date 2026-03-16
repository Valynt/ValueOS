/**
 * Auth-specific Rate Limiting Middleware
 *
 * Addresses brute-force and credential-stuffing attacks on auth endpoints
 * with progressive delays, per-account lockout, and IP-based blocking.
 *
 * Separate from the generic rate limiter because auth routes need:
 * - Per-email tracking (not just per-IP)
 * - Progressive backoff on repeated failures
 * - Temporary account lockout after threshold
 * - Distinct limits per auth action (login vs signup vs password reset)
 *
 * State is stored in Redis so lockouts are enforced across all pods.
 * Falls back to in-memory when Redis is unavailable (degraded mode —
 * per-pod limits apply, logged as a warning).
 */

import { createLogger } from "@shared/lib/logger";
import { getRedisClient } from "@shared/lib/redisClient";
import { NextFunction, Request, Response } from "express";
import { RedisClientType } from "redis";

import { createCounter } from "../lib/observability/index.js";

const logger = createLogger({ component: "AuthRateLimiter" });

// Incremented on every request handled in degraded (in-memory) mode.
// A non-zero rate means distributed rate limiting is not enforced across pods.
// Alert rule: auth_rate_limiter_fallback_active_total rate > 0 over 5m → warning.
const authRateLimiterFallbackCounter = createCounter(
  "auth_rate_limiter_fallback_active_total",
  "Requests handled by in-memory fallback when Redis is unavailable"
);

const authRateLimit429Counter = createCounter(
  "auth_rate_limit_429_total",
  "Auth-specific 429 responses"
);
const authAccountLockoutCounter = createCounter(
  "auth_account_lockout_total",
  "Temporary account lockouts triggered"
);

export interface AuthRateLimitConfig {
  /** Max attempts per window */
  maxAttempts: number;
  /** Window size in ms */
  windowMs: number;
  /** Number of failed attempts before temporary lockout */
  lockoutThreshold: number;
  /** Lockout duration in ms */
  lockoutDurationMs: number;
  /** Progressive delay multiplier per failed attempt (ms) */
  progressiveDelayMs: number;
  /** Max progressive delay cap (ms) */
  maxDelayMs: number;
}

interface AttemptRecord {
  count: number;
  failures: number;
  windowStart: number;
  lockedUntil: number | null;
}

// Redis key helpers — all keys are namespaced under auth:rl: to avoid collisions.
const redisKey = (type: 'count' | 'failures' | 'lockout', dimension: 'ip' | 'email', id: string) =>
  `auth:rl:${type}:${dimension}:${id}`;

const AUTH_CONFIGS: Record<string, AuthRateLimitConfig> = {
  login: {
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
    lockoutThreshold: 10,
    lockoutDurationMs: 15 * 60 * 1000, // 15 minutes
    progressiveDelayMs: 500,
    maxDelayMs: 5000,
  },
  signup: {
    maxAttempts: 3,
    windowMs: 60 * 60 * 1000, // 1 hour
    lockoutThreshold: 5,
    lockoutDurationMs: 60 * 60 * 1000, // 1 hour
    progressiveDelayMs: 1000,
    maxDelayMs: 10000,
  },
  passwordReset: {
    maxAttempts: 3,
    windowMs: 60 * 60 * 1000, // 1 hour
    lockoutThreshold: 5,
    lockoutDurationMs: 60 * 60 * 1000,
    progressiveDelayMs: 1000,
    maxDelayMs: 10000,
  },
  verifyResend: {
    maxAttempts: 3,
    windowMs: 15 * 60 * 1000,
    lockoutThreshold: 5,
    lockoutDurationMs: 30 * 60 * 1000,
    progressiveDelayMs: 1000,
    maxDelayMs: 10000,
  },
};

/**
 * Distributed auth rate limit store backed by Redis.
 *
 * All counters, failure counts, and lockouts are stored in Redis so they are
 * shared across every pod. Falls back to an in-memory map when Redis is
 * unavailable; in that degraded mode each pod enforces its own limits
 * (N × maxAttempts effective limit), which is logged as a warning.
 *
 * Redis key layout (all with TTL):
 *   auth:rl:count:ip:<ip>          — request count in current window
 *   auth:rl:count:email:<email>    — request count in current window
 *   auth:rl:failures:ip:<ip>       — cumulative failure count
 *   auth:rl:failures:email:<email> — cumulative failure count
 *   auth:rl:lockout:ip:<ip>        — lockout expiry timestamp (ms)
 *   auth:rl:lockout:email:<email>  — lockout expiry timestamp (ms)
 */
// After this many consecutive Redis errors, mark the store as not-ready and
// stop attempting Redis calls until a reconnect succeeds.
const REDIS_FAILURE_THRESHOLD = 3;
// How long to wait before attempting to reconnect after circuit opens (ms).
const REDIS_RECONNECT_DELAY_MS = 30_000;

export class AuthRateLimitStore {
  // In-memory fallback used when Redis is unavailable.
  private ipRecords: Map<string, AttemptRecord> = new Map();
  private emailRecords: Map<string, AttemptRecord> = new Map();
  private cleanupInterval: NodeJS.Timeout;
  private redis: RedisClientType | null = null;
  private redisReady = false;
  // Consecutive Redis operation failures since last successful call.
  private redisFailureCount = 0;
  // Prevents duplicate reconnect timers when concurrent requests all fail
  // before redisReady is cleared.
  private reconnectScheduled = false;

  constructor() {
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
    this.connectRedis();
  }

  private connectRedis(): void {
    this.reconnectScheduled = false;
    Promise.resolve(getRedisClient())
      .then((client) => {
        this.redis = client;
        this.redisReady = true;
        this.redisFailureCount = 0;
        this.reconnectScheduled = false;
        logger.info("Auth rate limiter connected to Redis (distributed mode)");
      })
      .catch((err) => {
        logger.warn(
          "Auth rate limiter could not connect to Redis — retrying in " +
          `${REDIS_RECONNECT_DELAY_MS / 1000}s (per-pod limits apply until reconnected)`,
          { error: err instanceof Error ? err.message : String(err) }
        );
        // Keep retrying until Redis comes back. reconnectScheduled is already
        // cleared above so this schedules exactly one new timer.
        this.reconnectScheduled = true;
        setTimeout(() => this.connectRedis(), REDIS_RECONNECT_DELAY_MS);
      });
  }

  /**
   * Record a Redis operation failure. After REDIS_FAILURE_THRESHOLD consecutive
   * failures, opens the circuit (sets redisReady=false) and schedules a reconnect.
   */
  private onRedisError(err: unknown): void {
    this.redisFailureCount++;
    logger.warn("Auth rate limiter Redis operation failed", {
      error: err instanceof Error ? err.message : String(err),
      consecutiveFailures: this.redisFailureCount,
    });

    if (this.redisFailureCount >= REDIS_FAILURE_THRESHOLD && !this.reconnectScheduled) {
      this.redisReady = false;
      this.reconnectScheduled = true;
      logger.warn(
        `Auth rate limiter circuit opened after ${this.redisFailureCount} consecutive Redis failures. ` +
        `Reconnecting in ${REDIS_RECONNECT_DELAY_MS / 1000}s.`
      );
      setTimeout(() => this.connectRedis(), REDIS_RECONNECT_DELAY_MS);
    }
  }

  /** Reset the failure counter after a successful Redis operation. */
  private onRedisSuccess(): void {
    if (this.redisFailureCount > 0) {
      this.redisFailureCount = 0;
    }
  }

  // ── Redis helpers ──────────────────────────────────────────────────────────

  private async redisIncr(key: string, windowMs: number): Promise<number> {
    const pipeline = this.redis!.multi();
    pipeline.incr(key);
    pipeline.pExpire(key, windowMs, 'NX'); // set TTL only on first write
    const results = await pipeline.exec();
    return (results?.[0] as number) ?? 1;
  }

  private async redisIncrFailure(key: string, lockoutDurationMs: number): Promise<number> {
    const pipeline = this.redis!.multi();
    pipeline.incr(key);
    // Keep failure key alive for the lockout window so it survives window resets.
    pipeline.pExpire(key, lockoutDurationMs * 2, 'GT');
    const results = await pipeline.exec();
    return (results?.[0] as number) ?? 1;
  }

  private async redisSetLockout(key: string, expiryMs: number, durationMs: number): Promise<void> {
    await this.redis!.set(key, String(expiryMs), { PX: durationMs });
  }

  private async redisIsLocked(key: string): Promise<boolean> {
    const val = await this.redis!.get(key);
    if (!val) return false;
    return Number(val) > Date.now();
  }

  private async redisGetFailures(key: string): Promise<number> {
    const val = await this.redis!.get(key);
    return val ? parseInt(val, 10) : 0;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  async increment(
    ip: string,
    email: string | undefined,
    config: AuthRateLimitConfig
  ): Promise<{ ipRecord: AttemptRecord; emailRecord: AttemptRecord | null }> {
    if (this.redisReady && this.redis) {
      try {
        const ipCount = await this.redisIncr(redisKey('count', 'ip', ip), config.windowMs);
        const ipFailures = await this.redisGetFailures(redisKey('failures', 'ip', ip));
        const ipRecord: AttemptRecord = {
          count: ipCount,
          failures: ipFailures,
          windowStart: Date.now(),
          lockedUntil: null,
        };

        let emailRecord: AttemptRecord | null = null;
        if (email) {
          const norm = email.toLowerCase().trim();
          const emailCount = await this.redisIncr(redisKey('count', 'email', norm), config.windowMs);
          const emailFailures = await this.redisGetFailures(redisKey('failures', 'email', norm));
          emailRecord = {
            count: emailCount,
            failures: emailFailures,
            windowStart: Date.now(),
            lockedUntil: null,
          };
        }
        this.onRedisSuccess();
        return { ipRecord, emailRecord };
      } catch (err) {
        this.onRedisError(err);
      }
    }
    authRateLimiterFallbackCounter.inc();
    return this.incrementInMemory(ip, email, config);
  }

  async recordFailure(
    ip: string,
    email: string | undefined,
    config: AuthRateLimitConfig
  ): Promise<void> {
    if (this.redisReady && this.redis) {
      try {
        const ipFailures = await this.redisIncrFailure(
          redisKey('failures', 'ip', ip),
          config.lockoutDurationMs
        );
        if (ipFailures >= config.lockoutThreshold) {
          const expiry = Date.now() + config.lockoutDurationMs;
          await this.redisSetLockout(redisKey('lockout', 'ip', ip), expiry, config.lockoutDurationMs);
          authAccountLockoutCounter.inc();
          logger.warn("IP locked out due to repeated failures", {
            ip, failures: ipFailures, lockoutDurationMs: config.lockoutDurationMs,
          });
        }

        if (email) {
          const norm = email.toLowerCase().trim();
          const emailFailures = await this.redisIncrFailure(
            redisKey('failures', 'email', norm),
            config.lockoutDurationMs
          );
          if (emailFailures >= config.lockoutThreshold) {
            const expiry = Date.now() + config.lockoutDurationMs;
            await this.redisSetLockout(redisKey('lockout', 'email', norm), expiry, config.lockoutDurationMs);
            authAccountLockoutCounter.inc();
            logger.warn("Account locked out due to repeated failures", {
              failures: emailFailures, lockoutDurationMs: config.lockoutDurationMs,
            });
          }
        }
        this.onRedisSuccess();
        return;
      } catch (err) {
        this.onRedisError(err);
      }
    }
    authRateLimiterFallbackCounter.inc();
    this.recordFailureInMemory(ip, email, config);
  }

  async isLocked(ip: string, email: string | undefined): Promise<boolean> {
    if (this.redisReady && this.redis) {
      try {
        if (await this.redisIsLocked(redisKey('lockout', 'ip', ip))) return true;
        if (email) {
          const norm = email.toLowerCase().trim();
          if (await this.redisIsLocked(redisKey('lockout', 'email', norm))) return true;
        }
        this.onRedisSuccess();
        return false;
      } catch (err) {
        this.onRedisError(err);
      }
    }
    authRateLimiterFallbackCounter.inc();
    return this.isLockedInMemory(ip, email);
  }

  async getProgressiveDelay(
    ip: string,
    email: string | undefined,
    config: AuthRateLimitConfig
  ): Promise<number> {
    let maxFailures = 0;

    if (this.redisReady && this.redis) {
      try {
        maxFailures = Math.max(
          maxFailures,
          await this.redisGetFailures(redisKey('failures', 'ip', ip))
        );
        if (email) {
          const norm = email.toLowerCase().trim();
          maxFailures = Math.max(
            maxFailures,
            await this.redisGetFailures(redisKey('failures', 'email', norm))
          );
        }
        this.onRedisSuccess();
      } catch (err) {
        this.onRedisError(err);
        // Preserve any Redis-sourced count already in maxFailures; take the
        // higher of that and the in-memory count so we never undercount.
        maxFailures = Math.max(maxFailures, this.getProgressiveDelayInMemory(ip, email));
      }
    } else {
      maxFailures = this.getProgressiveDelayInMemory(ip, email);
    }

    if (maxFailures <= 1) return 0;
    return Math.min((maxFailures - 1) * config.progressiveDelayMs, config.maxDelayMs);
  }

  // ── In-memory fallback ─────────────────────────────────────────────────────

  private getOrCreate(
    map: Map<string, AttemptRecord>,
    key: string,
    windowMs: number
  ): AttemptRecord {
    const now = Date.now();
    const existing = map.get(key);
    if (!existing || now - existing.windowStart > windowMs) {
      const record: AttemptRecord = {
        count: 0,
        failures: 0,
        windowStart: now,
        lockedUntil: existing?.lockedUntil ?? null,
      };
      map.set(key, record);
      return record;
    }
    return existing;
  }

  private incrementInMemory(
    ip: string,
    email: string | undefined,
    config: AuthRateLimitConfig
  ): { ipRecord: AttemptRecord; emailRecord: AttemptRecord | null } {
    const ipRecord = this.getOrCreate(this.ipRecords, ip, config.windowMs);
    ipRecord.count++;
    let emailRecord: AttemptRecord | null = null;
    if (email) {
      const norm = email.toLowerCase().trim();
      emailRecord = this.getOrCreate(this.emailRecords, norm, config.windowMs);
      emailRecord.count++;
    }
    return { ipRecord, emailRecord };
  }

  private recordFailureInMemory(
    ip: string,
    email: string | undefined,
    config: AuthRateLimitConfig
  ): void {
    const ipRecord = this.getOrCreate(this.ipRecords, ip, config.windowMs);
    ipRecord.failures++;
    if (ipRecord.failures >= config.lockoutThreshold) {
      ipRecord.lockedUntil = Date.now() + config.lockoutDurationMs;
      authAccountLockoutCounter.inc();
      logger.warn("IP locked out (in-memory fallback)", { ip, failures: ipRecord.failures });
    }
    if (email) {
      const norm = email.toLowerCase().trim();
      const emailRecord = this.getOrCreate(this.emailRecords, norm, config.windowMs);
      emailRecord.failures++;
      if (emailRecord.failures >= config.lockoutThreshold) {
        emailRecord.lockedUntil = Date.now() + config.lockoutDurationMs;
        authAccountLockoutCounter.inc();
        logger.warn("Account locked out (in-memory fallback)", { failures: emailRecord.failures });
      }
    }
  }

  private isLockedInMemory(ip: string, email: string | undefined): boolean {
    const now = Date.now();
    const ipRecord = this.ipRecords.get(ip);
    if (ipRecord?.lockedUntil && ipRecord.lockedUntil > now) return true;
    if (ipRecord?.lockedUntil && ipRecord.lockedUntil <= now) {
      ipRecord.lockedUntil = null;
      ipRecord.failures = 0;
    }
    if (email) {
      const norm = email.toLowerCase().trim();
      const emailRecord = this.emailRecords.get(norm);
      if (emailRecord?.lockedUntil && emailRecord.lockedUntil > now) return true;
      if (emailRecord?.lockedUntil && emailRecord.lockedUntil <= now) {
        emailRecord.lockedUntil = null;
        emailRecord.failures = 0;
      }
    }
    return false;
  }

  private getProgressiveDelayInMemory(ip: string, email: string | undefined): number {
    let maxFailures = 0;
    const ipRecord = this.ipRecords.get(ip);
    if (ipRecord) maxFailures = Math.max(maxFailures, ipRecord.failures);
    if (email) {
      const norm = email.toLowerCase().trim();
      const emailRecord = this.emailRecords.get(norm);
      if (emailRecord) maxFailures = Math.max(maxFailures, emailRecord.failures);
    }
    return maxFailures;
  }

  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;
    for (const [key, record] of this.ipRecords.entries()) {
      if (now - record.windowStart > 2 * 60 * 60 * 1000 && (!record.lockedUntil || record.lockedUntil <= now)) {
        this.ipRecords.delete(key);
        cleaned++;
      }
    }
    for (const [key, record] of this.emailRecords.entries()) {
      if (now - record.windowStart > 2 * 60 * 60 * 1000 && (!record.lockedUntil || record.lockedUntil <= now)) {
        this.emailRecords.delete(key);
        cleaned++;
      }
    }
    if (cleaned > 0) logger.debug("Auth rate limit in-memory cleanup", { cleaned });
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.ipRecords.clear();
    this.emailRecords.clear();
  }

  /** Exposed for testing */
  _getIpRecords(): Map<string, AttemptRecord> { return this.ipRecords; }
  _getEmailRecords(): Map<string, AttemptRecord> { return this.emailRecords; }
  _setRedisReady(ready: boolean, client: RedisClientType | null = null): void {
    this.redisReady = ready;
    this.redis = client;
  }
}

// Module-level singleton
const store = new AuthRateLimitStore();

function resolveAction(path: string): string {
  if (path.includes("/login")) return "login";
  if (path.includes("/signup")) return "signup";
  if (path.includes("/password/reset")) return "passwordReset";
  if (path.includes("/verify/resend")) return "verifyResend";
  return "login"; // default to strictest
}

function extractEmail(req: Request): string | undefined {
  return typeof req.body?.email === "string"
    ? req.body.email.toLowerCase().trim()
    : undefined;
}

/**
 * Auth rate limiter middleware factory.
 *
 * Applies per-IP and per-email rate limits with progressive delays
 * and temporary lockout on repeated failures.
 *
 * Usage in auth router:
 *   router.post("/login", authRateLimiter(), validateRequest(...), handler);
 *
 * Call `authRateLimitStore.recordFailure(ip, email, config)` from the
 * route handler on authentication failure to trigger progressive backoff.
 */
export function authRateLimiter(
  actionOverride?: string
): (req: Request, res: Response, next: NextFunction) => void {
  return async (req: Request, res: Response, next: NextFunction) => {
    const action = actionOverride ?? resolveAction(req.path);
    const config = AUTH_CONFIGS[action] ?? AUTH_CONFIGS.login;
    const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
    const email = extractEmail(req);

    // Check lockout first (cross-pod via Redis)
    if (await store.isLocked(ip, email)) {
      authRateLimit429Counter.inc();
      logger.warn("Auth request blocked: account/IP locked", { ip, action });
      return res.status(429).json({
        error: "Too Many Requests",
        message: "Account temporarily locked due to too many failed attempts. Try again later.",
        retryAfter: Math.ceil(config.lockoutDurationMs / 1000),
      });
    }

    // Increment counters (cross-pod via Redis)
    const { ipRecord, emailRecord } = await store.increment(ip, email, config);

    // Check IP-based limit
    if (ipRecord.count > config.maxAttempts) {
      authRateLimit429Counter.inc();
      const retryAfter = Math.ceil(
        (ipRecord.windowStart + config.windowMs - Date.now()) / 1000
      );
      logger.warn("Auth rate limit exceeded (IP)", {
        ip, action, count: ipRecord.count, limit: config.maxAttempts,
      });
      res.setHeader("Retry-After", Math.max(retryAfter, 1));
      return res.status(429).json({
        error: "Too Many Requests",
        message: "Too many authentication attempts. Please try again later.",
        retryAfter: Math.max(retryAfter, 1),
      });
    }

    // Check email-based limit
    if (emailRecord && emailRecord.count > config.maxAttempts) {
      authRateLimit429Counter.inc();
      const retryAfter = Math.ceil(
        (emailRecord.windowStart + config.windowMs - Date.now()) / 1000
      );
      logger.warn("Auth rate limit exceeded (email)", {
        action, count: emailRecord.count, limit: config.maxAttempts,
      });
      res.setHeader("Retry-After", Math.max(retryAfter, 1));
      return res.status(429).json({
        error: "Too Many Requests",
        message: "Too many authentication attempts for this account.",
        retryAfter: Math.max(retryAfter, 1),
      });
    }

    // Apply progressive delay
    const delay = await store.getProgressiveDelay(ip, email, config);
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    return next();
  };
}

/**
 * Record a failed auth attempt. Call from route handlers after
 * authentication failure to trigger progressive backoff and lockout.
 * Fire-and-forget: errors are logged but do not propagate to the caller.
 */
export function recordAuthFailure(req: Request, action?: string): void {
  const resolvedAction = action ?? resolveAction(req.path);
  const config = AUTH_CONFIGS[resolvedAction] ?? AUTH_CONFIGS.login;
  const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
  const email = extractEmail(req);

  store.recordFailure(ip, email, config).catch((err) => {
    logger.warn("recordAuthFailure: failed to persist failure record", {
      error: err instanceof Error ? err.message : String(err),
    });
  });
}

/** Exposed for testing */
export const authRateLimitStore = store;
export { AUTH_CONFIGS, authRateLimiterFallbackCounter };
