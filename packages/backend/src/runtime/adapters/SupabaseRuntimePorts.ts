import type { SupabaseClient } from '@supabase/supabase-js';

import { logger } from '../../lib/logger.js';
import { WorkflowExecutionStore } from '../../services/workflows/WorkflowExecutionStore.js';
import type {
  ApprovalCheckpointStoragePort,
  BusinessCaseRoutingSnapshot,
  DecisionContextReadPort,
  DecisionContextSnapshot,
  HypothesisRoutingSnapshot,
  OpportunityRoutingSnapshot,
  WorkflowDefinitionRecord,
  WorkflowExecutionInsertInput,
  WorkflowExecutionPersistencePort,
} from '../ports/runtimePorts.js';

const CONFIDENCE_TO_SCORE: Record<'high' | 'medium' | 'low', number> = {
  high: 0.85,
  medium: 0.6,
  low: 0.35,
};

export interface SupabaseRuntimePorts {
  decisionContext: DecisionContextReadPort;
  workflowExecution: WorkflowExecutionPersistencePort;
  approvalCheckpointStorage: ApprovalCheckpointStoragePort;
}

class SupabaseDecisionContextReadAdapter implements DecisionContextReadPort {
  constructor(private readonly supabase: SupabaseClient) {}

  async getSnapshot(opportunityId: string, organizationId: string): Promise<DecisionContextSnapshot> {
    const [opportunityRes, hypothesisRes, businessCaseRes] = await Promise.all([
      this.supabase
        .from('opportunities')
        .select('id,lifecycle_stage,confidence_score,value_maturity')
        .eq('id', opportunityId)
        .eq('organization_id', organizationId)
        .maybeSingle(),
      this.supabase
        .from('hypothesis_outputs')
        .select('id,confidence_level,confidence,evidence_count,best_evidence_tier,created_at')
        .eq('opportunity_id', opportunityId)
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      this.supabase
        .from('business_cases')
        .select('id,status,assumptions_reviewed,created_at')
        .eq('opportunity_id', opportunityId)
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const opportunity: OpportunityRoutingSnapshot | null = opportunityRes.error || !opportunityRes.data
      ? null
      : {
          id: String(opportunityRes.data.id),
          lifecycle_stage: opportunityRes.data.lifecycle_stage ? String(opportunityRes.data.lifecycle_stage) : undefined,
          confidence_score: typeof opportunityRes.data.confidence_score === 'number' ? opportunityRes.data.confidence_score : undefined,
          value_maturity: opportunityRes.data.value_maturity === 'low' || opportunityRes.data.value_maturity === 'medium' || opportunityRes.data.value_maturity === 'high'
            ? opportunityRes.data.value_maturity
            : undefined,
        };

    const hypothesis: HypothesisRoutingSnapshot | null = hypothesisRes.error || !hypothesisRes.data
      ? null
      : (() => {
          const confidenceRaw = hypothesisRes.data.confidence_level ?? hypothesisRes.data.confidence;
          const confidence = confidenceRaw === 'high' || confidenceRaw === 'medium' || confidenceRaw === 'low'
            ? confidenceRaw
            : undefined;

          return {
            id: String(hypothesisRes.data.id),
            confidence,
            confidence_score: typeof hypothesisRes.data.confidence === 'number'
              ? hypothesisRes.data.confidence
              : confidence ? CONFIDENCE_TO_SCORE[confidence] : undefined,
            evidence_count: typeof hypothesisRes.data.evidence_count === 'number' ? hypothesisRes.data.evidence_count : undefined,
            best_evidence_tier: hypothesisRes.data.best_evidence_tier === 'silver'
              || hypothesisRes.data.best_evidence_tier === 'gold'
              || hypothesisRes.data.best_evidence_tier === 'platinum'
              ? hypothesisRes.data.best_evidence_tier
              : undefined,
          };
        })();

    const businessCase: BusinessCaseRoutingSnapshot | null = businessCaseRes.error || !businessCaseRes.data
      ? null
      : {
          id: String(businessCaseRes.data.id),
          status: businessCaseRes.data.status === 'draft'
            || businessCaseRes.data.status === 'in_review'
            || businessCaseRes.data.status === 'approved'
            || businessCaseRes.data.status === 'presented'
            || businessCaseRes.data.status === 'archived'
            ? businessCaseRes.data.status
            : undefined,
          assumptions_reviewed: typeof businessCaseRes.data.assumptions_reviewed === 'boolean'
            ? businessCaseRes.data.assumptions_reviewed
            : undefined,
        };

    return { opportunity, hypothesis, businessCase };
  }
}

class SupabaseWorkflowExecutionAdapter implements WorkflowExecutionPersistencePort, ApprovalCheckpointStoragePort {
  private readonly store: WorkflowExecutionStore;

  constructor(private readonly supabase: SupabaseClient) {
    this.store = new WorkflowExecutionStore(supabase);
  }

  async getActiveWorkflowDefinition(
    workflowDefinitionId: string,
    organizationId: string,
  ): Promise<WorkflowDefinitionRecord | null> {
    const { data: definition, error } = await this.supabase
      .from('workflow_definitions')
      .select('*')
      .eq('id', workflowDefinitionId)
      .eq('is_active', true)
      .or(`organization_id.is.null,organization_id.eq.${organizationId}`)
      .maybeSingle();

    if (error || !definition) {
      return null;
    }

    if (definition.organization_id && definition.organization_id !== organizationId) {
      return null;
    }

    return {
      id: String(definition.id),
      name: String(definition.name),
      version: String(definition.version),
      organization_id: definition.organization_id ? String(definition.organization_id) : null,
      dag_schema: definition.dag_schema,
    };
  }

  async createWorkflowExecution(input: WorkflowExecutionInsertInput): Promise<{ id: string }> {
    const { data, error } = await this.supabase
      .from('workflow_executions')
      .insert(input)
      .select('id')
      .single();

    if (error || !data) {
      throw new Error('Failed to create workflow execution');
    }

    return { id: String(data.id) };
  }

  async updateWorkflowExecutionContext(
    executionId: string,
    organizationId: string,
    context: Record<string, unknown>,
  ): Promise<void> {
    await this.supabase
      .from('workflow_executions')
      .update({ context })
      .eq('id', executionId)
      .eq('organization_id', organizationId);
  }

  async persistExecutionRecord(executionId: string, organizationId: string, executionRecord: Parameters<WorkflowExecutionStore['persistExecutionRecord']>[2]): Promise<void> {
    await this.store.persistExecutionRecord(executionId, organizationId, executionRecord);
  }

  async updateExecutionStatus(input: Parameters<WorkflowExecutionStore['updateExecutionStatus']>[0]): Promise<void> {
    await this.store.updateExecutionStatus(input);
  }

  async recordStageRun(input: Parameters<WorkflowExecutionStore['recordStageRun']>[0]): Promise<void> {
    await this.store.recordStageRun(input);
  }

  async recordWorkflowEvent(input: Parameters<WorkflowExecutionStore['recordWorkflowEvent']>[0]): Promise<void> {
    await this.store.recordWorkflowEvent(input);
  }

  async markWorkflowFailed(executionId: string, organizationId: string, errorMessage: string): Promise<void> {
    await this.supabase
      .from('workflow_executions')
      .update({ status: 'failed', error_message: errorMessage, completed_at: new Date().toISOString() })
      .eq('id', executionId)
      .eq('organization_id', organizationId);

    logger.error('Workflow failed', undefined, { executionId, errorMessage });
  }

  async upsertApprovalCheckpoint(record: Parameters<WorkflowExecutionStore['upsertApprovalCheckpoint']>[0]): Promise<void> {
    await this.store.upsertApprovalCheckpoint(record);
  }

  async listApprovalCheckpoints(input: Parameters<WorkflowExecutionStore['listApprovalCheckpoints']>[0]) {
    return this.store.listApprovalCheckpoints(input);
  }

  async listOrganizationsWithPendingApprovalCheckpoints(): Promise<string[]> {
    return this.store.listOrganizationsWithPendingApprovalCheckpoints();
  }
}

export function createSupabaseRuntimePorts(supabase: SupabaseClient): SupabaseRuntimePorts {
  const workflowExecution = new SupabaseWorkflowExecutionAdapter(supabase);

  return {
    decisionContext: new SupabaseDecisionContextReadAdapter(supabase),
    workflowExecution,
    approvalCheckpointStorage: workflowExecution,
  };
}

