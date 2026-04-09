/**
 * Invoice Math Engine
 * Deterministic invoice calculation engine
 */

import crypto from 'crypto';

import { type SupabaseClient } from '@supabase/supabase-js';

import { BillingMetric } from '../../config/billing.js';
import { createLogger } from '../../lib/logger.js';
import { CreditLedgerService } from './CreditLedgerService.js';

const logger = createLogger({ component: 'InvoiceMathEngine' });

export interface InvoiceLineItem {
  id?: string;
  tenant_id: string;
  subscription_id: string;
  price_version_id: string;
  meter_key: BillingMetric;
  period_start: string;
  period_end: string;
  quantity_included: number;
  quantity_overage: number;
  unit_price: number;
  amount: number;
  description: string;
  metadata?: Record<string, unknown>;
}

/** Shape of a row returned from the rated_ledger table. */
interface RatedLedgerRow {
  id: string;
  tenant_id: string;
  subscription_id: string;
  price_version_id: string;
  meter_key: string;
  period_start: string;
  period_end: string;
  quantity_used: number;
  quantity_included: number;
  quantity_overage: number;
  unit_price: number;
  amount: number;
  rated_at: string;
  source_aggregate_hash: string;
}

export interface InvoiceCalculation {
  tenant_id: string;
  subscription_id: string;
  period_start: string;
  period_end: string;
  currency: string;
  line_items: InvoiceLineItem[];
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  applied_credits: number;
  amount_due: number;
  calculation_hash: string; // For determinism verification
  /**
   * The invoice ID used when credits were consumed. Stored so that
   * verifyCalculation can re-run with the same ID and get the idempotent
   * debit amount rather than the current live balance.
   */
  invoice_id?: string;
}

export interface InvoiceCalculationInput {
  tenant_id: string;
  subscription_id: string;
  period_start: string;
  period_end: string;
  currency?: string;
  /**
   * When provided, credits are atomically debited against this invoice ID via
   * the billing_credit_ledger. The debit is idempotent: re-running with the
   * same invoice_id returns the previously recorded debit amount.
   *
   * When omitted (e.g. preview/estimate calls), the credit balance is read
   * but NOT consumed — no ledger row is written.
   */
  invoice_id?: string;
}

export class InvoiceMathEngine {
  private supabase: SupabaseClient;
  private creditLedger: CreditLedgerService;

  // Singleton for static-style access used by tests.
  private static _instance: InvoiceMathEngine | null = null;

  private static getInstance(): InvoiceMathEngine {
    if (!InvoiceMathEngine._instance) {
      InvoiceMathEngine._instance = new InvoiceMathEngine({} as SupabaseClient);
    }
    return InvoiceMathEngine._instance;
  }

  static async calculateInvoice(input: InvoiceCalculationInput): Promise<InvoiceCalculation> {
    return InvoiceMathEngine.getInstance().calculateInvoice(input);
  }

  static async verifyCalculation(
    originalCalculation: InvoiceCalculation,
    tenantId: string,
    subscriptionId: string,
    periodStart: string,
    periodEnd: string
  ): Promise<boolean> {
    return InvoiceMathEngine.getInstance().verifyCalculation(
      originalCalculation,
      tenantId,
      subscriptionId,
      periodStart,
      periodEnd
    );
  }

  constructor(supabase: SupabaseClient, creditLedger?: CreditLedgerService) {
    this.supabase = supabase;
    this.creditLedger = creditLedger ?? new CreditLedgerService(supabase);
  }

  // For testing: allow setting a custom instance with mocked dependencies
  static _setInstanceForTesting(instance: InvoiceMathEngine | null): void {
    InvoiceMathEngine._instance = instance;
  }

  // For testing: reset the singleton to force recreation
  static _resetInstanceForTesting(): void {
    InvoiceMathEngine._instance = null;
  }

