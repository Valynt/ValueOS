/**
 * ValueCase Scaffolder Tests
 *
 * Tests that scaffolding creates a ValueCase, initializes the saga,
 * writes provenance, and enqueues the pre-fetch job.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock Supabase
const mockSupabase = {
  from: vi.fn(),
};

vi.mock('../../../lib/supabase.js', () => ({
  assertNotTestEnv: vi.fn(),
  createServerSupabaseClient: () => mockSupabase,
  // Named export consumed by modules that import supabase directly
  supabase: { from: vi.fn(() => ({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), insert: vi.fn().mockResolvedValue({ data: null, error: null }), update: vi.fn().mockReturnThis(), delete: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: null, error: null }) })) },
}));

vi.mock('../../../lib/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock('../../AuditLogService.js', () => ({
  auditLogService: {
    logAudit: vi.fn().mockResolvedValue(undefined),
  },
}));

const mockPrefetchQueue = {
  add: vi.fn().mockResolvedValue({ id: 'prefetch-job-1' }),
};

vi.mock('../../../workers/crmWorker.js', () => ({
  getPrefetchQueue: () => mockPrefetchQueue,
}));

describe('ValueCaseScaffolder', () => {
  let scaffolder: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    const mod = await import('../ValueCaseScaffolder.js');
    scaffolder = mod.valueCaseScaffolder;
    (scaffolder as any).supabase = mockSupabase;
  });

  it('scaffolds a ValueCase with saga and provenance', async () => {
    const { auditLogService } = await import('../../AuditLogService.js');

    // Mock all DB calls
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'value_case_templates') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: () => Promise.resolve({ data: null, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === 'value_cases') {
        return {
          insert: () => ({
            select: () => ({
              single: () => Promise.resolve({ data: { id: 'vc-new-1' }, error: null }),
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
      if (table === 'crm_object_maps') {
        return {
          insert: () => Promise.resolve({ error: null }),
        };
      }
      if (table === 'value_case_sagas') {
        return {
          insert: () => Promise.resolve({ error: null }),
        };
      }
      if (table === 'provenance_records') {
        return {
          insert: () => Promise.resolve({ error: null }),
        };
      }
      return {};
    });

    const opp = {
      externalId: 'sf-006-scaffold',
      name: 'Scaffold Test Deal',
      amount: 75000,
      currency: 'USD',
      stage: 'Qualification',
      probability: 35,
      closeDate: '2026-08-01',
      ownerName: 'Sales Rep',
      companyName: 'Scaffold Corp',
      companyId: 'sf-001-scaffold',
      properties: {},
    };

    const valueCaseId = await scaffolder.scaffold('tenant-1', 'salesforce', opp, 'opp-1');

    expect(valueCaseId).toBe('vc-new-1');

    // Verify audit logs were written
    expect(auditLogService.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'value_case_scaffolded' }),
    );
    expect(auditLogService.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'saga_started' }),
    );

    // Verify pre-fetch job was enqueued
    expect(mockPrefetchQueue.add).toHaveBeenCalledWith(
      'valuecase:prefetch_context',
      expect.objectContaining({
        valueCaseId: 'vc-new-1',
        tenantId: 'tenant-1',
        provider: 'salesforce',
      }),
      expect.any(Object),
    );
  });
});
