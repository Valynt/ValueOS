/**
 * Unit tests for WorkflowSDUIAdapter
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkflowSDUIAdapter } from '../WorkflowSDUIAdapter';
import {
  StageCompletionEvent,
  WorkflowProgress,
} from '../../types/workflow-sdui';
import { canvasSchemaService } from '../CanvasSchemaService';

// Mock dependencies
vi.mock('../CanvasSchemaService');
vi.mock('../../lib/logger');

describe('WorkflowSDUIAdapter', () => {
  let adapter: WorkflowSDUIAdapter;

  beforeEach(() => {
    adapter = new WorkflowSDUIAdapter();
    vi.clearAllMocks();
  });

  describe('onStageTransition', () => {
    it('should handle stage transition', async () => {
      const context = {
        executionId: 'exec-1',
        workspaceId: 'workspace-1',
      };

      const update = await adapter.onStageTransition(
        'workflow-1',
        'stage-1',
        'stage-2',
        context
      );

      expect(update).toBeDefined();
      expect(update.workspaceId).toBe('workspace-1');
      expect(update.source).toBe('workflow:workflow-1');
      expect(update.actions).toBeDefined();
    });

    it('should trigger full schema regeneration for lifecycle stage change', async () => {
      const context = {
        executionId: 'exec-1',
        workspaceId: 'workspace-1',
      };

      vi.spyOn(canvasSchemaService, 'invalidateCache');

      const update = await adapter.onStageTransition(
        'workflow-1',
        'opportunity-stage',
        'target-stage',
        context
      );

      expect(update.type).toBe('full_schema');
      expect(canvasSchemaService.invalidateCache).toHaveBeenCalledWith('workspace-1');
    });

    it('should generate atomic actions for same lifecycle stage', async () => {
      const context = {
        executionId: 'exec-1',
        workspaceId: 'workspace-1',
      };

      const update = await adapter.onStageTransition(
        'workflow-1',
        'opportunity-stage-1',
        'opportunity-stage-2',
        context
      );

      expect(update.type).toBe('atomic_actions');
      expect(update.actions!.length).toBeGreaterThan(0);
    });

    it('should handle errors gracefully', async () => {
      const context = {
        executionId: 'exec-1',
        workspaceId: 'workspace-1',
      };

      vi.spyOn(adapter as any, 'generateStageTransitionActions').mockRejectedValue(
        new Error('Test error')
      );

      const update = await adapter.onStageTransition(
        'workflow-1',
        'stage-1',
        'stage-2',
        context
      );

      expect(update.type).toBe('partial_update');
      expect(update.actions).toEqual([]);
    });
  });

  describe('updateProgress', () => {
    it('should generate progress update actions', async () => {
      const progress: WorkflowProgress = {
        workspace_id: 'workspace-1',
        workflow_id: 'workflow-1',
        current_stage: 'stage-2',
        completed_stages: ['stage-1'],
        total_stages: 5,
        progress_percentage: 20,
      };

      const actions = await adapter.updateProgress('workflow-1', progress);

      expect(actions.length).toBeGreaterThan(0);
      expect(actions.some((a) => a.type === 'mutate_component')).toBe(true);
    });

    it('should include estimated time if available', async () => {
      const progress: WorkflowProgress = {
        workspace_id: 'workspace-1',
        workflow_id: 'workflow-1',
        current_stage: 'stage-2',
        completed_stages: ['stage-1'],
        total_stages: 5,
        progress_percentage: 20,
        estimated_time_remaining: 300,
      };

      const actions = await adapter.updateProgress('workflow-1', progress);

      expect(actions.length).toBeGreaterThan(0);
      const timeAction = actions.find((a) =>
        a.type === 'mutate_component' &&
        a.mutations?.some((m: any) => m.path === 'props.estimatedTimeRemaining')
      );
      expect(timeAction).toBeDefined();
    });

    it('should handle errors gracefully', async () => {
      const progress: WorkflowProgress = {
        workspace_id: 'workspace-1',
        workflow_id: 'workflow-1',
        current_stage: 'stage-2',
        completed_stages: ['stage-1'],
        total_stages: 5,
        progress_percentage: 20,
      };

      vi.spyOn(adapter as any, 'createMutateAction').mockImplementation(() => {
        throw new Error('Test error');
      });

      const actions = await adapter.updateProgress('workflow-1', progress);

      expect(actions).toEqual([]);
    });
  });

  describe('showStageComponents', () => {
    it('should generate schema for opportunity stage', async () => {
      const mockSchema = {
        type: 'page' as const,
        version: 1,
        sections: [
          {
            type: 'component' as const,
            component: 'InfoBanner',
            version: 1,
            props: { title: 'Opportunity' },
          },
        ],
      };

      vi.spyOn(canvasSchemaService, 'generateSchema').mockResolvedValue(mockSchema);

      const schema = await adapter.showStageComponents('opportunity', 'workspace-1');

      expect(schema).toBeDefined();
      expect(schema.sections?.[0]?.component).toBe('InfoBanner');
      expect(schema.sections?.[0]?.props?.title).toContain('opportunity');
      expect(canvasSchemaService.generateSchema).toHaveBeenCalledWith(
        'workspace-1',
        expect.objectContaining({
          lifecycleStage: 'opportunity',
        })
      );
    });

    it('should generate schema for target stage', async () => {
      const mockSchema = {
        type: 'page' as const,
        version: 1,
        sections: [
          {
            type: 'component' as const,
            component: 'InfoBanner',
            version: 1,
            props: { title: 'Target' },
          },
        ],
      };

      vi.spyOn(canvasSchemaService, 'generateSchema').mockResolvedValue(mockSchema);

      const schema = await adapter.showStageComponents('target', 'workspace-1');

      expect(schema).toBeDefined();
      expect(schema.sections?.[0]?.component).toBe('InfoBanner');
      expect(schema.sections?.[0]?.props?.title).toContain('Target');
      expect(canvasSchemaService.generateSchema).toHaveBeenCalledWith(
        'workspace-1',
        expect.objectContaining({
          lifecycleStage: 'target',
        })
      );
    });

    it('should return fallback schema on error', async () => {
      vi.spyOn(canvasSchemaService, 'generateSchema').mockRejectedValue(
        new Error('Test error')
      );

      const schema = await adapter.showStageComponents('opportunity', 'workspace-1');

      expect(schema).toBeDefined();
      expect(schema.sections?.[0]?.component).toBe('InfoBanner');
      expect(schema.sections?.[0]?.props?.title).toContain('opportunity');
    });
  }););
  });
  describe('onStageCompletion', () => {
    it('should generate actions for completed stage', async () => {
      const event: StageCompletionEvent = {ed stage', async () => {
        workspace_id: 'workspace-1',ent = {
        stage_id: 'stage-1',pace-1',
        lifecycle_stage: 'opportunity',
        status: 'completed',portunity',
        output_data: {},ed',
        timestamp: Date.now().toString(),
      };timestamp: Date.now().toString(),
      };
      const actions = await adapter.onStageCompletion(event);
      const actions = await adapter.onStageCompletion(event);
      expect(actions.length).toBeGreaterThan(0);
      expect(actions.some((a) => a.type === 'mutate_component')).toBe(true);
    });xpect(actions.some((a) => a.type === 'mutate_component')).toBe(true);
    });
    it('should show success indicator for completed stage', async () => {
      const event: StageCompletionEvent = {ompleted stage', async () => {
        workspace_id: 'workspace-1',ent = {
        stage_id: 'stage-1',pace-1',
        lifecycle_stage: 'opportunity',
        status: 'completed',portunity',
        output_data: {},ed',
        timestamp: Date.now().toString(),
      };timestamp: Date.now().toString(),
      };
      const actions = await adapter.onStageCompletion(event);
      const actions = await adapter.onStageCompletion(event);
      const successAction = actions.find((a) =>
        a.type === 'mutate_component' &&((a) =>
        (a as any).mutations?.some((m: any) => m.value === 'check-circle')
      );(a as any).mutations?.some((m: any) => m.value === 'check-circle')
      expect(successAction).toBeDefined();
    });xpect(successAction).toBeDefined();
    });
    it('should show error indicator for failed stage', async () => {
      const event: StageCompletionEvent = {led stage', async () => {
        workspace_id: 'workspace-1',ent = {
        stage_id: 'stage-1',pace-1',
        lifecycle_stage: 'opportunity',
        status: 'failed','opportunity',
        output_data: {},,
        timestamp: Date.now().toString(),
      };timestamp: Date.now().toString(),
      };
      const actions = await adapter.onStageCompletion(event);
      const actions = await adapter.onStageCompletion(event);
      const errorAction = actions.find((a) =>
        a.type === 'mutate_component' &&a) =>
        (a as any).mutations?.some((m: any) => m.value === 'x-circle')
      );(a as any).mutations?.some((m: any) => m.value === 'x-circle')
      expect(errorAction).toBeDefined();
    });xpect(errorAction).toBeDefined();
  }););
  });
  describe('onWorkflowComplete', () => {
    it('should generate completion actions', async () => {
      const context = { completion actions', async () => {
        workspaceId: 'workspace-1',
      };workspaceId: 'workspace-1',
      };
      const actions = await adapter.onWorkflowComplete(
        'workflow-1', await adapter.onWorkflowComplete(
        'exec-1',-1',
        context',
      );context
      );
      expect(actions.length).toBeGreaterThan(0);
      expect(actions.some((a) => a.type === 'mutate_component')).toBe(true);
      expect(actions.some((a) => a.type === 'add_component')).toBe(true);e);
    });xpect(actions.some((a) => a.type === 'add_component')).toBe(true);
    });
    it('should show completion message', async () => {
      const context = {pletion message', async () => {
        workspaceId: 'workspace-1',
      };workspaceId: 'workspace-1',
      };
      const actions = await adapter.onWorkflowComplete(
        'workflow-1', await adapter.onWorkflowComplete(
        'exec-1',-1',
        context',
      );context
      );
      const alertAction = actions.find((a) =>
        a.type === 'add_component' &&d((a) =>
        (a as any).component?.component === 'Alert'
      );(a as any).component?.component === 'Alert'
      expect(alertAction).toBeDefined();
    });xpect(alertAction).toBeDefined();
  }););
}););
});
