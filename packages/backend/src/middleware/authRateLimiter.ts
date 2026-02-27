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
 */

import { NextFunction, Request, Response } from "express";
import { createLogger } from "@shared/lib/logger";
import { createCounter } from "../lib/observability/index.js";

const logger = createLogger({ component: "AuthRateLimiter" });

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
 * In-memory store for auth rate limiting.
 * In production with multiple pods, replace with Redis-backed store
 * (the HybridRateLimitStore pattern from rateLimiter.ts).
 */
export class AuthRateLimitStore {
  private ipRecords: Map<string, AttemptRecord> = new Map();
  private emailRecords: Map<string, AttemptRecord> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Cleanup expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  private getOrCreate(
    map: Map<string, AttemptRecord>,
    key: string,
    windowMs: number
  ): AttemptRecord {
    const now = Date.now();
    const existing = map.get(key);

    if (!existing || now - existing.windowStart > windowMs) {
      // Preserve lockout across window resets
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

  increment(
    ip: string,
    email: string | undefined,
    config: AuthRateLimitConfig
  ): { ipRecord: AttemptRecord; emailRecord: AttemptRecord | null } {
    const ipRecord = this.getOrCreate(this.ipRecords, ip, config.windowMs);
    ipRecord.count++;

    let emailRecord: AttemptRecord | null = null;
    if (email) {
      const normalizedEmail = email.toLowerCase().trim();
      emailRecord = this.getOrCreate(
        this.emailRecords,
        normalizedEmail,
        config.windowMs
      );
      emailRecord.count++;
    }

    return { ipRecord, emailRecord };
  }

  recordFailure(
    ip: string,
    email: string | undefined,
    config: AuthRateLimitConfig
  ): void {
    const ipRecord = this.getOrCreate(this.ipRecords, ip, config.windowMs);
    ipRecord.failures++;
    if (ipRecord.failures >= config.lockoutThreshold) {
      ipRecord.lockedUntil = Date.now() + config.lockoutDurationMs;
      authAccountLockoutCounter.inc();
      logger.warn("IP locked out due to repeated failures", {
        ip,
        failures: ipRecord.failures,
        lockoutDurationMs: config.lockoutDurationMs,
      });
    }

    if (email) {
      const normalizedEmail = email.toLowerCase().trim();
      const emailRecord = this.getOrCreate(
        this.emailRecords,
        normalizedEmail,
        config.windowMs
      );
      emailRecord.failures++;
      if (emailRecord.failures >= config.lockoutThreshold) {
        emailRecord.lockedUntil = Date.now() + config.lockoutDurationMs;
        authAccountLockoutCounter.inc();
        logger.warn("Account locked out due to repeated failures", {
          failures: emailRecord.failures,
          lockoutDurationMs: config.lockoutDurationMs,
        });
      }
    }
  }

  isLocked(ip: string, email: string | undefined): boolean {
    const now = Date.now();

    const ipRecord = this.ipRecords.get(ip);
    if (ipRecord?.lockedUntil && ipRecord.lockedUntil > now) {
      return true;
    }
    // Clear expired lockout
    if (ipRecord?.lockedUntil && ipRecord.lockedUntil <= now) {
      ipRecord.lockedUntil = null;
      ipRecord.failures = 0;
    }

    if (email) {
      const normalizedEmail = email.toLowerCase().trim();
      const emailRecord = this.emailRecords.get(normalizedEmail);
      if (emailRecord?.lockedUntil && emailRecord.lockedUntil > now) {
        return true;
      }
      if (emailRecord?.lockedUntil && emailRecord.lockedUntil <= now) {
        emailRecord.lockedUntil = null;
        emailRecord.failures = 0;
      }
    }

    return false;
  }

  getProgressiveDelay(
    ip: string,
    email: string | undefined,
    config: AuthRateLimitConfig
  ): number {
    let maxFailures = 0;

    const ipRecord = this.ipRecords.get(ip);
    if (ipRecord) {
      maxFailures = Math.max(maxFailures, ipRecord.failures);
    }

    if (email) {
      const normalizedEmail = email.toLowerCase().trim();
      const emailRecord = this.emailRecords.get(normalizedEmail);
      if (emailRecord) {
        maxFailures = Math.max(maxFailures, emailRecord.failures);
      }
    }

    if (maxFailures <= 1) return 0;

    return Math.min(
      (maxFailures - 1) * config.progressiveDelayMs,
      config.maxDelayMs
    );
  }

  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, record] of this.ipRecords.entries()) {
      const expired =
        now - record.windowStart > 2 * 60 * 60 * 1000 &&
        (!record.lockedUntil || record.lockedUntil <= now);
      if (expired) {
        this.ipRecords.delete(key);
        cleaned++;
      }
    }

    for (const [key, record] of this.emailRecords.entries()) {
      const expired =
        now - record.windowStart > 2 * 60 * 60 * 1000 &&
        (!record.lockedUntil || record.lockedUntil <= now);
      if (expired) {
        this.emailRecords.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug("Auth rate limit store cleanup", { cleaned });
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.ipRecords.clear();
    this.emailRecords.clear();
  }

  /** Exposed for testing */
  _getIpRecords(): Map<string, AttemptRecord> {
    return this.ipRecords;
  }
  _getEmailRecords(): Map<string, AttemptRecord> {
    return this.emailRecords;
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

    // Check lockout first
    if (store.isLocked(ip, email)) {
      authRateLimit429Counter.inc();
      logger.warn("Auth request blocked: account/IP locked", {
        ip,
        action,
      });

      return res.status(429).json({
        error: "Too Many Requests",
        message:
          "Account temporarily locked due to too many failed attempts. Try again later.",
        retryAfter: Math.ceil(config.lockoutDurationMs / 1000),
      });
    }

    // Increment counters
    const { ipRecord, emailRecord } = store.increment(ip, email, config);

    // Check IP-based limit
    if (ipRecord.count > config.maxAttempts) {
      authRateLimit429Counter.inc();
      const retryAfter = Math.ceil(
        (ipRecord.windowStart + config.windowMs - Date.now()) / 1000
      );
      return res.setHeader("Retry-After", Math.max(retryAfter, 1));

      logger.warn("Auth rate limit exceeded (IP)", {
        ip,
        action,
        count: ipRecord.count,
        limit: config.maxAttempts,
      });

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
      return res.setHeader("Retry-After", Math.max(retryAfter, 1));

      logger.warn("Auth rate limit exceeded (email)", {
        action,
        count: emailRecord.count,
        limit: config.maxAttempts,
      });

      return res.status(429).json({
        error: "Too Many Requests",
        message: "Too many authentication attempts for this account.",
        retryAfter: Math.max(retryAfter, 1),
      });
    }

    // Apply progressive delay
    const delay = store.getProgressiveDelay(ip, email, config);
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    return next();
  };
}

/**
 * Record a failed auth attempt. Call from route handlers after
 * authentication failure to trigger progressive backoff and lockout.
 */
export function recordAuthFailure(req: Request, action?: string): void {
  const resolvedAction = action ?? resolveAction(req.path);
  const config = AUTH_CONFIGS[resolvedAction] ?? AUTH_CONFIGS.login;
  const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
  const email = extractEmail(req);

  store.recordFailure(ip, email, config);
}

/** Exposed for testing */
export const authRateLimitStore = store;
export { AUTH_CONFIGS };
