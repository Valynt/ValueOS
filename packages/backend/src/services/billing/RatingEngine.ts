/**
 * Deterministic Rating Engine
 *
 * Applies pricing rules to aggregated usage and produces immutable rated line items.
 * Core properties: deterministic, reproducible, append-only ledger.
 */

import crypto from "node:crypto";

import type { MeterKey } from "@shared/types/billing-events";
import { type SupabaseClient } from "@supabase/supabase-js";

import { createLogger } from "../../lib/logger.js";

import type { EntitlementSnapshot } from "./EntitlementSnapshotService.js";
import type { MeterPricing, PriceVersion, PriceVersionDefinition } from "./PriceVersionService.js";

const logger = createLogger({ component: "RatingEngine" });

// ============================================================================
// Types
// ============================================================================

export interface UsageAggregate {
  tenant_id: string;
  meter_key: MeterKey;
  period_start: string;
  period_end: string;
  total_quantity: number;
  source_event_count: number;
  source_hash: string;
}

export interface RatedLineItem {
  id: string;
  tenant_id: string;
  subscription_id: string;
  price_version_id: string;
  meter_key: MeterKey;
  period_start: string;
  period_end: string;
  quantity_used: number;
  quantity_included: number;
  quantity_overage: number;
  unit_price: number;
  amount: number;
  rated_at: string;
  rated_by: string; // service identifier
  source_aggregate_hash: string;
}

export interface RatingContext {
  tenantId: string;
  subscriptionId: string;
  priceVersion: PriceVersion;
  entitlementSnapshot: EntitlementSnapshot;
  periodStart: Date;
  periodEnd: Date;
  usageAggregates: UsageAggregate[];
}

export interface RatingResult {
  lineItems: RatedLineItem[];
  totalAmount: number;
  adjustments: unknown[]; // For future extensions
}

// ============================================================================
// Service
// ============================================================================

