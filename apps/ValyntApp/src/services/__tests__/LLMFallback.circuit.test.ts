import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    llm: vi.fn(),
    cache: vi.fn(),
  },
}));

vi.mock('../../lib/env', () => ({
  getEnvVar: vi.fn(() => 'test-key'),
}));

vi.mock('../LLMCache', () => ({
  llmCache: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../LLMCostTracker', () => ({
  llmCostTracker: {
    calculateCost: vi.fn(() => 0.01),
    trackUsage: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../CostGovernanceService', () => ({
  costGovernance: {
    estimatePromptTokens: vi.fn(() => 10),
    checkRequest: vi.fn(),
    recordUsage: vi.fn(),
    getSummary: vi.fn(() => ({ ok: true })),
  },
}));

import { LLMFallbackService } from '../LLMFallback';

describe('LLMFallbackService circuit metrics', () => {
  const chatKey = 'external:together_ai:chat';

  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn();
  });

  it('opens and closes together chat circuit and exposes key metrics', async () => {
    const service = new LLMFallbackService();

    (globalThis.fetch as any)
      .mockResolvedValueOnce({ ok: false, status: 500, text: vi.fn().mockResolvedValue('down') })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          choices: [{ message: { content: 'ok' } }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        }),
      });

    await expect(
      service.processRequest({ prompt: 'hi', model: 'm', userId: 'u' })
    ).rejects.toThrow('LLM provider unavailable');

    let stats = service.getStats();
    expect(stats.circuitBreakers[chatKey].state).toBe('open');

    const manager = (service as any).circuitBreaker.manager;
    const state = manager.getState(chatKey);
    if (state) {
      state.opened_at = new Date(Date.now() - (state.timeout_seconds * 1000 + 1)).toISOString();
    }

    await expect(
      service.processRequest({ prompt: 'hi', model: 'm', userId: 'u' })
    ).resolves.toMatchObject({ content: 'ok', provider: 'together_ai' });

    stats = service.getStats();
    expect(stats.circuitBreakers[chatKey].state).toBe('closed');
    expect(stats.circuitBreakers[chatKey].failedRequests).toBe(1);
    expect(stats.circuitBreakers[chatKey].successfulRequests).toBe(1);
  });
});
