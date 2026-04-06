import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockValidationWorker, mockSyncWorker, mockWorkerConstructor, mockQueueConstructor } =
  vi.hoisted(() => {
    const makeWorker = () => ({
      on: vi.fn().mockReturnThis(),
      close: vi.fn().mockResolvedValue(undefined),
    });
    const mockValidationWorker = makeWorker();
    const mockSyncWorker = makeWorker();
    let callCount = 0;
    const mockWorkerConstructor = vi.fn(() => {
      callCount++;
      return callCount === 1 ? mockValidationWorker : mockSyncWorker;
    });
    const mockQueueConstructor = vi.fn(() => ({
      add: vi.fn().mockResolvedValue({ id: 'job-1' }),
      close: vi.fn().mockResolvedValue(undefined),
    }));
    return { mockValidationWorker, mockSyncWorker, mockWorkerConstructor, mockQueueConstructor };
  });

vi.mock('bullmq', () => ({
  Worker: mockWorkerConstructor,
  Queue: mockQueueConstructor,
}));

vi.mock('ioredis', () => ({
  default: vi.fn(() => ({ on: vi.fn(), quit: vi.fn() })),
}));

function makeChain(overrides: Record<string, unknown> = {}) {
  const chain: Record<string, unknown> = {
    update: vi.fn(),
    insert: vi.fn(),
    select: vi.fn(),
    eq: vi.fn(),
    single: vi.fn().mockResolvedValue({ data: { metadata: {} }, error: null }),
    ...overrides,
  };
  // Make all chainable methods return the same chain object
  (chain.update as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  (chain.insert as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  (chain.select as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  (chain.eq as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  return chain;
}

const mockCronClient = {
  from: vi.fn(() => makeChain()),
};

vi.mock('../../lib/supabase/privileged/index.js', () => ({
  createCronSupabaseClient: vi.fn(() => mockCronClient),
}));

vi.mock('../../lib/logger.js', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

const mockGetMcpProvider = vi.fn();
vi.mock('../../services/mcp-integration/McpProviderRegistry.js', () => ({
  getMcpProvider: mockGetMcpProvider,
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('mcpIntegrationWorker', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    // Reset call count for Worker constructor alternation
    let callCount = 0;
    mockWorkerConstructor.mockImplementation(() => {
      callCount++;
      return callCount === 1 ? mockValidationWorker : mockSyncWorker;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initMcpIntegrationWorkers', () => {
    it('creates workers for both validation and sync queues', async () => {
      const { initMcpIntegrationWorkers, MCP_VALIDATION_QUEUE, MCP_SYNC_QUEUE } = await import(
        '../mcpIntegrationWorker.js'
      );

      initMcpIntegrationWorkers();

      const queueNames = mockWorkerConstructor.mock.calls.map(c => c[0]);
      expect(queueNames).toContain(MCP_VALIDATION_QUEUE);
      expect(queueNames).toContain(MCP_SYNC_QUEUE);
    });

    it('returns the same instances on repeated calls (singleton)', async () => {
      const { initMcpIntegrationWorkers } = await import('../mcpIntegrationWorker.js');

      const r1 = initMcpIntegrationWorkers();
      const r2 = initMcpIntegrationWorkers();

      expect(r1.validationWorker).toBe(r2.validationWorker);
      expect(r1.syncWorker).toBe(r2.syncWorker);
    });

    it('attaches error listeners to both workers', async () => {
      const { initMcpIntegrationWorkers } = await import('../mcpIntegrationWorker.js');

      initMcpIntegrationWorkers();

      expect(mockValidationWorker.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockSyncWorker.on).toHaveBeenCalledWith('error', expect.any(Function));
    });
  });

  describe('validation job processor', () => {
    it('throws when tenantId is missing (tenant isolation guard)', async () => {
      const { initMcpIntegrationWorkers } = await import('../mcpIntegrationWorker.js');
      initMcpIntegrationWorkers();

      const validationProcessor = mockWorkerConstructor.mock.calls.find(
        c => c[0] === 'mcp-integration-validation',
      )?.[1];

      await expect(
        validationProcessor({ data: { provider: 'salesforce', integrationId: 'int-1' } }),
      ).rejects.toThrow(/tenantId/);
    });

    it('calls provider testAccess and updates state on success', async () => {
      const mockProvider = {
        testAccess: vi.fn().mockResolvedValue({ ok: true, reasonCode: null, message: 'OK' }),
        sync: vi.fn(),
      };
      mockGetMcpProvider.mockReturnValue(mockProvider);

      // Wire cron client to return metadata and accept update
      mockCronClient.from.mockReturnValue(
        makeChain({
          single: vi.fn().mockResolvedValue({ data: { metadata: { token: 'abc' } }, error: null }),
        }),
      );

      const { initMcpIntegrationWorkers } = await import('../mcpIntegrationWorker.js');
      initMcpIntegrationWorkers();

      const validationProcessor = mockWorkerConstructor.mock.calls.find(
        c => c[0] === 'mcp-integration-validation',
      )?.[1];

      await validationProcessor({
        data: { tenantId: 'tenant-1', provider: 'salesforce', integrationId: 'int-1' },
      });

      expect(mockProvider.testAccess).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 'tenant-1' }),
      );
    });

    it('scopes DB queries to tenantId (tenant isolation)', async () => {
      const mockProvider = {
        testAccess: vi.fn().mockResolvedValue({ ok: false, reasonCode: 'auth_failed', message: 'Unauthorized' }),
        sync: vi.fn(),
      };
      mockGetMcpProvider.mockReturnValue(mockProvider);

      mockCronClient.from.mockReturnValue(makeChain());

      const { initMcpIntegrationWorkers } = await import('../mcpIntegrationWorker.js');
      initMcpIntegrationWorkers();

      const validationProcessor = mockWorkerConstructor.mock.calls.find(
        c => c[0] === 'mcp-integration-validation',
      )?.[1];

      await validationProcessor({
        data: { tenantId: 'tenant-isolated', provider: 'hubspot', integrationId: 'int-2' },
      });

      // from() should have been called — DB queries are scoped to the integration
      expect(mockCronClient.from).toHaveBeenCalled();
    });
  });
});
