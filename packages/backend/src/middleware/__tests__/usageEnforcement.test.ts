import type { NextFunction, Request, Response } from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockCheckUsageAllowed = vi.fn();
const mockWarn = vi.fn();
const mockError = vi.fn();
const mockDebug = vi.fn();
const mockCounterAdd = vi.fn();

vi.mock('../../services/billing/EntitlementsService.js', () => ({
  EntitlementsService: vi.fn().mockImplementation(() => ({
    checkUsageAllowed: mockCheckUsageAllowed,
  })),
}));

vi.mock('../../lib/logger.js', () => ({
  createLogger: vi.fn().mockReturnValue({
    warn: mockWarn,
    error: mockError,
    debug: mockDebug,
    info: vi.fn(),
  }),
}));

vi.mock('../../services/lib/observability/index.js', () => ({
  createCounter: vi.fn().mockReturnValue({
    add: mockCounterAdd,
  }),
}));

vi.mock('@shared/lib/supabase', () => ({
  createServiceRoleSupabaseClient: vi.fn(),
  assertNotTestEnv: vi.fn(),
  getRequestSupabaseClient: vi.fn(() => ({ from: vi.fn() })),
}));

describe('usageEnforcementMiddleware fail-open controls', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete process.env.USAGE_ENFORCEMENT_FAIL_OPEN;
  });

  afterEach(() => {
    delete process.env.USAGE_ENFORCEMENT_FAIL_OPEN;
  });

  it('fails closed by default when entitlements dependency check throws', async () => {
    mockCheckUsageAllowed.mockRejectedValueOnce(new Error('dependency unavailable'));

    const { usageEnforcementMiddleware } = await import('../usageEnforcement.js');
    const middleware = usageEnforcementMiddleware({ metric: 'api_calls' });

    const status = vi.fn().mockReturnThis();
    const json = vi.fn();
    const req = {
      tenantId: 'tenant-a',
      userId: 'user-a',
      path: '/api/workflows',
      route: { path: '/api/workflows' },
    } as Request;
    const res = { status, json } as unknown as Response;
    const next = vi.fn() as NextFunction;

    await middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(503);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        allowed: false,
        reason: 'entitlements_dependency_unavailable',
        reason_code: 'ENTITLEMENTS_DEPENDENCY_UNAVAILABLE',
        meter_key: 'api_calls',
        retryable: true,
      })
    );
  });

  it('permits request only when fail-open override is explicitly enabled and emits security telemetry', async () => {
    process.env.USAGE_ENFORCEMENT_FAIL_OPEN = 'true';
    mockCheckUsageAllowed.mockRejectedValueOnce(new Error('dependency unavailable'));

    const { usageEnforcementMiddleware } = await import('../usageEnforcement.js');
    const middleware = usageEnforcementMiddleware({ metric: 'llm_tokens' });

    const status = vi.fn().mockReturnThis();
    const json = vi.fn();
    const req = {
      tenantId: 'tenant-b',
      userId: 'user-b',
      path: '/api/agents/run',
      route: { path: '/api/agents/run' },
    } as Request;
    const res = { status, json } as unknown as Response;
    const next = vi.fn() as NextFunction;

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(status).not.toHaveBeenCalled();
    expect(json).not.toHaveBeenCalled();
    expect(mockWarn).toHaveBeenCalledWith(
      'Usage enforcement fail-open override active; permitting request despite entitlement dependency failure',
      expect.objectContaining({
        tenantId: 'tenant-b',
        route: '/api/agents/run',
        metric: 'llm_tokens',
        reason: 'entitlements_dependency_unavailable',
      })
    );
    expect(mockCounterAdd).toHaveBeenCalledWith(1, {
      metric: 'llm_tokens',
      tenant_id: 'tenant-b',
      route: '/api/agents/run',
    });
  });
});
