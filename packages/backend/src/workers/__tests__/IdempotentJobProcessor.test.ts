import { describe, expect, it, vi, beforeEach } from 'vitest';

// vi.mock factories are hoisted to the top of the file, so any variables they
// reference must also be hoisted via vi.hoisted().
const { mockRpc } = vi.hoisted(() => ({ mockRpc: vi.fn() }));

// Mock Supabase before importing the module under test.
// The module captures the client at load time, so we must control the rpc
// function on the instance returned by the factory, not swap the factory.
vi.mock('@shared/lib/supabase', () => ({
  createServiceRoleSupabaseClient: vi.fn(() => ({ rpc: mockRpc })),
}));

vi.mock('../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { withIdempotency, generateIdempotencyKey, IdempotentJobProcessor } from '../IdempotentJobProcessor.js';

function makeJob(data: Record<string, unknown> = {}) {
  return { id: 'job-1', name: 'test-job', data } as any;
}

/** Configure mockRpc to allow processing and succeed on mark */
function allowProcessing() {
  mockRpc.mockImplementation((fn: string) => {
    if (fn === 'check_job_idempotency_status') {
      return Promise.resolve({ data: { should_process: true }, error: null });
    }
    if (fn === 'mark_job_processed') {
      return Promise.resolve({ error: null });
    }
    return Promise.resolve({ data: null, error: null });
  });
}

/** Configure mockRpc to report the job as already processed (duplicate) */
function blockProcessing() {
  mockRpc.mockImplementation((fn: string) => {
    if (fn === 'check_job_idempotency_status') {
      return Promise.resolve({ data: { should_process: false }, error: null });
    }
    return Promise.resolve({ error: null });
  });
}

describe('withIdempotency', () => {
  beforeEach(() => {
    mockRpc.mockReset();
    allowProcessing();
  });

  it('calls the processor when shouldProcess is true', async () => {
    const processor = vi.fn().mockResolvedValue('done');
    const wrapped = withIdempotency('test-queue', processor);

    await wrapped(makeJob({ tenantId: 'tenant-1' }));

    expect(processor).toHaveBeenCalledOnce();
  });

  it('skips the processor when shouldProcess is false (duplicate)', async () => {
    blockProcessing();

    const processor = vi.fn().mockResolvedValue('done');
    const wrapped = withIdempotency('test-queue', processor);

    await wrapped(makeJob({ tenantId: 'tenant-1' }));

    expect(processor).not.toHaveBeenCalled();
  });

  it('marks job processed after successful execution', async () => {
    const processor = vi.fn().mockResolvedValue('result');
    const wrapped = withIdempotency('test-queue', processor);

    await wrapped(makeJob({ tenantId: 'tenant-1' }));

    const markCall = mockRpc.mock.calls.find(([fn]) => fn === 'mark_job_processed');
    expect(markCall).toBeDefined();
    expect(markCall![1]).toMatchObject({ p_result_status: 'completed' });
  });

  it('does NOT mark job processed when processor throws — allows BullMQ retry', async () => {
    const processor = vi.fn().mockRejectedValue(new Error('transient failure'));
    const wrapped = withIdempotency('test-queue', processor);

    await expect(wrapped(makeJob({ tenantId: 'tenant-1' }))).rejects.toThrow('transient failure');

    const markCall = mockRpc.mock.calls.find(([fn]) => fn === 'mark_job_processed');
    expect(markCall).toBeUndefined();
  });

  it('re-throws the original error on failure', async () => {
    const originalError = new Error('specific error message');
    const processor = vi.fn().mockRejectedValue(originalError);
    const wrapped = withIdempotency('test-queue', processor);

    await expect(wrapped(makeJob())).rejects.toThrow('specific error message');
  });
});

describe('IdempotentJobProcessor.handleJob', () => {
  beforeEach(() => {
    mockRpc.mockReset();
    allowProcessing();
  });

  /**
   * Concrete subclass that delegates to an injected spy, letting each test
   * control success/failure without subclassing per test.
   */
  class TestProcessor extends IdempotentJobProcessor<Record<string, unknown>> {
    constructor(public readonly spy: ReturnType<typeof vi.fn>) {
      super('test-queue', { enabled: true });
    }
    protected async processJob(job: Parameters<typeof this.spy>[0]): Promise<unknown> {
      return this.spy(job);
    }
  }

  it('calls processJob when shouldProcess is true', async () => {
    const spy = vi.fn().mockResolvedValue('done');
    const processor = new TestProcessor(spy);

    await processor.handleJob(makeJob({ tenantId: 'tenant-1' }));

    expect(spy).toHaveBeenCalledOnce();
  });

  it('skips processJob when shouldProcess is false (duplicate)', async () => {
    blockProcessing();
    const spy = vi.fn().mockResolvedValue('done');
    const processor = new TestProcessor(spy);

    await processor.handleJob(makeJob({ tenantId: 'tenant-1' }));

    expect(spy).not.toHaveBeenCalled();
  });

  it('marks job processed after successful execution', async () => {
    const spy = vi.fn().mockResolvedValue('result');
    const processor = new TestProcessor(spy);

    await processor.handleJob(makeJob({ tenantId: 'tenant-1' }));

    const markCall = mockRpc.mock.calls.find(([fn]) => fn === 'mark_job_processed');
    expect(markCall).toBeDefined();
    expect(markCall![1]).toMatchObject({ p_result_status: 'completed' });
  });

  it('does NOT mark job processed when processJob throws — allows BullMQ retry', async () => {
    const spy = vi.fn().mockRejectedValue(new Error('transient failure'));
    const processor = new TestProcessor(spy);

    await expect(processor.handleJob(makeJob({ tenantId: 'tenant-1' }))).rejects.toThrow('transient failure');

    const markCall = mockRpc.mock.calls.find(([fn]) => fn === 'mark_job_processed');
    expect(markCall).toBeUndefined();
  });

  it('re-throws the original error on failure', async () => {
    const spy = vi.fn().mockRejectedValue(new Error('specific error'));
    const processor = new TestProcessor(spy);

    await expect(processor.handleJob(makeJob())).rejects.toThrow('specific error');
  });
});

describe('generateIdempotencyKey', () => {
  it('produces a deterministic key for the same inputs', () => {
    const key1 = generateIdempotencyKey('q', 'job', { a: 1, b: 2 });
    const key2 = generateIdempotencyKey('q', 'job', { a: 1, b: 2 });
    expect(key1).toBe(key2);
  });

  it('produces different keys for different job data', () => {
    const key1 = generateIdempotencyKey('q', 'job', { a: 1 });
    const key2 = generateIdempotencyKey('q', 'job', { a: 2 });
    expect(key1).not.toBe(key2);
  });

  it('respects keyFields to scope the key to specific fields', () => {
    const key1 = generateIdempotencyKey('q', 'job', { a: 1, noise: Math.random() }, ['a']);
    const key2 = generateIdempotencyKey('q', 'job', { a: 1, noise: Math.random() }, ['a']);
    expect(key1).toBe(key2);
  });
});
