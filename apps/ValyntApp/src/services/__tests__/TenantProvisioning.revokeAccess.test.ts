import { describe, it, expect, vi, beforeEach } from 'vitest';
import { integrationControlService } from '../IntegrationControlService';
import { auditLogService } from '../AuditLogService';

// Mock dependencies
vi.mock('../IntegrationControlService', () => ({
  integrationControlService: {
    disableIntegrations: vi.fn(),
    scrubCredentials: vi.fn(),
  },
}));

vi.mock('../AuditLogService', () => ({
  auditLogService: {
    createEntry: vi.fn(),
  },
}));

vi.mock('../lib/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../config/environment', () => ({
  getConfig: vi.fn().mockReturnValue({
    email: { enabled: false },
    features: { billing: false, usageTracking: false },
  }),
  isProduction: vi.fn().mockReturnValue(false),
  isTest: vi.fn().mockReturnValue(true),
  isDevelopment: vi.fn().mockReturnValue(false),
}));

// Mock Supabase
const { mockSupabase } = vi.hoisted(() => {
  const createBuilder = (table: string): any => {
    const builder = {
      select: vi.fn().mockImplementation(() => builder),
      eq: vi.fn().mockImplementation(() => builder),
      in: vi.fn().mockImplementation(() => builder),
      update: vi.fn().mockImplementation(() => builder),
      upsert: vi.fn().mockImplementation(() => builder),
      delete: vi.fn().mockImplementation(() => builder),
      limit: vi.fn().mockImplementation(() => builder),
      order: vi.fn().mockImplementation(() => builder),
      single: vi.fn().mockImplementation(async () => {
        if (table === 'organizations') return { data: { name: 'Test Org' }, error: null };
        return { data: null, error: null };
      }),
      then: (resolve: any) => {
        if (table === 'user_tenants') {
          resolve({ data: [{ user_id: 'user1' }, { user_id: 'user2' }], error: null });
        } else if (table === 'information_schema.tables' || table === 'information_schema.columns') {
          resolve({ data: [], error: null });
        } else {
          resolve({ data: [], error: null });
        }
      },
    };
    return builder;
  };

  return {
    mockSupabase: {
      from: vi.fn().mockImplementation((table) => createBuilder(table)),
      storage: {
        from: vi.fn().mockReturnValue({
          upload: vi.fn().mockResolvedValue({ error: null }),
        }),
      },
      auth: {
        admin: {
          signOut: vi.fn().mockResolvedValue({ error: null }),
        },
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'admin-123' } }, error: null }),
      },
      rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
    },
  };
});

vi.mock('@lib/supabase', () => ({
  supabase: mockSupabase,
  createServerSupabaseClient: vi.fn().mockReturnValue(mockSupabase),
}));

vi.mock('../lib/supabase', () => ({
  supabase: mockSupabase,
  createServerSupabaseClient: vi.fn().mockReturnValue(mockSupabase),
}));

// Import subject
import { deprovisionTenant } from '../TenantProvisioning';

describe('TenantProvisioning - revokeAllAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should disable integrations and scrub credentials', async () => {
    const orgId = 'org-123';
    await deprovisionTenant(orgId);

    expect(integrationControlService.disableIntegrations).toHaveBeenCalledWith(orgId, "Tenant deprovisioned");
    expect(integrationControlService.scrubCredentials).toHaveBeenCalledWith(orgId);
  });

  it('should revoke user memberships', async () => {
    const orgId = 'org-123';
    await deprovisionTenant(orgId);

    expect(mockSupabase.from).toHaveBeenCalledWith('user_tenants');
  });

  it('should attempt global session revocation for members', async () => {
    const orgId = 'org-123';
    await deprovisionTenant(orgId);

    expect(mockSupabase.auth.admin.signOut).toHaveBeenCalledWith('user1');
    expect(mockSupabase.auth.admin.signOut).toHaveBeenCalledWith('user2');
  });

  it('should revoke API keys', async () => {
    const orgId = 'org-123';
    await deprovisionTenant(orgId);

    expect(mockSupabase.from).toHaveBeenCalledWith('api_keys');
  });

  it('should log audit entries', async () => {
    const orgId = 'org-123';
    await deprovisionTenant(orgId);

    expect(auditLogService.createEntry).toHaveBeenCalled();
  });
});
