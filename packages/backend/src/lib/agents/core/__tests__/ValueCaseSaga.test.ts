/**
 * ValueCaseSaga unit tests
 *
 * Covers state transitions, invalid trigger rejection, compensation handlers,
 * and audit/event emission on initialize().
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  SagaState,
  SagaTrigger,
  ValueCaseSaga,
  type SagaSnapshot,
} from '../ValueCaseSaga.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSnapshot(state = SagaState.INITIATED): SagaSnapshot {
  return {
    valueCaseId: 'case-1',
    tenantId: 'tenant-1',
    state,
    data: {},
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function makeDeps(initialState = SagaState.INITIATED) {
  let stored: SagaSnapshot | null = makeSnapshot(initialState);

  const persistence = {
    saveState: vi.fn(async (s: SagaSnapshot) => { stored = s; }),
    loadState: vi.fn(async () => stored),
    recordTransition: vi.fn(async () => {}),
  };
  const eventEmitter = { emit: vi.fn() };
  const auditLogger = { log: vi.fn(async () => {}) };

  const saga = new ValueCaseSaga({ persistence, eventEmitter, auditLogger });
  return { saga, persistence, eventEmitter, auditLogger, getStored: () => stored };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ValueCaseSaga', () => {
  describe('initialize()', () => {
    it('saves INITIATED snapshot and emits saga.state.transitioned', async () => {
      const { saga, persistence, eventEmitter, auditLogger } = makeDeps();

      const snap = await saga.initialize('case-1', 'tenant-1', 'corr-1');

      expect(snap.state).toBe(SagaState.INITIATED);
      expect(snap.valueCaseId).toBe('case-1');
      expect(snap.tenantId).toBe('tenant-1');
      expect(persistence.saveState).toHaveBeenCalledWith(expect.objectContaining({ state: SagaState.INITIATED }));
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'saga.state.transitioned' })
      );
      expect(auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'saga_initialized' })
      );
    });
  });

  describe('transition()', () => {
    it('INITIATED → DRAFTING via OPPORTUNITY_INGESTED', async () => {
      const { saga, getStored } = makeDeps(SagaState.INITIATED);

      const snap = await saga.transition('case-1', SagaTrigger.OPPORTUNITY_INGESTED, 'corr-1');

      expect(snap.state).toBe(SagaState.DRAFTING);
      expect(snap.previousState).toBe(SagaState.INITIATED);
      expect(snap.version).toBe(2);
      expect(getStored()?.state).toBe(SagaState.DRAFTING);
    });

    it('DRAFTING → VALIDATING via HYPOTHESIS_CONFIRMED', async () => {
      const { saga } = makeDeps(SagaState.DRAFTING);
      const snap = await saga.transition('case-1', SagaTrigger.HYPOTHESIS_CONFIRMED, 'corr-1');
      expect(snap.state).toBe(SagaState.VALIDATING);
    });

    it('VALIDATING → COMPOSING via INTEGRITY_PASSED', async () => {
      const { saga } = makeDeps(SagaState.VALIDATING);
      const snap = await saga.transition('case-1', SagaTrigger.INTEGRITY_PASSED, 'corr-1');
      expect(snap.state).toBe(SagaState.COMPOSING);
    });

    it('COMPOSING → REFINING via FEEDBACK_RECEIVED', async () => {
      const { saga } = makeDeps(SagaState.COMPOSING);
      const snap = await saga.transition('case-1', SagaTrigger.FEEDBACK_RECEIVED, 'corr-1');
      expect(snap.state).toBe(SagaState.REFINING);
    });

    it('REFINING → FINALIZED via VE_APPROVED', async () => {
      const { saga } = makeDeps(SagaState.REFINING);
      const snap = await saga.transition('case-1', SagaTrigger.VE_APPROVED, 'corr-1');
      expect(snap.state).toBe(SagaState.FINALIZED);
    });

    it('invalid trigger throws with valid-triggers message', async () => {
      const { saga } = makeDeps(SagaState.INITIATED);

      await expect(
        saga.transition('case-1', SagaTrigger.VE_APPROVED, 'corr-1')
      ).rejects.toThrow(/Valid triggers/);
    });

    it('missing case throws', async () => {
      const persistence = {
        saveState: vi.fn(),
        loadState: vi.fn(async () => null),
        recordTransition: vi.fn(async () => {}),
      };
      const saga = new ValueCaseSaga({
        persistence,
        eventEmitter: { emit: vi.fn() },
        auditLogger: { log: vi.fn(async () => {}) },
      });

      await expect(
        saga.transition('missing-case', SagaTrigger.OPPORTUNITY_INGESTED, 'corr-1')
      ).rejects.toThrow('not found');
    });
  });

  describe('compensate()', () => {
    it('DRAFTING compensation returns success: true', async () => {
      const { saga } = makeDeps(SagaState.DRAFTING);
      const results = await saga.compensate('case-1', 'corr-1');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].success).toBe(true);
    });

    it('VALIDATING compensation returns success: true', async () => {
      const { saga } = makeDeps(SagaState.VALIDATING);
      const results = await saga.compensate('case-1', 'corr-1');
      expect(results[0].success).toBe(true);
    });

    it('COMPOSING compensation returns success: true', async () => {
      const { saga } = makeDeps(SagaState.COMPOSING);
      const results = await saga.compensate('case-1', 'corr-1');
      expect(results[0].success).toBe(true);
    });
  });
});
