import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — must be declared before imports
// ---------------------------------------------------------------------------

vi.mock('../../../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
}));

const mockBroadcastToTenant = vi.fn();
vi.mock('../../../services/realtime/RealtimeBroadcastService.js', () => ({
  getRealtimeBroadcastService: () => ({ broadcastToTenant: mockBroadcastToTenant }),
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import {
  _resetDomainEventBusForTests,
  DomainEventBus,
  getDomainEventBus,
} from '../../../events/DomainEventBus.js';
import type {
  EvidenceAttachedPayload,
  HypothesisValidatedPayload,
  OpportunityUpdatedPayload,
  RealizationMilestoneReachedPayload,
} from '../../../events/DomainEventSchemas.js';
import { DecisionRouter } from '../../decision-router/index.js';
import {
  _resetRecommendationEngineForTests,
  RecommendationEngine,
} from '../RecommendationEngine.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TENANT_ID = crypto.randomUUID();
const ORG_ID = TENANT_ID;

function envelope() {
  return {
    id: crypto.randomUUID(),
    emittedAt: new Date().toISOString(),
    traceId: 'trace-test',
    tenantId: TENANT_ID,
    actorId: 'user-001',
  };
}

function makeOpportunityUpdated(
  overrides: Partial<OpportunityUpdatedPayload> = {},
): OpportunityUpdatedPayload {
  return {
    ...envelope(),
    opportunityId: crypto.randomUUID(),
    workspaceId: 'ws-001',
    lifecycleStage: 'opportunity',
    hypothesisCount: 3,
    averageConfidence: 0.75,
    recommendedNextSteps: ['Run TargetAgent'],
    ...overrides,
  };
}

function makeHypothesisValidated(
  overrides: Partial<HypothesisValidatedPayload> = {},
): HypothesisValidatedPayload {
  return {
    ...envelope(),
    opportunityId: crypto.randomUUID(),
    workspaceId: 'ws-001',
    supportedClaimCount: 4,
    totalClaimCount: 5,
    integrityScore: 0.85,
    vetoed: false,
    reRefineRequested: false,
    ...overrides,
  };
}

function makeEvidenceAttached(
  overrides: Partial<EvidenceAttachedPayload> = {},
): EvidenceAttachedPayload {
  return {
    ...envelope(),
    opportunityId: crypto.randomUUID(),
    workspaceId: 'ws-001',
    hypothesisId: 'hyp-001',
    evidenceType: 'financial_data',
    source: 'MCP Ground Truth',
    confidenceDelta: 0.12,
    ...overrides,
  };
}

function makeMilestoneReached(
  overrides: Partial<RealizationMilestoneReachedPayload> = {},
): RealizationMilestoneReachedPayload {
  return {
    ...envelope(),
    opportunityId: crypto.randomUUID(),
    workspaceId: 'ws-001',
    kpiId: 'kpi-001',
    kpiName: 'Procurement Cost per Unit',
    committedValue: 100,
    realizedValue: 85,
    unit: 'usd',
    variancePercentage: -15,
    direction: 'under',
    overallRealizationRate: 0.85,
    expansionSignalCount: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RecommendationEngine', () => {
  let bus: DomainEventBus;
  let engine: RecommendationEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    _resetDomainEventBusForTests();
    _resetRecommendationEngineForTests();

    bus = getDomainEventBus();
    engine = new RecommendationEngine(new DecisionRouter());
    engine.start();
  });

  // -------------------------------------------------------------------------
  // opportunity.updated
  // -------------------------------------------------------------------------

  describe('opportunity.updated', () => {
    it('broadcasts a recommendation when the event fires', async () => {
      await bus.publish('opportunity.updated', makeOpportunityUpdated());

      expect(mockBroadcastToTenant).toHaveBeenCalledOnce();
      const [tenantId, messageType] = mockBroadcastToTenant.mock.calls[0];
      expect(tenantId).toBe(TENANT_ID);
      expect(messageType).toBe('recommendation.new');
    });

    it('recommendation carries the correct sourceEvent', async () => {
      await bus.publish('opportunity.updated', makeOpportunityUpdated());

      const rec = mockBroadcastToTenant.mock.calls[0][2];
      expect(rec.sourceEvent).toBe('opportunity.updated');
    });

    it('sets priority=high when averageConfidence >= 0.7', async () => {
      await bus.publish('opportunity.updated', makeOpportunityUpdated({ averageConfidence: 0.8 }));

      const rec = mockBroadcastToTenant.mock.calls[0][2];
      expect(rec.priority).toBe('high');
    });

    it('sets priority=medium when averageConfidence is 0.4–0.69', async () => {
      await bus.publish('opportunity.updated', makeOpportunityUpdated({ averageConfidence: 0.55 }));

      const rec = mockBroadcastToTenant.mock.calls[0][2];
      expect(rec.priority).toBe('medium');
    });

    it('sets priority=low when averageConfidence < 0.4', async () => {
      await bus.publish('opportunity.updated', makeOpportunityUpdated({ averageConfidence: 0.3 }));

      const rec = mockBroadcastToTenant.mock.calls[0][2];
      expect(rec.priority).toBe('low');
    });

    it('recommendation id is prefixed with rec-opp-', async () => {
      await bus.publish('opportunity.updated', makeOpportunityUpdated());

      const rec = mockBroadcastToTenant.mock.calls[0][2];
      expect(rec.id).toMatch(/^rec-opp-/);
    });
  });

  // -------------------------------------------------------------------------
  // hypothesis.validated
  // -------------------------------------------------------------------------

  describe('hypothesis.validated', () => {
    it('broadcasts a recommendation when the event fires', async () => {
      await bus.publish('hypothesis.validated', makeHypothesisValidated());

      expect(mockBroadcastToTenant).toHaveBeenCalledOnce();
    });

    it('sets priority=critical and nextAction=integrity when vetoed', async () => {
      await bus.publish(
        'hypothesis.validated',
        makeHypothesisValidated({ vetoed: true, reRefineRequested: false }),
      );

      const rec = mockBroadcastToTenant.mock.calls[0][2];
      expect(rec.priority).toBe('critical');
      expect(rec.nextAction).toBe('integrity');
    });

    it('sets priority=high and nextAction=opportunity when re-refine requested', async () => {
      await bus.publish(
        'hypothesis.validated',
        makeHypothesisValidated({ vetoed: false, reRefineRequested: true }),
      );

      const rec = mockBroadcastToTenant.mock.calls[0][2];
      expect(rec.priority).toBe('high');
      expect(rec.nextAction).toBe('opportunity');
    });

    it('sets priority=medium and nextAction=narrative when passed', async () => {
      await bus.publish(
        'hypothesis.validated',
        makeHypothesisValidated({ vetoed: false, reRefineRequested: false }),
      );

      const rec = mockBroadcastToTenant.mock.calls[0][2];
      expect(rec.priority).toBe('medium');
      expect(rec.nextAction).toBe('narrative');
    });
  });

  // -------------------------------------------------------------------------
  // evidence.attached
  // -------------------------------------------------------------------------

  describe('evidence.attached', () => {
    it('broadcasts a low-priority recommendation', async () => {
      await bus.publish('evidence.attached', makeEvidenceAttached());

      expect(mockBroadcastToTenant).toHaveBeenCalledOnce();
      const rec = mockBroadcastToTenant.mock.calls[0][2];
      expect(rec.priority).toBe('low');
      expect(rec.sourceEvent).toBe('evidence.attached');
    });

    it('includes the evidence type in the title', async () => {
      await bus.publish(
        'evidence.attached',
        makeEvidenceAttached({ evidenceType: 'benchmark' }),
      );

      const rec = mockBroadcastToTenant.mock.calls[0][2];
      expect(rec.title).toContain('benchmark');
    });
  });

  // -------------------------------------------------------------------------
  // realization.milestone_reached
  // -------------------------------------------------------------------------

  describe('realization.milestone_reached', () => {
    it('broadcasts a recommendation for an under-target KPI', async () => {
      await bus.publish('realization.milestone_reached', makeMilestoneReached({ direction: 'under' }));

      expect(mockBroadcastToTenant).toHaveBeenCalledOnce();
      const rec = mockBroadcastToTenant.mock.calls[0][2];
      expect(rec.nextAction).toBe('realization');
    });

    it('sets priority=critical when variance is worse than -20%', async () => {
      await bus.publish(
        'realization.milestone_reached',
        makeMilestoneReached({ direction: 'under', variancePercentage: -25 }),
      );

      const rec = mockBroadcastToTenant.mock.calls[0][2];
      expect(rec.priority).toBe('critical');
    });

    it('sets priority=high when variance is between -1% and -20%', async () => {
      await bus.publish(
        'realization.milestone_reached',
        makeMilestoneReached({ direction: 'under', variancePercentage: -10 }),
      );

      const rec = mockBroadcastToTenant.mock.calls[0][2];
      expect(rec.priority).toBe('high');
    });

    it('sets nextAction=expansion for an over-target KPI', async () => {
      await bus.publish(
        'realization.milestone_reached',
        makeMilestoneReached({
          direction: 'over',
          variancePercentage: 15,
          realizedValue: 115,
          expansionSignalCount: 2,
        }),
      );

      const rec = mockBroadcastToTenant.mock.calls[0][2];
      expect(rec.nextAction).toBe('expansion');
      expect(rec.priority).toBe('medium');
    });
  });

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  describe('start / stop', () => {
    it('start() is idempotent', async () => {
      engine.start(); // second call — should not double-subscribe
      await bus.publish('opportunity.updated', makeOpportunityUpdated());

      // Still only one broadcast despite two start() calls
      expect(mockBroadcastToTenant).toHaveBeenCalledOnce();
    });

    it('stop() prevents further broadcasts', async () => {
      engine.stop();
      await bus.publish('opportunity.updated', makeOpportunityUpdated());

      expect(mockBroadcastToTenant).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Broadcast failure isolation
  // -------------------------------------------------------------------------

  it('does not throw when the broadcast service fails', async () => {
    mockBroadcastToTenant.mockImplementationOnce(() => {
      throw new Error('WebSocket unavailable');
    });

    await expect(
      bus.publish('opportunity.updated', makeOpportunityUpdated()),
    ).resolves.toBeUndefined();
  });
});
