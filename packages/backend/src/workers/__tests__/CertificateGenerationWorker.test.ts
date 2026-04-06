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

vi.mock('../../lib/supabase/privileged/index.js', () => ({
  assertNotTestEnv: vi.fn(),
  createWorkerServiceSupabaseClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  })),
}));

vi.mock('../../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

vi.mock('../../config/ServiceConfigManager.js', () => ({
  getAgentMessageQueueConfig: vi.fn(() => ({
    redis: { url: 'redis://localhost:6379' },
    queue: { concurrency: 5, rateLimitMax: 50, rateLimitDuration: 1000 },
  })),
}));

vi.mock('../../observability/queueMetrics.js', () => ({
  attachQueueMetrics: vi.fn(),
}));

const mockUpdateStatus = vi.fn().mockResolvedValue(undefined);
vi.mock('../../services/certificates/CertificateJobRepository.js', () => ({
  CertificateJobRepository: vi.fn(() => ({
    updateStatus: mockUpdateStatus,
  })),
}));

vi.mock('../../workers/tenantContextBootstrap.js', () => ({
  runJobWithTenantContext: vi.fn((_opts, fn) => fn()),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CertificateGenerationWorker', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getCertificateGenerationWorker', () => {
    it('creates a BullMQ Worker on the correct queue', async () => {
      const { getCertificateGenerationWorker } = await import(
        '../CertificateGenerationWorker.js'
      );

      getCertificateGenerationWorker();

      expect(mockWorkerConstructor).toHaveBeenCalledWith(
        'certificate-generation',
        expect.any(Function),
        expect.objectContaining({ concurrency: expect.any(Number) }),
      );
    });

    it('returns the same instance on repeated calls (singleton)', async () => {
      const { getCertificateGenerationWorker } = await import(
        '../CertificateGenerationWorker.js'
      );

      const w1 = getCertificateGenerationWorker();
      const w2 = getCertificateGenerationWorker();

      expect(w1).toBe(w2);
    });
  });

  describe('job processor', () => {
    it('throws when tenantId is missing (tenant isolation guard)', async () => {
      const { getCertificateGenerationWorker } = await import(
        '../CertificateGenerationWorker.js'
      );
      getCertificateGenerationWorker();

      const processorFn = mockWorkerConstructor.mock.calls[0][1];

      await expect(
        processorFn({
          data: {
            organizationId: 'org-1',
            userId: 'user-1',
            jobId: 'job-1',
            certificationId: 'cert-1',
            format: 'pdf',
          },
        }),
      ).rejects.toThrow();
    });

    it('scopes job processing to tenantId and organizationId', async () => {
      const { runJobWithTenantContext } = await import('../../workers/tenantContextBootstrap.js');
      const { getCertificateGenerationWorker } = await import(
        '../CertificateGenerationWorker.js'
      );
      getCertificateGenerationWorker();

      const processorFn = mockWorkerConstructor.mock.calls[0][1];

      // Will throw inside processCertificateJob due to missing DB data — that's fine,
      // we only care that runJobWithTenantContext was called with the correct tenant
      try {
        await processorFn({
          data: {
            tenantId: 'tenant-abc',
            organizationId: 'org-1',
            userId: 'user-1',
            jobId: 'job-1',
            certificationId: 'cert-1',
            format: 'pdf',
          },
        });
      } catch {
        // expected — DB mocks return null data
      }

      expect(runJobWithTenantContext).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-abc',
          organizationId: 'org-1',
          workerName: 'CertificateGenerationWorker',
        }),
        expect.any(Function),
      );
    });

    it('marks job as running before processing', async () => {
      const { getCertificateGenerationWorker } = await import(
        '../CertificateGenerationWorker.js'
      );
      getCertificateGenerationWorker();

      const processorFn = mockWorkerConstructor.mock.calls[0][1];

      try {
        await processorFn({
          data: {
            tenantId: 'tenant-abc',
            organizationId: 'org-1',
            userId: 'user-1',
            jobId: 'job-1',
            certificationId: 'cert-1',
            format: 'pdf',
          },
        });
      } catch {
        // expected
      }

      expect(mockUpdateStatus).toHaveBeenCalledWith('job-1', 'running', undefined, undefined);
    });
  });

  describe('graceful shutdown', () => {
    it('closes the worker on close()', async () => {
      const { getCertificateGenerationWorker } = await import(
        '../CertificateGenerationWorker.js'
      );
      const worker = getCertificateGenerationWorker();

      await worker.close();

      expect(mockWorkerInstance.close).toHaveBeenCalled();
    });
  });
});
