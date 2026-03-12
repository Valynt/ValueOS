/**
 * Domain Event Schemas
 *
 * Zod schemas for the four Sprint 8 domain events. Every event carries
 * a trace_id for cross-service correlation and a tenant_id for isolation.
 *
 * Event names follow the pattern: <aggregate>.<verb>
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Shared envelope fields (present on every domain event)
// ---------------------------------------------------------------------------

const DomainEventEnvelopeSchema = z.object({
  /** CloudEvents-compatible unique event ID */
  id: z.string().uuid(),
  /** ISO-8601 timestamp */
  emittedAt: z.string().datetime(),
  /** Propagated across async boundaries for distributed tracing */
  traceId: z.string().min(1),
  /** Tenant isolation — required on every event */
  tenantId: z.string().uuid(),
  /** The user or system actor that triggered the event */
  actorId: z.string().min(1),
});

// ---------------------------------------------------------------------------
// opportunity.updated
// ---------------------------------------------------------------------------

export const OpportunityUpdatedPayloadSchema = DomainEventEnvelopeSchema.extend({
  opportunityId: z.string().uuid(),
  workspaceId: z.string().min(1),
  /** Lifecycle stage at the time of the update */
  lifecycleStage: z.string().min(1),
  hypothesisCount: z.number().int().nonnegative(),
  /** Average confidence across all hypotheses (0–1) */
  averageConfidence: z.number().min(0).max(1),
  /** Snapshot of recommended next steps from the agent */
  recommendedNextSteps: z.array(z.string()),
});

export type OpportunityUpdatedPayload = z.infer<typeof OpportunityUpdatedPayloadSchema>;

// ---------------------------------------------------------------------------
// hypothesis.validated
// ---------------------------------------------------------------------------

export const HypothesisValidatedPayloadSchema = DomainEventEnvelopeSchema.extend({
  opportunityId: z.string().uuid(),
  workspaceId: z.string().min(1),
  /** Number of claims that passed integrity validation */
  supportedClaimCount: z.number().int().nonnegative(),
  totalClaimCount: z.number().int().positive(),
  /** Composite integrity score (0–1) */
  integrityScore: z.number().min(0).max(1),
  /** Whether the integrity agent issued a veto */
  vetoed: z.boolean(),
  /** Whether re-refinement was requested instead of a hard veto */
  reRefineRequested: z.boolean(),
});

export type HypothesisValidatedPayload = z.infer<typeof HypothesisValidatedPayloadSchema>;

// ---------------------------------------------------------------------------
// evidence.attached
// ---------------------------------------------------------------------------

export const EvidenceAttachedPayloadSchema = DomainEventEnvelopeSchema.extend({
  opportunityId: z.string().uuid(),
  workspaceId: z.string().min(1),
  hypothesisId: z.string().min(1),
  evidenceType: z.enum(['financial_data', 'benchmark', 'customer_data', 'analyst_report', 'internal_metric']),
  /** Source system or URL that provided the evidence */
  source: z.string().min(1),
  /** Confidence contribution of this evidence piece (0–1) */
  confidenceDelta: z.number().min(0).max(1),
});

export type EvidenceAttachedPayload = z.infer<typeof EvidenceAttachedPayloadSchema>;

// ---------------------------------------------------------------------------
// realization.milestone_reached
// ---------------------------------------------------------------------------

export const RealizationMilestoneReachedPayloadSchema = DomainEventEnvelopeSchema.extend({
  opportunityId: z.string().uuid(),
  workspaceId: z.string().min(1),
  kpiId: z.string().min(1),
  kpiName: z.string().min(1),
  /** Committed target value */
  committedValue: z.number(),
  /** Actual realized value */
  realizedValue: z.number(),
  unit: z.string().min(1),
  /** Percentage variance from committed (positive = over-delivered) */
  variancePercentage: z.number(),
  direction: z.enum(['over', 'under', 'on_target']),
  /** Overall realization rate across all KPIs (0–2, where 1.0 = 100%) */
  overallRealizationRate: z.number().min(0).max(2),
  /** Expansion signals detected by RealizationAgent */
  expansionSignalCount: z.number().int().nonnegative(),
});

export type RealizationMilestoneReachedPayload = z.infer<typeof RealizationMilestoneReachedPayloadSchema>;

// ---------------------------------------------------------------------------
// Union type and registry
// ---------------------------------------------------------------------------

export type DomainEventName =
  | 'opportunity.updated'
  | 'hypothesis.validated'
  | 'evidence.attached'
  | 'realization.milestone_reached'
  | 'narrative.drafted';

const NarrativeDraftedNormalizedPayloadSchema = DomainEventEnvelopeSchema.extend({
  valueCaseId: z.string().min(1).optional(),
  defenseReadinessScore: z.number().min(0).max(1),
  format: z.string().min(1),
});

export const NarrativeDraftedPayloadSchema = z.preprocess((payload) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return payload;
  }

  const rawPayload = payload as Record<string, unknown>;

  return {
    ...rawPayload,
    // Backward compatibility: old publisher used organization_id instead of tenantId.
    tenantId: rawPayload['tenantId'] ?? rawPayload['organization_id'],
    // Backward compatibility: old publisher used snake_case field names.
    valueCaseId: rawPayload['valueCaseId'] ?? rawPayload['value_case_id'],
    defenseReadinessScore:
      rawPayload['defenseReadinessScore'] ?? rawPayload['defense_readiness_score'],
  };
}, NarrativeDraftedNormalizedPayloadSchema);
export type NarrativeDraftedPayload = z.infer<typeof NarrativeDraftedPayloadSchema>;

export type DomainEventPayloadMap = {
  'opportunity.updated': OpportunityUpdatedPayload;
  'hypothesis.validated': HypothesisValidatedPayload;
  'evidence.attached': EvidenceAttachedPayload;
  'realization.milestone_reached': RealizationMilestoneReachedPayload;
  'narrative.drafted': NarrativeDraftedPayload;
};

export const domainEventSchemaRegistry: {
  [K in DomainEventName]: z.ZodSchema<DomainEventPayloadMap[K]>;
} = {
  'opportunity.updated': OpportunityUpdatedPayloadSchema,
  'hypothesis.validated': HypothesisValidatedPayloadSchema,
  'evidence.attached': EvidenceAttachedPayloadSchema,
  'realization.milestone_reached': RealizationMilestoneReachedPayloadSchema,
  'narrative.drafted': NarrativeDraftedPayloadSchema,
};

export function validateDomainEvent<TName extends DomainEventName>(
  name: TName,
  payload: unknown,
): DomainEventPayloadMap[TName] {
  const schema = domainEventSchemaRegistry[name];
  const result = schema.safeParse(payload);
  if (!result.success) {
    throw new Error(`Invalid payload for domain event "${name}": ${result.error.message}`);
  }
  return result.data as DomainEventPayloadMap[TName];
}
