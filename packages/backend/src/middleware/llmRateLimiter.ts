/**
 * LLM Rate Limiter Middleware
 *
 * Implements strict rate limiting for LLM endpoints to prevent cost overruns
 * from Together.ai API usage. Uses Redis for distributed rate limiting.
 */

import { logger } from '@shared/lib/logger';
import { getRedisClient } from '@shared/lib/redisClient';
import { NextFunction, Request, RequestHandler, Response } from 'express';
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';

import { RateLimitKeyService } from '../services/llm/RateLimitKeyService';
import { redisCircuitBreaker } from '../services/agents/resilience/RedisCircuitBreaker';


// Extended Request interface for rate limiting
interface RateLimitRequest extends Request {
  user?: {
    id: string;
    subscription_tier?: 'free' | 'pro' | 'enterprise';
    role?: string;
  };
  rateLimitTier?: string;
}

// We'll use `getRedisClient()` which connects lazily and uses the
// testcontainers-provided REDIS_URL during tests.

// Cache for rate limiters to prevent re-instantiation on every request
const limiterPromises = new Map<string, Promise<RequestHandler>>();

/**
 * Rate limit configuration for different user tiers
 */
const RATE_LIMITS = {
  free: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 requests per hour
    message: 'Free tier limit: 10 LLM requests per hour. Upgrade for more.'
  },
  pro: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 100, // 100 requests per hour
    message: 'Pro tier limit: 100 LLM requests per hour.'
  },
  enterprise: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 1000, // 1000 requests per hour
    message: 'Enterprise tier limit: 1000 LLM requests per hour.'
  },
  admin: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 2000, // 2000 requests per hour for admins
    message: 'Admin tier limit: 2000 LLM requests per hour.'
  },
  anonymous: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 requests per hour for anonymous users
    message: 'Anonymous limit: 3 requests per hour. Sign in for more.'
  }
};

/**
 * Get user tier from request
 */
function getUserTier(req: RateLimitRequest): keyof typeof RATE_LIMITS {
  if (!req.user) return 'anonymous';

  // Admin users get their own tier with higher limits
  if (req.user.role === 'admin') {
    return 'admin';
  }

  const tier = req.user.subscription_tier || 'free';
  return tier as keyof typeof RATE_LIMITS;
}

/**
 * Generate rate limit key based on user ID or IP using unified service
 */
function keyGenerator(req: RateLimitRequest): string {
  const tier = getUserTier(req);

  return RateLimitKeyService.generateSecureKey(req as Request, {
    service: 'llm',
    tier: tier
  });
}

/**
 * Custom handler for rate limit exceeded
 */
async function rateLimitHandler(req: RateLimitRequest, res: Response) {
  const tier = getUserTier(req);
  const limit = RATE_LIMITS[tier];

  // Log rate limit violation
  logger.warn('LLM Rate limit exceeded', {
    userId: req.user?.id || 'anonymous',
    ip: req.ip,
    tier,
    path: req.path,
    timestamp: new Date().toISOString()
  });

  // Track in database for analytics using request-scoped client (RLS-safe)
  const authHeader = req.headers?.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const { createRequestSupabaseClient } = await import('@shared/lib/supabase');
      const supabase = createRequestSupabaseClient({ headers: { authorization: authHeader } });

      await supabase.from('rate_limit_violations').insert({
        user_id: req.user?.id || null,
        ip_address: req.ip,
        endpoint: req.path,
        tier,
        limit: limit.max,
        window_ms: limit.windowMs,
        violated_at: new Date().toISOString()
      });
    } catch (error) {
      logger.error(
        'Failed to log rate limit violation to database',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  } else {
    logger.warn('Rate limit violation not persisted: no auth token available for request-scoped client');
  }

  res.status(429).json({
    error: 'Rate limit exceeded',
    message: limit.message,
    tier,
    limit: limit.max,
    windowMs: limit.windowMs,
    retryAfter: res.getHeader('Retry-After') as string | undefined,
    upgradeUrl: tier === 'free' ? '/pricing' : undefined
  });
}

/**
 * Skip rate limiting for certain conditions
 */
function skipRateLimit(req: RateLimitRequest): boolean {
  // Skip for health checks
  if (req.path === '/health') return true;

  // Apply rate limits to admin users with higher thresholds (not complete skip)
  // Admin users get higher limits but are still rate limited
  if (req.user?.role === 'admin') {
    return false; // Don't skip, just use higher limits
  }

  // Skip if rate limiting is disabled (for testing)
  if (process.env.DISABLE_RATE_LIMITING === 'true') return true;

  return false;
}

/**
 * Create rate limiter for specific user tier with circuit breaker
 */
