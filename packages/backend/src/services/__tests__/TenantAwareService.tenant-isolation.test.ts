import { describe, expect, it, vi } from 'vitest';
import { TenantAwareService } from '../TenantAwareService.js';

class TestTenantAwareService extends TenantAwareService {
  constructor() {
    super('TestTenantAwareService');
  }

  public async query<T>(table: string, userId: string, filters: Record<string, unknown> = {}) {
    return this.queryWithTenantCheck<T>(table, userId, filters);
  }

  public async validate(userId: string, tenantId: string) {
    return this.validateTenantAccess(userId, tenantId);
  }
}

describe('TenantAwareService tenant isolation acceptance criteria', () => {
  it('binds request identity to tenant-filtered query access', async () => {
    const inMock = vi.fn().mockReturnThis();
    const matchMock = vi.fn().mockResolvedValue({
      data: [{ id: 'wf-1', tenant_id: 'tenant-a', status: 'active' }],
      error: null,
    });

    const tenantQuery = {
      eq: vi
        .fn()
        .mockImplementationOnce(() => tenantQuery)
        .mockResolvedValueOnce({ data: [{ tenant_id: 'tenant-a' }], error: null }),
    };

    const selectMock = vi.fn().mockImplementation((columns: string) => {
      if (columns === 'tenant_id') {
        return tenantQuery;
      }
      return { in: inMock, match: matchMock };
    });

    const fromMock = vi.fn().mockReturnValue({ select: selectMock });

    const service = new TestTenantAwareService();
    (service as unknown as { supabase: { from: typeof fromMock } }).supabase = { from: fromMock };

    const result = await service.query('workflows', 'user-1', { status: 'active' });

    expect(fromMock).toHaveBeenCalledWith('user_tenants');
    expect(tenantQuery.eq).toHaveBeenNthCalledWith(1, 'user_id', 'user-1');
    expect(tenantQuery.eq).toHaveBeenNthCalledWith(2, 'status', 'active');
    expect(inMock).toHaveBeenCalledWith('tenant_id', ['tenant-a']);
    expect(matchMock).toHaveBeenCalledWith({ status: 'active' });
    expect(result).toEqual([{ id: 'wf-1', tenant_id: 'tenant-a', status: 'active' }]);
  });

  it('returns a not-found style error and audits cross-tenant access attempts', async () => {
    const insertMock = vi.fn().mockResolvedValue({ data: null, error: null });
    const tenantQuery = {
      eq: vi
        .fn()
        .mockImplementationOnce(() => tenantQuery)
        .mockResolvedValueOnce({ data: [{ tenant_id: 'tenant-a' }], error: null }),
    };

    const fromMock = vi.fn().mockImplementation((table: string) => {
      if (table === 'security_events') {
        return { insert: insertMock };
      }
      return { select: vi.fn().mockReturnValue(tenantQuery) };
    });

    const service = new TestTenantAwareService();
    (service as unknown as { supabase: { from: typeof fromMock } }).supabase = { from: fromMock };

    await expect(service.validate('user-1', 'tenant-b')).rejects.toMatchObject({
      name: 'NotFoundError',
      code: 'NOT_FOUND',
      statusCode: 404,
    });

    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: 'cross_tenant_access_attempt',
        user_id: 'user-1',
        severity: 'critical',
        details: expect.objectContaining({ attempted_tenant: 'tenant-b', blocked: true }),
      })
    );
  });
});
