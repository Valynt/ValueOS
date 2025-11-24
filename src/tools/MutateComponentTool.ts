/**
 * Mutate Component Tool
 * 
 * MCP-compatible tool for atomic UI mutations.
 * Enables agents to modify specific components without full page regeneration.
 */

import { Tool, ToolResult, ExecutionContext } from '../services/ToolRegistry';
import { ComponentMutationService } from '../services/ComponentMutationService';
import { SDUIPageDefinition } from '../sdui/schema';
import {
  AtomicUIAction,
  ComponentSelector,
  PropertyMutation,
  createMutateAction,
  createPropertyUpdate,
  createAddAction,
  createRemoveAction,
  createBatchAction,
  validateAtomicAction,
} from '../sdui/AtomicUIActions';
import { logger } from '../lib/logger';

/**
 * Mutate Component Tool
 */
export class MutateComponentTool implements Tool {
  name = 'mutate_component';
  description = 'Apply atomic mutations to UI components without full page regeneration';
  version = '1.0.0';

  parameters = {
    type: 'object' as const,
    properties: {
      layout: {
        type: 'object',
        description: 'Current SDUI page layout',
        required: true,
      },
      action: {
        type: 'object',
        description: 'Atomic UI action to apply',
        required: true,
        properties: {
          type: {
            type: 'string',
            enum: [
              'mutate_component',
              'add_component',
              'remove_component',
              'reorder_components',
              'update_layout',
              'batch',
            ],
            description: 'Type of action to perform',
          },
        },
      },
    },
    required: ['layout', 'action'],
  };

  private mutationService: ComponentMutationService;

  constructor() {
    this.mutationService = new ComponentMutationService();
  }

  async execute(
    parameters: {
      layout: SDUIPageDefinition;
      action: AtomicUIAction;
    },
    context: ExecutionContext
  ): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      logger.info('Executing mutate_component tool', {
        action_type: parameters.action.type,
        user_id: context.userId,
        organization_id: context.organizationId,
      });

      // Validate action
      const validation = validateAtomicAction(parameters.action);
      if (!validation.valid) {
        return {
          success: false,
          data: null,
          error: `Invalid action: ${validation.errors.join(', ')}`,
          metadata: {
            duration_ms: Date.now() - startTime,
          },
        };
      }

      // Apply action
      const { layout, result } = await this.mutationService.applyAction(
        parameters.layout,
        parameters.action
      );

      if (!result.success) {
        return {
          success: false,
          data: null,
          error: result.error || 'Action failed',
          metadata: {
            duration_ms: Date.now() - startTime,
            affected_components: result.affected_components,
          },
        };
      }

      return {
        success: true,
        data: {
          layout,
          affected_components: result.affected_components,
          changes_made: result.changes_made,
        },
        metadata: {
          duration_ms: Date.now() - startTime,
          action_type: parameters.action.type,
        },
      };
    } catch (error) {
      logger.error('mutate_component tool failed', {
        error: error instanceof Error ? error.message : String(error),
        user_id: context.userId,
      });

      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : String(error),
        metadata: {
          duration_ms: Date.now() - startTime,
        },
      };
    }
  }
}

/**
 * Quick Mutate Tool (simplified interface)
 * 
 * Provides a simpler interface for common mutations.
 */
export class QuickMutateTool implements Tool {
  name = 'quick_mutate';
  description = 'Quick mutations for common UI changes (simplified interface)';
  version = '1.0.0';

  parameters = {
    type: 'object' as const,
    properties: {
      layout: {
        type: 'object',
        description: 'Current SDUI page layout',
        required: true,
      },
      operation: {
        type: 'string',
        enum: [
          'change_chart_type',
          'update_metric_value',
          'change_color',
          'add_component',
          'remove_component',
          'update_title',
        ],
        description: 'Quick operation to perform',
        required: true,
      },
      target: {
        type: 'object',
        description: 'Component selector (type, index, or description)',
        properties: {
          type: { type: 'string' },
          index: { type: 'number' },
          description: { type: 'string' },
        },
      },
      value: {
        type: 'any',
        description: 'New value to set',
      },
    },
    required: ['layout', 'operation', 'target'],
  };

  private mutationService: ComponentMutationService;

  constructor() {
    this.mutationService = new ComponentMutationService();
  }

