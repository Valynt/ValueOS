/**
 * Workflow Lifecycle Integration
 * 
 * Connects ValueLifecycleOrchestrator with existing workflow system
 * Provides saga pattern integration with compensation
 */

import { ValueLifecycleOrchestrator, LifecycleStage, LifecycleContext, StageResult } from './ValueLifecycleOrchestrator';
import { WorkflowCompensation } from './WorkflowCompensation';
import { WorkflowStateRepository } from '../repositories/WorkflowStateRepository';
import { logger } from '../lib/logger';
import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Workflow execution status
 */
export type WorkflowExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'compensating' | 'compensated';

/**
 * Workflow execution record
 */
export interface WorkflowExecution {
  id: string;
  userId: string;
  status: WorkflowExecutionStatus;
  currentStage: LifecycleStage | null;
  completedStages: LifecycleStage[];
  failedStage: LifecycleStage | null;
  results: Record<LifecycleStage, StageResult>;
  error?: string;
  startedAt: Date;
  completedAt?: Date;
}

/**
 * Workflow execution options
 */
export interface WorkflowExecutionOptions {
  /** Start from specific stage */
  startStage?: LifecycleStage;
  /** Stop at specific stage */
  stopStage?: LifecycleStage;
  /** Enable automatic compensation on failure */
  autoCompensate?: boolean;
  /** Session ID for state management */
  sessionId?: string;
}

/**
 * Workflow Lifecycle Integration
 * 
 * Integrates ValueLifecycleOrchestrator with workflow system
 */
export class WorkflowLifecycleIntegration {
  private orchestrator: ValueLifecycleOrchestrator;
  private compensation: WorkflowCompensation;
  private stateRepository: WorkflowStateRepository;
  private executions: Map<string, WorkflowExecution> = new Map();

  constructor(private supabase: SupabaseClient) {
    this.orchestrator = new ValueLifecycleOrchestrator(supabase);
    this.compensation = new WorkflowCompensation();
    this.stateRepository = new WorkflowStateRepository(supabase);
  }

  /**
   * Execute complete lifecycle workflow
   */
  async executeWorkflow(
    userId: string,
    initialInput: any,
    options: WorkflowExecutionOptions = {}
  ): Promise<WorkflowExecution> {
    const executionId = `exec-${Date.now()}-${userId}`;
    const stages: LifecycleStage[] = this.getStageSequence(options);

    // Create execution record
    const execution: WorkflowExecution = {
      id: executionId,
      userId,
      status: 'pending',
      currentStage: null,
      completedStages: [],
      failedStage: null,
      results: {} as Record<LifecycleStage, StageResult>,
      startedAt: new Date()
    };

    this.executions.set(executionId, execution);

    // Create session for state management
    const sessionId = options.sessionId || await this.stateRepository.createSession(userId, {
      currentStage: stages[0],
      status: 'active',
      completedStages: [],
      context: { executionId, initialInput }
    });

    const context: LifecycleContext = {
      userId,
      sessionId,
      metadata: { executionId }
    };

    try {
      execution.status = 'running';
      let stageInput = initialInput;

      // Execute each stage in sequence
      for (const stage of stages) {
        execution.currentStage = stage;

        logger.info('Executing lifecycle stage', {
          executionId,
          stage,
          userId
        });

        // Execute stage with orchestrator
        const result = await this.orchestrator.executeLifecycleStage(
          stage,
          stageInput,
          context
        );

        // Store result
        execution.results[stage] = result;
        execution.completedStages.push(stage);

        // Update workflow state
        await this.stateRepository.saveState(sessionId, {
          currentStage: stage,
          status: 'active',
          completedStages: execution.completedStages,
          context: {
            executionId,
            results: execution.results
          }
        });

        // Use output as input for next stage
        stageInput = result.data;

        logger.info('Lifecycle stage completed', {
          executionId,
          stage,
          success: result.success
        });
      }

      // Mark as completed
      execution.status = 'completed';
      execution.currentStage = null;
      execution.completedAt = new Date();

      await this.stateRepository.updateSessionStatus(sessionId, 'completed');

      logger.info('Workflow execution completed', {
        executionId,
        completedStages: execution.completedStages.length
      });

      return execution;

    } catch (error) {
      execution.status = 'failed';
      execution.failedStage = execution.currentStage;
      execution.error = error instanceof Error ? error.message : 'Unknown error';

      logger.error('Workflow execution failed', error as Error, {
        executionId,
        failedStage: execution.failedStage
      });

      // Update session status
      await this.stateRepository.updateSessionStatus(sessionId, 'error');
      await this.stateRepository.incrementErrorCount(sessionId);

      // Compensate if enabled
      if (options.autoCompensate !== false) {
        await this.compensateWorkflow(executionId);
      }

      throw error;
    }
  }

