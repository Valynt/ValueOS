import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createOrganization, TenantConfig } from '../TenantProvisioning.js'

const mocks = vi.hoisted(() => {
  const mockRpc = vi.fn();
  const mockEq = vi.fn();
  const mockUpdate = vi.fn();
  const mockFrom = vi.fn();

  mockFrom.mockReturnValue({
    update: mockUpdate,
  });

  mockUpdate.mockReturnValue({
    eq: mockEq,
  });

  mockEq.mockResolvedValue({ data: null, error: null });
  mockRpc.mockResolvedValue({ data: 'org-123', error: null });

  return {
    mockRpc,
    mockEq,
    mockUpdate,
    mockFrom,
  };
});

vi.mock('../../lib/supabase', () => ({
  createServerSupabaseClient: () => ({
    rpc: mocks.mockRpc,
    from: mocks.mockFrom,
  }),
  supabase: {},
}));

vi.mock('../../lib/logger', () => {
  const loggerMock = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })
}));

vi.mock('../../config/environment', () => ({
  getConfig: () => ({
    features: { billing: false, usageTracking: false },
    email: { enabled: false },
  }),
}));

vi.mock('../billing/CustomerService', () => ({
  default: {
      createCustomer: vi.fn(),
      updatePaymentMethod: vi.fn()
  }
}));

vi.mock('../billing/SubscriptionService', () => ({
  default: {
      createSubscription: vi.fn()
  }
}));

vi.mock('../SettingsService', () => ({
  settingsService: {
    initializeOrganizationSettings: vi.fn()
  }
}));

vi.mock('../EmailService', () => ({
  emailService: {
    send: vi.fn()
  }
}));

vi.mock('../IntegrationControlService', () => ({
  integrationControlService: {
    disableIntegrations: vi.fn(),
    scrubCredentials: vi.fn()
  }
}));

vi.mock('../AuditLogService', () => ({
  auditLogService: {
    createEntry: vi.fn()
  }
}));

describe('TenantProvisioning.createOrganization', () => {
  const config: TenantConfig = {
    organizationId: 'org-123',
    name: 'Test Org',
    tier: 'starter',
    ownerId: 'user-456',
    ownerEmail: 'test@example.com',
    settings: { some: 'setting' },
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mocks.mockRpc.mockResolvedValue({ data: 'org-123', error: null });
    mocks.mockFrom.mockReturnValue({ update: mocks.mockUpdate });
    mocks.mockUpdate.mockReturnValue({ eq: mocks.mockEq });
    mocks.mockEq.mockResolvedValue({ data: null, error: null });
  });

  it('creates organization using provision_tenant rpc and returns canonical org id', async () => {
    const result = await createOrganization(config);

    expect(mocks.mockRpc).toHaveBeenCalledWith('provision_tenant', {
      organization_name: 'Test Org',
      user_id: 'user-456',
    });

    expect(mocks.mockFrom).toHaveBeenCalledWith('organizations');
    expect(mocks.mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      tier: 'professional',
      settings: expect.objectContaining({
        tier: 'starter',
      }),
    }));
    expect(mocks.mockEq).toHaveBeenCalledWith('id', 'org-123');

    expect(result).toBe('org-123');
  });

  it('fails cleanly if provision_tenant rpc fails', async () => {
    mocks.mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'RPC Error' }
    });

    await expect(createOrganization(config)).rejects.toThrow('Failed to create organization: RPC Error');
  });

  it('fails cleanly if organization defaults update fails', async () => {
    mocks.mockEq.mockResolvedValue({
      data: null,
      error: { message: 'Update Error' }
    });

    await expect(createOrganization(config)).rejects.toThrow('Failed to update organization defaults: Update Error');
  });
});
