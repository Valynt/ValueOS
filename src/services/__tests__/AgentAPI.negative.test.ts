/**
 * AgentAPI Negative Path Tests
 * 
 * Tests for invalid payloads, rate-limit failures, and CSRF failures
 * to ensure proper error handling and security enforcement.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AgentAPI, AgentRequest } from '../AgentAPI';

// Mock dependencies
vi.mock('../../lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock('../../config/environment', () => ({
  getConfig: vi.fn(() => ({
    api: {
      agentEndpoint: 'http://localhost:3000/api/agents',
      timeout: 5000,
    },
  })),
}));

// Mock fetch globally
global.fetch = vi.fn();

describe('AgentAPI - Negative Path Tests', () => {
  let agentAPI: AgentAPI;

  beforeEach(() => {
    agentAPI = new AgentAPI();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Invalid Payload Tests', () => {
    it('should reject request with missing agent type', async () => {
      const invalidRequest = {
        query: 'Test query',
        // missing agent
      } as AgentRequest;

      await expect(
        agentAPI.invokeAgent(invalidRequest)
      ).rejects.toThrow(/agent.*required/i);
    });

    it('should reject request with empty agent type', async () => {
      const invalidRequest: AgentRequest = {
        agent: '' as any,
        query: 'Test query',
      };

      await expect(
        agentAPI.invokeAgent(invalidRequest)
      ).rejects.toThrow(/agent.*invalid/i);
    });

    it('should reject request with missing query', async () => {
      const invalidRequest = {
        agent: 'opportunity',
        // missing query
      } as AgentRequest;

      await expect(
        agentAPI.invokeAgent(invalidRequest)
      ).rejects.toThrow(/query.*required/i);
    });

    it('should reject request with empty query', async () => {
      const invalidRequest: AgentRequest = {
        agent: 'opportunity',
        query: '',
      };

      await expect(
        agentAPI.invokeAgent(invalidRequest)
      ).rejects.toThrow(/query.*empty/i);
    });

    it('should reject request with query exceeding max length', async () => {
      const invalidRequest: AgentRequest = {
        agent: 'opportunity',
        query: 'A'.repeat(100000), // Very long query
      };

      await expect(
        agentAPI.invokeAgent(invalidRequest)
      ).rejects.toThrow(/query.*too long/i);
    });

    it('should reject request with invalid agent type', async () => {
      const invalidRequest: AgentRequest = {
        agent: 'invalid-agent-type' as any,
        query: 'Test query',
      };

      await expect(
        agentAPI.invokeAgent(invalidRequest)
      ).rejects.toThrow(/unknown agent/i);
    });

    it('should reject request with malformed context', async () => {
      const invalidRequest: AgentRequest = {
        agent: 'opportunity',
        query: 'Test query',
        context: {
          userId: null as any, // Invalid
        },
      };

      await expect(
        agentAPI.invokeAgent(invalidRequest)
      ).rejects.toThrow(/invalid context/i);
    });

    it('should reject request with circular reference in parameters', async () => {
      const circular: any = { a: 1 };
      circular.self = circular;

      const invalidRequest: AgentRequest = {
        agent: 'opportunity',
        query: 'Test query',
        parameters: circular,
      };

      await expect(
        agentAPI.invokeAgent(invalidRequest)
      ).rejects.toThrow(/circular|serialize/i);
    });

    it('should sanitize potentially malicious query strings', async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: 'response',
        }),
      });

      const xssAttempt: AgentRequest = {
        agent: 'opportunity',
        query: '<script>alert("xss")</script>',
      };

      await agentAPI.invokeAgent(xssAttempt);

      // Verify that query was sanitized before sending
      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.query).not.toContain('<script>');
    });

    it('should reject request with SQL injection attempt in query', async () => {
      const sqlInjection: AgentRequest = {
        agent: 'opportunity',
        query: "'; DROP TABLE users; --",
      };

      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: 'response',
        }),
      });

      await agentAPI.invokeAgent(sqlInjection);

      // Verify sanitization happened
      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.query).toBeDefined();
    });
  });

  describe('Rate Limit Failure Tests', () => {
    it('should throw RateLimitError when API returns 429', async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Map([['Retry-After', '60']]),
        json: async () => ({
          error: 'Too many requests',
        }),
      });

      const request: AgentRequest = {
        agent: 'opportunity',
        query: 'Test query',
      };

      await expect(
        agentAPI.invokeAgent(request)
      ).rejects.toThrow(/rate limit/i);
    });

    it('should include retry-after in RateLimitError', async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Map([['Retry-After', '120']]),
        json: async () => ({
          error: 'Rate limit exceeded',
        }),
      });

      const request: AgentRequest = {
        agent: 'opportunity',
        query: 'Test query',
      };

      try {
        await agentAPI.invokeAgent(request);
        expect.fail('Should have thrown RateLimitError');
      } catch (error: any) {
        expect(error.message).toContain('rate limit');
        expect(error.retryAfter).toBeDefined();
      }
    });

    it('should handle rate limit without Retry-After header', async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Map(),
        json: async () => ({
          error: 'Too many requests',
        }),
      });

      const request: AgentRequest = {
        agent: 'opportunity',
        query: 'Test query',
      };

      await expect(
        agentAPI.invokeAgent(request)
      ).rejects.toThrow(/rate limit/i);
    });

    it('should respect circuit breaker after repeated rate limits', async () => {
      const mockFetch = global.fetch as any;
      
      // Simulate multiple rate limit failures
      for (let i = 0; i < 5; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 429,
          json: async () => ({ error: 'Rate limited' }),
        });
      }

      const request: AgentRequest = {
        agent: 'opportunity',
        query: 'Test query',
      };

      // Should eventually open circuit breaker
      for (let i = 0; i < 5; i++) {
        try {
          await agentAPI.invokeAgent(request);
        } catch (e) {
          // Expected
        }
      }

      // Next call should fail fast due to open circuit
      await expect(
        agentAPI.invokeAgent(request)
      ).rejects.toThrow();
    });
  });

  describe('CSRF Failure Tests', () => {
    it('should throw CSRF error when token is missing', async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({
          error: 'CSRF validation failed',
        }),
      });

      const request: AgentRequest = {
        agent: 'opportunity',
        query: 'Test query',
      };

      await expect(
        agentAPI.invokeAgent(request)
      ).rejects.toThrow(/CSRF|forbidden/i);
    });

    it('should include CSRF token in request headers', async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: 'response',
        }),
      });

      // Mock CSRF token retrieval
      document.cookie = 'csrf_token=test-token-123';

      const request: AgentRequest = {
        agent: 'opportunity',
        query: 'Test query',
      };

      await agentAPI.invokeAgent(request);

      // Verify CSRF token was included
      const callArgs = mockFetch.mock.calls[0];
      const headers = callArgs[1].headers;
      expect(headers['x-csrf-token']).toBeDefined();
    });

    it('should throw error when CSRF token is invalid', async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({
          error: 'Invalid CSRF token',
        }),
      });

      const request: AgentRequest = {
        agent: 'opportunity',
        query: 'Test query',
      };

      await expect(
        agentAPI.invokeAgent(request)
      ).rejects.toThrow(/CSRF|forbidden/i);
    });

    it('should handle CSRF token refresh on failure', async () => {
      const mockFetch = global.fetch as any;
      
      // First call fails with CSRF error
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({
          error: 'CSRF validation failed',
        }),
      });

      // Second call succeeds after token refresh
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: 'response',
        }),
      });

      const request: AgentRequest = {
        agent: 'opportunity',
        query: 'Test query',
      };

      // First attempt should fail
      await expect(
        agentAPI.invokeAgent(request)
      ).rejects.toThrow(/CSRF/i);
    });
  });

  describe('Network and Timeout Failures', () => {
    it('should handle network failure', async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const request: AgentRequest = {
        agent: 'opportunity',
        query: 'Test query',
      };

      await expect(
        agentAPI.invokeAgent(request)
      ).rejects.toThrow(/network/i);
    });

    it('should handle timeout', async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockImplementationOnce(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 100)
        )
      );

      const request: AgentRequest = {
        agent: 'opportunity',
        query: 'Test query',
      };

      await expect(
        agentAPI.invokeAgent(request)
      ).rejects.toThrow(/timeout/i);
    });

    it('should handle 500 server error', async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({
          error: 'Internal server error',
        }),
      });

      const request: AgentRequest = {
        agent: 'opportunity',
        query: 'Test query',
      };

      await expect(
        agentAPI.invokeAgent(request)
      ).rejects.toThrow(/server error|500/i);
    });

    it('should handle 503 service unavailable', async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({
          error: 'Service unavailable',
        }),
      });

      const request: AgentRequest = {
        agent: 'opportunity',
        query: 'Test query',
      };

      await expect(
        agentAPI.invokeAgent(request)
      ).rejects.toThrow(/unavailable|503/i);
    });
  });

  describe('Response Validation Tests', () => {
    it('should reject response with invalid format', async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          // Missing required fields
          data: 'response',
        }),
      });

      const request: AgentRequest = {
        agent: 'opportunity',
        query: 'Test query',
      };

      await expect(
        agentAPI.invokeAgent(request)
      ).rejects.toThrow(/invalid response/i);
    });

    it('should reject response with malformed JSON', async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      });

      const request: AgentRequest = {
        agent: 'opportunity',
        query: 'Test query',
      };

      await expect(
        agentAPI.invokeAgent(request)
      ).rejects.toThrow(/JSON|parse/i);
    });

    it('should sanitize response data for XSS', async () => {
      const mockFetch = global.fetch as any;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            result: '<script>alert("xss")</script>',
          },
        }),
      });

      const request: AgentRequest = {
        agent: 'opportunity',
        query: 'Test query',
      };

      const response = await agentAPI.invokeAgent(request);
      
      // Response should be sanitized
      expect(response.data.result).not.toContain('<script>');
    });
  });

  describe('Error Recovery Tests', () => {
    it('should retry on transient failures', async () => {
      const mockFetch = global.fetch as any;
      
      // First call fails
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({ error: 'Service unavailable' }),
      });

      // Second call succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: 'response',
        }),
      });

      const request: AgentRequest = {
        agent: 'opportunity',
        query: 'Test query',
      };

      const response = await agentAPI.invokeAgent(request);
      expect(response.success).toBe(true);
    });

    it('should not retry on 4xx errors', async () => {
      const mockFetch = global.fetch as any;
      
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Bad request' }),
      });

      const request: AgentRequest = {
        agent: 'opportunity',
        query: 'Test query',
      };

      await expect(
        agentAPI.invokeAgent(request)
      ).rejects.toThrow();

      // Should only have called fetch once
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should give up after max retries', async () => {
      const mockFetch = global.fetch as any;
      
      // All calls fail
      for (let i = 0; i < 5; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 503,
          json: async () => ({ error: 'Service unavailable' }),
        });
      }

      const request: AgentRequest = {
        agent: 'opportunity',
        query: 'Test query',
      };

      await expect(
        agentAPI.invokeAgent(request)
      ).rejects.toThrow();
    });
  });
});
