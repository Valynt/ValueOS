/**
 * Rate Limiting Middleware for Customer Portal API
 * Prevents abuse of public customer endpoints
 */

import { logger } from '@shared/lib/logger';
import { NextFunction, Request, Response } from 'express';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

// In-memory store (use Redis in production)
const rateLimitStore: RateLimitStore = {};

// Rate limit configuration
const RATE_LIMIT_CONFIG = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100, // Max requests per window
  message: 'Too many requests, please try again later'
};

/**
 * Rate limiting middleware for customer endpoints
 */
export function customerRateLimit(req: Request, res: Response, next: NextFunction): void {
  try {
    // Get identifier (IP address or token)
    const identifier = getIdentifier(req);
    const now = Date.now();

    // Initialize or get rate limit data
    if (!rateLimitStore[identifier] || rateLimitStore[identifier].resetTime < now) {
      rateLimitStore[identifier] = {
        count: 0,
        resetTime: now + RATE_LIMIT_CONFIG.windowMs
      };
    }

    const limitData = rateLimitStore[identifier];

    // Increment request count
    limitData.count++;

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', RATE_LIMIT_CONFIG.maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, RATE_LIMIT_CONFIG.maxRequests - limitData.count));
    res.setHeader('X-RateLimit-Reset', new Date(limitData.resetTime).toISOString());

    // Check if limit exceeded
    if (limitData.count > RATE_LIMIT_CONFIG.maxRequests) {
      logger.warn('Rate limit exceeded', {
        identifier,
        count: limitData.count,
        limit: RATE_LIMIT_CONFIG.maxRequests
      });

      res.status(429).json({
        error: 'Too Many Requests',
        message: RATE_LIMIT_CONFIG.message,
        retryAfter: Math.ceil((limitData.resetTime - now) / 1000)
      });
      return;
    }

    // Continue to next middleware
    next();
  } catch (error) {
    logger.error('Error in rate limit middleware', error as Error);
    // Don't block request on rate limit error
    next();
  }
}

/**
 * Get identifier for rate limiting
 */
function getIdentifier(req: Request): string {
  // Try to get token from params or query
  const token = req.params.token || req.query.token;
  
  if (token && typeof token === 'string') {
    return `token:${token}`;
  }

  // Fall back to IP address
  const ip = req.ip || 
             req.headers['x-forwarded-for'] || 
             req.headers['x-real-ip'] || 
             req.socket.remoteAddress ||
             'unknown';

  return `ip:${ip}`;
}

/**
 * Cleanup expired rate limit entries (run periodically)
 */
export function cleanupRateLimitStore(): void {
  const now = Date.now();
  let cleaned = 0;

  for (const key in rateLimitStore) {
    if (rateLimitStore[key].resetTime < now) {
      delete rateLimitStore[key];
      cleaned++;
    }
  }

  if (cleaned > 0) {
    logger.debug('Cleaned up rate limit store', { entriesRemoved: cleaned });
  }
}

// Run cleanup every 5 minutes
setInterval(cleanupRateLimitStore, 5 * 60 * 1000);
