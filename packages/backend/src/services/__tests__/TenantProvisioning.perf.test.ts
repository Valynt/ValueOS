
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { emailService } from '../EmailService.js';
import { deprovisionTenant } from '../tenant/TenantProvisioning.js';

// Mock dependencies
vi.mock('./EmailService', () => ({
  emailService: {
    send: vi.fn(),
  },
}));

vi.mock('../lib/logger', () => {
    const loggerMock = {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    };
    return {
        logger: loggerMock,
        createLogger: vi.fn().mockReturnValue(loggerMock)
    }
});

// Mock config
vi.mock('../config/environment', () => ({
  getConfig: vi.fn().mockReturnValue({
    email: { enabled: true },
    features: { billing: true, usageTracking: true },
  }),
}));

vi.mock('./billing/SubscriptionService', () => ({
    default: {
        cancelSubscription: vi.fn().mockResolvedValue(undefined)
    }
}));

vi.mock('./billing/CustomerService', () => ({
    default: {
        createCustomer: vi.fn(),
        updatePaymentMethod: vi.fn()
    }
}));

vi.mock('./SettingsService', () => ({
    settingsService: {
        initializeOrganizationSettings: vi.fn()
    }
}));

vi.mock('./IntegrationControlService', () => ({
    integrationControlService: {
        disableIntegrations: vi.fn().mockResolvedValue(undefined),
        scrubCredentials: vi.fn().mockResolvedValue(5)
    }
}));

vi.mock('./AuditLogService', () => ({
    auditLogService: {
        createEntry: vi.fn().mockResolvedValue(undefined)
    }
}));


const { mockSupabase } = vi.hoisted(() => {
  const mockSupabase = {
    from: vi.fn(),
    storage: { from: vi.fn().mockReturnValue({ upload: vi.fn().mockResolvedValue({ error: null }) }) },
    auth: { admin: { signOut: vi.fn() } }
  };
  return { mockSupabase };
});

vi.mock('../lib/supabase', () => ({
  createServerSupabaseClient: vi.fn().mockReturnValue(mockSupabase),
}));

describe('TenantProvisioning Performance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('measures deprovisioning time', async () => {
    const orgId = 'org-perf-test';
    const LATENCY_MS = 20;

    // List of tables expected to be processed (from TenantProvisioning.ts)
    const tables = [
      'organizations', 'tenants', 'user_tenants', 'user_roles', 'users',
      'api_keys', 'audit_logs', 'cases', 'workflows', 'workflow_states',
      'shared_artifacts', 'agents', 'agent_runs', 'agent_memory', 'models',
      'kpis', 'messages', 'security_audit_events'
    ];

    // Mock sequence of Supabase calls
    mockSupabase.from.mockImplementation((table) => {
        // 1. Initial schema check
        if (table === 'information_schema.tables') {
             return {
                 select: vi.fn().mockReturnValue({
                     eq: vi.fn().mockResolvedValue({
                         data: tables.map(t => ({ table_name: t })),
                         error: null
                    })
                })
            };
        }

        // 2. Column checks
        if (table === 'information_schema.columns') {
             return {
                 select: vi.fn().mockReturnValue({
                     eq: vi.fn().mockReturnValue({
                         eq: vi.fn().mockResolvedValue({
                             data: [
                                 { column_name: 'id' },
                                 { column_name: 'tenant_id' },
                                 { column_name: 'organization_id' },
                                 { column_name: 'is_archived' }, // Trigger update
                                 { column_name: 'archived_at' }
                            ],
                             error: null
                        })
                    })
                })
            };
        }

        // 3. Organization check
        if (table === 'organizations') {
            return {
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        single: vi.fn().mockResolvedValue({ data: { name: 'Perf Org' }, error: null })
                    })
                }),
                update: vi.fn().mockReturnValue({
                    eq: vi.fn().mockImplementation(async () => {
                        await new Promise(r => setTimeout(r, LATENCY_MS));
                        return { error: null };
                    })
                })
            }
        }

        // 4. Archive Update Simulation
        // This is what we want to optimize. We add latency here.
        if (tables.includes(table)) {
             return {
                select: vi.fn().mockReturnValue({
                     // Mock returning some data to be archived
                     eq: vi.fn().mockResolvedValue({ data: [{id: '1', metadata: {}}], error: null }),
                     or: vi.fn().mockResolvedValue({ data: [{id: '1', metadata: {}}], error: null })
                }),
                update: vi.fn().mockReturnValue({
                    eq: vi.fn().mockImplementation(async () => {
                        await new Promise(r => setTimeout(r, LATENCY_MS));
                        return { error: null };
                    }),
                    or: vi.fn().mockImplementation(async () => {
                        await new Promise(r => setTimeout(r, LATENCY_MS));
                        return { error: null };
                    })
                }),
                delete: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({error:null}) })
            };
        }

        // Default fallback
        return {
            select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                    or: vi.fn().mockResolvedValue({ data: [], error: null }),
                    single: vi.fn().mockResolvedValue({ data: {}, error: null }),
                    limit: vi.fn().mockResolvedValue({ data: [], error: null })
                }),
                limit: vi.fn().mockResolvedValue({ data: [], error: null })
            }),
            update: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ error: null })
            }),
            upsert: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({data:{}, error: null}) }),
                onConflict: vi.fn().mockResolvedValue({error: null})
            }),
            insert: vi.fn().mockResolvedValue({ error: null })
        }
    });

    const start = performance.now();
    await deprovisionTenant(orgId, 'Performance test');
    const end = performance.now();

    console.log(`Deprovisioning took ${(end - start).toFixed(2)}ms`);

    // With 18 tables and 20ms latency:
    // Sequential: 18 * 20ms = ~360ms just for the update loop (plus data fetch loop latency if we mocked that too)
    // Parallel: ~20ms total for the update loop
  });
});
