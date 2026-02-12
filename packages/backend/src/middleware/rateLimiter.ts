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

import { Request, Response, NextFunction } from "express";
import { logger } from "@shared/lib/logger";
import { RateLimitKeyService } from "../services/RateLimitKeyService.js"
import { RedisRateLimitStore } from "./redisRateLimitStore.js"

/**
 * Rate limit tier
 */
export const RateLimitTier = {
  STRICT: "strict",
  STANDARD: "standard",
  LOOSE: "loose",
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
    windowMs: number
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
  const keyGenerator = config.keyGenerator || getRateLimitKey;

  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip if configured
    if (config.skip && config.skip(req)) {
      return next();
    }

    // Use unified key service
    const key = RateLimitKeyService.generateSecureKey(req, {
      service: "general",
      tier: tier,
    });

    try {
      const entry = await store.increment(key, config.windowMs);

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
        failClosed: config.failClosed ?? false,
      });

      if (config.failClosed) {
        return res.status(503).json({
          error: "Service Unavailable",
          message: "Rate limiting service is temporarily unavailable. Please try again later.",
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
