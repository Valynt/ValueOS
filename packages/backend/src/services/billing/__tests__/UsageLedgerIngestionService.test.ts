import { describe, expect, it, vi } from 'vitest';

import { UsageLedgerIngestionService } from '../UsageLedgerIngestionService.js';

type InsertFn = ReturnType<typeof vi.fn>;

const makeSupabaseMock = (insertResult: { data: unknown; error: unknown }) => {
  const maybeSingle = vi.fn().mockResolvedValue(insertResult);
  const select = vi.fn().mockReturnValue({ maybeSingle });
  const insert: InsertFn = vi.fn().mockReturnValue({ select });
  const from = vi.fn().mockReturnValue({ insert });

  return {
    client: { from } as unknown,
    spies: { from, insert, select, maybeSingle },
  };
};

describe('UsageLedgerIngestionService', () => {
  it('treats duplicate request_id as no-op', async () => {
    const { client } = makeSupabaseMock({ data: null, error: null });
    const service = new UsageLedgerIngestionService(client as never);

    const result = await service.ingest({
      tenantId: '11111111-1111-1111-1111-111111111111',
      agentId: 'OpportunityAgent',
      valueUnits: 2,
      evidenceLink: 'trace://abc',
      requestId: 'req-123',
    });

    expect(result).toEqual({ inserted: false, duplicate: true });
  });

  it('persists evidence link in ledger payload', async () => {
    const { client, spies } = makeSupabaseMock({
      data: { id: 'ledger-1' },
      error: null,
    });
    const service = new UsageLedgerIngestionService(client as never);

    await service.ingest({
      tenantId: '11111111-1111-1111-1111-111111111111',
      agentId: 'TargetAgent',
      valueUnits: 4,
      evidenceLink: 'trace://target/1',
      requestId: 'req-456',
    });

    const firstCallArgs = spies.insert.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(firstCallArgs.evidence_link).toBe('trace://target/1');
  });

  it('keeps cross-tenant idempotency isolation with tenant+request conflict target', async () => {
    const { client, spies } = makeSupabaseMock({
      data: { id: 'ledger-2' },
      error: null,
    });
    const service = new UsageLedgerIngestionService(client as never);

    await service.ingest({
      tenantId: '22222222-2222-2222-2222-222222222222',
      agentId: 'IntegrityAgent',
      valueUnits: 1,
      evidenceLink: 'trace://integrity/1',
      requestId: 'req-shared',
    });

    const insertOptions = spies.insert.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(insertOptions.onConflict).toBe('tenant_id,request_id');
    expect(insertOptions.ignoreDuplicates).toBe(true);
  });
});
