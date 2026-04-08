/**
 * WorkflowExecutor
 *
 * Owns DAG workflow execution: executeWorkflow, executeDAGAsync,
 * executeStageWithRetry, executeStage. Extracted from
 * UnifiedAgentOrchestrator in Sprint 4.
 */

import { Span, SpanStatusCode } from "@opentelemetry/api";
import { type RuntimeFailureDetails } from "@valueos/shared";
import { securityLogger } from "../../services/core/SecurityLogger.js";
import { v4 as uuidv4 } from "uuid";

import { getTracer } from "../../config/telemetry.js";
import { MemorySystem } from "../../lib/agent-fabric/MemorySystem.js";
import { logger } from "../../lib/logger.js";
import { assertTenantContextMatch } from "../../lib/tenant/assertTenantContextMatch.js";
import {
  recordAgentInvocation,
  recordWorkflowDeadlineViolation,
  recordWorkflowExecutionActive,
} from "../../observability/valueLoopMetrics.js";
import { ValueTreeRepository } from "../../repositories/ValueTreeRepository.js";
import type { WorkflowStatus } from "../../repositories/WorkflowStateRepository.js";
import type { AgentType } from "../../services/agent-types.js";
import type { AgentContext } from "../../services/agents/AgentAPI.js";
import { AgentMessageBroker } from "../../services/agents/AgentMessageBroker.js";
import { AgentRegistry } from "../../services/agents/AgentRegistry.js";
import type {
  AgentCapability,
  AgentConfiguration,
  AgentHealthStatus,
  AgentMetadata,
  AgentPerformanceMetrics,
  AgentRequest,
  AgentResponse as RetryAgentResponse,
  ValidationResult,
} from "../../services/agents/core/IAgent.js";
import { AgentRetryManager } from "../../services/agents/resilience/AgentRetryManager.js";
import { CircuitBreakerManager } from "../../services/agents/resilience/CircuitBreaker.js";
import type {
  ExecutionEnvelope,
  WorkflowExecutionResult,
} from "../../types/orchestration.js";
import type { WorkflowContextDTO } from "../../types/workflow/orchestration.js";
import type {
  StageExecutionResultDTO,
  StageRouteDTO,
  WorkflowStageContextDTO,
} from "../../types/workflow/runner.js";
import type {
  WorkflowDAG,
  WorkflowEvent,
  WorkflowStage,
} from "../../types/workflow.js";
import type { WorkflowExecutionRecord } from "../../types/workflowExecution.js";
import type { DecisionRouter } from "../decision-router/index.js";
import type { PolicyEngine } from "../policy-engine/index.js";
import type { RetryOptions } from "../../services/agents/resilience/AgentRetryManager.js";
import type {
  RuntimeMigrationPathTag,
  WorkflowExecutionPersistencePort,
} from "../ports/runtimePorts.js";

import { isExternalArtifactWorkflowStage } from "./externalArtifactPolicy.js";
import { validateWorkflowDAG } from "./dag-validator.js";
import { buildRetryOptions, buildStageRetryConfig } from "./retry-policy.js";
import { WorkflowDagRunner } from "./dag-runner.js";
import {
  buildFailureDetails,
  classifyStageFailure,
  withRuntimeFailure,
} from "./stage-failure-policy.js";
import { WorkflowPersistence } from "./workflow-persistence.js";
import { SnapshotAndHandoffHelper } from "./snapshot-and-handoff.js";

// ============================================================================
// Internal types
// ============================================================================

// ============================================================================
// WorkflowExecutor
// ============================================================================

export interface WorkflowExecutorConfig {
  enableWorkflows: boolean;
  maxRetryAttempts: number;
  maxAgentInvocationsPerMinute: number;
}

const DEFAULT_WORKFLOW_DEADLINE_MINUTES = 30;
const DEFAULT_CONFIG: WorkflowExecutorConfig = {
  enableWorkflows: true,
  maxRetryAttempts: 3,
  maxAgentInvocationsPerMinute: 20,
};

