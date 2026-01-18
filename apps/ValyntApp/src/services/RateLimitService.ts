/**
 * Rate Limiting Service
 * Provides comprehensive rate limiting for API endpoints and user actions
 */

import { createLogger } from "@lib/logger";

const logger = createLogger({ component: "RateLimitService" });

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  skipFailedRequests?: boolean; // Don't count failed requests
  keyGenerator?: (req: any) => string; // Custom key generator
  skip?: (req: any) => boolean; // Skip rate limiting for certain requests
  handler?: (req: any, res: any, next: any) => void; // Custom handler for rate limit exceeded
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  totalRequests: number;
}

export class RateLimitService {
  private static instance: RateLimitService;
  private stores: Map<string, Map<string, number[]>> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  private constructor() {
    // Clean up old entries every 5 minutes
    this.cleanupInterval = setInterval(
      () => {
        this.cleanup();
      },
      5 * 60 * 1000
    );
  }

  static getInstance(): RateLimitService {
    if (!RateLimitService.instance) {
      RateLimitService.instance = new RateLimitService();
    }
    return RateLimitService.instance;
  }

  /**
   * Check if request should be allowed based on rate limit
   */
  checkLimit(key: string, config: RateLimitConfig, req?: any): RateLimitResult {
    // Check if rate limiting should be skipped
    if (config.skip && req && config.skip(req)) {
      return {
        allowed: true,
        remaining: config.maxRequests,
        resetTime: Date.now() + config.windowMs,
        totalRequests: 0,
      };
    }

    // Generate rate limit key
    const rateLimitKey = config.keyGenerator && req ? config.keyGenerator(req) : key;

    // Get or create store for this rate limit key
    if (!this.stores.has(rateLimitKey)) {
      this.stores.set(rateLimitKey, new Map());
    }

    const keyStore = this.stores.get(rateLimitKey)!;
    const now = Date.now();
    const windowStart = now - config.windowMs;

    // Clean old requests for this key
    if (!keyStore.has("requests")) {
      keyStore.set("requests", []);
    }

    const requests = keyStore.get("requests")!;
    const validRequests = requests.filter((timestamp) => timestamp > windowStart);
    keyStore.set("requests", validRequests);

    const currentRequests = validRequests.length;
    const remaining = Math.max(0, config.maxRequests - currentRequests);

    if (currentRequests >= config.maxRequests) {
      // Rate limit exceeded
      const oldestRequest = Math.min(...validRequests);
      const resetTime = oldestRequest + config.windowMs;

      logger.warn("Rate limit exceeded", {
        key: rateLimitKey,
        currentRequests,
        maxRequests: config.maxRequests,
        windowMs: config.windowMs,
      });

      return {
        allowed: false,
        remaining: 0,
        resetTime,
        totalRequests: currentRequests,
      };
    }

    // Add current request timestamp
    validRequests.push(now);
    keyStore.set("requests", validRequests);

    return {
      allowed: true,
      remaining: remaining - 1, // Subtract 1 for current request
      resetTime: now + config.windowMs,
      totalRequests: currentRequests + 1,
    };
  }

  /**
   * Middleware factory for Express routes
   */
  createMiddleware(config: RateLimitConfig) {
    return (req: any, res: any, next: any) => {
      const key = this.generateKey(req);
      const result = this.checkLimit(key, config, req);

      // Set rate limit headers
      res.set({
        "X-RateLimit-Limit": config.maxRequests,
        "X-RateLimit-Remaining": result.remaining,
        "X-RateLimit-Reset": Math.ceil(result.resetTime / 1000),
        "X-RateLimit-Window": config.windowMs,
      });

      if (!result.allowed) {
        if (config.handler) {
          return config.handler(req, res, next);
        }

        // Default handler
        res.status(429).json({
          error: "Too many requests",
          message: "Rate limit exceeded. Please try again later.",
          retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
        });
        return;
      }

      next();
    };
  }

  /**
   * Generate rate limit key from request
   */
  private generateKey(req: any): string {
    // Use IP address as default key
    const ip = req.ip || req.connection?.remoteAddress || "unknown";
    const userId = req.user?.id || "anonymous";
    const endpoint = req.originalUrl || req.url;

    return `${ip}:${userId}:${endpoint}`;
  }

  /**
   * Clean up old rate limit data
   */
  private cleanup(): void {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    for (const [key, keyStore] of this.stores.entries()) {
      const requests = keyStore.get("requests") || [];
      const validRequests = requests.filter((timestamp) => now - timestamp < maxAge);

      if (validRequests.length === 0) {
        this.stores.delete(key);
      } else {
        keyStore.set("requests", validRequests);
      }
    }

    logger.debug("Rate limit cleanup completed", { storesRemaining: this.stores.size });
  }

  /**
   * Reset rate limit for a specific key
   */
  resetKey(key: string): void {
    this.stores.delete(key);
    logger.debug("Rate limit reset for key", { key });
  }

  /**
   * Get rate limit status for a key
   */
  getStatus(key: string, config: RateLimitConfig): RateLimitResult | null {
    if (!this.stores.has(key)) {
      return null;
    }

    return this.checkLimit(key, config);
  }

  /**
   * Destroy the service (cleanup)
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.stores.clear();
  }
}

// Export singleton instance
export const rateLimitService = RateLimitService.getInstance();

// Pre-configured rate limiters for common use cases
export const createApiRateLimiter = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  return rateLimitService.createMiddleware({
    windowMs,
    maxRequests,
    skip: (req) => req.method === "OPTIONS", // Skip preflight requests
  });
};

export const createAuthRateLimiter = () => {
  return rateLimitService.createMiddleware({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // 5 attempts per 15 minutes
    keyGenerator: (req) => {
      const ip = req.ip || req.connection?.remoteAddress || "unknown";
      const email = req.body?.email || "unknown";
      return `auth:${ip}:${email}`;
    },
    handler: (req, res) => {
      logger.warn("Authentication rate limit exceeded", {
        ip: req.ip,
        email: req.body?.email,
        userAgent: req.get("User-Agent"),
      });

      res.status(429).json({
        error: "Too many authentication attempts",
        message: "Too many login/signup attempts. Please try again later.",
        retryAfter: 900, // 15 minutes
      });
    },
  });
};

export const createStrictRateLimiter = () => {
  return rateLimitService.createMiddleware({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10, // 10 requests per minute
  });
};
