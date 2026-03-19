import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SupabaseProvenanceStore } from '../SagaAdapters.js';

const baseRecord = {
  id: 'prov-1',
  valueCaseId: 'case-1',
  claimId: 'claim-shared',
  dataSource: 'agent-output',
  evidenceTier: 2 as const,
  agentId: 'agent-1',
  agentVersion: '1.0.0',
  confidenceScore: 0.8,
  createdAt: '2026-03-19T00:00:00.000Z',
};

describe('SupabaseProvenanceStore (SagaAdapters)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes organization_id on insert', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const supabase = {
      from: vi.fn().mockReturnValue({ insert }),
    };

    const store = new SupabaseProvenanceStore(supabase as never, 'org-1');
    await store.insert(baseRecord);

    expect(supabase.from).toHaveBeenCalledWith('provenance_records');
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        claim_id: 'claim-shared',
        organization_id: 'org-1',
        value_case_id: 'case-1',
      }),
    );
  });

  it('scopes findByClaimId to the store organization_id', async () => {
    const eq = vi.fn();
    eq
      .mockReturnValueOnce({ eq })
      .mockReturnValueOnce({ eq })
      .mockResolvedValueOnce({
        data: [
          {
            ...baseRecord,
            value_case_id: baseRecord.valueCaseId,
            claim_id: baseRecord.claimId,
            organization_id: 'org-2',
            data_source: baseRecord.dataSource,
            evidence_tier: 'gold',
            agent_id: baseRecord.agentId,
            agent_version: baseRecord.agentVersion,
            confidence_score: baseRecord.confidenceScore,
            created_at: baseRecord.createdAt,
          },
        ],
        error: null,
      });
    const select = vi.fn().mockReturnValue({ eq });
    const supabase = {
      from: vi.fn().mockReturnValue({ select }),
    };

    const store = new SupabaseProvenanceStore(supabase as never, 'org-2');
    const records = await store.findByClaimId('case-1', 'claim-shared');

    expect(eq).toHaveBeenNthCalledWith(1, 'value_case_id', 'case-1');
    expect(eq).toHaveBeenNthCalledWith(2, 'claim_id', 'claim-shared');
    expect(eq).toHaveBeenNthCalledWith(3, 'organization_id', 'org-2');
    expect(records).toHaveLength(1);
    expect(records[0]?.claimId).toBe('claim-shared');
  });

  it('scopes findById and findByValueCaseId to the store organization_id', async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        ...baseRecord,
        value_case_id: baseRecord.valueCaseId,
        claim_id: baseRecord.claimId,
        organization_id: 'org-tenant',
        data_source: baseRecord.dataSource,
        evidence_tier: 'gold',
        agent_id: baseRecord.agentId,
        agent_version: baseRecord.agentVersion,
        confidence_score: baseRecord.confidenceScore,
        created_at: baseRecord.createdAt,
      },
      error: null,
    });
    const eqForId = vi.fn();
    eqForId.mockReturnValueOnce({ eq: eqForId }).mockReturnValueOnce({ single });

    const valueCaseRows = [
      {
        ...baseRecord,
        value_case_id: baseRecord.valueCaseId,
        claim_id: 'claim-a',
        organization_id: 'org-tenant',
        data_source: baseRecord.dataSource,
        evidence_tier: 'gold',
        agent_id: baseRecord.agentId,
        agent_version: baseRecord.agentVersion,
        confidence_score: baseRecord.confidenceScore,
        created_at: baseRecord.createdAt,
      },
    ];
    const eqForCase = vi.fn();
    eqForCase
      .mockReturnValueOnce({ eq: eqForCase })
      .mockResolvedValueOnce({ data: valueCaseRows, error: null });

    const select = vi
      .fn()
      .mockReturnValueOnce({ eq: eqForId })
      .mockReturnValueOnce({ eq: eqForCase });
    const supabase = {
      from: vi.fn().mockReturnValue({ select }),
    };

    const store = new SupabaseProvenanceStore(supabase as never, 'org-tenant');

    const byId = await store.findById('prov-1');
    const byCase = await store.findByValueCaseId('case-1');

    expect(eqForId).toHaveBeenNthCalledWith(1, 'id', 'prov-1');
    expect(eqForId).toHaveBeenNthCalledWith(2, 'organization_id', 'org-tenant');
    expect(eqForCase).toHaveBeenNthCalledWith(1, 'value_case_id', 'case-1');
    expect(eqForCase).toHaveBeenNthCalledWith(2, 'organization_id', 'org-tenant');
    expect(byId?.id).toBe('prov-1');
    expect(byCase).toHaveLength(1);
  });
});
