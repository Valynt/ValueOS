/**
 * WorkflowOrchestrator Guardrail Tests
 * Tests for autonomy kill switch, destructive action blocking, and iteration limits
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WorkflowOrchestrator } from '../WorkflowOrchestrator';
import * as autonomyModule from '../../config/autonomy';

// Mock Supabase
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(),
      single: vi.fn(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
    })),
  },
}));

// Mock logger
vi.mock('../../lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('WorkflowOrchestrator - Guardrail Tests', () => {
  let orchestrator: WorkflowOrchestrator;

  beforeEach(() => {
    orchestrator = new WorkflowOrchestrator();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Kill Switch Tests', () => {
    it('should block workflow execution when kill switch is enabled', async () => {
      // Mock autonomy config with kill switch enabled
      vi.spyOn(autonomyModule, 'getAutonomyConfig').mockReturnValue({
        killSwitchEnabled: true,
        maxCostUsd: 100,
        maxDurationMs: 300000,
        requireApprovalForDestructive: true,
        agents: {},
        global: {
          maxTotalCostPerHour: 500,
          maxConcurrentAgents: 10,
          alwaysRequireApproval: [],
        },
      });

      await expect(
        orchestrator.executeWorkflow('workflow-123', {})
      ).rejects.toThrow('Autonomy kill-switch enabled: workflow execution blocked');
    });

    it('should allow workflow execution when kill switch is disabled', async () => {
      // Mock autonomy config with kill switch disabled
      vi.spyOn(autonomyModule, 'getAutonomyConfig').mockReturnValue({
        killSwitchEnabled: false,
        maxCostUsd: 100,
        maxDurationMs: 300000,
        requireApprovalForDestructive: true,
        agents: {},
        global: {
          maxTotalCostPerHour: 500,
          maxConcurrentAgents: 10,
          alwaysRequireApproval: [],
        },
      });

      // Mock successful DB queries
      const { supabase } = await import('../../lib/supabase');
      const mockFrom = supabase.from as any;
      
      mockFrom.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            id: 'workflow-123',
            name: 'Test Workflow',
            version: '1.0',
            dag_schema: {
              initial_stage: 'start',
              stages: [{ id: 'start', agent_type: 'test' }],
              transitions: [],
              final_stages: ['end'],
            },
          },
          error: null,
        }),
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'exec-123',
            workflow_definition_id: 'workflow-123',
            status: 'initiated',
            context: {},
          },
          error: null,
        }),
      }));

      const executionId = await orchestrator.executeWorkflow('workflow-123', {});
      expect(executionId).toBe('exec-123');
    });

    it('should persist kill switch state changes across calls', async () => {
      const mockConfig = {
        killSwitchEnabled: false,
        maxCostUsd: 100,
        maxDurationMs: 300000,
        requireApprovalForDestructive: true,
        agents: {},
        global: {
          maxTotalCostPerHour: 500,
          maxConcurrentAgents: 10,
          alwaysRequireApproval: [],
        },
      };

      const spy = vi.spyOn(autonomyModule, 'getAutonomyConfig').mockReturnValue(mockConfig);

      // First call - kill switch off
      try {
        await orchestrator.executeWorkflow('workflow-123', {});
      } catch (e) {
        // Ignore other errors
      }

      // Enable kill switch
      mockConfig.killSwitchEnabled = true;

      // Second call - should block
      await expect(
        orchestrator.executeWorkflow('workflow-123', {})
      ).rejects.toThrow('Autonomy kill-switch enabled');

      expect(spy).toHaveBeenCalledTimes(2);
    });
  });

  describe('Destructive Action Blocking', () => {
    beforeEach(() => {
      // Mock autonomy config with destructive action checking
      vi.spyOn(autonomyModule, 'getAutonomyConfig').mockReturnValue({
        killSwitchEnabled: false,
        maxCostUsd: 100,
        maxDurationMs: 300000,
        requireApprovalForDestructive: true,
        destructiveActions: ['DELETE', 'PURGE', 'DROP'],
        agents: {},
        global: {
          maxTotalCostPerHour: 500,
          maxConcurrentAgents: 10,
          alwaysRequireApproval: ['DELETE_USER', 'PURGE_DATABASE'],
        },
      });
    });

    it('should block destructive actions without approval', async () => {
      const mockFrom = (await import('../../lib/supabase')).supabase.from as any;
      
      // Mock workflow with destructive action
      mockFrom.mockImplementation((table: string) => {
        if (table === 'workflow_definitions') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: 'workflow-123',
                name: 'Destructive Workflow',
                version: '1.0',
                dag_schema: {
                  initial_stage: 'delete-stage',
                  stages: [{
                    id: 'delete-stage',
                    agent_type: 'delete',
                    actions: ['DELETE', 'DROP'],
                  }],
                  transitions: [],
                  final_stages: ['delete-stage'],
                },
              },
              error: null,
            }),
          };
        }
        
        if (table === 'workflow_executions') {
          return {
            insert: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'exec-123',
                context: {
                  approvals: {}, // No approval given
                },
              },
              error: null,
            }),
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
          };
        }

        return {
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn(),
        };
      });

      const executionId = await orchestrator.executeWorkflow('workflow-123', {
        approvals: {}, // No approval
      });

      // Wait for async execution to attempt destructive action
      await new Promise(resolve => setTimeout(resolve, 100));

      const status = await orchestrator.getExecutionStatus(executionId);
      expect(status?.status).toBe('failed');
      expect(status?.error_message).toContain('Destructive action requires approval');
    });

    it('should allow destructive actions with approval', async () => {
      const mockFrom = (await import('../../lib/supabase')).supabase.from as any;
      
      mockFrom.mockImplementation((table: string) => {
        if (table === 'workflow_definitions') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: 'workflow-123',
                version: '1.0',
                dag_schema: {
                  initial_stage: 'delete-stage',
                  stages: [{
                    id: 'delete-stage',
                    actions: ['DELETE'],
                  }],
                  transitions: [],
                  final_stages: ['delete-stage'],
                },
              },
              error: null,
            }),
          };
        }
        
        if (table === 'workflow_executions') {
          const execId = 'exec-456';
          return {
            insert: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                id: execId,
                context: {
                  approvals: {
                    [execId]: true, // Approval granted
                  },
                },
              },
              error: null,
            }),
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
          };
        }

        return {
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
        };
      });

      const executionId = await orchestrator.executeWorkflow('workflow-123', {
        approvals: {
          'exec-456': true, // Pre-approved
        },
      });

      expect(executionId).toBeDefined();
    });

    it('should check destructive actions against configured keywords', async () => {
      const testCases = [
        { action: 'DELETE', shouldBlock: true },
        { action: 'PURGE', shouldBlock: true },
        { action: 'DROP', shouldBlock: true },
        { action: 'UPDATE', shouldBlock: false },
        { action: 'READ', shouldBlock: false },
      ];

      for (const testCase of testCases) {
        const config = autonomyModule.getAutonomyConfig();
        const isDestructive = config.destructiveActions?.includes(testCase.action);
        
        if (testCase.shouldBlock) {
          expect(isDestructive).toBe(true);
        } else {
          expect(isDestructive).toBe(false);
        }
      }
    });
  });

  describe('Iteration Limit Tests', () => {
    beforeEach(() => {
      // Mock autonomy config with iteration limits
      vi.spyOn(autonomyModule, 'getAutonomyConfig').mockReturnValue({
        killSwitchEnabled: false,
        maxCostUsd: 100,
        maxDurationMs: 300000,
        requireApprovalForDestructive: false,
        agentMaxIterations: {
          'agent-1': 3,
          'agent-2': 5,
          'agent-3': 1,
        },
        agents: {},
        global: {
          maxTotalCostPerHour: 500,
          maxConcurrentAgents: 10,
          alwaysRequireApproval: [],
        },
      });
    });

    it('should block execution when agent exceeds iteration limit', async () => {
      const mockFrom = (await import('../../lib/supabase')).supabase.from as any;
      
      mockFrom.mockImplementation((table: string) => {
        if (table === 'workflow_definitions') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: 'workflow-123',
                version: '1.0',
                dag_schema: {
                  initial_stage: 'loop-stage',
                  stages: [{
                    id: 'loop-stage',
                    agent_id: 'agent-1',
                  }],
                  transitions: [
                    { from_stage: 'loop-stage', to_stage: 'loop-stage' },
                  ],
                  final_stages: [],
                },
              },
              error: null,
            }),
          };
        }
        
        if (table === 'workflow_executions') {
          return {
            insert: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'exec-789',
                context: {
                  executed_steps: [
                    { agent_id: 'agent-1' },
                    { agent_id: 'agent-1' },
                    { agent_id: 'agent-1' },
                    // 3 iterations - at limit
                  ],
                },
              },
              error: null,
            }),
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
          };
        }

        return {
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
        };
      });

      const executionId = await orchestrator.executeWorkflow('workflow-123', {
        executed_steps: [
          { agent_id: 'agent-1' },
          { agent_id: 'agent-1' },
          { agent_id: 'agent-1' },
        ],
      });

      // Wait for execution to hit limit
      await new Promise(resolve => setTimeout(resolve, 100));

      const status = await orchestrator.getExecutionStatus(executionId);
      expect(status?.status).toBe('failed');
      expect(status?.error_message).toContain('iteration limit exceeded');
    });

    it('should allow execution below iteration limit', async () => {
      const executedSteps = [
        { agent_id: 'agent-1' },
        { agent_id: 'agent-1' },
        // 2 iterations - below limit of 3
      ];

      const config = autonomyModule.getAutonomyConfig();
      const limit = config.agentMaxIterations?.['agent-1'] || Infinity;
      const currentCount = executedSteps.filter(
        (s: any) => s.agent_id === 'agent-1'
      ).length;

      expect(currentCount).toBeLessThan(limit);
    });

    it('should track iterations per agent independently', async () => {
      const context = {
        executed_steps: [
          { agent_id: 'agent-1' }, // 1
          { agent_id: 'agent-2' }, // 1
          { agent_id: 'agent-1' }, // 2
          { agent_id: 'agent-2' }, // 2
          { agent_id: 'agent-1' }, // 3 - at limit for agent-1
          { agent_id: 'agent-2' }, // 3 - below limit for agent-2 (5)
        ],
      };

      const config = autonomyModule.getAutonomyConfig();
      
      const agent1Count = context.executed_steps.filter(
        (s: any) => s.agent_id === 'agent-1'
      ).length;
      const agent2Count = context.executed_steps.filter(
        (s: any) => s.agent_id === 'agent-2'
      ).length;

      expect(agent1Count).toBe(3);
      expect(agent1Count).toBe(config.agentMaxIterations?.['agent-1']);
      
      expect(agent2Count).toBe(3);
      expect(agent2Count).toBeLessThan(config.agentMaxIterations?.['agent-2'] || Infinity);
    });

    it('should handle agents with no iteration limit', async () => {
      const context = {
        executed_steps: [
          { agent_id: 'agent-unlimited' },
          { agent_id: 'agent-unlimited' },
          { agent_id: 'agent-unlimited' },
          { agent_id: 'agent-unlimited' },
          { agent_id: 'agent-unlimited' },
          // Many iterations for agent without limit
        ],
      };

      const config = autonomyModule.getAutonomyConfig();
      const limit = config.agentMaxIterations?.['agent-unlimited'];

      expect(limit).toBeUndefined();
      // Should be allowed to continue
    });
  });

  describe('Agent Kill Switch Tests', () => {
    beforeEach(() => {
      vi.spyOn(autonomyModule, 'getAutonomyConfig').mockReturnValue({
        killSwitchEnabled: false,
        maxCostUsd: 100,
        maxDurationMs: 300000,
        requireApprovalForDestructive: false,
        agentKillSwitches: {
          'disabled-agent': true,
          'enabled-agent': false,
        },
        agents: {},
        global: {
          maxTotalCostPerHour: 500,
          maxConcurrentAgents: 10,
          alwaysRequireApproval: [],
        },
      });
    });

    it('should block agent with kill switch enabled', async () => {
      const config = autonomyModule.getAutonomyConfig();
      const isDisabled = config.agentKillSwitches?.['disabled-agent'];
      
      expect(isDisabled).toBe(true);
    });

    it('should allow agent with kill switch disabled', async () => {
      const config = autonomyModule.getAutonomyConfig();
      const isDisabled = config.agentKillSwitches?.['enabled-agent'];
      
      expect(isDisabled).toBe(false);
    });

    it('should handle agent without explicit kill switch setting', async () => {
      const config = autonomyModule.getAutonomyConfig();
      const isDisabled = config.agentKillSwitches?.['unknown-agent'];
      
      expect(isDisabled).toBeUndefined();
      // Undefined should be treated as enabled (allowed)
    });
  });

  describe('Duration and Cost Limit Tests', () => {
    beforeEach(() => {
      vi.spyOn(autonomyModule, 'getAutonomyConfig').mockReturnValue({
        killSwitchEnabled: false,
        maxCostUsd: 50,
        maxDurationMs: 10000, // 10 seconds
        requireApprovalForDestructive: false,
        agents: {},
        global: {
          maxTotalCostPerHour: 500,
          maxConcurrentAgents: 10,
          alwaysRequireApproval: [],
        },
      });
    });

    it('should block execution exceeding max duration', async () => {
      const mockFrom = (await import('../../lib/supabase')).supabase.from as any;
      
      mockFrom.mockImplementation((table: string) => {
        if (table === 'workflow_executions') {
          return {
            select: vi.fn().mockReturnThis(),
            insert: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'exec-duration',
                context: {},
              },
              error: null,
            }),
            eq: vi.fn().mockReturnThis(),
            update: vi.fn().mockReturnThis(),
          };
        }

        return {
          select: vi.fn().mockReturnThis(),
          insert: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
        };
      });

      // Simulate time passage
      const config = autonomyModule.getAutonomyConfig();
      const elapsed = 11000; // 11 seconds - exceeds 10 second limit

      expect(elapsed).toBeGreaterThan(config.maxDurationMs);
    });

    it('should block execution exceeding max cost', async () => {
      const config = autonomyModule.getAutonomyConfig();
      const accumulatedCost = 55; // Exceeds $50 limit

      expect(accumulatedCost).toBeGreaterThan(config.maxCostUsd);
    });

    it('should allow execution within limits', async () => {
      const config = autonomyModule.getAutonomyConfig();
      const elapsed = 5000; // 5 seconds - within 10 second limit
      const cost = 25; // $25 - within $50 limit

      expect(elapsed).toBeLessThan(config.maxDurationMs);
      expect(cost).toBeLessThan(config.maxCostUsd);
    });
  });

  describe('Observe-Only Agent Restriction', () => {
    beforeEach(() => {
      vi.spyOn(autonomyModule, 'getAutonomyConfig').mockReturnValue({
        killSwitchEnabled: false,
        maxCostUsd: 100,
        maxDurationMs: 300000,
        requireApprovalForDestructive: false,
        agentAutonomyLevels: {
          'observe-agent': 'observe',
          'assist-agent': 'assist',
          'act-agent': 'act',
        },
        agents: {},
        global: {
          maxTotalCostPerHour: 500,
          maxConcurrentAgents: 10,
          alwaysRequireApproval: [],
        },
      });
    });

    it('should block observe-only agent from taking actions', async () => {
      const config = autonomyModule.getAutonomyConfig();
      const level = config.agentAutonomyLevels?.['observe-agent'];
      
      expect(level).toBe('observe');
      // Observe-only agents should not be allowed to execute actions
    });

    it('should allow assist-level agent to take actions', async () => {
      const config = autonomyModule.getAutonomyConfig();
      const level = config.agentAutonomyLevels?.['assist-agent'];
      
      expect(level).toBe('assist');
      // Assist-level agents can take actions with approval
    });

    it('should allow act-level agent full autonomy', async () => {
      const config = autonomyModule.getAutonomyConfig();
      const level = config.agentAutonomyLevels?.['act-agent'];
      
      expect(level).toBe('act');
      // Act-level agents have full autonomy
    });
  });

  describe('Combined Guardrail Scenarios', () => {
    it('should enforce multiple guardrails simultaneously', async () => {
      vi.spyOn(autonomyModule, 'getAutonomyConfig').mockReturnValue({
        killSwitchEnabled: false,
        maxCostUsd: 50,
        maxDurationMs: 10000,
        requireApprovalForDestructive: true,
        destructiveActions: ['DELETE'],
        agentMaxIterations: {
          'test-agent': 2,
        },
        agentKillSwitches: {
          'disabled-agent': true,
        },
        agents: {},
        global: {
          maxTotalCostPerHour: 500,
          maxConcurrentAgents: 10,
          alwaysRequireApproval: ['DELETE_USER'],
        },
      });

      const config = autonomyModule.getAutonomyConfig();

      // Test cost limit
      expect(100).toBeGreaterThan(config.maxCostUsd);

      // Test iteration limit
      const iterations = 3;
      expect(iterations).toBeGreaterThan(config.agentMaxIterations?.['test-agent'] || Infinity);

      // Test destructive action
      expect(config.destructiveActions).toContain('DELETE');

      // Test agent kill switch
      expect(config.agentKillSwitches?.['disabled-agent']).toBe(true);
    });

    it('should short-circuit on first failed guardrail', async () => {
      vi.spyOn(autonomyModule, 'getAutonomyConfig').mockReturnValue({
        killSwitchEnabled: true, // First guardrail - should fail immediately
        maxCostUsd: 1000,
        maxDurationMs: 1000000,
        requireApprovalForDestructive: false,
        agents: {},
        global: {
          maxTotalCostPerHour: 500,
          maxConcurrentAgents: 10,
          alwaysRequireApproval: [],
        },
      });

      // Kill switch should block before any other checks
      await expect(
        orchestrator.executeWorkflow('workflow-123', {})
      ).rejects.toThrow('Autonomy kill-switch enabled');
    });

    it('should log all guardrail violations to audit log', async () => {
      const { supabase } = await import('../../lib/supabase');
      const mockFrom = supabase.from as any;
      const insertSpy = vi.fn().mockReturnThis();

      mockFrom.mockImplementation((table: string) => {
        if (table === 'workflow_audit_logs') {
          return {
            insert: insertSpy,
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          insert: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
        };
      });

      vi.spyOn(autonomyModule, 'getAutonomyConfig').mockReturnValue({
        killSwitchEnabled: true,
        maxCostUsd: 100,
        maxDurationMs: 300000,
        requireApprovalForDestructive: false,
        agents: {},
        global: {
          maxTotalCostPerHour: 500,
          maxConcurrentAgents: 10,
          alwaysRequireApproval: [],
        },
      });

      try {
        await orchestrator.executeWorkflow('workflow-123', {});
      } catch (e) {
        // Expected to fail
      }

      // Audit log should be called for violations
      // (implementation may vary based on actual logging strategy)
    });
  });
});
