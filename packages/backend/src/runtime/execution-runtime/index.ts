/**
 * ExecutionRuntime
 *
 * Manages task lifecycle: queuing, retries, concurrency control, circuit breaking.
 * Extracted from UnifiedAgentOrchestrator in Sprint 4.
 *
 * Split into two focused sub-modules:
 *  - QueryExecutor: processQuery / processQueryAsync / getAsyncQueryResult
 *  - WorkflowExecutor: executeWorkflow / executeDAGAsync / executeStageWithRetry / executeStage
 *
 * This index wires them together and exposes a single ExecutionRuntime class.
 */

import { MemorySystem } from '../../lib/agent-fabric/MemorySystem.js';
import { SupabaseMemoryBackend } from '../../lib/agent-fabric/SupabaseMemoryBackend.js';
import { runInTelemetrySpanAsync } from '../../observability/telemetryStandards.js';
import type { WorkflowState } from '../../repositories/WorkflowStateRepository.js';
import type { AgentType } from '../../services/agent-types.js';
import { AgentMessageBroker } from '../../services/agents/AgentMessageBroker.js';
import { AgentMessageQueue } from '../../services/agents/AgentMessageQueue.js';
import { AgentRegistry } from '../../services/agents/AgentRegistry.js';
import { CircuitBreakerManager } from '../../services/agents/resilience/CircuitBreaker.js';
import type { IExecutionRuntime } from '../../types/execution/IExecutionRuntime.js';
import type { ExecutionEnvelope, ProcessQueryResult, WorkflowExecutionResult } from '../../types/orchestration.js';
import type { WorkflowContextDTO } from '../../types/workflow/orchestration.js';
import type { StageExecutionResultDTO, StageRouteDTO, WorkflowStageContextDTO } from '../../types/workflow/runner.js';
import type { WorkflowDAG, WorkflowStage } from '../../types/workflow.js';
import type { WorkflowExecutionRecord } from '../../types/workflowExecution.js';
import type { DecisionRouter } from '../decision-router/index.js';
import type { PolicyEngine } from '../policy-engine/index.js';
import { getApprovalInbox } from '../approval-inbox/index.js';
import { createSupabaseRuntimePorts, type SupabaseRuntimePorts } from '../adapters/SupabaseRuntimePorts.js';
import type { RuntimeMigrationPathTag } from '../ports/runtimePorts.js';

import { QueryExecutor, type QueryExecutorConfig } from './QueryExecutor.js';
import { WorkflowExecutor, type WorkflowExecutorConfig } from './WorkflowExecutor.js';


export { QueryExecutor, WorkflowExecutor };
export type { QueryExecutorConfig, WorkflowExecutorConfig };
export {
  buildStageContextWithTenantValidation,
  buildWorkflowStageDecisionContext,
} from "./workflow-stage-context.js";
export {
  buildHitlPendingApprovalResult,
  buildRetryAwareRuntimeFailure,
} from "./workflow-stage-retry-decision.js";
export { WorkflowPersistenceInteractions } from "./workflow-persistence-interactions.js";

// ============================================================================
// ExecutionRuntime — thin wiring class
// ============================================================================

export interface ExecutionRuntimeConfig extends QueryExecutorConfig, WorkflowExecutorConfig {
  defaultTimeoutMs: number;
  maxAgentInvocationsPerMinute: number;
  enableWorkflows: boolean;
  maxRetryAttempts: number;
}

const DEFAULT_CONFIG: ExecutionRuntimeConfig = {
  defaultTimeoutMs: 30_000,
  maxAgentInvocationsPerMinute: 20,
  enableWorkflows: true,
  maxRetryAttempts: 3,
};


export interface ExecutionRuntimeDependencies {
  runtimePorts: Pick<SupabaseRuntimePorts, 'workflowExecution'>;
  runtimePathTag?: RuntimeMigrationPathTag;
}

export class ExecutionRuntime implements IExecutionRuntime {
  private readonly queryExecutor: QueryExecutor;
  private readonly workflowExecutor: WorkflowExecutor;
  private readonly runtimePathTag: RuntimeMigrationPathTag;

  constructor(
    policy: PolicyEngine,
    router: DecisionRouter,
    config: Partial<ExecutionRuntimeConfig> = {},
    circuitBreakers: CircuitBreakerManager = new CircuitBreakerManager(),
    registry: AgentRegistry = new AgentRegistry(),
    messageBroker: AgentMessageBroker = new AgentMessageBroker(),
    agentMessageQueue: AgentMessageQueue = new AgentMessageQueue(),
    memorySystem: MemorySystem = new MemorySystem(
      { max_memories: 1000, enable_persistence: true },
      new SupabaseMemoryBackend(),
    ),
    dependencies: ExecutionRuntimeDependencies,
  ) {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    this.runtimePathTag = dependencies.runtimePathTag ?? 'new_path';

    this.queryExecutor = new QueryExecutor(policy, router, circuitBreakers, agentMessageQueue, cfg);

    this.workflowExecutor = new WorkflowExecutor(
      policy,
      router,
      circuitBreakers,
      registry,
      messageBroker,
      memorySystem,
      (agentType: AgentType) => this.queryExecutor.checkAgentRateLimit(agentType),
      cfg,
      {
        executionPersistence: dependencies.runtimePorts.workflowExecution,
        runtimePathTag: this.runtimePathTag,
      },
    );
  }

  // --------------------------------------------------------------------------
  // Query path
  // --------------------------------------------------------------------------

