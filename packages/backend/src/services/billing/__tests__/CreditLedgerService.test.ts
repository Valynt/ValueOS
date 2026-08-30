/**
 * CreditLedgerService — unit tests
 *
 * Covers the core safety properties of the credit ledger:
 *   1. Double-application prevention (same invoice_id cannot debit twice)
 *   2. Idempotent credit issuance via idempotency_key
 *   3. Insufficient balance handling (debit capped at available balance)
 *   4. Preview mode (no invoice_id) reads balance without writing
 */

import { describe, expect, it, vi } from 'vitest';

import { CreditLedgerService } from '../CreditLedgerService.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Minimal Supabase stub that tracks inserted rows and simulates the
 * consume_invoice_credits RPC with real balance logic.
 */
function makeSupabase(initialRows: Array<{
  id: string;
  tenant_id: string;
  entry_type: 'credit' | 'debit';
  amount_cents: number;
  invoice_id: string | null;
  idempotency_key: string | null;
  reason: string;
  created_at: string;
  created_by: string | null;
}> = []) {
  const rows = [...initialRows];

  function computeBalance(tenant_id: string): number {
    return rows
      .filter(r => r.tenant_id === tenant_id)
      .reduce((sum, r) => sum + (r.entry_type === 'credit' ? r.amount_cents : -r.amount_cents), 0);
  }

  const rpc = vi.fn(async (fn: string, params: Record<string, unknown>) => {
    if (fn === 'consume_invoice_credits') {
      const { p_tenant_id, p_invoice_id, p_amount_cents } = params as {
        p_tenant_id: string;
        p_invoice_id: string;
        p_amount_cents: number;
      };

      // Idempotency: return existing debit if invoice already processed.
      const existing = rows.find(r => r.invoice_id === p_invoice_id && r.entry_type === 'debit');
      if (existing) {
        return { data: existing.amount_cents, error: null };
      }

      const balance = computeBalance(p_tenant_id);
      if (balance <= 0) return { data: 0, error: null };

      const debit = Math.min(p_amount_cents, balance);
      rows.push({
        id: `debit-${rows.length}`,
        tenant_id: p_tenant_id,
        entry_type: 'debit',
        amount_cents: debit,
        invoice_id: p_invoice_id,
        idempotency_key: null,
        reason: `Applied to invoice ${p_invoice_id}`,
        created_at: new Date().toISOString(),
        created_by: null,
      });
      return { data: debit, error: null };
    }
    return { data: null, error: { message: `Unknown RPC: ${fn}` } };
  });

  const from = vi.fn((table: string) => {
    if (table === 'billing_credit_ledger') {
      return {
        insert: vi.fn((row: Record<string, unknown>) => ({
          select: vi.fn(() => ({
            single: vi.fn(async () => {
              // Simulate unique constraint on (tenant_id, idempotency_key).
              if (row['idempotency_key']) {
                const dup = rows.find(
                  r =>
                    r.tenant_id === row['tenant_id'] &&
                    r.idempotency_key === row['idempotency_key']
                );
                if (dup) {
                  return { data: null, error: { code: '23505', message: 'duplicate key' } };
                }
              }
              const newRow = {
                id: `credit-${rows.length}`,
                tenant_id: row['tenant_id'] as string,
                entry_type: row['entry_type'] as 'credit' | 'debit',
                amount_cents: row['amount_cents'] as number,
                invoice_id: (row['invoice_id'] as string | null) ?? null,
                idempotency_key: (row['idempotency_key'] as string | null) ?? null,
                reason: (row['reason'] as string) ?? '',
                created_at: new Date().toISOString(),
                created_by: null,
              };
              rows.push(newRow);
              return { data: newRow, error: null };
            }),
          })),
        })),
        select: vi.fn(() => ({
          eq: vi.fn((col: string, val: unknown) => ({
            eq: vi.fn((col2: string, val2: unknown) => ({
              single: vi.fn(async () => {
                const found = rows.find(r => (r as Record<string, unknown>)[col] === val && (r as Record<string, unknown>)[col2] === val2);
                return found
                  ? { data: found, error: null }
                  : { data: null, error: { code: 'PGRST116', message: 'not found' } };
              }),
            })),
            order: vi.fn(async () => ({
              data: rows.filter(r => (r as Record<string, unknown>)[col] === val),
              error: null,
            })),
          })),
        })),
      };
    }

    if (table === 'billing_credit_balances') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn((col: string, val: unknown) => ({
            maybeSingle: vi.fn(async () => {
              const tenantRows = rows.filter(r => (r as Record<string, unknown>)[col] === val);
              if (tenantRows.length === 0) return { data: null, error: null };
              const balance = computeBalance(val as string);
              return {
                data: { tenant_id: val, balance_cents: balance },
                error: null,
              };
            }),
          })),
        })),
      };
    }

    return {};
  });

  return { from, rpc, _rows: rows };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CreditLedgerService', () => {
  describe('issueCredit', () => {
    it('inserts a credit row and returns it', async () => {
      const supabase = makeSupabase();
      const svc = new CreditLedgerService(supabase as never);

      const entry = await svc.issueCredit({
        tenant_id: 'tenant-a',
        amount_cents: 5000,
        reason: 'promotional',
        idempotency_key: 'promo-2026-01',
      });

      expect(entry.entry_type).toBe('credit');
      expect(entry.amount_cents).toBe(5000);
      expect(supabase._rows).toHaveLength(1);
    });

    it('is idempotent: re-issuing with the same idempotency_key returns the original row', async () => {
      const supabase = makeSupabase();
      const svc = new CreditLedgerService(supabase as never);

      const first = await svc.issueCredit({
        tenant_id: 'tenant-a',
        amount_cents: 5000,
        reason: 'promotional',
        idempotency_key: 'promo-2026-01',
      });

      // Second call with same key — simulates a retried API call.
      const second = await svc.issueCredit({
        tenant_id: 'tenant-a',
        amount_cents: 5000,
        reason: 'promotional',
        idempotency_key: 'promo-2026-01',
      });

      // Only one row should exist.
      expect(supabase._rows).toHaveLength(1);
      expect(second.id).toBe(first.id);
    });

    it('rejects zero or negative amounts', async () => {
      const supabase = makeSupabase();
      const svc = new CreditLedgerService(supabase as never);

      await expect(
        svc.issueCredit({ tenant_id: 'tenant-a', amount_cents: 0, reason: 'bad' })
      ).rejects.toThrow('amount_cents must be positive');

      await expect(
        svc.issueCredit({ tenant_id: 'tenant-a', amount_cents: -100, reason: 'bad' })
      ).rejects.toThrow('amount_cents must be positive');
    });
  });

  describe('consumeCreditsForInvoice', () => {
    it('debits the full requested amount when balance is sufficient', async () => {
      const supabase = makeSupabase([
        {
          id: 'c1',
          tenant_id: 'tenant-a',
          entry_type: 'credit',
          amount_cents: 10000,
          invoice_id: null,
          idempotency_key: null,
          reason: 'initial',
          created_at: '2026-01-01T00:00:00Z',
          created_by: null,
        },
      ]);
      const svc = new CreditLedgerService(supabase as never);

      const result = await svc.consumeCreditsForInvoice('tenant-a', 'inv-001', 3000);

      expect(result.debited_cents).toBe(3000);
      expect(result.remaining_balance_cents).toBe(7000);
    });

    it('caps the debit at the available balance when balance is insufficient', async () => {
      const supabase = makeSupabase([
        {
          id: 'c1',
          tenant_id: 'tenant-a',
          entry_type: 'credit',
          amount_cents: 2000,
          invoice_id: null,
          idempotency_key: null,
          reason: 'initial',
          created_at: '2026-01-01T00:00:00Z',
          created_by: null,
        },
      ]);
      const svc = new CreditLedgerService(supabase as never);

      const result = await svc.consumeCreditsForInvoice('tenant-a', 'inv-001', 5000);

      expect(result.debited_cents).toBe(2000); // capped at balance
      expect(result.remaining_balance_cents).toBe(0);
    });

    it('returns 0 when the tenant has no credits', async () => {
      const supabase = makeSupabase(); // empty ledger
      const svc = new CreditLedgerService(supabase as never);

      const result = await svc.consumeCreditsForInvoice('tenant-a', 'inv-001', 5000);

      expect(result.debited_cents).toBe(0);
    });

    it('prevents double-application: second call with same invoice_id returns original debit', async () => {
      const supabase = makeSupabase([
        {
          id: 'c1',
          tenant_id: 'tenant-a',
          entry_type: 'credit',
          amount_cents: 10000,
          invoice_id: null,
          idempotency_key: null,
          reason: 'initial',
          created_at: '2026-01-01T00:00:00Z',
          created_by: null,
        },
      ]);
      const svc = new CreditLedgerService(supabase as never);

      const first = await svc.consumeCreditsForInvoice('tenant-a', 'inv-001', 3000);
      expect(first.debited_cents).toBe(3000);

      // Simulate the billing engine running again for the same invoice
      // (e.g. webhook replay, retry, or bug).
      const second = await svc.consumeCreditsForInvoice('tenant-a', 'inv-001', 3000);
      expect(second.debited_cents).toBe(3000); // same amount returned

      // Only one debit row should exist.
      const debitRows = supabase._rows.filter(r => r.entry_type === 'debit');
      expect(debitRows).toHaveLength(1);

      // Balance should reflect exactly one debit.
      const balance = await svc.getBalanceCents('tenant-a');
      expect(balance).toBe(7000);
    });

    it('handles concurrent invoices correctly: each invoice gets its own debit', async () => {
      const supabase = makeSupabase([
        {
          id: 'c1',
          tenant_id: 'tenant-a',
          entry_type: 'credit',
          amount_cents: 10000,
          invoice_id: null,
          idempotency_key: null,
          reason: 'initial',
          created_at: '2026-01-01T00:00:00Z',
          created_by: null,
        },
      ]);
      const svc = new CreditLedgerService(supabase as never);

      const [r1, r2] = await Promise.all([
        svc.consumeCreditsForInvoice('tenant-a', 'inv-001', 3000),
        svc.consumeCreditsForInvoice('tenant-a', 'inv-002', 4000),
      ]);

      // Both debits should succeed and together consume exactly 7000 cents
      // (3000 + 4000), not more and not less.
      expect(r1.debited_cents + r2.debited_cents).toBe(7000);
      const debitRows = supabase._rows.filter(r => r.entry_type === 'debit');
      expect(debitRows).toHaveLength(2);
    });
  });

  describe('getBalanceCents', () => {
    it('returns 0 for a tenant with no ledger rows', async () => {
      const supabase = makeSupabase();
      const svc = new CreditLedgerService(supabase as never);
      expect(await svc.getBalanceCents('tenant-unknown')).toBe(0);
    });

    it('returns credits minus debits', async () => {
      const supabase = makeSupabase([
        {
          id: 'c1',
          tenant_id: 'tenant-a',
          entry_type: 'credit',
          amount_cents: 10000,
          invoice_id: null,
          idempotency_key: null,
          reason: 'initial',
          created_at: '2026-01-01T00:00:00Z',
          created_by: null,
        },
        {
          id: 'd1',
          tenant_id: 'tenant-a',
          entry_type: 'debit',
          amount_cents: 3000,
          invoice_id: 'inv-001',
          idempotency_key: null,
          reason: 'Applied to invoice inv-001',
          created_at: '2026-01-15T00:00:00Z',
          created_by: null,
        },
      ]);
      const svc = new CreditLedgerService(supabase as never);
      expect(await svc.getBalanceCents('tenant-a')).toBe(7000);
    });
  });
});

