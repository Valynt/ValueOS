import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockWorkerConstructor, mockWorkerInstance, mockQueueInstance } = vi.hoisted(() => {
  const mockWorkerInstance = {
    on: vi.fn().mockReturnThis(),
    close: vi.fn().mockResolvedValue(undefined),
  };
  const mockQueueInstance = {
    add: vi.fn().mockResolvedValue({ id: 'job-1' }),
    close: vi.fn().mockResolvedValue(undefined),
    getRepeatableJobs: vi.fn().mockResolvedValue([]),
    removeRepeatableByKey: vi.fn().mockResolvedValue(undefined),
  };
  return {
    mockWorkerConstructor: vi.fn(() => mockWorkerInstance),
    mockQueueConstructor: vi.fn(() => mockQueueInstance),
    mockWorkerInstance,
    mockQueueInstance,
  };
});

vi.mock('bullmq', () => ({
  Worker: mockWorkerConstructor,
  Queue: vi.fn(() => mockQueueInstance),
}));

vi.mock('ioredis', () => ({
  default: vi.fn(() => ({
    on: vi.fn(),
    quit: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('../../lib/supabase/privileged/index.js', () => ({
  assertNotTestEnv: vi.fn(),
  createWorkerServiceSupabaseClient: vi.fn(() => ({ from: vi.fn() })),
}));

vi.mock('../../lib/logger.js', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

vi.mock('../../observability/queueMetrics.js', () => ({
  attachQueueMetrics: vi.fn(),
}));

const mockEvaluateEnabledRules = vi.fn().mockResolvedValue(undefined);
vi.mock('../../services/billing/AlertingService.js', () => ({
  AlertingService: vi.fn(() => ({
    evaluateEnabledRules: mockEvaluateEnabledRules,
  })),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AlertingRulesWorker', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initAlertingRulesWorker', () => {
    it('creates a BullMQ Worker on the correct queue', async () => {
      const { initAlertingRulesWorker, ALERTING_QUEUE_NAME } = await import(
        '../AlertingRulesWorker.js'
      );

      initAlertingRulesWorker();

      expect(mockWorkerConstructor).toHaveBeenCalledWith(
        ALERTING_QUEUE_NAME,
        expect.any(Function),
        expect.objectContaining({ concurrency: 1 }),
      );
    });

    it('returns the same instance on repeated calls (singleton)', async () => {
      const { initAlertingRulesWorker } = await import('../AlertingRulesWorker.js');

      const w1 = initAlertingRulesWorker();
      const w2 = initAlertingRulesWorker();

      expect(w1).toBe(w2);
      expect(mockWorkerConstructor).toHaveBeenCalledTimes(1);
    });

    it('attaches a completed event listener', async () => {
      const { initAlertingRulesWorker } = await import('../AlertingRulesWorker.js');

      initAlertingRulesWorker();

      expect(mockWorkerInstance.on).toHaveBeenCalledWith('completed', expect.any(Function));
    });
  });

  describe('job processor', () => {
    it('calls evaluateEnabledRules on each job', async () => {
      const { initAlertingRulesWorker } = await import('../AlertingRulesWorker.js');
      initAlertingRulesWorker();

      const processorFn = mockWorkerConstructor.mock.calls[0][1];
      const result = await processorFn({});

      expect(mockEvaluateEnabledRules).toHaveBeenCalledTimes(1);
      expect(result).toHaveProperty('processedAt');
    });

    it('propagates errors from evaluateEnabledRules (job failure does not crash worker)', async () => {
      mockEvaluateEnabledRules.mockRejectedValueOnce(new Error('DB connection lost'));

      const { initAlertingRulesWorker } = await import('../AlertingRulesWorker.js');
      initAlertingRulesWorker();

      const processorFn = mockWorkerConstructor.mock.calls[0][1];

      // BullMQ handles the thrown error — worker itself stays alive
      await expect(processorFn({})).rejects.toThrow('DB connection lost');
      // Worker instance is still the same (not replaced)
      expect(initAlertingRulesWorker()).toBe(mockWorkerInstance);
    });

    it('does not require tenantId (cross-tenant scheduled job)', async () => {
      const { initAlertingRulesWorker } = await import('../AlertingRulesWorker.js');
      initAlertingRulesWorker();

      const processorFn = mockWorkerConstructor.mock.calls[0][1];

      // Should not throw for missing tenantId — this is a cross-tenant scheduled job
      await expect(processorFn({})).resolves.not.toThrow();
    });
  });

  describe('closeAlertingRulesWorker', () => {
    it('closes the worker gracefully', async () => {
      const { initAlertingRulesWorker, closeAlertingRulesWorker } = await import(
        '../AlertingRulesWorker.js'
      );

      initAlertingRulesWorker();
      await closeAlertingRulesWorker();

      expect(mockWorkerInstance.close).toHaveBeenCalled();
    });

    it('does not throw if worker was never initialized', async () => {
      const { closeAlertingRulesWorker } = await import('../AlertingRulesWorker.js');

      await expect(closeAlertingRulesWorker()).resolves.not.toThrow();
    });
  });
});
