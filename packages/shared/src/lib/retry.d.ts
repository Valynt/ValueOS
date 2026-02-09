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
import { type AsyncResult } from '../types/result.js';
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
export declare const DEFAULT_RETRY_OPTIONS: RetryOptions;
/**
 * Common retry predicates
 */
export declare const retryPredicates: {
    /** Retry on any error */
    always: () => boolean;
    /** Never retry */
    never: () => boolean;
    /** Retry on network errors */
    networkErrors: (error: unknown) => boolean;
    /** Retry on specific HTTP status codes */
    httpStatus: (codes: number[]) => (error: unknown) => boolean;
    /** Retry on 5xx errors */
    serverErrors: (error: unknown) => boolean;
    /** Retry on rate limiting (429) */
    rateLimited: (error: unknown) => boolean;
};
/**
 * Execute an async function with retry logic
 */
export declare function withRetry<T>(fn: () => Promise<T>, options?: Partial<RetryOptions>): AsyncResult<T, Error>;
/**
 * Create a retryable version of an async function
 */
export declare function withRetryWrapper<T extends (...args: any[]) => Promise<any>>(fn: T, options?: Partial<RetryOptions>): (...args: Parameters<T>) => AsyncResult<Awaited<ReturnType<T>>, Error>;
/**
 * Execute with timeout
 */
export declare function withTimeout<T>(fn: () => Promise<T>, timeoutMs: number): AsyncResult<T, Error>;
/**
 * Execute with both retry and timeout
 */
export declare function withRetryAndTimeout<T>(fn: () => Promise<T>, options?: Partial<RetryOptions> & {
    timeoutMs?: number;
}): AsyncResult<T, Error>;
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
export declare function createCircuitBreaker<T>(fn: () => Promise<T>, options: {
    failureThreshold: number;
    resetTimeoutMs: number;
    onStateChange?: (state: CircuitBreakerState['state']) => void;
}): () => AsyncResult<T, Error>;
//# sourceMappingURL=retry.d.ts.map