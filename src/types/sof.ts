/**
 * Systemic Outcome Framework (SOF) Types
 * 
 * TypeScript types and Zod schemas for the SOF system.
 * Maintains backward compatibility with VOS types.
 */

import { z } from 'zod';

// ============================================================================
// ENUMS
// ============================================================================

export const SystemType = z.enum([
  'business_process',
  'customer_journey',
  'value_chain',
  'ecosystem',
  'organizational',
  'technical',
]);
export type SystemType = z.infer<typeof SystemType>;

export const InterventionType = z.enum([
  'leverage_point',
  'constraint_removal',
  'feedback_amplification',
  'feedback_dampening',
  'structure_change',
  'goal_alignment',
  'information_flow',
  'rule_change',
  'paradigm_shift',
]);
export type InterventionType = z.infer<typeof InterventionType>;

export const HypothesisType = z.enum([
  'direct_impact',
  'indirect_impact',
  'systemic_change',
  'behavior_change',
  'feedback_loop',
  'emergent_property',
]);
export type HypothesisType = z.infer<typeof HypothesisType>;

export const RiskType = z.enum([
  'unintended_consequence',
  'feedback_reversal',
  'constraint_violation',
  'boundary_breach',
  'cascade_failure',
  'goal_displacement',
  'metric_gaming',
  'system_degradation',
  'emergent_harm',
]);
export type RiskType = z.infer<typeof RiskType>;

export const LoopType = z.enum(['reinforcing', 'balancing', 'mixed']);
export type LoopType = z.infer<typeof LoopType>;

export const EffortEstimate = z.enum(['low', 'medium', 'high', 'very_high']);
export type EffortEstimate = z.infer<typeof EffortEstimate>;

export const TimeToImpact = z.enum(['immediate', 'short_term', 'medium_term', 'long_term']);
export type TimeToImpact = z.infer<typeof TimeToImpact>;

export const Likelihood = z.enum(['very_low', 'low', 'medium', 'high', 'very_high']);
export type Likelihood = z.infer<typeof Likelihood>;

export const Impact = z.enum(['negligible', 'minor', 'moderate', 'major', 'critical']);
export type Impact = z.infer<typeof Impact>;

export const EvidenceQuality = z.enum(['none', 'anecdotal', 'observational', 'experimental', 'proven']);
export type EvidenceQuality = z.infer<typeof EvidenceQuality>;

// ============================================================================
// SYSTEM MAP TYPES
// ============================================================================

export const SystemEntity = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  attributes: z.record(z.any()).optional(),
  position: z.object({ x: z.number(), y: z.number() }).optional(),
});
export type SystemEntity = z.infer<typeof SystemEntity>;

export const SystemRelationship = z.object({
  id: z.string().optional(),
  from: z.string(),
  to: z.string(),
  type: z.string(),
  strength: z.number().min(0).max(1).optional(),
  polarity: z.enum(['positive', 'negative', 'neutral']).optional(),
  description: z.string().optional(),
  delay: z.string().optional(),
});
export type SystemRelationship = z.infer<typeof SystemRelationship>;

export const SystemConstraint = z.object({
  id: z.string(),
  type: z.string(),
  description: z.string(),
  impact: z.string(),
  severity: z.enum(['low', 'medium', 'high']).optional(),
});
export type SystemConstraint = z.infer<typeof SystemConstraint>;

export const LeveragePoint = z.object({
  id: z.string(),
  location: z.string(),
  type: z.string(),
  potential_impact: z.number().min(1).max(10),
  effort: EffortEstimate,
  description: z.string().optional(),
  rationale: z.string().optional(),
});
export type LeveragePoint = z.infer<typeof LeveragePoint>;

export const SystemBoundary = z.object({
  included: z.array(z.string()),
  excluded: z.array(z.string()),
  assumptions: z.array(z.string()),
});
export type SystemBoundary = z.infer<typeof SystemBoundary>;