  /**
   * Calculate invoice deterministically.
   *
   * When `invoice_id` is present in the input, credits are atomically debited
   * from the billing_credit_ledger via the `consume_invoice_credits` RPC.
   * The debit is idempotent — re-running with the same invoice_id returns the
   * same result without double-charging.
   *
   * When `invoice_id` is absent (preview/estimate), the current credit balance
   * is read for display purposes but no ledger row is written.
   */
  async calculateInvoice(input: InvoiceCalculationInput): Promise<InvoiceCalculation> {
    const { tenant_id, subscription_id, period_start, period_end, currency = 'usd', invoice_id } = input;

    logger.info('Starting invoice calculation', { tenant_id, subscription_id, period_start, period_end, invoice_id });

    // Get rated ledger entries for the period
    const ledgerEntries = await this.getRatedLedgerEntries(
      tenant_id,
      subscription_id,
      period_start,
      period_end
    );

    // Group by meter and calculate line items
    const lineItems = this.calculateLineItems(ledgerEntries);

    // Calculate totals
    const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);

    // Fetch tenant settings for tax derivation only (credits now come from the ledger).
    const tenantSettings = await this.fetchTenantSettings(tenant_id);

    // Apply credits from the ledger.
    // - With invoice_id: atomically debit the ledger (idempotent).
    // - Without invoice_id: read balance for preview, do not write.
    const appliedCredits = await this.applyCreditsFromLedger(tenant_id, invoice_id, subtotal);

    const taxAmount = this.calculateTaxAmount(subtotal - appliedCredits, tenant_id, tenantSettings);

    const totalAmount = subtotal - appliedCredits + taxAmount;
    const amountDue = Math.max(0, totalAmount); // Ensure non-negative

    // Hash only stable scalar inputs — floating-point line item amounts are
    // excluded to avoid non-determinism across CPU/runtime versions.
    // credits_finalised distinguishes a finalised invoice (credits consumed via
    // the ledger RPC) from a preview (balance read only, no debit written).
    // Without this flag, a preview and a finalised calculation for the same
    // period could produce the same hash when the balance equals the debit.
    const calculationHash = this.generateCalculationHash({
      tenant_id,
      subscription_id,
      period_start,
      period_end,
      currency,
      subtotal: Math.round(subtotal * 100),
      applied_credits: Math.round(appliedCredits * 100),
      tax_amount: Math.round(taxAmount * 100),
      total_amount: Math.round(totalAmount * 100),
      credits_finalised: invoice_id !== undefined,
    });

    const calculation: InvoiceCalculation = {
      tenant_id,
      subscription_id,
      period_start,
      period_end,
      currency,
      line_items: lineItems,
      subtotal,
      tax_amount: taxAmount,
      total_amount: totalAmount,
      applied_credits: appliedCredits,
      amount_due: amountDue,
      calculation_hash: calculationHash,
      ...(invoice_id ? { invoice_id } : {}),
    };

    logger.info('Invoice calculation completed', {
      tenant_id,
      lineItemCount: lineItems.length,
      subtotal,
      totalAmount,
      amountDue,
      calculationHash
    });

