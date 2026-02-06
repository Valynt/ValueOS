import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LLMGateway, type LLMRequest, type LLMResponse } from '../LLMGateway.js';

describe('LLMGateway usage tracking', () => {
  const trackUsage = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    trackUsage.mockReset();
  });

  it('tracks successful complete() with tenant context', async () => {
    const gateway = new LLMGateway(
      { provider: 'openai', model: 'gpt-4o-mini' },
      { trackUsage } as any
    );

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
    class FailingGateway extends LLMGateway {
      protected async executeCompletion(
        _request: LLMRequest,
        _startTime: number
      ): Promise<LLMResponse> {
        throw new Error('boom');
      }
    }

    const gateway = new FailingGateway(
      { provider: 'openai', model: 'gpt-4o-mini' },
      { trackUsage } as any
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
    ).rejects.toThrow('boom');

    expect(trackUsage).toHaveBeenCalledTimes(1);
    expect(trackUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-2',
        tenantId: 'tenant-2',
        sessionId: 'session-2',
        provider: 'openai',
        model: 'gpt-4o-mini',
        success: false,
        errorMessage: 'boom',
      })
    );
  });

  it('tracks complete() with organization_id metadata', async () => {
    const gateway = new LLMGateway(
      { provider: 'openai', model: 'gpt-4o-mini' },
      { trackUsage } as any
    );

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
});
