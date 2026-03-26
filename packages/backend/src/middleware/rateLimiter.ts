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

import { logger } from "@shared/lib/logger";
import { NextFunction, Request, Response } from "express";

import { createCounter } from "../lib/observability/index.js";
import { RateLimitKeyService } from "../services/post-v1/RateLimitKeyService.js"

import { RedisRateLimitStore } from "./redisRateLimitStore.js"


/**
 * Rate limit tier
 */
export const RateLimitTier = {
  STRICT: "strict",
  STANDARD: "standard",
  LOOSE: "loose",
  AUTH: "auth",
} as const;

export type RateLimitTierValue =
  (typeof RateLimitTier)[keyof typeof RateLimitTier];

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  /** Window size in milliseconds */
  windowMs: number;

  /** Maximum requests per window */
  max: number;

  /** Message to send when limit is exceeded */
  message?: string;

  /** Status code to send when limit is exceeded */
  statusCode?: number;

  /** Skip rate limiting for certain conditions */
  skip?: (req: Request) => boolean;

  /** Custom key generator */
  keyGenerator?: (req: Request) => string;

  /**
   * When true, reject requests if the rate limit store is unavailable
   * (e.g. Redis down and memory fallback also fails).
   * Use for security-sensitive endpoints like auth/admin.
   * Default: false (fail-open).
   */
  failClosed?: boolean;
}

export interface RouteRiskMetadata {
  failClosed: boolean;
  requiresDistributedStore: boolean;
  risk:
    | "security-critical"
    | "security-sensitive-write"
    | "authenticated-mutation"
    | "expensive-write"
    | "low-risk";
  reason:
    | "auth"
    | "admin-mutation"
    | "security-sensitive-write"
    | "authenticated-mutation"
    | "expensive-write"
    | "default";
}

function isSensitiveMemoryFallbackOverrideEnabled(): boolean {
  return process.env.RATE_LIMIT_ALLOW_SENSITIVE_MEMORY_FALLBACK === "true";
}

function isDistributedRateLimitMode(): boolean {
  return (
    process.env.RATE_LIMIT_DISTRIBUTED === "true" ||
    process.env.NODE_ENV === "production"
  );
}

const rateLimit429Counter = createCounter(
  "rate_limit_429_responses_total",
  "Total HTTP 429 responses emitted by rate limiter"
);
const rateLimitProtective503Counter = createCounter(
  "rate_limit_protective_503_responses_total",
  "Total HTTP 503 protective responses emitted by rate limiter degraded mode"
);
const rateLimitBackendUnavailableCounter = createCounter(
  "rate_limit_backend_unavailable_total",
  "Total requests where distributed rate limit backend was unavailable"
);
const rateLimitSensitiveOverrideCounter = createCounter(
  "rate_limit_sensitive_memory_fallback_override_total",
  "Total sensitive requests allowed to use memory fallback via operator override"
);

function isExpensiveWritePath(path: string): boolean {
  return [
    /^\/(api\/)?agents?(\/|$)/,
    /^\/(api\/)?llm(\/|$)/,
    /^\/(api\/)?artifacts?(\/|$)/,
    /^\/(api\/)?workflows?(\/|$)/,
    /^\/(api\/)?exports?(\/|$)/,
    /^\/(api\/)?imports?(\/|$)/,
    /^\/(api\/)?billing(\/|$)/,
  ].some((pattern) => pattern.test(path));
}

function isSecuritySensitiveWritePath(path: string): boolean {
  return [
    /^\/api\/dsr(\/|$)/,
    /^\/api\/integrations(\/|$)/,
    /^\/api\/teams(\/|$)/,
    /^\/api\/billing(\/|$)/,
    /^\/api\/admin(\/|$)/,
  ].some((pattern) => pattern.test(path));
}

function hasAuthenticationContext(req: Request): boolean {
  const authorization = req.header("authorization");
  return Boolean(req.user || req.userId || req.sessionId || authorization);
}

function isMutationMethod(method: string): boolean {
  return ["POST", "PUT", "PATCH", "DELETE"].includes(method);
}

