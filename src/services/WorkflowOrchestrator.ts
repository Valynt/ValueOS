import { supabase } from '../lib/supabase';
import {
  WorkflowDAG,
  WorkflowExecution,
  WorkflowExecutionLog,
  WorkflowEvent,
  WorkflowStatus,
  StageStatus,
  RetryConfig,
  CircuitBreakerState, // <-- Keep this
  WorkflowStage,
  ExecutedStep       // <-- Keep this
} from '../types/workflow';
import { LIFECYCLE_WORKFLOW_DEFINITIONS } from '../data/lifecycleWorkflows';
import { agentRoutingLayer, StageRoute } from './AgentRoutingLayer';
import { workflowCompensation } from './WorkflowCompensation';
import { CircuitBreakerManager } from './CircuitBreaker';

export class WorkflowOrchestrator {
  private circuitBreakers = new CircuitBreakerManager();

  async registerLifecycleDefinitions(): Promise<void> {
    for (const definition of LIFECYCLE_WORKFLOW_DEFINITIONS) {
      await supabase
        .from('workflow_definitions')
        .upsert({
          name: definition.name,
          description: definition.description,
          version: definition.version,
          dag_schema: definition,
          is_active: true
        }, {
          onConflict: 'name,version'
        });
    }
  }

  async executeWorkflow(
    workflowDefinitionId: string,
    context: Record<string, any> = {}
  ): Promise<string> {
    const { data: definition, error: defError } = await supabase
      .from('workflow_definitions')
      .select('*')
      .eq('id', workflowDefinitionId)
      .eq('is_active', true)
      .maybeSingle();

    if (defError || !definition) {
      throw new Error(`Workflow definition not found: ${workflowDefinitionId}`);
    }

    const dag: WorkflowDAG = definition.dag_schema as WorkflowDAG;

    const { data: execution, error: execError } = await supabase
      .from('workflow_executions')
      .insert({
        workflow_definition_id: workflowDefinitionId,
        workflow_version: definition.version,
        status: 'initiated',
        current_stage: dag.initial_stage,
        context,
        audit_context: { workflow: definition.name, version: definition.version },
        circuit_breaker_state: {}
      })
      .select()
      .single();

    if (execError || !execution) {
      throw new Error('Failed to create workflow execution');
    }

    await this.logEvent(execution.id, 'stage_started', dag.initial_stage, {
      workflow_name: definition.name
    });
    await this.logAudit(execution.id, 'workflow_initiated', {
      workflow_name: definition.name,
      workflow_version: definition.version,
      context
    });

    this.executeDAG(execution.id, dag).catch(async (error) => {
      await this.handleWorkflowFailure(execution.id, error.message);
    });

    return execution.id;
  }

  private async executeDAG(executionId: string, dag: WorkflowDAG): Promise<void> {
    const { data: execution } = await supabase
      .from('workflow_executions')
      .select('*')
      .eq('id', executionId)
      .single();

    if (!execution) throw new Error('Execution not found');

    let currentStageId = execution.current_stage || dag.initial_stage;
    let executionContext = execution.context || {};
    let executedSteps: ExecutedStep[] = executionContext.executed_steps || [];
    const visitedStages = new Set<string>();

    while (currentStageId && !dag.final_stages.includes(currentStageId)) {
      if (visitedStages.has(currentStageId)) {
        throw new Error(`Circular dependency at stage: ${currentStageId}`);
      }
      visitedStages.add(currentStageId);

      const route = agentRoutingLayer.routeStage(dag, currentStageId, execution.context || {});
      const stage = route.stage;

      await this.updateExecutionStatus(executionId, 'in_progress', currentStageId);

      await this.logAudit(executionId, 'stage_routing', {
        stage_id: stage.id,
        lifecycle_stage: route.lifecycle_stage,
        dependencies: route.dependencies,
        selected_agent_id: route.selected_agent.id,
        fallback_agents: route.fallback_agents.map(agent => agent.id),
        score: {
          total: route.score.total,
          capability: route.score.capabilityScore,
          load: route.score.loadScore,
          proximity: route.score.proximityScore,
          stickiness: route.score.stickinessScore
        },
        reason: route.reason
      });

      const stageResult = await this.executeStageWithRetry(executionId, stage, executionContext, route);

      if (stageResult.status === 'failed') {
        throw new Error(`Stage ${currentStageId} failed: ${stageResult.error_message}`);
      }

      executionContext = this.mergeExecutionContext(executionContext, stage, stageResult?.output_data || {}, executedSteps);
      executedSteps = executionContext.executed_steps || executedSteps;
      await this.persistExecutionContext(executionId, executionContext, currentStageId);

      const nextTransition = dag.transitions.find(t => t.from_stage === currentStageId);
      if (!nextTransition) break;

      currentStageId = nextTransition.to_stage;
    }

    await this.updateExecutionStatus(executionId, 'completed', null);
    await this.logEvent(executionId, 'workflow_completed', null, { final_stage: currentStageId });
    await this.logAudit(executionId, 'workflow_completed', { final_stage: currentStageId });
  }

