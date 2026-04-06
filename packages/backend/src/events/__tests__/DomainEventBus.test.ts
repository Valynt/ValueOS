import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
}));

import {
  _resetDomainEventBusForTests,
  buildEventEnvelope,
  DomainEventBus,
  getDomainEventBus,
} from '../DomainEventBus.js';
import type { OpportunityUpdatedPayload } from '../DomainEventSchemas.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeOpportunityUpdatedPayload(
  overrides: Partial<OpportunityUpdatedPayload> = {},
): OpportunityUpdatedPayload {
  return {
    id: crypto.randomUUID(),
    emittedAt: new Date().toISOString(),
    traceId: 'trace-001',
    tenantId: crypto.randomUUID(),
    actorId: 'user-001',
    opportunityId: crypto.randomUUID(),
    workspaceId: 'ws-001',
    lifecycleStage: 'opportunity',
    hypothesisCount: 3,
    averageConfidence: 0.72,
    recommendedNextSteps: ['Run TargetAgent', 'Review hypotheses'],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// DomainEventBus unit tests
// ---------------------------------------------------------------------------

describe('DomainEventBus', () => {
  let bus: DomainEventBus;

  beforeEach(() => {
    bus = new DomainEventBus();
  });

  describe('subscribe / publish', () => {
    it('delivers a published event to a subscriber', async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      bus.subscribe('opportunity.updated', handler);

      const payload = makeOpportunityUpdatedPayload();
      await bus.publish('opportunity.updated', payload);

      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        opportunityId: payload.opportunityId,
        tenantId: payload.tenantId,
      }));
    });

    it('delivers to multiple subscribers on the same event', async () => {
      const h1 = vi.fn().mockResolvedValue(undefined);
      const h2 = vi.fn().mockResolvedValue(undefined);
      bus.subscribe('opportunity.updated', h1);
      bus.subscribe('opportunity.updated', h2);

      await bus.publish('opportunity.updated', makeOpportunityUpdatedPayload());

      expect(h1).toHaveBeenCalledOnce();
      expect(h2).toHaveBeenCalledOnce();
    });

    it('does not deliver to subscribers of a different event', async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      bus.subscribe('hypothesis.validated', handler);

      await bus.publish('opportunity.updated', makeOpportunityUpdatedPayload());

      expect(handler).not.toHaveBeenCalled();
    });

    it('unsubscribe stops future deliveries', async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      const unsub = bus.subscribe('opportunity.updated', handler);

      unsub();
      await bus.publish('opportunity.updated', makeOpportunityUpdatedPayload());

      expect(handler).not.toHaveBeenCalled();
    });

    it('continues delivering to remaining subscribers after one unsubscribes', async () => {
      const h1 = vi.fn().mockResolvedValue(undefined);
      const h2 = vi.fn().mockResolvedValue(undefined);
      const unsub1 = bus.subscribe('opportunity.updated', h1);
      bus.subscribe('opportunity.updated', h2);

      unsub1();
      await bus.publish('opportunity.updated', makeOpportunityUpdatedPayload());

      expect(h1).not.toHaveBeenCalled();
      expect(h2).toHaveBeenCalledOnce();
    });
  });

  describe('payload validation', () => {
    it('rejects a payload that fails schema validation', async () => {
      const invalid = { id: 'not-a-uuid' } as unknown as OpportunityUpdatedPayload;

      await expect(bus.publish('opportunity.updated', invalid)).rejects.toThrow(
        /Invalid payload for domain event/,
      );
    });

    it('delivers the validated (parsed) payload, not the raw input', async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      bus.subscribe('opportunity.updated', handler);

      const payload = makeOpportunityUpdatedPayload();
      await bus.publish('opportunity.updated', payload);

      const received: OpportunityUpdatedPayload = handler.mock.calls[0][0];
      expect(received.hypothesisCount).toBe(payload.hypothesisCount);
      expect(received.averageConfidence).toBe(payload.averageConfidence);
    });
  });

  describe('handler error isolation', () => {
    it('does not propagate a handler error to the publisher', async () => {
      const failing = vi.fn().mockRejectedValue(new Error('handler boom'));
      const succeeding = vi.fn().mockResolvedValue(undefined);
      bus.subscribe('opportunity.updated', failing);
      bus.subscribe('opportunity.updated', succeeding);

      // Should not throw
      await expect(
        bus.publish('opportunity.updated', makeOpportunityUpdatedPayload()),
      ).resolves.toBeUndefined();

      expect(succeeding).toHaveBeenCalledOnce();
    });
  });

  describe('Redis cross-process delivery', () => {
    it('skips local delivery when originPid matches the current process', async () => {
      const handler = vi.fn().mockResolvedValue(undefined);

      // Simulate a redisSub that captures the psubscribe callback so we can
      // invoke it manually with a crafted message.
      let capturedCallback: ((msg: string, ch: string) => void) | null = null;
      const fakeSub = {
        psubscribe: (_pattern: string, cb: (msg: string, ch: string) => void) => {
          capturedCallback = cb;
        },
      };

      const busWith = new DomainEventBus({ redisSub: fakeSub as any });
      busWith.subscribe('opportunity.updated', handler);

      // Fire a Redis message that originated from THIS process
      const payload = makeOpportunityUpdatedPayload();
      capturedCallback!(
        JSON.stringify({ name: 'opportunity.updated', payload, originPid: process.pid }),
        'domain:opportunity.updated',
      );

      // Allow any microtasks to settle
      await Promise.resolve();

      expect(handler).not.toHaveBeenCalled();
    });

    it('delivers locally when originPid is from a different process', async () => {
      const handler = vi.fn().mockResolvedValue(undefined);

      let capturedCallback: ((msg: string, ch: string) => void) | null = null;
      const fakeSub = {
        psubscribe: (_pattern: string, cb: (msg: string, ch: string) => void) => {
          capturedCallback = cb;
        },
      };

      const busWith = new DomainEventBus({ redisSub: fakeSub as any });
      busWith.subscribe('opportunity.updated', handler);

      const payload = makeOpportunityUpdatedPayload();
      capturedCallback!(
        JSON.stringify({ name: 'opportunity.updated', payload, originPid: process.pid + 1 }),
        'domain:opportunity.updated',
      );

      // Allow the async deliverLocally to settle
      await new Promise((r) => setTimeout(r, 0));

      expect(handler).toHaveBeenCalledOnce();
    });

    it('delivers locally when originPid is absent (legacy message format)', async () => {
      const handler = vi.fn().mockResolvedValue(undefined);

      let capturedCallback: ((msg: string, ch: string) => void) | null = null;
      const fakeSub = {
        psubscribe: (_pattern: string, cb: (msg: string, ch: string) => void) => {
          capturedCallback = cb;
        },
      };

      const busWith = new DomainEventBus({ redisSub: fakeSub as any });
      busWith.subscribe('opportunity.updated', handler);

      const payload = makeOpportunityUpdatedPayload();
      // Tests backwards compatibility with legacy message format (no originPid field)
      capturedCallback!(
        JSON.stringify({ name: 'opportunity.updated', payload }),
        'domain:opportunity.updated',
      );

      await new Promise((r) => setTimeout(r, 0));

      expect(handler).toHaveBeenCalledOnce();
    });
  });

  describe('all domain events', () => {
    it('delivers hypothesis.validated', async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      bus.subscribe('hypothesis.validated', handler);

      await bus.publish('hypothesis.validated', {
        id: crypto.randomUUID(),
        emittedAt: new Date().toISOString(),
        traceId: 'trace-002',
        tenantId: crypto.randomUUID(),
        actorId: 'user-001',
        opportunityId: crypto.randomUUID(),
        workspaceId: 'ws-001',
        supportedClaimCount: 4,
        totalClaimCount: 5,
        integrityScore: 0.88,
        vetoed: false,
        reRefineRequested: false,
      });

      expect(handler).toHaveBeenCalledOnce();
    });

    it('delivers evidence.attached', async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      bus.subscribe('evidence.attached', handler);

      await bus.publish('evidence.attached', {
        id: crypto.randomUUID(),
        emittedAt: new Date().toISOString(),
        traceId: 'trace-003',
        tenantId: crypto.randomUUID(),
        actorId: 'user-001',
        opportunityId: crypto.randomUUID(),
        workspaceId: 'ws-001',
        hypothesisId: 'hyp-001',
        evidenceType: 'financial_data',
        source: 'MCP Ground Truth',
        confidenceDelta: 0.15,
      });

      expect(handler).toHaveBeenCalledOnce();
    });

    it('delivers realization.milestone_reached', async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      bus.subscribe('realization.milestone_reached', handler);

      await bus.publish('realization.milestone_reached', {
        id: crypto.randomUUID(),
        emittedAt: new Date().toISOString(),
        traceId: 'trace-004',
        tenantId: crypto.randomUUID(),
        actorId: 'user-001',
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
      });

      expect(handler).toHaveBeenCalledOnce();
    });
    it('delivers narrative.drafted', async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      bus.subscribe('narrative.drafted', handler);

      await bus.publish('narrative.drafted', {
        id: crypto.randomUUID(),
        emittedAt: new Date().toISOString(),
        traceId: 'trace-005',
        tenantId: crypto.randomUUID(),
        actorId: 'user-001',
        valueCaseId: 'case-001',
        defenseReadinessScore: 0.82,
        format: 'executive_summary',
      });

      expect(handler).toHaveBeenCalledOnce();
    });
  });

  describe('getDomainEventBus singleton', () => {
    beforeEach(() => {
      _resetDomainEventBusForTests();
    });

    it('returns the same instance on repeated calls', () => {
      const a = getDomainEventBus();
      const b = getDomainEventBus();
      expect(a).toBe(b);
    });

    it('returns a fresh instance after reset', () => {
      const a = getDomainEventBus();
      _resetDomainEventBusForTests();
      const b = getDomainEventBus();
      expect(a).not.toBe(b);
    });
  });

  describe('buildEventEnvelope', () => {
    it('produces a valid envelope with a UUID id and ISO timestamp', () => {
      const envelope = buildEventEnvelope({
        traceId: 'trace-xyz',
        tenantId: crypto.randomUUID(),
        actorId: 'user-001',
      });

      expect(envelope.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
      expect(new Date(envelope.emittedAt).toISOString()).toBe(envelope.emittedAt);
      expect(envelope.traceId).toBe('trace-xyz');
    });
  });
});
