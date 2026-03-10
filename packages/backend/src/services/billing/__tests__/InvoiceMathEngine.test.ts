/**
 * InvoiceMathEngine — unit tests
 *
 * Covers the tax-on-post-credit-amount regression: tax must be applied to
 * (subtotal - credits), not the gross subtotal.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InvoiceMathEngine } from '../InvoiceMathEngine.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal Supabase client stub. */
function makeSupabase(overrides: {
  ledgerRows?: unknown[];
  orgSettings?: Record<string, unknown> | null;
} = {}) {
  const ledgerRows = overrides.ledgerRows ?? [];
  const orgSettings = overrides.orgSettings ?? null;

  const ledgerChain = {
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

  return {
    from: vi.fn((table: string) => {
      if (table === 'rated_ledger') return ledgerChain;
      if (table === 'organizations') return orgChain;
      return ledgerChain;
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
    // subtotal = $100, credits = $20, taxable base = $80, tax rate = 10%
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
      orgSettings: {
        billing_credits: 2000, // $20.00 in cents
        tax_rate: 0.1,         // 10%
      },
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

    const supabase = makeSupabase({ ledgerRows: [ledgerRow], orgSettings: {} });
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
      orgSettings: { billing_credits: 5000 }, // $50 credits > $10 subtotal
    });

    const engine = new InvoiceMathEngine(supabase as never);
    const result = await engine.calculateInvoice(BASE_INPUT);

    expect(result.amount_due).toBe(0);
  });
});
