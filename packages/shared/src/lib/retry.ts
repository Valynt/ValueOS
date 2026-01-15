/**
 * Retry & Backoff Utilities
 *
 * Composable retry utilities with exponential backoff.
 * Returns Result types for consistent error handling.
 *
 * @example
 * const result = await withRetry(() => fetchData(), {
 *   maxAttempts: 3,
 *   baseDelayMs: 100,
 * });
 *
 * if (result.ok) {
 *   console.log(result.value);
 * } else {
 *   console.error('All retries failed:', result.error);
 * }
 */

import { Result, type AsyncResult } from '../types/result.js';

/**
 * Retry configuration options
 */
export interface RetryOptions {
  /** Maximum number of attempts (including initial) */
  maxAttempts: number;
  /** Base delay in milliseconds */
  baseDelayMs: number;
  /** Maximum delay in milliseconds */
  maxDelayMs: number;
  /** Backoff multiplier (e.g., 2 for exponential) */
  backoffMultiplier: number;
  /** Jitter factor (0-1) to randomize delay */
  jitterFactor: number;
  /** Predicate to determine if error is retryable */
  retryOn?: (error: unknown) => boolean;
  /** Callback for each retry attempt */
  onRetry?: (attempt: number, error: unknown, delayMs: number) => void;
}

/**
 * Default retry options
 */
export const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  baseDelayMs: 100,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  jitterFactor: 0.1,
};

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(
  attempt: number,
  options: RetryOptions
): number {
  const exponentialDelay =
    options.baseDelayMs * Math.pow(options.backoffMultiplier, attempt - 1);
  const cappedDelay = Math.min(exponentialDelay, options.maxDelayMs);

  // Add jitter
  const jitter = cappedDelay * options.jitterFactor * (Math.random() * 2 - 1);
  return Math.max(0, Math.round(cappedDelay + jitter));
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Default retry predicate - retry on any error
 */
const defaultRetryOn = (): boolean => true;

/**
 * Common retry predicates
 */
export const retryPredicates = {
  /** Retry on any error */
  always: () => true,

  /** Never retry */
  never: () => false,

  /** Retry on network errors */
  networkErrors: (error: unknown): boolean => {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes('network') ||
        message.includes('timeout') ||
        message.includes('econnrefused') ||
        message.includes('econnreset') ||
        message.includes('fetch failed')
      );
    }
    return false;
  },

  /** Retry on specific HTTP status codes */
  httpStatus: (codes: number[]) => (error: unknown): boolean => {
    if (error && typeof error === 'object' && 'status' in error) {
      return codes.includes((error as { status: number }).status);
    }
    return false;
  },

  /** Retry on 5xx errors */
  serverErrors: (error: unknown): boolean => {
    if (error && typeof error === 'object' && 'status' in error) {
      const status = (error as { status: number }).status;
      return status >= 500 && status < 600;
    }
    return false;
  },

  /** Retry on rate limiting (429) */
  rateLimited: (error: unknown): boolean => {
    if (error && typeof error === 'object' && 'status' in error) {
      return (error as { status: number }).status === 429;
    }
    return false;
  },
};

/**
 * Execute an async function with retry logic
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: Partial<RetryOptions>
): AsyncResult<T, Error> {
  const opts: RetryOptions = { ...DEFAULT_RETRY_OPTIONS, ...options };
  const retryOn = opts.retryOn ?? defaultRetryOn;

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      const result = await fn();
      return Result.ok(result);
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));

      const isLastAttempt = attempt === opts.maxAttempts;
      const shouldRetry = !isLastAttempt && retryOn(e);

      if (!shouldRetry) {
        break;
      }

      const delayMs = calculateDelay(attempt, opts);

      if (opts.onRetry) {
        opts.onRetry(attempt, lastError, delayMs);
      }

      await sleep(delayMs);
    }
  }

  return Result.err(lastError ?? new Error('Retry failed'));
}

/**
 * Create a retryable version of an async function
 */
export function withRetryWrapper<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options?: Partial<RetryOptions>
): (...args: Parameters<T>) => AsyncResult<Awaited<ReturnType<T>>, Error> {
  return async (...args: Parameters<T>) => {
    return withRetry(() => fn(...args), options);
  };
}

/**
 * Execute with timeout
 */
export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number
): AsyncResult<T, Error> {
  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      resolve(Result.err(new Error(`Operation timed out after ${timeoutMs}ms`)));
    }, timeoutMs);

    fn()
      .then((value) => {
        clearTimeout(timeoutId);
        resolve(Result.ok(value));
      })
      .catch((e) => {
        clearTimeout(timeoutId);
        resolve(Result.err(e instanceof Error ? e : new Error(String(e))));
      });
  });
}

/**
 * Execute with both retry and timeout
 */
export async function withRetryAndTimeout<T>(
  fn: () => Promise<T>,
  options?: Partial<RetryOptions> & { timeoutMs?: number }
): AsyncResult<T, Error> {
  const { timeoutMs = 30000, ...retryOptions } = options ?? {};

  return withRetry(
    () => {
      return new Promise<T>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error(`Operation timed out after ${timeoutMs}ms`));
        }, timeoutMs);

        fn()
          .then((value) => {
            clearTimeout(timeoutId);
            resolve(value);
          })
          .catch((e) => {
            clearTimeout(timeoutId);
            reject(e);
          });
      });
    },
    retryOptions
  );
}

/**
 * Circuit breaker state
 */
export interface CircuitBreakerState {
  failures: number;
  lastFailure: number | null;
  state: 'closed' | 'open' | 'half-open';
}

/**
 * Simple circuit breaker implementation
 */
export function createCircuitBreaker<T>(
  fn: () => Promise<T>,
  options: {
    failureThreshold: number;
    resetTimeoutMs: number;
    onStateChange?: (state: CircuitBreakerState['state']) => void;
  }
) {
  const state: CircuitBreakerState = {
    failures: 0,
    lastFailure: null,
    state: 'closed',
  };

  return async (): AsyncResult<T, Error> => {
    const now = Date.now();

    // Check if circuit should transition from open to half-open
    if (
      state.state === 'open' &&
      state.lastFailure &&
      now - state.lastFailure >= options.resetTimeoutMs
    ) {
      state.state = 'half-open';
      options.onStateChange?.('half-open');
    }

    // Reject immediately if circuit is open
    if (state.state === 'open') {
      return Result.err(new Error('Circuit breaker is open'));
    }

    try {
      const result = await fn();

      // Reset on success
      if (state.state === 'half-open') {
        state.state = 'closed';
        options.onStateChange?.('closed');
      }
      state.failures = 0;

      return Result.ok(result);
    } catch (e) {
      state.failures++;
      state.lastFailure = now;

      if (state.failures >= options.failureThreshold) {
        state.state = 'open';
        options.onStateChange?.('open');
      }

      return Result.err(e instanceof Error ? e : new Error(String(e)));
    }
  };
}
