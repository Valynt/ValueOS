import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LLMResilienceWrapper,
  classifyLLMError,
  _test_resetResilienceState,
  CircuitOpenError,
  DependencyTimeoutError,
} from '../LLMResilience.js';
import type { LLMResponse } from '../LLMGateway.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeResponse(overrides?: Partial<LLMResponse>): LLMResponse {
  return {
    id: 'resp_1',
    model: 'gpt-4',
    content: 'hello',
    finish_reason: 'stop',
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    ...overrides,
  };
}

class LLMError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'LLMError';
    this.status = status;
  }
}

// ---------------------------------------------------------------------------
// classifyLLMError
// ---------------------------------------------------------------------------

describe('classifyLLMError', () => {
  it('classifies 400 as non-retryable (programmer)', () => {
    expect(classifyLLMError(new LLMError('Bad request', 400))).toBe('programmer');
  });

  it('classifies 401 as non-retryable', () => {
    expect(classifyLLMError(new LLMError('Unauthorized', 401))).toBe('programmer');
  });

  it('classifies 403 as non-retryable', () => {
    expect(classifyLLMError(new LLMError('Forbidden', 403))).toBe('programmer');
  });

  it('classifies 404 as non-retryable', () => {
    expect(classifyLLMError(new LLMError('Not found', 404))).toBe('programmer');
  });

  it('classifies 429 as retryable (operational)', () => {
    expect(classifyLLMError(new LLMError('Rate limited', 429))).toBe('operational');
  });

  it('classifies 500 as retryable', () => {
    expect(classifyLLMError(new LLMError('Internal server error', 500))).toBe('operational');
  });

  it('classifies 503 as retryable', () => {
    expect(classifyLLMError(new LLMError('Service unavailable', 503))).toBe('operational');
  });

  it('classifies network errors as retryable', () => {
    expect(classifyLLMError(new Error('ECONNREFUSED'))).toBe('operational');
    expect(classifyLLMError(new Error('ECONNRESET'))).toBe('operational');
    expect(classifyLLMError(new Error('fetch failed'))).toBe('operational');
  });

  it('classifies timeout errors as retryable', () => {
    expect(classifyLLMError(new Error('Request timeout'))).toBe('operational');
  });

  it('classifies status codes from error message', () => {
    expect(classifyLLMError(new Error('Request failed with status 429'))).toBe('operational');
    expect(classifyLLMError(new Error('HTTP 401 Unauthorized'))).toBe('programmer');
  });
});

// ---------------------------------------------------------------------------
// LLMResilienceWrapper — Circuit Breaker
// ---------------------------------------------------------------------------

