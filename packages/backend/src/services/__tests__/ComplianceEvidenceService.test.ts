import { beforeEach, describe, expect, it, vi } from 'vitest';

const rows: Array<Record<string, unknown>> = [];

vi.mock('../../lib/supabase.js', () => ({
  assertNotTestEnv: vi.fn(),
  supabase: {
    from: vi.fn(() => {
      const filters: Record<string, unknown> = {};
      let ordering: { ascending: boolean } = { ascending: true };
      let limitValue: number | undefined;

      const chain = {
        insert: (payload: Record<string, unknown>) => ({
          select: () => ({
            single: async () => {
              const row = { id: String(rows.length + 1), ...payload };
              rows.push(row);
              return { data: row, error: null };
            },
          }),
        }),
        select: () => chain,
        eq: (field: string, value: unknown) => {
          filters[field] = value;
          return chain;
        },
        order: (field: string, opts: { ascending: boolean }) => {
          filters.__order_field = field;
          ordering = opts;
          return chain;
        },
        limit: (value: number) => {
          limitValue = value;
          return chain;
        },
        maybeSingle: async () => {
          const data = queryRows(filters, ordering.ascending, limitValue);
          return { data: data[0] ?? null, error: null };
        },
        then: undefined,
      };

      Object.defineProperty(chain, 'then', {
        get() {
          return undefined;
        },
      });

      return chain;
    }),
  },
}));

function queryRows(filters: Record<string, unknown>, ascending: boolean, limit?: number): Array<Record<string, unknown>> {
  const result = rows
    .filter((row) => Object.entries(filters).every(([key, value]) => key.startsWith('__') || row[key] === value))
    .sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));

  const ordered = ascending ? result : result.reverse();
  return typeof limit === 'number' ? ordered.slice(0, limit) : ordered;
}

import { ComplianceEvidenceService } from '../ComplianceEvidenceService.js';

describe('ComplianceEvidenceService', () => {
  beforeEach(() => {
    rows.splice(0, rows.length);
    vi.clearAllMocks();
  });

  it('creates append-only evidence records with chained hashes', async () => {
    const service = new ComplianceEvidenceService();

    const first = await service.appendEvidence({
      tenantId: 'tenant-a',
      actorPrincipal: 'orchestrator',
      actorType: 'service',
      triggerType: 'scheduled',
      triggerSource: 'nightly',
      collectedAt: '2026-01-01T00:00:00.000Z',
      evidence: { control: 'A1' },
    });

    const second = await service.appendEvidence({
      tenantId: 'tenant-a',
      actorPrincipal: 'orchestrator',
      actorType: 'service',
      triggerType: 'event',
      triggerSource: 'workflow.completed',
      collectedAt: '2026-01-01T00:01:00.000Z',
      evidence: { control: 'A2' },
    });

    expect(first.previous_hash).toBeNull();
    expect(second.previous_hash).toBe(first.integrity_hash);
  });

  it('verifies tenant scoped evidence and detects tampering', async () => {
    const service = new ComplianceEvidenceService();

    await service.appendEvidence({
      tenantId: 'tenant-a',
      actorPrincipal: 'orchestrator',
      actorType: 'service',
      triggerType: 'scheduled',
      triggerSource: 'nightly',
      collectedAt: '2026-01-01T00:00:00.000Z',
      evidence: { control: 'A1' },
    });

    await service.appendEvidence({
      tenantId: 'tenant-b',
      actorPrincipal: 'orchestrator',
      actorType: 'service',
      triggerType: 'scheduled',
      triggerSource: 'nightly',
      collectedAt: '2026-01-01T00:00:00.000Z',
      evidence: { control: 'B1' },
    });

    const tenantARecords = await service.getEvidenceByTenant('tenant-a');
    expect(tenantARecords).toHaveLength(1);
    expect(tenantARecords[0]?.tenant_id).toBe('tenant-a');

    rows[0]!.details = { ...(rows[0]!.details as Record<string, unknown>), evidence: { control: 'tampered' } };

    const verification = await service.verifyEvidenceChain('tenant-a');
    expect(verification.valid).toBe(false);
    expect(verification.errors[0]).toContain('Integrity hash mismatch');
  });

  it('exports evidence for audits', async () => {
    const service = new ComplianceEvidenceService();

    await service.appendEvidence({
      tenantId: 'tenant-a',
      actorPrincipal: 'orchestrator',
      actorType: 'service',
      triggerType: 'scheduled',
      triggerSource: 'nightly',
      collectedAt: '2026-01-01T00:00:00.000Z',
      evidence: { control: 'A1' },
    });

    const csv = await service.exportEvidence('tenant-a', 'csv');
    expect(csv).toContain('tenant_id');
    expect(csv).toContain('tenant-a');
  });
});
