import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockWorkerConstructor, mockQueueConstructor, mockWorkerInstance, mockQueueInstance } =
  vi.hoisted(() => {
    const mockWorkerInstance = {
      on: vi.fn().mockReturnThis(),
      close: vi.fn().mockResolvedValue(undefined),
    };
    const mockQueueInstance = {
      add: vi.fn().mockResolvedValue({ id: 'job-1' }),
      close: vi.fn().mockResolvedValue(undefined),
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
  Queue: mockQueueConstructor,
}));

vi.mock('ioredis', () => ({
  default: vi.fn(() => ({ on: vi.fn(), quit: vi.fn() })),
}));

vi.mock('../../lib/supabase/privileged/index.js', () => ({
  createWorkerServiceSupabaseClient: vi.fn(() => ({ from: vi.fn() })),
}));

vi.mock('../../lib/logger.js', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

vi.mock('../../metrics/billingMetrics.js', () => ({
  billingWebhookExhaustedTotal: { inc: vi.fn() },
  webhookDlqSize: { set: vi.fn() },
  webhookCircuitBreakerRejectedTotal: { inc: vi.fn() },
}));

vi.mock('../../observability/queueMetrics.js', () => ({
  attachQueueMetrics: vi.fn(),
}));

vi.mock('../../services/billing/WebhookRetryService.js', () => ({
  WebhookRetryService: vi.fn(() => ({
    deliverWebhookEvent: vi.fn().mockResolvedValue({ success: true }),
    moveToDLQ: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('../../services/billing/WebhookCircuitBreaker.js', () => ({
  getWebhookCircuitBreaker: vi.fn(() => ({
    isOpen: vi.fn().mockReturnValue(false),
    recordSuccess: vi.fn(),
    recordFailure: vi.fn(),
  })),
  WEBHOOK_CIRCUIT_CATEGORIES: { STRIPE: 'stripe', HUBSPOT: 'hubspot' },
}));

vi.mock('../../workers/tenantContextBootstrap.js', () => ({
  runJobWithTenantContext: vi.fn((_opts, fn) => fn()),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WebhookRetryWorker', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initWebhookRetryWorker', () => {
    it('creates a BullMQ Worker on the correct queue', async () => {
      const { initWebhookRetryWorker, WEBHOOK_RETRY_QUEUE_NAME } = await import(
        '../WebhookRetryWorker.js'
      );

      initWebhookRetryWorker();

      expect(mockWorkerConstructor).toHaveBeenCalledWith(
        WEBHOOK_RETRY_QUEUE_NAME,
        expect.any(Function),
        expect.objectContaining({ concurrency: expect.any(Number) }),
      );
    });

    it('returns the same worker instance on repeated calls (singleton)', async () => {
      const { initWebhookRetryWorker } = await import('../WebhookRetryWorker.js');

      const w1 = initWebhookRetryWorker();
      const w2 = initWebhookRetryWorker();

      expect(w1).toBe(w2);
    });

    it('attaches completed and failed event listeners', async () => {
      const { initWebhookRetryWorker } = await import('../WebhookRetryWorker.js');

      initWebhookRetryWorker();

      const eventNames = mockWorkerInstance.on.mock.calls.map((c: unknown[]) => c[0]);
      expect(eventNames).toContain('completed');
      expect(eventNames).toContain('failed');
    });
  });

  describe('enqueueWebhookRetry', () => {
    it('enqueues a job with the correct payload', async () => {
      const { enqueueWebhookRetry } = await import('../WebhookRetryWorker.js');

      await enqueueWebhookRetry({
        eventId: 'evt-123',
        tenantId: 'tenant-abc',
        eventType: 'invoice.paid',
        payload: { amount: 100 },
        attemptNumber: 1,
      });

      expect(mockQueueInstance.add).toHaveBeenCalled();
      const [, jobData] = mockQueueInstance.add.mock.calls[0];
      expect(jobData).toMatchObject({
        eventId: 'evt-123',
        tenantId: 'tenant-abc',
        eventType: 'invoice.paid',
      });
    });

    it('scopes job to tenantId (tenant isolation)', async () => {
      const { enqueueWebhookRetry } = await import('../WebhookRetryWorker.js');

      await enqueueWebhookRetry({
        eventId: 'evt-456',
        tenantId: 'tenant-xyz',
        eventType: 'invoice.paid',
        payload: {},
        attemptNumber: 1,
      });

      const [, jobData] = mockQueueInstance.add.mock.calls[0];
      expect(jobData.tenantId).toBe('tenant-xyz');
    });
  });

  describe('closeWebhookRetryWorker', () => {
    it('closes the worker gracefully', async () => {
      const { initWebhookRetryWorker, closeWebhookRetryWorker } = await import(
        '../WebhookRetryWorker.js'
      );

      initWebhookRetryWorker();
      await closeWebhookRetryWorker();

      expect(mockWorkerInstance.close).toHaveBeenCalled();
    });

    it('does not throw if worker was never initialized', async () => {
      const { closeWebhookRetryWorker } = await import('../WebhookRetryWorker.js');

      await expect(closeWebhookRetryWorker()).resolves.not.toThrow();
    });
  });
});
