/**
 * Workflow Schemas - Zod validation schemas for workflow types
 */

import { z } from 'zod';

export const WorkflowStateSchema = z.enum([
  'INITIATED',
  'DRAFTING',
  'VALIDATING',
  'COMPOSING',
  'REFINING',
  'FINALIZED',
]);

export const WorkflowStepSchema = z.enum([
  'hypothesis',
  'model',
  'evidence',
  'narrative',
  'objection',
  'revision',
  'approval',
]);

export const WorkflowStepStateSchema = z.object({
  step: WorkflowStepSchema,
  status: z.enum(['not_started', 'active', 'complete', 'blocked']),
  owner: z.string().optional(),
  blockingReason: z.string().optional(),
  artifacts: z.array(z.string()).optional(),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
});

export const GatingRulesSchema = z.object({
  allowEdit: z.boolean(),
  allowRedTeam: z.boolean(),
  allowApproval: z.boolean(),
  reason: z.string().optional(),
});

export const SDUIGatingRulesSchema = z.object({
  allow_mutation: z.boolean(),
  allow_approval: z.boolean(),
  require_evidence: z.boolean(),
});

export const ValidationIssueSchema = z.object({
  type: z.enum(['evidence_gap', 'formula_error', 'low_confidence', 'deficiency']),
  severity: z.enum(['warning', 'blocking']),
  nodeId: z.string().optional(),
  description: z.string(),
  remediation: z.string().optional(),
});

export const WorkflowPhaseSchema = z.object({
  state: WorkflowStateSchema,
  enteredAt: z.string(),
  actor: z.string(),
  actions: z.array(z.string()),
  blockingIssues: z.array(ValidationIssueSchema).optional(),
});

export const PhaseTransitionSchema = z.object({
  from: WorkflowStateSchema,
  to: WorkflowStateSchema,
  triggeredAt: z.string(),
  reason: z.string(),
  actor: z.string(),
});

export const ApprovalStateSchema = z.object({
  phase: z.enum(['idle', 'validating', 'ready', 'submitting', 'locked', 'rejected']),
  workflowSteps: z.array(WorkflowStepStateSchema),
  blockingIssues: z.array(ValidationIssueSchema),
  defensibilityScore: z.number(),
  approvalDrawerOpen: z.boolean(),
});

export type WorkflowState = z.infer<typeof WorkflowStateSchema>;
export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;
export type WorkflowStepState = z.infer<typeof WorkflowStepStateSchema>;
export type GatingRules = z.infer<typeof GatingRulesSchema>;
export type SDUIGatingRules = z.infer<typeof SDUIGatingRulesSchema>;
export type ValidationIssue = z.infer<typeof ValidationIssueSchema>;
export type WorkflowPhase = z.infer<typeof WorkflowPhaseSchema>;
export type PhaseTransition = z.infer<typeof PhaseTransitionSchema>;
export type ApprovalState = z.infer<typeof ApprovalStateSchema>;
