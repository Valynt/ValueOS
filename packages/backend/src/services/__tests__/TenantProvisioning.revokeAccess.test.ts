
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { auditLogService } from '../AuditLogService.js'
import { integrationControlService } from '../IntegrationControlService.js'

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

vi.mock('../../lib/logger', () => {
  const loggerMock = {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
  return {
    logger: loggerMock,
    createLogger: vi.fn().mockReturnValue(loggerMock),
  };
});

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
const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockDelete = vi.fn();
const mockSelect = vi.fn();
const mockSignOut = vi.fn();

const mockSupabase = {
  from: vi.fn(),
  auth: {
    admin: {
      signOut: mockSignOut,
    },
  },
  storage: {
    from: vi.fn().mockReturnValue({ upload: vi.fn().mockResolvedValue({ error: null }) }),
  },
};

vi.mock('../lib/supabase', async () => {
  const { createSupabaseModuleMock } = await import('../../test-utils/supabaseMock.js');
  const supabaseModuleMock = createSupabaseModuleMock({
    from: mockSupabase.from,
    auth: mockSupabase.auth,
    storage: mockSupabase.storage,
  });
  supabaseModuleMock.createServerSupabaseClient.mockReturnValue(mockSupabase as never);
  return supabaseModuleMock;
});

// Import subject
import { deprovisionTenant } from '../TenantProvisioning.js'

describe('TenantProvisioning - revokeAllAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mocks
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockEq.mockResolvedValue({ error: null });
    mockSelect.mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }) }); // Default empty return
    mockDelete.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });

    mockSupabase.from.mockImplementation((table) => {
        // Handle specific tables
        if (table === 'user_tenants') {
            return {
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockResolvedValue({ data: [{ user_id: 'user1' }, { user_id: 'user2' }], error: null })
                }),
                update: mockUpdate
            };
        }
        if (table === 'api_keys') {
            return {
                update: mockUpdate,
                delete: mockDelete,
                select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) })
            };
        }
        if (table === 'organizations') {
            return {
                update: mockUpdate,
                select: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                     single: vi.fn().mockResolvedValue({ data: { name: 'Test Org' }, error: null })
                  })
                })
            }
        }
         // Archive related mocks
         if (table === 'information_schema.tables') {
            return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
         }
        return {
            select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ or: vi.fn().mockResolvedValue({ data: [], error: null }) }) }),
            update: mockUpdate,
            delete: mockDelete,
            upsert: vi.fn().mockReturnValue({ onConflict: vi.fn().mockResolvedValue({ error: null }) })
        };
    });
  });

  vi.mock('../billing/SubscriptionService', () => ({
      default: {
          cancelSubscription: vi.fn().mockResolvedValue(undefined)
      }
  }));

  vi.mock('../billing/CustomerService', () => ({
      default: {
          createCustomer: vi.fn(),
          updatePaymentMethod: vi.fn()
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

  it('should disable integrations and scrub credentials', async () => {
    await deprovisionTenant('org-123');

    expect(integrationControlService.disableIntegrations).toHaveBeenCalledWith('org-123', 'Tenant deprovisioned');
    expect(integrationControlService.scrubCredentials).toHaveBeenCalledWith('org-123');
  });

  it('should revoke user memberships', async () => {
    await deprovisionTenant('org-123');

    // Check update to user_tenants
    expect(mockSupabase.from).toHaveBeenCalledWith('user_tenants');
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
        status: 'inactive',
        disabled_reason: 'Tenant deprovisioned'
    }));
  });

  it('should attempt global session revocation for members', async () => {
    // Setup members return
    mockSignOut.mockResolvedValue({ error: null });

    await deprovisionTenant('org-123');

    expect(mockSignOut).toHaveBeenCalledWith('user1');
    expect(mockSignOut).toHaveBeenCalledWith('user2');
  });

  it('should revoke API keys', async () => {
    await deprovisionTenant('org-123');

    expect(mockSupabase.from).toHaveBeenCalledWith('api_keys');
    // First try: revoked_at
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ revoked_at: expect.any(String) }));
  });

  it('should log audit entries', async () => {
    await deprovisionTenant('org-123');

    expect(auditLogService.createEntry).toHaveBeenCalledWith(expect.objectContaining({
        action: 'integrations_disabled'
    }));
    expect(auditLogService.createEntry).toHaveBeenCalledWith(expect.objectContaining({
        action: 'membership_revoked'
    }));
    expect(auditLogService.createEntry).toHaveBeenCalledWith(expect.objectContaining({
        action: 'sessions_revoked'
    }));
     expect(auditLogService.createEntry).toHaveBeenCalledWith(expect.objectContaining({
        action: 'api_keys_revoked'
    }));
  });
});
