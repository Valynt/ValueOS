/**
 * Invoice Math Engine
 * Deterministic invoice calculation engine
 */

import { type SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { createLogger } from '../../lib/logger.js';
import { BillingMetric } from '../../config/billing.js';

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
  metadata?: Record<string, any>;
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
}

export interface InvoiceCalculationInput {
  tenant_id: string;
  subscription_id: string;
  period_start: string;
  period_end: string;
  currency?: string;
}

export class InvoiceMathEngine {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Calculate invoice deterministically
   */
  async calculateInvoice(input: InvoiceCalculationInput): Promise<InvoiceCalculation> {
    const { tenant_id, subscription_id, period_start, period_end, currency = 'usd' } = input;

    logger.info('Starting invoice calculation', { tenant_id, subscription_id, period_start, period_end });

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

    // Apply credits/discounts (placeholder)
    const appliedCredits = await this.calculateAppliedCredits(tenant_id, period_start, period_end);

    // Calculate tax (placeholder - would integrate with tax service)
    const taxAmount = this.calculateTaxAmount(subtotal - appliedCredits, tenant_id);

    const totalAmount = subtotal - appliedCredits + taxAmount;
    const amountDue = Math.max(0, totalAmount); // Ensure non-negative

    // Generate calculation hash for determinism verification
    const calculationHash = this.generateCalculationHash({
      tenant_id,
      subscription_id,
      period_start,
      period_end,
      currency,
      lineItems,
      subtotal,
      appliedCredits,
      taxAmount,
      totalAmount,
      amountDue
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
      calculation_hash: calculationHash
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
  ): Promise<any[]> {
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

    return data || [];
  }

  /**
   * Calculate line items from ledger entries
   */
  private calculateLineItems(ledgerEntries: any[]): InvoiceLineItem[] {
    const lineItems: InvoiceLineItem[] = [];

    // Group by meter key and period
    const grouped = new Map<string, any[]>();

    for (const entry of ledgerEntries) {
      const key = `${entry.meter_key}_${entry.period_start}_${entry.period_end}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(entry);
    }

    // Create line items
    for (const [key, entries] of grouped) {
      if (entries.length === 0) continue;

      const firstEntry = entries[0];

      // Aggregate quantities and amounts
      const totalIncluded = entries.reduce((sum, e) => sum + e.quantity_included, 0);
      const totalOverage = entries.reduce((sum, e) => sum + e.quantity_overage, 0);
      const totalAmount = entries.reduce((sum, e) => sum + e.amount, 0);

      // Use the latest price version
      const latestEntry = entries.sort((a, b) =>
        new Date(b.rated_at).getTime() - new Date(a.rated_at).getTime()
      )[0];

      const lineItem: InvoiceLineItem = {
        tenant_id: firstEntry.tenant_id,
        subscription_id: firstEntry.subscription_id,
        price_version_id: latestEntry.price_version_id,
        meter_key: firstEntry.meter_key,
        period_start: firstEntry.period_start,
        period_end: firstEntry.period_end,
        quantity_included: totalIncluded,
        quantity_overage: totalOverage,
        unit_price: latestEntry.unit_price,
        amount: totalAmount,
        description: this.generateLineItemDescription(firstEntry.meter_key, totalIncluded, totalOverage),
        metadata: {
          source_aggregate_hashes: entries.map(e => e.source_aggregate_hash),
          rated_at: latestEntry.rated_at,
          entry_count: entries.length
        }
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
   * Calculate applied credits (placeholder)
   */
  private async calculateAppliedCredits(
    tenantId: string,
    periodStart: string,
    periodEnd: string
  ): Promise<number> {
    // TODO: Implement credit system
    // This would check for account credits, promotional credits, etc.
    return 0;
  }

  /**
   * Calculate tax amount (placeholder)
   */
  private calculateTaxAmount(
    taxableAmount: number,
    tenantId: string
  ): number {
    // TODO: Integrate with tax calculation service
    // For now, assume 0 tax or simple calculation
    return 0;
  }

  /**
   * Generate calculation hash for determinism verification
   */
  private generateCalculationHash(data: any): string {
    // Create a deterministic string representation
    const canonicalData = JSON.stringify(data, Object.keys(data).sort());

    // Use crypto hash (in Node.js environment)
    return crypto.createHash('sha256').update(canonicalData).digest('hex');
  }

  /**
   * Verify invoice calculation determinism
   */
  async verifyCalculation(
    originalCalculation: InvoiceCalculation,
    tenantId: string,
    subscriptionId: string,
    periodStart: string,
    periodEnd: string
  ): Promise<boolean> {
    try {
      // Recalculate with same inputs
      const newCalculation = await this.calculateInvoice({
        tenant_id: tenantId,
        subscription_id: subscriptionId,
        period_start: periodStart,
        period_end: periodEnd,
        currency: originalCalculation.currency
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
      logger.error('Error verifying calculation', error as Error);
      return false;
    }
  }

  /**
   * Get invoice preview for upcoming period
   */
  async calculateUpcomingInvoice(
    tenantId: string,
    subscriptionId: string,
    previewDate?: string
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
      logger.error('Error calculating upcoming invoice', error as Error);
      return null;
    }
  }
}
