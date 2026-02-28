import { beforeEach, describe, expect, it, vi } from 'vitest';

import { 
  SagaAuditLogger, 
  SagaEventEmitter, 
  SagaPersistence, 
  SagaState, 
  SagaTrigger, 
  ValueCaseSaga 
} from '../ValueCaseSaga.js';

describe('ValueCaseSaga', () => {
  let saga: ValueCaseSaga;
  let mockPersistence: SagaPersistence;
  let mockEventEmitter: SagaEventEmitter;
  let mockAuditLogger: SagaAuditLogger;

  beforeEach(() => {
    mockPersistence = {
      saveState: vi.fn().mockResolvedValue(undefined),
      loadState: vi.fn().mockResolvedValue(null),
      recordTransition: vi.fn().mockResolvedValue(undefined),
    };
    mockEventEmitter = {
      emit: vi.fn(),
    };
    mockAuditLogger = {
      log: vi.fn().mockResolvedValue(undefined),
    };

    saga = new ValueCaseSaga({
      persistence: mockPersistence,
      eventEmitter: mockEventEmitter,
      auditLogger: mockAuditLogger,
    });
  });

  describe('initialize', () => {
    it('should initialize a new saga in INITIATED state', async () => {
      const valueCaseId = 'case-123';
      const tenantId = 'tenant-456';
      const correlationId = 'corr-789';

      const snapshot = await saga.initialize(valueCaseId, tenantId, correlationId);

      expect(snapshot.state).toBe(SagaState.INITIATED);
      expect(snapshot.valueCaseId).toBe(valueCaseId);
      expect(snapshot.tenantId).toBe(tenantId);
      expect(mockPersistence.saveState).toHaveBeenCalled();
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(expect.objectContaining({
        type: 'saga.state.transitioned',
        payload: expect.objectContaining({ toState: SagaState.INITIATED })
      }));
    });
  });

  describe('transition', () => {
    it('should transition from INITIATED to DRAFTING on OPPORTUNITY_INGESTED', async () => {
      const valueCaseId = 'case-123';
      const correlationId = 'corr-789';
      
      const initialSnapshot = {
        valueCaseId,
        tenantId: 'tenant-456',
        state: SagaState.INITIATED,
        data: {},
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      vi.mocked(mockPersistence.loadState).mockResolvedValue(initialSnapshot);

      const updated = await saga.transition(valueCaseId, SagaTrigger.OPPORTUNITY_INGESTED, correlationId);

      expect(updated.state).toBe(SagaState.DRAFTING);
      expect(updated.previousState).toBe(SagaState.INITIATED);
      expect(updated.version).toBe(2);
      expect(mockPersistence.recordTransition).toHaveBeenCalledWith(expect.objectContaining({
        fromState: SagaState.INITIATED,
        toState: SagaState.DRAFTING,
        trigger: SagaTrigger.OPPORTUNITY_INGESTED
      }));
    });

    it('should throw error on invalid transition', async () => {
      const valueCaseId = 'case-123';
      const correlationId = 'corr-789';
      
      const initialSnapshot = {
        valueCaseId,
        tenantId: 'tenant-456',
        state: SagaState.INITIATED,
        data: {},
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      vi.mocked(mockPersistence.loadState).mockResolvedValue(initialSnapshot);

      // Transition from INITIATED to VALIDATING directly is invalid
      await expect(saga.transition(valueCaseId, SagaTrigger.MODEL_COMPLETE, correlationId))
        .rejects.toThrow(/Invalid transition/);
    });

    it('should handle backward transitions (e.g., integrity veto)', async () => {
      const valueCaseId = 'case-123';
      const correlationId = 'corr-789';
      
      const validatingSnapshot = {
        valueCaseId,
        tenantId: 'tenant-456',
        state: SagaState.VALIDATING,
        data: {},
        version: 3,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      vi.mocked(mockPersistence.loadState).mockResolvedValue(validatingSnapshot);

      const updated = await saga.transition(valueCaseId, SagaTrigger.INTEGRITY_VETOED, correlationId);

      expect(updated.state).toBe(SagaState.DRAFTING);
      expect(updated.previousState).toBe(SagaState.VALIDATING);
    });
  });

  describe('compensate', () => {
    it('should execute compensation handler for current state', async () => {
      const valueCaseId = 'case-123';
      const correlationId = 'corr-789';
      
      const draftingSnapshot = {
        valueCaseId,
        tenantId: 'tenant-456',
        state: SagaState.DRAFTING,
        data: { some: 'data' },
        version: 2,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      vi.mocked(mockPersistence.loadState).mockResolvedValue(draftingSnapshot);

      const results = await saga.compensate(valueCaseId, correlationId);

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('revert_value_tree');
      expect(results[0].success).toBe(true);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(expect.objectContaining({
        type: 'saga.compensation.executed'
      }));
    });
  });
});