export const ExternalFactor = z.object({
  id: z.string(),
  name: z.string(),
  impact: z.string(),
  controllability: z.enum(['none', 'low', 'medium', 'high']),
});
export type ExternalFactor = z.infer<typeof ExternalFactor>;

export const SystemMapStatus = z.enum(['draft', 'validated', 'active', 'archived']);
export type SystemMapStatus = z.infer<typeof SystemMapStatus>;

export const SystemMap = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  business_case_id: z.string().uuid().nullable(),
  name: z.string().min(1),
  description: z.string().nullable(),
  system_type: SystemType,
  entities: z.array(SystemEntity),
  relationships: z.array(SystemRelationship),
  constraints: z.array(SystemConstraint),
  leverage_points: z.array(LeveragePoint),
  boundary_definition: SystemBoundary.nullable(),
  external_factors: z.array(ExternalFactor),
  status: SystemMapStatus,
  version: z.number().int().positive(),
  created_by: z.string().uuid(),
  validated_by: z.string().uuid().nullable(),
  validated_at: z.string().datetime().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type SystemMap = z.infer<typeof SystemMap>;

export const CreateSystemMapInput = SystemMap.omit({
  id: true,
  created_at: true,
  updated_at: true,
  validated_by: true,
  validated_at: true,
}).partial({
  version: true,
  status: true,
  entities: true,
  relationships: true,
  constraints: true,
  leverage_points: true,
  external_factors: true,
});
export type CreateSystemMapInput = z.infer<typeof CreateSystemMapInput>;

// ============================================================================
// INTERVENTION POINT TYPES
// ============================================================================

export const OutcomePathway = z.object({
  kpi_id: z.string().uuid(),
  expected_delta: z.number(),
  confidence: z.number().min(0).max(1),
  timeframe: z.string(),
  assumptions: z.array(z.string()).optional(),
});
export type OutcomePathway = z.infer<typeof OutcomePathway>;

export const InterventionDependency = z.object({
  intervention_id: z.string().uuid(),
  dependency_type: z.enum(['prerequisite', 'parallel', 'sequential', 'optional']),
});
export type InterventionDependency = z.infer<typeof InterventionDependency>;

export const InterventionRisk = z.object({
  risk_type: z.string(),
  description: z.string(),
  mitigation: z.string().optional(),
});
export type InterventionRisk = z.infer<typeof InterventionRisk>;

export const InterventionStatus = z.enum([
  'proposed',
  'validated',
  'approved',
  'implemented',
  'measured',
  'retired',
]);
export type InterventionStatus = z.infer<typeof InterventionStatus>;

export const InterventionPoint = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  system_map_id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().nullable(),
  intervention_type: InterventionType,
  target_entity_id: z.string().nullable(),
  target_relationship_id: z.string().nullable(),
  leverage_level: z.number().int().min(1).max(10),
  effort_estimate: EffortEstimate,
  time_to_impact: TimeToImpact,
  outcome_pathways: z.array(OutcomePathway),
  dependencies: z.array(InterventionDependency),
  risks: z.array(InterventionRisk),
  status: InterventionStatus,
  validation_notes: z.string().nullable(),
  created_by: z.string().uuid(),
  approved_by: z.string().uuid().nullable(),
  approved_at: z.string().datetime().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type InterventionPoint = z.infer<typeof InterventionPoint>;

export const CreateInterventionPointInput = InterventionPoint.omit({
  id: true,
  created_at: true,
  updated_at: true,
  approved_by: true,
  approved_at: true,
}).partial({
  status: true,
  outcome_pathways: true,
  dependencies: true,
  risks: true,
});
export type CreateInterventionPointInput = z.infer<typeof CreateInterventionPointInput>;

// ============================================================================
// OUTCOME HYPOTHESIS TYPES
// ============================================================================

export const KPIDelta = z.object({
  kpi_id: z.string().uuid(),
  baseline: z.number(),
  target: z.number(),
  timeframe: z.string(),
  confidence: z.number().min(0).max(1),
  measurement_method: z.string().optional(),
});
export type KPIDelta = z.infer<typeof KPIDelta>;

