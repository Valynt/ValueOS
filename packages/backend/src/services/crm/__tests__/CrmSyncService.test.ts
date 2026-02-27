/**
 * CRM Sync Service Tests
 *
 * Tests delta sync, opportunity upsert, provenance writing,
 * and stage trigger detection.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock Supabase
const mockSupabase = {
  from: vi.fn(),
};

vi.mock('../../../lib/supabase.js', () => ({
  createServerSupabaseClient: () => mockSupabase,
}));

vi.mock('../../../lib/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock connection service
const mockTokens = {
  accessToken: 'test-token',
  refreshToken: 'test-refresh',
  expiresAt: new Date(Date.now() + 3600000),
  instanceUrl: 'https://test.salesforce.com',
  scopes: ['api'],
};

vi.mock('../CrmConnectionService.js', () => ({
  crmConnectionService: {
    getTokens: vi.fn().mockResolvedValue(mockTokens),
    getConnection: vi.fn().mockResolvedValue({ sync_cursor: null }),
    updateSyncCursor: vi.fn().mockResolvedValue(undefined),
    recordSyncError: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock provider
const mockProvider = {
  provider: 'salesforce' as const,
  fetchDeltaOpportunities: vi.fn(),
  fetchOpportunityById: vi.fn(),
};

vi.mock('../CrmProviderRegistry.js', () => ({
  getCrmProvider: () => mockProvider,
}));

// Mock audit log
vi.mock('../../AuditLogService.js', () => ({
  auditLogService: {
    logAudit: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock ValueCaseScaffolder
vi.mock('../ValueCaseScaffolder.js', () => ({
  valueCaseScaffolder: {
    scaffold: vi.fn().mockResolvedValue('vc-001'),
  },
}));

describe('CrmSyncService', () => {
  let service: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    const mod = await import('../CrmSyncService.js');
    service = mod.crmSyncService;
    (service as any).supabase = mockSupabase;
  });

  describe('upsertOpportunity', () => {
    it('creates a new opportunity when no mapping exists', async () => {
      // No existing map
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'crm_object_maps') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  eq: () => ({
                    eq: () => ({
                      maybeSingle: () => Promise.resolve({ data: null, error: null }),
                    }),
                  }),
                }),
              }),
            }),
            insert: () => Promise.resolve({ error: null }),
          };
        }
        if (table === 'opportunities') {
          return {
            insert: () => ({
              select: () => ({
                single: () => Promise.resolve({ data: { id: 'opp-internal-1' }, error: null }),
              }),
            }),
          };
        }
        if (table === 'provenance_records') {
          return {
            insert: () => Promise.resolve({ error: null }),
          };
        }
        if (table === 'crm_stage_triggers') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  eq: () => ({
                    eq: () => ({
                      maybeSingle: () => Promise.resolve({ data: null, error: null }),
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      const opp = {
        externalId: 'sf-006-001',
        name: 'Test Deal',
        amount: 100000,
        currency: 'USD',
        stage: 'Prospecting',
        probability: 20,
        closeDate: '2026-06-01',
        ownerName: 'Test User',
        companyName: 'Test Corp',
        companyId: 'sf-001-001',
        properties: {},
      };

      const result = await service.upsertOpportunity('tenant-1', 'salesforce', opp);

      expect(result).toBe('opp-internal-1');
    });

    it('updates existing opportunity when mapping exists', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'crm_object_maps') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  eq: () => ({
                    eq: () => ({
                      maybeSingle: () => Promise.resolve({
                        data: { internal_id: 'opp-existing-1' },
                        error: null,
                      }),
                    }),
                  }),
                }),
              }),
            }),
            update: () => ({
              eq: () => ({
                eq: () => ({
                  eq: () => ({
                    eq: () => Promise.resolve({ error: null }),
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'opportunities') {
          return {
            update: () => ({
              eq: () => Promise.resolve({ error: null }),
            }),
          };
        }
        if (table === 'provenance_records') {
          return {
            insert: () => Promise.resolve({ error: null }),
          };
        }
        if (table === 'crm_stage_triggers') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  eq: () => ({
                    eq: () => ({
                      maybeSingle: () => Promise.resolve({ data: null, error: null }),
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      const opp = {
        externalId: 'sf-006-001',
        name: 'Updated Deal',
        amount: 200000,
        currency: 'USD',
        stage: 'Negotiation',
        probability: 60,
        closeDate: '2026-07-01',
        ownerName: 'Test User',
        companyName: 'Test Corp',
        companyId: 'sf-001-001',
        properties: {},
      };

      const result = await service.upsertOpportunity('tenant-1', 'salesforce', opp);

      expect(result).toBe('opp-existing-1');
    });

    it('triggers ValueCase scaffolding when stage matches a trigger', async () => {
      const { valueCaseScaffolder } = await import('../ValueCaseScaffolder.js');

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'crm_object_maps') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  eq: () => ({
                    eq: () => ({
                      maybeSingle: () => Promise.resolve({ data: null, error: null }),
                    }),
                  }),
                }),
              }),
            }),
            insert: () => Promise.resolve({ error: null }),
          };
        }
        if (table === 'opportunities') {
          return {
            insert: () => ({
              select: () => ({
                single: () => Promise.resolve({ data: { id: 'opp-new-1' }, error: null }),
              }),
            }),
          };
        }
        if (table === 'provenance_records') {
          return {
            insert: () => Promise.resolve({ error: null }),
          };
        }
        if (table === 'crm_stage_triggers') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  eq: () => ({
                    eq: () => ({
                      maybeSingle: () => Promise.resolve({
                        data: { id: 'trigger-1', action: 'scaffold_value_case' },
                        error: null,
                      }),
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      const opp = {
        externalId: 'sf-006-trigger',
        name: 'Triggered Deal',
        amount: 50000,
        currency: 'USD',
        stage: 'Qualification',
        probability: 30,
        closeDate: null,
        ownerName: null,
        companyName: 'Trigger Corp',
        companyId: null,
        properties: {},
      };

      await service.upsertOpportunity('tenant-1', 'salesforce', opp);

      expect(valueCaseScaffolder.scaffold).toHaveBeenCalledWith(
        'tenant-1',
        'salesforce',
        opp,
        'opp-new-1',
      );
    });
  });

  describe('out-of-order protection', () => {
    it('rejects stale updates when incoming timestamp is older', async () => {
      // Existing map found
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'crm_object_maps') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  eq: () => ({
                    eq: () => ({
                      maybeSingle: () => Promise.resolve({
                        data: { internal_id: 'opp-existing' },
                        error: null,
                      }),
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'opportunities') {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({
                  data: {
                    external_last_modified_at: '2026-06-15T12:00:00Z',
                    crm_sync_hash: 'different-hash',
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      });

      const opp = {
        externalId: 'sf-006-stale',
        name: 'Stale Deal',
        amount: 100000,
        currency: 'USD',
        stage: 'Prospecting',
        probability: 20,
        closeDate: null,
        ownerName: null,
        companyName: null,
        companyId: null,
        properties: {
          SystemModstamp: '2026-06-15T10:00:00Z', // older than existing
        },
      };

      const result = await service.upsertOpportunity('tenant-1', 'salesforce', opp);

      // Should return existing ID without updating
      expect(result).toBe('opp-existing');
    });
  });

  describe('runDeltaSync', () => {
    it('processes opportunities from delta sync', async () => {
      mockProvider.fetchDeltaOpportunities.mockResolvedValue({
        opportunities: [
          {
            externalId: 'sf-001',
            name: 'Deal 1',
            amount: 10000,
            currency: 'USD',
            stage: 'Prospecting',
            properties: {},
          },
          {
            externalId: 'sf-002',
            name: 'Deal 2',
            amount: 20000,
            currency: 'USD',
            stage: 'Qualification',
            properties: {},
          },
        ],
        nextCursor: '2026-01-15T00:00:00Z',
        hasMore: false,
      });

      // Mock upsertOpportunity to succeed
      const upsertSpy = vi.spyOn(service, 'upsertOpportunity').mockResolvedValue('opp-id');

      const result = await service.runDeltaSync('tenant-1', 'salesforce');

      expect(result.processed).toBe(2);
      expect(result.errors).toBe(0);
      expect(upsertSpy).toHaveBeenCalledTimes(2);

      upsertSpy.mockRestore();
    });
  });
});
