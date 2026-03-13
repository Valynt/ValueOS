import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LLMGateway, type LLMRequest } from '../LLMGateway.js';
import { _test_resetResilienceState } from '../LLMResilience.js';

vi.mock('../../../services/post-v1/CostAwareRouter.js', () => ({
  CostAwareRouter: class {
    async routeRequest() {
      return { fallbackToBasic: false };
    }
  },
}));

// Helper: gateway that records calls
class RecordingTogetherGateway extends LLMGateway {
  public callCount = 0;
  public lastModelSeen?: string;

  protected override async executeCompletion(request: LLMRequest, _startTime: number) {
    this.callCount++;
    this.lastModelSeen = request.model as string;

    return {
      id: `llm_ok_${this.callCount}`,
      model: request.model || (this as any).config.model,
      content: `ok-${this.callCount}`,
      finish_reason: 'stop',
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    } as any;
  }
}

class FailPrimaryThenSecondaryGateway extends LLMGateway {
  public callCount = 0;

  protected override async executeCompletion(request: LLMRequest, _startTime: number) {
    this.callCount++;
    const primary = process.env.TOGETHER_PRIMARY_MODEL_NAME;
    const secondary = process.env.TOGETHER_SECONDARY_MODEL_NAME;

    if (request.model === primary) {
      const err = new Error('timeout');
      // simulate transient error
      throw err;
    }

    return {
      id: `llm_ok_${this.callCount}`,
      model: request.model || (this as any).config.model,
      content: `ok-secondary`,
      finish_reason: 'stop',
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      metadata: {},
    } as any;
  }
}

describe('LLMGateway (Together) — primary/secondary behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _test_resetResilienceState();
  });

  it('defaults to TOGETHER_PRIMARY_MODEL_NAME when caller omits model', async () => {
    vi.stubEnv('TOGETHER_PRIMARY_MODEL_NAME', 'moonshotai/Kimi-K2-Thinking');

    const gateway = new RecordingTogetherGateway(
      { provider: 'together', model: 'fallback-model' } as any,
      undefined as any,
      { retry: { attempts: 1 } } as any
    );

    const resp = await gateway.complete({
      messages: [{ role: 'user', content: 'hello' }],
      metadata: { tenantId: 'tenant-tt' },
    });

    expect((gateway as any).lastModelSeen).toBe('moonshotai/Kimi-K2-Thinking');
    expect(resp.model).toBe('moonshotai/Kimi-K2-Thinking');
    expect(resp.metadata?.retry_attempts).toBeDefined();
    expect(resp.metadata?.fallback_triggered).not.toBe(true);
  });

  it('retries primary then falls back to SECONDARY on transient primary failure', async () => {
    vi.stubEnv('TOGETHER_PRIMARY_MODEL_NAME', 'primary-model');
    vi.stubEnv('TOGETHER_SECONDARY_MODEL_NAME', 'secondary-model');
    vi.stubEnv('LLM_FALLBACK_MAX_ATTEMPTS', '1');
    vi.stubEnv('LLM_RETRY_BACKOFF_MS', '1');

    const gateway = new FailPrimaryThenSecondaryGateway(
      { provider: 'together', model: 'fallback-model' } as any,
      undefined as any,
      { retry: { attempts: 1 } } as any
    );

    const resp = await gateway.complete({
      messages: [{ role: 'user', content: 'hello' }],
      metadata: { tenantId: 'tenant-tt' },
    });

    // primary should have been attempted then secondary used
    expect(gateway.callCount).toBeGreaterThanOrEqual(2);
    expect(resp.model).toBe('secondary-model');
    expect(resp.metadata?.fallback_triggered).toBe(true);
    expect(resp.metadata?.model_used || resp.model).toBe('secondary-model');
  });
});
