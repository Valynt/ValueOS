import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockWorkerConstructor, mockWorkerInstance } = vi.hoisted(() => {
  const mockWorkerInstance = {
    on: vi.fn().mockReturnThis(),
    close: vi.fn().mockResolvedValue(undefined),
  };
  return {
    mockWorkerConstructor: vi.fn(() => mockWorkerInstance),
    mockWorkerInstance,
  };
});

vi.mock('bullmq', () => ({
  Worker: mockWorkerConstructor,
  Queue: vi.fn(() => ({
    add: vi.fn().mockResolvedValue({ id: 'job-1' }),
    close: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('ioredis', () => ({
  default: vi.fn(() => ({ on: vi.fn(), quit: vi.fn() })),
}));

vi.mock('../../lib/supabase/privileged/index.js', () => ({
  assertNotTestEnv: vi.fn(),
  createWorkerServiceSupabaseClient: vi.fn(() => ({ from: vi.fn() })),
}));

vi.mock('../../lib/logger.js', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../observability/queueMetrics.js', () => ({
  attachQueueMetrics: vi.fn(),
}));

const { mockProcessResearchJob } = vi.hoisted(() => ({
  mockProcessResearchJob: vi.fn().mockResolvedValue({ status: 'completed' }),
}));

vi.mock('../../services/onboarding/ResearchJobWorker.js', () => ({
  processResearchJob: mockProcessResearchJob,
  ResearchJobStatus: { COMPLETED: 'completed', FAILED: 'failed' },
}));

vi.mock('../../lib/llm/LLMGateway.js', () => ({
  LLMGateway: vi.fn(() => ({})),
}));

vi.mock('../../workers/tenantContextBootstrap.js', () => ({
  runJobWithTenantContext: vi.fn((_opts, fn) => fn()),
}));

vi.mock('../../lib/telemetry/runInTelemetrySpanAsync.js', () => ({
  runInTelemetrySpanAsync: vi.fn((_name, _attrs, fn) => fn()),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('researchWorker', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    // Restore default return value after clearAllMocks resets it
    mockProcessResearchJob.mockResolvedValue({ status: 'completed' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initResearchWorker', () => {
    it('creates a BullMQ Worker on the correct queue', async () => {
      const { initResearchWorker, RESEARCH_QUEUE_NAME } = await import('../researchWorker.js');

      initResearchWorker();

      expect(mockWorkerConstructor).toHaveBeenCalledWith(
        RESEARCH_QUEUE_NAME,
        expect.any(Function),
        expect.objectContaining({ concurrency: expect.any(Number) }),
      );
    });

    it('returns the same worker instance on repeated calls (singleton)', async () => {
      const { initResearchWorker } = await import('../researchWorker.js');

      const w1 = initResearchWorker();
      const w2 = initResearchWorker();

      expect(w1).toBe(w2);
    });

    it('attaches error event listener', async () => {
      const { initResearchWorker } = await import('../researchWorker.js');

      initResearchWorker();

      expect(mockWorkerInstance.on).toHaveBeenCalledWith('error', expect.any(Function));
    });
  });

  describe('job processor', () => {
    it('throws when tenantId is missing (tenant isolation guard)', async () => {
      const { initResearchWorker } = await import('../researchWorker.js');
      initResearchWorker();

      // Extract the processor function passed to Worker constructor
      const processorFn = mockWorkerConstructor.mock.calls[0][1];

      await expect(
        processorFn({ data: { organizationId: 'org-1' } }),
      ).rejects.toThrow(/tenantId/);
    });

    it('calls processResearchJob with tenantId-scoped data', async () => {
      const { initResearchWorker } = await import('../researchWorker.js');
      initResearchWorker();

      const processorFn = mockWorkerConstructor.mock.calls[0][1];

      await processorFn({
        data: {
          tenantId: 'tenant-abc',
          organizationId: 'org-1',
          jobId: 'job-1',
        },
        id: 'bullmq-id-1',
      });

      expect(mockProcessResearchJob).toHaveBeenCalled();
      const [jobData] = mockProcessResearchJob.mock.calls[0];
      expect(jobData).toMatchObject({ tenantId: 'tenant-abc', organizationId: 'org-1' });
    });

    it('throws when processResearchJob returns status failed', async () => {
      mockProcessResearchJob.mockResolvedValueOnce({ status: 'failed', error: 'Research job failed' });

      const { initResearchWorker } = await import('../researchWorker.js');
      initResearchWorker();

      const processorFn = mockWorkerConstructor.mock.calls[0][1];

      await expect(
        processorFn({
          data: { tenantId: 'tenant-abc', organizationId: 'org-1', jobId: 'job-1' },
          id: 'bullmq-id-1',
        }),
      ).rejects.toThrow('Research job failed');
    });
  });

  describe('graceful shutdown', () => {
    it('closes the worker via worker.close()', async () => {
      const { initResearchWorker } = await import('../researchWorker.js');

      const worker = initResearchWorker();
      await worker.close();

      expect(mockWorkerInstance.close).toHaveBeenCalled();
    });
  });
});
