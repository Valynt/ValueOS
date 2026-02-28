/**
 * Billing Meters Catalog
 *
 * Read-only accessor for the billing_meters table.
 * Meters define what can be metered (ai_tokens, api_calls, etc.)
 * and their aggregation semantics.
 */

import type { MeterKey } from "@shared/types/billing-events";
import { SupabaseClient } from "@supabase/supabase-js";

import { createLogger } from "../../lib/logger.js";
import { supabase as supabaseClient } from '../../lib/supabase.js';

const logger = createLogger({ component: "BillingMetersCatalog" });

export interface BillingMeter {
  meter_key: MeterKey;
  display_name: string;
  unit: string;
  aggregation: "sum" | "max" | "last_during_period";
  dimensions_schema: Record<string, string>;
  created_at: string;
}

const supabase: SupabaseClient | null = supabaseClient ?? null;

/**
 * In-memory cache of meters. Loaded once on first access.
 */
let metersCache: Map<string, BillingMeter> | null = null;

class BillingMetersCatalog {
  /**
   * Get all meters, cached after first load.
   */
  async listMeters(): Promise<BillingMeter[]> {
    const cache = await this.ensureCache();
    return Array.from(cache.values());
  }

  /**
   * Get a single meter by key. Returns null if not found.
   */
  async getMeter(meterKey: string): Promise<BillingMeter | null> {
    const cache = await this.ensureCache();
    return cache.get(meterKey) ?? null;
  }

  /**
   * Check if a meter key is valid.
   */
  async isValidMeter(meterKey: string): Promise<boolean> {
    const cache = await this.ensureCache();
    return cache.has(meterKey);
  }

  /**
   * Force reload from database. Use after seeding or migration.
   */
  async reload(): Promise<void> {
    metersCache = null;
    await this.ensureCache();
  }

  private async ensureCache(): Promise<Map<string, BillingMeter>> {
    if (metersCache) return metersCache;

    if (!supabase) {
      throw new Error("Supabase not configured for BillingMetersCatalog");
    }

    const { data, error } = await supabase
      .from("billing_meters")
      .select("*")
      .order("meter_key");

    if (error) {
      logger.error("Failed to load billing meters", error);
      throw error;
    }

    metersCache = new Map();
    for (const row of data ?? []) {
      metersCache.set(row.meter_key, row as BillingMeter);
    }

    logger.info("Billing meters catalog loaded", { count: metersCache.size });
    return metersCache;
  }
}

export default new BillingMetersCatalog();
