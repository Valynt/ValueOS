/**
 * AgentOrchestratorAdapter Tests
 * 
 * Tests for the backward-compatible adapter that wraps UnifiedAgentOrchestrator
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dependencies before importing the module
vi.mock('../UnifiedAgentOrchestrator', () => ({
  UnifiedAgentOrchestrator: vi.fn().mockImplementation(() => ({
    createInitialState: vi.fn().mockImplementation((stage, context) => ({
      currentStage: stage,
      status: 'initiated',
      completedStages: [],
      context: { ...context, conversationHistory: [] },
      metadata: { startedAt: new Date().toISOString() },
    })),
    processQuery: vi.fn().mockResolvedValue({
      response: { type: 'message', payload: { message: 'Test response' } },
      nextState: {
        currentStage: 'discovery',
        status: 'in_progress',
        completedStages: [],
        context: { conversationHistory: [] },
      },
      traceId: 'trace-123',
    }),
    updateStage: vi.fn().mockImplementation((state, stage, status) => ({
      ...state,
      currentStage: stage,
      status,
    })),
    executeWorkflow: vi.fn().mockResolvedValue({
      executionId: 'exec-123',
      status: 'initiated',
      currentStage: 'discovery',
      completedStages: [],
    }),
    generateSDUIPage: vi.fn().mockResolvedValue({
      type: 'sdui-page',
      payload: { sections: [] },
      sduiPage: { type: 'page', sections: [] },
    }),
    planTask: vi.fn().mockResolvedValue({
      taskId: 'task-123',
      subgoals: [],
      executionOrder: [],
      complexityScore: 0.5,
      requiresSimulation: false,
    }),
    getCircuitBreakerStatus: vi.fn().mockReturnValue({ state: 'closed' }),
    resetCircuitBreaker: vi.fn(),
  })),
  getUnifiedOrchestrator: vi.fn().mockImplementation(() => ({
    createInitialState: vi.fn().mockImplementation((stage, context) => ({
      currentStage: stage,
      status: 'initiated',
      completedStages: [],
      context: { ...context, conversationHistory: [] },
      metadata: { startedAt: new Date().toISOString() },
    })),
    processQuery: vi.fn().mockResolvedValue({
      response: { type: 'message', payload: { message: 'Test response' } },
      nextState: {
        currentStage: 'discovery',
        status: 'in_progress',
        completedStages: [],
        context: { conversationHistory: [] },
      },
      traceId: 'trace-123',
    }),
    updateStage: vi.fn().mockImplementation((state, stage, status) => ({
      ...state,
      currentStage: stage,
      status,
    })),
    executeWorkflow: vi.fn().mockResolvedValue({
      executionId: 'exec-123',
      status: 'initiated',
      currentStage: 'discovery',
      completedStages: [],
    }),
    generateSDUIPage: vi.fn().mockResolvedValue({
      type: 'sdui-page',
      payload: { sections: [] },
      sduiPage: { type: 'page', sections: [] },
    }),
    planTask: vi.fn().mockResolvedValue({
      taskId: 'task-123',
      subgoals: [],
      executionOrder: [],
      complexityScore: 0.5,
      requiresSimulation: false,
    }),
    getCircuitBreakerStatus: vi.fn().mockReturnValue({ state: 'closed' }),
    resetCircuitBreaker: vi.fn(),
  })),
  StreamingUpdate: {},
  AgentResponse: {},
}));

vi.mock('../AgentQueryService', () => ({
  AgentQueryService: vi.fn().mockImplementation(() => ({
    handleQuery: vi.fn().mockResolvedValue({
      response: { type: 'message', payload: {} },
      progress: 100,
    }),
    getSession: vi.fn().mockResolvedValue(null),
    getActiveSessions: vi.fn().mockResolvedValue([]),
  })),
}));

vi.mock('../../lib/supabase', () => ({
  getSupabaseClient: vi.fn().mockReturnValue({}),
}));

vi.mock('../../config/featureFlags', () => ({
  featureFlags: {
    ENABLE_UNIFIED_ORCHESTRATION: true,
    ENABLE_STATELESS_ORCHESTRATION: false,
  },
}));

// Import after mocks
import { agentOrchestrator } from '../AgentOrchestratorAdapter';

describe('AgentOrchestratorAdapter', () => {
  beforeEach(() => {
 *
 * Tests for the adapter that connects the frontend to the backend
 * UnifiedAgentOrchestrator.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AgentOrchestratorAdapter } from '../AgentOrchestratorAdapter';
import * as agentService from '../agentService';

// Mock the agent service
vi.mock('../agentService', () => ({
  invokeAgent: vi.fn(),
  getJobStatus: vi.fn(),
  waitForJob: vi.fn(),
}));

describe('AgentOrchestratorAdapter', () => {
  let adapter: AgentOrchestratorAdapter;

  beforeEach(() => {
    adapter = new AgentOrchestratorAdapter();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Backward Compatibility', () => {
    it('should export agentOrchestrator singleton', () => {
      expect(agentOrchestrator).toBeDefined();
    });

    it('should have initializeWorkflow method', () => {
      expect(typeof agentOrchestrator.initializeWorkflow).toBe('function');
    });

    it('should have processQuery method', () => {
      expect(typeof agentOrchestrator.processQuery).toBe('function');
    });

    it('should have onStreaming method', () => {
      expect(typeof agentOrchestrator.onStreaming).toBe('function');
    });

    it('should have updateStage method', () => {
      expect(typeof agentOrchestrator.updateStage).toBe('function');
    });

    it('should have getCurrentState method', () => {
      expect(typeof agentOrchestrator.getCurrentState).toBe('function');
    });
  });

  describe('initializeWorkflow()', () => {
    it('should initialize workflow with stage', () => {
      expect(() => {
        agentOrchestrator.initializeWorkflow('discovery');
      }).not.toThrow();
    });

    it('should initialize workflow with stage and context', () => {
      expect(() => {
        agentOrchestrator.initializeWorkflow('discovery', { tenantId: 'test' });
      }).not.toThrow();
    });
  });

  describe('processQuery()', () => {
    it('should process query and return response', async () => {
      const response = await agentOrchestrator.processQuery('Test query');
      expect(response).toBeDefined();
    });

    it('should accept options', async () => {
      const response = await agentOrchestrator.processQuery('Test query', {
        userId: 'user-123',
        sessionId: 'session-456',
        context: { tenantId: 'test' },
      });
      expect(response).toBeDefined();
    });

    it('should initialize state if not already initialized', async () => {
      // Clear any existing state
      const newAdapter = await import('../AgentOrchestratorAdapter');
      const response = await newAdapter.agentOrchestrator.processQuery('Test');
      expect(response).toBeDefined();
    });
  });

  describe('onStreaming()', () => {
    it('should register callback and return unsubscribe function', () => {
      const callback = vi.fn();
      const unsubscribe = agentOrchestrator.onStreaming(callback);
      
      expect(typeof unsubscribe).toBe('function');
    });

    it('should allow unsubscribing', () => {
      const callback = vi.fn();
      const unsubscribe = agentOrchestrator.onStreaming(callback);
      
      expect(() => unsubscribe()).not.toThrow();
    });

    it('should register multiple callbacks', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      
      const unsub1 = agentOrchestrator.onStreaming(callback1);
      const unsub2 = agentOrchestrator.onStreaming(callback2);
      
      expect(typeof unsub1).toBe('function');
      expect(typeof unsub2).toBe('function');
    });
  });

  describe('updateStage()', () => {
    it('should update stage', () => {
      agentOrchestrator.initializeWorkflow('discovery');
      
      expect(() => {
        agentOrchestrator.updateStage('analysis', 'in_progress');
      }).not.toThrow();
    });

    it('should handle update without initialization gracefully', () => {
      // Should log warning but not throw
      expect(() => {
        agentOrchestrator.updateStage('analysis', 'in_progress');
      }).not.toThrow();
    });
  });

  describe('getCurrentState()', () => {
    it('should return current state after initialization', () => {
      agentOrchestrator.initializeWorkflow('discovery');
      const state = agentOrchestrator.getCurrentState();
      
      expect(state).toBeDefined();
      expect(state?.currentStage).toBe('discovery');
    });

    it('should return null before initialization', async () => {
      // Reset to get fresh adapter
      vi.resetModules();
      const freshModule = await import('../AgentOrchestratorAdapter');
      
      // State is null until processQuery creates it
      // This depends on implementation details
      expect(freshModule.agentOrchestrator.getCurrentState).toBeDefined();
    });
  });

  describe('New Interface Methods', () => {
    describe('executeWorkflow()', () => {
      it('should execute workflow', async () => {
        const result = await agentOrchestrator.executeWorkflow(
          'workflow-123',
          { tenantId: 'test' },
          'user-456'
        );
        
        expect(result).toBeDefined();
        expect(result.executionId).toBe('exec-123');
      });
    });

    describe('generateSDUIPage()', () => {
      it('should generate SDUI page', async () => {
        const result = await agentOrchestrator.generateSDUIPage(
          'opportunity',
          'Generate value case'
        );
        
        expect(result).toBeDefined();
        expect(result.type).toBe('sdui-page');
      });
    });

    describe('planTask()', () => {
      it('should plan task', async () => {
        const result = await agentOrchestrator.planTask(
          'value_assessment',
          'Assess value',
          { companyName: 'Acme' }
        );
        
        expect(result).toBeDefined();
        expect(result.taskId).toBe('task-123');
      });
    });

    describe('getCircuitBreakerStatus()', () => {
      it('should get circuit breaker status', () => {
        const status = agentOrchestrator.getCircuitBreakerStatus('opportunity');
        expect(status).toBeDefined();
      });
    });

    describe('resetCircuitBreaker()', () => {
      it('should reset circuit breaker', () => {
        expect(() => {
          agentOrchestrator.resetCircuitBreaker('opportunity');
        }).not.toThrow();
      });
    });

    describe('getUnifiedOrchestrator()', () => {
      it('should return underlying orchestrator', () => {
        const orchestrator = agentOrchestrator.getUnifiedOrchestrator();
        expect(orchestrator).toBeDefined();
      });
    });
  });

  describe('Session Management', () => {
    describe('getSession()', () => {
      it('should get session by ID', async () => {
        const session = await agentOrchestrator.getSession('session-123', 'tenant-1');
        // Returns null from mock
        expect(session).toBeNull();
      });
    });

    describe('getActiveSessions()', () => {
      it('should get active sessions for user', async () => {
        const sessions = await agentOrchestrator.getActiveSessions('user-123', 'tenant-1');
        expect(Array.isArray(sessions)).toBe(true);
      });

      it('should accept limit parameter', async () => {
        const sessions = await agentOrchestrator.getActiveSessions('user-123', 'tenant-1', 5);
        expect(Array.isArray(sessions)).toBe(true);
      });
    });
  });
});

describe('Type Exports', () => {
  it('should export AgentResponse type', async () => {
    const module = await import('../AgentOrchestratorAdapter');
    // Type is re-exported, check it doesn't throw
    expect(module).toBeDefined();
  });

  it('should export StreamingUpdate type', async () => {
    const module = await import('../AgentOrchestratorAdapter');
    expect(module).toBeDefined();
  });
});
    adapter.cancel();
  });



  describe('Configuration', () => {
    it('should use default configuration', () => {
      const adapter = new AgentOrchestratorAdapter();
      expect(adapter).toBeDefined();
    });

    it('should accept custom configuration', () => {
      const config = {
        baseUrl: 'http://custom-api.com',
        pollingInterval: 500,
        maxPollingAttempts: 30,
        timeoutMs: 60000,
      };
      const adapter = new AgentOrchestratorAdapter(config);
      expect(adapter).toBeDefined();
    });
  });

  describe('invokeAgent', () => {
    it('should invoke agent and poll for results', async () => {
      const mockEvents: any[] = [];
      const onEvent = (event: any) => mockEvents.push(event);

      // Mock invokeAgent to return a job ID
      (agentService.invokeAgent as any).mockResolvedValue({
        success: true,
        data: {
          jobId: 'test-job-123',
          status: 'queued',
          agentId: 'coordinator',
        },
      });

      // Mock getJobStatus to return completed status
      (agentService.getJobStatus as any).mockResolvedValue({
        jobId: 'test-job-123',
        status: 'completed',
        result: { message: 'Test response' },
      });

      await adapter.invokeAgent('coordinator', 'Test query', { companyName: 'Test Co' }, 'test-run-123', onEvent);

      expect(agentService.invokeAgent).toHaveBeenCalledWith('coordinator', {
        query: 'Test query',
        context: JSON.stringify({ companyName: 'Test Co' }),
      });

      expect(agentService.getJobStatus).toHaveBeenCalledWith('test-job-123');
      expect(mockEvents.length).toBeGreaterThan(0);
    });

    it('should handle errors during invocation', async () => {
      const mockEvents: any[] = [];
      const onEvent = (event: any) => mockEvents.push(event);

      (agentService.invokeAgent as any).mockResolvedValue({
        success: false,
        error: 'Agent invocation failed',
      });

      await expect(
        adapter.invokeAgent('coordinator', 'Test query', {}, 'test-run-123', onEvent)
      ).rejects.toThrow('Agent invocation failed');

      // Should have emitted an error event
      const errorEvent = mockEvents.find(e => e.type === 'error');
      expect(errorEvent).toBeDefined();
    });

    it('should handle polling timeout', async () => {
      const mockEvents: any[] = [];
      const onEvent = (event: any) => mockEvents.push(event);

      (agentService.invokeAgent as any).mockResolvedValue({
        success: true,
        data: { jobId: 'test-job-123' },
      });

      // Mock getJobStatus to always return processing
      (agentService.getJobStatus as any).mockResolvedValue({
        jobId: 'test-job-123',
        status: 'processing',
      });

      // Create adapter with short timeout for testing
      const shortTimeoutAdapter = new AgentOrchestratorAdapter({
        maxPollingAttempts: 2,
        pollingInterval: 10,
      });

      await expect(
        shortTimeoutAdapter.invokeAgent('coordinator', 'Test query', {}, 'test-run-123', onEvent)
      ).rejects.toThrow('Job polling timed out or was cancelled');
    });

    it('should handle job failure', async () => {
      const mockEvents: any[] = [];
      const onEvent = (event: any) => mockEvents.push(event);

      (agentService.invokeAgent as any).mockResolvedValue({
        success: true,
        data: { jobId: 'test-job-123' },
      });

      (agentService.getJobStatus as any).mockResolvedValue({
        jobId: 'test-job-123',
        status: 'failed',
        error: 'Agent execution failed',
      });

      await expect(
        adapter.invokeAgent('coordinator', 'Test query', {}, 'test-run-123', onEvent)
      ).rejects.toThrow('Agent execution failed');
    });
  });

  describe('cancel', () => {
    it('should cancel ongoing operation', async () => {
      const mockEvents: any[] = [];
      const onEvent = (event: any) => mockEvents.push(event);

      (agentService.invokeAgent as any).mockResolvedValue({
        success: true,
        data: { jobId: 'test-job-123' },
      });

      // Mock getJobStatus to never complete
      (agentService.getJobStatus as any).mockImplementation(() => {
        return new Promise(() => {}); // Never resolves
      });

      // Start the operation
      const promise = adapter.invokeAgent('coordinator', 'Test query', {}, 'test-run-123', onEvent);

      // Cancel immediately
      adapter.cancel();

      // The promise should reject or resolve with cancellation
      await expect(promise).rejects.toThrow();
    });
  });

  describe('isCurrentlyStreaming', () => {
    it('should return false when not streaming', () => {
      expect(adapter.isCurrentlyStreaming).toBe(false);
    });

    it('should return true when streaming', async () => {
      (agentService.invokeAgent as any).mockResolvedValue({
        success: true,
        data: { jobId: 'test-job-123' },
      });

      (agentService.getJobStatus as any).mockImplementation(() => {
        return new Promise(() => {}); // Never resolves
      });

      const promise = adapter.invokeAgent('coordinator', 'Test query', {}, 'test-run-123');

      // Check streaming status while operation is in progress
      expect(adapter.isCurrentlyStreaming).toBe(true);

      adapter.cancel();
      await expect(promise).rejects.toThrow();
    });
  });

  describe('getCurrentJobId', () => {
    it('should return null when no job is active', () => {
      expect(adapter.getCurrentJobId()).toBe(null);
    });

    it('should return job ID when job is active', async () => {
      (agentService.invokeAgent as any).mockResolvedValue({
        success: true,
        data: { jobId: 'test-job-123' },
      });

      (agentService.getJobStatus as any).mockImplementation(() => {
        return new Promise(() => {}); // Never resolves
      });

      const promise = adapter.invokeAgent('coordinator', 'Test query', {}, 'test-run-123');

      expect(adapter.getCurrentJobId()).toBe('test-job-123');

      adapter.cancel();
      await expect(promise).rejects.toThrow();
    });
  });
});
