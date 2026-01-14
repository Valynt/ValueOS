/**
 * LLM Rate Limiter Middleware
 *
 * Implements strict rate limiting for LLM endpoints to prevent cost overruns
 * from Together.ai API usage. Uses Redis for distributed rate limiting.
 */

import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { getRedisClient } from '@lib/redisClient';
import { Request, Response } from 'express';

import { NextFunction } from 'express';

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

  const tier = req.user.subscription_tier || 'free';
  return tier as keyof typeof RATE_LIMITS;
}

/**
 * Generate rate limit key based on user ID or IP
 */
function keyGenerator(req: RateLimitRequest): string {
  const userId = req.user?.id;
  if (userId) {
    return `llm_rate_limit:user:${userId}`;
  }
  // Fallback to IP for anonymous users
  return `llm_rate_limit:ip:${req.ip}`;
}

/**
 * Custom handler for rate limit exceeded
 */
async function rateLimitHandler(req: RateLimitRequest, res: Response) {
  const tier = getUserTier(req);
  const limit = RATE_LIMITS[tier];

  // Log rate limit violation
  console.warn('LLM Rate limit exceeded', {
    userId: req.user?.id || 'anonymous',
    ip: req.ip,
    tier,
    path: req.path,
    timestamp: new Date().toISOString()
  });

  // Track in database for analytics
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

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
    console.error('Failed to log rate limit violation:', error);
  }

  res.status(429).json({
    error: 'Rate limit exceeded',
    message: limit.message,
    tier,
    limit: limit.max,
    windowMs: limit.windowMs,
    retryAfter: res.getHeader('Retry-After'),
    upgradeUrl: tier === 'free' ? '/pricing' : undefined
  });
}

/**
 * Skip rate limiting for certain conditions
 */
function skipRateLimit(req: RateLimitRequest): boolean {
  // Skip for health checks
  if (req.path === '/health') return true;

  // Skip for admin users
  if (req.user?.role === 'admin') return true;

  // Skip if rate limiting is disabled (for testing)
  if (process.env.DISABLE_RATE_LIMITING === 'true') return true;

  return false;
}

/**
 * Create rate limiter for specific user tier
 */
async function createTierRateLimiter(tier: keyof typeof RATE_LIMITS) {
  const config = RATE_LIMITS[tier];
  const client = await getRedisClient();

  return rateLimit({
    windowMs: config.windowMs,
    max: config.max,
    message: config.message,
    standardHeaders: true, // Return rate limit info in headers
    legacyHeaders: false,

    // Use Redis for distributed rate limiting
    store: new RedisStore({
      client: client as any,
      prefix: `rl:${tier}:`
    }),

    keyGenerator,
    handler: rateLimitHandler,
    skip: skipRateLimit
  });
}

/**
 * Dynamic rate limiter that selects limit based on user tier
 */
export const llmRateLimiter = async (req: RateLimitRequest, res: Response, next: NextFunction) => {
  const tier = getUserTier(req);
  const limiter = await createTierRateLimiter(tier);

  // Add tier info to request for logging
  req.rateLimitTier = tier;

  return limiter(req, res, next);
};

/**
 * Stricter rate limiter for expensive operations
 * (e.g., long-form content generation, complex analysis)
 */
export const strictLlmRateLimiter = async (req: RateLimitRequest, res: Response, next: NextFunction) => {
  const client = await getRedisClient();
  const limiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Only 5 expensive operations per hour
  message: 'Expensive operation limit exceeded. Please try again later.',

    store: new RedisStore({
      client: client as any,
      prefix: 'rl:expensive:'
    }),

    keyGenerator,
    handler: rateLimitHandler,
    skip: skipRateLimit
  });

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
  const key = `llm_rate_limit:user:${userId}`;

  try {
    const redisClient = await getRedisClient();
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
  } catch (error) {
    console.error('Failed to get rate limit status:', error);
    throw error;
  }
}

/**
 * Reset rate limit for a user (admin function)
 */
export async function resetRateLimit(userId: string): Promise<void> {
  const key = `llm_rate_limit:user:${userId}`;
  const redisClient = await getRedisClient();
  await redisClient.del(key);
}

