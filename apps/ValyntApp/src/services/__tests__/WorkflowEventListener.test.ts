import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { workflowEventListener } from '../WorkflowEventListener';
import { OPPORTUNITY_WORKFLOW, TARGET_WORKFLOW } from '../workflows/WorkflowDAGDefinitions';
import { workflowSDUIAdapter } from '../WorkflowSDUIAdapter';

// Mock dependencies
vi.mock('../WorkflowSDUIAdapter', () => ({
  workflowSDUIAdapter: {
    onStageCompletion: vi.fn().mockResolvedValue([]),
    onStageTransition: vi.fn().mockResolvedValue({ type: 'partial' }),
    updateProgress: vi.fn().mockResolvedValue([]),
    onWorkflowComplete: vi.fn().mockResolvedValue([]),
  }
}));

vi.mock('../CanvasSchemaService', () => ({
  canvasSchemaService: {
    invalidateCache: vi.fn(),
  }
}));

vi.mock('../lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }
}));

describe('WorkflowEventListener Lifecycle Stage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear listeners to avoid side effects from other tests if any (though this runs in isolation usually)
    // workflowEventListener.removeAllListeners(); // EventEmitter method
  });

  it('should correctly identify "target" lifecycle stage from definition', async () => {
    const workflowId = TARGET_WORKFLOW.id; // 'target-value-commit-v1'
    const stageId = TARGET_WORKFLOW.stages[0].id; // 'target_definition'
    // This stage has agent_type: 'target'

    const completionSpy = vi.fn();
    workflowEventListener.on('workflow:stage_completed', completionSpy);

    await workflowEventListener.handleStageCompletion(
      workflowId,
      stageId,
      'completed',
      100
    );

    expect(completionSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        workflowId,
        stageId,
        lifecycleStage: 'target'
      })
    );
  });

  it('should correctly identify "opportunity" lifecycle stage from definition', async () => {
    const workflowId = OPPORTUNITY_WORKFLOW.id;
    const stageId = OPPORTUNITY_WORKFLOW.stages[0].id; // 'opportunity_research'
    // This stage has agent_type: 'opportunity'

    const completionSpy = vi.fn();
    workflowEventListener.on('workflow:stage_completed', completionSpy);

    await workflowEventListener.handleStageCompletion(
      workflowId,
      stageId,
      'completed',
      100
    );

    expect(completionSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        workflowId,
        stageId,
        lifecycleStage: 'opportunity'
      })
    );
  });

  it('should fallback to "opportunity" if stage definition is not found', async () => {
    const workflowId = 'unknown-workflow-id';
    const stageId = 'unknown-stage-id';

    const completionSpy = vi.fn();
    workflowEventListener.on('workflow:stage_completed', completionSpy);

    await workflowEventListener.handleStageCompletion(
      workflowId,
      stageId,
      'completed',
      100
    );

    expect(completionSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        workflowId,
        stageId,
        lifecycleStage: 'opportunity'
      })
    );
  });
});