export const CausalChainStep = z.object({
  step: z.number().int().positive(),
  description: z.string(),
  evidence_type: z.string(),
  confidence: z.number().min(0).max(1),
});
export type CausalChainStep = z.infer<typeof CausalChainStep>;

export const HypothesisAssumption = z.object({
  assumption: z.string(),
  criticality: z.enum(['low', 'medium', 'high', 'critical']),
  validation_method: z.string(),
  validated: z.boolean().optional(),
});
export type HypothesisAssumption = z.infer<typeof HypothesisAssumption>;

export const OutcomeHypothesisStatus = z.enum([
  'draft',
  'proposed',
  'validated',
  'testing',
  'confirmed',
  'refuted',
  'retired',
]);
export type OutcomeHypothesisStatus = z.infer<typeof OutcomeHypothesisStatus>;

export const OutcomeHypothesis = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  system_map_id: z.string().uuid(),
  intervention_point_id: z.string().uuid().nullable(),
  hypothesis_statement: z.string().min(1),
  hypothesis_type: HypothesisType,
  system_change_description: z.string().min(1),
  kpi_deltas: z.array(KPIDelta),
  value_story: z.string().nullable(),
  causal_chain: z.array(CausalChainStep),
  assumptions: z.array(HypothesisAssumption),
  status: OutcomeHypothesisStatus,
  validation_method: z.string().nullable(),
  validation_criteria: z.record(z.any()).nullable(),
  validation_results: z.record(z.any()).nullable(),
  confidence_score: z.number().min(0).max(1).nullable(),
  evidence_quality: EvidenceQuality.nullable(),
  created_by: z.string().uuid(),
  validated_by: z.string().uuid().nullable(),
  validated_at: z.string().datetime().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type OutcomeHypothesis = z.infer<typeof OutcomeHypothesis>;

export const CreateOutcomeHypothesisInput = OutcomeHypothesis.omit({
  id: true,
  created_at: true,
  updated_at: true,
  validated_by: true,
  validated_at: true,
}).partial({
  status: true,
  kpi_deltas: true,
  causal_chain: true,
  assumptions: true,
});
export type CreateOutcomeHypothesisInput = z.infer<typeof CreateOutcomeHypothesisInput>;

// ============================================================================
// SYSTEMIC RISK TYPES
// ============================================================================

export const AffectedEntity = z.object({
  entity_id: z.string(),
  impact_description: z.string(),
});
export type AffectedEntity = z.infer<typeof AffectedEntity>;

export const TriggerCondition = z.object({
  condition: z.string(),
  threshold: z.string().optional(),
});
export type TriggerCondition = z.infer<typeof TriggerCondition>;

export const RiskIndicator = z.object({
  indicator: z.string(),
  measurement_method: z.string(),
  current_value: z.string().optional(),
});
export type RiskIndicator = z.infer<typeof RiskIndicator>;

export const MitigationAction = z.object({
  action: z.string(),
  owner: z.string().uuid().optional(),
  deadline: z.string().datetime().optional(),
  status: z.enum(['planned', 'in_progress', 'completed', 'cancelled']),
});
export type MitigationAction = z.infer<typeof MitigationAction>;

export const SystemicRiskStatus = z.enum([
  'identified',
  'assessed',
  'mitigated',
  'monitoring',
  'realized',
  'closed',
]);
export type SystemicRiskStatus = z.infer<typeof SystemicRiskStatus>;

export const SystemicRisk = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  system_map_id: z.string().uuid(),
  intervention_point_id: z.string().uuid().nullable(),
  risk_name: z.string().min(1),
  risk_description: z.string().min(1),
  risk_type: RiskType,
  likelihood: Likelihood,
  impact: Impact,
  risk_score: z.number().int().min(1).max(25),
  affected_entities: z.array(AffectedEntity),
  trigger_conditions: z.array(TriggerCondition),
  indicators: z.array(RiskIndicator),
  mitigation_strategy: z.string().nullable(),
  mitigation_actions: z.array(MitigationAction),
  contingency_plan: z.string().nullable(),
  status: SystemicRiskStatus,
  identified_by: z.string().uuid(),
  owner_id: z.string().uuid().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  realized_at: z.string().datetime().nullable(),
  closed_at: z.string().datetime().nullable(),
});
export type SystemicRisk = z.infer<typeof SystemicRisk>;

