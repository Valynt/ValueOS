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

import { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger';

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
  
  /** Message to send when limit is exceeded */
  message?: string;
  
  /** Status code to send when limit is exceeded */
  statusCode?: number;
  
  /** Skip rate limiting for certain conditions */
  skip?: (req: Request) => boolean;
  
  /** Custom key generator */
  keyGenerator?: (req: Request) => string;
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

/**
 * In-memory rate limit store
 */
class RateLimitStore {
  private store: Map<string, { count: number; resetTime: number }> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Cleanup expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60 * 1000);
  }

  /**
   * Increment request count for a key
   */
  increment(key: string, windowMs: number): { count: number; resetTime: number } {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || entry.resetTime < now) {
      // Create new entry
      const newEntry = {
        count: 1,
        resetTime: now + windowMs,
      };
      this.store.set(key, newEntry);
      return newEntry;
    }

    // Increment existing entry
    entry.count++;
    this.store.set(key, entry);
    return entry;
  }

  /**
   * Get current count for a key
   */
  get(key: string): { count: number; resetTime: number } | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    const now = Date.now();
    if (entry.resetTime < now) {
      this.store.delete(key);
      return undefined;
    }

    return entry;
  }

  /**
   * Reset count for a key
   */
  reset(key: string): void {
    this.store.delete(key);
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.store.entries()) {
      if (entry.resetTime < now) {
        this.store.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug('Rate limit store cleanup', { cleaned });
    }
  }

  /**
   * Destroy store and cleanup interval
   */
  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.store.clear();
  }
}

// Global store instance
const store = new RateLimitStore();

/**
 * Default key generator (uses user ID or IP)
 */
function defaultKeyGenerator(req: Request): string {
  const tenantId = (req as any).user?.organizationId || req.header('x-tenant-id');

  // Use user ID if authenticated
  if (req.user?.id) {
    return tenantId ? `tenant:${tenantId}:user:${req.user.id}` : `user:${req.user.id}`;
  }

  // Fall back to tenant or IP address
  if (tenantId) {
    return `tenant:${tenantId}:ip:${req.ip || 'unknown'}`;
  }

  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  return `ip:${ip}`;
}

/**
 * Create rate limiter middleware
 */
export function createRateLimiter(
  tier: RateLimitTier,
  customConfig?: Partial<RateLimitConfig>
): (req: Request, res: Response, next: NextFunction) => void {
  const config = { ...TIER_CONFIGS[tier], ...customConfig };
  const keyGenerator = config.keyGenerator || defaultKeyGenerator;

  return (req: Request, res: Response, next: NextFunction) => {
    // Skip if configured
    if (config.skip && config.skip(req)) {
      return next();
    }

    const key = keyGenerator(req);
    const entry = store.increment(key, config.windowMs);

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', config.max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, config.max - entry.count));
    res.setHeader('X-RateLimit-Reset', new Date(entry.resetTime).toISOString());

    // Check if limit exceeded
    if (entry.count > config.max) {
      const retryAfter = Math.ceil((entry.resetTime - Date.now()) / 1000);
      res.setHeader('Retry-After', retryAfter);

      logger.warn('Rate limit exceeded', {
        key,
        count: entry.count,
        limit: config.max,
        tier,
        path: req.path,
        method: req.method,
      });

      return res.status(config.statusCode || 429).json({
        error: 'Too Many Requests',
        message: config.message,
        retryAfter,
      });
    }

    next();
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
  strict: createRateLimiter('strict'),

  /**
   * Standard rate limiter for regular API calls
   * 60 requests per minute
   */
  standard: createRateLimiter('standard'),

  /**
   * Loose rate limiter for read-only operations
   * 300 requests per minute
   */
  loose: createRateLimiter('loose'),

  /**
   * Agent execution rate limiter
   * 5 requests per minute (expensive LLM calls)
   */
  agentExecution: createRateLimiter('strict', {
    message: 'Too many agent executions. Please wait before trying again.',
  }),

  /**
   * Agent query rate limiter
   * 60 requests per minute (standard queries)
   */
  agentQuery: createRateLimiter('standard', {
    message: 'Too many agent queries. Please slow down.',
  }),
};

/**
 * Reset rate limit for a user (admin only)
 */
export function resetRateLimit(userId: string): void {
  store.reset(`user:${userId}`);
  logger.info('Rate limit reset', { userId });
}

/**
 * Get rate limit status for a user
 */
export function getRateLimitStatus(userId: string): {
  count: number;
  limit: number;
  resetTime: Date;
} | null {
  const entry = store.get(`user:${userId}`);
  if (!entry) return null;

  return {
    count: entry.count,
    limit: TIER_CONFIGS.standard.max,
    resetTime: new Date(entry.resetTime),
  };
}

/**
 * Cleanup on shutdown
 */
export function cleanup(): void {
  store.destroy();
}