export class WorkflowExecutor {
  private readonly retryManager = AgentRetryManager.getInstance();
  private readonly executionPersistence: WorkflowExecutionPersistencePort;
  private readonly workflowPersistence: WorkflowPersistence;
  private readonly snapshotAndHandoffHelper: SnapshotAndHandoffHelper;
  private readonly runtimePathTag: RuntimeMigrationPathTag;
  private readonly valueTreeRepo: ValueTreeRepository;

  private lastDegradedState: RuntimeFailureDetails | null = null;

  constructor(
    private readonly policy: PolicyEngine,
    private readonly router: DecisionRouter,
    private readonly circuitBreakers: CircuitBreakerManager,
    private readonly registry: AgentRegistry,
    private readonly messageBroker: AgentMessageBroker,
    private readonly memorySystem: MemorySystem,
    private readonly checkAgentRateLimit: (agentType: AgentType) => boolean,
    private readonly config: WorkflowExecutorConfig = DEFAULT_CONFIG,
    dependencies: {
      executionPersistence: WorkflowExecutionPersistencePort;
      runtimePathTag?: RuntimeMigrationPathTag;
      valueTreeRepo?: ValueTreeRepository;
    }
  ) {
    this.executionPersistence = dependencies.executionPersistence;
    this.runtimePathTag = dependencies.runtimePathTag ?? "new_path";
    this.valueTreeRepo =
      dependencies.valueTreeRepo ??
      ({
        getNodesForCase: async () => [],
      } as ValueTreeRepository);
    this.workflowPersistence = new WorkflowPersistence(this.executionPersistence);
    this.snapshotAndHandoffHelper = new SnapshotAndHandoffHelper(
      this.valueTreeRepo,
      this.executionPersistence,
      this.policy,
      this.buildStageContext.bind(this),
      this._buildStageDecisionContext.bind(this)
    );
  }

  private buildStageContext(
    authoritativeOrganizationId: string,
    context: WorkflowStageContextDTO,
    source: string
  ): WorkflowStageContextDTO {
    assertTenantContextMatch({
      expectedTenantId: authoritativeOrganizationId,
      actualTenantId: context.organizationId,
      source: `${source}.organizationId`,
    });
    assertTenantContextMatch({
      expectedTenantId: authoritativeOrganizationId,
      actualTenantId: context.organization_id,
      source: `${source}.organization_id`,
    });
    assertTenantContextMatch({
      expectedTenantId: authoritativeOrganizationId,
      actualTenantId: context.tenantId,
      source: `${source}.tenantId`,
    });

    return {
      ...context,
      organizationId: authoritativeOrganizationId,
      organization_id: authoritativeOrganizationId,
      tenantId: authoritativeOrganizationId,
    };
  }

  // --------------------------------------------------------------------------
  // executeWorkflow — entry point
  // --------------------------------------------------------------------------

