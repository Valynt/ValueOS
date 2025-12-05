/**
 * SOF Governance and Audit Types
 * 
 * TypeScript types for SOF governance controls and audit events.
 */

import { z } from 'zod';

// ============================================================================
// Governance Control Types
// ============================================================================

export const GovernanceControlTypeSchema = z.enum([
  'access_control',
  'data_privacy',
  'ethical_review',
  'risk_mitigation',
  'compliance_check',
  'approval_gate',
  'monitoring_requirement',
  'documentation_requirement',
]);

export type GovernanceControlType = z.infer<typeof GovernanceControlTypeSchema>;

export const EnforcementLevelSchema = z.enum([
  'advisory',   // Recommendation only
  'warning',    // Warning but allows proceed
  'blocking',   // Must be satisfied to proceed
]);

export type EnforcementLevel = z.infer<typeof EnforcementLevelSchema>;

export const ComplianceStatusSchema = z.enum([
  'pending',
  'compliant',
  'at_risk',
  'non_compliant',
  'waived',
]);

export type ComplianceStatus = z.infer<typeof ComplianceStatusSchema>;

export const ApprovalStatusSchema = z.enum([
  'pending',
  'approved',
  'rejected',
  'waived',
]);

export type ApprovalStatus = z.infer<typeof ApprovalStatusSchema>;

export const SOFGovernanceControlSchema = z.object({
  id: z.string().uuid(),
  business_case_id: z.string().uuid(),
  system_map_id: z.string().uuid(),
  intervention_point_id: z.string().uuid().nullable(),
  
  control_type: GovernanceControlTypeSchema,
  control_name: z.string(),
  control_description: z.string().nullable(),
  
  enforcement_level: EnforcementLevelSchema,
  
  compliance_status: ComplianceStatusSchema,
  compliance_evidence: z.array(z.any()).default([]),
  last_reviewed_at: z.string().datetime().nullable(),
  next_review_due: z.string().datetime().nullable(),
  
  requires_approval: z.boolean().default(false),
  approval_status: ApprovalStatusSchema.nullable(),
  approved_by: z.string().uuid().nullable(),
  approved_at: z.string().datetime().nullable(),
  approval_notes: z.string().nullable(),
  
  metadata: z.record(z.any()).default({}),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  created_by: z.string().uuid().nullable(),
});

export type SOFGovernanceControl = z.infer<typeof SOFGovernanceControlSchema>;

export const CreateGovernanceControlSchema = SOFGovernanceControlSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
}).partial({
  compliance_status: true,
  enforcement_level: true,
  compliance_evidence: true,
  metadata: true,
});

export type CreateGovernanceControl = z.infer<typeof CreateGovernanceControlSchema>;

// ============================================================================
// Audit Event Types
// ============================================================================

export const SOFAuditEventTypeSchema = z.enum([
  'system_map_created',
  'system_map_updated',
  'entity_added',
  'entity_modified',
  'relationship_added',
  'relationship_modified',
  'intervention_designed',
  'intervention_modified',
  'outcome_hypothesis_created',
  'outcome_hypothesis_validated',
  'feedback_loop_created',
  'feedback_loop_closed',
  'behavior_change_observed',
  'system_update_logged',
  'governance_control_applied',
  'compliance_status_changed',
]);

export type SOFAuditEventType = z.infer<typeof SOFAuditEventTypeSchema>;

export const ActorTypeSchema = z.enum(['user', 'agent', 'system']);

export type ActorType = z.infer<typeof ActorTypeSchema>;