  private async executeStageWithRetry(
    executionId: string,
    stage: WorkflowStage,
    context: Record<string, any>,
    route?: StageRoute
  ): Promise<WorkflowExecutionLog> {
    const circuitBreakerKey = `${executionId}-${stage.id}`;
    const retryConfig = stage.retry_config;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= retryConfig.max_attempts; attempt++) {
      const logId = await this.createExecutionLog(executionId, stage.id, attempt, context, stage.retry_config);
      const startTime = Date.now();

      try {
        await this.logEvent(executionId, 'stage_started', stage.id, { attempt });

        const result = await this.circuitBreakers.execute(
          circuitBreakerKey,
          () => this.executeStage(stage, context, route),
          {
            latencyThresholdMs: Math.floor(stage.timeout_seconds * 1000 * 0.8),
            timeoutMs: stage.timeout_seconds * 1000
          }
        );
        const duration = Date.now() - startTime;

        await this.completeExecutionLog(logId, 'completed', duration, result);
        await this.logEvent(executionId, 'stage_completed', stage.id, { attempt, duration });

        if (route?.selected_agent) {
          const registry = agentRoutingLayer.getRegistry();
          registry.recordRelease(route.selected_agent.id);
          registry.markHealthy(route.selected_agent.id);
        }

        await this.persistCircuitBreakerState(executionId);

        const { data: log } = await supabase
          .from('workflow_execution_logs')
          .select('*')
          .eq('id', logId)
          .single();

        return log as WorkflowExecutionLog;
      } catch (error) {
        lastError = error as Error;
        const duration = Date.now() - startTime;

        await this.completeExecutionLog(logId, 'failed', duration, null, lastError.message);
        await this.persistCircuitBreakerState(executionId);

        if (route?.selected_agent) {
          agentRoutingLayer.getRegistry().recordFailure(route.selected_agent.id);
        }

        if (attempt < retryConfig.max_attempts) {
          await this.logEvent(executionId, 'stage_retrying', stage.id, {
            attempt,
            error: lastError.message,
            next_attempt: attempt + 1
          });
          await this.logAudit(executionId, 'stage_retrying', {
            stage_id: stage.id,
            attempt,
            retry_policy: retryConfig,
            error: lastError.message
          });

          const delay = this.calculateRetryDelay(
            attempt,
            retryConfig.initial_delay_ms,
            retryConfig.max_delay_ms,
            retryConfig.multiplier,
            retryConfig.jitter
          );

          await this.delay(delay);
        } else {
          await this.logEvent(executionId, 'stage_failed', stage.id, {
            attempt,
            error: lastError.message
          });
          await this.logAudit(executionId, 'stage_failed', {
            stage_id: stage.id,
            attempt,
            error: lastError.message,
            circuit_breaker: this.circuitBreakers.getState(circuitBreakerKey)
          });
        }
      }
    }

    const { data: log } = await supabase
      .from('workflow_execution_logs')
      .select('*')
      .eq('execution_id', executionId)
      .eq('stage_id', stage.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    return log as WorkflowExecutionLog;
  }