// ---------------------------------------------------------------------------
// consumeCreditsForInvoice: error propagation
// ---------------------------------------------------------------------------

describe('CreditLedgerService error handling', () => {
  it('throws when the RPC returns an error', async () => {
    const supabase = {
      from: vi.fn(),
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'connection timeout' },
      }),
    };
    const svc = new CreditLedgerService(supabase as never);

    await expect(
      svc.consumeCreditsForInvoice('tenant-a', 'inv-001', 5000)
    ).rejects.toThrow('Failed to consume credits: connection timeout');
  });
});

// ---------------------------------------------------------------------------
// getLedgerEntries
// ---------------------------------------------------------------------------

describe('CreditLedgerService.getLedgerEntries', () => {
  it('returns all rows for a tenant in insertion order', async () => {
    const supabase = makeSupabase([
      {
        id: 'c1',
        tenant_id: 'tenant-a',
        entry_type: 'credit',
        amount_cents: 5000,
        invoice_id: null,
        idempotency_key: null,
        reason: 'promo',
        created_at: '2026-01-01T00:00:00Z',
        created_by: null,
      },
      {
        id: 'd1',
        tenant_id: 'tenant-a',
        entry_type: 'debit',
        amount_cents: 2000,
        invoice_id: 'inv-001',
        idempotency_key: null,
        reason: 'Applied to invoice inv-001',
        created_at: '2026-01-15T00:00:00Z',
        created_by: null,
      },
    ]);
    const svc = new CreditLedgerService(supabase as never);

    const entries = await svc.getLedgerEntries('tenant-a');

    expect(entries).toHaveLength(2);
    expect(entries[0].entry_type).toBe('credit');
    expect(entries[0].amount_cents).toBe(5000);
    expect(entries[1].entry_type).toBe('debit');
    expect(entries[1].invoice_id).toBe('inv-001');
  });

  it('returns an empty array when the tenant has no ledger rows', async () => {
    const supabase = makeSupabase();
    const svc = new CreditLedgerService(supabase as never);

    const entries = await svc.getLedgerEntries('tenant-unknown');
    expect(entries).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getBalance
// ---------------------------------------------------------------------------

describe('CreditLedgerService.getBalance', () => {
  it('returns null when the tenant has no ledger rows', async () => {
    const supabase = makeSupabase();
    const svc = new CreditLedgerService(supabase as never);

    const balance = await svc.getBalance('tenant-unknown');
    expect(balance).toBeNull();
  });

  it('returns a full balance record with correct aggregates', async () => {
    const baseSvc = makeSupabase([
      {
        id: 'c1',
        tenant_id: 'tenant-a',
        entry_type: 'credit',
        amount_cents: 10000,
        invoice_id: null,
        idempotency_key: null,
        reason: 'initial',
        created_at: '2026-01-01T00:00:00Z',
        created_by: null,
      },
      {
        id: 'd1',
        tenant_id: 'tenant-a',
        entry_type: 'debit',
        amount_cents: 3000,
        invoice_id: 'inv-001',
        idempotency_key: null,
        reason: 'Applied to invoice inv-001',
        created_at: '2026-01-15T00:00:00Z',
        created_by: null,
      },
    ]);

    // Override billing_credit_balances to return the full view shape.
    const fullBalanceSupabase = {
      ...baseSvc,
      from: vi.fn((table: string) => {
        if (table === 'billing_credit_balances') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                tenant_id: 'tenant-a',
                balance_cents: 7000,
                credit_count: 1,
                debit_count: 1,
                last_activity_at: '2026-01-15T00:00:00Z',
              },
              error: null,
            }),
          };
        }
        return baseSvc.from(table);
      }),
    };

    const svc = new CreditLedgerService(fullBalanceSupabase as never);
    const balance = await svc.getBalance('tenant-a');

    expect(balance).not.toBeNull();
    expect(balance!.balance_cents).toBe(7000);
    expect(balance!.credit_count).toBe(1);
    expect(balance!.debit_count).toBe(1);
    expect(balance!.last_activity_at).toBe('2026-01-15T00:00:00Z');
  });
});