export function getRouteRiskMetadata(
  req: Request,
  tier: RateLimitTierValue
): RouteRiskMetadata {
  const path = req.path.toLowerCase();
  const method = req.method.toUpperCase();
  const mutationMethod = isMutationMethod(method);
  const authenticatedMutation =
    mutationMethod && hasAuthenticationContext(req) && isDistributedRateLimitMode();

  if (/^\/(api\/)?auth(\/|$)/.test(path)) {
    return {
      failClosed: true,
      requiresDistributedStore: true,
      risk: "security-critical",
      reason: "auth",
    };
  }

  if (/^\/api\/admin(\/|$)/.test(path) && mutationMethod) {
    return {
      failClosed: true,
      requiresDistributedStore: true,
      risk: "security-critical",
      reason: "admin-mutation",
    };
  }

  if (mutationMethod && isSecuritySensitiveWritePath(path)) {
    return {
      failClosed: true,
      requiresDistributedStore: true,
      risk: "security-sensitive-write",
      reason: "security-sensitive-write",
    };
  }

  if (authenticatedMutation) {
    return {
      failClosed: true,
      requiresDistributedStore: true,
      risk: "authenticated-mutation",
      reason: "authenticated-mutation",
    };
  }

  if (
    tier === RateLimitTier.STRICT ||
    (mutationMethod && isExpensiveWritePath(path))
  ) {
    return {
      failClosed: true,
      requiresDistributedStore: true,
      risk: "expensive-write",
      reason: "expensive-write",
    };
  }

  return {
    failClosed: false,
    requiresDistributedStore: false,
    risk: "low-risk",
    reason: "default",
  };
}

/**
 * Tier configurations
 */
const TIER_CONFIGS: Record<RateLimitTierValue, RateLimitConfig> = {
  [RateLimitTier.STRICT]: {
    windowMs: 60 * 1000, // 1 minute
    max: 5,
    message:
      "Too many requests to expensive endpoints. Please try again later.",
    statusCode: 429,
  },
  [RateLimitTier.STANDARD]: {
    windowMs: 60 * 1000, // 1 minute
    max: 60,
    message: "Too many requests. Please try again later.",
    statusCode: 429,
  },
  [RateLimitTier.LOOSE]: {
    windowMs: 60 * 1000, // 1 minute
    max: 300,
    message: "Too many requests. Please try again later.",
    statusCode: 429,
  },
  // Auth tier uses its own Redis key namespace (tier:"auth") so /api/auth requests
  // are counted independently from the standard tier applied globally to /api.
  // 20 req/min, fail-closed — limits credential-stuffing surface.
  [RateLimitTier.AUTH]: {
    windowMs: 60 * 1000, // 1 minute
    max: 20,
    message: "Too many authentication attempts. Please try again later.",
    statusCode: 429,
    failClosed: true,
  },
};

/**
 * Hybrid Rate Limit Store with Redis and In-Memory Fallback
 */
class HybridRateLimitStore {
  private redisStore: RedisRateLimitStore;
  private memoryStore: Map<string, { count: number; resetTime: number }> =
    new Map();
  private cleanupInterval: NodeJS.Timeout;
  private redisAvailable = false;

  isRedisAvailable(): boolean {
    return this.redisAvailable;
  }

  constructor() {
    this.redisStore = new RedisRateLimitStore();
    this.redisAvailable = false; // Will be set by Redis store initialization

    // Cleanup expired entries every minute for memory fallback
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60 * 1000);

