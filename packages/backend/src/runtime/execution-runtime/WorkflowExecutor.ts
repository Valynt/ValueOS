/**
 * WorkflowExecutor
 *
 * Owns DAG workflow execution: executeWorkflow, executeDAGAsync,
 * executeStageWithRetry, executeStage. Extracted from
 * UnifiedAgentOrchestrator in Sprint 4.
 */

import { Span, SpanStatusCode } from "@opentelemetry/api";
import {
  buildRuntimeFailureDetails,
  type RuntimeFailureDetails,
} from "@valueos/shared";
import { securityLogger } from "../../services/core/SecurityLogger.js";
import { v4 as uuidv4 } from "uuid";

import { getTracer } from "../../config/telemetry.js";
import { MemorySystem } from "../../lib/agent-fabric/MemorySystem.js";
import { logger } from "../../lib/logger.js";
import { assertTenantContextMatch } from "../../lib/tenant/assertTenantContextMatch.js";
import {
  recordAgentInvocation,
  recordLoopCompletion,
  recordWorkflowDeadlineViolation,
  recordWorkflowExecutionActive,
} from "../../observability/valueLoopMetrics.js";
import {
  ValueTreeRepository,
  type ValueTreeNodeRow,
  type ValueTreeNodeWrite,
} from "../../repositories/ValueTreeRepository.js";
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
import {
  getEnhancedParallelExecutor,
  type RunnableTask,
} from "../../services/post-v1/EnhancedParallelExecutor.js";
import { HandoffCardBuilder } from "../../services/workflows/HandoffCardBuilder.js";
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
import { WorkflowStatePersistence } from "./state-persistence.js";
import { buildRetryOptions, buildStageRetryConfig } from "./retry-policy.js";
import { validateStageOutputSchema } from "./workflow-stage-output-schema.js";
import { stageTransitionEventBus } from "../approval-inbox/StageTransitionEventBus.js";

// ============================================================================
// Internal types
// ============================================================================

interface StageLifecycleRecord {
  stageId: string;
  lifecycleStage: string;
  status: string;
  startedAt: string;
  completedAt: string;
  summary?: string;
  runtimeFailure?: RuntimeFailureDetails;
}

// ============================================================================
// WorkflowExecutor
// ============================================================================

export interface WorkflowExecutorConfig {
  enableWorkflows: boolean;
  maxRetryAttempts: number;
  maxAgentInvocationsPerMinute: number;
}

const DEFAULT_WORKFLOW_DEADLINE_MINUTES = 30;
const VALUE_MODELING_WORKFLOW_ID = "value-modeling-v1";

const DEFAULT_CONFIG: WorkflowExecutorConfig = {
  enableWorkflows: true,
  maxRetryAttempts: 3,
  maxAgentInvocationsPerMinute: 20,
};

