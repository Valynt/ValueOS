import { v4 as uuidv4 } from 'uuid';
import type { RuntimeFailureDetails } from '@valueos/shared';

import { logger } from '../../lib/logger.js';
import { recordLoopCompletion } from '../../observability/valueLoopMetrics.js';
import type { WorkflowStatus } from '../../repositories/WorkflowStateRepository.js';
import {
  getEnhancedParallelExecutor,
  type RunnableTask,
} from '../../services/post-v1/EnhancedParallelExecutor.js';
import type { WorkflowContextDTO } from '../../types/workflow/orchestration.js';
import type {
  StageExecutionResultDTO,
  StageRouteDTO,
  WorkflowStageContextDTO,
} from '../../types/workflow/runner.js';
import type {
  WorkflowDAG,
  WorkflowEvent,
  WorkflowStage,
} from '../../types/workflow.js';
import type { WorkflowExecutionRecord } from '../../types/workflowExecution.js';
import type { DecisionRouter } from '../decision-router/index.js';
import type { PolicyEngine } from '../policy-engine/index.js';
import { stageTransitionEventBus } from '../approval-inbox/StageTransitionEventBus.js';
import { validateStageOutputSchema } from './workflow-stage-output-schema.js';

interface StageLifecycleRecord {
  stageId: string;
  lifecycleStage: string;
  status: string;
  startedAt: string;
  completedAt: string;
  summary?: string;
  runtimeFailure?: RuntimeFailureDetails;
}

interface DagRunnerDeps {
  policy: PolicyEngine;
  router: DecisionRouter;
  maxAgentInvocationsPerMinute: number;
  executeStageWithRetry: (
    executionId: string,
    stage: WorkflowStage,
    context: WorkflowStageContextDTO,
    route: StageRouteDTO,
    traceId: string,
  ) => Promise<StageExecutionResultDTO>;
  buildStageContext: (
    authoritativeOrganizationId: string,
    context: WorkflowStageContextDTO,
    source: string,
  ) => WorkflowStageContextDTO;
  buildStageDecisionContext: (
    stage: WorkflowStage,
    context: WorkflowStageContextDTO,
  ) => import('@shared/domain/DecisionContext.js').DecisionContext;
  classifyStageFailure: (errorMessage: string) => RuntimeFailureDetails;
  buildFailureDetails: (input: {
    failureClass: RuntimeFailureDetails['class'];
    severity: RuntimeFailureDetails['severity'];
    machineReasonCode: string;
    diagnosis: string;
    confidence: number;
    blastRadiusEstimate: RuntimeFailureDetails['blastRadiusEstimate'];
    recommendedNextActions?: RuntimeFailureDetails['recommendedNextActions'];
  }) => RuntimeFailureDetails;
  withRuntimeFailure: (
    snapshot: WorkflowExecutionRecord,
    runtimeFailure: RuntimeFailureDetails,
  ) => WorkflowExecutionRecord;
  persistAndUpdate: (
    executionId: string,
    organizationId: string,
    record: WorkflowExecutionRecord,
    status: WorkflowStatus,
    stageId: string | null,
  ) => Promise<void>;
  updateStatus: (
    executionId: string,
    organizationId: string,
    status: WorkflowStatus,
    stageId: string | null,
    record: WorkflowExecutionRecord,
  ) => Promise<void>;
  recordWorkflowEvent: (
    executionId: string,
    organizationId: string,
    eventType:
      | WorkflowEvent['event_type']
      | 'workflow_initiated'
      | 'stage_waiting_for_approval'
      | 'stage_hitl_pending_approval',
    stageId: string | null,
    metadata: Record<string, unknown>,
  ) => Promise<void>;
  recordStageRun: (input: {
    executionId: string;
    organizationId: string;
    stage: WorkflowStage;
    executionRecord: WorkflowExecutionRecord;
    startedAt: Date;
    completedAt: Date;
    output: Record<string, unknown>;
  }) => Promise<void>;
  buildAndPersistHandoffCards: (input: {
    executionId: string;
    organizationId: string;
    dag: WorkflowDAG;
    completedStages: Set<string>;
    fromStage: WorkflowStage;
    stageOutput: Record<string, unknown>;
    timestamp: string;
    actor: string;
  }) => Promise<void>;
}

