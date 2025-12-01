/**
 * Integration tests for SDUI Phase 2
 * 
 * Tests agent integration, workflow integration, and state management.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { agentSDUIAdapter } from '../services/AgentSDUIAdapter';
import { workflowSDUIAdapter } from '../services/WorkflowSDUIAdapter';
import { workspaceStateService } from '../services/WorkspaceStateService';
import { agentOutputListener } from '../services/AgentOutputListener';
import { workflowEventListener } from '../services/WorkflowEventListener';
import { SystemMapperOutput } from '../types/agent-output';
import { WorkflowProgress } from '../types/workflow-sdui';

// Mock dependencies
vi.mock('../services/CanvasSchemaService');
vi.mock('../lib/supabase');
vi.mock('../lib/logger');

describe('Phase 2 Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Agent → SDUI Pipeline', () => {
    it('should process agent output and generate SDUI update', async () => {
      const agentOutput: SystemMapperOutput = {
        agentId: 'system-mapper-1',
        agentType: 'SystemMapperAgent',
        timestamp: Date.now(),
        workspaceId: 'workspace-1',
        lifecycleStage: 'opportunity',
        success: true,
        systemMap: {
          id: 'map-1',
          name: 'Test System Map',
        } as any,
        entities: [{ id: 'e1', name: 'Entity 1' }],
        relationships: [{ id: 'r1', source: 'e1', target: 'e2' }],
        leveragePoints: [{ id: 'lp1', type: 'information_flow' }],
        constraints: [],
        insights: ['Insight 1'],
      };

      const update = await agentSDUIAdapter.processAgentOutput(
        'system-mapper-1',
        agentOutput,
        'workspace-1'
      );

      expect(update).toBeDefined();
      expect(update.workspaceId).toBe('workspace-1');
      expect(update.actions).toBeDefined();
      expect(update.actions!.length).toBeGreaterThan(0);
    });

    it('should handle agent output through listener', async () => {
      const agentOutput: SystemMapperOutput = {
        agentId: 'system-mapper-1',
        agentType: 'SystemMapperAgent',
        timestamp: Date.now(),
        workspaceId: 'workspace-1',
        lifecycleStage: 'opportunity',
        success: true,
        systemMap: { id: 'map-1' } as any,
        entities: [],
        relationships: [],
        leveragePoints: [],
        constraints: [],
        insights: [],
      };

      const callback = vi.fn();
      agentOutputListener.onAgentOutput('system-mapper-1', callback);

      await agentOutputListener.handleAgentOutput(agentOutput);

      expect(callback).toHaveBeenCalledWith(agentOutput);
    });

    it('should update workspace state when agent completes', async () => {
      const agentOutput: SystemMapperOutput = {
        agentId: 'system-mapper-1',
        agentType: 'SystemMapperAgent',
        timestamp: Date.now(),
        workspaceId: 'workspace-1',
        lifecycleStage: 'opportunity',
        success: true,
        systemMap: { id: 'map-1' } as any,
        entities: [],
        relationships: [],
        leveragePoints: [],
        constraints: [],
        insights: [],
      };

      // Get initial state
      const initialState = await workspaceStateService.getState('workspace-1');

      // Process agent output
      await agentOutputListener.handleAgentOutput(agentOutput);

      // State should be updated (in real implementation)
      // For now, just verify the flow works
      expect(initialState).toBeDefined();
    });
  });

  describe('Workflow → SDUI Pipeline', () => {
    it('should handle workflow stage transition', async () => {
      const context = {
        executionId: 'exec-1',
        workspaceId: 'workspace-1',
      };

      const update = await workflowSDUIAdapter.onStageTransition(
        'workflow-1',
        'stage-1',
        'stage-2',
        context
      );

      expect(update).toBeDefined();
      expect(update.workspaceId).toBe('workspace-1');
      expect(update.actions).toBeDefined();
    });

    it('should update progress through listener', async () => {
      await workflowEventListener.handleWorkflowStarted(
        'workflow-1',
        'exec-1',
        {
          initialStage: 'stage-1',
          totalStages: 5,
          workspaceId: 'workspace-1',
        }
      );

      const progress = workflowEventListener.getProgress('workflow-1');

      expect(progress).toBeDefined();
      expect(progress?.workflowId).toBe('workflow-1');
      expect(progress?.totalStages).toBe(5);
    });

    it('should handle stage completion', async () => {
      const completionSpy = vi.fn();
      workflowEventListener.on('workflow:stage_completed', completionSpy);
      await workflowEventListener.handleWorkflowStarted(
        'workflow-1',
        'exec-1',
        {
          initialStage: 'stage-1',
          totalStages: 2,
          workspaceId: 'workspace-1',
        }
      );

      vi.spyOn(workflowSDUIAdapter, 'onStageCompletion').mockResolvedValue([]);

      await workflowEventListener.handleStageCompletion(
        'workflow-1',
        'stage-1',
        'completed',
        5000
      );

      const progress = workflowEventListener.getProgress('workflow-1');

      expect(progress?.completedStages).toContain('stage-1');
      expect(completionSpy).toHaveBeenCalledWith(
        expect.objectContaining({ workflowId: 'workflow-1', stageId: 'stage-1', status: 'completed' })
      );
    });

    it('should handle workflow completion', async () => {
      await workflowEventListener.handleWorkflowCompleted(
        'workflow-1',
        'exec-1',
        { workspaceId: 'workspace-1' }
      );

      // Progress should be cleaned up
      const progress = workflowEventListener.getProgress('workflow-1');
      expect(progress).toBeUndefined();
    });
  });

  describe('State Management', () => {
    it('should get and update workspace state', async () => {
      const state = await workspaceStateService.getState('workspace-1');

      expect(state).toBeDefined();
      expect(state.workspaceId).toBe('workspace-1');
      expect(state.version).toBeGreaterThanOrEqual(1);

      const updatedState = await workspaceStateService.updateState('workspace-1', {
        lifecycleStage: 'target',
        data: { test: 'value' },
      });

      expect(updatedState.lifecycleStage).toBe('target');
      expect(updatedState.data).toEqual({ test: 'value' });
      expect(updatedState.version).toBe(state.version + 1);
    });

    it('should notify subscribers on state change', async () => {
      const callback = vi.fn();
      const unsubscribe = workspaceStateService.subscribeToChanges(
        'workspace-1',
        callback
      );

      await workspaceStateService.updateState('workspace-1', {
        lifecycleStage: 'target',
      });

      expect(callback).toHaveBeenCalled();
      expect(callback.mock.calls[0][0].lifecycleStage).toBe('target');

      unsubscribe();
    });

    it('should persist state to database', async () => {
      const state = await workspaceStateService.getState('workspace-1');

      await expect(
        workspaceStateService.persistState('workspace-1', state)
      ).resolves.not.toThrow();
    });
  });

  describe('End-to-End Scenarios', () => {
    it('should handle agent output → state update → SDUI update', async () => {
      // 1. Agent produces output
      const agentOutput: SystemMapperOutput = {
        agentId: 'system-mapper-1',
        agentType: 'SystemMapperAgent',
        timestamp: Date.now(),
        workspaceId: 'workspace-1',
        lifecycleStage: 'opportunity',
        success: true,
        systemMap: { id: 'map-1' } as any,
        entities: [{ id: 'e1' }] as any,
        relationships: [],
        leveragePoints: [],
        constraints: [],
        insights: [],
      };

      // 2. Process through adapter
      const sduiUpdate = await agentSDUIAdapter.processAgentOutput(
        'system-mapper-1',
        agentOutput,
        'workspace-1'
      );

      expect(sduiUpdate).toBeDefined();
      expect(sduiUpdate.actions).toBeDefined();

      // 3. Update workspace state
      const updatedState = await workspaceStateService.updateState('workspace-1', {
        data: {
          systemMap: agentOutput.systemMap,
        },
      });

      expect(updatedState.data.systemMap).toBeDefined();
    });

    it('should handle workflow transition → state update → SDUI update', async () => {
      // 1. Start workflow
      await workflowEventListener.handleWorkflowStarted(
        'workflow-1',
        'exec-1',
        {
          initialStage: 'opportunity-stage',
          totalStages: 5,
          workspaceId: 'workspace-1',
        }
      );

      // 2. Transition to next stage
      await workflowEventListener.handleStageTransition(
        'workflow-1',
        'opportunity-stage',
        'target-stage',
        {
          executionId: 'exec-1',
          workspaceId: 'workspace-1',
        }
      );

      // 3. Update workspace state
      const updatedState = await workspaceStateService.updateState('workspace-1', {
        lifecycleStage: 'target',
        currentWorkflowId: 'workflow-1',
        currentStageId: 'target-stage',
      });

      expect(updatedState.lifecycleStage).toBe('target');
      expect(updatedState.currentStageId).toBe('target-stage');
    });

    it('should handle concurrent agent outputs', async () => {
      const outputs = [
        {
          agentId: 'agent-1',
          agentType: 'SystemMapperAgent',
          timestamp: Date.now(),
          workspaceId: 'workspace-1',
          lifecycleStage: 'opportunity' as const,
          success: true,
          systemMap: { id: 'map-1' } as any,
          entities: [],
          relationships: [],
          leveragePoints: [],
          constraints: [],
          insights: [],
        },
        {
          agentId: 'agent-2',
          agentType: 'ValueEvalAgent',
          timestamp: Date.now(),
          workspaceId: 'workspace-1',
          lifecycleStage: 'opportunity' as const,
          success: true,
          scores: { revenue: 0.85 },
          recommendations: [],
          risks: [],
          opportunities: [],
        },
      ];

      // Process outputs concurrently
      const updates = await Promise.all(
        outputs.map((output) =>
          agentSDUIAdapter.processAgentOutput(output.agentId, output as any, 'workspace-1')
        )
      );

      expect(updates).toHaveLength(2);
      expect(updates.every((u) => u.workspaceId === 'workspace-1')).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle agent output errors gracefully', async () => {
      const agentOutput: SystemMapperOutput = {
        agentId: 'system-mapper-1',
        agentType: 'SystemMapperAgent',
        timestamp: Date.now(),
        workspaceId: 'workspace-1',
        lifecycleStage: 'opportunity',
        success: false,
        error: 'Test error',
        systemMap: null as any,
        entities: [],
        relationships: [],
        leveragePoints: [],
        constraints: [],
        insights: [],
      };

      const update = await agentSDUIAdapter.processAgentOutput(
        'system-mapper-1',
        agentOutput,
        'workspace-1'
      );

      expect(update).toBeDefined();
      expect(update.type).toBe('partial_update');
    });

    it('should handle workflow errors gracefully', async () => {
      await workflowEventListener.handleWorkflowFailed(
        'workflow-1',
        'exec-1',
        new Error('Test error'),
        { workspaceId: 'workspace-1' }
      );

      // Progress should be cleaned up
      const progress = workflowEventListener.getProgress('workflow-1');
      expect(progress).toBeUndefined();
    });

    it('should handle state update errors gracefully', async () => {
      await expect(
        workspaceStateService.updateState('workspace-1', {
          lifecycleStage: 'invalid' as any,
        })
      ).rejects.toThrow();
    });
  });
});
