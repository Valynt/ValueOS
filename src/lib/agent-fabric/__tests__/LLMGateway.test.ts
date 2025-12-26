/**
 * LLMGateway Tests
 * Tests LLM gateway functionality, sanitization, and cost tracking integration
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LLMGateway } from '../LLMGateway';
import { createClient } from '@supabase/supabase-js';
import { llmCostTracker } from '../../../services/LLMCostTracker';

// Mock dependencies
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}));

vi.mock('../../../services/LLMCostTracker', () => ({
  llmCostTracker: {
    calculateCost: vi.fn(),
    trackUsage: vi.fn(),
    getHourlyCost: vi.fn(),
  },
}));

vi.mock('../../../services/LLMSanitizer', () => ({
  llmSanitizer: {
    sanitizeAgentInput: vi.fn(),
  },
}));

vi.mock('../../../lib/logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  })),
}));

vi.mock('../../../services/LLMProxyClient', () => ({
  llmProxyClient: {
    complete: vi.fn(),
    completeWithTools: vi.fn(),
    completeStream: vi.fn(),
    generateEmbedding: vi.fn(),
  },
}));

vi.mock('../../../lib/agent-fabric/CircuitBreaker', () => ({
  AgentCircuitBreaker: vi.fn(),
}));

vi.mock('../../../services/UsageTrackingService', () => ({
  trackUsage: vi.fn(),
}));

describe('LLMGateway', () => {
  let llmGateway: LLMGateway;
  let mockSupabase: any;
  let mockProxyClient: any;
  let mockCircuitBreaker: any;

  // Common mock objects used across tests
  const mockMessages = [
    { role: 'system' as const, content: 'You are a helpful assistant.' },
    { role: 'user' as const, content: 'Hello!' },
  ];

  const mockResponse = {
    content: 'Hello! How can I help you today?',
    tokens_used: 150,
    latency_ms: 1200,
    model: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
  };

  const mockTaskContext = {
    userId: 'user-123',
    sessionId: 'session-456',
    organizationId: 'org-789',
    estimatedPromptTokens: 100,
    estimatedCompletionTokens: 50,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockSupabase = {};
    (createClient as any).mockReturnValue(mockSupabase);

    mockProxyClient = {
      complete: vi.fn(),
      completeWithTools: vi.fn(),
      completeStream: vi.fn(),
      generateEmbedding: vi.fn(),
    };

    mockCircuitBreaker = {
      recordLLMCall: vi.fn(),
      checkMemory: vi.fn(),
      shouldAbort: vi.fn().mockReturnValue(false),
      recordCost: vi.fn(),
      complete: vi.fn().mockReturnValue({
        executionCost: 0,
        completed: true,
      }),
    };

    // Import and mock the proxy client
    const llmProxyClient = require('../../../services/LLMProxyClient').llmProxyClient;
    Object.assign(llmProxyClient, mockProxyClient);

    llmGateway = new LLMGateway('together', mockSupabase);
  });

  describe('Initialization', () => {
    it('should initialize with correct provider and models', () => {
      expect(llmGateway.getProvider()).toBe('together');
      expect(llmGateway.getDefaultModel()).toBe('meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo');
      expect(llmGateway.getSupportedModels()).toContain('meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo');
    });

    it('should support different providers', () => {
      const openaiGateway = new LLMGateway('openai', mockSupabase);
      expect(openaiGateway.getProvider()).toBe('openai');
      expect(openaiGateway.getSupportedModels()).toContain('gpt-4');
    });
  });

  describe('LLM Completion', () => {
    beforeEach(() => {
      mockProxyClient.complete.mockResolvedValue(mockResponse);
      (llmCostTracker.calculateCost as any).mockReturnValue(0.025);
      (llmCostTracker.trackUsage as any).mockResolvedValue(undefined);
    });

    it('should complete LLM requests successfully', async () => {
      const result = await llmGateway.complete(mockMessages);

      expect(mockProxyClient.complete).toHaveBeenCalledWith({
        messages: mockMessages,
        config: expect.objectContaining({
          model: expect.any(String),
        }),
        provider: 'together',
      });

      expect(result.content).toBe(mockResponse.content);
      expect(result.tokens_used).toBe(mockResponse.tokens_used);
    });

    it('should sanitize LLM responses', async () => {
      // Mock a response with dangerous content
      const dangerousResponse = {
        ...mockResponse,
        content: 'Safe content <script>alert("danger")</script>',
      };

      mockProxyClient.complete.mockResolvedValue(dangerousResponse);

      const result = await llmGateway.complete(mockMessages);

      // Should have sanitized content
      expect(result.content).toBe('Safe content ');
      expect(result.content).not.toContain('<script>');
    });

    it('should integrate with circuit breaker for cost tracking', async () => {
      const result = await llmGateway.complete(mockMessages, {}, mockTaskContext, mockCircuitBreaker);

      expect(mockCircuitBreaker.recordLLMCall).toHaveBeenCalled();
      expect(mockCircuitBreaker.checkMemory).toHaveBeenCalled();
      expect(mockCircuitBreaker.recordCost).toHaveBeenCalled();
      expect(mockCircuitBreaker.complete).toHaveBeenCalled();

      expect(llmCostTracker.trackUsage).toHaveBeenCalledWith({
        userId: mockTaskContext.userId,
        sessionId: mockTaskContext.sessionId,
        provider: 'together',
        model: mockResponse.model,
        promptTokens: 100,
        completionTokens: 50,
        endpoint: 'llm-gateway',
        success: true,
        latencyMs: mockResponse.latency_ms,
      });
    });

    it('should handle circuit breaker abortion', async () => {
      mockCircuitBreaker.shouldAbort.mockReturnValue(true);

      await expect(llmGateway.complete(mockMessages, {}, mockTaskContext, mockCircuitBreaker))
        .rejects.toThrow('LLM call aborted by circuit breaker');
    });

    it('should track usage events for billing', async () => {
      const trackUsage = require('../../../services/UsageTrackingService').trackUsage;

      await llmGateway.complete(mockMessages, {}, mockTaskContext);

      expect(trackUsage).toHaveBeenCalledWith({
        organizationId: mockTaskContext.organizationId,
        type: 'agent_call',
        amount: 0.025,
        metadata: expect.objectContaining({
          provider: 'together',
          model: mockResponse.model,
          promptTokens: 100,
          completionTokens: 50,
        }),
        timestamp: expect.any(Date),
      });
    });

    it('should handle cost tracking failures gracefully', async () => {
      (llmCostTracker.calculateCost as any).mockImplementation(() => {
        throw new Error('Cost calculation failed');
      });

      // Should not throw, just log the error
      const result = await llmGateway.complete(mockMessages, {}, mockTaskContext);

      expect(result.content).toBe(mockResponse.content);
    });
  });

  describe('LLM Gating', () => {
    it('should apply LLM gating when enabled', async () => {
      llmGateway.setGatingEnabled(true);

      const complexContext = {
        task_type: 'system_analysis',
        entities: [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }, { id: '5' }],
        task_intent: 'Analyze the system architecture',
      };

      const shouldInvoke = await llmGateway.shouldInvoke('test-model', complexContext);

      expect(shouldInvoke.invoke).toBe(true);
      expect(shouldInvoke.reason).toContain('High complexity');
    });

    it('should skip LLM for simple tasks when gating enabled', async () => {
      llmGateway.setGatingEnabled(true);

      const simpleContext = {
        task_type: 'status_check',
      };

      const shouldInvoke = await llmGateway.shouldInvoke('test-model', simpleContext);

      expect(shouldInvoke.invoke).toBe(false);
      expect(shouldInvoke.useHeuristic).toBe(true);
    });

    it('should bypass gating when disabled', async () => {
      llmGateway.setGatingEnabled(false);

      const shouldInvoke = await llmGateway.shouldInvoke('test-model');

      expect(shouldInvoke.invoke).toBe(true);
      expect(shouldInvoke.useHeuristic).toBe(false);
    });
  });

  describe('Tool Calling', () => {
    it('should handle tool calling conversations', async () => {
      const tools = [
        {
          type: 'function' as const,
          function: {
            name: 'get_weather',
            description: 'Get weather information',
            parameters: {
              type: 'object',
              properties: {
                location: { type: 'string' },
              },
              required: ['location'],
            },
          },
        },
      ];

      const mockToolResponse = {
        ...mockResponse,
        tool_calls: [
          {
            id: 'call-1',
            type: 'function' as const,
            function: {
              name: 'get_weather',
              arguments: '{"location": "New York"}',
            },
          },
        ],
      };

      mockProxyClient.completeWithTools.mockResolvedValue(mockToolResponse);

      const executeToolFn = vi.fn().mockResolvedValue('Weather: Sunny, 72°F');

      const result = await llmGateway.completeWithTools(
        [{ role: 'user', content: 'What\'s the weather in New York?' }],
        tools,
        executeToolFn
      );

      expect(result).toBeDefined();
      expect(executeToolFn).toHaveBeenCalledWith('get_weather', { location: 'New York' });
    });

    it('should handle tool execution errors gracefully', async () => {
      const tools = [{
        type: 'function' as const,
        function: {
          name: 'failing_tool',
          description: 'A tool that fails',
          parameters: { type: 'object', properties: {} },
        },
      }];

      const mockToolResponse = {
        content: 'Let me check that for you.',
        tokens_used: 50,
        latency_ms: 800,
        model: 'test-model',
        tool_calls: [{
          id: 'call-1',
          type: 'function' as const,
          function: {
            name: 'failing_tool',
            arguments: '{}',
          },
        }],
      };

      mockProxyClient.completeWithTools.mockResolvedValue(mockToolResponse);

      const executeToolFn = vi.fn().mockRejectedValue(new Error('Tool failed'));

      const result = await llmGateway.completeWithTools(
        [{ role: 'user', content: 'Run failing tool' }],
        tools,
        executeToolFn
      );

      expect(result.content).toContain('Maximum tool iterations reached');
    });
  });

  describe('Streaming', () => {
    it('should handle streaming responses', async () => {
      const onChunk = vi.fn();
      const mockChunks = [
        { content: 'Hello', tokens_used: 10 },
        { content: ' world!', tokens_used: 20, finish_reason: 'stop' },
      ];

      let chunkIndex = 0;
      mockProxyClient.completeStream.mockImplementation(async (params: any, callback: any) => {
        for (const chunk of mockChunks) {
          await callback(chunk);
        }
      });

      await llmGateway.completeStream(
        [{ role: 'user', content: 'Hello' }],
        onChunk,
        {},
        mockTaskContext,
        mockCircuitBreaker
      );

      expect(onChunk).toHaveBeenCalledTimes(2);
      expect(onChunk).toHaveBeenCalledWith(expect.objectContaining({ content: 'Hello' }));
      expect(onChunk).toHaveBeenCalledWith(expect.objectContaining({ content: ' world!' }));
    });

    it('should sanitize streaming chunks', async () => {
      const onChunk = vi.fn();
      const dangerousChunk = {
        content: 'Safe <script>danger()</script>',
        tokens_used: 10,
        finish_reason: 'stop',
      };

      mockProxyClient.completeStream.mockImplementation(async (params: any, callback: any) => {
        await callback(dangerousChunk);
      });

      await llmGateway.completeStream(
        [{ role: 'user', content: 'Test' }],
        onChunk
      );

      expect(onChunk).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'Safe ',
        })
      );
      expect(onChunk).not.toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('<script>'),
        })
      );
    });
  });

  describe('Embeddings', () => {
    it('should generate embeddings', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5];
      mockProxyClient.generateEmbedding.mockResolvedValue(mockEmbedding);

      const result = await llmGateway.generateEmbedding('test text');

      expect(result).toEqual(mockEmbedding);
      expect(mockProxyClient.generateEmbedding).toHaveBeenCalledWith({
        input: 'test text',
        provider: 'together',
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle proxy client errors', async () => {
      mockProxyClient.complete.mockRejectedValue(new Error('API Error'));

      await expect(llmGateway.complete([{ role: 'user', content: 'test' }]))
        .rejects.toThrow('API Error');
    });

    it('should handle invalid messages', async () => {
      await expect(llmGateway.complete([]))
        .rejects.toThrow();
    });

    it('should handle malformed tool arguments', async () => {
      const tools = [{
        type: 'function' as const,
        function: {
          name: 'test_tool',
          description: 'Test tool',
          parameters: { type: 'object', properties: {} },
        },
      }];

      const mockToolResponse = {
        content: 'Testing tool',
        tokens_used: 30,
        latency_ms: 500,
        model: 'test-model',
        tool_calls: [{
          id: 'call-1',
          type: 'function' as const,
          function: {
            name: 'test_tool',
            arguments: 'invalid json {',
          },
        }],
      };

      mockProxyClient.completeWithTools.mockResolvedValue(mockToolResponse);

      const executeToolFn = vi.fn().mockResolvedValue('Tool result');

      // Should handle JSON parsing error gracefully
      await expect(llmGateway.completeWithTools(
        [{ role: 'user', content: 'test' }],
        tools,
        executeToolFn
      )).resolves.toBeDefined();
    });
  });
});
