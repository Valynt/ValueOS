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
// Discovery events (DiscoveryAgent streaming)
// ---------------------------------------------------------------------------

export const DiscoveryStartedPayloadSchema = DomainEventEnvelopeSchema.extend({
  runId: z.string().min(1),
  valueCaseId: z.string().min(1),
  companyName: z.string().min(1),
});
export type DiscoveryStartedPayload = z.infer<typeof DiscoveryStartedPayloadSchema>;

export const DiscoveryProgressPayloadSchema = DomainEventEnvelopeSchema.extend({
  runId: z.string().min(1),
  step: z.enum(['ingesting', 'generating_hypotheses', 'enriching', 'validating', 'writing_graph', 'finalizing']),
  message: z.string(),
  progressPercent: z.number().min(0).max(100),
  hypothesesFound: z.number().optional(),
  graphNodesWritten: z.number().optional(),
});
export type DiscoveryProgressPayload = z.infer<typeof DiscoveryProgressPayloadSchema>;

export const DiscoveryHypothesisAddedPayloadSchema = DomainEventEnvelopeSchema.extend({
  valueCaseId: z.string().min(1),
  hypothesisId: z.string().min(1),
  title: z.string(),
  category: z.string(),
  confidence: z.number().min(0).max(1),
});
export type DiscoveryHypothesisAddedPayload = z.infer<typeof DiscoveryHypothesisAddedPayloadSchema>;

export const DiscoveryGraphUpdatedPayloadSchema = DomainEventEnvelopeSchema.extend({
  opportunityId: z.string().min(1),
  nodeType: z.string(),
  nodeId: z.string().min(1),
  operation: z.enum(['upsert', 'delete']),
});
export type DiscoveryGraphUpdatedPayload = z.infer<typeof DiscoveryGraphUpdatedPayloadSchema>;

export const DiscoveryCompletedPayloadSchema = DomainEventEnvelopeSchema.extend({
  runId: z.string().min(1),
  valueCaseId: z.string().min(1),
  hypothesesFound: z.number(),
  graphNodesWritten: z.number(),
});
export type DiscoveryCompletedPayload = z.infer<typeof DiscoveryCompletedPayloadSchema>;

export const DiscoveryFailedPayloadSchema = DomainEventEnvelopeSchema.extend({
  runId: z.string().min(1),
  valueCaseId: z.string().min(1),
  error: z.string(),
});
export type DiscoveryFailedPayload = z.infer<typeof DiscoveryFailedPayloadSchema>;

export const DiscoveryCancelledPayloadSchema = DomainEventEnvelopeSchema.extend({
  runId: z.string().min(1),
  reason: z.string(),
});
export type DiscoveryCancelledPayload = z.infer<typeof DiscoveryCancelledPayloadSchema>;

export type DomainEventName =
  | 'opportunity.updated'
  | 'hypothesis.validated'
  | 'evidence.attached'
  | 'realization.milestone_reached'
  | 'narrative.drafted'
  | 'discovery.started'
  | 'discovery.progress'
  | 'discovery.hypothesis.added'
  | 'discovery.graph.updated'
  | 'discovery.completed'
  | 'discovery.failed'
  | 'discovery.cancelled';

export const NarrativeDraftedPayloadSchema = DomainEventEnvelopeSchema.extend({
  valueCaseId: z.string().optional(),
  defenseReadinessScore: z.number().min(0).max(1),
  format: z.string(),
});
export type NarrativeDraftedPayload = z.infer<typeof NarrativeDraftedPayloadSchema>;

export type DomainEventPayloadMap = {
  'opportunity.updated': OpportunityUpdatedPayload;
  'hypothesis.validated': HypothesisValidatedPayload;
  'evidence.attached': EvidenceAttachedPayload;
  'realization.milestone_reached': RealizationMilestoneReachedPayload;
  'narrative.drafted': NarrativeDraftedPayload;
  'discovery.started': DiscoveryStartedPayload;
  'discovery.progress': DiscoveryProgressPayload;
  'discovery.hypothesis.added': DiscoveryHypothesisAddedPayload;
  'discovery.graph.updated': DiscoveryGraphUpdatedPayload;
  'discovery.completed': DiscoveryCompletedPayload;
  'discovery.failed': DiscoveryFailedPayload;
  'discovery.cancelled': DiscoveryCancelledPayload;
};

export const domainEventSchemaRegistry: {
  [K in DomainEventName]: z.ZodSchema<DomainEventPayloadMap[K]>;
} = {
  'opportunity.updated': OpportunityUpdatedPayloadSchema,
  'hypothesis.validated': HypothesisValidatedPayloadSchema,
  'evidence.attached': EvidenceAttachedPayloadSchema,
  'realization.milestone_reached': RealizationMilestoneReachedPayloadSchema,
  'narrative.drafted': NarrativeDraftedPayloadSchema,
  'discovery.started': DiscoveryStartedPayloadSchema,
  'discovery.progress': DiscoveryProgressPayloadSchema,
  'discovery.hypothesis.added': DiscoveryHypothesisAddedPayloadSchema,
  'discovery.graph.updated': DiscoveryGraphUpdatedPayloadSchema,
  'discovery.completed': DiscoveryCompletedPayloadSchema,
  'discovery.failed': DiscoveryFailedPayloadSchema,
  'discovery.cancelled': DiscoveryCancelledPayloadSchema,
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
