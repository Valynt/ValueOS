import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LLMGateway } from './LLMGateway';
import { llmProxyClient } from '../../services/LlmProxyClient';
import { trackUsage } from '../../services/UsageTrackingService';

vi.mock('../../services/LlmProxyClient', async () => ({
  llmProxyClient: {
    complete: vi.fn(async () => ({
      content: 'Hello',
      tokens_used: 10,
      latency_ms: 123,
      model: 'gpt-4'
    }))
  }
}));

vi.mock('../../services/UsageTrackingService', async () => ({
  trackUsage: vi.fn(async () => {})
}));

describe('LLMGateway', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('emits metrics and tracks usage on complete()', async () => {
    const gateway = new LLMGateway('together', true);
    const response = await gateway.complete([
      { role: 'user', content: 'Test' }
    ], {}, { userId: 'u-1', organizationId: 'org-1', sessionId: 's-1' });

    expect(response.content).toBe('Hello');
    // Ensure the proxy was called
    expect((llmProxyClient as any).complete).toHaveBeenCalled();
    // Ensure trackUsage was called for the organization
    expect((trackUsage as any)).toHaveBeenCalledWith(expect.objectContaining({ organizationId: 'org-1' }));
  });
});
