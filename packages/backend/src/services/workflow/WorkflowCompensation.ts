import { supabase } from '../../lib/supabase.js'
import {
  CompensationContext,
  CompensationPolicy,
  ExecutedStep,
  LifecycleStage,
  RollbackState,
  WorkflowStageType
} from '../../types/workflow';

type CompensationHandler = (context: CompensationContext) => Promise<void>;

interface WorkflowExecutionLogOutputData {
  artifacts_created?: string[];
  [key: string]: unknown;
}

interface WorkflowExecutionLog {
  stage_id: string;
  output_data: WorkflowExecutionLogOutputData;
}

interface RollbackExecutionContext {
  executed_steps?: ExecutedStep[];
  rollback_state?: RollbackState;
  compensation_policy?: CompensationPolicy;
  [key: string]: unknown;
}

interface WorkflowExecutionUpdate {
  context: RollbackExecutionContext;
  updated_at: string;
  status?: 'rolled_back';
  completed_at?: string;
}

interface RollbackEventMetadata {
  stages_to_rollback?: number;
  stage_id?: string;
  stage_type?: WorkflowStageType;
  compensator?: string;
  error?: string;
  stages_rolled_back?: number;
}

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

    const { context: executionContext, executedSteps, rollbackState } = this.parseExecutionContext(execution?.context);

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

    const logByStage = new Map<string, WorkflowExecutionLog>();
    for (const rawLog of logs) {
      const parsedLog = this.parseExecutionLog(rawLog);
      if (!parsedLog) {
        continue;
      }

      if (!logByStage.has(parsedLog.stage_id)) {
        logByStage.set(parsedLog.stage_id, parsedLog);
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
        artifacts_created: log.output_data.artifacts_created ?? [],
        state_changes: log.output_data
      };

      const handler = this.resolveHandler(step.compensator, step.stage_type as LifecycleStage);

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
    executionContext: RollbackExecutionContext,
    rollbackState: RollbackState,
    markRolledBack = false
  ): Promise<void> {
    const updatedContext: RollbackExecutionContext = { ...executionContext, rollback_state: rollbackState };

    const update: WorkflowExecutionUpdate = {
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
    if (context.artifacts_created.length > 0) {
      await supabase
        .from('opportunity_artifacts')
        .delete()
        .in('id', context.artifacts_created);
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
    if (context.artifacts_created.length > 0) {
      await supabase
        .from('realization_artifacts')
        .delete()
        .in('id', context.artifacts_created);
    }
  }

  private async compensateExpansionStage(context: CompensationContext): Promise<void> {
    if (context.artifacts_created.length > 0) {
      await supabase
        .from('expansion_artifacts')
        .delete()
        .in('id', context.artifacts_created);
    }
  }

  private async compensateIntegrityStage(context: CompensationContext): Promise<void> {
    if (context.artifacts_created.length > 0) {
      await supabase
        .from('integrity_artifacts')
        .delete()
        .in('id', context.artifacts_created);
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

  private getCompensationPolicy(context: RollbackExecutionContext): CompensationPolicy {
    return context.compensation_policy || 'continue_on_error';
  }

  private async logRollbackEvent(
    executionId: string,
    eventType: string,
    metadata: RollbackEventMetadata
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

    const stages = logs
      .map(log => this.parseExecutionLog(log))
      .filter((log): log is WorkflowExecutionLog => log !== null)
      .map(log => ({
        stage_id: log.stage_id,
        artifacts_affected: log.output_data.artifacts_created?.length ?? 0,
        changes_to_revert: Object.keys(log.output_data).filter(key => key !== 'artifacts_created')
      }));

    return { stages };
  }

  private parseExecutionContext(context: unknown): {
    context: RollbackExecutionContext;
    executedSteps: ExecutedStep[];
    rollbackState: RollbackState;
  } {
    const parsedContext: RollbackExecutionContext = this.isRecord(context)
      ? context
      : {};

    const executedSteps = Array.isArray(parsedContext.executed_steps)
      ? parsedContext.executed_steps.filter((step): step is ExecutedStep => this.isExecutedStep(step))
      : [];

    const rollbackState = this.parseRollbackState(parsedContext.rollback_state);

    return {
      context: parsedContext,
      executedSteps,
      rollbackState
    };
  }

  private parseExecutionLog(log: unknown): WorkflowExecutionLog | null {
    if (!this.isRecord(log)) {
      return null;
    }

    if (typeof log.stage_id !== 'string' || log.stage_id.length === 0) {
      return null;
    }

    const outputData = this.parseOutputData(log.output_data);
    if (!outputData) {
      return null;
    }

    return {
      stage_id: log.stage_id,
      output_data: outputData
    };
  }

  private parseOutputData(outputData: unknown): WorkflowExecutionLogOutputData | null {
    if (outputData == null) {
      return {};
    }

    if (!this.isRecord(outputData)) {
      return null;
    }

    const parsedArtifacts = Array.isArray(outputData.artifacts_created)
      ? outputData.artifacts_created.filter((artifactId): artifactId is string => typeof artifactId === 'string')
      : undefined;

    return {
      ...outputData,
      ...(parsedArtifacts ? { artifacts_created: parsedArtifacts } : {})
    };
  }

  private parseRollbackState(rollbackState: unknown): RollbackState {
    if (!this.isRecord(rollbackState)) {
      return {
        status: 'idle',
        completed_steps: []
      };
    }

    const completedSteps = Array.isArray(rollbackState.completed_steps)
      ? rollbackState.completed_steps.filter((step): step is string => typeof step === 'string')
      : [];

    const validStatuses: RollbackState['status'][] = ['idle', 'in_progress', 'completed', 'failed'];
    const status = validStatuses.includes(rollbackState.status as RollbackState['status'])
      ? rollbackState.status as RollbackState['status']
      : 'idle';

    return {
      status,
      completed_steps: completedSteps,
      ...(typeof rollbackState.failed_stage === 'string' ? { failed_stage: rollbackState.failed_stage } : {})
    };
  }

  private isExecutedStep(step: unknown): step is ExecutedStep {
    if (!this.isRecord(step)) {
      return false;
    }

    return typeof step.stage_id === 'string'
      && typeof step.stage_type === 'string';
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }
}

export const workflowCompensation = new WorkflowCompensation();
