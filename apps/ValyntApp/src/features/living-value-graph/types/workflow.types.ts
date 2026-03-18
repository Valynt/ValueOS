/**
 * Workflow Types - State machine and orchestration types
 */

export type WorkflowState =
  | 'INITIATED'
  | 'DRAFTING'
  | 'VALIDATING'
  | 'COMPOSING'
  | 'REFINING'
  | 'FINALIZED';

export type WorkflowStep =
  | 'hypothesis'
  | 'model'
  | 'evidence'
  | 'narrative'
  | 'objection'
  | 'revision'
  | 'approval';

export interface WorkflowStepState {
  step: WorkflowStep;
  status: 'not_started' | 'active' | 'complete' | 'blocked';
  owner?: string;
  blockingReason?: string;
  artifacts?: string[];
  startedAt?: string;
  completedAt?: string;
}

export interface GatingRules {
  allowEdit: boolean;
  allowRedTeam: boolean;
  allowApproval: boolean;
  reason?: string;
}

export interface ValidationIssue {
  type: 'evidence_gap' | 'formula_error' | 'low_confidence' | 'deficiency';
  severity: 'warning' | 'blocking';
  nodeId?: string;
  description: string;
  remediation?: string;
}

export interface WorkflowPhase {
  state: WorkflowState;
  enteredAt: string;
  actor: string;
  actions: string[];
  blockingIssues?: ValidationIssue[];
}

export interface PhaseTransition {
  from: WorkflowState;
  to: WorkflowState;
  triggeredAt: string;
  reason: string;
  actor: string;
}

export interface ApprovalState {
  phase: 'idle' | 'validating' | 'ready' | 'submitting' | 'locked' | 'rejected';
  workflowSteps: WorkflowStepState[];
  blockingIssues: ValidationIssue[];
  defensibilityScore: number;
  approvalDrawerOpen: boolean;
}

export const INITIAL_WORKFLOW_STEPS: WorkflowStepState[] = [
  { step: 'hypothesis', status: 'active' },
  { step: 'model', status: 'not_started' },
  { step: 'evidence', status: 'not_started' },
  { step: 'narrative', status: 'not_started' },
  { step: 'objection', status: 'not_started' },
  { step: 'revision', status: 'not_started' },
  { step: 'approval', status: 'not_started' },
];
