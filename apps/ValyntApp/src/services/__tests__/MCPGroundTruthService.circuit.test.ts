import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/env', () => ({
  env: { isBrowser: true },
}));

vi.mock('../../lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const executeToolMock = vi.fn();
vi.mock('../../mcp-ground-truth', () => ({
  createDevServer: vi.fn(async () => ({
    executeTool: executeToolMock,
  })),
}));

import { env } from '../../lib/env';
import { logger } from '../../lib/logger';
import { mcpGroundTruthService } from '../MCPGroundTruthService';

describe('MCPGroundTruthService circuit breaker integration', () => {
  const financialsKey = 'external:groundtruth:financials';
  const financialsMcpKey = 'external:groundtruth:mcp:financials';

  beforeEach(() => {
    vi.clearAllMocks();
    (env as any).isBrowser = true;
    (mcpGroundTruthService as any).initialized = false;
    (mcpGroundTruthService as any).initPromise = null;
    (mcpGroundTruthService as any).server = null;

    (mcpGroundTruthService as any).circuitBreaker.reset(financialsKey);
    (mcpGroundTruthService as any).circuitBreaker.reset(financialsMcpKey);
    globalThis.fetch = vi.fn();
    executeToolMock.mockReset();
  });

  it('opens and then closes financials breaker and exposes metrics (browser API mode)', async () => {
    (globalThis.fetch as any)
      .mockResolvedValueOnce({ ok: false, status: 500, text: vi.fn().mockResolvedValue('down') })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ success: true, data: { entityName: 'ACME', entityId: 'ACME', period: 'FY2024', metrics: {}, sources: [] } }),
      });

    const first = await mcpGroundTruthService.getFinancialData({ entityId: 'ACME' });
    expect(first).toBeNull();

    const afterFirst = mcpGroundTruthService.getCircuitBreakerMetrics()[financialsKey];
    expect(afterFirst.state).toBe('open');

    const manager = (mcpGroundTruthService as any).circuitBreaker.manager;
    const state = manager.getState(financialsKey);
    if (state) {
      state.opened_at = new Date(Date.now() - (state.timeout_seconds * 1000 + 1)).toISOString();
    }

    const second = await mcpGroundTruthService.getFinancialData({ entityId: 'ACME' });
    expect(second).not.toBeNull();

    const metrics = mcpGroundTruthService.getCircuitBreakerMetrics()[financialsKey];
    expect(metrics.state).toBe('closed');
    expect(metrics.failedRequests).toBe(1);
    expect(metrics.successfulRequests).toBe(1);
  });

  it('tracks separate breaker keys for verify and benchmarks', async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ success: true, data: { verified: true, confidence: 0.9 } }),
    });

    await mcpGroundTruthService.verifyClaim({ entityId: 'ACME', metric: 'revenue', value: 1 });
    await mcpGroundTruthService.getIndustryBenchmarks('1111', ['margin']);

    const all = mcpGroundTruthService.getCircuitBreakerMetrics();
    expect(all['external:groundtruth:verify'].totalRequests).toBeGreaterThan(0);
    expect(all['external:groundtruth:benchmarks'].totalRequests).toBeGreaterThan(0);
  });

  it('transitions MCP breaker open -> half-open -> closed and returns fallback while open', async () => {
    (env as any).isBrowser = false;
    executeToolMock
      .mockRejectedValueOnce(new Error('503 temporary outage'))
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify({ entity_name: 'ACME', period: 'FY2024', metrics: {}, sources: [] }) }],
      });

    const first = await mcpGroundTruthService.getFinancialData({ entityId: 'ACME' });
    expect(first).toBeNull();

    let metrics = mcpGroundTruthService.getCircuitBreakerMetrics()[financialsMcpKey];
    expect(metrics.state).toBe('open');

    const second = await mcpGroundTruthService.getFinancialData({ entityId: 'ACME' });
    expect(second).toBeNull();
    expect(executeToolMock).toHaveBeenCalledTimes(1);
    expect((logger.warn as any)).toHaveBeenCalledWith(
      'Groundtruth MCP circuit breaker fallback activated',
      expect.objectContaining({ circuitOpen: true, breakerState: 'open', breakerKey: financialsMcpKey })
    );

    const manager = (mcpGroundTruthService as any).circuitBreaker.manager;
    const state = manager.getState(financialsMcpKey);
    if (state) {
      state.opened_at = new Date(Date.now() - (state.timeout_seconds * 1000 + 1)).toISOString();
    }

    const third = await mcpGroundTruthService.getFinancialData({ entityId: 'ACME' });
    expect(third).not.toBeNull();

    metrics = mcpGroundTruthService.getCircuitBreakerMetrics()[financialsMcpKey];
    expect(metrics.state).toBe('closed');
    expect(metrics.failedRequests).toBe(1);
    expect(metrics.successfulRequests).toBe(1);
  });
});