    // Check Redis availability
    this.checkRedisAvailability();
  }

  private async checkRedisAvailability(): Promise<void> {
    try {
      // Try a simple operation to check if Redis is available
      await this.redisStore.getStats();
      this.redisAvailable = true;
      logger.info("Rate limit store using Redis");
    } catch (error) {
      this.redisAvailable = false;
      logger.warn(
        "Rate limit store falling back to in-memory (Redis unavailable)",
        {
          error: error instanceof Error ? error.message : String(error),
        }
      );
    }
  }

  /**
   * Increment request count for a key
   */
  async increment(
    key: string,
    windowMs: number,
    options?: {
      requireDistributedStore?: boolean;
      allowSensitiveMemoryFallback?: boolean;
    }
  ): Promise<{ count: number; resetTime: number }> {
    if (this.redisAvailable) {
      try {
        return await this.redisStore.increment(key, windowMs);
      } catch (error) {
        logger.warn("Redis increment failed, falling back to memory", {
          key,
          error: error instanceof Error ? error.message : String(error),
        });
        this.redisAvailable = false;
        // Fall through to memory implementation
      }
    }

    // In-memory fallback
    if (
      options?.requireDistributedStore &&
      isDistributedRateLimitMode() &&
      !options.allowSensitiveMemoryFallback
    ) {
      rateLimitBackendUnavailableCounter.inc();
      throw new Error(
        "Sensitive endpoint requires distributed rate limiting backend"
      );
    }

    if (options?.requireDistributedStore && options.allowSensitiveMemoryFallback) {
      rateLimitSensitiveOverrideCounter.inc();
    }

    const now = Date.now();
    const entry = this.memoryStore.get(key);

    if (!entry || entry.resetTime < now) {
      // Create new entry
      const newEntry = {
        count: 1,
        resetTime: now + windowMs,
      };
      this.memoryStore.set(key, newEntry);
      return newEntry;
    }

    // Increment existing entry
    entry.count++;
    this.memoryStore.set(key, entry);
    return entry;
  }

  /**
   * Get current count for a key
   */
  async get(
    key: string
  ): Promise<{ count: number; resetTime: number } | undefined> {
    if (this.redisAvailable) {
      try {
        return await this.redisStore.get(key);
      } catch (error) {
        logger.warn("Redis get failed, falling back to memory", {
          key,
          error: error instanceof Error ? error.message : String(error),
        });
        this.redisAvailable = false;
        // Fall through to memory implementation
      }
    }

    // In-memory fallback
    const entry = this.memoryStore.get(key);
    if (!entry) return undefined;

    const now = Date.now();
    if (entry.resetTime < now) {
      this.memoryStore.delete(key);
      return undefined;
    }

    return entry;
  }

  /**
   * Reset count for a key
   */
  async reset(key: string): Promise<void> {
    if (this.redisAvailable) {
      try {
        await this.redisStore.reset(key);
        return;
      } catch (error) {
        logger.warn("Redis reset failed, falling back to memory", {
          key,
          error: error instanceof Error ? error.message : String(error),
        });
        this.redisAvailable = false;
        // Fall through to memory implementation
      }
    }

    // In-memory fallback
    this.memoryStore.delete(key);
  }

  /**
   * Cleanup expired entries (memory only)
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.memoryStore.entries()) {
      if (entry.resetTime < now) {
        this.memoryStore.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug("Rate limit store cleanup", { cleaned, store: "memory" });
    }
  }

  /**
   * Destroy store and cleanup interval
   */
  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.memoryStore.clear();
  }
}

// Global store instance
const store = new HybridRateLimitStore();

/**
 * Default key generator using unified service
 */
export function getRateLimitKey(req: Request): string {
  return RateLimitKeyService.generateSecureKey(req, {
    service: "general",
    tier: RateLimitTier.STANDARD, // Will be overridden in createRateLimiter
  });
}

/**
 * Create rate limiter middleware
 */
