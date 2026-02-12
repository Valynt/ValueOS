
import { describe, it, vi } from 'vitest';

// Mock dependencies
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

vi.mock('../../config/environment', () => ({
  getConfig: vi.fn().mockReturnValue({
    email: { enabled: false },
    features: { billing: true, usageTracking: true },
  }),
}));

vi.mock('../billing/SubscriptionService', () => ({
    default: {
        cancelSubscription: vi.fn().mockResolvedValue(undefined),
        createSubscription: vi.fn().mockResolvedValue(undefined)
    }
}));

vi.mock('../billing/CustomerService', () => ({
    default: {
        createCustomer: vi.fn().mockResolvedValue({ id: 'cus_123' }),
        updatePaymentMethod: vi.fn().mockResolvedValue(undefined)
    }
}));

vi.mock('../SettingsService', () => ({
    settingsService: {
        initializeOrganizationSettings: vi.fn().mockResolvedValue(undefined)
    }
}));

vi.mock('../EmailService', () => ({
    emailService: {
        send: vi.fn().mockResolvedValue(undefined)
    }
}));

vi.mock('../IntegrationControlService', () => ({
    integrationControlService: {
        disableIntegrations: vi.fn().mockResolvedValue(undefined),
        scrubCredentials: vi.fn().mockResolvedValue(0),
    }
}));

vi.mock('../AuditLogService', () => ({
    auditLogService: {
        createEntry: vi.fn().mockResolvedValue(undefined),
    }
}));

// Mock Supabase
const SIMULATED_DELAY = 10; // ms

const mockTables = [
  'organizations', 'tenants', 'user_tenants', 'user_roles', 'users',
  'api_keys', 'audit_logs', 'cases', 'workflows', 'workflow_states',
  'shared_artifacts', 'agents', 'agent_runs', 'agent_memory', 'models',
  'kpis', 'messages', 'security_audit_events'
];

const mockColumns = {
    'organizations': ['id', 'name', 'status', 'updated_at', 'is_active'],
    'tenants': ['id', 'status'],
    'user_tenants': ['tenant_id', 'user_id', 'status', 'disabled_at', 'disabled_reason'],
    // Add generic tenant_id column to others
};

const createMockSupabase = () => {
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    const chain = () => {
        const methods = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            or: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            single: vi.fn().mockImplementation(async () => {
                await delay(SIMULATED_DELAY);
                return { data: { id: 'mock-id' }, error: null };
            }),
            update: vi.fn().mockImplementation(async () => {
                await delay(SIMULATED_DELAY);
                return { error: null };
            }),
            insert: vi.fn().mockImplementation(async () => {
                await delay(SIMULATED_DELAY);
                return { error: null };
            }),
            upsert: vi.fn().mockImplementation(async () => {
                await delay(SIMULATED_DELAY);
                return { error: null };
            }),
            delete: vi.fn().mockImplementation(async () => {
                await delay(SIMULATED_DELAY);
                return { error: null };
            }),
            upload: vi.fn().mockImplementation(async () => {
                await delay(SIMULATED_DELAY);
                return { error: null };
            }),
            then: (resolve: any) => {
                 // Handle await directly on the chain
                 return delay(SIMULATED_DELAY).then(() => resolve({ data: [], error: null }));
            }
        };
        // Fix for "await query" usage where query is the chain object
        // In the code: let query = supabase.from(...); const { data } = await query;
        // The chain object needs to be thenable or return a promise on execution.
        // Vitest mocks return 'this' which is the object. We need to make it thenable.
        return {
            ...methods,
            then: (resolve: any) => {
                 return delay(SIMULATED_DELAY).then(() => resolve({ data: [{id: '1', metadata: {}}], error: null }));
            }
        };
    };

    return {
        from: vi.fn().mockImplementation((table: string) => {
            const c = chain();

            // Special handling for information_schema.tables
            if (table === 'information_schema.tables') {
                c.then = (resolve: any) => {
                     return delay(SIMULATED_DELAY).then(() => resolve({
                         data: mockTables.map(t => ({ table_name: t })),
                         error: null
                     }));
                };
            }

            // Special handling for information_schema.columns
            if (table === 'information_schema.columns') {
                // We need to capture the filters to return correct columns
                // Since the optimized code uses .in('table_name', list), we should return columns for all relevant tables
                // or just all mock tables to be safe.
                const allColumns = mockTables.flatMap(t => [
                     { table_name: t, column_name: 'id' },
                     { table_name: t, column_name: 'tenant_id' },
                     { table_name: t, column_name: 'organization_id' },
                     { table_name: t, column_name: 'archived_at' },
                     { table_name: t, column_name: 'metadata' }
                ]);

                c.then = (resolve: any) => {
                     return delay(SIMULATED_DELAY).then(() => resolve({
                         data: allColumns,
                         error: null
                     }));
                };
            }

            return c;
        }),
        storage: {
            from: vi.fn().mockReturnValue({
                upload: vi.fn().mockImplementation(async () => {
                    await delay(SIMULATED_DELAY);
                    return { error: null };
                })
            })
        },
        auth: {
            admin: {
                signOut: vi.fn().mockResolvedValue({ error: null })
            }
        }
    };
};

vi.mock('../../lib/supabase', () => ({
  createServerSupabaseClient: vi.fn().mockImplementation(() => createMockSupabase()),
}));

import { deprovisionTenant } from '../TenantProvisioning.js'

describe('Performance Benchmark', () => {
  it('measures deprovisionTenant execution time', async () => {
    const start = Date.now();
    await deprovisionTenant('org-bench-1', 'benchmark');
    const duration = Date.now() - start;
    console.log(`\n\nBENCHMARK_RESULT: deprovisionTenant took ${duration}ms\n\n`);
  });
});
