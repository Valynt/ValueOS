/**
 * LLM Resilience Module
 *
 * Wraps LLMGateway with circuit breaker, retry with exponential backoff,
 * and per-request timeout. Uses the patterns from lib/resilience.ts.
 */

import {
  getCircuitBreakerState as _getCircuitBreakerState,
  _test_resetResilienceState,
  CircuitOpenError,
  DependencyTimeoutError,
  DependencyUnavailableError,
  executeWithResilience,
} from '../resilience.js';
import type { LLMResponse } from './LLMGateway.js';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface LLMCircuitBreakerConfig {
  /** Number of failures before the circuit opens. Default: 5 */
  failureThreshold: number;
  /** Cooldown period in ms before transitioning to half-open. Default: 60_000 */
  cooldownMs: number;
  /** Successes required in half-open state to close. Default: 2 */
  halfOpenSuccesses: number;
}

export interface LLMRetryConfig {
  /** Total attempts (including the first). Default: 3 */
  attempts: number;
  /** Base delay in ms for exponential backoff. Default: 1_000 */
  baseDelayMs: number;
  /** Backoff multiplier. Default: 2 */
  multiplier: number;
  /** Maximum delay cap in ms. Default: 30_000 */
  maxDelayMs: number;
  /** Jitter ratio (0–1). Default: 0.2 */
  jitterRatio: number;
}

export interface LLMResilienceConfig {
  /** Provider key used to scope the circuit breaker (e.g. "llm:openai"). */
  providerKey: string;
  /** Per-request timeout in ms. Default: 30_000 */
  timeoutMs: number;
  circuitBreaker: LLMCircuitBreakerConfig;
  retry: LLMRetryConfig;
}

export const DEFAULT_LLM_RESILIENCE_CONFIG: Omit<LLMResilienceConfig, 'providerKey'> = {
  timeoutMs: 30_000,
  circuitBreaker: {
    failureThreshold: 5,
    cooldownMs: 60_000,
    halfOpenSuccesses: 2,
  },
  retry: {
    attempts: 3,
    baseDelayMs: 1_000,
    multiplier: 2,
    maxDelayMs: 30_000,
    jitterRatio: 0.2,
  },
};

// ---------------------------------------------------------------------------
// Error classification
// ---------------------------------------------------------------------------

/** HTTP status codes that should NOT be retried. */
const NON_RETRYABLE_STATUSES = new Set([400, 401, 403, 404]);

/**
 * Determine whether an LLM error is transient (retryable).
 * Returns 'operational' for retryable, 'programmer' for non-retryable.
 */
export function classifyLLMError(error: unknown): 'operational' | 'programmer' {
  if (error instanceof Error) {
    // Check for HTTP status in the error
    const statusCode = extractStatusCode(error);
    if (statusCode !== undefined) {
      if (NON_RETRYABLE_STATUSES.has(statusCode)) {
        return 'programmer'; // non-retryable
      }
      // 429, 500-503 are retryable
      return 'operational';
    }

    // Network errors are retryable
    const msg = error.message.toLowerCase();
    if (
      msg.includes('timeout') ||
      msg.includes('econnrefused') ||
      msg.includes('econnreset') ||
      msg.includes('fetch') ||
      msg.includes('network') ||
      msg.includes('socket') ||
      error.name === 'AbortError'
    ) {
      return 'operational';
    }
  }

  // Default: treat as retryable (operational) so the circuit breaker can track it
  return 'operational';
}

/**
 * Extract an HTTP status code from an error, if present.
 */
function extractStatusCode(error: Error): number | undefined {
  // Many LLM SDK errors attach a `status` or `statusCode` property
  const anyErr = error as Record<string, unknown>;
  if (typeof anyErr.status === 'number') return anyErr.status;
  if (typeof anyErr.statusCode === 'number') return anyErr.statusCode;

  // Check message for common patterns like "429" or "status 500"
  const match = error.message.match(/\b(4\d{2}|5\d{2})\b/);
  if (match) return parseInt(match[1], 10);

  return undefined;
}

// ---------------------------------------------------------------------------
// Circuit breaker state (observable)
// ---------------------------------------------------------------------------

export type CircuitState = 'closed' | 'open' | 'half_open';

export interface CircuitBreakerStateInfo {
  state: CircuitState;
  providerKey: string;
}

// ---------------------------------------------------------------------------
// LLMResilienceWrapper
// ---------------------------------------------------------------------------

/**
 * Wraps an async LLM completion function with circuit breaker + retry + timeout.
 *
 * Usage:
 *   const wrapper = new LLMResilienceWrapper({ providerKey: 'llm:openai', ... });
 *   const response = await wrapper.execute(() => gateway.executeCompletion(req, startTime));
 */
export class LLMResilienceWrapper {
  private config: LLMResilienceConfig;

  constructor(config: Partial<LLMResilienceConfig> & { providerKey: string }) {
    this.config = {
      ...DEFAULT_LLM_RESILIENCE_CONFIG,
      ...config,
      circuitBreaker: {
        ...DEFAULT_LLM_RESILIENCE_CONFIG.circuitBreaker,
        ...config.circuitBreaker,
      },
      retry: {
        ...DEFAULT_LLM_RESILIENCE_CONFIG.retry,
        ...config.retry,
      },
    };
  }

  /**
   * Execute an LLM operation with full resilience (circuit breaker + retry + timeout).
   */
  async execute(operation: () => Promise<LLMResponse>): Promise<LLMResponse> {
    return executeWithResilience<LLMResponse>(operation, {
      dependencyName: this.config.providerKey,
      timeoutMs: this.config.timeoutMs,
      idempotent: true, // LLM completions are safe to retry
      circuitBreaker: {
        failureThreshold: this.config.circuitBreaker.failureThreshold,
        cooldownMs: this.config.circuitBreaker.cooldownMs,
        halfOpenSuccesses: this.config.circuitBreaker.halfOpenSuccesses,
      },
      retry: {
        attempts: this.config.retry.attempts,
        baseDelayMs: this.config.retry.baseDelayMs,
        maxDelayMs: this.config.retry.maxDelayMs,
        jitterRatio: this.config.retry.jitterRatio,
      },
      classifyError: classifyLLMError,
    });
  }

  /**
   * Get the provider key this wrapper is scoped to.
   */
  getProviderKey(): string {
    return this.config.providerKey;
  }

  /**
   * Query the current circuit breaker state for this provider.
   */
  getCircuitBreakerState(): CircuitBreakerStateInfo {
    const state = _getCircuitBreakerState(this.config.providerKey);
    return {
      state: state ?? 'closed',
      providerKey: this.config.providerKey,
    };
  }
}

// Re-export for convenience
export { CircuitOpenError, DependencyTimeoutError, DependencyUnavailableError, _test_resetResilienceState };
