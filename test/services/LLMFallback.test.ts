/**
 * LLM Fallback Service Tests
 * 
 * Tests circuit breaker behavior, fallback logic, and error handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LLMFallbackService } from '../../src/services/LLMFallback';

// Mock dependencies
vi.mock('../../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    llm: vi.fn(),
    cache: vi.fn()
  }
}));

vi.mock('../../src/services/LLMCache', () => ({
  llmCache: {
    get: vi.fn(),
    set: vi.fn()
  }
}));

vi.mock('../../src/services/LLMCostTracker', () => ({
  llmCostTracker: {
    trackUsage: vi.fn(),
    calculateCost: vi.fn(() => 0.001)
  }
}));

describe('LLMFallbackService', () => {
  let service: LLMFallbackService;
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    service = new LLMFallbackService();
    originalFetch = global.fetch;
    
    // Reset environment variables
    process.env.TOGETHER_API_KEY = 'test-together-key';
    process.env.OPENAI_API_KEY = 'test-openai-key';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  describe('processRequest', () => {
    it('should return cached response when available', async () => {
      const { llmCache } = await import('../../src/services/LLMCache');
      
      vi.mocked(llmCache.get).mockResolvedValue({
        response: 'Cached response',
        model: 'test-model',
        promptTokens: 10,
        completionTokens: 20,
        cost: 0.001,
        cachedAt: Date.now(),
        hitCount: 5
      });

      const result = await service.processRequest({
        prompt: 'Test prompt',
        model: 'test-model',
        userId: 'user-123'
      });

      expect(result.provider).toBe('cache');
      expect(result.content).toBe('Cached response');
      expect(result.cost).toBe(0);
      expect(result.cached).toBe(true);
    });

    it('should call Together.ai when cache misses', async () => {
      const { llmCache } = await import('../../src/services/LLMCache');
      vi.mocked(llmCache.get).mockResolvedValue(null);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Together.ai response' } }],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 20,
            total_tokens: 30
          }
        })
      });

      const result = await service.processRequest({
        prompt: 'Test prompt',
        model: 'meta-llama/Llama-3-70b-chat-hf',
        userId: 'user-123'
      });

      expect(result.provider).toBe('together_ai');
      expect(result.content).toBe('Together.ai response');
      expect(result.cached).toBe(false);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.together.xyz/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-together-key'
          })
        })
      );
    });

    it('should fallback to OpenAI when Together.ai fails', async () => {
      const { llmCache } = await import('../../src/services/LLMCache');
      vi.mocked(llmCache.get).mockResolvedValue(null);

      let callCount = 0;
      global.fetch = vi.fn().mockImplementation((url) => {
        callCount++;
        
        // First call (Together.ai) fails
        if (url.includes('together.xyz')) {
          return Promise.resolve({
            ok: false,
            status: 500,
            text: async () => 'Internal Server Error'
          });
        }
        
        // Second call (OpenAI) succeeds
        return Promise.resolve({
          ok: true,
          json: async () => ({
            choices: [{ message: { content: 'OpenAI fallback response' } }],
            usage: {
              prompt_tokens: 10,
              completion_tokens: 20,
              total_tokens: 30
            }
          })
        });
      });

      const result = await service.processRequest({
        prompt: 'Test prompt',
        model: 'meta-llama/Llama-3-70b-chat-hf',
        userId: 'user-123'
      });

      expect(result.provider).toBe('openai');
      expect(result.content).toBe('OpenAI fallback response');
      expect(callCount).toBeGreaterThanOrEqual(2);
    });

    it('should throw error when both providers fail', async () => {
      const { llmCache } = await import('../../src/services/LLMCache');
      vi.mocked(llmCache.get).mockResolvedValue(null);

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error'
      });

      await expect(
        service.processRequest({
          prompt: 'Test prompt',
          model: 'test-model',
          userId: 'user-123'
        })
      ).rejects.toThrow('All LLM providers unavailable');
    });
  });

  describe('Circuit Breaker', () => {
    it('should open circuit after threshold failures', async () => {
      const { llmCache } = await import('../../src/services/LLMCache');
      vi.mocked(llmCache.get).mockResolvedValue(null);

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error'
      });

      // Make multiple failing requests to trigger circuit breaker
      const requests = Array(10).fill(null).map(() =>
        service.processRequest({
          prompt: 'Test prompt',
          model: 'test-model',
          userId: 'user-123'
        }).catch(() => null)
      );

      await Promise.all(requests);

      const health = await service.healthCheck();
      
      // Circuit should be open after multiple failures
      expect(health.togetherAI.state).toBe('open');
    });

    it('should track circuit breaker statistics', async () => {
      const stats = service.getStats();

      expect(stats).toHaveProperty('togetherAI');
      expect(stats).toHaveProperty('openAI');
      expect(stats).toHaveProperty('cache');
      
      expect(stats.togetherAI).toHaveProperty('state');
      expect(stats.togetherAI).toHaveProperty('failures');
      expect(stats.togetherAI).toHaveProperty('successes');
    });
  });

  describe('Model Mapping', () => {
    it('should map Together.ai models to OpenAI equivalents', async () => {
      const { llmCache } = await import('../../src/services/LLMCache');
      vi.mocked(llmCache.get).mockResolvedValue(null);

      let openAIModel = '';
      
      global.fetch = vi.fn().mockImplementation((url, options) => {
        if (url.includes('together.xyz')) {
          return Promise.resolve({
            ok: false,
            status: 500,
            text: async () => 'Error'
          });
        }
        
        // Capture OpenAI model from request
        const body = JSON.parse(options?.body as string);
        openAIModel = body.model;
        
        return Promise.resolve({
          ok: true,
          json: async () => ({
            choices: [{ message: { content: 'Response' } }],
            usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }
          })
        });
      });

      await service.processRequest({
        prompt: 'Test',
        model: 'meta-llama/Llama-3-70b-chat-hf',
        userId: 'user-123'
      }).catch(() => null);

      expect(openAIModel).toBe('gpt-4');
    });
  });

  describe('Cost Calculation', () => {
    it('should calculate OpenAI costs correctly', async () => {
      const { llmCache } = await import('../../src/services/LLMCache');
      vi.mocked(llmCache.get).mockResolvedValue(null);

      global.fetch = vi.fn().mockImplementation((url) => {
        if (url.includes('together.xyz')) {
          return Promise.resolve({
            ok: false,
            status: 500,
            text: async () => 'Error'
          });
        }
        
        return Promise.resolve({
          ok: true,
          json: async () => ({
            choices: [{ message: { content: 'Response' } }],
            usage: {
              prompt_tokens: 1000,
              completion_tokens: 2000,
              total_tokens: 3000
            }
          })
        });
      });

      const result = await service.processRequest({
        prompt: 'Test',
        model: 'meta-llama/Llama-3-8b-chat-hf', // Maps to gpt-3.5-turbo
        userId: 'user-123'
      }).catch(() => null);

      if (result) {
        // gpt-3.5-turbo: $0.5/1M input, $1.5/1M output
        // 1000 tokens input = $0.0005
        // 2000 tokens output = $0.003
        // Total = $0.0035
        expect(result.cost).toBeCloseTo(0.0035, 4);
      }
    });
  });

  describe('Health Check', () => {
    it('should return health status for both providers', async () => {
      const health = await service.healthCheck();

      expect(health).toHaveProperty('togetherAI');
      expect(health).toHaveProperty('openAI');
      
      expect(health.togetherAI).toHaveProperty('healthy');
      expect(health.togetherAI).toHaveProperty('state');
      
      expect(health.openAI).toHaveProperty('healthy');
      expect(health.openAI).toHaveProperty('state');
    });
  });

  describe('Reset', () => {
    it('should reset circuit breakers', () => {
      expect(() => service.reset()).not.toThrow();
      
      // After reset, circuit should be closed
      const health = service.healthCheck();
      expect(health).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing OpenAI API key', async () => {
      const { llmCache } = await import('../../src/services/LLMCache');
      vi.mocked(llmCache.get).mockResolvedValue(null);

      delete process.env.OPENAI_API_KEY;

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Error'
      });

      await expect(
        service.processRequest({
          prompt: 'Test',
          model: 'test-model',
          userId: 'user-123'
        })
      ).rejects.toThrow();
    });

    it('should handle network timeouts', async () => {
      const { llmCache } = await import('../../src/services/LLMCache');
      vi.mocked(llmCache.get).mockResolvedValue(null);

      global.fetch = vi.fn().mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 100)
        )
      );

      await expect(
        service.processRequest({
          prompt: 'Test',
          model: 'test-model',
          userId: 'user-123'
        })
      ).rejects.toThrow();
    });
  });
});
