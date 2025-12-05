/**
 * Workflow SDUI Adapter
 * 
 * Converts workflow events to SDUI updates.
 * Handles stage transitions, progress updates, and workflow completion.
 */

import { logger } from '../lib/logger';
import { SDUIPageDefinition } from '../sdui/schema';
import { SDUIUpdate } from '../types/sdui-integration';
import { LifecycleStage } from '../types/workflow';
import {
  WorkflowProgress,
  StageTransitionEvent,
  StageCompletionEvent,
  WorkflowSDUIUpdate,
} from '../types/workflow-sdui';
import {
  AtomicUIAction,
  createMutateAction,
  createAddAction,
  createRemoveAction,
} from '../sdui/AtomicUIActions';
import { canvasSchemaService } from './CanvasSchemaService';

/**
 * Workflow SDUI Adapter
 */
export class WorkflowSDUIAdapter {
  /**
   * Handle workflow stage transition
   */
  async onStageTransition(
    workflowId: string,
    fromStage: string | null,
    toStage: string,
    context: any
  ): Promise<SDUIUpdate> {
    logger.info('Handling workflow stage transition', {
      workflowId,
      fromStage,
      toStage,
    });

    try {
      const event: StageTransitionEvent = {
        workflowId,
        executionId: context.executionId || workflowId,
        fromStage,
        toStage,
        fromLifecycleStage: this.getLifecycleStage(fromStage),
        toLifecycleStage: this.getLifecycleStage(toStage),
        timestamp: Date.now(),
        context,
      };

      // Generate atomic actions for stage transition
      const actions = await this.generateStageTransitionActions(event);

      // Determine if full schema regeneration needed
      const needsFullSchema = this.needsFullSchemaRegeneration(event);

      if (needsFullSchema) {
        // Invalidate cache to trigger full regeneration
        const workspaceId = context.workspaceId || context.workspace_id;
        if (workspaceId) {
          canvasSchemaService.invalidateCache(workspaceId);
        }
      }

      const update: SDUIUpdate = {
        type: needsFullSchema ? 'full_schema' : 'atomic_actions',
        workspaceId: context.workspaceId || context.workspace_id || workflowId,
        actions,
        timestamp: Date.now(),
        source: `workflow:${workflowId}`,
      };

      logger.info('Generated SDUI update for stage transition', {
        workflowId,
        updateType: update.type,
        actionCount: actions.length,
      });

      return update;
    } catch (error) {
      logger.error('Failed to handle stage transition', {
        workflowId,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        type: 'partial_update',
        workspaceId: context.workspaceId || workflowId,
        actions: [],
        timestamp: Date.now(),
        source: `workflow:${workflowId}`,
      };
    }
  }

  /**
   * Update workflow progress UI
   */
  async updateProgress(
    workflowId: string,
    progress: WorkflowProgress
  ): Promise<AtomicUIAction[]> {
    logger.info('Updating workflow progress UI', {
      workflowId,
      percentComplete: progress.percentComplete,
    });

    const actions: AtomicUIAction[] = [];

    try {
      // Update progress bar component
      actions.push(
        createMutateAction(
          { type: 'ProgressBar', props: { workflowId } },
          [
            {
              path: 'props.percentComplete',
              operation: 'set',
              value: progress.percentComplete,
            },
            {
              path: 'props.currentStage',
              operation: 'set',
              value: progress.currentStage,
            },
          ],
          'Update workflow progress'
        )
      );

      // Update stage indicator
      actions.push(
        createMutateAction(
          { type: 'StageIndicator', props: { workflowId } },
          [
            {
              path: 'props.currentStageIndex',
              operation: 'set',
              value: progress.currentStageIndex,
            },
            {
              path: 'props.completedStages',
              operation: 'set',
              value: progress.completedStages,
            },
          ],
          'Update stage indicator'
        )
      );

      // If estimated time available, update it
      if (progress.estimatedTimeRemaining !== undefined) {
        actions.push(
          createMutateAction(
            { type: 'ProgressBar', props: { workflowId } },
            [
              {
                path: 'props.estimatedTimeRemaining',
                operation: 'set',
                value: progress.estimatedTimeRemaining,
              },
            ],
            'Update estimated time'
          )
        );
      }

      logger.info('Generated progress update actions', {
        workflowId,
        actionCount: actions.length,
      });
    } catch (error) {
      logger.error('Failed to generate progress update actions', {
        workflowId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return actions;
  }

  /**
   * Show stage-specific components
   */
  async showStageComponents(
    stage: LifecycleStage,
    workspaceId: string
  ): Promise<SDUIPageDefinition> {
    logger.info('Showing stage-specific components', {
      stage,
      workspaceId,
    });

    try {
      // Generate schema for the specific stage
      const schema = await canvasSchemaService.generateSchema(workspaceId, {
        workspaceId,
        userId: 'system',
        lifecycleStage: stage,
      });

      logger.info('Generated stage-specific schema', {
        stage,
        componentCount: schema.sections.length,
      });

      return schema;
    } catch (error) {
      logger.error('Failed to generate stage-specific schema', {
        stage,
        error: error instanceof Error ? error.message : String(error),
      });

      // Return fallback schema
      return {
        type: 'page',
        version: 1,
        sections: [
          {
            type: 'component',
            component: 'InfoBanner',
            version: 1,
            props: {
              title: `${stage} Stage`,
              description: 'Loading stage components...',
              tone: 'info',
            },
          },
        ],
      };
    }
  }

  /**
   * Handle stage completion
   */
  async onStageCompletion(
    event: StageCompletionEvent
  ): Promise<AtomicUIAction[]> {
    logger.info('Handling stage completion', {
      workflowId: event.workflowId,
      stageId: event.stageId,
      status: event.status,
    });

    const actions: AtomicUIAction[] = [];

    try {
      // Update stage status indicator
      actions.push(
        createMutateAction(
          { id: `stage-${event.stageId}` },
          [
            {
              path: 'props.status',
              operation: 'set',
              value: event.status,
            },
            {
              path: 'props.duration',
              operation: 'set',
              value: event.duration,
            },
          ],
          `Mark stage ${event.stageId} as ${event.status}`
        )
      );

      // If stage completed successfully, show success indicator
      if (event.status === 'completed') {
        actions.push(
          createMutateAction(
            { id: `stage-${event.stageId}` },
            [
              {
                path: 'props.icon',
                operation: 'set',
                value: 'check-circle',
              },
              {
                path: 'props.color',
                operation: 'set',
                value: 'green',
              },
            ],
            'Show success indicator'
          )
        );
      }

      // If stage failed, show error indicator
      if (event.status === 'failed') {
        actions.push(
          createMutateAction(
            { id: `stage-${event.stageId}` },
            [
              {
                path: 'props.icon',
                operation: 'set',
                value: 'x-circle',
              },
              {
                path: 'props.color',
                operation: 'set',
                value: 'red',
              },
            ],
            'Show error indicator'
          )
        );
      }

      logger.info('Generated stage completion actions', {
        workflowId: event.workflowId,
        actionCount: actions.length,
      });
    } catch (error) {
      logger.error('Failed to generate stage completion actions', {
        workflowId: event.workflowId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return actions;
  }

  /**
   * Handle workflow completion
   */
  async onWorkflowComplete(
    workflowId: string,
    executionId: string,
    context: any
  ): Promise<AtomicUIAction[]> {
    logger.info('Handling workflow completion', {
      workflowId,
      executionId,
    });

    const actions: AtomicUIAction[] = [];

    try {
      // Update workflow status
      actions.push(
        createMutateAction(
          { type: 'WorkflowProgress', props: { workflowId } },
          [
            {
              path: 'props.status',
              operation: 'set',
              value: 'completed',
            },
            {
              path: 'props.percentComplete',
              operation: 'set',
              value: 100,
            },
          ],
          'Mark workflow as completed'
        )
      );

      // Show completion message
      actions.push(
        createAddAction(
          {
            component: 'Alert',
            props: {
              variant: 'success',
              title: 'Workflow Completed',
              message: 'All stages completed successfully',
              dismissible: true,
            },
          },
          { append: true },
          'Show completion message'
        )
      );

      logger.info('Generated workflow completion actions', {
        workflowId,
        actionCount: actions.length,
      });
    } catch (error) {
      logger.error('Failed to generate workflow completion actions', {
        workflowId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return actions;
  }

  /**
   * Generate atomic actions for stage transition
   */
  private async generateStageTransitionActions(
    event: StageTransitionEvent
  ): Promise<AtomicUIAction[]> {
    const actions: AtomicUIAction[] = [];

    // Update current stage indicator
    if (event.fromStage) {
      actions.push(
        createMutateAction(
          { id: `stage-${event.fromStage}` },
          [
            {
              path: 'props.active',
              operation: 'set',
              value: false,
            },
          ],
          'Deactivate previous stage'
        )
      );
    }

    actions.push(
      createMutateAction(
        { id: `stage-${event.toStage}` },
        [
          {
            path: 'props.active',
            operation: 'set',
            value: true,
          },
          {
            path: 'props.status',
            operation: 'set',
            value: 'in_progress',
          },
        ],
        'Activate new stage'
      )
    );

    // If lifecycle stage changed, trigger full schema regeneration
    if (
      event.fromLifecycleStage &&
      event.toLifecycleStage &&
      event.fromLifecycleStage !== event.toLifecycleStage
    ) {
      logger.info('Lifecycle stage changed, will trigger full schema regeneration', {
        from: event.fromLifecycleStage,
        to: event.toLifecycleStage,
      });
    }

    return actions;
  }

  /**
   * Get lifecycle stage from workflow stage ID
   */
  private getLifecycleStage(stageId: string | null): LifecycleStage | undefined {
    if (!stageId) return undefined;

    // Map workflow stage IDs to lifecycle stages
    // This is a simplified mapping - in production, this should query the workflow definition
    const stageMap: Record<string, LifecycleStage> = {
      opportunity: 'opportunity',
      target: 'target',
      expansion: 'expansion',
      integrity: 'integrity',
      realization: 'realization',
    };

    // Try to extract lifecycle stage from stage ID
    for (const [key, value] of Object.entries(stageMap)) {
      if (stageId.toLowerCase().includes(key)) {
        return value;
      }
    }

    return undefined;
  }

  /**
   * Determine if full schema regeneration is needed
   */
  private needsFullSchemaRegeneration(event: StageTransitionEvent): boolean {
    // If lifecycle stage changed, need full regeneration
    if (
      event.fromLifecycleStage &&
      event.toLifecycleStage &&
      event.fromLifecycleStage !== event.toLifecycleStage
    ) {
      return true;
    }

    // If transitioning to final stage, need full regeneration
    if (event.toStage.includes('final') || event.toStage.includes('complete')) {
      return true;
    }

    return false;
  }
}

// Singleton instance
export const workflowSDUIAdapter = new WorkflowSDUIAdapter();
