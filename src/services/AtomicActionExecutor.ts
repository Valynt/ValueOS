/**
 * Atomic Action Executor
 * 
 * Executes atomic UI actions with optimistic updates and rollback support.
 * Provides high-level interface for surgical UI updates.
 */

import { logger } from '../lib/logger';
import { SDUIPageDefinition } from '../sdui/schema';
import { AtomicUIAction, ActionResult } from '../sdui/AtomicUIActions';
import { ComponentMutationService } from './ComponentMutationService';
import { canvasSchemaService } from './CanvasSchemaService';

/**
 * Execution result with rollback support
 */
export interface ExecutionResult {
  success: boolean;
  executionId: string;
  originalSchema: SDUIPageDefinition;
  updatedSchema: SDUIPageDefinition;
  actionResult: ActionResult;
  canRollback: boolean;
}

/**
 * Optimistic execution result
 */
export interface OptimisticResult {
  executionId: string;
  optimisticSchema: SDUIPageDefinition;
  pending: Promise<ExecutionResult>;
}

/**
 * Batch execution result
 */
export interface BatchResult {
  success: boolean;
  executionId: string;
  results: ActionResult[];
  totalAffectedComponents: number;
  totalChanges: number;
  duration: number;
}

/**
 * Execution history entry
 */
interface ExecutionHistoryEntry {
  executionId: string;
  action: AtomicUIAction;
  originalSchema: SDUIPageDefinition;
  updatedSchema: SDUIPageDefinition;
  timestamp: number;
  workspaceId: string;
}

/**
 * Atomic Action Executor
 */
export class AtomicActionExecutor {
  private mutationService: ComponentMutationService;
  private executionHistory: Map<string, ExecutionHistoryEntry>;
  private readonly MAX_HISTORY_SIZE = 100;

  constructor(mutationService?: ComponentMutationService) {
    this.mutationService = mutationService || new ComponentMutationService();
    this.executionHistory = new Map();
  }