describe('LLMResilienceWrapper — circuit breaker', () => {
  beforeEach(() => {
    _test_resetResilienceState();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('opens after N failures and rejects subsequent calls', async () => {
    const wrapper = new LLMResilienceWrapper({
      providerKey: 'llm:test-cb-open',
      timeoutMs: 5_000,
      circuitBreaker: { failureThreshold: 3, cooldownMs: 10_000, halfOpenSuccesses: 1 },
      retry: { attempts: 1, baseDelayMs: 10, multiplier: 2, maxDelayMs: 100, jitterRatio: 0 },
    });

    const fail = () => Promise.reject(new LLMError('Server error', 500));

    // 3 failures to trip the breaker
    for (let i = 0; i < 3; i++) {
      await expect(wrapper.execute(fail)).rejects.toThrow();
    }

    // Next call should be rejected by the circuit breaker
    await expect(wrapper.execute(fail)).rejects.toThrow(CircuitOpenError);
  });

  it('transitions to half-open after cooldown and closes after successes', async () => {
    const wrapper = new LLMResilienceWrapper({
      providerKey: 'llm:test-cb-halfopen',
      timeoutMs: 5_000,
      circuitBreaker: { failureThreshold: 2, cooldownMs: 5_000, halfOpenSuccesses: 2 },
      retry: { attempts: 1, baseDelayMs: 10, multiplier: 2, maxDelayMs: 100, jitterRatio: 0 },
    });

    const fail = () => Promise.reject(new LLMError('Server error', 500));
    const succeed = () => Promise.resolve(makeResponse());

    // Trip the breaker
    await expect(wrapper.execute(fail)).rejects.toThrow();
    await expect(wrapper.execute(fail)).rejects.toThrow();

    // Should be open
    await expect(wrapper.execute(succeed)).rejects.toThrow(CircuitOpenError);

    // Advance past cooldown
    vi.advanceTimersByTime(6_000);

    // Half-open: first success
    await expect(wrapper.execute(succeed)).resolves.toBeDefined();
    // Half-open: second success closes the circuit
    await expect(wrapper.execute(succeed)).resolves.toBeDefined();

    // Circuit is now closed — should work normally
    await expect(wrapper.execute(succeed)).resolves.toBeDefined();
  });

  it('re-opens if a call fails during half-open', async () => {
    const wrapper = new LLMResilienceWrapper({
      providerKey: 'llm:test-cb-reopen',
      timeoutMs: 5_000,
      circuitBreaker: { failureThreshold: 2, cooldownMs: 5_000, halfOpenSuccesses: 2 },
      retry: { attempts: 1, baseDelayMs: 10, multiplier: 2, maxDelayMs: 100, jitterRatio: 0 },
    });

    const fail = () => Promise.reject(new LLMError('Server error', 500));
    const succeed = () => Promise.resolve(makeResponse());

    // Trip the breaker
    await expect(wrapper.execute(fail)).rejects.toThrow();
    await expect(wrapper.execute(fail)).rejects.toThrow();

    // Advance past cooldown
    vi.advanceTimersByTime(6_000);

    // Half-open: failure re-opens
    await expect(wrapper.execute(fail)).rejects.toThrow();

    // Should be open again
    await expect(wrapper.execute(succeed)).rejects.toThrow(CircuitOpenError);
  });
});

// ---------------------------------------------------------------------------
// LLMResilienceWrapper — Retry with exponential backoff
// ---------------------------------------------------------------------------

describe('LLMResilienceWrapper — retry', () => {
  beforeEach(() => {
    _test_resetResilienceState();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('retries transient failures and succeeds', async () => {
    const wrapper = new LLMResilienceWrapper({
      providerKey: 'llm:test-retry-succeed',
      timeoutMs: 5_000,
      circuitBreaker: { failureThreshold: 10, cooldownMs: 60_000, halfOpenSuccesses: 1 },
      retry: { attempts: 3, baseDelayMs: 100, multiplier: 2, maxDelayMs: 5_000, jitterRatio: 0 },
    });

    let callCount = 0;
    const operation = async () => {
      callCount++;
      if (callCount < 3) {
        throw new LLMError('Server error', 500);
      }
      return makeResponse();
    };

    const promise = wrapper.execute(operation);
    // Advance timers to allow retries (attempt 1 delay ~100ms, attempt 2 delay ~200ms)
    await vi.advanceTimersByTimeAsync(500);

    const result = await promise;
    expect(result.content).toBe('hello');
    expect(callCount).toBe(3);
  });

  it('does not retry non-retryable errors (400)', async () => {
    const wrapper = new LLMResilienceWrapper({
      providerKey: 'llm:test-no-retry-400',
      timeoutMs: 5_000,
      circuitBreaker: { failureThreshold: 10, cooldownMs: 60_000, halfOpenSuccesses: 1 },
      retry: { attempts: 3, baseDelayMs: 100, multiplier: 2, maxDelayMs: 5_000, jitterRatio: 0 },
    });

    let callCount = 0;
    const operation = async () => {
      callCount++;
      throw new LLMError('Bad request', 400);
    };

    await expect(wrapper.execute(operation)).rejects.toThrow();
    // Non-retryable: should only be called once
    expect(callCount).toBe(1);
  });

  it('does not retry 401 errors', async () => {
    const wrapper = new LLMResilienceWrapper({
      providerKey: 'llm:test-no-retry-401',
      timeoutMs: 5_000,
      circuitBreaker: { failureThreshold: 10, cooldownMs: 60_000, halfOpenSuccesses: 1 },
      retry: { attempts: 3, baseDelayMs: 100, multiplier: 2, maxDelayMs: 5_000, jitterRatio: 0 },
    });

    let callCount = 0;
    const operation = async () => {
      callCount++;
      throw new LLMError('Unauthorized', 401);
    };

    await expect(wrapper.execute(operation)).rejects.toThrow();
    expect(callCount).toBe(1);
  });

  it('respects max delay cap', async () => {
    const wrapper = new LLMResilienceWrapper({
      providerKey: 'llm:test-max-delay',
      timeoutMs: 60_000,
      circuitBreaker: { failureThreshold: 20, cooldownMs: 60_000, halfOpenSuccesses: 1 },
      retry: { attempts: 5, baseDelayMs: 1_000, multiplier: 2, maxDelayMs: 3_000, jitterRatio: 0 },
    });

    let callCount = 0;
    const operation = async () => {
      callCount++;
      if (callCount < 5) {
        throw new LLMError('Server error', 500);
      }
      return makeResponse();
    };

    const promise = wrapper.execute(operation);
    // Delays: 1000, 2000, 3000 (capped), 3000 (capped) = 9000ms total
    await vi.advanceTimersByTimeAsync(15_000);

    const result = await promise;
    expect(result.content).toBe('hello');
    expect(callCount).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// LLMResilienceWrapper — Timeout
// ---------------------------------------------------------------------------

describe('LLMResilienceWrapper — timeout', () => {
  beforeEach(() => {
    _test_resetResilienceState();
  });

  it('rejects when operation exceeds timeout', async () => {
    const wrapper = new LLMResilienceWrapper({
      providerKey: 'llm:test-timeout',
      // Use a very short timeout so the test runs quickly with real timers
      timeoutMs: 50,
      circuitBreaker: { failureThreshold: 10, cooldownMs: 60_000, halfOpenSuccesses: 1 },
      retry: { attempts: 1, baseDelayMs: 10, multiplier: 2, maxDelayMs: 100, jitterRatio: 0 },
    });

    const slowOperation = () =>
      new Promise<LLMResponse>((resolve) => {
        // Resolves after 200ms — well past the 50ms timeout
        setTimeout(() => resolve(makeResponse()), 200);
      });

    await expect(wrapper.execute(slowOperation)).rejects.toThrow(DependencyTimeoutError);
  });
});
