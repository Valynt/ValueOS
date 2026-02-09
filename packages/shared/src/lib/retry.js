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
import { Result } from '../types/result.js';
/**
 * Default retry options
 */
export const DEFAULT_RETRY_OPTIONS = {
    maxAttempts: 3,
    baseDelayMs: 100,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
    jitterFactor: 0.1,
};
/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(attempt, options) {
    const exponentialDelay = options.baseDelayMs * Math.pow(options.backoffMultiplier, attempt - 1);
    const cappedDelay = Math.min(exponentialDelay, options.maxDelayMs);
    // Add jitter
    const jitter = cappedDelay * options.jitterFactor * (Math.random() * 2 - 1);
    return Math.max(0, Math.round(cappedDelay + jitter));
}
/**
 * Sleep for a specified duration
 */
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
/**
 * Default retry predicate - retry on any error
 */
const defaultRetryOn = () => true;
/**
 * Common retry predicates
 */
export const retryPredicates = {
    /** Retry on any error */
    always: () => true,
    /** Never retry */
    never: () => false,
    /** Retry on network errors */
    networkErrors: (error) => {
        if (error instanceof Error) {
            const message = error.message.toLowerCase();
            return (message.includes('network') ||
                message.includes('timeout') ||
                message.includes('econnrefused') ||
                message.includes('econnreset') ||
                message.includes('fetch failed'));
        }
        return false;
    },
    /** Retry on specific HTTP status codes */
    httpStatus: (codes) => (error) => {
        if (error && typeof error === 'object' && 'status' in error) {
            return codes.includes(error.status);
        }
        return false;
    },
    /** Retry on 5xx errors */
    serverErrors: (error) => {
        if (error && typeof error === 'object' && 'status' in error) {
            const status = error.status;
            return status >= 500 && status < 600;
        }
        return false;
    },
    /** Retry on rate limiting (429) */
    rateLimited: (error) => {
        if (error && typeof error === 'object' && 'status' in error) {
            return error.status === 429;
        }
        return false;
    },
};
/**
 * Execute an async function with retry logic
 */
export async function withRetry(fn, options) {
    const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
    const retryOn = opts.retryOn ?? defaultRetryOn;
    let lastError;
    for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
        try {
            const result = await fn();
            return Result.ok(result);
        }
        catch (e) {
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
export function withRetryWrapper(fn, options) {
    return async (...args) => {
        return withRetry(() => fn(...args), options);
    };
}
/**
 * Execute with timeout
 */
export async function withTimeout(fn, timeoutMs) {
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
export async function withRetryAndTimeout(fn, options) {
    const { timeoutMs = 30000, ...retryOptions } = options ?? {};
    return withRetry(() => {
        return new Promise((resolve, reject) => {
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
    }, retryOptions);
}
/**
 * Simple circuit breaker implementation
 */
export function createCircuitBreaker(fn, options) {
    const state = {
        failures: 0,
        lastFailure: null,
        state: 'closed',
    };
    return async () => {
        const now = Date.now();
        // Check if circuit should transition from open to half-open
        if (state.state === 'open' &&
            state.lastFailure &&
            now - state.lastFailure >= options.resetTimeoutMs) {
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
        }
        catch (e) {
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
//# sourceMappingURL=retry.js.map