  /**
   * Execute atomic action
   */
  async executeAction(
    action: AtomicUIAction,
    schema: SDUIPageDefinition,
    workspaceId: string
  ): Promise<ExecutionResult> {
    const executionId = this.generateExecutionId();

    logger.info('Executing atomic action', {
      executionId,
      actionType: action.type,
      workspaceId,
    });

    try {
      // Apply action using mutation service
      const { layout: updatedSchema, result: actionResult } =
        await this.mutationService.applyAction(schema, action);

      // Store in history for rollback
      this.addToHistory({
        executionId,
        action,
        originalSchema: schema,
        updatedSchema,
        timestamp: Date.now(),
        workspaceId,
      });

      const executionResult: ExecutionResult = {
        success: actionResult.success,
        executionId,
        originalSchema: schema,
        updatedSchema,
        actionResult,
        canRollback: true,
      };

      logger.info('Atomic action executed', {
        executionId,
        success: actionResult.success,
        affectedComponents: actionResult.affected_components.length,
      });

      return executionResult;
    } catch (error) {
      logger.error('Failed to execute atomic action', {
        executionId,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        executionId,
        originalSchema: schema,
        updatedSchema: schema,
        actionResult: {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          affected_components: [],
          changes_made: [],
          duration_ms: 0,
        },
        canRollback: false,
      };
    }
  }

  /**
   * Execute action optimistically
   */
  async executeOptimistically(
    action: AtomicUIAction,
    schema: SDUIPageDefinition,
    workspaceId: string
  ): Promise<OptimisticResult> {
    const executionId = this.generateExecutionId();

    logger.info('Executing action optimistically', {
      executionId,
      actionType: action.type,
      workspaceId,
    });

    try {
      // Apply action immediately for optimistic update
      const { layout: optimisticSchema } = await this.mutationService.applyAction(
        schema,
        action
      );

      // Start actual execution in background
      const pending = this.executeAction(action, schema, workspaceId);

      // Handle background execution result
      pending.then((result) => {
        if (!result.success) {
          logger.warn('Optimistic action failed, rollback needed', {
            executionId,
            error: result.actionResult.error,
          });
        }
      });

      return {
        executionId,
        optimisticSchema,
        pending,
      };
    } catch (error) {
      logger.error('Failed to execute optimistically', {
        executionId,
        error: error instanceof Error ? error.message : String(error),
      });

      // Fall back to synchronous execution
      const pending = this.executeAction(action, schema, workspaceId);
      return {
        executionId,
        optimisticSchema: schema,
        pending,
      };
    }
  }

  /**
   * Rollback execution
   */
  async rollback(executionId: string, workspaceId: string): Promise<boolean> {
    logger.info('Rolling back execution', { executionId, workspaceId });

    try {
      const entry = this.executionHistory.get(executionId);

      if (!entry) {
        logger.error('Execution not found in history', { executionId });
        return false;
      }

      if (entry.workspaceId !== workspaceId) {
        logger.error('Workspace ID mismatch', {
          executionId,
          expected: entry.workspaceId,
          actual: workspaceId,
        });
        return false;
      }

      // Restore original schema
      canvasSchemaService.invalidateCache(workspaceId);

      // Remove from history
      this.executionHistory.delete(executionId);

      logger.info('Execution rolled back', { executionId });
      return true;
    } catch (error) {
      logger.error('Failed to rollback execution', {
        executionId,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Execute batch of actions
   */
  async executeBatch(
    actions: AtomicUIAction[],
    schema: SDUIPageDefinition,
    workspaceId: string
  ): Promise<BatchResult> {
    const executionId = this.generateExecutionId();
    const startTime = Date.now();

    logger.info('Executing batch of actions', {
      executionId,
      actionCount: actions.length,
      workspaceId,
    });

    const results: ActionResult[] = [];
    let currentSchema = schema;
    let totalAffectedComponents = 0;
    let totalChanges = 0;
    let allSuccessful = true;

    try {
      for (const action of actions) {
        const { layout: updatedSchema, result } =
          await this.mutationService.applyAction(currentSchema, action);

        results.push(result);

        if (result.success) {
          currentSchema = updatedSchema;
          totalAffectedComponents += result.affected_components.length;
          totalChanges += result.changes_made.length;
        } else {
          allSuccessful = false;
          logger.warn('Action in batch failed', {
            executionId,
            actionType: action.type,
            error: result.error,
          });
          // Continue with remaining actions
        }
      }

      // Store batch in history
      this.addToHistory({
        executionId,
        action: { type: 'batch', actions, atomic: true, reason: 'Batch execution' },
        originalSchema: schema,
        updatedSchema: currentSchema,
        timestamp: Date.now(),
        workspaceId,
      });

      const batchResult: BatchResult = {
        success: allSuccessful,
        executionId,
        results,
        totalAffectedComponents,
        totalChanges,
        duration: Date.now() - startTime,
      };

      logger.info('Batch execution complete', {
        executionId,
        success: allSuccessful,
        totalAffectedComponents,
        totalChanges,
        duration: batchResult.duration,
      });

      return batchResult;
    } catch (error) {
      logger.error('Failed to execute batch', {
        executionId,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        executionId,
        results,
        totalAffectedComponents,
        totalChanges,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Get execution history
   */
  getHistory(workspaceId: string): ExecutionHistoryEntry[] {
    return Array.from(this.executionHistory.values()).filter(
      (entry) => entry.workspaceId === workspaceId
    );
  }

  /**
   * Clear execution history
   */
  clearHistory(workspaceId?: string): void {
    if (workspaceId) {
      // Clear history for specific workspace
      for (const [id, entry] of this.executionHistory.entries()) {
        if (entry.workspaceId === workspaceId) {
          this.executionHistory.delete(id);
        }
      }
      logger.info('Cleared execution history for workspace', { workspaceId });
    } else {
      // Clear all history
      this.executionHistory.clear();
      logger.info('Cleared all execution history');
    }
  }

  /**
   * Generate execution ID
   */
  private generateExecutionId(): string {
    return `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Add to execution history
   */
  private addToHistory(entry: ExecutionHistoryEntry): void {
    this.executionHistory.set(entry.executionId, entry);

    // Limit history size
    if (this.executionHistory.size > this.MAX_HISTORY_SIZE) {
      const oldestId = Array.from(this.executionHistory.keys())[0];
      this.executionHistory.delete(oldestId);
    }
  }

  /**
   * Get execution by ID
   */
  getExecution(executionId: string): ExecutionHistoryEntry | undefined {
    return this.executionHistory.get(executionId);
  }

  /**
   * Can rollback execution
   */
  canRollback(executionId: string): boolean {
    return this.executionHistory.has(executionId);
  }
}

// Singleton instance
export const atomicActionExecutor = new AtomicActionExecutor();
