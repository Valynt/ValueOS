/**
 * Base Service Class
 * Provides common functionality for all service classes including:
 * - Retry logic with exponential backoff
 * - Request deduplication
 * - Logging
 * - Error handling
 */

import { logger } from '../lib/logger';
import { supabase } from '../lib/supabase';
import { ServiceError, NetworkError, TimeoutError, handleServiceError } from './errors';

export interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

export interface RequestConfig {
  timeout?: number;
  retries?: Partial<RetryConfig>;
  deduplicationKey?: string;
  skipCache?: boolean;
}

interface PendingRequest {
  promise: Promise<any>;
  timestamp: number;
}

export abstract class BaseService {
  protected supabase = supabase;
  protected serviceName: string;

  private pendingRequests: Map<string, PendingRequest> = new Map();
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly DEDUP_TIMEOUT = 1000; // 1 second

  private readonly defaultRetryConfig: RetryConfig = {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
  };

  constructor(serviceName: string) {
    this.serviceName = serviceName;
  }

  /**
   * Execute a request with retry logic, deduplication, and error handling
   */
  protected async executeRequest<T>(
    operation: () => Promise<T>,
    config: RequestConfig = {}
  ): Promise<T> {
    const deduplicationKey = config.deduplicationKey;

    // Request deduplication
    if (deduplicationKey) {
      const pending = this.pendingRequests.get(deduplicationKey);
      if (pending && Date.now() - pending.timestamp < this.DEDUP_TIMEOUT) {
        this.log('debug', `Deduplicating request: ${deduplicationKey}`);
        return pending.promise;
      }
    }

    // Check cache
    if (deduplicationKey && !config.skipCache) {
      const cached = this.cache.get(deduplicationKey);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        this.log('debug', `Cache hit: ${deduplicationKey}`);
        return cached.data;
      }
    }

    const retryConfig = { ...this.defaultRetryConfig, ...config.retries };
    const promise = this.executeWithRetry(operation, retryConfig, config.timeout);

    // Store pending request
    if (deduplicationKey) {
      this.pendingRequests.set(deduplicationKey, {
        promise,
        timestamp: Date.now(),
      });

      promise.finally(() => {
        this.pendingRequests.delete(deduplicationKey);
      });
    }

    try {
      const result = await promise;

      // Cache successful result
      if (deduplicationKey && !config.skipCache) {
        this.cache.set(deduplicationKey, {
          data: result,
          timestamp: Date.now(),
        });
      }

      return result;
    } catch (error) {
      throw handleServiceError(error);
    }
  }

  /**
   * Execute operation with exponential backoff retry logic
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    config: RetryConfig,
    timeout?: number
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        if (timeout) {
          return await this.withTimeout(operation(), timeout);
        }
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on certain errors
        if (this.shouldNotRetry(error)) {
          throw error;
        }

        if (attempt < config.maxRetries) {
          const delay = Math.min(
            config.initialDelay * Math.pow(config.backoffMultiplier, attempt),
            config.maxDelay
          );

          this.log('warn', `Attempt ${attempt + 1} failed, retrying in ${delay}ms`, {
            error: lastError.message,
          });

          await this.sleep(delay);
        }
      }
    }

    this.log('error', `All retry attempts failed`, { error: lastError?.message });
    throw new NetworkError('Operation failed after multiple retries', lastError);
  }

  /**
   * Wrap promise with timeout
   */
  private withTimeout<T>(promise: Promise<T>, timeout: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new TimeoutError()), timeout)
      ),
    ]);
  }

  /**
   * Determine if error should not be retried
   */
  private shouldNotRetry(error: unknown): boolean {
    if (error instanceof ServiceError) {
      const nonRetryableCodes = [
        'VALIDATION_ERROR',
        'AUTHENTICATION_ERROR',
        'AUTHORIZATION_ERROR',
        'NOT_FOUND',
      ];
      return nonRetryableCodes.includes(error.code);
    }
    return false;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Clear cache for a specific key or all cache
   */
  protected clearCache(key?: string): void {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Logging utility
   */
  protected log(
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    data?: any
  ): void {
    const logData = {
      service: this.serviceName,
      timestamp: new Date().toISOString(),
      message,
      ...data,
    };

    if (process.env.NODE_ENV === 'development') {
      console[level](logData);
    }

    // In production, send to logging service
    if (process.env.NODE_ENV === 'production' && level === 'error') {
      // Send to error tracking service (e.g., Sentry)
    }
  }

  /**
   * Validate required fields
   */
  protected validateRequired<T extends Record<string, any>>(
    data: T,
    fields: (keyof T)[]
  ): void {
    const missing = fields.filter((field) => !data[field]);
    if (missing.length > 0) {
      throw new ServiceError(
        `Missing required fields: ${missing.join(', ')}`,
        'VALIDATION_ERROR'
      );
    }
  }
}
