/**
 * Sophisticated Retry Service for Transient Failures
 *
 * Provides intelligent retry strategies with:
 * - Exponential backoff with jitter
 * - Circuit breaker pattern
 * - Retry classification (transient vs permanent)
 * - Context-aware retry policies
 * - Comprehensive telemetry
 */

import { logger } from '../lib/logger';
import { sduiTelemetry, TelemetryEventType } from '../lib/telemetry/SDUITelemetry';

export interface RetryOptions {
  maxAttempts?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  jitter?: boolean;
  retryCondition?: (error: unknown) => boolean;
  onRetry?: (attempt: number, error: unknown, delay: number) => void;
  circuitBreakerThreshold?: number;
  circuitBreakerTimeout?: number;
  context?: Record<string, unknown>;
}

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: unknown;
  attempts: number;
  totalDelay: number;
  circuitBreakerTripped?: boolean;
}

export class RetryService {
  private static circuitBreakers = new Map<string, {
    failures: number;
    lastFailureTime: number;
    isTripped: boolean;
  }>();

  /**
   * Execute function with sophisticated retry logic
   */
  static async executeWithRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<RetryResult<T>> {
    const {
      maxAttempts = 3,
      baseDelay = 1000,
      maxDelay = 30000,
      backoffMultiplier = 2,
      jitter = true,
      retryCondition = this.isTransientError,
      onRetry,
      circuitBreakerThreshold = 5,
      circuitBreakerTimeout = 60000,
      context = {}
    } = options;

    const circuitBreakerKey = this.getCircuitBreakerKey(context);
    const circuitBreaker = this.getCircuitBreaker(circuitBreakerKey);

    // Check circuit breaker
    if (this.isCircuitBreakerTripped(circuitBreaker, circuitBreakerTimeout)) {
      logger.warn('Circuit breaker is tripped, skipping execution', {
        circuitBreakerKey,
        context
      });

      sduiTelemetry.recordEvent({
        type: TelemetryEventType.CIRCUIT_BREAKER_TRIPPED,
        metadata: {
          circuitBreakerKey,
          failures: circuitBreaker.failures,
          timeSinceLastFailure: Date.now() - circuitBreaker.lastFailureTime,
          ...context
        }
      });

      return {
        success: false,
        error: new Error('Circuit breaker is tripped'),
        attempts: 0,
        totalDelay: 0,
        circuitBreakerTripped: true
      };
    }

    let lastError: unknown;
    let totalDelay = 0;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const attemptStartTime = Date.now();

      try {
        const result = await fn();

        // Reset circuit breaker on success
        this.resetCircuitBreaker(circuitBreaker);

        sduiTelemetry.recordEvent({
          type: TelemetryEventType.RETRY_SUCCESS,
          metadata: {
            attempts: attempt,
            totalDelay,
            circuitBreakerKey,
            ...context
          }
        });

        return {
          success: true,
          result,
          attempts: attempt,
          totalDelay
        };

      } catch (error) {
        lastError = error;
        const attemptDuration = Date.now() - attemptStartTime;

        logger.warn(`Attempt ${attempt} failed`, {
          error: error instanceof Error ? error.message : String(error),
          attemptDuration,
          context
        });

        // Check if error is retryable
        if (!retryCondition(error) || attempt === maxAttempts) {
          // Update circuit breaker for non-retryable errors
          this.updateCircuitBreaker(circuitBreaker);

          sduiTelemetry.recordEvent({
            type: TelemetryEventType.RETRY_FAILED,
            metadata: {
              attempts: attempt,
              totalDelay,
              finalError: error instanceof Error ? error.message : String(error),
              circuitBreakerKey,
              ...context
            }
          });

          return {
            success: false,
            error,
            attempts: attempt,
            totalDelay
          };
        }

        // Calculate delay for next attempt
        const delay = this.calculateDelay(
          attempt,
          baseDelay,
          maxDelay,
          backoffMultiplier,
          jitter
        );

        totalDelay += delay;

        // Notify about retry
        onRetry?.(attempt, error, delay);

        logger.info(`Retrying in ${delay}ms`, {
          attempt,
          maxAttempts,
          delay,
          context
        });

        // Wait before retry
        await this.sleep(delay);
      }
    }