  async execute(
    parameters: {
      layout: SDUIPageDefinition;
      operation: string;
      target: ComponentSelector;
      value?: any;
    },
    context: ExecutionContext
  ): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      // Convert quick operation to atomic action
      const action = this.convertToAction(
        parameters.operation,
        parameters.target,
        parameters.value
      );

      if (!action) {
        return {
          success: false,
          data: null,
          error: `Unknown operation: ${parameters.operation}`,
          metadata: {
            duration_ms: Date.now() - startTime,
          },
        };
      }

      // Apply action
      const { layout, result } = await this.mutationService.applyAction(
        parameters.layout,
        action
      );

      if (!result.success) {
        return {
          success: false,
          data: null,
          error: result.error || 'Operation failed',
          metadata: {
            duration_ms: Date.now() - startTime,
          },
        };
      }

      return {
        success: true,
        data: {
          layout,
          affected_components: result.affected_components,
          changes_made: result.changes_made,
        },
        metadata: {
          duration_ms: Date.now() - startTime,
          operation: parameters.operation,
        },
      };
    } catch (error) {
      logger.error('quick_mutate tool failed', {
        error: error instanceof Error ? error.message : String(error),
        operation: parameters.operation,
      });

      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : String(error),
        metadata: {
          duration_ms: Date.now() - startTime,
        },
      };
    }
  }

  private convertToAction(
    operation: string,
    target: ComponentSelector,
    value?: any
  ): AtomicUIAction | null {
    switch (operation) {
      case 'change_chart_type':
        return createPropertyUpdate(
          target,
          'props.type',
          value,
          `Change chart type to ${value}`
        );

      case 'update_metric_value':
        return createPropertyUpdate(
          target,
          'props.value',
          value,
          `Update metric value to ${value}`
        );

      case 'change_color':
        return createPropertyUpdate(
          target,
          'props.color',
          value,
          `Change color to ${value}`
        );

      case 'update_title':
        return createPropertyUpdate(
          target,
          'props.title',
          value,
          `Update title to ${value}`
        );

      case 'add_component':
        if (!value || !value.component || !value.props) {
          return null;
        }
        return createAddAction(
          value,
          { append: true },
          `Add ${value.component} component`
        );

      case 'remove_component':
        return createRemoveAction(target, 'Remove component');

      default:
        return null;
    }
  }
}

/**
 * Batch Mutate Tool
 * 
 * Apply multiple mutations in a single operation.
 */
export class BatchMutateTool implements Tool {
  name = 'batch_mutate';
  description = 'Apply multiple UI mutations in a single atomic operation';
  version = '1.0.0';

  parameters = {
    type: 'object' as const,
    properties: {
      layout: {
        type: 'object',
        description: 'Current SDUI page layout',
        required: true,
      },
      actions: {
        type: 'array',
        description: 'Array of atomic actions to apply',
        items: {
          type: 'object',
        },
        required: true,
      },
    },
    required: ['layout', 'actions'],
  };

  private mutationService: ComponentMutationService;

  constructor() {
    this.mutationService = new ComponentMutationService();
  }

  async execute(
    parameters: {
      layout: SDUIPageDefinition;
      actions: AtomicUIAction[];
    },
    context: ExecutionContext
  ): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      logger.info('Executing batch_mutate tool', {
        action_count: parameters.actions.length,
        user_id: context.userId,
      });

      // Apply all actions
      const { layout, results } = await this.mutationService.applyActions(
        parameters.layout,
        parameters.actions
      );

      const allSucceeded = results.every((r) => r.success);
      const allAffectedComponents = [
        ...new Set(results.flatMap((r) => r.affected_components)),
      ];
      const allChangesMade = results.flatMap((r) => r.changes_made);

      return {
        success: allSucceeded,
        data: {
          layout,
          affected_components: allAffectedComponents,
          changes_made: allChangesMade,
          results,
        },
        metadata: {
          duration_ms: Date.now() - startTime,
          action_count: parameters.actions.length,
          success_count: results.filter((r) => r.success).length,
        },
      };
    } catch (error) {
      logger.error('batch_mutate tool failed', {
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : String(error),
        metadata: {
          duration_ms: Date.now() - startTime,
        },
      };
    }
  }
}

export default MutateComponentTool;
