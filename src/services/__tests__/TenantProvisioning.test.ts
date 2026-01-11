import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { provisionTenant, TenantConfig } from '../TenantProvisioning';

// Mock Supabase client
const mockSupabase = {
  from: vi.fn(),
  select: vi.fn(),
  insert: vi.fn(),
  upsert: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  single: vi.fn(),
  limit: vi.fn(),
};

// Chainable mock implementation
mockSupabase.from.mockImplementation(() => mockSupabase);
mockSupabase.select.mockImplementation(() => mockSupabase);
mockSupabase.insert.mockImplementation(() => mockSupabase);
mockSupabase.upsert.mockImplementation(() => mockSupabase);
mockSupabase.update.mockImplementation(() => mockSupabase);
mockSupabase.eq.mockImplementation(() => mockSupabase);
mockSupabase.single.mockImplementation(() => Promise.resolve({ data: {}, error: null }));
mockSupabase.limit.mockImplementation(() => mockSupabase);

vi.mock('../../lib/supabase', () => ({
  createServerSupabaseClient: () => mockSupabase,
}));

vi.mock('../../config/environment', () => ({
  getConfig: () => ({
    email: { enabled: false },
    features: { billing: false, usageTracking: false },
  }),
}));

vi.mock('../../lib/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe('TenantProvisioning', () => {
  const config: TenantConfig = {
    organizationId: 'test-org-id',
    name: 'Test Org',
    tier: 'starter',
    ownerId: 'test-owner-id',
    ownerEmail: 'owner@example.com',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Default success responses
    mockSupabase.upsert.mockReturnValue(mockSupabase);
    mockSupabase.select.mockReturnValue(mockSupabase);
    mockSupabase.single.mockResolvedValue({ data: { id: 'role-id-123' }, error: null });

    // Mock for roles check (limit call)
    mockSupabase.limit.mockResolvedValue({ data: [{ id: 'role-id-existing' }], error: null });

    // Reset Date mock if needed (vi.useFakeTimers is better than spying on Date directly for constructor)
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T17:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should provision a tenant successfully', async () => {
    const result = await provisionTenant(config);

    expect(result.success).toBe(true);
    expect(result.organizationId).toBe(config.organizationId);

    // Verify Organization Creation (tenants table)
    expect(mockSupabase.from).toHaveBeenCalledWith('tenants');
    expect(mockSupabase.upsert).toHaveBeenCalledWith(expect.objectContaining({
      id: config.organizationId,
      name: config.name,
      status: 'active',
    }));

    // Verify Team Creation
    expect(mockSupabase.from).toHaveBeenCalledWith('teams');
    expect(mockSupabase.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: config.organizationId,
        name: 'Default Team',
      }),
      expect.objectContaining({ onConflict: 'tenant_id,name' })
    );

    // Verify Role Assignment
    // We expect checking for roles (4 times)
    expect(mockSupabase.from).toHaveBeenCalledWith('roles');

    // Verify Owner Assignment
    expect(mockSupabase.from).toHaveBeenCalledWith('user_roles');
  });

  it('should create missing roles', async () => {
    // Mock roles lookup to return empty
    mockSupabase.limit.mockResolvedValue({ data: [], error: null });
    // Mock role creation
    mockSupabase.insert.mockReturnValue(mockSupabase);
    mockSupabase.single.mockResolvedValue({ data: { id: 'new-role-id' }, error: null });

    await provisionTenant(config);

    // Should insert roles
    expect(mockSupabase.insert).toHaveBeenCalledWith(expect.objectContaining({
      name: 'owner',
    }));
    expect(mockSupabase.insert).toHaveBeenCalledWith(expect.objectContaining({
      name: 'admin',
    }));
  });
});
