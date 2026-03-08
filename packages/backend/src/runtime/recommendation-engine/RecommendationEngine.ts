/**
 * RecommendationEngine
 *
 * Subscribes to domain events and produces next-best-action recommendations
 * that are pushed to connected UI clients via the RealtimeBroadcastService.
 *
 * Sprint 8 scope: handles `opportunity.updated` by re-evaluating routing
 * via DecisionRouter and broadcasting the result. Additional event handlers
 * follow the same pattern.
 *
 * Tenant isolation: every recommendation is scoped to the tenantId carried
 * in the domain event envelope. Broadcasts are delivered only to WebSocket
 * clients authenticated for that tenant.
 */

import { logger } from '../../utils/logger.js';
import { getDomainEventBus } from '../../events/DomainEventBus.js';
import type {
  DomainEventName,
  EvidenceAttachedPayload,
  HypothesisValidatedPayload,
  OpportunityUpdatedPayload,
  RealizationMilestoneReachedPayload,
} from '../../events/DomainEventSchemas.js';
import { DecisionRouter } from '../decision-router/index.js';
import { getRealtimeBroadcastService } from '../../services/RealtimeBroadcastService.js';

// ---------------------------------------------------------------------------
// Recommendation shape pushed to the UI
// ---------------------------------------------------------------------------

export interface Recommendation {
  /** Unique ID for deduplication on the client */
  id: string;
  /** ISO-8601 timestamp */
  generatedAt: string;
  /** The domain event that triggered this recommendation */
  sourceEvent: DomainEventName;
  /** Tenant this recommendation belongs to */
  tenantId: string;
  /** Workspace / session context */
  workspaceId: string;
  /** Human-readable title */
  title: string;
  /** Detailed guidance */
  description: string;
  /** Suggested agent or action to invoke next */
  nextAction: string;
  /** Confidence in the recommendation (0–1) */
  confidence: number;
  /** Priority for UI ordering */
  priority: 'low' | 'medium' | 'high' | 'critical';
}

// ---------------------------------------------------------------------------
// RecommendationEngine
// ---------------------------------------------------------------------------

export class RecommendationEngine {
  private readonly router: DecisionRouter;
  private readonly unsubscribeFns: Array<() => void> = [];
  private started = false;

  constructor(router?: DecisionRouter) {
    this.router = router ?? new DecisionRouter();
  }

  /**
   * Attach all domain event subscriptions. Idempotent — calling start()
   * more than once is a no-op.
   */
  start(): void {
    if (this.started) return;
    this.started = true;

    const bus = getDomainEventBus();

    this.unsubscribeFns.push(
      bus.subscribe('opportunity.updated', (p) => this.onOpportunityUpdated(p)),
      bus.subscribe('hypothesis.validated', (p) => this.onHypothesisValidated(p)),
      bus.subscribe('evidence.attached', (p) => this.onEvidenceAttached(p)),
      bus.subscribe('realization.milestone_reached', (p) => this.onMilestoneReached(p)),
    );

    logger.info('RecommendationEngine started', { subscriptions: 4 });
  }

  /** Detach all subscriptions. */
  stop(): void {
    for (const unsub of this.unsubscribeFns) unsub();
    this.unsubscribeFns.length = 0;
    this.started = false;
    logger.info('RecommendationEngine stopped');
  }

  // ---------------------------------------------------------------------------
  // Event handlers
  // ---------------------------------------------------------------------------

  /**
   * When an opportunity is updated, re-evaluate the next-best-action via
   * DecisionRouter and push the result to the UI.
   */
  private async onOpportunityUpdated(payload: OpportunityUpdatedPayload): Promise<void> {
    logger.info('RecommendationEngine: opportunity.updated received', {
      opportunityId: payload.opportunityId,
      tenantId: payload.tenantId,
      traceId: payload.traceId,
    });

    const nextAgent = this.router.selectAgentForQuery('opportunity value hypothesis', {
      currentStage: payload.lifecycleStage,
    });

    const confidence = payload.averageConfidence;
    const priority = confidence >= 0.7 ? 'high' : confidence >= 0.4 ? 'medium' : 'low';

    const recommendation: Recommendation = {
      id: `rec-opp-${payload.id}`,
      generatedAt: new Date().toISOString(),
      sourceEvent: 'opportunity.updated',
      tenantId: payload.tenantId,
      workspaceId: payload.workspaceId,
      title: 'Opportunity analysis complete — review hypotheses',
      description:
        `${payload.hypothesisCount} value hypotheses generated with an average confidence of ` +
        `${(confidence * 100).toFixed(0)}%. ` +
        (payload.recommendedNextSteps.length > 0
          ? `Suggested next steps: ${payload.recommendedNextSteps.slice(0, 2).join('; ')}.`
          : ''),
      nextAction: nextAgent,
      confidence,
      priority: priority as Recommendation['priority'],
    };

    this.broadcast(payload.tenantId, recommendation);
  }

