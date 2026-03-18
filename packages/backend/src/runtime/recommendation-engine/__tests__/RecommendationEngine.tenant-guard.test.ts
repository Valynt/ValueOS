import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — must be declared before imports
// ---------------------------------------------------------------------------

vi.mock('../../../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const mockBroadcastToTenant = vi.fn();
// Mock path must match the import path used in RecommendationEngine.ts exactly
vi.mock('../../services/RealtimeBroadcastService.js', () => ({
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
import { logger } from '../../../utils/logger.js';
import { DecisionRouter } from '../../decision-router/index.js';
import {
  _resetRecommendationEngineForTests,
  RecommendationEngine,
} from '../RecommendationEngine.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TENANT_ID = crypto.randomUUID();

function envelope(tenantId = TENANT_ID) {
  return {
    id: crypto.randomUUID(),
    emittedAt: new Date().toISOString(),
    traceId: 'trace-guard-test',
    tenantId,
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
    hypothesisCount: 2,
    averageConfidence: 0.75,
    recommendedNextSteps: [],
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
    supportedClaimCount: 3,
    totalClaimCount: 4,
    integrityScore: 0.8,
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
    confidenceDelta: 0.1,
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
    kpiName: 'Cost per Unit',
    committedValue: 100,
    realizedValue: 90,
    unit: 'usd',
    variancePercentage: -10,
    direction: 'under',
    overallRealizationRate: 0.9,
    expansionSignalCount: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RecommendationEngine — tenantId guard', () => {
  let bus: DomainEventBus;

  beforeEach(() => {
    vi.clearAllMocks();
    _resetDomainEventBusForTests();
    _resetRecommendationEngineForTests();

    bus = getDomainEventBus();
    const engine = new RecommendationEngine(new DecisionRouter());
    engine.start();
  });

  // -------------------------------------------------------------------------
  // opportunity.updated
  // -------------------------------------------------------------------------

  describe('opportunity.updated', () => {
    it('does not broadcast when tenantId is missing', async () => {
      // DomainEventBus validates via Zod — tenantId is required (uuid).
      // Publishing with an empty string should throw at the schema level.
      await expect(
        bus.publish('opportunity.updated', makeOpportunityUpdated({ tenantId: '' })),
      ).rejects.toThrow();

      expect(mockBroadcastToTenant).not.toHaveBeenCalled();
    });

    it('logs an error and does not broadcast when handler receives empty tenantId', async () => {
      // Zod rejects empty tenantId at the bus level, so we bypass the bus and
      // call the handler directly. We capture it via a spy on bus.subscribe so
      // the engine's real subscription path is still exercised.
      // DomainEventBus.subscribe signature: (name, handler) — two args.
      type SubscribeArgs = Parameters<typeof bus.subscribe>;
      const rawHandlers: Array<SubscribeArgs[1]> = [];
      const origSubscribe = bus.subscribe.bind(bus);
      vi.spyOn(bus, 'subscribe').mockImplementation((...args: SubscribeArgs) => {
        const [name, handler] = args;
        if (name === 'opportunity.updated') {
          rawHandlers.push(handler);
        }
        return origSubscribe(...args);
      });

      // Re-start engine so it picks up the spy
      _resetRecommendationEngineForTests();
      const engine = new RecommendationEngine(new DecisionRouter());
      engine.start();

      // Fail loudly if the engine stopped subscribing to this event
      expect(rawHandlers.length).toBeGreaterThan(0);

      // Call the captured handler directly with a payload missing tenantId
      for (const h of rawHandlers) {
        await h({ ...makeOpportunityUpdated(), tenantId: '' });
      }

      expect(mockBroadcastToTenant).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        'RecommendationEngine: event missing tenantId',
        expect.objectContaining({ sourceEvent: 'opportunity.updated' }),
      );
    });

    it('broadcasts to the correct tenant and not to others', async () => {
      const TENANT_X = crypto.randomUUID();
      const TENANT_Y = crypto.randomUUID();

      await bus.publish('opportunity.updated', makeOpportunityUpdated({ tenantId: TENANT_X }));
      await bus.publish('opportunity.updated', makeOpportunityUpdated({ tenantId: TENANT_Y }));

      expect(mockBroadcastToTenant).toHaveBeenCalledTimes(2);
      const calledTenants = mockBroadcastToTenant.mock.calls.map((c) => c[0]);
      expect(calledTenants).toContain(TENANT_X);
      expect(calledTenants).toContain(TENANT_Y);
      // Each broadcast targets exactly its own tenant
      expect(mockBroadcastToTenant.mock.calls[0][0]).toBe(TENANT_X);
      expect(mockBroadcastToTenant.mock.calls[1][0]).toBe(TENANT_Y);
    });
  });

  // -------------------------------------------------------------------------
  // hypothesis.validated
  // -------------------------------------------------------------------------

  describe('hypothesis.validated', () => {
    it('does not broadcast when tenantId is missing', async () => {
      await expect(
        bus.publish('hypothesis.validated', makeHypothesisValidated({ tenantId: '' })),
      ).rejects.toThrow();

      expect(mockBroadcastToTenant).not.toHaveBeenCalled();
    });

    it('broadcasts to the correct tenant', async () => {
      const TENANT_X = crypto.randomUUID();
      await bus.publish('hypothesis.validated', makeHypothesisValidated({ tenantId: TENANT_X }));

      expect(mockBroadcastToTenant).toHaveBeenCalledOnce();
      expect(mockBroadcastToTenant.mock.calls[0][0]).toBe(TENANT_X);
    });
  });

  // -------------------------------------------------------------------------
  // evidence.attached
  // -------------------------------------------------------------------------

  describe('evidence.attached', () => {
    it('does not broadcast when tenantId is missing', async () => {
      await expect(
        bus.publish('evidence.attached', makeEvidenceAttached({ tenantId: '' })),
      ).rejects.toThrow();

      expect(mockBroadcastToTenant).not.toHaveBeenCalled();
    });

    it('broadcasts to the correct tenant', async () => {
      const TENANT_X = crypto.randomUUID();
      await bus.publish('evidence.attached', makeEvidenceAttached({ tenantId: TENANT_X }));

      expect(mockBroadcastToTenant).toHaveBeenCalledOnce();
      expect(mockBroadcastToTenant.mock.calls[0][0]).toBe(TENANT_X);
    });
  });

  // -------------------------------------------------------------------------
  // realization.milestone_reached
  // -------------------------------------------------------------------------

  describe('realization.milestone_reached', () => {
    it('does not broadcast when tenantId is missing', async () => {
      await expect(
        bus.publish('realization.milestone_reached', makeMilestoneReached({ tenantId: '' })),
      ).rejects.toThrow();

      expect(mockBroadcastToTenant).not.toHaveBeenCalled();
    });

    it('broadcasts to the correct tenant', async () => {
      const TENANT_X = crypto.randomUUID();
      await bus.publish('realization.milestone_reached', makeMilestoneReached({ tenantId: TENANT_X }));

      expect(mockBroadcastToTenant).toHaveBeenCalledOnce();
      expect(mockBroadcastToTenant.mock.calls[0][0]).toBe(TENANT_X);
    });
  });
});