export const CreateSystemicRiskInput = SystemicRisk.omit({
  id: true,
  risk_score: true,
  created_at: true,
  updated_at: true,
  realized_at: true,
  closed_at: true,
}).partial({
  status: true,
  affected_entities: true,
  trigger_conditions: true,
  indicators: true,
  mitigation_actions: true,
});
export type CreateSystemicRiskInput = z.infer<typeof CreateSystemicRiskInput>;

// ============================================================================
// FEEDBACK LOOP TYPES
// ============================================================================

export const LoopElement = z.object({
  entity_id: z.string(),
  role: z.string(),
  position: z.number().int(),
});
export type LoopElement = z.infer<typeof LoopElement>;

export const LoopPathSegment = z.object({
  from: z.string(),
  to: z.string(),
  relationship_type: z.string(),
  polarity: z.enum(['positive', 'negative']),
});
export type LoopPathSegment = z.infer<typeof LoopPathSegment>;

export const DelayPoint = z.object({
  location: z.string(),
  delay_type: z.string(),
  duration: z.string(),
});
export type DelayPoint = z.infer<typeof DelayPoint>;

export const BehaviorChange = z.object({
  entity: z.string(),
  behavior_before: z.string(),
  behavior_after: z.string(),
  evidence: z.string(),
  timestamp: z.string().datetime().optional(),
});
export type BehaviorChange = z.infer<typeof BehaviorChange>;

export const SystemUpdate = z.object({
  update_type: z.string(),
  description: z.string(),
  timestamp: z.string().datetime(),
  impact: z.string(),
});
export type SystemUpdate = z.infer<typeof SystemUpdate>;

export const LoopMetric = z.object({
  metric: z.string(),
  baseline: z.number(),
  current: z.number(),
  target: z.number(),
  unit: z.string().optional(),
});
export type LoopMetric = z.infer<typeof LoopMetric>;

export const RealizationStage = z.enum(['designed', 'implementing', 'active', 'measured', 'optimized']);
export type RealizationStage = z.infer<typeof RealizationStage>;

export const ClosureStatus = z.enum(['open', 'partial', 'closed', 'broken']);
export type ClosureStatus = z.infer<typeof ClosureStatus>;

export const FeedbackLoop = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  system_map_id: z.string().uuid(),
  loop_name: z.string().min(1),
  loop_description: z.string().nullable(),
  loop_type: LoopType,
  loop_elements: z.array(LoopElement),
  loop_path: z.array(LoopPathSegment),
  delay_points: z.array(DelayPoint),
  dominant_polarity: z.enum(['positive', 'negative', 'neutral']).nullable(),
  loop_strength: z.enum(['weak', 'moderate', 'strong', 'dominant']).nullable(),
  time_constant: z.string().nullable(),
  realization_stage: RealizationStage.nullable(),
  behavior_changes: z.array(BehaviorChange),
  system_updates: z.array(SystemUpdate),
  loop_metrics: z.array(LoopMetric),
  closure_status: ClosureStatus.nullable(),
  closure_evidence: z.string().nullable(),
  created_by: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  activated_at: z.string().datetime().nullable(),
  closed_at: z.string().datetime().nullable(),
});
export type FeedbackLoop = z.infer<typeof FeedbackLoop>;

export const CreateFeedbackLoopInput = FeedbackLoop.omit({
  id: true,
  created_at: true,
  updated_at: true,
  activated_at: true,
  closed_at: true,
}).partial({
  loop_elements: true,
  loop_path: true,
  delay_points: true,
  behavior_changes: true,
  system_updates: true,
  loop_metrics: true,
});
export type CreateFeedbackLoopInput = z.infer<typeof CreateFeedbackLoopInput>;

