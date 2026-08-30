/**
 * Credit Ledger Service
 *
 * Manages the billing_credit_ledger table: issuing credits, querying balances,
 * and atomically consuming credits during invoice finalisation.
 *
 * The ledger is append-only. Each row is either a 'credit' (issuance) or a
 * 'debit' (invoice application). The UNIQUE(invoice_id) constraint in the
 * database is the primary guard against double-application; this service adds
 * an application-layer idempotency check on top.
 */

import { type SupabaseClient } from '@supabase/supabase-js';

import { createLogger } from '../../lib/logger.js';

const logger = createLogger({ component: 'CreditLedgerService' });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreditLedgerEntry {
  id: string;
  tenant_id: string;
  entry_type: 'credit' | 'debit';
  /** Amount in cents. Always positive; entry_type determines direction. */
  amount_cents: number;
  invoice_id: string | null;
  reason: string;
  idempotency_key: string | null;
  created_at: string;
  created_by: string | null;
}

export interface TenantCreditBalance {
  tenant_id: string;
  /** Spendable balance in cents. */
  balance_cents: number;
  credit_count: number;
  debit_count: number;
  last_activity_at: string | null;
}

export interface IssueCreditOptions {
  tenant_id: string;
  /** Amount in cents. Must be > 0. */
  amount_cents: number;
  reason: string;
  /**
   * Caller-supplied idempotency key. Re-issuing with the same key for the
   * same tenant is a no-op that returns the original entry.
   */
  idempotency_key?: string;
  created_by?: string;
}

export interface ConsumeCreditsResult {
  /** Cents actually debited (≤ requested; 0 if balance was empty). */
  debited_cents: number;
  /** Remaining balance after the debit, in cents. */
  remaining_balance_cents: number;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class CreditLedgerService {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Issue credits to a tenant.
   *
   * Idempotent when `idempotency_key` is provided: a second call with the
   * same (tenant_id, idempotency_key) pair returns the existing entry without
   * inserting a duplicate.
   */
  async issueCredit(options: IssueCreditOptions): Promise<CreditLedgerEntry> {
    const { tenant_id, amount_cents, reason, idempotency_key, created_by } = options;

    if (amount_cents <= 0) {
      throw new Error(`amount_cents must be positive, got ${amount_cents}`);
    }

    logger.info('Issuing credit', { tenant_id, amount_cents, reason, idempotency_key });

    const row: Record<string, unknown> = {
      tenant_id,
      entry_type: 'credit',
      amount_cents,
      reason,
    };
    if (idempotency_key) row['idempotency_key'] = idempotency_key;
    if (created_by) row['created_by'] = created_by;

    const { data, error } = await this.supabase
      .from('billing_credit_ledger')
      .insert(row)
      .select()
      .single();

    if (error) {
      // Unique constraint violation on (tenant_id, idempotency_key) — return existing.
      if ((error as { code?: string }).code === '23505' && idempotency_key) {
        logger.info('Credit already issued for idempotency key, returning existing', {
          tenant_id,
          idempotency_key,
        });
        return this.getExistingCreditByIdempotencyKey(tenant_id, idempotency_key);
      }
      logger.error('Failed to issue credit', error);
      throw new Error(`Failed to issue credit: ${error.message}`);
    }

    logger.info('Credit issued', { id: data.id, tenant_id, amount_cents });
    return data as CreditLedgerEntry;
  }

  /**
   * Atomically consume credits for an invoice via the `consume_invoice_credits`
   * database RPC. The RPC holds a per-tenant advisory lock and enforces the
   * UNIQUE(invoice_id) constraint, making this safe under concurrent calls.
   *
   * Returns the amount actually debited and the remaining balance.
   */
  async consumeCreditsForInvoice(
    tenant_id: string,
    invoice_id: string,
    requested_cents: number
  ): Promise<ConsumeCreditsResult> {
    if (requested_cents <= 0) {
      return { debited_cents: 0, remaining_balance_cents: await this.getBalanceCents(tenant_id) };
    }

    logger.info('Consuming credits for invoice', { tenant_id, invoice_id, requested_cents });

    const { data, error } = await this.supabase.rpc('consume_invoice_credits', {
      p_tenant_id: tenant_id,
      p_invoice_id: invoice_id,
      p_amount_cents: requested_cents,
    });

    if (error) {
      logger.error('consume_invoice_credits RPC failed', error);
      throw new Error(`Failed to consume credits: ${error.message}`);
    }

    const debited_cents = (data as number) ?? 0;
    const remaining_balance_cents = await this.getBalanceCents(tenant_id);

    logger.info('Credits consumed', { tenant_id, invoice_id, debited_cents, remaining_balance_cents });

    return { debited_cents, remaining_balance_cents };
  }

  /**
   * Return the current spendable balance for a tenant in cents.
   * Returns 0 if the tenant has no ledger rows.
   */
  async getBalanceCents(tenant_id: string): Promise<number> {
    const { data, error } = await this.supabase
      .from('billing_credit_balances')
      .select('balance_cents')
      .eq('tenant_id', tenant_id)
      .maybeSingle();

    if (error) {
      logger.error('Failed to fetch credit balance', error);
      throw new Error(`Failed to fetch credit balance: ${error.message}`);
    }

    // Clamp to 0: a negative balance indicates a data integrity issue (more
    // debits than credits) but should not propagate as a spendable amount.
    return Math.max(0, (data?.balance_cents as number) ?? 0);
  }

  /**
   * Return the full balance record for a tenant, or null if no ledger rows exist.
   */
  async getBalance(tenant_id: string): Promise<TenantCreditBalance | null> {
    const { data, error } = await this.supabase
      .from('billing_credit_balances')
      .select('*')
      .eq('tenant_id', tenant_id)
      .maybeSingle();

    if (error) {
      logger.error('Failed to fetch credit balance', error);
      throw new Error(`Failed to fetch credit balance: ${error.message}`);
    }

    if (!data) return null;

    return {
      tenant_id: data.tenant_id as string,
      balance_cents: data.balance_cents as number,
      credit_count: data.credit_count as number,
      debit_count: data.debit_count as number,
      last_activity_at: data.last_activity_at as string | null,
    };
  }

  /**
   * Return all ledger entries for a tenant, ordered by creation time.
   */
  async getLedgerEntries(tenant_id: string): Promise<CreditLedgerEntry[]> {
    const { data, error } = await this.supabase
      .from('billing_credit_ledger')
      .select('*')
      .eq('tenant_id', tenant_id)
      .order('created_at', { ascending: true });

    if (error) {
      logger.error('Failed to fetch ledger entries', error);
      throw new Error(`Failed to fetch ledger entries: ${error.message}`);
    }

    return (data ?? []) as CreditLedgerEntry[];
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async getExistingCreditByIdempotencyKey(
    tenant_id: string,
    idempotency_key: string
  ): Promise<CreditLedgerEntry> {
    const { data, error } = await this.supabase
      .from('billing_credit_ledger')
      .select('*')
      .eq('tenant_id', tenant_id)
      .eq('idempotency_key', idempotency_key)
      .single();

    if (error || !data) {
      throw new Error(
        `Could not retrieve existing credit for idempotency key ${idempotency_key}: ${error?.message ?? 'not found'}`
      );
    }

    return data as CreditLedgerEntry;
  }
}