    // This should never be reached, but TypeScript safety
    return {
      success: false,
      error: lastError,
      attempts: maxAttempts,
      totalDelay
    };
  }

  /**
   * Execute multiple operations in parallel with retry
   */
  static async executeParallelWithRetry<T>(
    operations: Array<{ fn: () => Promise<T>; options?: RetryOptions }>,
    options: RetryOptions = {}
  ): Promise<RetryResult<T>[]> {
    const results = await Promise.allSettled(
      operations.map(op => this.executeWithRetry(op.fn, { ...options, ...op.options }))
    );

    return results.map(result => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          success: false,
          error: result.reason,
          attempts: 0,
          totalDelay: 0
        };
      }
    });
  }

  /**
   * Create a retryable function wrapper
   */
  static createRetryableFunction<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    defaultOptions: RetryOptions = {}
  ): T {
    return (async (...args: Parameters<T>) => {
      const result = await this.executeWithRetry(
        () => fn(...args),
        defaultOptions
      );

      if (result.success) {
        return result.result;
      } else {
        throw result.error;
      }
    }) as T;
  }

  /**
   * Determine if an error is transient (retryable)
   */
  private static isTransientError(error: unknown): boolean {
    if (error instanceof Error) {
      // Network errors
      if (error.name === 'FetchError' || error.name === 'NetworkError') {
        return true;
      }

      // HTTP status codes that are typically transient
      const message = error.message.toLowerCase();
      const transientStatusCodes = [
        '408', // Request Timeout
        '429', // Too Many Requests
        '500', // Internal Server Error
        '502', // Bad Gateway
        '503', // Service Unavailable
        '504', // Gateway Timeout
        '507', // Insufficient Storage
        '509', // Bandwidth Limit Exceeded
        '520', // Unknown Error
        '521', // Web Server Is Down
        '522', // Connection Timed Out
        '523', // Origin Is Unreachable
        '524', // A Timeout Occurred
      ];

      return transientStatusCodes.some(code => message.includes(code)) ||
             message.includes('timeout') ||
             message.includes('connection') ||
             message.includes('network') ||
             message.includes('rate limit') ||
             message.includes('temporary');
    }

    // Default to non-retryable for unknown error types
    return false;
  }

  /**
   * Calculate delay with exponential backoff and jitter
   */
  private static calculateDelay(
    attempt: number,
    baseDelay: number,
    maxDelay: number,
    multiplier: number,
    jitter: boolean
  ): number {
    // Exponential backoff
    let delay = baseDelay * Math.pow(multiplier, attempt - 1);

    // Apply jitter to prevent thundering herd
    if (jitter) {
      delay = delay * (0.5 + Math.random() * 0.5);
    }

    // Cap at maximum delay
    return Math.min(delay, maxDelay);
  }

  /**
   * Sleep helper
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get circuit breaker key from context
   */
  private static getCircuitBreakerKey(context: Record<string, unknown>): string {
    // Use service name, operation, or other context to create unique key
    return context.serviceId ||
           context.operation ||
           context.endpoint ||
           'default';
  }

  /**
   * Get or create circuit breaker
   */
  private static getCircuitBreaker(key: string) {
    if (!this.circuitBreakers.has(key)) {
      this.circuitBreakers.set(key, {
        failures: 0,
        lastFailureTime: 0,
        isTripped: false
      });
    }
    return this.circuitBreakers.get(key)!;
  }

  /**
   * Check if circuit breaker is tripped
   */
  private static isCircuitBreakerTripped(
    circuitBreaker: { failures: number; lastFailureTime: number; isTripped: boolean },
    timeout: number
  ): boolean {
    if (!circuitBreaker.isTripped) {
      return false;
    }

    const timeSinceLastFailure = Date.now() - circuitBreaker.lastFailureTime;
    return timeSinceLastFailure < timeout;
  }

  /**
   * Update circuit breaker on failure
   */
  private static updateCircuitBreaker(
    circuitBreaker: { failures: number; lastFailureTime: number; isTripped: boolean },
    threshold: number = 5
  ): void {
    circuitBreaker.failures++;
    circuitBreaker.lastFailureTime = Date.now();

    if (circuitBreaker.failures >= threshold) {
      circuitBreaker.isTripped = true;
      logger.warn('Circuit breaker tripped', {
        failures: circuitBreaker.failures,
        threshold
      });
    }
  }

  /**
   * Reset circuit breaker on success
   */
  private static resetCircuitBreaker(
    circuitBreaker: { failures: number; lastFailureTime: number; isTripped: boolean }
  ): void {
    if (circuitBreaker.failures > 0) {
      logger.info('Circuit breaker reset', {
        previousFailures: circuitBreaker.failures
      });
    }

    circuitBreaker.failures = 0;
    circuitBreaker.lastFailureTime = 0;
    circuitBreaker.isTripped = false;
  }

  /**
   * Get circuit breaker status for monitoring
   */
  static getCircuitBreakerStatus(): Record<string, {
    failures: number;
    lastFailureTime: number;
    isTripped: boolean;
    timeSinceLastFailure?: number;
  }> {
    const status: Record<string, any> = {};

    for (const [key, breaker] of this.circuitBreakers.entries()) {
      status[key] = {
        ...breaker,
        timeSinceLastFailure: breaker.lastFailureTime ? Date.now() - breaker.lastFailureTime : undefined
      };
    }

    return status;
  }

  /**
   * Reset all circuit breakers (for testing or recovery)
   */
  static resetAllCircuitBreakers(): void {
    logger.info('Resetting all circuit breakers', {
      count: this.circuitBreakers.size
    });

    this.circuitBreakers.clear();
  }
}

// Convenience functions for common retry patterns
export const withRetry = RetryService.executeWithRetry;
export const createRetryable = RetryService.createRetryableFunction;