  async executeWorkflow(
    envelope: ExecutionEnvelope,
    workflowDefinitionId: string,
    context: WorkflowContextDTO = {},
    _userId?: string
  ): Promise<WorkflowExecutionResult> {
    if (!this.config.enableWorkflows)
      throw new Error("Workflow execution is disabled");
    await this.policy.assertTenantExecutionAllowed(envelope.organizationId);

    const traceId = uuidv4();
    logger.info("Starting workflow execution", {
      traceId,
      workflowDefinitionId,
      runtime_path: this.runtimePathTag,
    });

    try {
      const definition =
        await this.executionPersistence.getActiveWorkflowDefinition(
          workflowDefinitionId,
          envelope.organizationId
        );
      if (!definition)
        throw new Error(
          `Workflow definition not found: ${workflowDefinitionId}`
        );

      const dag = validateWorkflowDAG(definition.dag_schema);
      const executionId = uuidv4();
      const initialStageExecutionId = uuidv4();

      const execution = await this.executionPersistence.createWorkflowExecution(
        {
          id: executionId,
          organization_id: envelope.organizationId,
          workflow_definition_id: workflowDefinitionId,
          workflow_version: definition.version,
          status: "initiated",
          current_stage: dag.initial_stage,
          context: {
            ...context,
            executionIntent: envelope,
            currentStageExecutionId: initialStageExecutionId,
          },
          audit_context: {
            workflow: definition.name,
            version: definition.version,
            traceId,
            envelope,
          },
          circuit_breaker_state: {},
        }
      );

      await this._recordWorkflowEvent(
        executionId,
        envelope.organizationId,
        "workflow_initiated",
        dag.initial_stage ?? "",
        { envelope, stageExecutionId: initialStageExecutionId }
      );

      this.executeDAGAsync(
        executionId,
        envelope.organizationId,
        dag,
        { ...context, executionIntent: envelope },
        traceId
      ).catch(async error => {
        await this._handleWorkflowFailure(
          execution.id,
          envelope.organizationId,
          (error as Error).message
        );
      });

      return {
        executionId: execution.id,
        status: "initiated",
        currentStage: dag.initial_stage ?? null,
        completedStages: [],
      };
    } catch (error) {
      logger.error(
        "Workflow execution failed",
        error instanceof Error ? error : undefined,
        { traceId, workflowDefinitionId }
      );
      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // executeDAGAsync — parallel stage runner
  // --------------------------------------------------------------------------

  async executeDAGAsync(
    executionId: string,
    organizationId: string,
    dag: WorkflowDAG,
    initialContext: WorkflowStageContextDTO,
    traceId: string,
    executionRecord?: WorkflowExecutionRecord
  ): Promise<void> {
    const dagStartTime = Date.now();
    const deadlineMs = DEFAULT_WORKFLOW_DEADLINE_MINUTES * 60 * 1000;
    const deadlineTime = dagStartTime + deadlineMs;

    // Track active execution
    recordWorkflowExecutionActive({ organizationId, delta: 1 });

    // Deadline check function
    const checkDeadline = (): boolean => {
      const now = Date.now();
      if (now > deadlineTime) {
        const actualDurationMs = now - dagStartTime;
        recordWorkflowDeadlineViolation({
          executionId,
          organizationId,
          deadlineMinutes: DEFAULT_WORKFLOW_DEADLINE_MINUTES,
          actualDurationMs,
        });
        return false;
      }
      return true;
    };

    try {
      await this._executeDAGAsyncInternal(
        executionId,
        organizationId,
        dag,
        initialContext,
        traceId,
        executionRecord,
        checkDeadline
      );
    } finally {
      // Always decrement active count
      recordWorkflowExecutionActive({ organizationId, delta: -1 });
    }
  }

  private async _executeDAGAsyncInternal(
    executionId: string,
    organizationId: string,
    dag: WorkflowDAG,
    initialContext: WorkflowStageContextDTO,
    traceId: string,
    executionRecord: WorkflowExecutionRecord | undefined,
    checkDeadline: () => boolean
  ): Promise<void> {
    const runner = new WorkflowDagRunner({
      policy: this.policy,
      router: this.router,
      maxAgentInvocationsPerMinute: this.config.maxAgentInvocationsPerMinute,
      executeStageWithRetry: this.executeStageWithRetry.bind(this),
      buildStageContext: this.buildStageContext.bind(this),
      buildStageDecisionContext: this._buildStageDecisionContext.bind(this),
      classifyStageFailure: this.classifyStageFailure.bind(this),
      buildFailureDetails: this.buildFailureDetails.bind(this),
      withRuntimeFailure: this._withRuntimeFailure.bind(this),
      persistAndUpdate: this._persistAndUpdate.bind(this),
      updateStatus: this._updateStatus.bind(this),
      recordWorkflowEvent: this._recordWorkflowEvent.bind(this),
      recordStageRun: this.executionPersistence.recordStageRun.bind(
        this.executionPersistence
      ),
      buildAndPersistHandoffCards: this._buildAndPersistHandoffCards.bind(this),
    });

    await runner.run({
      executionId,
      organizationId,
      dag,
      initialContext,
      traceId,
      executionRecord,
      checkDeadline,
      capturePreModelingSnapshotIfNeeded: async params =>
        this.capturePreModelingSnapshotIfNeeded(
          params.executionId,
          params.organizationId,
          params.dag,
          params.executionContext,
          params.recordSnapshot
        ),
    });
  }

  private async capturePreModelingSnapshotIfNeeded(
    executionId: string,
    organizationId: string,
    dag: WorkflowDAG,
    executionContext: WorkflowStageContextDTO,
    recordSnapshot: WorkflowExecutionRecord
  ): Promise<{
    executionContext: WorkflowStageContextDTO;
    recordSnapshot: WorkflowExecutionRecord;
  }> {
    return this.snapshotAndHandoffHelper.capturePreModelingSnapshotIfNeeded(
      executionId,
      organizationId,
      dag,
      executionContext,
      recordSnapshot
    );
  }

  // --------------------------------------------------------------------------
  // executeStageWithRetry
  // --------------------------------------------------------------------------

  async executeStageWithRetry(
    executionId: string,
    stage: WorkflowStage,
    context: WorkflowStageContextDTO,
    route: StageRouteDTO,
    traceId: string
  ): Promise<StageExecutionResultDTO> {
    const stageTracer = getTracer();
    return stageTracer.startActiveSpan(
      "agent.executeStageWithRetry",
      {
        attributes: {
          "agent.stage_id": stage.id,
          "agent.stage_name": stage.name ?? stage.id,
          "agent.agent_type": stage.agent_type,
        },
      },
      async (span: Span) => {
        const start = Date.now();
        const cbKey = `${executionId}-${stage.id}`;
        const hitlResult = this.policy.checkHITL(
          this._buildStageDecisionContext(stage, context)
        );
        if (hitlResult.hitl_required) {
          const output = {
            rule_id: hitlResult.details.rule_id,
            confidence_score: hitlResult.details.confidence_score,
            traceId,
            reason: hitlResult.hitl_reason,
            stageId: stage.id,
            organizationId:
              context.organizationId ??
              context.organization_id ??
              context.tenantId,
          };

          securityLogger.log({
            category: "autonomy",
            action: "hitl_pending_approval",
            severity: "warning",
            metadata: output,
          });

          span.setAttributes({
            "agent.retry_count": 0,
            "agent.latency_ms": Date.now() - start,
          });
          span.setStatus({ code: SpanStatusCode.OK });
          span.end();
          return {
            status: "pending_approval",
            output,
          };
        }

        const stageRetryConfig = buildStageRetryConfig(
          stage,
          this.config.maxRetryAttempts
        );
        const retryOptions: Partial<RetryOptions> = buildRetryOptions(
          stage,
          context,
          traceId,
          executionId,
          stageRetryConfig
        );

        const stageAgent = {
          execute: async (): Promise<
            RetryAgentResponse<Record<string, unknown>>
          > => {
            const agentType = stage.agent_type as AgentType;
            if (!this.checkAgentRateLimit(agentType))
              throw new Error(`Agent ${agentType} rate limit exceeded`);
            const result = await this.circuitBreakers.execute(
              cbKey,
              () => this.executeStage(stage, context, route),
              { timeoutMs: (stage.timeout_seconds ?? 30) * 1000 }
            );
            return {
              success: true,
              data: result,
              confidence: "high",
              metadata: {
                executionId,
                agentType,
                startTime: new Date(),
                endTime: new Date(),
                duration: 0,
                tokenUsage: { input: 0, output: 0, total: 0, cost: 0 },
                cacheHit: false,
                retryCount: 0,
                circuitBreakerTripped: false,
              },
            };
          },
          getCapabilities: (): AgentCapability[] => [],
          validateInput: (): ValidationResult => ({
            valid: true,
            errors: [],
            warnings: [],
          }),
          getMetadata: (): AgentMetadata => ({}) as AgentMetadata,
          healthCheck: async (): Promise<AgentHealthStatus> => ({
            status: "healthy",
            lastCheck: new Date(),
            responseTime: 0,
            errorRate: 0,
            uptime: 100,
            activeConnections: 0,
          }),
          getConfiguration: (): AgentConfiguration =>
            ({}) as AgentConfiguration,
          updateConfiguration: async (): Promise<void> => {},
          getPerformanceMetrics: (): AgentPerformanceMetrics =>
            ({}) as AgentPerformanceMetrics,
          reset: async (): Promise<void> => {},
          getAgentType: (): AgentType => stage.agent_type as AgentType,
          supportsCapability: (): boolean => false,
          getInputSchema: (): Record<string, unknown> => ({}),
          getOutputSchema: (): Record<string, unknown> => ({}),
        };

        const retryRequest: AgentRequest = {
          agentType: stage.agent_type as AgentType,
          query: stage.description ?? `Execute ${stage.id}`,
          sessionId: context.sessionId ?? "",
          userId: context.userId ?? "",
          organizationId: context.organizationId ?? "",
          context,
          timeout: (stage.timeout_seconds ?? 30) * 1000,
        };

        const retryResult = await this.retryManager.executeWithRetry(
          stageAgent,
          retryRequest,
          retryOptions
        );
        span.setAttributes({
          "agent.retry_count": retryResult.attempts ?? 0,
          "agent.latency_ms": Date.now() - start,
        });

        if (retryResult.success && retryResult.response?.data) {
          if (route.selected_agent) {
            this.registry.recordRelease(route.selected_agent.id);
            this.registry.markHealthy(route.selected_agent.id);
          }
          span.setStatus({ code: SpanStatusCode.OK });
          span.end();
          const attempts = retryResult.attempts ?? 1;
          const runtimeFailure =
            attempts > 1
              ? this.buildFailureDetails({
                  failureClass: "transient-degraded",
                  severity: "degraded",
                  machineReasonCode: "TRANSIENT_RETRY_RECOVERED",
                  diagnosis: `Stage recovered after ${attempts} attempts.`,
                  confidence: 0.72,
                  blastRadiusEstimate: "single-stage",
                })
              : undefined;

          return {
            status: "completed",
            output: retryResult.response.data,
            runtimeFailure,
          };
        }

        if (route.selected_agent)
          this.registry.recordFailure(route.selected_agent.id);
        const errMsg = retryResult.error?.message ?? "Unknown error";
        span.setStatus({ code: SpanStatusCode.ERROR, message: errMsg });
        if (retryResult.error) span.recordException(retryResult.error);
        span.end();
        return {
          status: "failed",
          error: errMsg,
          runtimeFailure: this.classifyStageFailure(errMsg),
        };
      }
    );
  }

  // --------------------------------------------------------------------------
  // executeStage — single stage via message broker
  // --------------------------------------------------------------------------

  async executeStage(
    stage: WorkflowStage,
    context: WorkflowStageContextDTO,
    route: StageRouteDTO
  ): Promise<Record<string, unknown>> {
    const execTracer = getTracer();
    return execTracer.startActiveSpan(
      "agent.executeStage",
      {
        attributes: {
          "agent.stage_id": stage.id,
          "agent.agent_type": stage.agent_type,
        },
      },
      async (span: Span) => {
        const start = Date.now();
        const agentType = stage.agent_type as AgentType;
        const sessionId = context.sessionId ?? `session_${Date.now()}`;
        const stageContext = this.buildStageContext(
          context.organizationId ??
            context.organization_id ??
            context.tenantId ??
            "",
          context,
          `WorkflowExecutor.executeStage.${stage.id}`
        );
        const orgId = stageContext.organizationId ?? "";
        const agentContext: AgentContext = {
          userId: stageContext.userId ?? "",
          sessionId,
          organizationId: orgId,
          metadata: { currentStage: stage.id, organizationId: orgId },
        };

        let memoryContext: Record<string, unknown> = {};
        try {
          const memories = await this.memorySystem.retrieve({
            agent_id: agentType,
            organization_id: orgId,
            workspace_id: sessionId,
            limit: 5,
          });
          if (memories.length > 0)
            memoryContext = {
              pastMemories: memories.map(m => ({
                content: m.content,
                type: m.memory_type,
                importance: m.importance,
              })),
            };
        } catch (memErr) {
          logger.warn("Failed to retrieve memory for stage execution", {
            stage_id: stage.id,
            error: memErr instanceof Error ? memErr.message : String(memErr),
          });
        }

        try {
          const messageResult = await this.messageBroker.sendToAgent(
            "orchestrator",
            agentType,
            {
              action: "execute",
              description: stage.description ?? `Execute ${stage.id}`,
              context: { ...agentContext, ...memoryContext },
            },
            {
              priority: "normal",
              timeoutMs: (stage.timeout_seconds ?? 30) * 1000,
            }
          );
          if (!messageResult.success)
            throw new Error(
              `Agent communication failed: ${messageResult.error}`
            );

          const durationMs = Date.now() - start;
          recordAgentInvocation({
            agentName: agentType,
            stage: "hypothesis",
            outcome: "success",
            organizationId: orgId,
            durationMs,
          });
          try {
            await this.memorySystem.storeEpisode({
              sessionId,
              agentId: agentType,
              episodeType: "stage_execution",
              taskIntent: stage.description ?? stage.id,
              context: { organizationId: orgId, stageId: stage.id },
              initialState: stageContext,
              finalState: (messageResult.data as Record<string, unknown>) ?? {},
              success: true,
              rewardScore: 0.8,
              durationSeconds: durationMs / 1000,
            });
            await this.memorySystem.storeEpisodicMemory(
              sessionId,
              agentType,
              `Executed stage ${stage.id}: ${stage.description ?? stage.agent_type}`,
              { success: true, durationMs },
              orgId
            );
          } catch {
            /* memory failures must not mask execution result */
          }

          span.setAttributes({ "agent.latency_ms": durationMs });
          span.setStatus({ code: SpanStatusCode.OK });
          span.end();
          return {
            stage_id: stage.id,
            agent_type: stage.agent_type,
            agent_id: route.selected_agent?.id,
            output: messageResult.data,
          };
        } catch (err) {
          const durationMs = Date.now() - start;
          const isTimeout =
            err instanceof Error &&
            err.message.toLowerCase().includes("timeout");
          recordAgentInvocation({
            agentName: agentType,
            stage: "hypothesis",
            outcome: isTimeout ? "timeout" : "error",
            organizationId: orgId,
            durationMs,
          });
          try {
            await this.memorySystem.storeEpisode({
              sessionId,
              agentId: agentType,
              episodeType: "stage_execution",
              taskIntent: stage.description ?? stage.id,
              context: { organizationId: orgId, stageId: stage.id },
              initialState: stageContext,
              finalState: {
                error: err instanceof Error ? err.message : String(err),
              },
              success: false,
              rewardScore: 0.1,
              durationSeconds: durationMs / 1000,
            });
          } catch {
            /* ignore */
          }
          span.setAttributes({ "agent.latency_ms": durationMs });
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: err instanceof Error ? err.message : String(err),
          });
          if (err instanceof Error) span.recordException(err);
          span.end();
          throw err;
        }
      }
    );
  }

