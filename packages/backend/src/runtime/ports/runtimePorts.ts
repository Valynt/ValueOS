import type { WorkflowStatus } from '../../repositories/WorkflowStateRepository.js';
import type { WorkflowStage } from '../../types/workflow.js';
import type {
  ApprovalCheckpointRecord,
  ApprovalCheckpointState,
} from '../../types/execution/workflowExecutionStore.js';
import type { WorkflowExecutionRecord } from '../../types/workflowExecution.js';

export type RuntimeMigrationPathTag = 'old_path' | 'new_path';

export interface OpportunityRoutingSnapshot {
  id: string;
  lifecycle_stage?: string;
  confidence_score?: number;
  value_maturity?: 'low' | 'medium' | 'high';
}

export interface HypothesisRoutingSnapshot {
  id: string;
  confidence?: 'high' | 'medium' | 'low';
  confidence_score?: number;
  evidence_count?: number;
  best_evidence_tier?: 'silver' | 'gold' | 'platinum';
}

export interface BusinessCaseRoutingSnapshot {
  id: string;
  status?: 'draft' | 'in_review' | 'approved' | 'presented' | 'archived';
  assumptions_reviewed?: boolean;
}

export interface DecisionContextSnapshot {
  opportunity: OpportunityRoutingSnapshot | null;
  hypothesis: HypothesisRoutingSnapshot | null;
  businessCase: BusinessCaseRoutingSnapshot | null;
}

export interface DecisionContextReadPort {
  getSnapshot(opportunityId: string, organizationId: string): Promise<DecisionContextSnapshot>;
}

export interface WorkflowDefinitionRecord {
  id: string;
  name: string;
  version: string;
  organization_id: string | null;
  dag_schema: unknown;
}

export interface WorkflowExecutionInsertInput {
  id: string;
  organization_id: string;
  workflow_definition_id: string;
  workflow_version: string;
  status: string;
  current_stage: string | null;
  context: Record<string, unknown>;
  audit_context: Record<string, unknown>;
  circuit_breaker_state: Record<string, unknown>;
}

export interface WorkflowExecutionPersistencePort {
  getActiveWorkflowDefinition(
    workflowDefinitionId: string,
    organizationId: string,
  ): Promise<WorkflowDefinitionRecord | null>;
  createWorkflowExecution(input: WorkflowExecutionInsertInput): Promise<{ id: string }>;
  updateWorkflowExecutionContext(
    executionId: string,
    organizationId: string,
    context: Record<string, unknown>,
  ): Promise<void>;
  persistExecutionRecord(
    executionId: string,
    organizationId: string,
    executionRecord: WorkflowExecutionRecord,
  ): Promise<void>;
  updateExecutionStatus(input: {
    executionId: string;
    organizationId: string;
    status: WorkflowStatus;
    currentStage: string | null;
    executionRecord?: WorkflowExecutionRecord;
  }): Promise<void>;
  recordStageRun(input: {
    executionId: string;
    organizationId: string;
    stage: WorkflowStage;
    executionRecord: WorkflowExecutionRecord;
    output?: Record<string, unknown>;
    startedAt: Date;
    completedAt: Date;
  }): Promise<void>;
  recordWorkflowEvent(input: {
    executionId: string;
    organizationId: string;
    eventType: string;
    stageId: string | null;
    metadata: Record<string, unknown>;
  }): Promise<void>;
  markWorkflowFailed(executionId: string, organizationId: string, errorMessage: string): Promise<void>;
}

export interface ApprovalCheckpointStoragePort {
  upsertApprovalCheckpoint(record: ApprovalCheckpointRecord): Promise<void>;
  listApprovalCheckpoints(input: {
    organizationId: string;
    ownerPrincipal?: string;
    ownerTeam?: string;
    states?: ApprovalCheckpointState[];
    overdueOnly?: boolean;
  }): Promise<ApprovalCheckpointRecord[]>;
  listOrganizationsWithPendingApprovalCheckpoints(): Promise<string[]>;
}
