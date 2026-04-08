import { HandoffCardBuilder } from '../../services/workflows/HandoffCardBuilder.js';
import type { ValueTreeNodeRow, ValueTreeNodeWrite, ValueTreeRepository } from '../../repositories/ValueTreeRepository.js';
import type { WorkflowDAG, WorkflowStage } from '../../types/workflow.js';
import type { WorkflowStageContextDTO } from '../../types/workflow/runner.js';
import type { WorkflowExecutionRecord } from '../../types/workflowExecution.js';
import type { PolicyEngine } from '../policy-engine/index.js';
import type { WorkflowExecutionPersistencePort } from '../ports/runtimePorts.js';

const VALUE_MODELING_WORKFLOW_ID = 'value-modeling-v1';

export class SnapshotAndHandoffHelper {
  private readonly handoffCardBuilder = new HandoffCardBuilder();

  constructor(
    private readonly valueTreeRepo: ValueTreeRepository,
    private readonly executionPersistence: WorkflowExecutionPersistencePort,
    private readonly policy: PolicyEngine,
    private readonly buildStageContext: (
      authoritativeOrganizationId: string,
      context: WorkflowStageContextDTO,
      source: string,
    ) => WorkflowStageContextDTO,
    private readonly buildStageDecisionContext: (
      stage: WorkflowStage,
      context: WorkflowStageContextDTO,
    ) => import('@shared/domain/DecisionContext.js').DecisionContext,
  ) {}

  async capturePreModelingSnapshotIfNeeded(
    executionId: string,
    organizationId: string,
    dag: WorkflowDAG,
    executionContext: WorkflowStageContextDTO,
    recordSnapshot: WorkflowExecutionRecord,
  ): Promise<{
    executionContext: WorkflowStageContextDTO;
    recordSnapshot: WorkflowExecutionRecord;
  }> {
    if (dag.id !== VALUE_MODELING_WORKFLOW_ID) {
      return { executionContext, recordSnapshot };
    }

    const caseId = String(executionContext.caseId ?? executionContext.case_id ?? '');
    if (!caseId) {
      throw new Error('Value modeling workflow requires caseId to capture pre-modeling snapshot');
    }

    try {
      const existingNodes = await this.valueTreeRepo.getNodesForCase(caseId, organizationId);
      const preModelingSnapshot = this.toValueTreeSnapshot(existingNodes);

      const nextContext = this.buildStageContext(
        organizationId,
        {
          ...executionContext,
          caseId,
          case_id: caseId,
          preModelingSnapshot,
        },
        'WorkflowExecutor.capturePreModelingSnapshotIfNeeded',
      );

      const nextRecordSnapshot: WorkflowExecutionRecord = {
        ...recordSnapshot,
        context: {
          ...(recordSnapshot.context && typeof recordSnapshot.context === 'object'
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

      await this.executionPersistence.updateWorkflowExecutionContext(executionId, organizationId, nextContext);
      await this.executionPersistence.persistExecutionRecord(executionId, organizationId, nextRecordSnapshot);

      return {
        executionContext: nextContext,
        recordSnapshot: nextRecordSnapshot,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to capture pre-modeling snapshot: ${message}`);
    }
  }

  async buildAndPersistHandoffCards(input: {
    executionId: string;
    organizationId: string;
    dag: WorkflowDAG;
    completedStages: Set<string>;
    fromStage: WorkflowStage;
    stageOutput: Record<string, unknown>;
    timestamp: string;
    actor: string;
  }): Promise<void> {
    const outgoingTransitions = (input.dag.transitions ?? []).filter(transition => {
      const fromStageId = transition.from_stage ?? transition.from;
      return fromStageId === input.fromStage.id;
    });

    if (outgoingTransitions.length === 0) {
      return;
    }

    const getDependencies = (stageId: string): string[] =>
      (input.dag.transitions ?? [])
        .filter(transition => (transition.to_stage ?? transition.to) === stageId)
        .map(transition => transition.from_stage ?? transition.from)
        .filter((dependency): dependency is string => typeof dependency === 'string' && dependency.length > 0);

    for (const transition of outgoingTransitions) {
      const toStageId = transition.to_stage ?? transition.to;
      if (!toStageId) continue;

      const toStage = input.dag.stages.find(stage => stage.id === toStageId);
      if (!toStage) continue;

      const dependencies = getDependencies(toStage.id);
      const dependenciesMet = dependencies.length === 0 || dependencies.every(dependency => input.completedStages.has(dependency));
      if (!dependenciesMet) continue;

      const hitlResult = this.policy.checkHITL(
        this.buildStageDecisionContext(toStage, {
          organizationId: input.organizationId,
          organization_id: input.organizationId,
          tenantId: input.organizationId,
          confidence_score: typeof input.stageOutput.confidence_score === 'number' ? input.stageOutput.confidence_score : 0.5,
        }),
      );

      const policyConstraints = [
        `hitl_required=${String(hitlResult.hitl_required)}`,
        ...(hitlResult.hitl_reason ? [String(hitlResult.hitl_reason)] : []),
        ...(typeof hitlResult.details?.rule_id === 'string' ? [hitlResult.details.rule_id] : []),
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
        eventType: 'stage_transition_handoff_created',
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

  private toValueTreeSnapshot(nodes: ValueTreeNodeRow[]): ValueTreeNodeWrite[] {
    const orderedNodes = [...nodes].sort((a, b) => {
      if (a.sort_order !== b.sort_order) {
        return a.sort_order - b.sort_order;
      }

      const aKey = a.node_key ?? '';
      const bKey = b.node_key ?? '';
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
      driver_type: (row.driver_type as ValueTreeNodeWrite['driver_type']) ?? undefined,
      impact_estimate: row.impact_estimate ?? undefined,
      confidence: row.confidence ?? undefined,
      parent_node_key: row.parent_id ? keyById.get(row.parent_id) : undefined,
      sort_order: row.sort_order,
      source_agent: row.source_agent ?? undefined,
      metadata: row.metadata ?? {},
    }));
  }
}