  // --- Handoff card / snapshot helpers ---
  private async _buildAndPersistHandoffCards(input: {
    executionId: string;
    organizationId: string;
    dag: WorkflowDAG;
    completedStages: Set<string>;
    fromStage: WorkflowStage;
    stageOutput: Record<string, unknown>;
    timestamp: string;
    actor: string;
  }): Promise<void> {
    await this.snapshotAndHandoffHelper.buildAndPersistHandoffCards(input);
  }

  // --- Runtime failure handling ---
  private _withRuntimeFailure(
    snapshot: WorkflowExecutionRecord,
    runtimeFailure: RuntimeFailureDetails
  ): WorkflowExecutionRecord {
    return withRuntimeFailure(snapshot, runtimeFailure);
  }

  private buildFailureDetails(input: {
    failureClass: RuntimeFailureDetails["class"];
    severity: RuntimeFailureDetails["severity"];
    machineReasonCode: string;
    diagnosis: string;
    confidence: number;
    blastRadiusEstimate: RuntimeFailureDetails["blastRadiusEstimate"];
    recommendedNextActions?: RuntimeFailureDetails["recommendedNextActions"];
  }): RuntimeFailureDetails {
    return buildFailureDetails(input);
  }

  private classifyStageFailure(errorMessage: string): RuntimeFailureDetails {
    return classifyStageFailure(errorMessage);
  }

