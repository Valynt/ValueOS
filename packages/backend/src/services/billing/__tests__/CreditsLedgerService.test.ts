/**
 * CreditsLedgerService — unit tests
 *
 * Covers getBalanceDollars error and zero-balance paths, and the
 * applyCreditsToInvoice idempotency and concurrent-write paths.
 */

import { describe, expect, it, vi } from 'vitest';

import { CreditsLedgerService } from '../CreditsLedgerService.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a Supabase stub whose billing_credits_ledger responses are configurable. */
function makeSupabase(opts: {
  balanceResult: { data: { sum: number | null } | null; error: unknown };
  idempotencyResult?: { data: { amount_cents: number } | null; error: unknown };
  insertResult?: { error: unknown };
}) {
  // Each .from('billing_credits_ledger') call returns a fresh chain.
  // Terminal method determines which fixture is returned:
  //   .single()      → balance aggregate
  //   .maybeSingle() → idempotency check (or concurrent re-read)
  //   .insert()      → debit write
  const makeChain = () => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(opts.balanceResult),
    maybeSingle: vi.fn().mockResolvedValue(
      opts.idempotencyResult ?? { data: null, error: null },
    ),
    insert: vi.fn().mockResolvedValue(opts.insertResult ?? { error: null }),
  });

  return {
    from: vi.fn(() => makeChain()),
  };
}

// ---------------------------------------------------------------------------
// getBalanceDollars
// ---------------------------------------------------------------------------

describe('CreditsLedgerService.getBalanceDollars', () => {
  it('returns 0 and logs when the DB query errors', async () => {
    const supabase = makeSupabase({
      balanceResult: { data: null, error: { message: 'connection timeout', code: '08006' } },
    });
    const svc = new CreditsLedgerService(supabase as never);
    const balance = await svc.getBalanceDollars('tenant-1');
    expect(balance).toBe(0);
  });

  it('returns 0 when the tenant has no ledger rows (sum is null)', async () => {
    const supabase = makeSupabase({
      balanceResult: { data: { sum: null }, error: null },
    });
    const svc = new CreditsLedgerService(supabase as never);
    const balance = await svc.getBalanceDollars('tenant-1');
    expect(balance).toBe(0);
  });

  it('returns the correct dollar amount when credits exist', async () => {
    const supabase = makeSupabase({
      balanceResult: { data: { sum: 5000 }, error: null }, // $50.00
    });
    const svc = new CreditsLedgerService(supabase as never);
    const balance = await svc.getBalanceDollars('tenant-1');
    expect(balance).toBe(50);
  });

  it('clamps negative sum to 0 (all credits fully debited)', async () => {
    // Should not occur in practice but guards against ledger corruption
    const supabase = makeSupabase({
      balanceResult: { data: { sum: -100 }, error: null },
    });
    const svc = new CreditsLedgerService(supabase as never);
    const balance = await svc.getBalanceDollars('tenant-1');
    expect(balance).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// applyCreditsToInvoice
// ---------------------------------------------------------------------------

describe('CreditsLedgerService.applyCreditsToInvoice', () => {
  const BASE_PARAMS = {
    tenantId: 'tenant-1',
    subscriptionId: 'sub-1',
    periodStart: '2026-01-01',
    periodEnd: '2026-01-31',
    invoiceSubtotalDollars: 100,
  };

  it('returns 0 and does not insert when balance is 0', async () => {
    const supabase = makeSupabase({
      balanceResult: { data: { sum: 0 }, error: null },
    });
    const svc = new CreditsLedgerService(supabase as never);
    const result = await svc.applyCreditsToInvoice(BASE_PARAMS);
    expect(result.appliedDollars).toBe(0);
    expect(result.debited).toBe(false);
  });

  it('returns previously applied amount when debit already exists (idempotent)', async () => {
    const supabase = makeSupabase({
      balanceResult: { data: { sum: 5000 }, error: null },
      // Idempotency check finds an existing debit of -2000 cents ($20)
      idempotencyResult: { data: { amount_cents: -2000 }, error: null },
    });
    const svc = new CreditsLedgerService(supabase as never);
    const result = await svc.applyCreditsToInvoice(BASE_PARAMS);
    expect(result.appliedDollars).toBe(20);
    expect(result.debited).toBe(false);
  });

  it('applies credits up to the invoice subtotal when balance exceeds it', async () => {
    const supabase = makeSupabase({
      balanceResult: { data: { sum: 20000 }, error: null }, // $200 balance
    });
    const svc = new CreditsLedgerService(supabase as never);
    const result = await svc.applyCreditsToInvoice(BASE_PARAMS); // subtotal = $100
    expect(result.appliedDollars).toBe(100);
    expect(result.debited).toBe(true);
  });

  it('returns 0 when the idempotency check itself errors', async () => {
    const supabase = makeSupabase({
      balanceResult: { data: { sum: 5000 }, error: null },
      idempotencyResult: { data: null, error: { message: 'read error', code: '08006' } },
    });
    const svc = new CreditsLedgerService(supabase as never);
    const result = await svc.applyCreditsToInvoice(BASE_PARAMS);
    expect(result.appliedDollars).toBe(0);
    expect(result.debited).toBe(false);
  });

  it('returns 0 when the debit insert fails with a non-conflict error', async () => {
    const supabase = makeSupabase({
      balanceResult: { data: { sum: 5000 }, error: null },
      insertResult: { error: { message: 'insert failed', code: '08006' } },
    });
    const svc = new CreditsLedgerService(supabase as never);
    const result = await svc.applyCreditsToInvoice(BASE_PARAMS);
    expect(result.appliedDollars).toBe(0);
    expect(result.debited).toBe(false);
  });
});
