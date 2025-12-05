/**
 * Rate Limiter
 * 
 * Implements rate limiting using the sliding window algorithm.
 * Protects against brute force attacks and API abuse.
 */

import { getSecurityConfig } from './SecurityConfig';

/**
 * Rate limit entry
 */
interface RateLimitEntry {
  count: number;
  resetAt: number;
  requests: number[];
}

/**
 * Rate limit result
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}

/**
 * Rate limit exceeded error
 */
export class RateLimitExceededError extends Error {
  constructor(
    public retryAfter: number,
    public limit: number,
    public window: number
  ) {
    super(`Rate limit exceeded. Try again in ${retryAfter}ms`);
    this.name = 'RateLimitExceededError';
  }
}

/**
 * Rate limiter class
 */
export class RateLimiter {
  private store: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: number | null = null;

  constructor(
    private maxRequests: number,
    private windowMs: number,
    private keyPrefix: string = 'ratelimit'
  ) {
    // Start cleanup interval
    this.startCleanup();
  }

  /**
   * Check if request is allowed
   */
  check(key: string): RateLimitResult {
    const fullKey = `${this.keyPrefix}:${key}`;
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Get or create entry
    let entry = this.store.get(fullKey);
    if (!entry) {
      entry = {
        count: 0,
        resetAt: now + this.windowMs,
        requests: [],
      };
      this.store.set(fullKey, entry);
    }

    // Remove old requests outside the window
    entry.requests = entry.requests.filter(timestamp => timestamp > windowStart);
    entry.count = entry.requests.length;

    // Check if limit exceeded
    if (entry.count >= this.maxRequests) {
      const oldestRequest = entry.requests[0];
      const retryAfter = oldestRequest + this.windowMs - now;

      return {
        allowed: false,
        remaining: 0,
        resetAt: oldestRequest + this.windowMs,
        retryAfter: Math.max(0, retryAfter),
      };
    }

    // Add current request
    entry.requests.push(now);
    entry.count++;
    entry.resetAt = now + this.windowMs;

    return {
      allowed: true,
      remaining: this.maxRequests - entry.count,
      resetAt: entry.resetAt,
    };
  }

  /**
   * Consume a request (throws if limit exceeded)
   */
  consume(key: string): RateLimitResult {
    const result = this.check(key);

    if (!result.allowed) {
      throw new RateLimitExceededError(
        result.retryAfter || 0,
        this.maxRequests,
        this.windowMs
      );
    }

    return result;
  }

  /**
   * Reset rate limit for a key
   */
  reset(key: string): void {
    const fullKey = `${this.keyPrefix}:${key}`;
    this.store.delete(fullKey);
  }

  /**
   * Get current count for a key
   */
  getCount(key: string): number {
    const fullKey = `${this.keyPrefix}:${key}`;
    const entry = this.store.get(fullKey);
    return entry ? entry.count : 0;
  }

  /**
   * Start cleanup interval
   */
  private startCleanup(): void {
    if (this.cleanupInterval) {
      return;
    }

    this.cleanupInterval = window.setInterval(() => {
      this.cleanup();
    }, this.windowMs);
  }

  /**
   * Stop cleanup interval
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.resetAt <= now) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Destroy the rate limiter
   */
  destroy(): void {
    this.stopCleanup();
    this.clear();
  }
}

/**
 * Global rate limiters
 */
const rateLimiters = new Map<string, RateLimiter>();

/**
 * Get or create a rate limiter
 */
function getRateLimiter(
  name: string,
  maxRequests: number,
  windowMs: number
): RateLimiter {
  const key = `${name}:${maxRequests}:${windowMs}`;
  
  if (!rateLimiters.has(key)) {
    rateLimiters.set(key, new RateLimiter(maxRequests, windowMs, name));
  }

  return rateLimiters.get(key)!;
}

/**
 * Check global rate limit
 */
export function checkGlobalRateLimit(key: string): RateLimitResult {
  const config = getSecurityConfig().rateLimit.global;
  const limiter = getRateLimiter('global', config.maxRequests, config.windowMs);
  return limiter.check(key);
}

/**
 * Check per-user rate limit
 */
export function checkUserRateLimit(userId: string): RateLimitResult {
  const config = getSecurityConfig().rateLimit.perUser;
  const limiter = getRateLimiter('user', config.maxRequests, config.windowMs);
  return limiter.check(userId);
}

/**
 * Check per-organization rate limit
 */
export function checkOrgRateLimit(orgId: string): RateLimitResult {
  const config = getSecurityConfig().rateLimit.perOrg;
  const limiter = getRateLimiter('org', config.maxRequests, config.windowMs);
  return limiter.check(orgId);
}