  /**
   * When hypotheses are validated, recommend whether to proceed, re-refine,
   * or escalate based on the integrity outcome.
   */
  private async onHypothesisValidated(payload: HypothesisValidatedPayload): Promise<void> {
    logger.info('RecommendationEngine: hypothesis.validated received', {
      opportunityId: payload.opportunityId,
      tenantId: payload.tenantId,
      vetoed: payload.vetoed,
    });

    let title: string;
    let description: string;
    let nextAction: string;
    let priority: Recommendation['priority'];

    if (payload.vetoed) {
      title = 'Integrity veto — address data quality issues';
      description =
        `${payload.totalClaimCount - payload.supportedClaimCount} of ${payload.totalClaimCount} claims failed validation ` +
        `(integrity score: ${(payload.integrityScore * 100).toFixed(0)}%). ` +
        'Correct the flagged claims before proceeding.';
      nextAction = 'integrity';
      priority = 'critical';
    } else if (payload.reRefineRequested) {
      title = 'Re-refinement requested — strengthen evidence';
      description =
        `${payload.supportedClaimCount} of ${payload.totalClaimCount} claims supported. ` +
        'Some claims need stronger evidence before the business case can be composed.';
      nextAction = 'opportunity';
      priority = 'high';
    } else {
      title = 'Validation passed — ready for business case composition';
      description =
        `All ${payload.supportedClaimCount} claims validated with an integrity score of ` +
        `${(payload.integrityScore * 100).toFixed(0)}%.`;
      nextAction = 'narrative';
      priority = 'medium';
    }

    const recommendation: Recommendation = {
      id: `rec-hyp-${payload.id}`,
      generatedAt: new Date().toISOString(),
      sourceEvent: 'hypothesis.validated',
      tenantId: payload.tenantId,
      workspaceId: payload.workspaceId,
      title,
      description,
      nextAction,
      confidence: payload.integrityScore,
      priority,
    };

    this.broadcast(payload.tenantId, recommendation);
  }

  /**
   * When evidence is attached, surface a low-priority confirmation so the
   * user knows grounding data has been incorporated.
   */
  private async onEvidenceAttached(payload: EvidenceAttachedPayload): Promise<void> {
    logger.info('RecommendationEngine: evidence.attached received', {
      opportunityId: payload.opportunityId,
      tenantId: payload.tenantId,
      evidenceType: payload.evidenceType,
    });

    const recommendation: Recommendation = {
      id: `rec-ev-${payload.id}`,
      generatedAt: new Date().toISOString(),
      sourceEvent: 'evidence.attached',
      tenantId: payload.tenantId,
      workspaceId: payload.workspaceId,
      title: `Evidence attached — ${payload.evidenceType.replace(/_/g, ' ')}`,
      description:
        `New ${payload.evidenceType.replace(/_/g, ' ')} evidence from "${payload.source}" ` +
        `attached to hypothesis "${payload.hypothesisId}". ` +
        `Confidence contribution: +${(payload.confidenceDelta * 100).toFixed(0)}%.`,
      nextAction: 'opportunity',
      confidence: payload.confidenceDelta,
      priority: 'low',
    };

    this.broadcast(payload.tenantId, recommendation);
  }

  /**
   * When a realization milestone is reached, recommend expansion or
   * intervention based on the KPI direction.
   */
  private async onMilestoneReached(payload: RealizationMilestoneReachedPayload): Promise<void> {
    logger.info('RecommendationEngine: realization.milestone_reached received', {
      opportunityId: payload.opportunityId,
      tenantId: payload.tenantId,
      kpiId: payload.kpiId,
      direction: payload.direction,
    });

    const isOver = payload.direction === 'over';
    const isUnder = payload.direction === 'under';

    const title = isOver
      ? `KPI exceeded — expansion opportunity detected`
      : isUnder
        ? `KPI under target — intervention recommended`
        : `KPI on target`;

    const description = isOver
      ? `"${payload.kpiName}" delivered ${payload.realizedValue} ${payload.unit} against a commitment of ` +
        `${payload.committedValue} ${payload.unit} (+${payload.variancePercentage.toFixed(1)}%). ` +
        `${payload.expansionSignalCount} expansion signal(s) detected.`
      : isUnder
        ? `"${payload.kpiName}" delivered ${payload.realizedValue} ${payload.unit} against a commitment of ` +
          `${payload.committedValue} ${payload.unit} (${payload.variancePercentage.toFixed(1)}%). ` +
          'Review assumptions and consider reallocating resources.'
        : `"${payload.kpiName}" is on target at ${payload.realizedValue} ${payload.unit}.`;

    const nextAction = isOver ? 'expansion' : isUnder ? 'realization' : 'realization';
    const priority: Recommendation['priority'] = isUnder
      ? payload.variancePercentage < -20 ? 'critical' : 'high'
      : isOver
        ? 'medium'
        : 'low';

    const recommendation: Recommendation = {
      id: `rec-ms-${payload.id}`,
      generatedAt: new Date().toISOString(),
      sourceEvent: 'realization.milestone_reached',
      tenantId: payload.tenantId,
      workspaceId: payload.workspaceId,
      title,
      description,
      nextAction,
      confidence: payload.overallRealizationRate > 1 ? 1 : payload.overallRealizationRate,
      priority,
    };

    this.broadcast(payload.tenantId, recommendation);
  }

  // ---------------------------------------------------------------------------
  // Broadcast helper
  // ---------------------------------------------------------------------------

  private broadcast(tenantId: string, recommendation: Recommendation): void {
    try {
      getRealtimeBroadcastService().broadcastToTenant(
        tenantId,
        'recommendation.new',
        recommendation,
      );

      logger.info('RecommendationEngine: recommendation broadcast', {
        id: recommendation.id,
        tenantId,
        sourceEvent: recommendation.sourceEvent,
        priority: recommendation.priority,
      });
    } catch (err) {
      logger.error(
        'RecommendationEngine: broadcast failed',
        err instanceof Error ? err : undefined,
        { tenantId, recommendationId: recommendation.id },
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let instance: RecommendationEngine | null = null;

export function getRecommendationEngine(router?: DecisionRouter): RecommendationEngine {
  if (!instance) {
    instance = new RecommendationEngine(router);
  }
  return instance;
}

/** Reset singleton — for tests only. */
export function _resetRecommendationEngineForTests(): void {
  instance?.stop();
  instance = null;
}