  private _buildStageDecisionContext(
    stage: WorkflowStage,
    context: WorkflowStageContextDTO
  ): import("@shared/domain/DecisionContext.js").DecisionContext {
    const confidence =
      typeof context.opportunity_confidence_score === "number"
        ? context.opportunity_confidence_score
        : typeof context.confidence_score === "number"
          ? context.confidence_score
          : 0.5;

    const organizationId = String(
      context.organizationId ??
        context.organization_id ??
        context.tenantId ??
        ""
    );
    const opportunityId = String(
      context.opportunityId ??
        context.opportunity_id ??
        "00000000-0000-0000-0000-000000000000"
    );

    return {
      organization_id: organizationId,
      opportunity: {
        id: opportunityId,
        lifecycle_stage: stage.agent_type,
        confidence_score: confidence,
        value_maturity: "low",
      },
      is_external_artifact_action: isExternalArtifactWorkflowStage(stage),
    };
  }

  private async _persistAndUpdate(
    executionId: string,
    organizationId: string,
    record: WorkflowExecutionRecord,
    status: WorkflowStatus,
    stageId: string | null
  ): Promise<void> {
    await this.workflowPersistence.persistAndUpdate(
      executionId,
      organizationId,
      record,
      status,
      stageId
    );
  }

  private async _updateStatus(
    executionId: string,
    organizationId: string,
    status: WorkflowStatus,
    stageId: string | null,
    record: WorkflowExecutionRecord
  ): Promise<void> {
    await this.workflowPersistence.updateStatus(
      executionId,
      organizationId,
      status,
      stageId,
      record
    );
  }

  private async _recordWorkflowEvent(
    executionId: string,
    organizationId: string,
    eventType:
      | WorkflowEvent["event_type"]
      | "workflow_initiated"
      | "stage_waiting_for_approval"
      | "stage_hitl_pending_approval",
    stageId: string | null,
    metadata: Record<string, unknown>
  ): Promise<void> {
    await this.workflowPersistence.recordWorkflowEvent(
      executionId,
      organizationId,
      eventType,
      stageId,
      metadata
    );
  }

  private async _handleWorkflowFailure(
    executionId: string,
    organizationId: string,
    errorMessage: string
  ): Promise<void> {
    await this.workflowPersistence.handleWorkflowFailure(
      executionId,
      organizationId,
      errorMessage
    );
  }

  private _validateWorkflowDAG(rawDag: unknown): WorkflowDAG {
    return validateWorkflowDAG(rawDag);
  }
}

export { validateStageOutputSchema } from "./workflow-stage-output-schema.js";
