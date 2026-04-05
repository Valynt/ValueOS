import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TenantPerformanceManager } from '../TenantPerformanceManager.js';

vi.mock('../../../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
}));

vi.mock('../../monitoring/AgentPerformanceMonitor.js', () => ({
  getAgentPerformanceMonitor: vi.fn(() => ({
    trackRequest: vi.fn(),
  })),
}));

describe('TenantPerformanceManager smoke', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('registers and reads tenant via public API', async () => {
    const manager = new TenantPerformanceManager({ monitoringInterval: 60_000 });
    const tenantId = await manager.registerTenant('Acme', 'acme.com', 'basic');

    const tenant = manager.getTenant(tenantId);
    expect(tenant?.id).toBe(tenantId);
    expect(tenant?.name).toBe('Acme');

    const metrics = manager.getTenantMetrics(tenantId);
    expect(Array.isArray(metrics)).toBe(true);
  });
});
