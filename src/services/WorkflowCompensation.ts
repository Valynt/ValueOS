import { supabase } from '../lib/supabase';
import {
  CompensationContext,
  CompensationPolicy,
  ExecutedStep,
  LifecycleStage,
  RollbackState
} from '../types/workflow';

type CompensationHandler = (context: CompensationContext) => Promise<void>;

export class WorkflowCompensation {
  private static readonly ROLLBACK_TIMEOUT_MS = 5000;
  private handlers: Map<LifecycleStage, CompensationHandler> = new Map();

  constructor() {
    this.registerHandlers();
  }

  private registerHandlers(): void {
    this.handlers.set('opportunity', this.compensateOpportunityStage.bind(this));
    this.handlers.set('target', this.compensateTargetStage.bind(this));
    this.handlers.set('realization', this.compensateRealizationStage.bind(this));
    this.handlers.set('expansion', this.compensateExpansionStage.bind(this));
    this.handlers.set('integrity', this.compensateIntegrityStage.bind(this));
  }

  async rollbackExecution(executionId: string): Promise<void> {
    const { data: execution, error: executionError } = await supabase
      .from('workflow_executions')
      .select('status, context')
      .eq('id', executionId)
      .maybeSingle();

    if (executionError) throw new Error('Failed to fetch execution for rollback');

    const executionContext = execution?.context || {};
    const executedSteps: ExecutedStep[] = executionContext.executed_steps || [];

    const rollbackState: RollbackState = executionContext.rollback_state || {
      status: 'idle',
      completed_steps: []
    };

    if (!execution || executedSteps.length === 0) return;
    if (rollbackState.status === 'completed') return;
    if (rollbackState.status === 'in_progress') return;

    const { data: logs, error: logsError } = await supabase
      .from('workflow_execution_logs')
      .select('*')
      .eq('execution_id', executionId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false });

    if (logsError) throw new Error('Failed to fetch execution logs for rollback');
    if (!logs || logs.length === 0) return;

    await this.logRollbackEvent(executionId, 'started', { stages_to_rollback: executedSteps.length });

    const logByStage = new Map<string, any>();
    for (const log of logs) {
      if (!logByStage.has(log.stage_id)) {
        logByStage.set(log.stage_id, log);
      }
    }

    const policy = this.getCompensationPolicy(executionContext);
    let updatedRollbackState: RollbackState = { ...rollbackState, status: 'in_progress' };
    await this.persistRollbackState(executionId, executionContext, updatedRollbackState);

    for (const step of [...executedSteps].reverse()) {
      if (updatedRollbackState.completed_steps.includes(step.stage_id)) {
        continue;
      }

      const log = logByStage.get(step.stage_id);
      if (!log) continue;

      const compensationContext: CompensationContext = {
        execution_id: executionId,
        stage_id: step.stage_id,
        artifacts_created: log.output_data?.artifacts_created || [],
        state_changes: log.output_data || {}
      };

      const handler = this.resolveHandler(step.compensator, step.stage_type);

      try {
        if (handler) {
          await this.executeWithTimeout(handler(compensationContext));
        }
        updatedRollbackState = {
          ...updatedRollbackState,
          completed_steps: [...updatedRollbackState.completed_steps, step.stage_id]
        };
        await this.persistRollbackState(executionId, executionContext, updatedRollbackState);
        await this.logRollbackEvent(executionId, 'stage_compensated', {
          stage_id: step.stage_id,
          stage_type: step.stage_type,
          compensator: step.compensator
        });
      } catch (error) {
        updatedRollbackState = {
          ...updatedRollbackState,
          status: 'failed',
          failed_stage: step.stage_id
        };
        await this.persistRollbackState(executionId, executionContext, updatedRollbackState);
        await this.logRollbackEvent(executionId, 'stage_compensation_failed', {
          stage_id: step.stage_id,
          error: (error as Error).message
        });

        if (policy === 'halt_on_error') {
          return;
        }
      }
    }