  processQuery(envelope: ExecutionEnvelope, query: string, currentState: WorkflowState, userId: string, sessionId: string, traceId?: string): Promise<ProcessQueryResult> {
    return runInTelemetrySpanAsync('runtime.execution_runtime.process_query', {
      service: 'execution-runtime',
      env: process.env.NODE_ENV || 'development',
      tenant_id: envelope.tenant_id,
      trace_id: traceId || envelope.trace_id,
      runtime_path: this.runtimePathTag,
    }, async () => this.queryExecutor.processQuery(envelope, query, currentState, userId, sessionId, traceId));
  }

  processQueryAsync(envelope: ExecutionEnvelope, query: string, currentState: WorkflowState, userId: string, sessionId: string, traceId?: string): Promise<{ jobId: string; traceId: string }> {
    return this.queryExecutor.processQueryAsync(envelope, query, currentState, userId, sessionId, traceId);
  }

  getAsyncQueryResult(jobId: string, currentState: WorkflowState): Promise<ProcessQueryResult | null> {
    return this.queryExecutor.getAsyncQueryResult(jobId, currentState);
  }

  // --------------------------------------------------------------------------
  // Workflow path
  // --------------------------------------------------------------------------

  executeWorkflow(envelope: ExecutionEnvelope, workflowDefinitionId: string, context?: WorkflowContextDTO, userId?: string): Promise<WorkflowExecutionResult> {
    return runInTelemetrySpanAsync('runtime.execution_runtime.execute_workflow', {
      service: 'execution-runtime',
      env: process.env.NODE_ENV || 'development',
      tenant_id: envelope.tenant_id,
      trace_id: envelope.trace_id,
      attributes: { workflow_definition_id: workflowDefinitionId, runtime_path: this.runtimePathTag },
    }, async () => this.workflowExecutor.executeWorkflow(envelope, workflowDefinitionId, context, userId));
  }

  executeDAGAsync(executionId: string, organizationId: string, dag: WorkflowDAG, initialContext: WorkflowStageContextDTO, traceId: string, executionRecord?: WorkflowExecutionRecord): Promise<void> {
    return this.workflowExecutor.executeDAGAsync(executionId, organizationId, dag, initialContext, traceId, executionRecord);
  }

  executeStageWithRetry(executionId: string, stage: WorkflowStage, context: WorkflowStageContextDTO, route: StageRouteDTO, traceId: string): Promise<StageExecutionResultDTO> {
    return this.workflowExecutor.executeStageWithRetry(executionId, stage, context, route, traceId);
  }

  executeStage(stage: WorkflowStage, context: WorkflowStageContextDTO, route: StageRouteDTO): Promise<Record<string, unknown>> {
    return this.workflowExecutor.executeStage(stage, context, route);
  }
}

// No module-level singleton: callers construct and own their ExecutionRuntime
// instance. This avoids the silent dependency-mismatch problem that arises when
// a singleton ignores constructor arguments after the first call.

// ============================================================================
// Factory — wires default dependencies for production use
// ============================================================================

import { PolicyEngine as PolicyEngineImpl } from '../policy-engine/index.js';
import { decisionRouter } from '../decision-router/index.js';
// service-role:justified worker/service requires elevated DB access for background processing
import { createWorkerServiceSupabaseClient } from '../../lib/supabase/privileged/index.js';

/**
 * Create an ExecutionRuntime with production-default dependencies.
 * Use this in API routes and services that don't need custom wiring.
 */
export function createExecutionRuntime(
  config: Partial<ExecutionRuntimeConfig> = {},
  dependencies?: Partial<ExecutionRuntimeDependencies>,
): ExecutionRuntime {
  if (dependencies?.runtimePorts) {
    return createExecutionRuntimeWithPorts(config, {
      runtimePorts: dependencies.runtimePorts,
      runtimePathTag: dependencies.runtimePathTag ?? 'new_path',
    });
  }

  return createExecutionRuntimeWithLegacyFallback(config);
}

export function createExecutionRuntimeWithPorts(
  config: Partial<ExecutionRuntimeConfig>,
  dependencies: ExecutionRuntimeDependencies,
): ExecutionRuntime {
  // service-role:justified ExecutionRuntime initializes agent registry and policy engine in worker context
  const supabase = createWorkerServiceSupabaseClient('ExecutionRuntime: initialize agent registry and policy engine');
  const registry = new AgentRegistry();
  const policy = new PolicyEngineImpl({
    supabase,
    registry,
    serviceReadiness: () => ({
      message_broker_ready: true,
      queue_ready: true,
      memory_backend_ready: true,
      llm_gateway_ready: true,
      circuit_breaker_ready: true,
    }),
  });
  getApprovalInbox().start();

  return new ExecutionRuntime(
    policy,
    decisionRouter,
    config,
    new CircuitBreakerManager(),
    registry,
    new AgentMessageBroker(),
    new AgentMessageQueue(),
    new MemorySystem(
      { max_memories: 1000, enable_persistence: true },
      new SupabaseMemoryBackend(),
    ),
    dependencies,
  );
}

/**
 * Temporary fallback for legacy call sites while runtime ports migration is in progress.
 */
export function createExecutionRuntimeWithLegacyFallback(
  config: Partial<ExecutionRuntimeConfig> = {},
): ExecutionRuntime {
  // service-role:justified ExecutionRuntime legacy fallback creates runtime ports in worker context
  const runtimePorts = createSupabaseRuntimePorts(createWorkerServiceSupabaseClient('ExecutionRuntime legacy fallback: create runtime ports'));
  return createExecutionRuntimeWithPorts(config, {
    runtimePorts: { workflowExecution: runtimePorts.workflowExecution },
    runtimePathTag: 'old_path',
  });
}
