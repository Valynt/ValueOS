/**
 * UnifiedAgentAPI Tests
 * 
 * Tests for the consolidated API layer that combines:
 * - AgentAPI (HTTP client)
 * - AgentFabricService (fabric processing)
 * - AgentQueryService (query handling)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __setEnvSourceForTests, getEnvVar } from '../../lib/env';
import {
  getUnifiedAgentAPI,
  resetUnifiedAgentAPI,
  UnifiedAgentAPI,
  UnifiedAgentRequest,
} from "../value/UnifiedAgentAPI.js";
import { GovernanceVetoError, HardenedAgentRunner } from "../../lib/agent-fabric/hardening/index.js";

vi.mock("../../lib/supabase.js");

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
  let originalEnv: Record<string, string | undefined>;

  beforeEach(() => {
    originalEnv = {
      NODE_ENV: getEnvVar('NODE_ENV'),
      MODE: getEnvVar('MODE'),
      VITE_AGENT_API_URL: getEnvVar('VITE_AGENT_API_URL'),
      AGENT_API_URL: getEnvVar('AGENT_API_URL'),
    };
    resetUnifiedAgentAPI();
    api = new UnifiedAgentAPI();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
    __setEnvSourceForTests(originalEnv);
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
      __setEnvSourceForTests({ NODE_ENV: 'development' });
      const devApi = new UnifiedAgentAPI();
      const determineRouteType = (devApi as any).determineRouteType.bind(devApi);
      expect(determineRouteType('opportunity')).toBe('mock');
    });

    it('should disallow mock routing in production without configuration', async () => {
      __setEnvSourceForTests({ NODE_ENV: 'production' });
      const prodApi = new UnifiedAgentAPI();
      const determineRouteType = (prodApi as any).determineRouteType.bind(prodApi);
      expect(() => determineRouteType('opportunity')).toThrow(
        'Mock routing is disabled in production. Configure baseUrl or agent endpoints.'
      );
    });

    it('should use HTTP when baseUrl is configured', async () => {
      const configuredApi = new UnifiedAgentAPI({
        baseUrl: 'http://localhost:8080',
      });
      const determineRouteType = (configuredApi as any).determineRouteType.bind(configuredApi);
      expect(determineRouteType('opportunity')).toBe('http');
    });

    it('should use HTTP when env baseUrl is configured', async () => {
      __setEnvSourceForTests({
        NODE_ENV: 'production',
        VITE_AGENT_API_URL: 'https://agents.example.com/api/agents',
      });
      const envApi = new UnifiedAgentAPI();
      const determineRouteType = (envApi as any).determineRouteType.bind(envApi);
      expect(determineRouteType('opportunity')).toBe('http');
    });

    it('should return configuration error in production invoke without endpoints', async () => {
      __setEnvSourceForTests({ NODE_ENV: 'production' });
      const prodApi = new UnifiedAgentAPI();
      const response = await prodApi.invoke({
        agent: 'opportunity',
        query: 'Test',
      });

      expect(response.success).toBe(false);
      expect(response.error).toBe(
        'Mock routing is disabled in production. Configure baseUrl or agent endpoints.'
      );
    });

    it('should invoke via env baseUrl in production', async () => {
      __setEnvSourceForTests({
        NODE_ENV: 'production',
        VITE_AGENT_API_URL: 'https://agents.example.com/api/agents',
      });
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          success: true,
          data: { result: 'test' },
        }),
      });

      const prodApi = new UnifiedAgentAPI();
      await prodApi.invoke({
        agent: 'opportunity',
        query: 'Test',
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://agents.example.com/api/agents/opportunity/invoke',
        expect.any(Object)
      );
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

  describe('Local hardening execution', () => {
    it('uses HardenedAgentRunner for financial/commitment/narrative/external-facing agents', async () => {
      __setEnvSourceForTests({ NODE_ENV: 'development', VITE_AGENT_API_URL: '', AGENT_API_URL: '' });
      const runSpy = vi.spyOn(HardenedAgentRunner.prototype, 'run').mockResolvedValue({
        output: { roi: 0.2 },
        confidence: {
          overall: 0.81,
          evidence_quality: 0.8,
          grounding: 0.8,
          label: 'high',
        },
        cache_hit: false,
        attempts: 1,
        trace_id: 'trace-1',
        token_usage: {
          input_tokens: 10,
          output_tokens: 10,
          total_tokens: 20,
          estimated_cost_usd: 0.01,
        },
        governance: {
          verdict: 'approved',
          decided_by: 'policy',
          decided_at: new Date().toISOString(),
        },
        safety: {
          verdict: 'passed',
          injection_signals: [],
          tool_violations: [],
          pii_detected: false,
          schema_valid: true,
          schema_errors: [],
          sanitized_prompt: 'safe',
        },
      } as any);

      const agentExecute = vi.fn().mockResolvedValue({
        agent_id: 'financial-modeling',
        agent_type: 'financial-modeling',
        lifecycle_stage: 'MODELING',
        status: 'success',
        result: { roi: 0.2 },
        confidence: 'high',
        metadata: {
          execution_time_ms: 1,
          model_version: 'v1',
          timestamp: new Date().toISOString(),
        },
      });

      const apiWithFactory = new UnifiedAgentAPI({
        agentFactory: {
          hasFabricAgent: () => true,
          create: () => ({
            lifecycleStage: 'MODELING',
            execute: agentExecute,
          }),
        } as any,
      });

      const response = await apiWithFactory.invoke({
        agent: 'financial-modeling',
        query: 'Calculate ROI',
        userId: 'user-1',
        sessionId: 'session-1',
        context: { organization_id: 'org-1' },
      });

      expect(response.success).toBe(true);
      expect(runSpy).toHaveBeenCalledOnce();
    });

    it('maps GovernanceVetoError to deterministic failure payload', async () => {
      __setEnvSourceForTests({ NODE_ENV: 'development', VITE_AGENT_API_URL: '', AGENT_API_URL: '' });
      vi.spyOn(HardenedAgentRunner.prototype, 'run').mockRejectedValue(
        new GovernanceVetoError('communicator', 'pending_human', 'Needs approval', 'cp-1')
      );

      const apiWithFactory = new UnifiedAgentAPI({
        agentFactory: {
          hasFabricAgent: () => true,
          create: () => ({
            lifecycleStage: 'COMMUNICATE',
            execute: vi.fn().mockResolvedValue({}),
          }),
        } as any,
      });

      const response = await apiWithFactory.invoke({
        agent: 'communicator',
        query: 'Draft customer-ready summary',
        userId: 'user-1',
        sessionId: 'session-1',
        context: { organization_id: 'org-1' },
      });

      expect(response.success).toBe(false);
      expect(response.status).toBe('failure');
      expect(response.data).toMatchObject({
        governance_verdict: 'pending_human',
        governance_checkpoint_id: 'cp-1',
      });
    });
  });
});