    return calculation;
  }

  /**
   * Get rated ledger entries for invoice calculation
   */
  private async getRatedLedgerEntries(
    tenantId: string,
    subscriptionId: string,
    periodStart: string,
    periodEnd: string
  ): Promise<RatedLedgerRow[]> {
    const { data, error } = await this.supabase
      .from('rated_ledger')
      .select(`
        id,
        tenant_id,
        subscription_id,
        price_version_id,
        meter_key,
        period_start,
        period_end,
        quantity_used,
        quantity_included,
        quantity_overage,
        unit_price,
        amount,
        rated_at,
        source_aggregate_hash
      `)
      .eq('tenant_id', tenantId)
      .eq('subscription_id', subscriptionId)
      .gte('period_start', periodStart)
      .lte('period_end', periodEnd)
      .order('period_start', { ascending: true });

    if (error) {
      logger.error('Error fetching rated ledger entries', error);
      throw new Error('Failed to fetch rated ledger entries');
    }

    return (data ?? []) as RatedLedgerRow[];
  }

  /**
   * Calculate line items from ledger entries
   */
  private calculateLineItems(ledgerEntries: RatedLedgerRow[]): InvoiceLineItem[] {
    const lineItems: InvoiceLineItem[] = [];

    // Group by meter key and period
    const grouped = new Map<string, RatedLedgerRow[]>();

    for (const entry of ledgerEntries) {
      const key = `${entry.meter_key}_${entry.period_start}_${entry.period_end}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(entry);
    }

    // Create line items
    for (const [_key, entries] of grouped) {
      if (entries.length === 0) continue;

      const firstEntry = entries[0];

      // Aggregate quantities and amounts
      const totalIncluded = entries.reduce((sum, e) => sum + e.quantity_included, 0);
      const totalOverage = entries.reduce((sum, e) => sum + e.quantity_overage, 0);
      const totalAmount = entries.reduce((sum, e) => sum + e.amount, 0);

      // Use the latest price version
      const latestEntry = [...entries].sort((a, b) =>
        new Date(b.rated_at).getTime() - new Date(a.rated_at).getTime()
      )[0];

      const lineItem: InvoiceLineItem = {
        tenant_id: firstEntry.tenant_id,
        subscription_id: firstEntry.subscription_id,
        price_version_id: latestEntry.price_version_id,
        meter_key: firstEntry.meter_key as BillingMetric,
        period_start: firstEntry.period_start,
        period_end: firstEntry.period_end,
        quantity_included: totalIncluded,
        quantity_overage: totalOverage,
        unit_price: latestEntry.unit_price,
        amount: totalAmount,
        description: this.generateLineItemDescription(firstEntry.meter_key as BillingMetric, totalIncluded, totalOverage),
        metadata: {
          source_aggregate_hashes: entries.map(e => e.source_aggregate_hash),
          rated_at: latestEntry.rated_at,
          entry_count: entries.length,
        },
      };

      lineItems.push(lineItem);
    }

    return lineItems;
  }

  /**
   * Generate description for line item
   */
  private generateLineItemDescription(
    meterKey: BillingMetric,
    included: number,
    overage: number
  ): string {
    const meterNames: Record<BillingMetric, string> = {
      llm_tokens: 'LLM Tokens',
      api_calls: 'API Calls',
      agent_executions: 'Agent Executions',
      storage_gb: 'Storage (GB)',
      user_seats: 'User Seats'
    };

    const name = meterNames[meterKey] || meterKey;
    const total = included + overage;

    if (overage > 0) {
      return `${name}: ${total.toLocaleString()} (${included.toLocaleString()} included + ${overage.toLocaleString()} overage)`;
    } else {
      return `${name}: ${total.toLocaleString()}`;
    }
  }

  /**
   * Fetch tenant settings from organizations once per invoice calculation.
   * Used for tax derivation only. Returns null on any error.
   */
  private async fetchTenantSettings(tenantId: string): Promise<Record<string, unknown> | null> {
    try {
      const { data, error } = await this.supabase
        .from('organizations')
        .select('settings')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (error || !data) return null;
      return (data.settings as Record<string, unknown> | null) ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Apply credits from the billing_credit_ledger.
   *
   * When `invoiceId` is provided, the RPC atomically debits the lesser of
   * (subtotal_cents, available_balance_cents) and returns the actual debit.
   * The UNIQUE(invoice_id) constraint in the database prevents the same
   * invoice from being debited twice, even under concurrent execution.
   *
   * When `invoiceId` is absent (preview), the current balance is read without
   * writing any ledger row.
   *
   * Errors are re-thrown so the caller (calculateInvoice) fails loudly rather
   * than silently issuing an invoice that omits the customer's credits.
   *
   * Returns the applied credit amount in dollars.
   */
  private async applyCreditsFromLedger(
    tenantId: string,
    invoiceId: string | undefined,
    subtotal: number
  ): Promise<number> {
    if (invoiceId) {
      // Atomic consume — writes a debit row, idempotent on invoice_id.
      // Errors propagate: a failed debit must block the invoice rather than
      // silently overcharge the customer.
      const subtotalCents = Math.round(subtotal * 100);
      const { debited_cents } = await this.creditLedger.consumeCreditsForInvoice(
        tenantId,
        invoiceId,
        subtotalCents
      );
      return debited_cents / 100;
    } else {
      // Preview only — read balance without consuming.
      // Errors here are non-fatal: a preview with missing credits is acceptable.
      try {
        const balanceCents = await this.creditLedger.getBalanceCents(tenantId);
        const applicableCents = Math.min(balanceCents, Math.round(subtotal * 100));
        return applicableCents / 100;
      } catch (err) {
        logger.warn('Failed to read credit balance for preview — showing zero credits', err);
        return 0;
      }
    }
  }

  /**
   * Derive tax from pre-fetched tenant settings.
   *
   * Lookup order:
   * 1. `BILLING_TAX_RATE_OVERRIDE` env var (decimal, e.g. "0.08" for 8%)
   * 2. `organizations.settings->tax_rate` (decimal stored in JSONB)
   * 3. Default: 0 — correct for most B2B SaaS below economic nexus thresholds
   *
   * Returns the tax amount in the same currency unit as taxableAmount.
   */
  private calculateTaxAmount(
    taxableAmount: number,
    tenantId: string,
    settings: Record<string, unknown> | null,
  ): number {
    if (taxableAmount <= 0) return 0;

    // 1. Env override
    const envRate = process.env['BILLING_TAX_RATE_OVERRIDE'];
    if (envRate) {
      const rate = parseFloat(envRate);
      if (!isNaN(rate) && rate >= 0 && rate <= 1) {
        return Math.round(taxableAmount * rate * 100) / 100;
      }
      logger.warn('BILLING_TAX_RATE_OVERRIDE is not a valid decimal (0–1) — skipping', { tenantId, envRate });
    }

    // 2. Per-tenant rate from settings
    const taxRate = settings?.['tax_rate'];
    if (typeof taxRate === 'number' && taxRate > 0 && taxRate <= 1) {
      return Math.round(taxableAmount * taxRate * 100) / 100;
    }

    // 3. Default: no tax
    return 0;
  }

  /**
   * Generate calculation hash for determinism verification.
   * Sorts keys before serialising so field insertion order doesn't affect the hash.
   */
  private generateCalculationHash(data: Record<string, unknown>): string {
    const canonicalData = JSON.stringify(data, Object.keys(data).sort());
    return crypto.createHash('sha256').update(canonicalData).digest('hex');
  }

  /**
   * Verify invoice calculation determinism
   *
   * Re-runs the calculation with the same inputs as the original, including
   * the original invoice_id so the idempotent RPC returns the recorded debit
   * amount rather than the current live balance. Without this, any invoice
   * that had credits applied would always produce a hash mismatch.
   */
  async verifyCalculation(
    originalCalculation: InvoiceCalculation,
    tenantId: string,
    subscriptionId: string,
    periodStart: string,
    periodEnd: string
  ): Promise<boolean> {
    try {
      // Recalculate with same inputs, including the original invoice_id so
      // credit application is idempotent and produces the same applied_credits.
      const newCalculation = await this.calculateInvoice({
        tenant_id: tenantId,
        subscription_id: subscriptionId,
        period_start: periodStart,
        period_end: periodEnd,
        currency: originalCalculation.currency,
        invoice_id: originalCalculation.invoice_id,
      });

      // Compare hashes
      const hashesMatch = newCalculation.calculation_hash === originalCalculation.calculation_hash;

      if (!hashesMatch) {
        logger.warn('Invoice calculation hash mismatch', {
          tenantId,
          subscriptionId,
          originalHash: originalCalculation.calculation_hash,
          newHash: newCalculation.calculation_hash
        });
      }

      return hashesMatch;
    } catch (error) {
      logger.error('Error verifying calculation', error);
      return false;
    }
  }

  /**
   * Get invoice preview for upcoming period
   */
  async calculateUpcomingInvoice(
    tenantId: string,
    subscriptionId: string,
    _previewDate?: string
  ): Promise<InvoiceCalculation | null> {
    try {
      // Get subscription details to determine billing period
      const { data: subscription, error } = await this.supabase
        .from('subscriptions')
        .select('current_period_start, current_period_end')
        .eq('id', subscriptionId)
        .single();

      if (error || !subscription) {
        logger.warn('Subscription not found for upcoming invoice', { subscriptionId });
        return null;
      }

      const periodStart = subscription.current_period_start;
      const periodEnd = subscription.current_period_end;

      // For preview, we might estimate based on current usage trends
      // For now, just calculate based on existing ledger entries
      return await this.calculateInvoice({
        tenant_id: tenantId,
        subscription_id: subscriptionId,
        period_start: periodStart,
        period_end: periodEnd
      });
    } catch (error) {
      logger.error('Error calculating upcoming invoice', error);
      return null;
    }
  }
}