// ============================================================================
// ACADEMY PROGRESS TYPES
// ============================================================================

export const AcademyStatus = z.enum(['not_started', 'in_progress', 'completed', 'mastered']);
export type AcademyStatus = z.infer<typeof AcademyStatus>;

export const LearningArtifact = z.object({
  type: z.string(),
  content: z.string(),
  created_at: z.string().datetime(),
});
export type LearningArtifact = z.infer<typeof LearningArtifact>;

export const LinkedSystemMap = z.object({
  system_map_id: z.string().uuid(),
  application_notes: z.string(),
});
export type LinkedSystemMap = z.infer<typeof LinkedSystemMap>;

export const LinkedIntervention = z.object({
  intervention_id: z.string().uuid(),
  application_notes: z.string(),
});
export type LinkedIntervention = z.infer<typeof LinkedIntervention>;

export const AcademyProgress = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  organization_id: z.string().uuid(),
  track_id: z.string(),
  track_name: z.string(),
  module_id: z.string(),
  module_name: z.string(),
  lesson_id: z.string().nullable(),
  status: AcademyStatus,
  progress_percentage: z.number().int().min(0).max(100),
  quiz_score: z.number().int().min(0).max(100).nullable(),
  practical_score: z.number().int().min(0).max(100).nullable(),
  mastery_level: z.number().int().min(0).max(5),
  notes: z.string().nullable(),
  artifacts: z.array(LearningArtifact),
  linked_system_maps: z.array(LinkedSystemMap),
  linked_interventions: z.array(LinkedIntervention),
  started_at: z.string().datetime().nullable(),
  completed_at: z.string().datetime().nullable(),
  last_accessed_at: z.string().datetime().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type AcademyProgress = z.infer<typeof AcademyProgress>;

export const CreateAcademyProgressInput = AcademyProgress.omit({
  id: true,
  created_at: true,
  updated_at: true,
}).partial({
  status: true,
  progress_percentage: true,
  mastery_level: true,
  artifacts: true,
  linked_system_maps: true,
  linked_interventions: true,
});
export type CreateAcademyProgressInput = z.infer<typeof CreateAcademyProgressInput>;

// ============================================================================
// COMPOSITE TYPES
// ============================================================================

export const SystemMapFull = z.object({
  system_map: SystemMap,
  intervention_points: z.array(InterventionPoint),
  outcome_hypotheses: z.array(OutcomeHypothesis),
  systemic_risks: z.array(SystemicRisk),
  feedback_loops: z.array(FeedbackLoop),
});
export type SystemMapFull = z.infer<typeof SystemMapFull>;

export const AcademyProgressSummary = z.object({
  total_modules: z.number().int(),
  completed_modules: z.number().int(),
  in_progress_modules: z.number().int(),
  average_mastery: z.number(),
  tracks: z.array(z.string()),
});
export type AcademyProgressSummary = z.infer<typeof AcademyProgressSummary>;

// ============================================================================
// AUDIT EVENT TYPES
// ============================================================================

export const SOFAuditEventType = z.enum([
  'SYSTEM_MAP_CREATED',
  'SYSTEM_MAP_UPDATED',
  'SYSTEM_MAP_VALIDATED',
  'INTERVENTION_POINT_SELECTED',
  'INTERVENTION_POINT_APPROVED',
  'OUTCOME_HYPOTHESIS_CREATED',
  'OUTCOME_HYPOTHESIS_VALIDATED',
  'SYSTEMIC_RISK_FLAGGED',
  'SYSTEMIC_RISK_MITIGATED',
  'FEEDBACK_LOOP_CREATED',
  'FEEDBACK_LOOP_ACTIVATED',
  'FEEDBACK_LOOP_CLOSED',
  'ACADEMY_MODULE_STARTED',
  'ACADEMY_MODULE_COMPLETED',
  'ACADEMY_MASTERY_ACHIEVED',
]);
export type SOFAuditEventType = z.infer<typeof SOFAuditEventType>;
