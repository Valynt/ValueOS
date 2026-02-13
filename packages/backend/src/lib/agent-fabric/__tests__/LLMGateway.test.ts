import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LLMGateway, type LLMRequest, type LLMResponse } from '../LLMGateway.js';
import { _test_resetResilienceState, CircuitOpenError } from '../LLMResilience.js';

// Mock CostAwareRouter to avoid hitting real costTracker methods
vi.mock('../../../services/CostAwareRouter.js', () => ({
  CostAwareRouter: class {
    async routeRequest() {
      return { fallbackToBasic: false };
    }
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGateway(
  trackUsage = vi.fn(),
  resilienceOverrides?: Record<string, unknown>
) {
  return new LLMGateway(
    { provider: 'openai', model: 'gpt-4o-mini' },
    { trackUsage } as any,
    resilienceOverrides as any
  );
}

class FailingGateway extends LLMGateway {
  private _failCount: number;
  private _callCount = 0;

  constructor(
    failCount: number,
    trackUsage: ReturnType<typeof vi.fn>,
    resilienceOverrides?: Record<string, unknown>
  ) {
    super(
      { provider: 'openai', model: 'gpt-4o-mini' },
      { trackUsage } as any,
      resilienceOverrides as any
    );
    this._failCount = failCount;
  }

  protected override async executeCompletion(
    _request: LLMRequest,
    _startTime: number
  ): Promise<LLMResponse> {
    this._callCount++;
    if (this._callCount <= this._failCount) {
      const err = new Error('boom') as Error & { status: number };
      err.status = 500; // transient
      throw err;
    }
    return {
      id: `llm_ok`,
      model: 'gpt-4o-mini',
      content: 'ok',
      finish_reason: 'stop',
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    };
  }

  get callCount() {
    return this._callCount;
  }
}

class AlwaysFailingGateway extends LLMGateway {
  protected override async executeCompletion(
    _request: LLMRequest,
    _startTime: number
  ): Promise<LLMResponse> {
    const err = new Error('boom') as Error & { status: number };
    err.status = 500;
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Usage tracking (existing tests, fixed mocks)
// ---------------------------------------------------------------------------

describe('LLMGateway usage tracking', () => {
  const trackUsage = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    trackUsage.mockReset();
    _test_resetResilienceState();
  });

  it('tracks successful complete() with tenant context', async () => {
    const gateway = makeGateway(trackUsage);

    await gateway.complete({
      messages: [{ role: 'user', content: 'hello' }],
      metadata: {
        userId: 'user-1',
        tenantId: 'tenant-1',
        sessionId: 'session-1',
      },
    });

    expect(trackUsage).toHaveBeenCalledTimes(1);
    expect(trackUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        tenantId: 'tenant-1',
        sessionId: 'session-1',
        provider: 'openai',
        model: 'gpt-4o-mini',
        success: true,
        promptTokens: 100,
        completionTokens: 50,
      })
    );
  });

  it('tracks failed complete() with tenant context', async () => {
    // Use retry.attempts=1 so the error propagates immediately
    const gateway = new AlwaysFailingGateway(
      { provider: 'openai', model: 'gpt-4o-mini' },
      { trackUsage } as any,
      { retry: { attempts: 1 } } as any
    );

    await expect(
      gateway.complete({
        messages: [{ role: 'user', content: 'hello' }],
        metadata: {
          userId: 'user-2',
          tenantId: 'tenant-2',
          sessionId: 'session-2',
        },
      })
    ).rejects.toThrow();

    expect(trackUsage).toHaveBeenCalledTimes(1);
    expect(trackUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-2',
        tenantId: 'tenant-2',
        sessionId: 'session-2',
        provider: 'openai',
        model: 'gpt-4o-mini',
        success: false,
      })
    );
  });

  it('tracks complete() with organization_id metadata', async () => {
    const gateway = makeGateway(trackUsage);

    await gateway.complete({
      messages: [{ role: 'user', content: 'hello' }],
      metadata: {
        userId: 'user-3',
        organization_id: 'org-3',
      },
    });

    expect(trackUsage).toHaveBeenCalledTimes(1);
    expect(trackUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-3',
        tenantId: 'org-3',
        provider: 'openai',
        model: 'gpt-4o-mini',
        success: true,
      })
    );
  });

  it('throws when tenant metadata is missing', async () => {
    const gateway = makeGateway(trackUsage);

    await expect(
      gateway.complete({
        messages: [{ role: 'user', content: 'hello' }],
        metadata: {
          userId: 'user-4',
          tenantId: '',
        },
      })
    ).rejects.toThrow('LLMGateway.complete requires tenant metadata');

    expect(trackUsage).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Resilience integration
// ---------------------------------------------------------------------------

describe('LLMGateway resilience integration', () => {
  beforeEach(() => {
    _test_resetResilienceState();
  });

  it('complete() retries on transient failure and succeeds', async () => {
    const trackUsage = vi.fn();
    // Fails twice, succeeds on 3rd attempt
    const gateway = new FailingGateway(2, trackUsage, {
      retry: { attempts: 3, baseDelayMs: 1, multiplier: 1, maxDelayMs: 5, jitterRatio: 0 },
      circuitBreaker: { failureThreshold: 10, cooldownMs: 60_000, halfOpenSuccesses: 1 },
      timeoutMs: 5_000,
    });

    const result = await gateway.complete({
      messages: [{ role: 'user', content: 'hello' }],
      metadata: { tenantId: 'tenant-retry' },
    });

    expect(result.content).toBe('ok');
    expect(gateway.callCount).toBe(3);
    // trackUsage called once for the successful outcome
    expect(trackUsage).toHaveBeenCalledWith(
      expect.objectContaining({ success: true })
    );
  });

  it('complete() opens circuit breaker after repeated failures', async () => {
    const trackUsage = vi.fn();

    // CB opens after 3 failures
    const gateway = new AlwaysFailingGateway(
      { provider: 'openai', model: 'gpt-4o-mini' },
      { trackUsage } as any,
      {
        retry: { attempts: 1, baseDelayMs: 1, multiplier: 1, maxDelayMs: 5, jitterRatio: 0 },
        circuitBreaker: { failureThreshold: 3, cooldownMs: 60_000, halfOpenSuccesses: 1 },
        timeoutMs: 5_000,
      } as any
    );

    const req: LLMRequest = {
      messages: [{ role: 'user', content: 'hello' }],
      metadata: { tenantId: 'tenant-cb' },
    };

    // Trip the breaker with 3 failures
    for (let i = 0; i < 3; i++) {
      await expect(gateway.complete(req)).rejects.toThrow();
    }

    // Next call should be rejected by circuit breaker
    await expect(gateway.complete(req)).rejects.toThrow(CircuitOpenError);

    // State should be open
    const state = gateway.getCircuitBreakerState();
    expect(state.state).toBe('open');
    expect(state.providerKey).toBe('llm:openai');
  });

  it('completeRaw() bypasses resilience', async () => {
    const gateway = makeGateway();

    const result = await gateway.completeRaw({
      messages: [{ role: 'user', content: 'hello' }],
      metadata: { tenantId: 'tenant-raw' },
    });

    // Should get the placeholder response directly
    expect(result.content).toBe('LLM Gateway placeholder response');
    expect(result.finish_reason).toBe('stop');
  });

  it('getCircuitBreakerState() returns correct state', async () => {
    const gateway = makeGateway();
    const state = gateway.getCircuitBreakerState();

    expect(state.providerKey).toBe('llm:openai');
    // Before any calls, state defaults to closed
    expect(state.state).toBe('closed');
  });
});