export function createRateLimiter(
  tier: RateLimitTierValue,
  customConfig?: Partial<RateLimitConfig>
): (req: Request, res: Response, next: NextFunction) => void {
  const config = { ...TIER_CONFIGS[tier], ...customConfig };

  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip if configured
    if (config.skip && config.skip(req)) {
      return next();
    }

    const routePolicy = getRouteRiskMetadata(req, tier);
    const failClosed = routePolicy.failClosed || (config.failClosed ?? false);
    const requireDistributedStore =
      routePolicy.requiresDistributedStore || failClosed;

    // Use unified key service
    const key = RateLimitKeyService.generateSecureKey(req, {
      service: "general",
      tier: tier,
    });

    try {
      const entry = await store.increment(key, config.windowMs, {
        requireDistributedStore,
        allowSensitiveMemoryFallback:
          isSensitiveMemoryFallbackOverrideEnabled(),
      });

      // Set rate limit headers
      res.setHeader("X-RateLimit-Limit", config.max);
      res.setHeader(
        "X-RateLimit-Remaining",
        Math.max(0, config.max - entry.count)
      );
      res.setHeader(
        "X-RateLimit-Reset",
        new Date(entry.resetTime).toISOString()
      );

      // Check if limit exceeded
      if (entry.count > config.max) {
        const retryAfter = Math.ceil((entry.resetTime - Date.now()) / 1000);
        res.setHeader("Retry-After", retryAfter);

        logger.warn("Rate limit exceeded", {
          key,
          count: entry.count,
          limit: config.max,
          tier,
          path: req.path,
          method: req.method,
        });

        rateLimit429Counter.inc();
        res.setHeader("X-RateLimit-Enforcement", "active");

        return res.status(config.statusCode || 429).json({
          error: "Too Many Requests",
          message: config.message,
          retryAfter,
        });
      }

      next();
    } catch (error) {
      logger.error("Rate limit check failed", error as Error, {
        key,
        tier,
        path: req.path,
        failClosed,
        policyReason: routePolicy.reason,
        policyRisk: routePolicy.risk,
        requireDistributedStore,
        degradedMode: true,
        redisAvailable: store.isRedisAvailable(),
      });

      if (failClosed) {
        rateLimitProtective503Counter.inc();
        res.setHeader("X-RateLimit-Enforcement", "degraded-protective");
        return res.status(503).json({
          error: "Service Unavailable",
          code: "RATE_LIMIT_DEGRADED_PROTECTION",
          message:
            "Request blocked because distributed rate limiting is temporarily unavailable for this sensitive endpoint.",
        });
      }

      // Fail-open: allow request to proceed
      next();
    }
  };
}

/**
 * Predefined rate limiters
 */
export const rateLimiters = {
  /**
   * Strict rate limiter for expensive operations
   * 5 requests per minute — fail-closed for security-sensitive routes
   */
  strict: createRateLimiter("strict", { failClosed: true }),

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

  /**
   * Auth rate limiter for /api/auth routes.
   * 20 requests per minute, fail-closed — limits credential-stuffing surface.
   * Uses the "auth" tier so /api/auth requests are counted in their own Redis
   * key namespace, independent of the standard tier applied globally to /api.
   */
  auth: createRateLimiter("auth"),
};

/**
 * Reset rate limit for a user (admin only)
 * Uses RateLimitKeyService for consistent key generation
 */
export function resetRateLimit(
  userId: string,
  tenantId: string = "global"
): void {
  // Reset for all tiers using consistent key generation
  const tiers: RateLimitTierValue[] = [
    RateLimitTier.STRICT,
    RateLimitTier.STANDARD,
    RateLimitTier.LOOSE,
  ];
  tiers.forEach((tier) => {
    const key = RateLimitKeyService.generateUserKey(userId, tenantId, {
      service: "general",
      tier: tier,
    });
    store.reset(key);
  });
  logger.info("Rate limit reset", { userId, tenantId });
}

export function getGeneralRateLimitBackendStatus(): {
  required: boolean;
  healthy: boolean;
  mode: "distributed" | "memory-fallback";
} {
  const healthy = store.isRedisAvailable();

  return {
    required:
      process.env.RATE_LIMIT_REQUIRE_DISTRIBUTED_BACKEND === "true" ||
      isDistributedRateLimitMode(),
    healthy,
    mode: healthy ? "distributed" : "memory-fallback",
  };
}


/**
 * Get rate limit status for a user
 */
export async function getRateLimitStatus(userId: string): Promise<{
  count: number;
  limit: number;
  resetTime: Date;
} | null> {
  // Default to standard tier status
  try {
    const entry = await store.get(`standard:user:${userId}`);
    if (!entry) return null;

    return {
      count: entry.count,
      limit: TIER_CONFIGS.standard.max,
      resetTime: new Date(entry.resetTime),
    };
  } catch (error) {
    logger.error("Failed to get rate limit status", error as Error, { userId });
    return null;
  }
}

/**
 * Cleanup on shutdown
 */
export function cleanup(): void {
  store.destroy();
}