async function createTierRateLimiter(tier: keyof typeof RATE_LIMITS) {
  const config = RATE_LIMITS[tier];

  try {
    const client = await redisCircuitBreaker.execute({
      operation: () => getRedisClient(),
      operationName: 'redis-get-client',
      timeout: 5000,
      fallback: () => {
        logger.warn('Redis unavailable, falling back to in-memory rate limiting');
        return null;
      }
    });

    return rateLimit({
      windowMs: config.windowMs,
      max: config.max,
      message: config.message,
      standardHeaders: true, // Return rate limit info in headers
      legacyHeaders: false,

      // Use Redis for distributed rate limiting if available
      ...(client ? {
        store: new RedisStore({
          client: client as any,
          prefix: `rl:${tier}:`
        })
      } : {}),

      keyGenerator,
      handler: rateLimitHandler,
      skip: skipRateLimit
    });
  } catch (error) {
    logger.error('Failed to create rate limiter, using fallback', error as Error);

    // Fallback to in-memory rate limiting
    return rateLimit({
      windowMs: config.windowMs,
      max: config.max,
      message: config.message,
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator,
      handler: rateLimitHandler,
      skip: skipRateLimit
    });
  }
}

/**
 * Dynamic rate limiter that selects limit based on user tier
 */
export const llmRateLimiter = async (req: RateLimitRequest, res: Response, next: NextFunction) => {
  const tier = getUserTier(req);

  let limiterPromise = limiterPromises.get(tier);
  if (!limiterPromise) {
    limiterPromise = createTierRateLimiter(tier);
    limiterPromises.set(tier, limiterPromise);
  }

  const limiter = await limiterPromise;

  // Add tier info to request for logging
  req.rateLimitTier = tier;

  return limiter(req, res, next);
};

let strictLimiterPromise: Promise<RequestHandler> | null = null;

/**
 * Create strict rate limiter with circuit breaker
 */
async function createStrictRateLimiter() {
  try {
    const client = await redisCircuitBreaker.execute({
      operation: () => getRedisClient(),
      operationName: 'redis-get-client-strict',
      timeout: 5000,
      fallback: () => {
        logger.warn('Redis unavailable for strict limiter, using in-memory');
        return null;
      }
    });

    return rateLimit({
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 5, // Only 5 expensive operations per hour
      message: 'Expensive operation limit exceeded. Please try again later.',

      ...(client ? {
        store: new RedisStore({
          client: client as any,
          prefix: 'rl:expensive:'
        })
      } : {}),

      keyGenerator,
      handler: rateLimitHandler,
      skip: skipRateLimit
    });
  } catch (error) {
    logger.error('Failed to create strict rate limiter', error as Error);

    // Fallback to basic rate limiting
    return rateLimit({
      windowMs: 60 * 60 * 1000,
      max: 5,
      message: 'Expensive operation limit exceeded. Please try again later.',
      keyGenerator,
      handler: rateLimitHandler,
      skip: skipRateLimit
    });
  }
}

/**
 * Stricter rate limiter for expensive operations
 * (e.g., long-form content generation, complex analysis)
 */
export const strictLlmRateLimiter = async (req: RateLimitRequest, res: Response, next: NextFunction) => {
  if (!strictLimiterPromise) {
    strictLimiterPromise = createStrictRateLimiter();
  }

  const limiter = await strictLimiterPromise;
  return limiter(req, res, next);
};

/**
 * Get current rate limit status for a user
 */
export async function getRateLimitStatus(userId: string): Promise<{
  tier: string;
  limit: number;
  remaining: number;
  resetAt: Date;
}> {
  const key = RateLimitKeyService.generateUserKey(userId, 'unknown', {
    service: 'llm',
    tier: 'free' // Default tier for status check
  });

  try {
    const redisClient = await redisCircuitBreaker.execute({
      operation: () => getRedisClient(),
      operationName: 'redis-get-client-status',
      timeout: 3000,
      fallback: () => {
        logger.warn('Redis unavailable for rate limit status');
        return null;
      }
    });

    if (redisClient) {
      const current = await redisClient.get(key);
      const ttl = await redisClient.ttl(key);

      // Determine tier (would need to fetch from database)
      const tier = 'free'; // Placeholder
      const config = RATE_LIMITS[tier];

      const used = current ? parseInt(current) : 0;
      const remaining = Math.max(0, config.max - used);
      const resetAt = new Date(Date.now() + (ttl * 1000));

      return {
        tier,
        limit: config.max,
        remaining,
        resetAt
      };
    } else {
      // Return default status when Redis is unavailable
      return {
        tier: 'free',
        limit: RATE_LIMITS.free.max,
        remaining: RATE_LIMITS.free.max,
        resetAt: new Date(Date.now() + 60 * 60 * 1000)
      };
    }
  } catch (error) {
    logger.error('Failed to get rate limit status:', error);
    throw error;
  }
}

/**
 * Reset rate limit for a user (admin function)
 */
export async function resetRateLimit(userId: string): Promise<void> {
  const key = RateLimitKeyService.generateUserKey(userId, 'unknown', {
    service: 'llm',
    tier: 'free'
  });

  try {
    const redisClient = await redisCircuitBreaker.execute({
      operation: () => getRedisClient(),
      operationName: 'redis-get-client-reset',
      timeout: 3000,
      fallback: () => {
        logger.warn('Redis unavailable for rate limit reset');
        return null;
      }
    });

    if (redisClient) {
      await redisClient.del(key);
      logger.info('Rate limit reset', { userId });
    } else {
      logger.warn('Cannot reset rate limit - Redis unavailable', { userId });
    }
  } catch (error) {
    logger.error('Failed to reset rate limit', error as Error);
    throw error;
  }
}