export class WorkflowDagRunner {
  private lastDegradedState: RuntimeFailureDetails | null = null;

  constructor(private readonly deps: DagRunnerDeps) {}

  async run(input: {
    executionId: string;
    organizationId: string;
    dag: WorkflowDAG;
    initialContext: WorkflowStageContextDTO;
    traceId: string;
    executionRecord: WorkflowExecutionRecord | undefined;
    checkDeadline: () => boolean;
    capturePreModelingSnapshotIfNeeded: (params: {
      executionId: string;
      organizationId: string;
      dag: WorkflowDAG;
      executionContext: WorkflowStageContextDTO;
      recordSnapshot: WorkflowExecutionRecord;
    }) => Promise<{
      executionContext: WorkflowStageContextDTO;
      recordSnapshot: WorkflowExecutionRecord;
    }>;
  }): Promise<void> {
    const { executionId, organizationId, dag, traceId, executionRecord, checkDeadline } = input;
    let executionContext = this.deps.buildStageContext(
      organizationId,
      input.initialContext,
      'WorkflowExecutor.executeDAGAsync.initialContext',
    );

    const defaultRecord: WorkflowExecutionRecord = executionRecord ?? {
      id: executionId,
      workflow_id: dag.id ?? '',
      workspace_id: '',
      organization_id: organizationId,
      status: 'running',
      started_at: new Date().toISOString(),
      context: input.initialContext,
      lifecycle: [],
      outputs: [],
    };

    let recordSnapshot: WorkflowExecutionRecord = {
      ...defaultRecord,
      lifecycle: Array.isArray(defaultRecord.lifecycle) ? [...defaultRecord.lifecycle] : [],
      outputs: Array.isArray(defaultRecord.outputs) ? [...defaultRecord.outputs] : [],
    };

    ({ executionContext, recordSnapshot } = await input.capturePreModelingSnapshotIfNeeded({
      executionId,
      organizationId,
      dag,
      executionContext,
      recordSnapshot,
    }));

    const dependencies = new Map<string, Set<string>>();
    const inProgress = new Set<string>();
    const completed = new Set<string>();
    const failed = new Map<string, string>();
    const stageStartTimes = new Map<string, Date>();
    const executor = getEnhancedParallelExecutor();
    let integrityVetoed = false;
    let schemaValidationFailed = false;

    for (const stage of dag.stages) dependencies.set(stage.id, new Set());
    for (const t of dag.transitions) {
      const to = t.to_stage ?? ((t as Record<string, unknown>).to as string) ?? '';
      const from = t.from_stage ?? ((t as Record<string, unknown>).from as string) ?? '';
      const dep = dependencies.get(to);
      if (dep) dep.add(from);
      else dependencies.set(to, new Set([from]));
    }

    const depsMet = (id: string) => {
      const d = dependencies.get(id);
      return !d || d.size === 0 || [...d].every(dep => completed.has(dep));
    };

    const total = dag.stages.length;
    while (completed.size + failed.size < total) {
      if (!checkDeadline()) {
        const deadlineError = 'Workflow deadline exceeded: 30 minutes';
        const failureDetails = this.deps.buildFailureDetails({
          failureClass: 'execution-failed',
          severity: 'failed',
          machineReasonCode: 'WORKFLOW_DEADLINE_EXCEEDED',
          diagnosis: deadlineError,
          confidence: 0.94,
          blastRadiusEstimate: 'workflow',
        });

        await this.deps.recordWorkflowEvent(executionId, organizationId, 'execution_failed', null, {
          reason: 'deadline_exceeded',
          runtime_failure: failureDetails,
          traceId,
        });
        await this.deps.updateStatus(
          executionId,
          organizationId,
          'failed',
          null,
          this.deps.withRuntimeFailure(recordSnapshot, failureDetails),
        );
        throw new Error(deadlineError);
      }

      const orgId = String(executionContext.organizationId ?? executionContext.tenantId ?? '');
      if (orgId) await this.deps.policy.assertTenantExecutionAllowed(orgId);

      const ready = dag.stages.filter(
        s => !completed.has(s.id) && !failed.has(s.id) && !inProgress.has(s.id) && depsMet(s.id),
      );
      if (ready.length === 0) break;

      const tasks: RunnableTask<{
        stage: WorkflowStage;
        route: ReturnType<DecisionRouter['routeStage']>;
        context: WorkflowContextDTO;
        startedAt: Date;
      }>[] = ready.map(stage => {
        const route = this.deps.router.routeStage(dag, stage.id, executionContext);
        const startedAt = new Date();
        stageStartTimes.set(stage.id, startedAt);
        inProgress.add(stage.id);
        stageTransitionEventBus.publish({
          source: 'execution-runtime',
          organizationId,
          runId: executionId,
          stageId: stage.id,
          transition: 'stage_started',
          metadata: { agent_type: stage.agent_type, trace_id: traceId },
        });
        return {
          id: stage.id,
          priority: 'high',
          payload: {
            stage,
            route,
            context: this.deps.buildStageContext(
              organizationId,
              executionContext,
              `WorkflowExecutor.executeDAGAsync.stage.${stage.id}`,
            ),
            startedAt,
          },
        };
      });

      const taskLookup = new Map(tasks.map(t => [t.id, t]));
      const cap = Math.max(1, Math.min(this.deps.maxAgentInvocationsPerMinute, tasks.length));
      const results = await executor.executeRunnableTasks(
        tasks,
        async task => {
          const { stage, route, context } = task.payload;
          const stageResult = await this.deps.executeStageWithRetry(executionId, stage, context, route as StageRouteDTO, traceId);
          return { stage, stageResult };
        },
        cap,
      );

      for (const result of results) {
        const task = taskLookup.get(result.taskId);
        if (!task) continue;
        const { stage, startedAt } = task.payload;
        const stageStart = startedAt ?? stageStartTimes.get(stage.id) ?? new Date();
        const stageCompleted = new Date();
        inProgress.delete(stage.id);

        if (result.success && (result.result?.stageResult.status === 'waiting_approval' || result.result?.stageResult.status === 'pending_approval')) {
          const hitlMetadata = result.result.stageResult.output ?? {};
          const approvalStatus = 'pending_approval';
          stageTransitionEventBus.publish({
            source: 'execution-runtime', organizationId, runId: executionId, stageId: stage.id,
            transition: 'stage_waiting_approval',
            metadata: { ...hitlMetadata, checkpoint_id: (hitlMetadata.checkpoint_id as string | undefined) ?? uuidv4(), trace_id: traceId },
          });

          recordSnapshot = this.appendStageRecord(recordSnapshot, stage, stageStart, stageCompleted, hitlMetadata, approvalStatus);
          const approvalEventMetadata = { reason: 'hitl_required', ...hitlMetadata, traceId };
          await this.deps.recordWorkflowEvent(executionId, organizationId, 'stage_waiting_for_approval', stage.id, approvalEventMetadata);
          await this.deps.recordWorkflowEvent(executionId, organizationId, 'stage_hitl_pending_approval', stage.id, approvalEventMetadata);
          await this.deps.persistAndUpdate(executionId, organizationId, recordSnapshot, approvalStatus, stage.id);
          return;
        }

        if (result.success && result.result?.stageResult.status === 'completed') {
          const stageOutput = result.result.stageResult.output ?? {};
          const stageDiagnostic = result.result.stageResult.runtimeFailure;

          if (stageDiagnostic && stageDiagnostic.severity === 'degraded') {
            this.lastDegradedState = stageDiagnostic;
            await this.deps.recordWorkflowEvent(executionId, organizationId, 'stage_completed', stage.id, {
              reason: 'degraded_execution', runtime_failure: stageDiagnostic, traceId,
            });
          }

          const schemaValidationResult = validateStageOutputSchema(stage, stageOutput);
          if (!schemaValidationResult.valid) {
            const msg = `Output failed ${schemaValidationResult.schemaName} schema validation.`;
            failed.set(stage.id, msg);
            schemaValidationFailed = true;
            const metadata = { reason: 'schema_violation', schema: schemaValidationResult.schemaName, stageId: stage.id, issues: schemaValidationResult.issues };
            recordSnapshot = this.appendStageRecord(recordSnapshot, stage, stageStart, stageCompleted, { error: msg, metadata }, 'failed');
            await this.deps.recordWorkflowEvent(executionId, organizationId, 'stage_failed', stage.id, metadata);
            await this.deps.persistAndUpdate(executionId, organizationId, recordSnapshot, 'failed', stage.id);
            break;
          }

          const structuralCheck = await this.deps.policy.evaluateStructuralTruthVeto(stageOutput, {
            traceId,
            agentType: stage.agent_type as never,
            query: stage.description ?? stage.id,
            stageId: stage.id,
          });
          if (structuralCheck.vetoed) {
            const msg = 'Output failed structural truth validation against expected schema.';
            const failureDetails = this.deps.buildFailureDetails({
              failureClass: 'policy-blocked', severity: 'failed', machineReasonCode: 'POLICY_STRUCTURAL_TRUTH_VETO', diagnosis: msg, confidence: 0.95, blastRadiusEstimate: 'workflow',
              recommendedNextActions: ['request-override', 'reroute-owner', 'escalate-approval-inbox'],
            });
            failed.set(stage.id, msg);
            integrityVetoed = true;
            recordSnapshot = this.appendStageRecord(recordSnapshot, stage, stageStart, stageCompleted, { error: msg, metadata: structuralCheck.metadata }, 'failed', failureDetails);
            await this.deps.recordWorkflowEvent(executionId, organizationId, 'stage_failed', stage.id, { reason: 'integrity_veto', metadata: structuralCheck.metadata, runtime_failure: failureDetails });
            await this.deps.persistAndUpdate(executionId, organizationId, this.deps.withRuntimeFailure(recordSnapshot, failureDetails), 'failed', stage.id);
            continue;
          }

          const integrityCheck = await this.deps.policy.evaluateIntegrityVeto(stageOutput, {
            traceId,
            agentType: stage.agent_type as never,
            query: stage.description ?? stage.id,
            stageId: stage.id,
          });
          if (integrityCheck.vetoed) {
            const msg = 'Output failed integrity validation against ground truth benchmarks.';
            const failureDetails = this.deps.buildFailureDetails({
              failureClass: 'policy-blocked', severity: 'failed', machineReasonCode: 'POLICY_INTEGRITY_VETO', diagnosis: msg, confidence: 0.95, blastRadiusEstimate: 'workflow',
              recommendedNextActions: ['request-override', 'reroute-owner', 'escalate-approval-inbox'],
            });
            failed.set(stage.id, msg);
            integrityVetoed = true;
            recordSnapshot = this.appendStageRecord(recordSnapshot, stage, stageStart, stageCompleted, { error: msg, metadata: integrityCheck.metadata }, 'failed', failureDetails);
            await this.deps.recordWorkflowEvent(executionId, organizationId, 'stage_failed', stage.id, { reason: 'integrity_veto', metadata: integrityCheck.metadata, runtime_failure: failureDetails });
            await this.deps.persistAndUpdate(executionId, organizationId, this.deps.withRuntimeFailure(recordSnapshot, failureDetails), 'failed', stage.id);
            continue;
          }

          executionContext = this.deps.buildStageContext(organizationId, { ...executionContext, ...stageOutput }, `WorkflowExecutor.executeDAGAsync.output.${stage.id}`);
          stageTransitionEventBus.publish({
            source: 'execution-runtime', organizationId, runId: executionId, stageId: stage.id, transition: 'stage_completed', metadata: { trace_id: traceId },
          });

          recordSnapshot = this.appendStageRecord(recordSnapshot, stage, stageStart, stageCompleted, stageOutput, 'completed', stageDiagnostic ?? undefined);
          await this.deps.recordStageRun({ executionId, organizationId, stage, executionRecord: recordSnapshot, startedAt: stageStart, completedAt: stageCompleted, output: stageOutput });
          completed.add(stage.id);

          await this.deps.buildAndPersistHandoffCards({
            executionId,
            organizationId,
            dag,
            completedStages: completed,
            fromStage: stage,
            stageOutput,
            timestamp: stageCompleted.toISOString(),
            actor: executionContext.userId ?? executionContext.actorId ?? 'workflow-orchestrator',
          });
        } else {
          const errMsg = result.result?.stageResult.error ?? result.error ?? 'Unknown stage error';
          const failureDetails = this.deps.classifyStageFailure(errMsg);
          stageTransitionEventBus.publish({
            source: 'execution-runtime', organizationId, runId: executionId, stageId: stage.id,
            transition: 'stage_failed', metadata: { error: errMsg, runtime_failure: failureDetails, trace_id: traceId },
          });
          failed.set(stage.id, errMsg);
          recordSnapshot = this.appendStageRecord(recordSnapshot, stage, stageStart, stageCompleted, { error: errMsg }, 'failed', failureDetails);
          await this.deps.recordWorkflowEvent(executionId, organizationId, 'stage_failed', stage.id, {
            reason: 'execution_error', runtime_failure: failureDetails, traceId,
          });
        }

        await this.deps.persistAndUpdate(executionId, organizationId, recordSnapshot, 'in_progress', stage.id);
      }

      if (integrityVetoed || schemaValidationFailed) break;
    }

    for (const stage of dag.stages) {
      if (!completed.has(stage.id) && !failed.has(stage.id)) failed.set(stage.id, 'Blocked by unmet dependencies');
    }

    if (failed.size > 0) {
      logger.error('DAG execution failed', {
        executionId,
        traceId,
        errorSummary: [...failed.entries()].map(([id, e]) => `${id}: ${e}`).join('; '),
      });
      const fallbackFailure = this.deps.classifyStageFailure([...failed.values()][0] ?? 'Unknown stage error');
      await this.deps.recordWorkflowEvent(executionId, organizationId, 'execution_failed', null, {
        reason: 'workflow_failed', runtime_failure: fallbackFailure, traceId,
      });
      await this.deps.updateStatus(executionId, organizationId, 'failed', null, this.deps.withRuntimeFailure(recordSnapshot, fallbackFailure));
      return;
    }

    const firstStage = (recordSnapshot.lifecycle as Array<{ startedAt?: string }> | undefined)?.[0];
    const dagStartMs = firstStage?.startedAt ? Date.now() - new Date(firstStage.startedAt).getTime() : 0;
    recordLoopCompletion({
      organizationId,
      sessionId: executionId,
      durationMs: dagStartMs,
      completedStages: [...completed.keys()] as import('../../observability/valueLoopMetrics.js').ValueLoopStage[],
    });

    await this.deps.updateStatus(
      executionId,
      organizationId,
      'completed',
      null,
      this.lastDegradedState ? this.deps.withRuntimeFailure(recordSnapshot, this.lastDegradedState) : recordSnapshot,
    );
  }

  private appendStageRecord(
    snapshot: WorkflowExecutionRecord,
    stage: WorkflowStage,
    startedAt: Date,
    completedAt: Date,
    payload: Record<string, unknown>,
    status: 'completed' | 'failed' | 'pending_approval',
    runtimeFailure?: RuntimeFailureDetails,
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
      snapshot.io && typeof snapshot.io === 'object' && 'outputs' in snapshot.io
        ? ((snapshot.io as Record<string, unknown>).outputs as Record<string, unknown>)
        : {};
    return {
      ...snapshot,
      lifecycle: [...(Array.isArray(snapshot.lifecycle) ? snapshot.lifecycle : []), lifecycle],
      outputs: [
        ...(Array.isArray(snapshot.outputs) ? snapshot.outputs : []),
        { stageId: stage.id, payload, completedAt: completedAt.toISOString() },
      ],
      io: {
        ...(snapshot.io && typeof snapshot.io === 'object' ? (snapshot.io as Record<string, unknown>) : {}),
        outputs: { ...prevOutputs, [stage.id]: payload },
      },
      ...(status === 'completed' && (payload as Record<string, unknown>).economic_deltas
        ? { economicDeltas: (payload as Record<string, unknown>).economic_deltas }
        : {}),
    };
  }
}
