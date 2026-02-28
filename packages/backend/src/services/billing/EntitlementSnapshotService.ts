/**
 * Entitlement Snapshot Service
 *
 * Creates and queries point-in-time entitlement records.
 * Each snapshot captures what a tenant is entitled to based on their
 * pinned price version. Only one snapshot per tenant is "current"
 * (superseded_at IS NULL).
 */

import type { EnforcementMode, MeterKey } from "@shared/types/billing-events";
import { type SupabaseClient } from "@supabase/supabase-js";

import { createLogger } from "../../lib/logger.js";

import PriceVersionService from "./PriceVersionService.js";
import type { MeterPricing, PriceVersionDefinition } from "./PriceVersionService.js";

const logger = createLogger({ component: "EntitlementSnapshotService" });

// ============================================================================
// Types
// ============================================================================

export interface MeterEntitlement {
  included: number;
  cap: number | null;
  overage_rate: number;
  enforcement: EnforcementMode;
}

export interface EntitlementSnapshot {
  id: string;
  tenant_id: string;
  subscription_id: string;
  price_version_id: string;
  entitlements: Record<string, MeterEntitlement>;
  effective_at: string;
  superseded_at: string | null;
  created_at: string;
}

// ============================================================================
// Service
// ============================================================================

class EntitlementSnapshotService {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }
  /**
   * Create a new entitlement snapshot from a price version.
   * Supersedes any existing current snapshot for the tenant.
   */
  async createSnapshot(
    tenantId: string,
    subscriptionId: string,
    priceVersionId: string,
    effectiveAt?: Date
  ): Promise<EntitlementSnapshot> {
    const priceVersion = await PriceVersionService.getById(priceVersionId);
    if (!priceVersion) {
      throw new Error(`Price version ${priceVersionId} not found`);
    }

    const entitlements = this.computeEntitlements(priceVersion.definition);
    const effective = (effectiveAt ?? new Date()).toISOString();

    // Supersede current snapshot
    await this.supersedeCurrentSnapshot(tenantId);

    const { data, error } = await this.supabase
      .from("entitlement_snapshots")
      .insert({
        tenant_id: tenantId,
        subscription_id: subscriptionId,
        price_version_id: priceVersionId,
        entitlements,
        effective_at: effective,
      })
      .select()
      .single();

    if (error) throw error;

    logger.info("Entitlement snapshot created", {
      tenantId,
      snapshotId: data.id,
      priceVersionId,
    });

    return data as EntitlementSnapshot;
  }

  /**
   * Get the current (non-superseded) snapshot for a tenant.
   */
  async getCurrentSnapshot(tenantId: string): Promise<EntitlementSnapshot | null> {
    const { data, error } = await this.supabase
      .from("entitlement_snapshots")
      .select("*")
      .eq("tenant_id", tenantId)
      .is("superseded_at", null)
      .order("effective_at", { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== "PGRST116") throw error;
    return (data as EntitlementSnapshot) ?? null;
  }

  /**
   * Get the entitlement for a specific meter from the current snapshot.
   */
  async getMeterEntitlement(
    tenantId: string,
    meterKey: string
  ): Promise<MeterEntitlement | null> {
    const snapshot = await this.getCurrentSnapshot(tenantId);
    if (!snapshot) return null;
    return snapshot.entitlements[meterKey] ?? null;
  }

  /**
   * Get snapshot history for a tenant, ordered by effective_at descending.
   */
  async getHistory(tenantId: string, limit = 10): Promise<EntitlementSnapshot[]> {
    const { data, error } = await this.supabase
      .from("entitlement_snapshots")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("effective_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data ?? []) as EntitlementSnapshot[];
  }

  /**
   * Get a snapshot by ID.
   */
  async getById(snapshotId: string): Promise<EntitlementSnapshot | null> {
    const { data, error } = await this.supabase
      .from("entitlement_snapshots")
      .select("*")
      .eq("id", snapshotId)
      .single();

    if (error && error.code !== "PGRST116") throw error;
    return (data as EntitlementSnapshot) ?? null;
  }

  /**
   * Supersede the current snapshot for a tenant (set superseded_at = now).
   */
  private async supersedeCurrentSnapshot(tenantId: string): Promise<void> {
    const { error } = await this.supabase
      .from("entitlement_snapshots")
      .update({ superseded_at: new Date().toISOString() })
      .eq("tenant_id", tenantId)
      .is("superseded_at", null);

    if (error) throw error;
  }

  /**
   * Compute entitlements map from a price version definition.
   */
  private computeEntitlements(
    definition: PriceVersionDefinition
  ): Record<string, MeterEntitlement> {
    const entitlements: Record<string, MeterEntitlement> = {};

    for (const [meterKey, pricing] of Object.entries(definition.meters)) {
      entitlements[meterKey] = {
        included: pricing.included_quantity,
        cap: pricing.hard_cap_quantity,
        overage_rate: pricing.overage_rate,
        enforcement: pricing.enforcement,
      };
    }

    return entitlements;
  }

}

export default EntitlementSnapshotService;
