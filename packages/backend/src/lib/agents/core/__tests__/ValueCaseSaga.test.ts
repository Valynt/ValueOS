import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ValueCaseSaga,
  SagaState,
  SagaTrigger,
  type SagaSnapshot,
  type SagaPersistence,
  type SagaEventEmitter,
  type SagaTransitionRecord,
} from '../ValueCaseSaga.js';

// ---------------------------------------------------------------------------
// In-memory persistence stub
// ---------------------------------------------------------------------------

class InMemoryPersistence implements SagaPersistence {
  private store = new Map<string, SagaSnapshot>();
  private transitions: SagaTransitionRecord[] = [];

  async saveState(snapshot: SagaSnapshot): Promise<void> {
    this.store.set(snapshot.valueCaseId, snapshot);
  }

  async loadState(valueCaseId: string): Promise<SagaSnapshot | null> {
    return this.store.get(valueCaseId) ?? null;
  }

  async recordTransition(record: SagaTransitionRecord): Promise<void> {
    this.transitions.push(record);
  }

  getTransitions(): SagaTransitionRecord[] {
    return this.transitions;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSaga(persistence: SagaPersistence) {
  const eventEmitter: SagaEventEmitter = { emit: vi.fn() };
  const auditLogger = { log: vi.fn().mockResolvedValue(undefined) };
  const saga = new ValueCaseSaga({ persistence, eventEmitter, auditLogger });
  return { saga, eventEmitter, auditLogger };
}

const CASE_ID = '00000000-0000-0000-0000-000000000001';
const TENANT_ID = 'tenant-abc';
const CORRELATION_ID = '00000000-0000-0000-0000-000000000002';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ValueCaseSaga', () => {
  let persistence: InMemoryPersistence;

  beforeEach(() => {
    persistence = new InMemoryPersistence();
  });

  describe('initialize()', () => {
    it('persists snapshot in INITIATED state', async () => {
      const { saga } = makeSaga(persistence);
      const snapshot = await saga.initialize(CASE_ID, TENANT_ID, CORRELATION_ID);

      expect(snapshot.state).toBe(SagaState.INITIATED);
      expect(snapshot.valueCaseId).toBe(CASE_ID);
      expect(snapshot.tenantId).toBe(TENANT_ID);
      expect(snapshot.version).toBe(1);
    });

    it('emits saga.state.transitioned event', async () => {
      const { saga, eventEmitter } = makeSaga(persistence);
      await saga.initialize(CASE_ID, TENANT_ID, CORRELATION_ID);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'saga.state.transitioned',
          payload: expect.objectContaining({ toState: SagaState.INITIATED }),
        }),
      );
    });

    it('calls auditLogger.log', async () => {
      const { saga, auditLogger } = makeSaga(persistence);
      await saga.initialize(CASE_ID, TENANT_ID, CORRELATION_ID);

      expect(auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'saga_initialized' }),
      );
    });
  });

  describe('transition()', () => {
    it('advances INITIATED → DRAFTING on OPPORTUNITY_INGESTED', async () => {
      const { saga } = makeSaga(persistence);
      await saga.initialize(CASE_ID, TENANT_ID, CORRELATION_ID);

      const updated = await saga.transition(
        CASE_ID,
        SagaTrigger.OPPORTUNITY_INGESTED,
        CORRELATION_ID,
      );

      expect(updated.state).toBe(SagaState.DRAFTING);
      expect(updated.previousState).toBe(SagaState.INITIATED);
      expect(updated.version).toBe(2);
    });

    it('advances through the full forward flow', async () => {
      const { saga } = makeSaga(persistence);
      await saga.initialize(CASE_ID, TENANT_ID, CORRELATION_ID);

      await saga.transition(CASE_ID, SagaTrigger.OPPORTUNITY_INGESTED, CORRELATION_ID);
      await saga.transition(CASE_ID, SagaTrigger.HYPOTHESIS_CONFIRMED, CORRELATION_ID);
      await saga.transition(CASE_ID, SagaTrigger.INTEGRITY_PASSED, CORRELATION_ID);
      await saga.transition(CASE_ID, SagaTrigger.FEEDBACK_RECEIVED, CORRELATION_ID);
      const final = await saga.transition(CASE_ID, SagaTrigger.VE_APPROVED, CORRELATION_ID);

      expect(final.state).toBe(SagaState.FINALIZED);
    });

    it('throws on invalid trigger with message listing valid triggers', async () => {
      const { saga } = makeSaga(persistence);
      await saga.initialize(CASE_ID, TENANT_ID, CORRELATION_ID);

      await expect(
        saga.transition(CASE_ID, SagaTrigger.VE_APPROVED, CORRELATION_ID),
      ).rejects.toThrow(/Valid triggers:/);
    });

    it('throws when case does not exist', async () => {
      const { saga } = makeSaga(persistence);

      await expect(
        saga.transition('nonexistent-id', SagaTrigger.OPPORTUNITY_INGESTED, CORRELATION_ID),
      ).rejects.toThrow('not found');
    });

    it('records the transition in persistence', async () => {
      const { saga } = makeSaga(persistence);
      await saga.initialize(CASE_ID, TENANT_ID, CORRELATION_ID);
      await saga.transition(CASE_ID, SagaTrigger.OPPORTUNITY_INGESTED, CORRELATION_ID);

      const transitions = persistence.getTransitions();
      expect(transitions).toHaveLength(1);
      expect(transitions[0]).toMatchObject({
        fromState: SagaState.INITIATED,
        toState: SagaState.DRAFTING,
        trigger: SagaTrigger.OPPORTUNITY_INGESTED,
      });
    });
  });

  describe('compensate()', () => {
    it('returns success:true for each state with a default handler', async () => {
      const { saga } = makeSaga(persistence);
      await saga.initialize(CASE_ID, TENANT_ID, CORRELATION_ID);
      await saga.transition(CASE_ID, SagaTrigger.OPPORTUNITY_INGESTED, CORRELATION_ID);

      const results = await saga.compensate(CASE_ID, CORRELATION_ID);

      expect(results).toHaveLength(1);
      expect(results[0]?.success).toBe(true);
    });

    it('throws when case does not exist', async () => {
      const { saga } = makeSaga(persistence);

      await expect(saga.compensate('nonexistent-id', CORRELATION_ID)).rejects.toThrow('not found');
    });
  });

  describe('getValidTriggers()', () => {
    it('returns OPPORTUNITY_INGESTED for INITIATED state', () => {
      const { saga } = makeSaga(persistence);
      const triggers = saga.getValidTriggers(SagaState.INITIATED);
      expect(triggers).toContain(SagaTrigger.OPPORTUNITY_INGESTED);
    });

    it('returns empty array for FINALIZED state', () => {
      const { saga } = makeSaga(persistence);
      const triggers = saga.getValidTriggers(SagaState.FINALIZED);
      expect(triggers).toHaveLength(0);
    });
  });
});
