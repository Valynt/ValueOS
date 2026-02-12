/**
 * Rate Limiter Middleware
 *
 * SAF-402: Prevents API abuse and cost overruns
 *
 * Implements tiered rate limiting:
 * - Strict tier (5 req/min): Expensive agent operations
 * - Standard tier (60 req/min): Regular API calls
 * - Loose tier (300 req/min): Read-only operations
 *
 * Uses in-memory store with Redis fallback for production
 */

import { NextFunction, Request, Response } from "express";
import { logger } from "../utils/logger";
import { RateLimitKeyService } from "../services/RateLimitKeyService";
import {
  createRateLimitStore,
  InMemoryRateLimitStore,
  RateLimitStore,
} from "./rateLimitStorage";

/**
 * Rate limit tier
 */
export type RateLimitTier = 'strict' | 'standard' | 'loose';

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  /** Window size in milliseconds */
  windowMs: number;

  /** Maximum requests per window */
  max: number;

  /** Maximum requests per window for IP-based limiting */
  ipMax?: number;

  /** Message to send when limit is exceeded */
  message?: string;

  /** Status code to send when limit is exceeded */
  statusCode?: number;

  /** Skip rate limiting for certain conditions */
  skip?: (req: Request) => boolean;

  /** Custom key generator */
  keyGenerator?: (req: Request) => string;

  /** Custom store (in-memory or Redis). */
  store?: RateLimitStore;
}

/**
 * Tier configurations
 */
const TIER_CONFIGS: Record<RateLimitTier, RateLimitConfig> = {
  strict: {
    windowMs: 60 * 1000, // 1 minute
    max: 5,
    message: 'Too many requests to expensive endpoints. Please try again later.',
    statusCode: 429,
  },
  standard: {
    windowMs: 60 * 1000, // 1 minute
    max: 60,
    message: 'Too many requests. Please try again later.',
    statusCode: 429,
  },
  loose: {
    windowMs: 60 * 1000, // 1 minute
    max: 300,
    message: 'Too many requests. Please try again later.',
    statusCode: 429,
  },
};

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfterSeconds: number;
}

const DEFAULT_HEALTH_PATHS = [
  "/health",
  "/healthz",
  "/health/ready",
  "/health/live",
  "/health/startup",
  "/health/dependencies",
  "/api/health",
];

// Global store instance
const defaultStore = createRateLimitStore();

function isHealthCheck(req: Request): boolean {
  return DEFAULT_HEALTH_PATHS.some((path) => req.path.startsWith(path));
}

function getUserId(req: Request): string | undefined {
  return (req as { user?: { id?: string } }).user?.id;
}

function getTenantId(req: Request): string {
  const tenantId = (req as { tenantId?: string }).tenantId;
  if (tenantId) return tenantId;

  const header = req.headers["x-tenant-id"];
  if (typeof header === "string") return header;
  return "global";
}

function getClientIp(req: Request): string {
  const forwarded = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0];
  return forwarded || req.ip || req.socket.remoteAddress || "unknown";
}

function sanitizeIdentifier(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
}

function buildIpKey(tenantId: string, ip: string, tier: RateLimitTier): string {
  const safeTenant = RateLimitKeyService.sanitizeComponent(tenantId);
  return `rl:general:${tier}:${safeTenant}:ip:${sanitizeIdentifier(ip)}`;
}

function buildUserKey(
  tenantId: string,
  userId: string,
  tier: RateLimitTier
): string {
  const safeTenant = RateLimitKeyService.sanitizeComponent(tenantId);
  const safeUser = RateLimitKeyService.sanitizeComponent(userId);
  return `rl:general:${tier}:${safeTenant}:user:${safeUser}`;
}

async function consumeTokenBucket(
  store: RateLimitStore,
  key: string,
  capacity: number,
  windowMs: number
): Promise<RateLimitResult> {
  const now = Date.now();
  const refillRate = capacity / windowMs;
  const existing = await store.get(key);
  const lastRefill = existing?.lastRefill ?? now;
  const tokens = existing?.tokens ?? capacity;
  const refill = (now - lastRefill) * refillRate;
  const nextTokens = Math.min(capacity, tokens + refill);

  const allowed = nextTokens >= 1;
  const remaining = Math.max(0, Math.floor(nextTokens - (allowed ? 1 : 0)));
  const updatedTokens = allowed ? nextTokens - 1 : nextTokens;
  const resetTime = now + Math.ceil((capacity - updatedTokens) / refillRate);
  const retryAfterSeconds = allowed
    ? 0
    : Math.max(1, Math.ceil((1 - nextTokens) / refillRate / 1000));

  await store.set(key, { tokens: updatedTokens, lastRefill: now }, windowMs);

  return {
    allowed,
    remaining,
    resetTime,
    retryAfterSeconds,
  };
}

