import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createOrganization, TenantConfig } from '../TenantProvisioning';

const mocks = vi.hoisted(() => {
  const mockRpc = vi.fn();

  return {
    mockRpc,
  };
});

vi.mock('../../lib/supabase', () => ({
  createServerSupabaseClient: () => ({
    rpc: mocks.mockRpc,
  }),
}));

vi.mock('../../lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../config/environment', () => ({
  getConfig: () => ({
    features: { billing: false, usageTracking: false },
    email: { enabled: false },
  }),
}));

describe('TenantProvisioning.createOrganization', () => {
  const config: TenantConfig = {
    organizationId: 'org-123',
    name: 'Test Org',
    tier: 'starter',
    ownerId: 'd2d084f8-f0d9-4b8c-b5f5-b997c7a6f7f4',
    ownerEmail: 'test@example.com',
    settings: { some: 'setting' },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('invokes provision_tenant RPC and returns tenant UUID', async () => {
    mocks.mockRpc.mockResolvedValueOnce({
      data: '76ec4e0c-56d2-4f81-9fb9-41a80a4ffca4',
      error: null,
    });

    const result = await createOrganization(config);

    expect(mocks.mockRpc).toHaveBeenCalledWith('provision_tenant', {
      organization_name: 'Test Org',
      user_id: 'd2d084f8-f0d9-4b8c-b5f5-b997c7a6f7f4',
    });
    expect(result).toBe('76ec4e0c-56d2-4f81-9fb9-41a80a4ffca4');
  });

  it('fails cleanly if RPC returns error', async () => {
    mocks.mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'DB Error' },
    });

    await expect(createOrganization(config)).rejects.toThrow('Failed to create organization: DB Error');
  });

  it('fails if RPC returns non-string payload', async () => {
    mocks.mockRpc.mockResolvedValueOnce({
      data: { id: 'not-a-string' },
      error: null,
    });

    await expect(createOrganization(config)).rejects.toThrow(
      'Failed to create organization: provisioning RPC returned invalid tenant identifier'
    );
  });
});
