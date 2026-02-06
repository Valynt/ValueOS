import { describe, expect, it, vi, beforeEach } from 'vitest';
import { LLMService } from '../llm';

class BreakerOpenStub {
  async execute<T>(): Promise<T> {
    throw new Error('Circuit breaker open');
  }
}

class PassThroughBreakerStub {
  async execute<T>(_key: string, task: () => Promise<T>): Promise<T> {
    return task();
  }
}

describe('LLMService Together.ai resilience', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('short-circuits when the breaker is open', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy as typeof fetch);

    const service = new LLMService('/api', 'test-key', {
      togetherCircuitBreaker: new BreakerOpenStub() as any,
    });

    await expect(
      service.chatDirect({ prompt: 'hello' })
    ).rejects.toThrow('Circuit breaker open');

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('retries transient Together.ai errors with exponential backoff', async () => {
    const sleepSpy = vi.fn().mockResolvedValue(undefined);

    const error429Response = {
      ok: false,
      status: 429,
      text: vi.fn().mockResolvedValue('rate limited'),
    };

    const error500Response = {
      ok: false,
      status: 500,
      text: vi.fn().mockResolvedValue('server error'),
    };

    const successResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        choices: [{ message: { content: 'ok' } }],
        usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
      }),
    };

    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(error429Response)
      .mockResolvedValueOnce(error500Response)
      .mockResolvedValueOnce(successResponse);

    vi.stubGlobal('fetch', fetchSpy as typeof fetch);

    const service = new LLMService('/api', 'test-key', {
      togetherCircuitBreaker: new PassThroughBreakerStub() as any,
      retryPolicy: {
        maxRetries: 3,
        baseDelay: 100,
        maxDelay: 1000,
        backoffMultiplier: 2,
        jitterFactor: 0,
      },
      sleep: sleepSpy,
    });

    const result = await service.chatDirect({ prompt: 'retry me' });

    expect(result.content).toBe('ok');
    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(sleepSpy).toHaveBeenNthCalledWith(1, 100);
    expect(sleepSpy).toHaveBeenNthCalledWith(2, 200);
  });

  it('fast-fails non-retryable auth errors', async () => {
    const sleepSpy = vi.fn().mockResolvedValue(undefined);
    const authErrorResponse = {
      ok: false,
      status: 401,
      text: vi.fn().mockResolvedValue('unauthorized'),
    };

    const fetchSpy = vi.fn().mockResolvedValue(authErrorResponse);
    vi.stubGlobal('fetch', fetchSpy as typeof fetch);

    const service = new LLMService('/api', 'test-key', {
      togetherCircuitBreaker: new PassThroughBreakerStub() as any,
      sleep: sleepSpy,
      retryPolicy: {
        maxRetries: 3,
        baseDelay: 100,
        jitterFactor: 0,
      },
    });

    await expect(service.chatDirect({ prompt: 'auth fail' })).rejects.toThrow(
      'Together.ai API error: 401 - unauthorized'
    );

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(sleepSpy).not.toHaveBeenCalled();
  });
});
