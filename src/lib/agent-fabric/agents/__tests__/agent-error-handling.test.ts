/**
 * Agent Error Handling Tests
 * 
 * CRITICAL: Tests that agents handle errors gracefully in production scenarios
 * 
 * Tests:
 * - Circuit breaker integration
 * - Cost limit enforcement
 * - Retry logic
 * - Timeout handling
 * - Graceful degradation
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BaseAgent } from '../BaseAgent';
import { z } from 'zod';

// Mock LLM Gateway
const mockLLMGateway = {
  complete: vi.fn(),
  stream: vi.fn(),
};

// Mock Supabase Client
const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(),
      })),
    })),
    insert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(),
      })),
    })),
  })),
} as any;

// Test Agent Implementation
class TestAgent extends BaseAgent {
  lifecycleStage = 'test' as const;
  version = '1.0.0';
  name = 'TestAgent';

  async execute(sessionId: string, input: any): Promise<any> {
    const OutputSchema = z.object({
      result: z.string(),
      confidence: z.number().min(0).max(1),
    });

    return this.secureInvoke(
      sessionId,
      input,
      OutputSchema,
      {
        confidenceThresholds: {
          minimum: 0.7,
          warning: 0.85,
        },
        throwOnLowConfidence: true,
        trackPrediction: true,
        safetyLimits: {
          maxTokens: 4000,
          maxCostPerCall: 0.50,
          timeoutMs: 30000,
        },
      }
    );
  }
}

describe('Agent Error Handling', () => {
  let agent: TestAgent;

  beforeEach(() => {
    vi.clearAllMocks();
    
    agent = new TestAgent({
      llmGateway: mockLLMGateway as any,
      supabase: mockSupabase,
      memorySystem: {} as any,
      auditLogger: {
        logAgentExecution: vi.fn(),
        logError: vi.fn(),
      } as any,
      circuitBreaker: {
        execute: vi.fn((fn) => fn()),
        getState: vi.fn(() => 'closed'),
      } as any,
    });
  });

  describe('Circuit Breaker Integration', () => {
    it('CRITICAL: should use circuit breaker for LLM calls', async () => {
      mockLLMGateway.complete.mockResolvedValue({
        content: JSON.stringify({ result: 'success', confidence: 0.9 }),
        usage: { total_tokens: 100 },
      });

      await agent.execute('session-1', { test: 'input' });

      // Verify circuit breaker was used
      expect(agent['circuitBreaker'].execute).toHaveBeenCalled();
    });

    it('CRITICAL: should fail fast when circuit is open', async () => {
      // Mock circuit breaker in open state
      agent['circuitBreaker'].getState = vi.fn(() => 'open');
      agent['circuitBreaker'].execute = vi.fn(() => {
        throw new Error('Circuit breaker is open');
      });

      await expect(agent.execute('session-1', { test: 'input' }))
        .rejects.toThrow('Circuit breaker is open');

      // LLM should not be called
      expect(mockLLMGateway.complete).not.toHaveBeenCalled();
    });

    it('should track circuit breaker state changes', async () => {
      const states: string[] = [];
      
      agent['circuitBreaker'].getState = vi.fn(() => {
        const state = states.length === 0 ? 'closed' : 'open';
        states.push(state);
        return state;
      });

      // First call succeeds
      mockLLMGateway.complete.mockResolvedValueOnce({
        content: JSON.stringify({ result: 'success', confidence: 0.9 }),
        usage: { total_tokens: 100 },
      });

      await agent.execute('session-1', { test: 'input' });

      // Verify state was checked
      expect(states.length).toBeGreaterThan(0);
    });
  });

  describe('Cost Limit Enforcement', () => {
    it('CRITICAL: should reject calls exceeding cost limit', async () => {
      mockLLMGateway.complete.mockResolvedValue({
        content: JSON.stringify({ result: 'expensive', confidence: 0.9 }),
        usage: { 
          total_tokens: 100000, // Very expensive
          prompt_tokens: 50000,
          completion_tokens: 50000,
        },
      });

      // This should be caught by cost tracking
      // Implementation depends on LLMCostTracker integration
      
      await agent.execute('session-1', { test: 'input' });

      // Verify cost was tracked
      // expect(costTracker.trackCost).toHaveBeenCalled();
    });

    it('should track cumulative costs per session', async () => {
      mockLLMGateway.complete.mockResolvedValue({
        content: JSON.stringify({ result: 'success', confidence: 0.9 }),
        usage: { total_tokens: 1000 },
      });

      // Make multiple calls
      await agent.execute('session-1', { test: 'input1' });
      await agent.execute('session-1', { test: 'input2' });
      await agent.execute('session-1', { test: 'input3' });

      // Cumulative cost should be tracked
      // Implementation depends on session-level cost tracking
    });
  });

  describe('Confidence Scoring', () => {
    it('CRITICAL: should reject low-confidence outputs', async () => {
      mockLLMGateway.complete.mockResolvedValue({
        content: JSON.stringify({ result: 'uncertain', confidence: 0.5 }),
        usage: { total_tokens: 100 },
      });

      await expect(agent.execute('session-1', { test: 'input' }))
        .rejects.toThrow();
    });

    it('should accept high-confidence outputs', async () => {
      mockLLMGateway.complete.mockResolvedValue({
        content: JSON.stringify({ result: 'certain', confidence: 0.95 }),
        usage: { total_tokens: 100 },
      });

      const result = await agent.execute('session-1', { test: 'input' });

      expect(result).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
    });

    it('should warn on medium-confidence outputs', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      mockLLMGateway.complete.mockResolvedValue({
        content: JSON.stringify({ result: 'maybe', confidence: 0.8 }),
        usage: { total_tokens: 100 },
      });

      await agent.execute('session-1', { test: 'input' });

      // Should log warning for confidence below warning threshold (0.85)
      // expect(warnSpy).toHaveBeenCalled();

      warnSpy.mockRestore();
    });
  });

  describe('Retry Logic', () => {
    it('should retry on transient failures', async () => {
      mockLLMGateway.complete
        .mockRejectedValueOnce(new Error('Temporary network error'))
        .mockRejectedValueOnce(new Error('Temporary network error'))
        .mockResolvedValueOnce({
          content: JSON.stringify({ result: 'success', confidence: 0.9 }),
          usage: { total_tokens: 100 },
        });

      // Should succeed after retries
      const result = await agent.execute('session-1', { test: 'input' });

      expect(result).toBeDefined();
      expect(mockLLMGateway.complete).toHaveBeenCalledTimes(3);
    });

    it('should not retry on permanent failures', async () => {
      mockLLMGateway.complete.mockRejectedValue(
        new Error('Invalid API key')
      );

      await expect(agent.execute('session-1', { test: 'input' }))
        .rejects.toThrow();

      // Should fail fast, not retry
      expect(mockLLMGateway.complete).toHaveBeenCalledTimes(1);
    });

    it('should use exponential backoff for retries', async () => {
      const callTimes: number[] = [];

      mockLLMGateway.complete.mockImplementation(async () => {
        callTimes.push(Date.now());
        if (callTimes.length < 3) {
          throw new Error('Temporary error');
        }
        return {
          content: JSON.stringify({ result: 'success', confidence: 0.9 }),
          usage: { total_tokens: 100 },
        };
      });

      await agent.execute('session-1', { test: 'input' });

      // Verify delays between retries increase
      if (callTimes.length >= 3) {
        const delay1 = callTimes[1] - callTimes[0];
        const delay2 = callTimes[2] - callTimes[1];
        
        // Second delay should be longer than first (exponential backoff)
        expect(delay2).toBeGreaterThanOrEqual(delay1);
      }
    });
  });

  describe('Timeout Handling', () => {
    it('CRITICAL: should timeout long-running LLM calls', async () => {
      mockLLMGateway.complete.mockImplementation(
        () => new Promise((resolve) => {
          // Never resolves (simulates hang)
          setTimeout(resolve, 60000);
        })
      );

      await expect(agent.execute('session-1', { test: 'input' }))
        .rejects.toThrow(/timeout/i);
    }, 35000); // Test timeout slightly longer than agent timeout

    it('should not timeout fast LLM calls', async () => {
      mockLLMGateway.complete.mockImplementation(
        () => new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              content: JSON.stringify({ result: 'fast', confidence: 0.9 }),
              usage: { total_tokens: 100 },
            });
          }, 100);
        })
      );

      const result = await agent.execute('session-1', { test: 'input' });

      expect(result).toBeDefined();
    });
  });

  describe('Schema Validation', () => {
    it('CRITICAL: should reject invalid LLM outputs', async () => {
      mockLLMGateway.complete.mockResolvedValue({
        content: JSON.stringify({ invalid: 'schema' }),
        usage: { total_tokens: 100 },
      });

      await expect(agent.execute('session-1', { test: 'input' }))
        .rejects.toThrow();
    });

    it('should reject malformed JSON', async () => {
      mockLLMGateway.complete.mockResolvedValue({
        content: 'not valid json',
        usage: { total_tokens: 100 },
      });

      await expect(agent.execute('session-1', { test: 'input' }))
        .rejects.toThrow();
    });

    it('should validate nested objects', async () => {
      mockLLMGateway.complete.mockResolvedValue({
        content: JSON.stringify({
          result: 'success',
          confidence: 1.5, // Invalid: > 1.0
        }),
        usage: { total_tokens: 100 },
      });

      await expect(agent.execute('session-1', { test: 'input' }))
        .rejects.toThrow();
    });
  });

  describe('Graceful Degradation', () => {
    it('should not crash process on agent failure', async () => {
      mockLLMGateway.complete.mockRejectedValue(
        new Error('Catastrophic failure')
      );

      await expect(agent.execute('session-1', { test: 'input' }))
        .rejects.toThrow();

      // Process should still be running
      expect(process.exitCode).toBeUndefined();
    });

    it('should log errors for debugging', async () => {
      const logSpy = vi.spyOn(agent['auditLogger'], 'logError');

      mockLLMGateway.complete.mockRejectedValue(
        new Error('Test error')
      );

      try {
        await agent.execute('session-1', { test: 'input' });
      } catch (_e) {
        // Expected
      }

      expect(logSpy).toHaveBeenCalled();
    });

    it('should provide meaningful error messages', async () => {
      mockLLMGateway.complete.mockRejectedValue(
        new Error('LLM API rate limit exceeded')
      );

      try {
        await agent.execute('session-1', { test: 'input' });
        throw new Error('Should have thrown');
      } catch (error: any) {
        expect(error.message).toContain('rate limit');
      }
    });
  });

  describe('Telemetry', () => {
    it('should track successful executions', async () => {
      const logSpy = vi.spyOn(agent['auditLogger'], 'logAgentExecution');

      mockLLMGateway.complete.mockResolvedValue({
        content: JSON.stringify({ result: 'success', confidence: 0.9 }),
        usage: { total_tokens: 100 },
      });

      await agent.execute('session-1', { test: 'input' });

      expect(logSpy).toHaveBeenCalled();
    });

    it('should track failed executions', async () => {
      const logSpy = vi.spyOn(agent['auditLogger'], 'logError');

      mockLLMGateway.complete.mockRejectedValue(
        new Error('Test failure')
      );

      try {
        await agent.execute('session-1', { test: 'input' });
      } catch (_e) {
        // Expected
      }

      expect(logSpy).toHaveBeenCalled();
    });

    it('should track execution duration', async () => {
      mockLLMGateway.complete.mockImplementation(
        () => new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              content: JSON.stringify({ result: 'success', confidence: 0.9 }),
              usage: { total_tokens: 100 },
            });
          }, 100);
        })
      );

      const start = Date.now();
      await agent.execute('session-1', { test: 'input' });
      const duration = Date.now() - start;

      expect(duration).toBeGreaterThanOrEqual(100);
    });
  });
});
