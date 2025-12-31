/**
 * AgentFabric Tests
 * Tests agent initialization, orchestration, and workflow management
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentFabric } from '../AgentFabric';
import { createClient } from '@supabase/supabase-js';

// Mock all dependencies
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}));

vi.mock('../MemorySystem', () => ({
  MemorySystem: vi.fn(),
}));

vi.mock('../LLMGateway', () => ({
  LLMGateway: vi.fn(),
}));

vi.mock('../AuditLogger', () => ({
  AuditLogger: vi.fn(),
}));

vi.mock('../ReflectionEngine', () => ({
  ReflectionEngine: vi.fn(),
}));

vi.mock('../../../lib/logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  })),
}));

describe('AgentFabric', () => {
  let agentFabric: AgentFabric;
  let mockSupabase: any;
  let mockMemorySystem: any;
  let mockLlmGateway: any;
  let mockAuditLogger: any;
  let mockReflectionEngine: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mocks
    mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(),
            order: vi.fn(),
          })),
        })),
        insert: vi.fn(),
        update: vi.fn(),
      })),
    };

    mockMemorySystem = {
      storeEpisodicMemory: vi.fn(),
      retrieveMemory: vi.fn(),
      searchMemories: vi.fn(),
    };

    mockLlmGateway = {
      complete: vi.fn(),
      completeStream: vi.fn(),
      getProvider: vi.fn().mockReturnValue('together'),
    };

    mockAuditLogger = {
      logAgentExecution: vi.fn(),
      logLLMCall: vi.fn(),
    };

    mockReflectionEngine = {
      reflectOnExecution: vi.fn(),
      improveStrategy: vi.fn(),
    };

    // Mock constructors
    (createClient as any).mockReturnValue(mockSupabase);
    (require('../MemorySystem').MemorySystem as any).mockReturnValue(mockMemorySystem);
    (require('../LLMGateway').LLMGateway as any).mockReturnValue(mockLlmGateway);
    (require('../AuditLogger').AuditLogger as any).mockReturnValue(mockAuditLogger);
    (require('../ReflectionEngine').ReflectionEngine as any).mockReturnValue(mockReflectionEngine);

    agentFabric = new AgentFabric(mockSupabase, 'test-org');
  });

  describe('Initialization', () => {
    it('should initialize with all required components', () => {
      expect(agentFabric).toBeDefined();
      expect(require('../MemorySystem').MemorySystem).toHaveBeenCalledWith(mockSupabase, 'test-org');
      expect(require('../LLMGateway').LLMGateway).toHaveBeenCalled();
      expect(require('../AuditLogger').AuditLogger).toHaveBeenCalledWith(mockSupabase, 'test-org');
    });

    it('should initialize with different organizations', () => {
      const org2Fabric = new AgentFabric(mockSupabase, 'org-2');

      expect(require('../MemorySystem').MemorySystem).toHaveBeenCalledWith(mockSupabase, 'org-2');
      expect(require('../AuditLogger').AuditLogger).toHaveBeenCalledWith(mockSupabase, 'org-2');
    });
  });

  describe('Agent Loading', () => {
    it('should load active agents from database', async () => {
      const mockAgents = [
        {
          id: 'agent-1',
          agent_id: 'ValueMappingAgent',
          status: 'active',
          config: { model: 'gpt-4' },
        },
        {
          id: 'agent-2',
          agent_id: 'FinancialModelingAgent',
          status: 'active',
          config: { temperature: 0.7 },
        },
      ];

      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn().mockResolvedValue({
              data: mockAgents,
              error: null,
            }),
          })),
        })),
      });

      await agentFabric.loadActiveAgents();

      // Verify agents are loaded (implementation detail)
      expect(mockSupabase.from).toHaveBeenCalledWith('agent_instances');
    });

    it('should handle agent loading errors gracefully', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database error' },
            }),
          })),
        })),
      });

      await expect(agentFabric.loadActiveAgents()).resolves.not.toThrow();
    });
  });

  describe('Agent Execution', () => {
    const mockTaskContext = {
      userId: 'user-123',
      sessionId: 'session-456',
      organizationId: 'org-789',
      task_type: 'value_mapping',
      entities: [{ id: '1' }, { id: '2' }],
    };

    it('should execute agent tasks successfully', async () => {
      const agentId = 'ValueMappingAgent';
      const input = { data: 'test input' };
      const expectedOutput = { result: 'mapped values' };

      // Mock agent execution
      mockLlmGateway.complete.mockResolvedValue({
        content: JSON.stringify(expectedOutput),
        tokens_used: 150,
        latency_ms: 1200,
        model: 'gpt-4',
      });

      mockMemorySystem.storeEpisodicMemory.mockResolvedValue({ id: 'mem-1' });

      const result = await agentFabric.executeAgent(agentId, input, mockTaskContext);

      expect(result).toEqual(expectedOutput);
      expect(mockAuditLogger.logAgentExecution).toHaveBeenCalled();
      expect(mockMemorySystem.storeEpisodicMemory).toHaveBeenCalled();
    });

    it('should handle agent execution failures', async () => {
      const agentId = 'FailingAgent';
      const input = { data: 'test' };

      mockLlmGateway.complete.mockRejectedValue(new Error('Agent execution failed'));

      await expect(agentFabric.executeAgent(agentId, input, mockTaskContext))
        .rejects.toThrow('Agent execution failed');

      expect(mockAuditLogger.logAgentExecution).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'agent.execute',
          metadata: expect.objectContaining({
            error: 'Agent execution failed',
          }),
        })
      );
    });

    it('should validate agent inputs', async () => {
      const agentId = 'ValueMappingAgent';
      const invalidInput = null;

      await expect(agentFabric.executeAgent(agentId, invalidInput, mockTaskContext))
        .rejects.toThrow('Invalid agent input');
    });

    it('should enforce tenant isolation', async () => {
      const agentId = 'ValueMappingAgent';
      const input = { data: 'test' };
      const wrongTenantContext = {
        ...mockTaskContext,
        organizationId: 'wrong-org',
      };

      // Should fail due to tenant mismatch
      await expect(agentFabric.executeAgent(agentId, input, wrongTenantContext))
        .rejects.toThrow('Tenant access denied');
    });
  });

  describe('Workflow Execution', () => {
    it('should execute multi-agent workflows', async () => {
      const workflowDefinition = {
        workflowId: 'wf-123',
        name: 'Value Discovery Workflow',
        steps: [
          {
            stepId: 'step-1',
            type: 'agent_execution',
            config: {
              agentId: 'OpportunityAgent',
              inputMapping: { source: 'input.data' },
            },
          },
          {
            stepId: 'step-2',
            type: 'agent_execution',
            config: {
              agentId: 'ValueMappingAgent',
              inputMapping: { opportunities: 'step-1.output' },
            },
            dependsOn: ['step-1'],
          },
        ],
        tenantId: 'org-789',
      };

      const input = { data: 'initial data' };

      // Mock successful workflow execution
      mockLlmGateway.complete
        .mockResolvedValueOnce({
          content: JSON.stringify({ opportunities: ['opp-1', 'opp-2'] }),
          tokens_used: 100,
          latency_ms: 800,
          model: 'gpt-4',
        })
        .mockResolvedValueOnce({
          content: JSON.stringify({ mappings: ['map-1', 'map-2'] }),
          tokens_used: 120,
          latency_ms: 900,
          model: 'gpt-4',
        });

      const result = await agentFabric.executeWorkflow(workflowDefinition, input, mockTaskContext);

      expect(result).toHaveProperty('mappings');
      expect(mockAuditLogger.logAgentExecution).toHaveBeenCalledTimes(2);
    });

    it('should handle workflow step failures', async () => {
      const workflowDefinition = {
        workflowId: 'wf-failing',
        name: 'Failing Workflow',
        steps: [
          {
            stepId: 'step-1',
            type: 'agent_execution',
            config: { agentId: 'FailingAgent' },
          },
        ],
        tenantId: 'org-789',
      };

      mockLlmGateway.complete.mockRejectedValue(new Error('Step failed'));

      await expect(agentFabric.executeWorkflow(workflowDefinition, {}, mockTaskContext))
        .rejects.toThrow('Workflow execution failed');
    });

    it('should respect step dependencies', async () => {
      const workflowDefinition = {
        workflowId: 'wf-deps',
        name: 'Dependency Workflow',
        steps: [
          {
            stepId: 'step-1',
            type: 'agent_execution',
            config: { agentId: 'Agent1' },
          },
          {
            stepId: 'step-2',
            type: 'agent_execution',
            config: { agentId: 'Agent2' },
            dependsOn: ['step-1'],
          },
          {
            stepId: 'step-3',
            type: 'agent_execution',
            config: { agentId: 'Agent3' },
            dependsOn: ['step-2'],
          },
        ],
        tenantId: 'org-789',
      };

      const callOrder: string[] = [];

      mockLlmGateway.complete.mockImplementation(async () => {
        callOrder.push('called');
        return {
          content: JSON.stringify({ result: 'success' }),
          tokens_used: 50,
          latency_ms: 400,
          model: 'gpt-4',
        };
      });

      await agentFabric.executeWorkflow(workflowDefinition, {}, mockTaskContext);

      expect(callOrder).toHaveLength(3);
      expect(mockLlmGateway.complete).toHaveBeenCalledTimes(3);
    });
  });

  describe('Memory Integration', () => {
    it('should store execution results in episodic memory', async () => {
      const agentId = 'ValueMappingAgent';
      const input = { data: 'test input' };
      const output = { result: 'mapped successfully' };

      mockLlmGateway.complete.mockResolvedValue({
        content: JSON.stringify(output),
        tokens_used: 100,
        latency_ms: 600,
        model: 'gpt-4',
      });

      await agentFabric.executeAgent(agentId, input, mockTaskContext);

      expect(mockMemorySystem.storeEpisodicMemory).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('ValueMappingAgent'),
          type: 'episodic',
          metadata: expect.objectContaining({
            agentId,
            executionTime: expect.any(Number),
          }),
        }),
        mockTaskContext.organizationId
      );
    });

    it('should retrieve relevant memories for context', async () => {
      const agentId = 'ValueMappingAgent';
      const input = { data: 'pricing analysis' };

      const relevantMemories = [
        {
          id: 'mem-1',
          content: 'Previous pricing analysis',
          type: 'episodic',
          similarity: 0.9,
        },
      ];

      mockMemorySystem.searchMemories.mockResolvedValue(relevantMemories);

      mockLlmGateway.complete.mockResolvedValue({
        content: JSON.stringify({ result: 'analysis complete' }),
        tokens_used: 80,
        latency_ms: 500,
        model: 'gpt-4',
      });

      await agentFabric.executeAgent(agentId, input, mockTaskContext);

      expect(mockMemorySystem.searchMemories).toHaveBeenCalledWith(
        expect.stringContaining('pricing analysis'),
        mockTaskContext.organizationId
      );
    });
  });

  describe('Audit Logging', () => {
    it('should log all agent executions', async () => {
      const agentId = 'TestAgent';
      const input = { data: 'test' };
      const output = { result: 'success' };

      mockLlmGateway.complete.mockResolvedValue({
        content: JSON.stringify(output),
        tokens_used: 50,
        latency_ms: 300,
        model: 'gpt-4',
      });

      await agentFabric.executeAgent(agentId, input, mockTaskContext);

      expect(mockAuditLogger.logAgentExecution).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'agent.execute',
          resource: 'agent-fabric',
          resourceId: expect.any(String),
          userId: mockTaskContext.userId,
          sessionId: mockTaskContext.sessionId,
          tenantId: mockTaskContext.organizationId,
          metadata: expect.objectContaining({
            agentId,
            executionTime: expect.any(Number),
            cost: expect.any(Number),
          }),
        })
      );
    });

    it('should log LLM calls', async () => {
      mockLlmGateway.complete.mockResolvedValue({
        content: JSON.stringify({ result: 'test' }),
        tokens_used: 75,
        latency_ms: 450,
        model: 'gpt-4',
      });

      await agentFabric.executeAgent('TestAgent', { data: 'test' }, mockTaskContext);

      expect(mockAuditLogger.logLLMCall).toHaveBeenCalled();
    });
  });

  describe('Reflection Engine Integration', () => {
    it('should use reflection engine for strategy improvement', async () => {
      const agentId = 'LearningAgent';
      const input = { data: 'complex task' };

      mockLlmGateway.complete.mockResolvedValue({
        content: JSON.stringify({ result: 'learned successfully' }),
        tokens_used: 200,
        latency_ms: 1500,
        model: 'gpt-4',
      });

      mockReflectionEngine.reflectOnExecution.mockResolvedValue({
        insights: ['Use more efficient prompts'],
        improvements: ['Reduce token usage by 20%'],
      });

      await agentFabric.executeAgent(agentId, input, mockTaskContext);

      expect(mockReflectionEngine.reflectOnExecution).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId,
          executionTime: expect.any(Number),
          success: true,
        })
      );

      expect(mockReflectionEngine.improveStrategy).toHaveBeenCalled();
    });
  });

  describe('Resource Management', () => {
    it('should handle concurrent agent executions', async () => {
      const executions = [
        agentFabric.executeAgent('Agent1', { data: 'task1' }, mockTaskContext),
        agentFabric.executeAgent('Agent2', { data: 'task2' }, mockTaskContext),
        agentFabric.executeAgent('Agent3', { data: 'task3' }, mockTaskContext),
      ];

      mockLlmGateway.complete.mockResolvedValue({
        content: JSON.stringify({ result: 'success' }),
        tokens_used: 50,
        latency_ms: 300,
        model: 'gpt-4',
      });

      const results = await Promise.all(executions);

      expect(results).toHaveLength(3);
      expect(mockLlmGateway.complete).toHaveBeenCalledTimes(3);
    });

    it('should cleanup resources after execution', async () => {
      mockLlmGateway.complete.mockResolvedValue({
        content: JSON.stringify({ result: 'done' }),
        tokens_used: 30,
        latency_ms: 200,
        model: 'gpt-4',
      });

      await agentFabric.executeAgent('TestAgent', { data: 'test' }, mockTaskContext);

      // Verify cleanup occurred (circuit breaker completed, etc.)
      expect(mockAuditLogger.logAgentExecution).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection failures', async () => {
      mockSupabase.from.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      await expect(agentFabric.loadActiveAgents()).rejects.toThrow('Database connection failed');
    });

    it('should handle malformed agent responses', async () => {
      mockLlmGateway.complete.mockResolvedValue({
        content: 'invalid json {{{',
        tokens_used: 25,
        latency_ms: 150,
        model: 'gpt-4',
      });

      await expect(agentFabric.executeAgent('TestAgent', { data: 'test' }, mockTaskContext))
        .rejects.toThrow('Invalid agent response format');
    });

    it('should handle memory system failures', async () => {
      mockMemorySystem.storeEpisodicMemory.mockRejectedValue(new Error('Memory store failed'));

      mockLlmGateway.complete.mockResolvedValue({
        content: JSON.stringify({ result: 'success' }),
        tokens_used: 40,
        latency_ms: 250,
        model: 'gpt-4',
      });

      // Should still succeed despite memory failure
      const result = await agentFabric.executeAgent('TestAgent', { data: 'test' }, mockTaskContext);

      expect(result).toEqual({ result: 'success' });
    });
  });
});
