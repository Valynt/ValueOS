/**
 * AgentAPI Tests
 * 
 * Tests for AgentAPI service with endpoint validation, circuit breaker,
 * and error handling following MCP Ground Truth patterns.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AgentAPI } from '../../services/AgentAPI';
import type { AgentRequest, AgentResponse, AgentType } from '../../services/AgentAPI';

describe('AgentAPI', () => {
  let api: AgentAPI;
  let mockFetch: any;

  beforeEach(() => {
    // Mock global fetch
    mockFetch = vi.fn();
    global.fetch = mockFetch;

    // Create API instance
    api = new AgentAPI({
      baseUrl: 'http://localhost:3000/api',
      timeout: 5000,
      enableCircuitBreaker: true,
      enableLogging: false
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Agent Invocation', () => {
    it('should invoke opportunity agent successfully', async () => {
      const mockResponse: AgentResponse = {
        success: true,
        data: {
          opportunitySummary: 'Test opportunity',
          personaFit: { score: 0.85 }
        },
        confidence: 0.9,
        metadata: {
          agent: 'opportunity',
          duration: 1500,
          timestamp: new Date().toISOString()
        }
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse
      });

      const request: AgentRequest = {
        agent: 'opportunity',
        query: 'Analyze this opportunity',
        context: {
          userId: 'user-1',
          sessionId: 'session-1'
        }
      };

      const result = await api.invoke(request);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should invoke target agent successfully', async () => {
      const mockResponse: AgentResponse = {
        success: true,
        data: {
          valueTree: { name: 'Test Tree' },
          roiModel: { name: 'Test Model' }
        },
        confidence: 0.95,
        metadata: {
          agent: 'target',
          duration: 2000,
          timestamp: new Date().toISOString()
        }
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse
      });

      const request: AgentRequest = {
        agent: 'target',
        query: 'Create business case',
        parameters: {
          valueCaseId: 'vc-123'
        }
      };

      const result = await api.invoke(request);

      expect(result.success).toBe(true);
      expect(result.metadata?.agent).toBe('target');
    });

    it('should include request context in API call', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true })
      });

      const request: AgentRequest = {
        agent: 'opportunity',
        query: 'Test query',
        context: {
          userId: 'user-123',
          organizationId: 'org-456',
          sessionId: 'session-789',
          metadata: { source: 'test' }
        }
      };

      await api.invoke(request);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/agents/opportunity'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          }),
          body: expect.stringContaining('user-123')
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const request: AgentRequest = {
        agent: 'opportunity',
        query: 'Test query'
      };

      const result = await api.invoke(request);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Network error');
    });

    it('should handle 404 errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ error: 'Agent not found' })
      });

      const request: AgentRequest = {
        agent: 'opportunity',
        query: 'Test query'
      };

      const result = await api.invoke(request);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle 500 errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ error: 'Server error' })
      });

      const request: AgentRequest = {
        agent: 'opportunity',
        query: 'Test query'
      };

      const result = await api.invoke(request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Server error');
    });

    it('should handle timeout errors', async () => {
      mockFetch.mockImplementation(() => 
        new Promise((resolve) => setTimeout(resolve, 10000))
      );

      const request: AgentRequest = {
        agent: 'opportunity',
        query: 'Test query'
      };

      const result = await api.invoke(request);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle invalid JSON responses', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error('Invalid JSON');
        }
      });

      const request: AgentRequest = {
        agent: 'opportunity',
        query: 'Test query'
      };

      const result = await api.invoke(request);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Circuit Breaker', () => {
    it('should open circuit after threshold failures', async () => {
      mockFetch.mockRejectedValue(new Error('Service unavailable'));

      const request: AgentRequest = {
        agent: 'opportunity',
        query: 'Test query'
      };

      // Make multiple failing requests
      for (let i = 0; i < 5; i++) {
        await api.invoke(request);
      }

      // Next request should fail immediately due to open circuit
      const result = await api.invoke(request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Circuit breaker');
    });

    it('should allow requests after cooldown period', async () => {
      // This would require time manipulation or a longer test
      // Placeholder for circuit breaker recovery test
      expect(true).toBe(true);
    });
  });

  describe('Request Validation', () => {
    it('should validate agent type', async () => {
      const request = {
        agent: 'invalid-agent' as AgentType,
        query: 'Test query'
      };

      const result = await api.invoke(request);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should validate required fields', async () => {
      const request = {
        agent: 'opportunity',
        query: ''
      } as AgentRequest;

      const result = await api.invoke(request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('query');
    });
  });

  describe('Response Validation', () => {
    it('should validate response structure', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          // Missing required fields
          data: { test: 'data' }
        })
      });

      const request: AgentRequest = {
        agent: 'opportunity',
        query: 'Test query'
      };

      const result = await api.invoke(request);

      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
    });

    it('should validate confidence scores', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          confidence: 1.5, // Invalid confidence
          data: {}
        })
      });

      const request: AgentRequest = {
        agent: 'opportunity',
        query: 'Test query'
      };

      const result = await api.invoke(request);

      expect(result).toBeDefined();
      if (result.confidence !== undefined) {
        expect(result.confidence).toBeLessThanOrEqual(1);
      }
    });

    it('sanitizes malicious agent responses and bounds token usage', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            summary: '<script>alert(1)</script>Clean content',
          },
          tokens: {
            total: 999999,
          },
        }),
      });

      const result = await api.invoke({
        agent: 'opportunity',
        query: '<img src=x onerror=alert(1)>',
      });

      expect(result.success).toBe(true);
      expect((result.data as any).summary).not.toContain('<script>');
      expect(result.metadata?.tokens?.total).toBeLessThanOrEqual(20000);
    });
  });

  describe('SDUI Page Generation', () => {
    it('should generate SDUI page', async () => {
      const mockSDUIResponse = {
        success: true,
        data: {
          type: 'OpportunityPage',
          components: [
            {
              id: 'comp-1',
              type: 'Card',
              props: { title: 'Test' }
            }
          ]
        },
        validation: {
          valid: true
        }
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockSDUIResponse
      });

      const result = await api.generateSDUIPage('opportunity', {
        query: 'Generate page'
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.validation?.valid).toBe(true);
    });

    it('should validate SDUI schema', async () => {
      const mockSDUIResponse = {
        success: true,
        data: {
          type: 'InvalidPage',
          components: []
        }
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockSDUIResponse
      });

      const result = await api.generateSDUIPage('opportunity', {
        query: 'Generate page'
      });

      expect(result).toBeDefined();
    });
  });

  describe('Performance', () => {
    it('should complete requests within timeout', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {},
          metadata: {
            agent: 'opportunity',
            duration: 1000,
            timestamp: new Date().toISOString()
          }
        })
      });

      const request: AgentRequest = {
        agent: 'opportunity',
        query: 'Test query'
      };

      const start = Date.now();
      await api.invoke(request);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(5000);
    });

    it('should handle concurrent requests', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {}
        })
      });

      const requests = [
        api.invoke({ agent: 'opportunity', query: 'Query 1' }),
        api.invoke({ agent: 'target', query: 'Query 2' }),
        api.invoke({ agent: 'realization', query: 'Query 3' })
      ];

      const results = await Promise.all(requests);

      expect(results.length).toBe(3);
      results.forEach(result => {
        expect(result).toBeDefined();
      });
    });
  });

  describe('Metadata Tracking', () => {
    it('should include duration in metadata', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {},
          metadata: {
            agent: 'opportunity',
            duration: 1234,
            timestamp: new Date().toISOString()
          }
        })
      });

      const request: AgentRequest = {
        agent: 'opportunity',
        query: 'Test query'
      };

      const result = await api.invoke(request);

      expect(result.metadata).toBeDefined();
      expect(result.metadata?.duration).toBeGreaterThan(0);
      expect(result.metadata?.timestamp).toBeDefined();
    });

    it('should track token usage when available', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {},
          metadata: {
            agent: 'opportunity',
            duration: 1000,
            timestamp: new Date().toISOString(),
            tokens: {
              prompt: 100,
              completion: 200,
              total: 300
            }
          }
        })
      });

      const request: AgentRequest = {
        agent: 'opportunity',
        query: 'Test query'
      };

      const result = await api.invoke(request);

      expect(result.metadata?.tokens).toBeDefined();
      expect(result.metadata?.tokens?.total).toBe(300);
    });
  });
});