class RatingEngine {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }
  /**
   * Rate usage for a subscription period.
   * Deterministic: same inputs always produce same outputs.
   */
  async rateSubscriptionPeriod(context: RatingContext): Promise<RatingResult> {

    const { tenantId, subscriptionId, priceVersion, usageAggregates } = context;

    logger.info("Starting rating", {
      tenantId,
      subscriptionId,
      periodStart: context.periodStart.toISOString(),
      periodEnd: context.periodEnd.toISOString(),
      aggregateCount: usageAggregates.length,
    });

    const lineItems: RatedLineItem[] = [];
    let totalAmount = 0;

    // Process each usage aggregate
    for (const aggregate of usageAggregates) {
      const lineItem = await this.rateMeterUsage(context, aggregate);
      if (lineItem) {
        lineItems.push(lineItem);
        totalAmount += lineItem.amount;
      }
    }

    // Store rated line items immutably
    await this.storeRatedLineItems(lineItems);

    const result: RatingResult = {
      lineItems,
      totalAmount,
      adjustments: [],
    };

    logger.info("Rating completed", {
      tenantId,
      subscriptionId,
      lineItemCount: lineItems.length,
      totalAmount,
    });

    return result;
  }

  /**
   * Rate usage for a specific meter.
   */
  private async rateMeterUsage(
    context: RatingContext,
    aggregate: UsageAggregate
  ): Promise<RatedLineItem | null> {
    const { priceVersion, entitlementSnapshot } = context;
    const { meter_key, total_quantity } = aggregate;

    // Get meter pricing from price version
    const meterPricing = this.getMeterPricing(priceVersion.definition, meter_key);
    if (!meterPricing) {
      logger.warn("No pricing found for meter", { meter_key, planTier: priceVersion.plan_tier });
      return null;
    }

    // Calculate included vs overage quantities
    const includedQuantity = meterPricing.included_quantity;
    const usedQuantity = Math.max(0, total_quantity);
    const overageQuantity = Math.max(0, usedQuantity - includedQuantity);

    // Calculate amount based on overage rate
    const amount = overageQuantity * meterPricing.overage_rate;

    const lineItem: RatedLineItem = {
      id: this.generateDeterministicId(context, aggregate),
      tenant_id: context.tenantId,
      subscription_id: context.subscriptionId,
      price_version_id: priceVersion.id,
      meter_key,
      period_start: context.periodStart.toISOString(),
      period_end: context.periodEnd.toISOString(),
      quantity_used: usedQuantity,
      quantity_included: includedQuantity,
      quantity_overage: overageQuantity,
      unit_price: meterPricing.overage_rate,
      amount,
      rated_at: new Date().toISOString(),
      rated_by: "RatingEngine@v1",
      source_aggregate_hash: aggregate.source_hash,
    };

    return lineItem;
  }

  /**
   * Get meter pricing from price version definition.
   */
  private getMeterPricing(
    definition: PriceVersionDefinition,
    meterKey: string
  ): MeterPricing | null {
    return definition.meters?.[meterKey] ?? null;
  }

  /**
   * Generate deterministic ID based on inputs.
   * Ensures same inputs always produce same ID for idempotency.
   */
  private generateDeterministicId(
    context: RatingContext,
    aggregate: UsageAggregate
  ): string {
    const input = `${context.tenantId}:${context.subscriptionId}:${aggregate.meter_key}:${context.periodStart.toISOString()}:${aggregate.source_hash}`;
    return this.hashToUuid(input);
  }

  /**
   * Convert hash to UUID format for database compatibility.
   */
  private hashToUuid(input: string): string {
    const hex = crypto.createHash('sha256').update(input).digest('hex').slice(0, 32);
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
  }

  /**
   * Store rated line items in immutable ledger.
   */
  private async storeRatedLineItems(lineItems: RatedLineItem[]): Promise<void> {
    if (lineItems.length === 0) return;

    const { error } = await this.supabase
      .from("rated_ledger")
      .insert(lineItems.map(item => ({
        id: item.id,
        tenant_id: item.tenant_id,
        subscription_id: item.subscription_id,
        price_version_id: item.price_version_id,
        meter_key: item.meter_key,
        period_start: item.period_start,
        period_end: item.period_end,
        quantity_used: item.quantity_used,
        quantity_included: item.quantity_included,
        quantity_overage: item.quantity_overage,
        unit_price: item.unit_price,
        amount: item.amount,
        rated_at: item.rated_at,
        rated_by: item.rated_by,
        source_aggregate_hash: item.source_aggregate_hash,
      })));

    if (error) {
      if (error.code === "23505") {
        // Duplicate key - this is expected for idempotent re-rating
        logger.info("Rated line items already exist (idempotent)", { count: lineItems.length });
        return;
      }
      throw error;
    }

    logger.info("Rated line items stored", { count: lineItems.length });
  }

  /**
   * Get existing rated line items for a subscription period.
   */
  async getRatedLineItems(
    tenantId: string,
    subscriptionId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<RatedLineItem[]> {
    const { data, error } = await this.supabase
      .from("rated_ledger")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("subscription_id", subscriptionId)
      .eq("period_start", periodStart.toISOString())
      .eq("period_end", periodEnd.toISOString())
      .order("rated_at", { ascending: true });

    if (error) throw error;
    return (data ?? []) as RatedLineItem[];
  }

  /**
   * Re-rate a period (for corrections or backfills).
   * Creates new entries; never modifies existing ones.
   */
  async reRatePeriod(
    context: RatingContext,
    reason: string = "manual_re_rating"
  ): Promise<RatingResult> {
    logger.info("Re-rating period", {
      tenantId: context.tenantId,
      subscriptionId: context.subscriptionId,
      reason,
    });

    // Mark existing entries as superseded (if table supports it)
    // For now, just append new ratings - the deterministic IDs will handle deduplication

    return this.rateSubscriptionPeriod(context);
  }

}

export { RatingEngine };
/** @deprecated Use named import `RatingEngine` instead. */
export default RatingEngine;
import crypto from "node:crypto";
