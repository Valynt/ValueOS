import { supabase } from '../lib/supabase';
import { CompensationContext, LifecycleStage } from '../types/workflow';

type CompensationHandler = (context: CompensationContext) => Promise<void>;

export class WorkflowCompensation {
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
    const { data: logs, error: logsError } = await supabase
      .from('workflow_execution_logs')
      .select('*')
      .eq('execution_id', executionId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false });

    if (logsError) throw new Error('Failed to fetch execution logs for rollback');
    if (!logs || logs.length === 0) return;

    await this.logRollbackEvent(executionId, 'started', { stages_to_rollback: logs.length });

    for (const log of logs) {
      try {
        const compensationContext: CompensationContext = {
          execution_id: executionId,
          stage_id: log.stage_id,
          artifacts_created: log.output_data?.artifacts_created || [],
          state_changes: log.output_data || {}
        };

        const stageType = this.extractStageType(log.stage_id);
        const handler = this.handlers.get(stageType);

        if (handler) {
          await handler(compensationContext);
          await this.logRollbackEvent(executionId, 'stage_compensated', {
            stage_id: log.stage_id,
            stage_type: stageType
          });
        }
      } catch (error) {
        await this.logRollbackEvent(executionId, 'stage_compensation_failed', {
          stage_id: log.stage_id,
          error: (error as Error).message
        });
        throw error;
      }
    }

    await supabase
      .from('workflow_executions')
      .update({
        status: 'rolled_back',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', executionId);

    await this.logRollbackEvent(executionId, 'completed', { stages_rolled_back: logs.length });
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