export class WorkflowExecutor {
  private readonly retryManager = AgentRetryManager.getInstance();
  private readonly executionPersistence: WorkflowExecutionPersistencePort;
  private readonly handoffCardBuilder: HandoffCardBuilder;
  private readonly statePersistence: WorkflowStatePersistence;
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
      dependencies.valueTreeRepo ?? (null as unknown as ValueTreeRepository);
    this.handoffCardBuilder = new HandoffCardBuilder();
    this.statePersistence = new WorkflowStatePersistence(
      this.executionPersistence
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
    let executionContext = this.buildStageContext(
      organizationId,
      initialContext,
      "WorkflowExecutor.executeDAGAsync.initialContext"
    );

    const defaultRecord: WorkflowExecutionRecord = executionRecord ?? {
      id: executionId,
      workflow_id: dag.id ?? "",
      workspace_id: "",
      organization_id: organizationId,
      status: "running",
      started_at: new Date().toISOString(),
      context: initialContext,
      lifecycle: [],
      outputs: [],
    };

    let recordSnapshot: WorkflowExecutionRecord = {
      ...defaultRecord,
      lifecycle: Array.isArray(defaultRecord.lifecycle)
        ? [...defaultRecord.lifecycle]
        : [],
      outputs: Array.isArray(defaultRecord.outputs)
        ? [...defaultRecord.outputs]
        : [],
    };

    ({ executionContext, recordSnapshot } =
      await this.capturePreModelingSnapshotIfNeeded(
        executionId,
        organizationId,
        dag,
        executionContext,
        recordSnapshot
      ));

    const dependencies = new Map<string, Set<string>>();
    const inProgress = new Set<string>();
    const completed = new Set<string>();
    const failed = new Map<string, string>();
    const stageStartTimes = new Map<string, Date>();
    const executor = getEnhancedParallelExecutor();
    let integrityVetoed = false;
    let schemaValidationFailed = false;

    for (const stage of dag.stages) {
      dependencies.set(stage.id, new Set());
    }

    for (const t of dag.transitions) {
      const to =
        t.to_stage ?? ((t as Record<string, unknown>).to as string) ?? "";
      const from =
        t.from_stage ?? ((t as Record<string, unknown>).from as string) ?? "";
      const deps = dependencies.get(to);
      if (deps) {
        deps.add(from);
      } else {
        dependencies.set(to, new Set([from]));
      }
    }

    const depsMet = (id: string) => {
      const d = dependencies.get(id);
      return !d || d.size === 0 || [...d].every(dep => completed.has(dep));
    };

    const total = dag.stages.length;

    while (completed.size + failed.size < total) {
      // Check deadline before processing next batch
      if (!checkDeadline()) {
        const deadlineError = `Workflow deadline exceeded: ${DEFAULT_WORKFLOW_DEADLINE_MINUTES} minutes`;
        const failureDetails = this.buildFailureDetails({
          failureClass: "execution-failed",
          severity: "failed",
          machineReasonCode: "WORKFLOW_DEADLINE_EXCEEDED",
          diagnosis: deadlineError,
          confidence: 0.94,
          blastRadiusEstimate: "workflow",
        });

        logger.error("Workflow deadline exceeded", {
          executionId,
          traceId,
          deadlineMinutes: DEFAULT_WORKFLOW_DEADLINE_MINUTES,
        });

        await this._recordWorkflowEvent(
          executionId,
          organizationId,
          "execution_failed",
          null,
          {
            reason: "deadline_exceeded",
            runtime_failure: failureDetails,
            traceId,
          }
        );

        await this._updateStatus(
          executionId,
          organizationId,
          "failed",
          null,
          this._withRuntimeFailure(recordSnapshot, failureDetails)
        );

        throw new Error(deadlineError);
      }

      const orgId = String(
        executionContext.organizationId ?? executionContext.tenantId ?? ""
      );
      if (orgId) {
        await this.policy.assertTenantExecutionAllowed(orgId);
      }

      const ready = dag.stages.filter(
        s =>
          !completed.has(s.id) &&
          !failed.has(s.id) &&
          !inProgress.has(s.id) &&
          depsMet(s.id)
      );

      if (ready.length === 0) {
        break;
      }

      const tasks: RunnableTask<{
        stage: WorkflowStage;
        route: ReturnType<DecisionRouter["routeStage"]>;
        context: WorkflowContextDTO;
        startedAt: Date;
      }>[] = ready.map(stage => {
        const route = this.router.routeStage(dag, stage.id, executionContext);
        const startedAt = new Date();

        stageStartTimes.set(stage.id, startedAt);
        inProgress.add(stage.id);

        stageTransitionEventBus.publish({
          source: "execution-runtime",
          organizationId,
          runId: executionId,
          stageId: stage.id,
          transition: "stage_started",
          metadata: { agent_type: stage.agent_type, trace_id: traceId },
        });

        return {
          id: stage.id,
          priority: "high",
          payload: {
            stage,
            route,
            context: this.buildStageContext(
              organizationId,
              executionContext,
              `WorkflowExecutor.executeDAGAsync.stage.${stage.id}`
            ),
            startedAt,
          },
        };
      });

      const taskLookup = new Map(tasks.map(t => [t.id, t]));
      const cap = Math.max(
        1,
        Math.min(this.config.maxAgentInvocationsPerMinute, tasks.length)
      );

      const results = await executor.executeRunnableTasks(
        tasks,
        async task => {
          const { stage, route, context } = task.payload;
          const stageResult = await this.executeStageWithRetry(
            executionId,
            stage,
            context,
            route as StageRouteDTO,
            traceId
          );
          return { stage, stageResult };
        },
        cap
      );

      for (const result of results) {
        const task = taskLookup.get(result.taskId);
        if (!task) {
          continue;
        }

        const { stage, startedAt } = task.payload;
        const stageStart =
          startedAt ?? stageStartTimes.get(stage.id) ?? new Date();
        const stageCompleted = new Date();

        inProgress.delete(stage.id);

        if (
          result.success &&
          (result.result?.stageResult.status === "waiting_approval" ||
            result.result?.stageResult.status === "pending_approval")
        ) {
          const hitlMetadata = result.result.stageResult.output ?? {};
          const approvalStatus = "pending_approval";

          stageTransitionEventBus.publish({
            source: "execution-runtime",
            organizationId,
            runId: executionId,
            stageId: stage.id,
            transition: "stage_waiting_approval",
            metadata: {
              ...hitlMetadata,
              checkpoint_id:
                (hitlMetadata.checkpoint_id as string | undefined) ?? uuidv4(),
              trace_id: traceId,
            },
          });

          recordSnapshot = this._appendStageRecord(
            recordSnapshot,
            stage,
            stageStart,
            stageCompleted,
            hitlMetadata,
            approvalStatus
          );

          const approvalEventMetadata = {
            reason: "hitl_required",
            ...hitlMetadata,
            traceId,
          };

          await this._recordWorkflowEvent(
            executionId,
            organizationId,
            "stage_waiting_for_approval",
            stage.id,
            approvalEventMetadata
          );

          await this._recordWorkflowEvent(
            executionId,
            organizationId,
            "stage_hitl_pending_approval",
            stage.id,
            approvalEventMetadata
          );

          await this._persistAndUpdate(
            executionId,
            organizationId,
            recordSnapshot,
            approvalStatus,
            stage.id
          );

          return;
        }

        if (
          result.success &&
          result.result?.stageResult.status === "completed"
        ) {
          const stageOutput = result.result.stageResult.output ?? {};
          const stageDiagnostic = result.result.stageResult.runtimeFailure;

          if (stageDiagnostic && stageDiagnostic.severity === "degraded") {
            this.lastDegradedState = stageDiagnostic;

            await this._recordWorkflowEvent(
              executionId,
              organizationId,
              "stage_completed",
              stage.id,
              {
                reason: "degraded_execution",
                runtime_failure: stageDiagnostic,
                traceId,
              }
            );
          }

          const schemaValidationResult = validateStageOutputSchema(
            stage,
            stageOutput
          );
          if (!schemaValidationResult.valid) {
            const msg = `Output failed ${schemaValidationResult.schemaName} schema validation.`;

            failed.set(stage.id, msg);
            schemaValidationFailed = true;

            const metadata = {
              reason: "schema_violation",
              schema: schemaValidationResult.schemaName,
              stageId: stage.id,
              issues: schemaValidationResult.issues,
            };

            recordSnapshot = this._appendStageRecord(
              recordSnapshot,
              stage,
              stageStart,
              stageCompleted,
              { error: msg, metadata },
              "failed"
            );

            await this._recordWorkflowEvent(
              executionId,
              organizationId,
              "stage_failed",
              stage.id,
              metadata
            );

            await this._persistAndUpdate(
              executionId,
              organizationId,
              recordSnapshot,
              "failed",
              stage.id
            );
            break;
          }

          const structuralCheck = await this.policy.evaluateStructuralTruthVeto(
            stageOutput,
            {
              traceId,
              agentType: stage.agent_type as AgentType,
              query: stage.description ?? stage.id,
              stageId: stage.id,
            }
          );

          if (structuralCheck.vetoed) {
            const msg =
              "Output failed structural truth validation against expected schema.";
            const failureDetails = this.buildFailureDetails({
              failureClass: "policy-blocked",
              severity: "failed",
              machineReasonCode: "POLICY_STRUCTURAL_TRUTH_VETO",
              diagnosis: msg,
              confidence: 0.95,
              blastRadiusEstimate: "workflow",
              recommendedNextActions: [
                "request-override",
                "reroute-owner",
                "escalate-approval-inbox",
              ],
            });

            failed.set(stage.id, msg);
            integrityVetoed = true;

            recordSnapshot = this._appendStageRecord(
              recordSnapshot,
              stage,
              stageStart,
              stageCompleted,
              { error: msg, metadata: structuralCheck.metadata },
              "failed",
              failureDetails
            );

            await this._recordWorkflowEvent(
              executionId,
              organizationId,
              "stage_failed",
              stage.id,
              {
                reason: "integrity_veto",
                metadata: structuralCheck.metadata,
                runtime_failure: failureDetails,
              }
            );

            await this._persistAndUpdate(
              executionId,
              organizationId,
              this._withRuntimeFailure(recordSnapshot, failureDetails),
              "failed",
              stage.id
            );

            continue;
          }

          const integrityCheck = await this.policy.evaluateIntegrityVeto(
            stageOutput,
            {
              traceId,
              agentType: stage.agent_type as AgentType,
              query: stage.description ?? stage.id,
              stageId: stage.id,
            }
          );

          if (integrityCheck.vetoed) {
            const msg =
              "Output failed integrity validation against ground truth benchmarks.";
            const failureDetails = this.buildFailureDetails({
              failureClass: "policy-blocked",
              severity: "failed",
              machineReasonCode: "POLICY_INTEGRITY_VETO",
              diagnosis: msg,
              confidence: 0.95,
              blastRadiusEstimate: "workflow",
              recommendedNextActions: [
                "request-override",
                "reroute-owner",
                "escalate-approval-inbox",
              ],
            });

            failed.set(stage.id, msg);
            integrityVetoed = true;

            recordSnapshot = this._appendStageRecord(
              recordSnapshot,
              stage,
              stageStart,
              stageCompleted,
              { error: msg, metadata: integrityCheck.metadata },
              "failed",
              failureDetails
            );

            await this._recordWorkflowEvent(
              executionId,
              organizationId,
              "stage_failed",
              stage.id,
              {
                reason: "integrity_veto",
                metadata: integrityCheck.metadata,
                runtime_failure: failureDetails,
              }
            );

            await this._persistAndUpdate(
              executionId,
              organizationId,
              this._withRuntimeFailure(recordSnapshot, failureDetails),
              "failed",
              stage.id
            );

            continue;
          }

          executionContext = this.buildStageContext(
            organizationId,
            { ...executionContext, ...stageOutput },
            `WorkflowExecutor.executeDAGAsync.output.${stage.id}`
          );

          stageTransitionEventBus.publish({
            source: "execution-runtime",
            organizationId,
            runId: executionId,
            stageId: stage.id,
            transition: "stage_completed",
            metadata: { trace_id: traceId },
          });

          recordSnapshot = this._appendStageRecord(
            recordSnapshot,
            stage,
            stageStart,
            stageCompleted,
            stageOutput,
            "completed",
            stageDiagnostic ?? undefined
          );

          await this.executionPersistence.recordStageRun({
            executionId,
            organizationId,
            stage,
            executionRecord: recordSnapshot,
            startedAt: stageStart,
            completedAt: stageCompleted,
            output: stageOutput,
          });

          completed.add(stage.id);

          await this._buildAndPersistHandoffCards({
            executionId,
            organizationId,
            dag,
            completedStages: completed,
            fromStage: stage,
            stageOutput,
            timestamp: stageCompleted.toISOString(),
            actor:
              executionContext.userId ??
              executionContext.actorId ??
              "workflow-orchestrator",
          });
        } else {
          const errMsg =
            result.result?.stageResult.error ??
            result.error ??
            "Unknown stage error";
          const failureDetails = this.classifyStageFailure(errMsg);

          stageTransitionEventBus.publish({
            source: "execution-runtime",
            organizationId,
            runId: executionId,
            stageId: stage.id,
            transition: "stage_failed",
            metadata: {
              error: errMsg,
              runtime_failure: failureDetails,
              trace_id: traceId,
            },
          });

          failed.set(stage.id, errMsg);

          recordSnapshot = this._appendStageRecord(
            recordSnapshot,
            stage,
            stageStart,
            stageCompleted,
            { error: errMsg },
            "failed",
            failureDetails
          );

          await this._recordWorkflowEvent(
            executionId,
            organizationId,
            "stage_failed",
            stage.id,
            {
              reason: "execution_error",
              runtime_failure: failureDetails,
              traceId,
            }
          );
        }

        await this._persistAndUpdate(
          executionId,
          organizationId,
          recordSnapshot,
          "in_progress",
          stage.id
        );
      }

      if (integrityVetoed || schemaValidationFailed) {
        break;
      }
    }

    // Mark blocked stages as failed
    for (const stage of dag.stages) {
      if (!completed.has(stage.id) && !failed.has(stage.id)) {
        failed.set(stage.id, "Blocked by unmet dependencies");
      }
    }

    if (failed.size > 0) {
      logger.error("DAG execution failed", {
        executionId,
        traceId,
        errorSummary: [...failed.entries()]
          .map(([id, e]) => `${id}: ${e}`)
          .join("; "),
      });

      const fallbackFailure = this.classifyStageFailure(
        [...failed.values()][0] ?? "Unknown stage error"
      );

      await this._recordWorkflowEvent(
        executionId,
        organizationId,
        "execution_failed",
        null,
        {
          reason: "workflow_failed",
          runtime_failure: fallbackFailure,
          traceId,
        }
      );

      await this._updateStatus(
        executionId,
        organizationId,
        "failed",
        null,
        this._withRuntimeFailure(recordSnapshot, fallbackFailure)
      );

      return;
    }

    const firstStage = (
      recordSnapshot.lifecycle as Array<{ startedAt?: string }> | undefined
    )?.[0];
    const dagStartMs = firstStage?.startedAt
      ? Date.now() - new Date(firstStage.startedAt).getTime()
      : 0;

    recordLoopCompletion({
      organizationId,
      sessionId: executionId,
      durationMs: dagStartMs,
      completedStages: [
        ...completed.keys(),
      ] as import("../../observability/valueLoopMetrics.js").ValueLoopStage[],
    });

    await this._updateStatus(
      executionId,
      organizationId,
      "completed",
      null,
      this.lastDegradedState
        ? this._withRuntimeFailure(recordSnapshot, this.lastDegradedState)
        : recordSnapshot
    );
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
    if (dag.id !== VALUE_MODELING_WORKFLOW_ID) {
      return { executionContext, recordSnapshot };
    }

    const caseId = String(
      executionContext.caseId ?? executionContext.case_id ?? ""
    );
    if (!caseId) {
      throw new Error(
        "Value modeling workflow requires caseId to capture pre-modeling snapshot"
      );
    }

    try {
      const existingNodes = await this.valueTreeRepo.getNodesForCase(
        caseId,
        organizationId
      );
      const preModelingSnapshot = this.toValueTreeSnapshot(existingNodes);

      const nextContext = this.buildStageContext(
        organizationId,
        {
          ...executionContext,
          caseId,
          case_id: caseId,
          preModelingSnapshot,
        },
        "WorkflowExecutor.capturePreModelingSnapshotIfNeeded"
      );

      const nextRecordSnapshot: WorkflowExecutionRecord = {
        ...recordSnapshot,
        context: {
          ...(recordSnapshot.context &&
          typeof recordSnapshot.context === "object"
            ? (recordSnapshot.context as Record<string, unknown>)
            : {}),
          caseId,
          case_id: caseId,
          organizationId,
          organization_id: organizationId,
          tenantId: organizationId,
          preModelingSnapshot,
        },
      };

      await this.executionPersistence.updateWorkflowExecutionContext(
        executionId,
        organizationId,
        nextContext
      );

      await this.executionPersistence.persistExecutionRecord(
        executionId,
        organizationId,
        nextRecordSnapshot
      );

      return {
        executionContext: nextContext,
        recordSnapshot: nextRecordSnapshot,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to capture pre-modeling snapshot: ${message}`);
    }
  }

  private toValueTreeSnapshot(nodes: ValueTreeNodeRow[]): ValueTreeNodeWrite[] {
    const orderedNodes = [...nodes].sort((a, b) => {
      if (a.sort_order !== b.sort_order) {
        return a.sort_order - b.sort_order;
      }

      const aKey = a.node_key ?? "";
      const bKey = b.node_key ?? "";
      if (aKey !== bKey) {
        return aKey.localeCompare(bKey);
      }

      return a.id.localeCompare(b.id);
    });

    const keyById = new Map<string, string>();
    for (const row of orderedNodes) {
      if (row.node_key) {
        keyById.set(row.id, row.node_key);
      }
    }

    return orderedNodes.map((row, index) => ({
      node_key: row.node_key ?? `snapshot-node-${index}`,
      label: row.label,
      description: row.description ?? undefined,
      driver_type:
        (row.driver_type as ValueTreeNodeWrite["driver_type"]) ?? undefined,
      impact_estimate: row.impact_estimate ?? undefined,
      confidence: row.confidence ?? undefined,
      parent_node_key: row.parent_id ? keyById.get(row.parent_id) : undefined,
      sort_order: row.sort_order,
      source_agent: row.source_agent ?? undefined,
      metadata: row.metadata ?? {},
    }));
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

  // --------------------------------------------------------------------------
  // Private helpers
  // --------------------------------------------------------------------------

  private _appendStageRecord(
    snapshot: WorkflowExecutionRecord,
    stage: WorkflowStage,
    startedAt: Date,
    completedAt: Date,
    payload: Record<string, unknown>,
    status: "completed" | "failed" | "pending_approval",
    runtimeFailure?: RuntimeFailureDetails
  ): WorkflowExecutionRecord {
    const lifecycle: StageLifecycleRecord = {
      stageId: stage.id,
      lifecycleStage: stage.agent_type,
      status,
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      summary: stage.description,
      ...(runtimeFailure ? { runtimeFailure } : {}),
    };
    const prevOutputs =
      snapshot.io && typeof snapshot.io === "object" && "outputs" in snapshot.io
        ? ((snapshot.io as Record<string, unknown>).outputs as Record<
            string,
            unknown
          >)
        : {};
    return {
      ...snapshot,
      lifecycle: [
        ...(Array.isArray(snapshot.lifecycle) ? snapshot.lifecycle : []),
        lifecycle,
      ],
      outputs: [
        ...(Array.isArray(snapshot.outputs) ? snapshot.outputs : []),
        { stageId: stage.id, payload, completedAt: completedAt.toISOString() },
      ],
      io: {
        ...(snapshot.io && typeof snapshot.io === "object"
          ? (snapshot.io as Record<string, unknown>)
          : {}),
        outputs: { ...prevOutputs, [stage.id]: payload },
      },
      ...(status === "completed" &&
      (payload as Record<string, unknown>).economic_deltas
        ? {
            economicDeltas: (payload as Record<string, unknown>)
              .economic_deltas,
          }
        : {}),
    };
  }

  // --- Handoff card builder (from codex branch) ---
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
    const outgoingTransitions = (input.dag.transitions ?? []).filter(
      transition => {
        const fromStageId = transition.from_stage ?? transition.from;
        return fromStageId === input.fromStage.id;
      }
    );

    if (outgoingTransitions.length === 0) {
      return;
    }

    const getDependencies = (stageId: string): string[] =>
      (input.dag.transitions ?? [])
        .filter(
          transition => (transition.to_stage ?? transition.to) === stageId
        )
        .map(transition => transition.from_stage ?? transition.from)
        .filter(
          (dependency): dependency is string =>
            typeof dependency === "string" && dependency.length > 0
        );

    for (const transition of outgoingTransitions) {
      const toStageId = transition.to_stage ?? transition.to;
      if (!toStageId) continue;

      const toStage = input.dag.stages.find(stage => stage.id === toStageId);
      if (!toStage) continue;

      const dependencies = getDependencies(toStage.id);
      const dependenciesMet =
        dependencies.length === 0 ||
        dependencies.every(dependency => input.completedStages.has(dependency));

      if (!dependenciesMet) continue;

      const hitlResult = this.policy.checkHITL(
        this._buildStageDecisionContext(toStage, {
          organizationId: input.organizationId,
          organization_id: input.organizationId,
          tenantId: input.organizationId,
          confidence_score:
            typeof input.stageOutput.confidence_score === "number"
              ? input.stageOutput.confidence_score
              : 0.5,
        })
      );

      const policyConstraints = [
        `hitl_required=${String(hitlResult.hitl_required)}`,
        ...(hitlResult.hitl_reason ? [String(hitlResult.hitl_reason)] : []),
        ...(typeof hitlResult.details?.rule_id === "string"
          ? [hitlResult.details.rule_id]
          : []),
      ];

      const handoffCard = this.handoffCardBuilder.build({
        runId: input.executionId,
        fromStage: input.fromStage,
        toStage,
        actor: input.actor,
        timestamp: input.timestamp,
        dag: input.dag,
        stageOutput: input.stageOutput,
        policyConstraints,
      });

      await this.executionPersistence.recordWorkflowEvent({
        executionId: input.executionId,
        organizationId: input.organizationId,
        eventType: "stage_transition_handoff_created",
        stageId: toStage.id,
        metadata: {
          run_id: input.executionId,
          stage_id: toStage.id,
          from_stage: input.fromStage.id,
          transition_timestamp: input.timestamp,
          handoff_card: handoffCard,
          addendum_comments: [],
        },
      });
    }
  }

  // --- Runtime failure handling (from main branch) ---
  private _withRuntimeFailure(
    snapshot: WorkflowExecutionRecord,
    runtimeFailure: RuntimeFailureDetails
  ): WorkflowExecutionRecord {
    return {
      ...snapshot,
      io: {
        ...(snapshot.io && typeof snapshot.io === "object"
          ? (snapshot.io as Record<string, unknown>)
          : {}),
        runtime_failure: runtimeFailure,
      },
    };
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
    return buildRuntimeFailureDetails({
      class: input.failureClass,
      severity: input.severity,
      machineReasonCode: input.machineReasonCode,
      diagnosis: input.diagnosis,
      confidence: input.confidence,
      blastRadiusEstimate: input.blastRadiusEstimate,
      recommendedNextActions: input.recommendedNextActions,
    });
  }

  private classifyStageFailure(errorMessage: string): RuntimeFailureDetails {
    const msg = errorMessage.toLowerCase();

    if (
      msg.includes("policy") ||
      msg.includes("veto") ||
      msg.includes("approval")
    ) {
      return this.buildFailureDetails({
        failureClass: "policy-blocked",
        severity: "failed",
        machineReasonCode: "POLICY_BLOCKED",
        diagnosis: errorMessage,
        confidence: 0.9,
        blastRadiusEstimate: "workflow",
      });
    }

    if (
      msg.includes("missing") ||
      msg.includes("not found") ||
      msg.includes("artifact") ||
      msg.includes("required")
    ) {
      return this.buildFailureDetails({
        failureClass: "data-missing",
        severity: "failed",
        machineReasonCode: "DATA_MISSING",
        diagnosis: errorMessage,
        confidence: 0.85,
        blastRadiusEstimate: "single-stage",
      });
    }

    if (
      msg.includes("timeout") ||
      msg.includes("unavailable") ||
      msg.includes("connection") ||
      msg.includes("service")
    ) {
      return this.buildFailureDetails({
        failureClass: "dependency-unavailable",
        severity: "failed",
        machineReasonCode: "DEPENDENCY_UNAVAILABLE",
        diagnosis: errorMessage,
        confidence: 0.81,
        blastRadiusEstimate: "workflow",
      });
    }

    return this.buildFailureDetails({
      failureClass: "execution-failed",
      severity: "failed",
      machineReasonCode: "EXECUTION_FAILED",
      diagnosis: errorMessage,
      confidence: 0.78,
      blastRadiusEstimate: "single-stage",
    });
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
    await this.statePersistence.persistAndUpdate(
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
    await this.statePersistence.updateStatus(
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
    await this.statePersistence.recordWorkflowEvent(
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
    await this.statePersistence.handleWorkflowFailure(
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
