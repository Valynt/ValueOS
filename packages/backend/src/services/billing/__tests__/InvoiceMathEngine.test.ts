/**
 * InvoiceMathEngine — unit tests
 *
 * Covers the tax-on-post-credit-amount regression: tax must be applied to
 * (subtotal - credits), not the gross subtotal.
 *
 * Credits are now sourced from billing_credits_ledger (not organizations.settings).
 * The test helper stubs both tables.
 */

import { describe, expect, it, vi } from 'vitest';

import { InvoiceMathEngine } from '../InvoiceMathEngine.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal Supabase client stub.
 *
 * creditRows: rows in billing_credits_ledger (amount_cents, entry_type, etc.)
 * orgSettings: settings JSONB from organizations (used for tax_rate only)
 */
function makeSupabase(overrides: {
  ledgerRows?: unknown[];
  orgSettings?: Record<string, unknown> | null;
  creditRows?: Array<{ amount_cents: number; entry_type?: string }>;
} = {}) {
  const ledgerRows = overrides.ledgerRows ?? [];
  const orgSettings = overrides.orgSettings ?? null;
  const creditRows = overrides.creditRows ?? [];

  const ratedLedgerChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: ledgerRows, error: null }),
  };

  const orgChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: orgSettings !== null ? { settings: orgSettings } : null,
      error: null,
    }),
  };

  // billing_credits_ledger stub.
  //
  // CreditsLedgerService makes three distinct calls against this table,
  // each with a unique terminal method — dispatch on that method rather than
  // call position so the stub is robust to refactoring:
  //
  //   1. Idempotency check: ...eq(...×5).maybeSingle() → { data: null }
  //   2. Balance aggregate: ...eq('tenant_id',...).single() → { data: { sum: totalCents } }
  //   3. Debit insert:      .insert({...})               → { error: null }
  //
  // Each `.from('billing_credits_ledger')` call returns a fresh chain whose
  // terminal methods resolve to the correct fixture for that query shape.
  const totalCreditCents = creditRows.reduce((s, r) => s + r.amount_cents, 0);

  const makeCreditsLedgerChain = () => {
    const chain: Record<string, unknown> = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      // Idempotency check — no prior debit exists
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      // Balance aggregate — returns SUM as { sum: totalCents }
      single: vi.fn().mockResolvedValue({
        data: { sum: totalCreditCents },
        error: null,
      }),
      // Debit insert — succeeds
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    return chain;
  };

  return {
    from: vi.fn((table: string) => {
      if (table === 'rated_ledger') return ratedLedgerChain;
      if (table === 'organizations') return orgChain;
      if (table === 'billing_credits_ledger') return makeCreditsLedgerChain();
      return ratedLedgerChain;
    }),
  };
}

const BASE_INPUT = {
  tenant_id: 'tenant-1',
  subscription_id: 'sub-1',
  period_start: '2026-01-01',
  period_end: '2026-01-31',
  currency: 'usd',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('InvoiceMathEngine.calculateInvoice', () => {
  it('applies tax to (subtotal - credits), not gross subtotal', async () => {
    // subtotal = $100, credits = $20 (2000 cents grant), taxable base = $80, tax rate = 10%
    // expected tax = $8.00, not $10.00
    const ledgerRow = {
      id: 'row-1',
      tenant_id: 'tenant-1',
      subscription_id: 'sub-1',
      price_version_id: 'pv-1',
      meter_key: 'agent_invocations',
      period_start: '2026-01-01',
      period_end: '2026-01-31',
      quantity_used: 10,
      quantity_included: 0,
      quantity_overage: 10,
      unit_price: 10,
      amount: 100,
      rated_at: '2026-01-31T00:00:00Z',
      source_aggregate_hash: 'abc',
    };

    const supabase = makeSupabase({
      ledgerRows: [ledgerRow],
      orgSettings: { tax_rate: 0.1 },
      creditRows: [{ amount_cents: 2000, entry_type: 'grant' }], // $20.00
    });

    const engine = new InvoiceMathEngine(supabase as never);
    const result = await engine.calculateInvoice(BASE_INPUT);

    expect(result.subtotal).toBe(100);
    expect(result.applied_credits).toBe(20);
    // Tax must be on $80 (post-credit), not $100 (gross)
    expect(result.tax_amount).toBeCloseTo(8, 5);
    expect(result.total_amount).toBeCloseTo(88, 5); // 100 - 20 + 8
    expect(result.amount_due).toBeCloseTo(88, 5);
  });

  it('produces zero tax when there are no credits and no tax rate', async () => {
    const ledgerRow = {
      id: 'row-2',
      tenant_id: 'tenant-1',
      subscription_id: 'sub-1',
      price_version_id: 'pv-1',
      meter_key: 'agent_invocations',
      period_start: '2026-01-01',
      period_end: '2026-01-31',
      quantity_used: 5,
      quantity_included: 0,
      quantity_overage: 5,
      unit_price: 10,
      amount: 50,
      rated_at: '2026-01-31T00:00:00Z',
      source_aggregate_hash: 'def',
    };

    const supabase = makeSupabase({ ledgerRows: [ledgerRow], orgSettings: {}, creditRows: [] });
    const engine = new InvoiceMathEngine(supabase as never);
    const result = await engine.calculateInvoice(BASE_INPUT);

    expect(result.subtotal).toBe(50);
    expect(result.applied_credits).toBe(0);
    expect(result.tax_amount).toBe(0);
    expect(result.amount_due).toBe(50);
  });

  it('clamps amount_due to zero when credits exceed subtotal + tax', async () => {
    const ledgerRow = {
      id: 'row-3',
      tenant_id: 'tenant-1',
      subscription_id: 'sub-1',
      price_version_id: 'pv-1',
      meter_key: 'agent_invocations',
      period_start: '2026-01-01',
      period_end: '2026-01-31',
      quantity_used: 1,
      quantity_included: 0,
      quantity_overage: 1,
      unit_price: 10,
      amount: 10,
      rated_at: '2026-01-31T00:00:00Z',
      source_aggregate_hash: 'ghi',
    };

    const supabase = makeSupabase({
      ledgerRows: [ledgerRow],
      orgSettings: {},
      creditRows: [{ amount_cents: 5000, entry_type: 'grant' }], // $50 > $10 subtotal
    });

    const engine = new InvoiceMathEngine(supabase as never);
    const result = await engine.calculateInvoice(BASE_INPUT);

    expect(result.amount_due).toBe(0);
  });
});