export const SOFAuditEventSchema = z.object({
  id: z.string().uuid(),
  business_case_id: z.string().uuid(),
  
  system_map_id: z.string().uuid().nullable(),
  entity_id: z.string().uuid().nullable(),
  relationship_id: z.string().uuid().nullable(),
  intervention_point_id: z.string().uuid().nullable(),
  outcome_hypothesis_id: z.string().uuid().nullable(),
  feedback_loop_id: z.string().uuid().nullable(),
  
  event_type: SOFAuditEventTypeSchema,
  event_description: z.string().nullable(),
  
  previous_state: z.record(z.any()).nullable(),
  new_state: z.record(z.any()).nullable(),
  change_summary: z.string().nullable(),
  
  actor_type: ActorTypeSchema.nullable(),
  actor_id: z.string().uuid().nullable(),
  agent_name: z.string().nullable(),
  
  reasoning_trace: z.string().nullable(),
  input_data: z.record(z.any()).default({}),
  
  metadata: z.record(z.any()).default({}),
  created_at: z.string().datetime(),
});

export type SOFAuditEvent = z.infer<typeof SOFAuditEventSchema>;

export const CreateAuditEventSchema = SOFAuditEventSchema.omit({
  id: true,
  created_at: true,
}).partial({
  system_map_id: true,
  entity_id: true,
  relationship_id: true,
  intervention_point_id: true,
  outcome_hypothesis_id: true,
  feedback_loop_id: true,
  event_description: true,
  previous_state: true,
  new_state: true,
  change_summary: true,
  actor_type: true,
  actor_id: true,
  agent_name: true,
  reasoning_trace: true,
  input_data: true,
  metadata: true,
});

export type CreateAuditEvent = z.infer<typeof CreateAuditEventSchema>;

// ============================================================================
// Lifecycle Artifact Link Types (Extended)
// ============================================================================

export const LifecycleStageSchema = z.enum([
  'opportunity',
  'target',
  'realization',
  'expansion',
  'integrity',
]);

export type LifecycleStage = z.infer<typeof LifecycleStageSchema>;

export const LifecycleArtifactLinkSchema = z.object({
  id: z.string().uuid(),
  session_id: z.string().uuid().nullable(),
  
  source_stage: LifecycleStageSchema,
  source_type: z.string(),
  source_artifact_id: z.string().uuid(),
  
  target_stage: LifecycleStageSchema,
  target_type: z.string(),
  target_artifact_id: z.string().uuid(),
  
  relationship_type: z.string().default('derived_from'),
  reasoning_trace: z.string().nullable(),
  chain_depth: z.number().int().default(0),
  
  metadata: z.record(z.any()).default({}),
  created_at: z.string().datetime(),
  created_by: z.string().uuid().nullable(),
});

export type LifecycleArtifactLink = z.infer<typeof LifecycleArtifactLinkSchema>;

export const CreateLifecycleArtifactLinkSchema = LifecycleArtifactLinkSchema.omit({
  id: true,
  created_at: true,
}).partial({
  session_id: true,
  relationship_type: true,
  reasoning_trace: true,
  chain_depth: true,
  metadata: true,
  created_by: true,
});

export type CreateLifecycleArtifactLink = z.infer<typeof CreateLifecycleArtifactLinkSchema>;

// ============================================================================
// Governance Compliance Check Result
// ============================================================================

export const GovernanceComplianceResultSchema = z.object({
  is_compliant: z.boolean(),
  blocking_controls: z.number().int(),
  at_risk_controls: z.number().int(),
  non_compliant_controls: z.number().int(),
  details: z.array(z.object({
    control_name: z.string(),
    control_type: GovernanceControlTypeSchema,
    compliance_status: ComplianceStatusSchema,
    enforcement_level: EnforcementLevelSchema,
  })).nullable(),
});

export type GovernanceComplianceResult = z.infer<typeof GovernanceComplianceResultSchema>;

// ============================================================================
// Audit Trail Entry
// ============================================================================

export const AuditTrailEntrySchema = z.object({
  event_id: z.string().uuid(),
  event_type: SOFAuditEventTypeSchema,
  event_description: z.string().nullable(),
  actor_type: ActorTypeSchema.nullable(),
  change_summary: z.string().nullable(),
  created_at: z.string().datetime(),
});

export type AuditTrailEntry = z.infer<typeof AuditTrailEntrySchema>;