  private async executeStage(
    stage: WorkflowStage,
    context: Record<string, any>,
    route?: StageRoute
  ): Promise<Record<string, any>> {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Stage timeout')), stage.timeout_seconds * 1000);
    });

    const executionPromise = this.callAgentForStage(stage, context, route);

    return Promise.race([executionPromise, timeoutPromise]) as Promise<Record<string, any>>;
  }

  private async callAgentForStage(
    stage: WorkflowStage,
    context: Record<string, any>,
    route?: StageRoute
  ): Promise<Record<string, any>> {
    await this.delay(1000);

    return {
      stage_id: stage.id,
      agent_type: stage.agent_type,
      agent_id: route?.selected_agent?.id,
      artifacts_created: [],
      next_context: {
        ...context,
        lifecycle_stage: stage.agent_type,
        previous_agent_id: route?.selected_agent?.id,
        fallback_agents: route?.fallback_agents?.map(agent => agent.id)
      }
    };
  }

  private calculateRetryDelay(
    attempt: number,
    initialDelay: number,
    maxDelay: number,
    multiplier: number,
    jitter: boolean
  ): number {
    let delay = initialDelay * Math.pow(multiplier, attempt - 1);
    delay = Math.min(delay, maxDelay);

    if (jitter) {
      const jitterAmount = delay * 0.1;
      const randomJitter = (Math.random() - 0.5) * 2 * jitterAmount;
      delay += randomJitter;
    }

    return Math.floor(delay);
  }

  private async persistCircuitBreakerState(executionId: string): Promise<void> {
    await supabase
      .from('workflow_executions')
      .update({ circuit_breaker_state: { ...this.circuitBreakers.exportState() } })
      .eq('id', executionId);
  }

  private async createExecutionLog(
    executionId: string,
    stageId: string,
    attempt: number,
    inputData: Record<string, any>,
    retryPolicy?: RetryConfig
  ): Promise<string> {
    const { data, error } = await supabase
      .from('workflow_execution_logs')
      .insert({
        execution_id: executionId,
        stage_id: stageId,
        status: 'in_progress',
        attempt_number: attempt,
        input_data: inputData,
        retry_policy: retryPolicy
      })
      .select()
      .single();

    if (error || !data) throw new Error('Failed to create execution log');
    return data.id;
  }

  private mergeExecutionContext(
    currentContext: Record<string, any>,
    stage: WorkflowStage,
    outputData: Record<string, any>,
    executedSteps: ExecutedStep[]
  ): Record<string, any> {
    const updatedSteps = [...executedSteps, {
      stage_id: stage.id,
      stage_type: stage.agent_type,
      compensator: stage.compensation_handler || stage.agent_type,
      completed_at: new Date().toISOString()
    }];

    return {
      ...currentContext,
      ...outputData?.next_context,
      executed_steps: updatedSteps
    };
  }

  private async persistExecutionContext(
    executionId: string,
    context: Record<string, any>,
    currentStage: string
  ): Promise<void> {
    await supabase
      .from('workflow_executions')
      .update({
        context,
        current_stage: currentStage,
        updated_at: new Date().toISOString()
      })
      .eq('id', executionId);
  }

  private async completeExecutionLog(
    logId: string,
    status: StageStatus,
    durationMs: number,
    outputData: Record<string, any> | null,
    errorMessage?: string
  ): Promise<void> {
    await supabase
      .from('workflow_execution_logs')
      .update({
        status,
        completed_at: new Date().toISOString(),
        duration_ms: durationMs,
        output_data: outputData,
        error_message: errorMessage || null
      })
      .eq('id', logId);
  }

  private async updateExecutionStatus(
    executionId: string,
    status: WorkflowStatus,
    currentStage: string | null
  ): Promise<void> {
    const update: any = {
      status,
      current_stage: currentStage,
      updated_at: new Date().toISOString()
    };

    if (status === 'completed' || status === 'failed' || status === 'rolled_back') {
      update.completed_at = new Date().toISOString();
    }

    await supabase
      .from('workflow_executions')
      .update(update)
      .eq('id', executionId);
  }

  private async handleWorkflowFailure(executionId: string, errorMessage: string): Promise<void> {
    await supabase
      .from('workflow_executions')
      .update({
        status: 'failed',
        error_message: errorMessage,
        completed_at: new Date().toISOString()
      })
      .eq('id', executionId);

    await this.logEvent(executionId, 'workflow_failed', null, { error: errorMessage });
    await this.logAudit(executionId, 'workflow_failed', { error: errorMessage });

    if (await workflowCompensation.canRollback(executionId)) {
      try {
        await workflowCompensation.rollbackExecution(executionId);
        await this.logEvent(executionId, 'workflow_rolled_back', null, { reason: 'automatic_compensation' });
        await this.logAudit(executionId, 'workflow_rolled_back', { reason: 'automatic_compensation' });
      } catch (rollbackError) {
        await this.logAudit(executionId, 'workflow_rollback_failed', { error: (rollbackError as Error).message });
      }
    }
  }

  private async logEvent(
    executionId: string,
    eventType: WorkflowEvent['event_type'],
    stageId: string | null,
    metadata: Record<string, any>
  ): Promise<void> {
    await supabase
      .from('workflow_events')
      .insert({
        execution_id: executionId,
        event_type: eventType,
        stage_id: stageId,
        metadata
      });
  }

  private async logAudit(
    executionId: string,
    action: string,
    metadata: Record<string, any>
  ): Promise<void> {
    await supabase
      .from('workflow_audit_logs')
      .insert({
        execution_id: executionId,
        action,
        metadata
      });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async getExecutionStatus(executionId: string): Promise<WorkflowExecution | null> {
    const { data, error } = await supabase
      .from('workflow_executions')
      .select('*')
      .eq('id', executionId)
      .maybeSingle();

    if (error) throw new Error('Failed to fetch execution status');
    return data as WorkflowExecution | null;
  }

  async getExecutionLogs(executionId: string): Promise<WorkflowExecutionLog[]> {
    const { data, error } = await supabase
      .from('workflow_execution_logs')
      .select('*')
      .eq('execution_id', executionId)
      .order('started_at', { ascending: true});

    if (error) throw new Error('Failed to fetch execution logs');
    return data as WorkflowExecutionLog[];
  }

  async getExecutionEvents(executionId: string): Promise<WorkflowEvent[]> {
    const { data, error } = await supabase
      .from('workflow_events')
      .select('*')
      .eq('execution_id', executionId)
      .order('timestamp', { ascending: true });

    if (error) throw new Error('Failed to fetch execution events');
    return data as WorkflowEvent[];
  }
}

export const workflowOrchestrator = new WorkflowOrchestrator();
