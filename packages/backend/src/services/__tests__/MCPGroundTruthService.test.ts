import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../ExternalCircuitBreaker.js', () => ({
  ExternalCircuitBreaker: class {
    constructor(_name: string) {}
    execute<T>(_key: string, fn: () => Promise<T>): Promise<T> {
      return fn();
    }
    getMetrics() {
      return {};
    }
  },
}), { virtual: true });

vi.mock('../../lib/env.js', () => ({
  getGroundtruthConfig: () => ({ baseUrl: 'http://localhost:3001', apiKey: '' }),
  isBrowser: () => false,
}));

vi.mock('../../lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../lib/redisClient.js', () => ({
  getRedisClient: vi.fn().mockResolvedValue(null),
}));

type ServiceModule = typeof import('../MCPGroundTruthService.js');

describe('MCPGroundTruthService.enrichQueryWithGroundTruth', () => {
  let mcpGroundTruthService: ServiceModule['mcpGroundTruthService'];

  beforeEach(async () => {
    vi.resetModules();
    ({ mcpGroundTruthService } = await import('../MCPGroundTruthService.js'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('includes only successful contexts and ignores null entity results', async () => {
    const getFinancialDataSpy = vi
      .spyOn(mcpGroundTruthService, 'getFinancialData')
      .mockResolvedValueOnce({
        entityName: 'Alpha Corp',
        entityId: 'AAA',
        period: 'FY2024',
        metrics: {},
        sources: ['SEC'],
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        entityName: 'Gamma Corp',
        entityId: 'CCC',
        period: 'FY2024',
        metrics: {},
        sources: ['SEC'],
      });

    const result = await mcpGroundTruthService.enrichQueryWithGroundTruth('query', ['AAA', 'BBB', 'CCC']);

    expect(getFinancialDataSpy).toHaveBeenCalledTimes(3);
    expect(result).toContain('### Alpha Corp (FY2024)');
    expect(result).toContain('### Gamma Corp (FY2024)');
    expect(result).not.toContain('BBB');
  });

  it('continues when one entity lookup rejects', async () => {
    const getFinancialDataSpy = vi
      .spyOn(mcpGroundTruthService, 'getFinancialData')
      .mockResolvedValueOnce({
        entityName: 'Alpha Corp',
        entityId: 'AAA',
        period: 'FY2024',
        metrics: {},
        sources: ['SEC'],
      })
      .mockRejectedValueOnce(new Error('upstream failed'))
      .mockResolvedValueOnce({
        entityName: 'Gamma Corp',
        entityId: 'CCC',
        period: 'FY2024',
        metrics: {},
        sources: ['SEC'],
      });

    const result = await mcpGroundTruthService.enrichQueryWithGroundTruth('query', ['AAA', 'BBB', 'CCC']);

    expect(getFinancialDataSpy).toHaveBeenCalledTimes(3);
    expect(result).toContain('### Alpha Corp (FY2024)');
    expect(result).toContain('### Gamma Corp (FY2024)');
    expect(result).not.toContain('upstream failed');
  });

  it('limits fetches to the first 3 entities', async () => {
    const getFinancialDataSpy = vi
      .spyOn(mcpGroundTruthService, 'getFinancialData')
      .mockResolvedValue({
        entityName: 'Alpha Corp',
        entityId: 'AAA',
        period: 'FY2024',
        metrics: {},
        sources: ['SEC'],
      });

    await mcpGroundTruthService.enrichQueryWithGroundTruth('query', ['AAA', 'BBB', 'CCC', 'DDD']);

    expect(getFinancialDataSpy).toHaveBeenCalledTimes(3);
    expect(getFinancialDataSpy).toHaveBeenNthCalledWith(1, expect.objectContaining({ entityId: 'AAA' }));
    expect(getFinancialDataSpy).toHaveBeenNthCalledWith(2, expect.objectContaining({ entityId: 'BBB' }));
    expect(getFinancialDataSpy).toHaveBeenNthCalledWith(3, expect.objectContaining({ entityId: 'CCC' }));
  });
});
