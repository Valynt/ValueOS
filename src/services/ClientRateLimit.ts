/**
 * Client-Side Rate Limiting
 * Provides rate limiting for client-side API calls and user actions
 */

import { createLogger } from '../lib/logger';

const logger = createLogger({ component: 'ClientRateLimit' });

export interface ClientRateLimitOptions extends Omit<RateLimitConfig, 'handler'> {
  onLimitExceeded?: (key: string, result: any) => void;
  onLimitWarning?: (key: string, remaining: number) => void;
  warningThreshold?: number; // Warn when remaining requests <= this number
}

export class ClientRateLimit {
  private static instance: ClientRateLimit;
  private limits: Map<string, ClientRateLimitOptions> = new Map();

  private constructor() {}

  static getInstance(): ClientRateLimit {
    if (!ClientRateLimit.instance) {
      ClientRateLimit.instance = new ClientRateLimit();
    }
    return ClientRateLimit.instance;
  }

  /**
   * Register a rate limit for a specific action
   */
  registerLimit(key: string, options: ClientRateLimitOptions): void {
    this.limits.set(key, options);
    logger.debug('Rate limit registered', { key, options });
  }

  /**
   * Check if an action should be allowed
   */
  async checkLimit(key: string): Promise<boolean> {
    const options = this.limits.get(key);
    if (!options) {
      return true; // No limit configured
    }

    const result = rateLimitService.checkLimit(key, options);

    // Check for warnings
    if (options.onLimitWarning && options.warningThreshold && result.remaining <= options.warningThreshold) {
      options.onLimitWarning(key, result.remaining);
    }

    if (!result.allowed && options.onLimitExceeded) {
      options.onLimitExceeded(key, result);
    }

    return result.allowed;
  }

  /**
   * Execute an action with rate limiting
   */
  async executeWithLimit<T>(
    key: string,
    action: () => Promise<T>,
    fallback?: () => T
  ): Promise<T | null> {
    const allowed = await this.checkLimit(key);

    if (!allowed) {
      if (fallback) {
        logger.warn('Rate limit exceeded, using fallback', { key });
        return fallback();
      }

      logger.error('Rate limit exceeded, action blocked', { key });
      throw new Error(`Rate limit exceeded for action: ${key}`);
    }

    return action();
  }

  /**
   * Get rate limit status for an action
   */
  getLimitStatus(key: string): any {
    const options = this.limits.get(key);
    if (!options) return null;

    return rateLimitService.getStatus(key, options);
  }

  /**
   * Reset rate limit for an action
   */
  resetLimit(key: string): void {
    rateLimitService.resetKey(key);
    logger.debug('Rate limit reset', { key });
  }
}

// Export singleton instance
export const clientRateLimit = ClientRateLimit.getInstance();

// Pre-configured client-side rate limiters
export const setupDefaultRateLimits = (): void => {
  // API calls - 100 per 15 minutes
  clientRateLimit.registerLimit('api-calls', {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
    warningThreshold: 10,
    onLimitWarning: (key, remaining) => {
      logger.warn(`API rate limit warning: ${remaining} requests remaining`, { key });
      // Could trigger UI notification here
    },
    onLimitExceeded: (key) => {
      logger.error('API rate limit exceeded', { key });
      // Could trigger error modal or redirect
    },
  });

  // Authentication attempts - 5 per 15 minutes
  clientRateLimit.registerLimit('auth-attempts', {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
    warningThreshold: 1,
    onLimitWarning: (key, remaining) => {
      logger.warn(`Auth rate limit warning: ${remaining} attempts remaining`, { key });
    },
    onLimitExceeded: (key) => {
      logger.error('Auth rate limit exceeded', { key });
    },
  });

  // LLM API calls - 50 per hour
  clientRateLimit.registerLimit('llm-calls', {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 50,
    warningThreshold: 5,
    onLimitWarning: (key, remaining) => {
      logger.warn(`LLM rate limit warning: ${remaining} calls remaining`, { key });
    },
    onLimitExceeded: (key) => {
      logger.error('LLM rate limit exceeded', { key });
    },
  });

  // File uploads - 10 per hour
  clientRateLimit.registerLimit('file-uploads', {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10,
    warningThreshold: 2,
    onLimitWarning: (key, remaining) => {
      logger.warn(`File upload rate limit warning: ${remaining} uploads remaining`, { key });
    },
    onLimitExceeded: (key) => {
      logger.error('File upload rate limit exceeded', { key });
    },
  });

  // WebSocket connections - 20 per minute
  clientRateLimit.registerLimit('websocket-connections', {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 20,
    onLimitExceeded: (key) => {
      logger.error('WebSocket connection rate limit exceeded', { key });
    },
  });

  logger.info('Default client-side rate limits configured');
};