/**
 * Check authentication rate limit
 */
export function checkAuthRateLimit(identifier: string): RateLimitResult {
  const config = getSecurityConfig().rateLimit.auth;
  const limiter = getRateLimiter('auth', config.maxRequests, config.windowMs);
  return limiter.check(identifier);
}

/**
 * Consume global rate limit
 */
export function consumeGlobalRateLimit(key: string): RateLimitResult {
  const config = getSecurityConfig().rateLimit.global;
  const limiter = getRateLimiter('global', config.maxRequests, config.windowMs);
  return limiter.consume(key);
}

/**
 * Consume user rate limit
 */
export function consumeUserRateLimit(userId: string): RateLimitResult {
  const config = getSecurityConfig().rateLimit.perUser;
  const limiter = getRateLimiter('user', config.maxRequests, config.windowMs);
  return limiter.consume(userId);
}

/**
 * Consume organization rate limit
 */
export function consumeOrgRateLimit(orgId: string): RateLimitResult {
  const config = getSecurityConfig().rateLimit.perOrg;
  const limiter = getRateLimiter('org', config.maxRequests, config.windowMs);
  return limiter.consume(orgId);
}

/**
 * Consume authentication rate limit
 */
export function consumeAuthRateLimit(identifier: string): RateLimitResult {
  const config = getSecurityConfig().rateLimit.auth;
  const limiter = getRateLimiter('auth', config.maxRequests, config.windowMs);
  return limiter.consume(identifier);
}

/**
 * Reset rate limit
 */
export function resetRateLimit(type: 'global' | 'user' | 'org' | 'auth', key: string): void {
  const config = getSecurityConfig().rateLimit[type === 'global' ? 'global' : type === 'user' ? 'perUser' : type === 'org' ? 'perOrg' : 'auth'];
  const limiter = getRateLimiter(type, config.maxRequests, config.windowMs);
  limiter.reset(key);
}

/**
 * Fetch wrapper with rate limiting
 */
export async function fetchWithRateLimit(
  url: string,
  options: RequestInit = {},
  rateLimitKey?: string
): Promise<Response> {
  // Check rate limit
  const key = rateLimitKey || url;
  const result = checkGlobalRateLimit(key);

  if (!result.allowed) {
    throw new RateLimitExceededError(
      result.retryAfter || 0,
      getSecurityConfig().rateLimit.global.maxRequests,
      getSecurityConfig().rateLimit.global.windowMs
    );
  }

  // Make request
  const response = await fetch(url, options);

  // Add rate limit headers to response
  const headers = new Headers(response.headers);
  headers.set('X-RateLimit-Limit', String(getSecurityConfig().rateLimit.global.maxRequests));
  headers.set('X-RateLimit-Remaining', String(result.remaining));
  headers.set('X-RateLimit-Reset', String(result.resetAt));

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * React hook for rate limiting
 */
export function useRateLimit(
  type: 'global' | 'user' | 'org' | 'auth',
  key: string
): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
  check: () => RateLimitResult;
  consume: () => RateLimitResult;
  reset: () => void;
} {
  const [state, setState] = React.useState<RateLimitResult>({
    allowed: true,
    remaining: 0,
    resetAt: 0,
  });

  const check = React.useCallback(() => {
    let result: RateLimitResult;
    
    switch (type) {
      case 'global':
        result = checkGlobalRateLimit(key);
        break;
      case 'user':
        result = checkUserRateLimit(key);
        break;
      case 'org':
        result = checkOrgRateLimit(key);
        break;
      case 'auth':
        result = checkAuthRateLimit(key);
        break;
    }

    setState(result);
    return result;
  }, [type, key]);

  const consume = React.useCallback(() => {
    let result: RateLimitResult;
    
    switch (type) {
      case 'global':
        result = consumeGlobalRateLimit(key);
        break;
      case 'user':
        result = consumeUserRateLimit(key);
        break;
      case 'org':
        result = consumeOrgRateLimit(key);
        break;
      case 'auth':
        result = consumeAuthRateLimit(key);
        break;
    }

    setState(result);
    return result;
  }, [type, key]);

  const reset = React.useCallback(() => {
    resetRateLimit(type, key);
    check();
  }, [type, key, check]);

  React.useEffect(() => {
    check();
  }, [check]);

  return {
    ...state,
    check,
    consume,
    reset,
  };
}

/**
 * Cleanup all rate limiters
 */
export function cleanupRateLimiters(): void {
  for (const limiter of rateLimiters.values()) {
    limiter.destroy();
  }
  rateLimiters.clear();
}

// Import React for the hook
import React from 'react';
