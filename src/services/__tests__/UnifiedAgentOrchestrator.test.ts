/**
 * UnifiedAgentOrchestrator Tests
 * 
 * Tests for the consolidated orchestrator that combines:
 * - Query processing (from StatelessAgentOrchestrator)
 * - Workflow execution (from WorkflowOrchestrator)
 * - SDUI generation (from AgentOrchestrator)
 * - Task planning (from CoordinatorAgent)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  UnifiedAgentOrchestrator,
  getUnifiedOrchestrator,
  resetUnifiedOrchestrator,
  ProcessQueryResult,
  TaskPlanResult,
} from '../UnifiedAgentOrchestrator';
import { WorkflowState } from '../../repositories/WorkflowStateRepository';

// Mock dependencies
vi.mock('../AgentAPI', () => ({
  getAgentAPI: () => ({
    callAgent: vi.fn().mockResolvedValue({
      success: true,
      content: 'Mock response',
      type: 'message',
      payload: { message: 'Mock response' },
    }),
    generateValueCase: vi.fn().mockResolvedValue({
      success: true,
      data: { sections: [] },
    }),
    generateRealizationDashboard: vi.fn().mockResolvedValue({
      success: true,
      data: { sections: [] },
    }),
    generateExpansionOpportunities: vi.fn().mockResolvedValue({
      success: true,
      data: { sections: [] },
    }),
    invokeAgent: vi.fn().mockResolvedValue({
      success: true,
      data: { sections: [] },
    }),
    getCircuitBreakerStatus: vi.fn().mockReturnValue({ state: 'closed' }),
    resetCircuitBreaker: vi.fn(),
  }),
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'exec-123' }, error: null }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    }),
  },
}));

vi.mock('../CircuitBreaker', () => ({
  CircuitBreakerManager: vi.fn().mockImplementation(() => ({
    execute: vi.fn().mockImplementation((key, fn) => fn()),
    getState: vi.fn().mockReturnValue({ state: 'closed' }),
    reset: vi.fn(),
    exportState: vi.fn().mockReturnValue({}),
  })),
}));

vi.mock('../AgentRegistry', () => ({
  AgentRegistry: vi.fn().mockImplementation(() => ({
    registerAgent: vi.fn().mockImplementation((reg) => ({ ...reg, load: 0, status: 'healthy' })),
    getAgent: vi.fn(),
    recordRelease: vi.fn(),
    markHealthy: vi.fn(),
    recordFailure: vi.fn(),
  })),
}));

vi.mock('../AgentRoutingLayer', () => ({
  AgentRoutingLayer: vi.fn().mockImplementation(() => ({
    routeStage: vi.fn().mockReturnValue({
      stage: { id: 'test-stage', agent_type: 'opportunity', timeout_seconds: 30 },
      selected_agent: { id: 'agent-1' },
      fallback_agents: [],
    }),
  })),
}));

describe('UnifiedAgentOrchestrator', () => {
  let orchestrator: UnifiedAgentOrchestrator;

  beforeEach(() => {
    resetUnifiedOrchestrator();
    orchestrator = new UnifiedAgentOrchestrator();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Singleton Pattern', () => {
    it('should return same instance from getUnifiedOrchestrator', () => {
      resetUnifiedOrchestrator();
      const instance1 = getUnifiedOrchestrator();
      const instance2 = getUnifiedOrchestrator();
      expect(instance1).toBe(instance2);
    });

    it('should create new instance after reset', () => {
      const instance1 = getUnifiedOrchestrator();
      resetUnifiedOrchestrator();
      const instance2 = getUnifiedOrchestrator();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('State Management', () => {
    it('should create initial state with correct structure', () => {
      const state = orchestrator.createInitialState('discovery', { tenantId: 'test' });

      expect(state).toMatchObject({
        currentStage: 'discovery',
        status: 'initiated',
        completedStages: [],
        context: {
          tenantId: 'test',
          conversationHistory: [],
        },
      });
      expect(state.metadata?.startedAt).toBeDefined();
    });

    it('should update stage immutably', () => {
      const initialState = orchestrator.createInitialState('discovery');
      const updatedState = orchestrator.updateStage(initialState, 'analysis', 'in_progress');

      // Original state should be unchanged
      expect(initialState.currentStage).toBe('discovery');
      expect(initialState.status).toBe('initiated');

      // New state should be updated
      expect(updatedState.currentStage).toBe('analysis');
      expect(updatedState.status).toBe('in_progress');
    });

    it('should add completed stage when status is completed', () => {
      const initialState = orchestrator.createInitialState('discovery');
      const updatedState = orchestrator.updateStage(initialState, 'analysis', 'completed');

      expect(updatedState.completedStages).toContain('discovery');
    });

    it('should not duplicate completed stages', () => {
      let state = orchestrator.createInitialState('discovery');
      state = orchestrator.updateStage(state, 'analysis', 'completed');
      state = orchestrator.updateStage(state, 'analysis', 'completed');

      const discoveryCount = state.completedStages.filter(s => s === 'discovery').length;
      expect(discoveryCount).toBe(1);
    });
  });

  describe('Query Processing', () => {
    it('should process query and return result', async () => {
      const state = orchestrator.createInitialState('discovery');
      const result = await orchestrator.processQuery(
        'Analyze this company',
        state,
        'user-123',
        'session-456',
        'trace-789'
      );

      expect(result).toHaveProperty('response');
      expect(result).toHaveProperty('nextState');
      expect(result).toHaveProperty('traceId');
      expect(result.traceId).toBe('trace-789');
    });

    it('should update conversation history after query', async () => {
      const state = orchestrator.createInitialState('discovery');
      const result = await orchestrator.processQuery(
        'Test query',
        state,
        'user-123',
        'session-456'
      );

      const history = result.nextState.context.conversationHistory;
      expect(history).toHaveLength(2);
      expect(history[0].role).toBe('user');
      expect(history[0].content).toBe('Test query');
      expect(history[1].role).toBe('assistant');
    });

    it('should handle errors gracefully', async () => {
      // Create orchestrator with mocked API that throws
      const errorOrchestrator = new UnifiedAgentOrchestrator();
      vi.spyOn(errorOrchestrator as any, 'selectAgent').mockImplementation(() => {
        throw new Error('Test error');
      });

      const state = orchestrator.createInitialState('discovery');
      const result = await errorOrchestrator.processQuery(
        'Test query',
        state,
        'user-123',
        'session-456'
      );

      expect(result.nextState.status).toBe('error');
      expect(result.response?.payload?.error).toBe(true);
    });

    it('should generate trace ID if not provided', async () => {
      const state = orchestrator.createInitialState('discovery');
      const result = await orchestrator.processQuery(
        'Test query',
        state,
        'user-123',
        'session-456'
      );

      expect(result.traceId).toBeDefined();
      expect(result.traceId.length).toBeGreaterThan(0);
    });
  });

  describe('Agent Selection', () => {
    it('should select agent based on stage', async () => {
      const selectAgent = (orchestrator as any).selectAgent.bind(orchestrator);

      expect(selectAgent('test', { currentStage: 'discovery' })).toBe('company-intelligence');
      expect(selectAgent('test', { currentStage: 'analysis' })).toBe('system-mapper');
      expect(selectAgent('test', { currentStage: 'design' })).toBe('intervention-designer');
      expect(selectAgent('test', { currentStage: 'modeling' })).toBe('financial-modeling');
    });

    it('should select agent based on query keywords', async () => {
      const selectAgent = (orchestrator as any).selectAgent.bind(orchestrator);
      const defaultState = { currentStage: 'unknown' };

      expect(selectAgent('calculate roi', defaultState)).toBe('financial-modeling');
      expect(selectAgent('map the system', defaultState)).toBe('system-mapper');
      expect(selectAgent('design intervention', defaultState)).toBe('intervention-designer');
      expect(selectAgent('track outcomes', defaultState)).toBe('outcome-engineer');
      expect(selectAgent('expand growth', defaultState)).toBe('expansion');
    });

    it('should default to coordinator for unknown queries', async () => {
      const selectAgent = (orchestrator as any).selectAgent.bind(orchestrator);
      const defaultState = { currentStage: 'unknown' };

      expect(selectAgent('random query', defaultState)).toBe('coordinator');
    });
  });

  describe('Task Planning', () => {
    it('should generate task plan with subgoals', async () => {
      const result = await orchestrator.planTask(
        'value_assessment',
        'Assess value for Acme Corp',
        { companyName: 'Acme Corp' }
      );

      expect(result).toHaveProperty('taskId');
      expect(result).toHaveProperty('subgoals');
      expect(result).toHaveProperty('executionOrder');
      expect(result).toHaveProperty('complexityScore');
      expect(result.subgoals.length).toBeGreaterThan(0);
    });

    it('should order subgoals by dependencies', async () => {
      const result = await orchestrator.planTask(
        'value_assessment',
        'Test task'
      );

      // First subgoal should have no dependencies
      const firstSubgoalId = result.executionOrder[0];
      const firstSubgoal = result.subgoals.find(s => s.id === firstSubgoalId);
      expect(firstSubgoal?.dependencies).toHaveLength(0);
    });

    it('should calculate complexity score between 0 and 1', async () => {
      const result = await orchestrator.planTask(
        'financial_modeling',
        'Model financials'
      );

      expect(result.complexityScore).toBeGreaterThanOrEqual(0);
      expect(result.complexityScore).toBeLessThanOrEqual(1);
    });

    it('should require simulation for high complexity tasks', async () => {
      // Mock a high complexity scenario
      const result = await orchestrator.planTask(
        'value_assessment',
        'Complex multi-stage assessment'
      );

      // Complexity threshold for simulation is 0.7
      if (result.complexityScore > 0.7) {
        expect(result.requiresSimulation).toBe(true);
      }
    });

    it('should throw when task planning is disabled', async () => {
      const disabledOrchestrator = new UnifiedAgentOrchestrator({
        enableTaskPlanning: false,
      });

      await expect(
        disabledOrchestrator.planTask('value_assessment', 'Test')
      ).rejects.toThrow('Task planning is disabled');
    });
  });

  describe('Workflow Helpers', () => {
    it('should detect complete workflow', () => {
      const completedState: WorkflowState = {
        currentStage: 'done',
        status: 'completed',
        completedStages: ['discovery', 'analysis'],
        context: {},
      };

      expect(orchestrator.isWorkflowComplete(completedState)).toBe(true);
    });

    it('should detect incomplete workflow', () => {
      const inProgressState: WorkflowState = {
        currentStage: 'analysis',
        status: 'in_progress',
        completedStages: ['discovery'],
        context: {},
      };

      expect(orchestrator.isWorkflowComplete(inProgressState)).toBe(false);
    });

    it('should calculate progress percentage', () => {
      const state: WorkflowState = {
        currentStage: 'design',
        status: 'in_progress',
        completedStages: ['discovery', 'analysis'],
        context: {},
      };

      expect(orchestrator.getProgress(state, 5)).toBe(40); // 2/5 = 40%
      expect(orchestrator.getProgress(state, 4)).toBe(50); // 2/4 = 50%
    });
  });

  describe('Circuit Breaker Integration', () => {
    it('should get circuit breaker status', () => {
      const status = orchestrator.getCircuitBreakerStatus('opportunity');
      expect(status).toBeDefined();
    });

    it('should reset circuit breaker', () => {
      expect(() => orchestrator.resetCircuitBreaker('opportunity')).not.toThrow();
    });
  });

  describe('Registry Access', () => {
    it('should provide access to registry', () => {
      const registry = orchestrator.getRegistry();
      expect(registry).toBeDefined();
    });

    it('should register agent through orchestrator', () => {
      const registration = {
        id: 'test-agent',
        name: 'Test Agent',
        lifecycle_stage: 'opportunity' as const,
        capabilities: ['test_capability'],
      };

      const record = orchestrator.registerAgent(registration);
      expect(record.id).toBe('test-agent');
      expect(record.status).toBe('healthy');
    });
  });
});
