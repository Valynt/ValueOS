/**
 * UnifiedAgentAPI Tests
 * 
 * Tests for the consolidated API layer that combines:
 * - AgentAPI (HTTP client)
 * - AgentFabricService (fabric processing)
 * - AgentQueryService (query handling)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  UnifiedAgentAPI,
  getUnifiedAgentAPI,
  resetUnifiedAgentAPI,
  UnifiedAgentRequest,
  UnifiedAgentResponse,
} from '../UnifiedAgentAPI';

// Mock fetch
global.fetch = vi.fn();

// Mock dependencies
vi.mock('../CircuitBreaker', () => ({
  CircuitBreakerManager: vi.fn().mockImplementation(() => ({
    execute: vi.fn().mockImplementation((key, fn) => fn()),
    getState: vi.fn().mockReturnValue({ state: 'closed', failure_count: 0 }),
    reset: vi.fn(),
    exportState: vi.fn().mockReturnValue({}),
  })),
}));

vi.mock('../AgentRegistry', () => ({
  AgentRegistry: vi.fn().mockImplementation(() => ({
    registerAgent: vi.fn().mockImplementation((reg) => ({
      ...reg,
      load: 0,
      status: 'healthy',
      last_heartbeat: Date.now(),
      consecutive_failures: 0,
      sticky_sessions: new Set(),
    })),
    getAgent: vi.fn().mockReturnValue(null),
  })),
}));

vi.mock('../AgentAuditLogger', () => ({
  getAuditLogger: vi.fn().mockReturnValue({
    log: vi.fn().mockResolvedValue(undefined),
  }),
  logAgentResponse: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../sdui/schema', () => ({
  validateSDUISchema: vi.fn().mockReturnValue({ success: true }),
}));

describe('UnifiedAgentAPI', () => {
  let api: UnifiedAgentAPI;

  beforeEach(() => {
    resetUnifiedAgentAPI();
    api = new UnifiedAgentAPI();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Singleton Pattern', () => {
    it('should return same instance from getUnifiedAgentAPI', () => {
      resetUnifiedAgentAPI();
      const instance1 = getUnifiedAgentAPI();
      const instance2 = getUnifiedAgentAPI();
      expect(instance1).toBe(instance2);
    });

    it('should create new instance after reset', () => {
      const instance1 = getUnifiedAgentAPI();
      resetUnifiedAgentAPI();
      const instance2 = getUnifiedAgentAPI();
      expect(instance1).not.toBe(instance2);
    });

    it('should accept config on first creation', () => {
      resetUnifiedAgentAPI();
      const instance = getUnifiedAgentAPI({ timeout: 5000 });
      expect(instance).toBeDefined();
    });
  });

  describe('invoke()', () => {
    it('should invoke agent and return response', async () => {
      const request: UnifiedAgentRequest = {
        agent: 'opportunity',
        query: 'Analyze this company',
        sessionId: 'session-123',
        userId: 'user-456',
      };

      const response = await api.invoke(request);

      expect(response).toHaveProperty('success');
      expect(response).toHaveProperty('metadata');
      expect(response.metadata?.agent).toBe('opportunity');
      expect(response.metadata?.traceId).toBeDefined();
    });

    it('should include traceId from request if provided', async () => {
      const request: UnifiedAgentRequest = {
        agent: 'opportunity',
        query: 'Test',
        traceId: 'custom-trace-123',
      };

      const response = await api.invoke(request);
      expect(response.metadata?.traceId).toBe('custom-trace-123');
    });

    it('should generate traceId if not provided', async () => {
      const request: UnifiedAgentRequest = {
        agent: 'opportunity',
        query: 'Test',
      };

      const response = await api.invoke(request);
      expect(response.metadata?.traceId).toBeDefined();
      expect(response.metadata?.traceId.length).toBeGreaterThan(0);
    });

    it('should handle errors gracefully', async () => {
      // Create API that will fail
      const failingApi = new UnifiedAgentAPI();
      vi.spyOn(failingApi as any, 'executeAgentRequest').mockRejectedValue(
        new Error('Network error')
      );

      const response = await failingApi.invoke({
        agent: 'opportunity',
        query: 'Test',
      });

      expect(response.success).toBe(false);
      expect(response.error).toBe('Network error');
    });

    it('should measure duration', async () => {
      const response = await api.invoke({
        agent: 'opportunity',
        query: 'Test',
      });

      expect(response.metadata?.duration).toBeDefined();
      expect(response.metadata?.duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('callAgent()', () => {
    it('should be alias for invoke with simplified interface', async () => {
      const invokeSpy = vi.spyOn(api, 'invoke');

      await api.callAgent('opportunity', 'Test query', { tenantId: 'test' });

      expect(invokeSpy).toHaveBeenCalledWith({
        agent: 'opportunity',
        query: 'Test query',
        context: { tenantId: 'test' },
      });
    });
  });

  describe('generateSDUIPage()', () => {
    it('should generate SDUI page for agent', async () => {
      const response = await api.generateSDUIPage(
        'opportunity',
        'Generate value case'
      );

      expect(response).toHaveProperty('success');
      expect(response.metadata?.agent).toBe('opportunity');
    });

    it('should include outputType parameter', async () => {
      const invokeSpy = vi.spyOn(api, 'invoke');

      await api.generateSDUIPage('opportunity', 'Test');

      expect(invokeSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          parameters: { outputType: 'sdui' },
        })
      );
    });
  });

  describe('checkAgentHealth()', () => {
    it('should return health status for agent', async () => {
      const health = await api.checkAgentHealth('opportunity');

      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('latencyMs');
      expect(health).toHaveProperty('circuitBreakerState');
    });

    it('should return healthy status on success', async () => {
      const health = await api.checkAgentHealth('opportunity');
      expect(health.status).toBe('healthy');
    });

    it('should return offline status on failure', async () => {
      const failingApi = new UnifiedAgentAPI();
      vi.spyOn(failingApi, 'invoke').mockRejectedValue(new Error('Failed'));

      const health = await failingApi.checkAgentHealth('opportunity');
      expect(health.status).toBe('offline');
    });

    it('should measure latency', async () => {
      const health = await api.checkAgentHealth('opportunity');
      expect(health.latencyMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Circuit Breaker Management', () => {
    it('should get circuit breaker status', () => {
      const status = api.getCircuitBreakerStatus('opportunity');
      expect(status).toBeDefined();
    });

    it('should reset circuit breaker', () => {
      expect(() => api.resetCircuitBreaker('opportunity')).not.toThrow();
    });

    it('should get all circuit breaker states', () => {
      const states = api.getAllCircuitBreakerStates();
      expect(states).toBeDefined();
      expect(typeof states).toBe('object');
    });
  });

  describe('Registry Management', () => {
    it('should register agent', () => {
      const registration = {
        id: 'test-agent',
        name: 'Test Agent',
        lifecycle_stage: 'opportunity' as const,
        capabilities: ['analyze'],
      };

      const record = api.registerAgent(registration);
      expect(record.id).toBe('test-agent');
      expect(record.status).toBe('healthy');
    });

    it('should get agent by ID', () => {
      const agent = api.getAgent('test-agent');
      // Returns null/undefined because agent not registered
      expect(agent).toBeFalsy();
    });

    it('should provide access to registry', () => {
      const registry = api.getRegistry();
      expect(registry).toBeDefined();
    });
  });

  describe('Route Type Determination', () => {
    it('should use mock for development by default', async () => {
      const determineRouteType = (api as any).determineRouteType.bind(api);
      expect(determineRouteType('opportunity')).toBe('mock');
    });

    it('should use HTTP when baseUrl is configured', async () => {
      const configuredApi = new UnifiedAgentAPI({
        baseUrl: 'http://localhost:8080',
      });
      const determineRouteType = (configuredApi as any).determineRouteType.bind(configuredApi);
      expect(determineRouteType('opportunity')).toBe('http');
    });
  });

  describe('Mock Agent Execution', () => {
    it('should return mock response for opportunity agent', async () => {
      const response = await api.invoke({
        agent: 'opportunity',
        query: 'Test',
      });

      expect(response.success).toBe(true);
      expect(response.data).toHaveProperty('painPoints');
      expect(response.data).toHaveProperty('recommendations');
    });

    it('should return mock response for financial-modeling agent', async () => {
      const response = await api.invoke({
        agent: 'financial-modeling',
        query: 'Calculate ROI',
      });

      expect(response.success).toBe(true);
      expect(response.data).toHaveProperty('roi');
      expect(response.data).toHaveProperty('npv');
    });

    it('should return generic response for unknown agents', async () => {
      const response = await api.invoke({
        agent: 'unknown-agent' as any,
        query: 'Test',
      });

      expect(response.success).toBe(true);
      expect(response.data).toHaveProperty('message');
    });
  });

  describe('HTTP Agent Execution', () => {
    beforeEach(() => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          success: true,
          data: { result: 'test' },
        }),
      });
    });

    it('should make HTTP request with correct URL', async () => {
      const httpApi = new UnifiedAgentAPI({ baseUrl: 'http://localhost:8080' });

      await httpApi.invoke({
        agent: 'opportunity',
        query: 'Test',
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8080/agents/opportunity/invoke',
        expect.any(Object)
      );
    });

    it('should include trace ID in headers', async () => {
      const httpApi = new UnifiedAgentAPI({ baseUrl: 'http://localhost:8080' });

      await httpApi.invoke({
        agent: 'opportunity',
        query: 'Test',
        traceId: 'trace-123',
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Trace-ID': 'trace-123',
          }),
        })
      );
    });

    it('should handle HTTP errors', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const httpApi = new UnifiedAgentAPI({ baseUrl: 'http://localhost:8080' });
      const response = await httpApi.invoke({
        agent: 'opportunity',
        query: 'Test',
      });

      expect(response.success).toBe(false);
      expect(response.error).toContain('500');
    });
  });

  describe('Configuration', () => {
    it('should use default timeout', () => {
      const defaultApi = new UnifiedAgentAPI();
      expect((defaultApi as any).config.timeout).toBe(30000);
    });

    it('should allow custom timeout', () => {
      const customApi = new UnifiedAgentAPI({ timeout: 5000 });
      expect((customApi as any).config.timeout).toBe(5000);
    });

    it('should enable circuit breaker by default', () => {
      const defaultApi = new UnifiedAgentAPI();
      expect((defaultApi as any).config.enableCircuitBreaker).toBe(true);
    });

    it('should allow disabling circuit breaker', () => {
      const customApi = new UnifiedAgentAPI({ enableCircuitBreaker: false });
      expect((customApi as any).config.enableCircuitBreaker).toBe(false);
    });
  });
});