  /**
   * Compensate failed workflow
   */
  async compensateWorkflow(executionId: string): Promise<void> {
    const execution = this.executions.get(executionId);
    if (!execution) {
      throw new Error(`Execution not found: ${executionId}`);
    }

    if (execution.status !== 'failed') {
      throw new Error(`Cannot compensate execution with status: ${execution.status}`);
    }

    execution.status = 'compensating';

    logger.info('Starting workflow compensation', {
      executionId,
      completedStages: execution.completedStages.length
    });

    try {
      // Use existing compensation system
      await this.compensation.rollbackExecution(executionId);

      execution.status = 'compensated';

      logger.info('Workflow compensation completed', {
        executionId
      });

    } catch (error) {
      logger.error('Workflow compensation failed', error as Error, {
        executionId
      });

      throw error;
    }
  }

  /**
   * Get workflow execution status
   */
  getExecution(executionId: string): WorkflowExecution | null {
    return this.executions.get(executionId) || null;
  }

  /**
   * Get all executions for a user
   */
  getUserExecutions(userId: string): WorkflowExecution[] {
    return Array.from(this.executions.values())
      .filter(exec => exec.userId === userId);
  }

  /**
   * Resume failed workflow from last successful stage
   */
  async resumeWorkflow(
    executionId: string,
    resumeInput?: any
  ): Promise<WorkflowExecution> {
    const execution = this.executions.get(executionId);
    if (!execution) {
      throw new Error(`Execution not found: ${executionId}`);
    }

    if (execution.status !== 'failed' && execution.status !== 'compensated') {
      throw new Error(`Cannot resume execution with status: ${execution.status}`);
    }

    logger.info('Resuming workflow execution', {
      executionId,
      fromStage: execution.failedStage
    });

    // Get last successful result
    const lastStage = execution.completedStages[execution.completedStages.length - 1];
    const lastResult = lastStage ? execution.results[lastStage] : null;
    const input = resumeInput || lastResult?.data;

    // Resume from failed stage
    const options: WorkflowExecutionOptions = {
      startStage: execution.failedStage || undefined,
      sessionId: execution.id,
      autoCompensate: true
    };

    return await this.executeWorkflow(execution.userId, input, options);
  }

  /**
   * Get stage sequence based on options
   */
  private getStageSequence(options: WorkflowExecutionOptions): LifecycleStage[] {
    const allStages: LifecycleStage[] = [
      'opportunity',
      'target',
      'expansion',
      'integrity',
      'realization'
    ];

    let stages = allStages;

    // Filter by start stage
    if (options.startStage) {
      const startIndex = allStages.indexOf(options.startStage);
      stages = allStages.slice(startIndex);
    }

    // Filter by stop stage
    if (options.stopStage) {
      const stopIndex = allStages.indexOf(options.stopStage);
      stages = stages.slice(0, stopIndex + 1);
    }

    return stages;
  }

  /**
   * Clean up old executions
   */
  cleanupExecutions(olderThanMs: number = 24 * 60 * 60 * 1000): number {
    const cutoff = Date.now() - olderThanMs;
    let cleaned = 0;

    for (const [id, execution] of this.executions.entries()) {
      if (execution.startedAt.getTime() < cutoff) {
        this.executions.delete(id);
        cleaned++;
      }
    }

    logger.info('Cleaned up old workflow executions', { cleaned });

    return cleaned;
  }
}

/**
 * Singleton instance
 */
let integrationInstance: WorkflowLifecycleIntegration | null = null;

/**
 * Get or create integration instance
 */
export function getWorkflowLifecycleIntegration(supabase: SupabaseClient): WorkflowLifecycleIntegration {
  if (!integrationInstance) {
    integrationInstance = new WorkflowLifecycleIntegration(supabase);
  }
  return integrationInstance;
}

/**
 * Reset integration (for testing)
 */
export function resetWorkflowLifecycleIntegration(): void {
  integrationInstance = null;
}