    updatedRollbackState = { ...updatedRollbackState, status: 'completed' };
    await this.persistRollbackState(executionId, executionContext, updatedRollbackState, true);
    await this.logRollbackEvent(executionId, 'completed', { stages_rolled_back: executedSteps.length });
  }

  private async persistRollbackState(
    executionId: string,
    executionContext: Record<string, any>,
    rollbackState: RollbackState,
    markRolledBack = false
  ): Promise<void> {
    const updatedContext = { ...executionContext, rollback_state: rollbackState };

    const update: Record<string, any> = {
      context: updatedContext,
      updated_at: new Date().toISOString()
    };

    if (markRolledBack) {
      update.status = 'rolled_back';
      update.completed_at = new Date().toISOString();
    }

    await supabase
      .from('workflow_executions')
      .update(update)
      .eq('id', executionId);
  }

  private async compensateOpportunityStage(context: CompensationContext): Promise<void> {
    for (const artifactId of context.artifacts_created) {
      await supabase
        .from('opportunity_artifacts')
        .delete()
        .eq('id', artifactId);
    }
  }

  private async compensateTargetStage(context: CompensationContext): Promise<void> {
    for (const artifactId of context.artifacts_created) {
      await supabase
        .from('target_artifacts')
        .update({
          status: 'draft',
          workflow_version: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', artifactId);

      await supabase
        .from('value_commits')
        .update({
          status: 'cancelled',
          metadata: { rollback_execution: context.execution_id },
          updated_at: new Date().toISOString()
        })
        .eq('id', artifactId);

      await supabase
        .from('kpi_targets')
        .delete()
        .eq('value_commit_id', artifactId);
    }
  }

  private async compensateRealizationStage(context: CompensationContext): Promise<void> {
    for (const artifactId of context.artifacts_created) {
      await supabase
        .from('realization_artifacts')
        .delete()
        .eq('id', artifactId);
    }
  }

  private async compensateExpansionStage(context: CompensationContext): Promise<void> {
    for (const artifactId of context.artifacts_created) {
      await supabase
        .from('expansion_artifacts')
        .delete()
        .eq('id', artifactId);
    }
  }

  private async compensateIntegrityStage(context: CompensationContext): Promise<void> {
    for (const artifactId of context.artifacts_created) {
      await supabase
        .from('integrity_artifacts')
        .delete()
        .eq('id', artifactId);
    }
  }

  private extractStageType(stageId: string): LifecycleStage {
    const lowerStageId = stageId.toLowerCase();
    if (lowerStageId.includes('opportunity')) return 'opportunity';
    if (lowerStageId.includes('target')) return 'target';
    if (lowerStageId.includes('realization')) return 'realization';
    if (lowerStageId.includes('expansion')) return 'expansion';
    if (lowerStageId.includes('integrity')) return 'integrity';
    return 'opportunity';
  }

  private resolveHandler(reference: string | undefined, stageType: LifecycleStage): CompensationHandler | undefined {
    const normalizedRef = reference?.toLowerCase() || '';
    const derivedType = normalizedRef
      ? this.extractStageType(normalizedRef)
      : stageType;

    return this.handlers.get(derivedType);
  }

  private async executeWithTimeout<T>(promise: Promise<T>): Promise<T> {
    return Promise.race<T>([
      promise,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Compensation timeout')), WorkflowCompensation.ROLLBACK_TIMEOUT_MS))
    ]);
  }

  private getCompensationPolicy(context: Record<string, any>): CompensationPolicy {
    return context.compensation_policy || 'continue_on_error';
  }

  private async logRollbackEvent(
    executionId: string,
    eventType: string,
    metadata: Record<string, any>
  ): Promise<void> {
    await supabase
      .from('workflow_events')
      .insert({
        execution_id: executionId,
        event_type: 'workflow_rolled_back',
        stage_id: null,
        metadata: { rollback_event: eventType, ...metadata }
      });
  }

  async canRollback(executionId: string): Promise<boolean> {
    const { data: execution } = await supabase
      .from('workflow_executions')
      .select('status')
      .eq('id', executionId)
      .maybeSingle();

    if (!execution) return false;
    return ['failed', 'completed'].includes(execution.status);
  }

  async getCompensationPreview(executionId: string): Promise<{
    stages: Array<{
      stage_id: string;
      artifacts_affected: number;
      changes_to_revert: string[];
    }>;
  }> {
    const { data: logs } = await supabase
      .from('workflow_execution_logs')
      .select('*')
      .eq('execution_id', executionId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false });

    if (!logs) return { stages: [] };

    const stages = logs.map(log => ({
      stage_id: log.stage_id,
      artifacts_affected: (log.output_data?.artifacts_created || []).length,
      changes_to_revert: Object.keys(log.output_data || {}).filter(key => key !== 'artifacts_created')
    }));

    return { stages };
  }
}

export const workflowCompensation = new WorkflowCompensation();
