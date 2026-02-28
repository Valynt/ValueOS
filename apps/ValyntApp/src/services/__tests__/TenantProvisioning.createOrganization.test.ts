
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createOrganization, TenantConfig } from '../TenantProvisioning';

// Define mocks using vi.hoisted to ensure they are available before imports
const mocks = vi.hoisted(() => {
  const mockSingle = vi.fn();
  const mockEq = vi.fn();
  const mockSelect = vi.fn();
  const mockInsert = vi.fn();
  const mockUpdate = vi.fn();
  const mockFrom = vi.fn();

  // Setup default return values for chain
  mockFrom.mockReturnValue({
    insert: mockInsert,
    select: mockSelect,
    update: mockUpdate,
  });
  mockInsert.mockReturnValue({
    select: mockSelect,
  });
  mockSelect.mockReturnValue({
    single: mockSingle,
    eq: mockEq,
  });
  mockEq.mockReturnValue({
    single: mockSingle,
    maybeSingle: mockSingle,
  });
  mockSingle.mockResolvedValue({ data: {}, error: null });

  return {
    mockSingle,
    mockEq,
    mockSelect,
    mockInsert,
    mockUpdate,
    mockFrom,
  };
});

// Mock Supabase using the hoisted mocks
vi.mock('../../lib/supabase', () => ({
  createServerSupabaseClient: () => ({
    from: mocks.mockFrom,
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

// Mock config to prevent actual config loading which might fail or check env vars
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
    ownerId: 'user-456',
    ownerEmail: 'test@example.com',
    settings: { some: 'setting' },
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset chain mocks default behavior
    mocks.mockFrom.mockReturnValue({
        insert: mocks.mockInsert,
        select: mocks.mockSelect,
    });
    mocks.mockInsert.mockReturnValue({
        select: mocks.mockSelect,
    });
    mocks.mockSelect.mockReturnValue({
        single: mocks.mockSingle,
        eq: mocks.mockEq,
    });
    mocks.mockEq.mockReturnValue({
      single: mocks.mockSingle,
    });
  });

  it('successfully creates organization and owner membership and returns org', async () => {
    // Setup org insert success
    const mockOrg = { id: 'org-123', name: 'Test Org' };
    mocks.mockSingle.mockResolvedValueOnce({
      data: mockOrg,
      error: null
    });

    // Setup membership insert success
    mocks.mockSingle.mockResolvedValueOnce({
      data: { id: 'membership-789' },
      error: null
    });

    const result = await createOrganization(config);

    // Verify organizations insert
    expect(mocks.mockFrom).toHaveBeenCalledWith('organizations');
    expect(mocks.mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      id: 'org-123',
      tenant_id: 'org-123',
      name: 'Test Org',
      tier: 'professional', // mapped from starter
      is_active: true,
    }));

    // Verify user_tenants insert
    expect(mocks.mockFrom).toHaveBeenCalledWith('user_tenants');
    expect(mocks.mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'user-456',
      tenant_id: 'org-123',
      status: 'active',
      role: 'owner',
    }));

    // Verify return value
    expect(result).toBe(mockOrg);
  });

  it('fails cleanly if organization creation fails', async () => {
    mocks.mockSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'DB Error' }
    });

    await expect(createOrganization(config)).rejects.toThrow('Failed to create organization: DB Error');

    // Should NOT attempt membership insert
    expect(mocks.mockFrom).toHaveBeenCalledTimes(1);
    expect(mocks.mockFrom).toHaveBeenCalledWith('organizations');
  });

  it('fails if membership creation fails', async () => {
    // Org success
    mocks.mockSingle.mockResolvedValueOnce({
      data: { id: 'org-123' },
      error: null
    });

    // Membership fail
    mocks.mockSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'Membership Error' }
    });

    await expect(createOrganization(config)).rejects.toThrow('Organization created but failed to assign owner membership: Membership Error');
  });

  it('handles idempotency: if org exists, proceeds to membership', async () => {
    // Org insert fail with 409 (Conflict) - implied by error code or check
    mocks.mockSingle.mockResolvedValueOnce({
      data: null,
      error: { code: '23505', message: 'Duplicate key' }
    });

    // We expect the code to fetch the existing org
    const existingOrg = { id: 'org-123', tenant_id: 'org-123' };
    mocks.mockSingle.mockResolvedValueOnce({
        data: existingOrg,
        error: null
    });

    // Then membership insert success
    mocks.mockSingle.mockResolvedValueOnce({
      data: { id: 'membership-789' },
      error: null
    });

    const result = await createOrganization(config);

    // 1. Insert Org (failed)
    expect(mocks.mockFrom).toHaveBeenNthCalledWith(1, 'organizations');

    // 2. Select Org (recovery)
    expect(mocks.mockFrom).toHaveBeenNthCalledWith(2, 'organizations');
    expect(mocks.mockSelect).toHaveBeenCalled();

    // 3. Insert Membership
    expect(mocks.mockFrom).toHaveBeenNthCalledWith(3, 'user_tenants');

    // Should return existing org
    expect(result).toBe(existingOrg);
  });
});
