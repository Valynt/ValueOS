/**
 * InvoiceMathEngine — unit tests
 *
 * Covers the tax-on-post-credit-amount regression: tax must be applied to
 * (subtotal - credits), not the gross subtotal.
 *
 * Credits are now sourced from billing_credit_balances (view) and consumed
 * via the consume_invoice_credits RPC, not from organizations.settings JSONB.
 */

import { describe, expect, it, vi } from 'vitest';

import { InvoiceMathEngine } from '../InvoiceMathEngine.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal Supabase client stub.
 *
 * @param creditBalanceCents  Spendable credit balance for the tenant (cents).
 *                            The RPC will debit up to this amount.
 * @param orgSettings         Tenant settings used for tax_rate derivation.
 * @param ledgerRows          Rated-ledger rows for the billing period.
 */
function makeSupabase(overrides: {
  ledgerRows?: unknown[];
  orgSettings?: Record<string, unknown> | null;
  /** Credit balance in cents (replaces the old billing_credits JSONB field). */
  creditBalanceCents?: number;
} = {}) {
  const ledgerRows = overrides.ledgerRows ?? [];
  const orgSettings = overrides.orgSettings ?? null;
  let remainingBalance = overrides.creditBalanceCents ?? 0;

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

  // billing_credit_balances view — returns current balance.
  const creditBalancesChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockImplementation(async () => ({
      data: remainingBalance > 0 ? { balance_cents: remainingBalance } : null,
      error: null,
    })),
  };

  // consume_invoice_credits RPC — atomically debits and updates remainingBalance.
  // Idempotent: re-calling with the same invoice_id returns the original debit.
  const debitedInvoices = new Map<string, number>();
  const rpc = vi.fn().mockImplementation(
    async (_fn: string, params: { p_invoice_id: string; p_amount_cents: number }) => {
      const { p_invoice_id, p_amount_cents } = params;
      // Idempotency: return the previously recorded debit for this invoice.
      if (debitedInvoices.has(p_invoice_id)) {
        return { data: debitedInvoices.get(p_invoice_id), error: null };
      }
      const debit = Math.min(p_amount_cents, remainingBalance);
      remainingBalance -= debit;
      debitedInvoices.set(p_invoice_id, debit);
      return { data: debit, error: null };
    }
  );

  return {
    from: vi.fn((table: string) => {
      if (table === 'rated_ledger') return ratedLedgerChain;
      if (table === 'organizations') return orgChain;
      if (table === 'billing_credit_balances') return creditBalancesChain;
      return ratedLedgerChain;
    }),
    rpc,
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
    // subtotal = $100, credits = $20 (2000 cents), taxable base = $80, tax rate = 10%
    // expected tax = $8.00, not $10.00
    const ledgerRow = {
      id: 'row-1',
      tenant_id: 'tenant-1',
      subscription_id: 'sub-1',
      price_version_id: 'pv-1',
      meter_key: 'agent_executions',
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
      creditBalanceCents: 2000, // $20.00
      orgSettings: { tax_rate: 0.1 }, // 10%
    });

    const engine = new InvoiceMathEngine(supabase as never);
    // Provide invoice_id so credits are atomically consumed (not preview mode).
    const result = await engine.calculateInvoice({ ...BASE_INPUT, invoice_id: 'inv-001' });

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
      meter_key: 'agent_executions',
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

    const supabase = makeSupabase({ ledgerRows: [ledgerRow], creditBalanceCents: 0, orgSettings: {} });
    const engine = new InvoiceMathEngine(supabase as never);
    const result = await engine.calculateInvoice({ ...BASE_INPUT, invoice_id: 'inv-002' });

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
      meter_key: 'agent_executions',
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
      creditBalanceCents: 5000, // $50 credits > $10 subtotal
    });

    const engine = new InvoiceMathEngine(supabase as never);
    const result = await engine.calculateInvoice({ ...BASE_INPUT, invoice_id: 'inv-003' });

    expect(result.amount_due).toBe(0);
  });

  it('preview mode (no invoice_id) reads balance but does not call the consume RPC', async () => {
    const ledgerRow = {
      id: 'row-4',
      tenant_id: 'tenant-1',
      subscription_id: 'sub-1',
      price_version_id: 'pv-1',
      meter_key: 'agent_executions',
      period_start: '2026-01-01',
      period_end: '2026-01-31',
      quantity_used: 5,
      quantity_included: 0,
      quantity_overage: 5,
      unit_price: 10,
      amount: 50,
      rated_at: '2026-01-31T00:00:00Z',
      source_aggregate_hash: 'jkl',
    };

    const supabase = makeSupabase({ ledgerRows: [ledgerRow], creditBalanceCents: 1000 });
    const engine = new InvoiceMathEngine(supabase as never);

    // No invoice_id — preview mode.
    const result = await engine.calculateInvoice(BASE_INPUT);

    expect(result.applied_credits).toBe(10); // $10 from 1000 cents balance
    // RPC must NOT have been called — no debit written.
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('propagates ledger errors during finalisation rather than silently overcharging', async () => {
    const ledgerRow = {
      id: 'row-err',
      tenant_id: 'tenant-1',
      subscription_id: 'sub-1',
      price_version_id: 'pv-1',
      meter_key: 'agent_executions',
      period_start: '2026-01-01',
      period_end: '2026-01-31',
      quantity_used: 5,
      quantity_included: 0,
      quantity_overage: 5,
      unit_price: 10,
      amount: 50,
      rated_at: '2026-01-31T00:00:00Z',
      source_aggregate_hash: 'err',
    };

    // RPC fails — simulates a transient DB error during credit consumption.
    const supabase = {
      ...makeSupabase({ ledgerRows: [ledgerRow], creditBalanceCents: 1000 }),
      rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'connection timeout' } }),
    };

    const engine = new InvoiceMathEngine(supabase as never);

    // Must throw, not silently issue an invoice with zero credits applied.
    await expect(
      engine.calculateInvoice({ ...BASE_INPUT, invoice_id: 'inv-err' })
    ).rejects.toThrow('Failed to consume credits');
  });

  it('does not double-apply credits when the same invoice_id is calculated twice', async () => {
    const ledgerRow = {
      id: 'row-5',
      tenant_id: 'tenant-1',
      subscription_id: 'sub-1',
      price_version_id: 'pv-1',
      meter_key: 'agent_executions',
      period_start: '2026-01-01',
      period_end: '2026-01-31',
      quantity_used: 10,
      quantity_included: 0,
      quantity_overage: 10,
      unit_price: 10,
      amount: 100,
      rated_at: '2026-01-31T00:00:00Z',
      source_aggregate_hash: 'mno',
    };

    // The RPC stub in makeSupabase is idempotent: second call with same
    // invoice_id returns the original debit without re-decrementing balance.
    // Here we verify the engine calls the RPC (not the old static path) and
    // that the result is consistent across two runs.
    const supabase = makeSupabase({ ledgerRows: [ledgerRow], creditBalanceCents: 5000 });
    const engine = new InvoiceMathEngine(supabase as never);

    const first = await engine.calculateInvoice({ ...BASE_INPUT, invoice_id: 'inv-004' });
    const second = await engine.calculateInvoice({ ...BASE_INPUT, invoice_id: 'inv-004' });

    // Both runs should report the same applied_credits.
    expect(first.applied_credits).toBe(second.applied_credits);
    // RPC called twice (engine delegates idempotency to the DB layer).
    expect(supabase.rpc).toHaveBeenCalledTimes(2);
  });

  it('preview and finalised calculations produce different hashes for the same period', async () => {
    // Ensures verifyCalculation cannot be fooled by passing a preview result
    // as the original when the balance happens to equal the recorded debit.
    const ledgerRow = {
      id: 'row-hash',
      tenant_id: 'tenant-1',
      subscription_id: 'sub-1',
      price_version_id: 'pv-1',
      meter_key: 'agent_executions',
      period_start: '2026-01-01',
      period_end: '2026-01-31',
      quantity_used: 5,
      quantity_included: 0,
      quantity_overage: 5,
      unit_price: 10,
      amount: 50,
      rated_at: '2026-01-31T00:00:00Z',
      source_aggregate_hash: 'hash-test',
    };

    const supabase = makeSupabase({ ledgerRows: [ledgerRow], creditBalanceCents: 1000 });
    const engine = new InvoiceMathEngine(supabase as never);

    const preview = await engine.calculateInvoice(BASE_INPUT); // no invoice_id
    const finalised = await engine.calculateInvoice({ ...BASE_INPUT, invoice_id: 'inv-hash' });

    // Same financial amounts, but hashes must differ because credits_finalised differs.
    expect(preview.applied_credits).toBe(finalised.applied_credits);
    expect(preview.calculation_hash).not.toBe(finalised.calculation_hash);
  });

  it('verifyCalculation produces a matching hash for an invoice with applied credits', async () => {
    const ledgerRow = {
      id: 'row-6',
      tenant_id: 'tenant-1',
      subscription_id: 'sub-1',
      price_version_id: 'pv-1',
      meter_key: 'agent_executions',
      period_start: '2026-01-01',
      period_end: '2026-01-31',
      quantity_used: 10,
      quantity_included: 0,
      quantity_overage: 10,
      unit_price: 10,
      amount: 100,
      rated_at: '2026-01-31T00:00:00Z',
      source_aggregate_hash: 'pqr',
    };

    const supabase = makeSupabase({ ledgerRows: [ledgerRow], creditBalanceCents: 2000 });
    const engine = new InvoiceMathEngine(supabase as never);

    // Finalise the invoice — credits are consumed.
    const original = await engine.calculateInvoice({ ...BASE_INPUT, invoice_id: 'inv-005' });
    expect(original.applied_credits).toBe(20);

    // verifyCalculation must re-use the same invoice_id so the idempotent RPC
    // returns the recorded debit (20) rather than the current balance (0 after debit).
    const isValid = await engine.verifyCalculation(
      original,
      BASE_INPUT.tenant_id,
      BASE_INPUT.subscription_id,
      BASE_INPUT.period_start,
      BASE_INPUT.period_end
    );

    expect(isValid).toBe(true);
  });
});
