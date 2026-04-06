import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const createServerSupabaseClientMock = vi.fn();
const usageQueueConsumerWorkerConstructorMock = vi.fn();
const loggerErrorMock = vi.fn();
const loggerInfoMock = vi.fn();
const createServerMock = vi.fn();

vi.mock('../../lib/supabase.js', () => ({
  assertNotTestEnv: vi.fn(),
  createServerSupabaseClient: createServerSupabaseClientMock,
  createServiceRoleSupabaseClient: createServerSupabaseClientMock,
  // Named export used by transitive imports
  supabase: { from: vi.fn() },
}));

vi.mock('../../services/metering/UsageQueueConsumerWorker.js', () => ({
  UsageQueueConsumerWorker: usageQueueConsumerWorkerConstructorMock,
}));

vi.mock('../../lib/logger.js', () => ({
  createLogger: () => ({
    error: loggerErrorMock,
    info: loggerInfoMock,
  }),
}));

vi.mock('http', () => ({
  createServer: createServerMock,
}));

describe('billingAggregatorWorker startup behavior', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('imports without initializing clients or creating network servers', async () => {
    await import('../billingAggregatorWorker.js');

    expect(createServerSupabaseClientMock).not.toHaveBeenCalled();
    expect(usageQueueConsumerWorkerConstructorMock).not.toHaveBeenCalled();
    expect(createServerMock).not.toHaveBeenCalled();
  });

  it('logs and exits with non-zero code when Supabase client construction fails', async () => {
    const startupError = new Error('boom');
    createServerSupabaseClientMock.mockImplementation(() => {
      throw startupError;
    });

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      return undefined as never;
    }) as (code?: string | number | null | undefined) => never);

    const { main } = await import('../billingAggregatorWorker.js');
    await main();

    expect(loggerErrorMock).toHaveBeenCalledWith(
      'Billing aggregator startup failed',
      startupError,
      expect.objectContaining({
        component: 'BillingAggregatorWorker',
        stage: 'initialize',
        error_code: 'BILLING_WORKER_STARTUP_FAILED',
      }),
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(createServerMock).not.toHaveBeenCalled();
  });
});