/**
 * Default key generator using unified service
 */
export function getRateLimitKey(req: Request): string {
  const tenantId = (req as { tenantId?: string }).tenantId;
  const headerTenant = req.headers["x-tenant-id"];
  const resolvedTenant =
    tenantId || (typeof headerTenant === "string" ? headerTenant : undefined);
  const userId = getUserId(req);
  const ip = getClientIp(req);

  if (resolvedTenant && userId) {
    return `tenant:${RateLimitKeyService.sanitizeComponent(
      resolvedTenant
    )}:user:${RateLimitKeyService.sanitizeComponent(userId)}`;
  }

  if (resolvedTenant) {
    return `tenant:${RateLimitKeyService.sanitizeComponent(
      resolvedTenant
    )}:ip:${ip}`;
  }

  return `ip:${ip}`;
}

/**
 * Create rate limiter middleware
 */
export function createRateLimiter(
  tier: RateLimitTier,
  customConfig?: Partial<RateLimitConfig>
): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  const config = { ...TIER_CONFIGS[tier], ...customConfig };
  const store =
    config.store ||
    (process.env.NODE_ENV === "test" ? new InMemoryRateLimitStore() : defaultStore);
  const ipLimit = config.ipMax ?? config.max;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Skip if configured
      if (config.skip && config.skip(req)) {
        return next();
      }

      if (isHealthCheck(req)) {
        return next();
      }

      const userId = getUserId(req);
      const tenantId = getTenantId(req);
      const ip = getClientIp(req);
      const ipKey = buildIpKey(tenantId, ip, tier);
      const userKey = userId ? buildUserKey(tenantId, userId, tier) : null;

      const ipResult = await consumeTokenBucket(store, ipKey, ipLimit, config.windowMs);
      const userResult = userKey
        ? await consumeTokenBucket(store, userKey, config.max, config.windowMs)
        : null;

      const allowed = ipResult.allowed && (userResult ? userResult.allowed : true);
      const remaining = Math.min(
        ipResult.remaining,
        userResult ? userResult.remaining : ipResult.remaining
      );
      const resetTime = Math.max(
        ipResult.resetTime,
        userResult ? userResult.resetTime : ipResult.resetTime
      );
      const limit = Math.min(config.max, ipLimit);

      res.setHeader("X-RateLimit-Limit", limit);
      res.setHeader("X-RateLimit-Remaining", remaining);
      res.setHeader("X-RateLimit-Reset", new Date(resetTime).toISOString());

      if (!allowed) {
        const retryAfter = Math.max(
          ipResult.retryAfterSeconds,
          userResult ? userResult.retryAfterSeconds : 0
        );
        res.setHeader("Retry-After", retryAfter);

        return res.status(config.statusCode || 429).json({
          error: "Too Many Requests",
          message: config.message,
          retryAfter,
        });
      }

      return next();
    } catch (error) {
      logger.error("Rate limiter failed open", error as Error);
      return next();
    }
  };
}

/**
 * Predefined rate limiters
 */
export const rateLimiters = {
  /**
   * Strict rate limiter for expensive operations
   * 5 requests per minute
   */
  strict: createRateLimiter("strict"),

  /**
   * Standard rate limiter for regular API calls
   * 60 requests per minute
   */
  standard: createRateLimiter("standard"),

  /**
   * Loose rate limiter for read-only operations
   * 300 requests per minute
   */
  loose: createRateLimiter("loose"),

  /**
   * Agent execution rate limiter
   * 5 requests per minute (expensive LLM calls)
   */
  agentExecution: createRateLimiter("strict", {
    message: "Too many agent executions. Please wait before trying again.",
  }),

  /**
   * Agent query rate limiter
   * 60 requests per minute (standard queries)
   */
  agentQuery: createRateLimiter("standard", {
    message: "Too many agent queries. Please slow down.",
  }),
};

/**
 * Reset rate limit for a user (admin only)
 */
export function resetRateLimit(userId: string, tenantId = "global"): void {
  // Reset for all tiers
  const tiers: RateLimitTier[] = ["strict", "standard", "loose"];
  tiers.forEach((tier) => {
    void defaultStore.delete(buildUserKey(tenantId, userId, tier));
  });
  logger.info("Rate limit reset", { userId });
}

/**
 * Get rate limit status for a user
 */
export function getRateLimitStatus(_userId: string): {
  count: number;
  limit: number;
  resetTime: Date;
} | null {
  return null;
}

/**
 * Cleanup on shutdown
 */
export function cleanup(): void {
  void defaultStore.shutdown();
}
