/**
 * Credits Ledger Service
 *
 * Manages the billing_credits_ledger table: an append-only log of credit
 * grants and invoice debits. The available balance for a tenant is the sum
 * of all rows (grants are positive, debits are negative).
 *
 * Debits are idempotent: re-running the same (tenant, subscription,
 * period_start, period_end) combination is a no-op (ON CONFLICT DO NOTHING).
 */

import { type SupabaseClient } from '@supabase/supabase-js';

import { createLogger } from '../../lib/logger.js';

const logger = createLogger({ component: 'CreditsLedgerService' });

export type CreditEntryType = 'grant' | 'invoice_debit' | 'manual_adjustment' | 'expiry';

export interface CreditEntry {
  id: string;
  tenant_id: string;
  amount_cents: number;
  entry_type: CreditEntryType;
  invoice_period_start?: string | null;
  invoice_period_end?: string | null;
  subscription_id?: string | null;
  description?: string | null;
  created_at: string;
  created_by: string;
}

export interface ApplyCreditsResult {
  /** Amount applied in dollars (0 if no credits available). */
  appliedDollars: number;
  /** Whether a new debit row was written (false = already applied / idempotent). */
  debited: boolean;
}

export class CreditsLedgerService {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Returns the available credit balance in dollars for a tenant.
   * Issues a single SUM aggregate query — O(1) data transfer regardless of
   * ledger size, replacing the previous full table scan + JS reduce.
   */
  async getBalanceDollars(tenantId: string): Promise<number> {
    const { data, error } = await this.supabase
      .from('billing_credits_ledger')
      .select('amount_cents.sum()')
      .eq('tenant_id', tenantId)
      .single();

    if (error) {
      logger.error('Failed to fetch credits balance', error, { tenantId });
      // Fail safe: return 0 so invoice calculation proceeds without credits
      return 0;
    }

    const totalCents = (data as { sum: number | null } | null)?.sum ?? 0;
    return Math.max(0, totalCents) / 100;
  }

  /**
   * Applies available credits against an invoice amount.
   *
   * Writes a debit row for MIN(available_balance, invoice_subtotal).
   * The insert is idempotent: if a debit for this (tenant, subscription,
   * period_start, period_end) already exists, the call is a no-op and
   * returns the previously applied amount.
   *
   * @returns appliedDollars — the credit amount to subtract from the invoice.
   */
  async applyCreditsToInvoice(params: {
    tenantId: string;
    subscriptionId: string;
    periodStart: string;
    periodEnd: string;
    invoiceSubtotalDollars: number;
  }): Promise<ApplyCreditsResult> {
    const { tenantId, subscriptionId, periodStart, periodEnd, invoiceSubtotalDollars } = params;

    // Check for an existing debit (idempotency read)
    const { data: existing, error: readErr } = await this.supabase
      .from('billing_credits_ledger')
      .select('amount_cents')
      .eq('tenant_id', tenantId)
      .eq('subscription_id', subscriptionId)
      .eq('invoice_period_start', periodStart)
      .eq('invoice_period_end', periodEnd)
      .eq('entry_type', 'invoice_debit')
      .maybeSingle();

    if (readErr) {
      logger.error('Failed to check existing credit debit', readErr, { tenantId, subscriptionId });
      return { appliedDollars: 0, debited: false };
    }

    if (existing) {
      // Already applied — return the previously recorded amount (stored as negative cents)
      const appliedDollars = Math.abs(existing.amount_cents) / 100;
      logger.info('Credits already applied for this period (idempotent)', {
        tenantId,
        subscriptionId,
        appliedDollars,
      });
      return { appliedDollars, debited: false };
    }

    const balanceDollars = await this.getBalanceDollars(tenantId);
    if (balanceDollars <= 0) {
      return { appliedDollars: 0, debited: false };
    }

    const appliedDollars = Math.min(balanceDollars, invoiceSubtotalDollars);
    const debitCents = -Math.round(appliedDollars * 100); // negative = debit

    const { error: insertErr } = await this.supabase
      .from('billing_credits_ledger')
      .insert({
        tenant_id: tenantId,
        amount_cents: debitCents,
        entry_type: 'invoice_debit',
        invoice_period_start: periodStart,
        invoice_period_end: periodEnd,
        subscription_id: subscriptionId,
        description: `Invoice debit for period ${periodStart} – ${periodEnd}`,
        created_by: 'InvoiceMathEngine',
      });

    if (insertErr) {
      // Unique constraint violation: a concurrent process won the race and already
      // wrote the debit. Re-read the winning row to return its exact amount rather
      // than our locally-computed value (which may differ if the balance changed
      // between our read and the concurrent insert).
      if (insertErr.code === '23505') {
        const { data: winner, error: winnerErr } = await this.supabase
          .from('billing_credits_ledger')
          .select('amount_cents')
          .eq('tenant_id', tenantId)
          .eq('subscription_id', subscriptionId)
          .eq('invoice_period_start', periodStart)
          .eq('invoice_period_end', periodEnd)
          .eq('entry_type', 'invoice_debit')
          .maybeSingle();

        const winnerDollars = (!winnerErr && winner)
          ? Math.abs(winner.amount_cents) / 100
          : appliedDollars; // fall back to local estimate if re-read fails

        logger.info('Concurrent credit debit detected — returning winner amount', {
          tenantId,
          subscriptionId,
          appliedDollars: winnerDollars,
        });
        return { appliedDollars: winnerDollars, debited: false };
      }
      logger.error('Failed to write credit debit', insertErr, { tenantId, subscriptionId });
      return { appliedDollars: 0, debited: false };
    }

    logger.info('Credits applied to invoice', {
      tenantId,
      subscriptionId,
      appliedDollars,
      remainingBalanceDollars: balanceDollars - appliedDollars,
    });

    return { appliedDollars, debited: true };
  }

  /**
   * Grants credits to a tenant (e.g. from a promotion or manual adjustment).
   */
  async grantCredits(params: {
    tenantId: string;
    amountDollars: number;
    description: string;
    createdBy?: string;
  }): Promise<CreditEntry> {
    const { tenantId, amountDollars, description, createdBy = 'system' } = params;
    const amountCents = Math.round(amountDollars * 100);

    const { data, error } = await this.supabase
      .from('billing_credits_ledger')
      .insert({
        tenant_id: tenantId,
        amount_cents: amountCents,
        entry_type: 'grant',
        description,
        created_by: createdBy,
      })
      .select()
      .single();

    if (error) {
      logger.error('Failed to grant credits', error, { tenantId, amountDollars });
      throw error;
    }

    logger.info('Credits granted', { tenantId, amountDollars });
    return data as CreditEntry;
  }
}
