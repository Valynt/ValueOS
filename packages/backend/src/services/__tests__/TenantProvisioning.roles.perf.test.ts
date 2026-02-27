import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTeamsAndRoles, TenantConfig } from '../TenantProvisioning.js'

// Define mocks using vi.hoisted
const mocks = vi.hoisted(() => {
  const mockSingle = vi.fn();
  const mockMaybeSingle = vi.fn();
  const mockEq = vi.fn();
  const mockSelect = vi.fn();
  const mockInsert = vi.fn();
  const mockUpsert = vi.fn();
  const mockFrom = vi.fn();
  const mockLimit = vi.fn();
  const mockIn = vi.fn();

  // Setup default return values for chain
  mockFrom.mockReturnValue({
    insert: mockInsert,
    select: mockSelect,
    upsert: mockUpsert,
  });
  mockUpsert.mockReturnValue({
    select: mockSelect,
  });
  mockInsert.mockReturnValue({
    select: mockSelect,
    single: mockSingle,
  });
  mockSelect.mockReturnValue({
    single: mockSingle,
    maybeSingle: mockMaybeSingle,
    eq: mockEq,
    limit: mockLimit,
    in: mockIn,
  });
  mockEq.mockReturnValue({
    single: mockSingle,
    maybeSingle: mockMaybeSingle,
    limit: mockLimit,
    eq: mockEq, // Chainable eq
  });
  mockLimit.mockReturnValue({
     single: mockSingle,
     maybeSingle: mockMaybeSingle,
  });
  mockIn.mockReturnValue({
     select: mockSelect,
     then: (resolve) => resolve({ data: [], error: null }), // Make awaitable default
  });

  mockSingle.mockResolvedValue({ data: {}, error: null });
  mockMaybeSingle.mockResolvedValue({ data: {}, error: null });

  return {
    mockSingle,
    mockMaybeSingle,
    mockEq,
    mockSelect,
    mockInsert,
    mockUpsert,
    mockFrom,
    mockLimit,
    mockIn
  };
});

// Mock Supabase
vi.mock('../../lib/supabase', () => ({
  createServerSupabaseClient: () => ({
    from: mocks.mockFrom,
  }),
}));

// Mock Logger
vi.mock('../../lib/logger', () => ({
  logger: {
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

// Mock Config
vi.mock('../../config/environment', () => ({
  getConfig: () => ({
    features: { billing: false, usageTracking: false },
    email: { enabled: false },
  }),
}));

// Mock other services to avoid broken imports
vi.mock('../billing/CustomerService', () => ({ default: {} }));
vi.mock('../billing/SubscriptionService', () => ({ default: {} }));
vi.mock('../EmailService', () => ({ emailService: {} }));
vi.mock('../SettingsService', () => ({ settingsService: {} }));
vi.mock('../IntegrationControlService', () => ({ integrationControlService: {} }));
vi.mock('../AuditLogService', () => ({ auditLogService: {} }));

describe('TenantProvisioning.createTeamsAndRoles Performance', () => {
  const config: TenantConfig = {
    organizationId: 'org-123',
    name: 'Test Org',
    tier: 'starter',
    ownerId: 'user-456',
    ownerEmail: 'test@example.com',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset chain mocks
    mocks.mockFrom.mockReturnValue({
        insert: mocks.mockInsert,
        select: mocks.mockSelect,
        upsert: mocks.mockUpsert,
    });

    // Ensure mockSingle/mockLimit returns promise
    mocks.mockSingle.mockResolvedValue({ data: {}, error: null });
  });

  it('verifies optimized performance (reduced queries)', async () => {
    // Setup 'Default Team' upsert success
    mocks.mockSingle.mockResolvedValueOnce({ data: { id: 'team-1' }, error: null });

    // Setup roles check (BULK FETCH)
    mocks.mockIn.mockResolvedValueOnce({
        data: [
            { id: 'role-owner', name: 'owner' },
            { id: 'role-admin', name: 'admin' },
            { id: 'role-member', name: 'member' },
            { id: 'role-viewer', name: 'viewer' }
        ],
        error: null
    });

    // Setup owner assignment
    // Check user role: .single()
    mocks.mockSingle.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } }); // Not found

    // Insert user role: .insert(...) -> which returns a builder, usually we await it or .select().
    mocks.mockInsert.mockResolvedValueOnce({ error: null });

    await createTeamsAndRoles(config);

    // Count calls to `from('roles')`
    const roleTableCalls = mocks.mockFrom.mock.calls.filter(call => call[0] === 'roles');
    expect(roleTableCalls.length).toBe(1); // 1 bulk check

    // Count calls to `from('user_roles')`
    const userRoleTableCalls = mocks.mockFrom.mock.calls.filter(call => call[0] === 'user_roles');
    expect(userRoleTableCalls.length).toBe(2); // check + insert
  });
});
