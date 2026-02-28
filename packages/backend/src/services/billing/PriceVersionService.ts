/**
 * Price Version Service
 *
 * Manages versioned pricing definitions. Active/archived versions are immutable.
 * Tenants are pinned to a specific version; catalog can advance independently.
 */

import type { EnforcementMode, MeterKey, PriceVersionStatus } from "@shared/types/billing-events";
import { SupabaseClient } from "@supabase/supabase-js";

import { createLogger } from "../../lib/logger.js";
import { supabase as supabaseClient } from '../../lib/supabase.js';

const logger = createLogger({ component: "PriceVersionService" });

// ============================================================================
// Types
// ============================================================================

export interface MeterPricing {
  included_quantity: number;
  hard_cap_quantity: number | null;
  overage_rate: number;
  enforcement: EnforcementMode;
}

export interface PriceVersionDefinition {
  name: string;
  price_usd: number;
  billing_period: "monthly" | "yearly";
  meters: Record<string, MeterPricing>;
  features: string[];
}

export interface PriceVersion {
  id: string;
  version_tag: string;
  plan_tier: string;
  tenant_id?: string; // For custom enterprise pricing
  definition: PriceVersionDefinition;
  status: PriceVersionStatus;
  activated_at: string | null;
  archived_at: string | null;
  created_at: string;
}

// ============================================================================
// Service
// ============================================================================

const supabase: SupabaseClient | null = supabaseClient ?? null;

class PriceVersionService {
  /**
   * Create a new draft price version.
   */
  async createDraft(
    versionTag: string,
    planTier: string,
    definition: PriceVersionDefinition
  ): Promise<PriceVersion> {
    this.requireSupabase();

    const { data, error } = await supabase!
      .from("billing_price_versions")
      .insert({
        version_tag: versionTag,
        plan_tier: planTier,
        definition,
        tenant_id: null,
        status: "draft",
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new Error(`Price version ${versionTag}/${planTier} already exists`);
      }
      throw error;
    }

    logger.info("Draft price version created", { versionTag, planTier });
    return data as PriceVersion;
  }

  /**
   * Activate a draft version. Archives the currently active version for the same plan tier.
   */
  async activate(versionId: string): Promise<PriceVersion> {
    this.requireSupabase();

    // Fetch the version to activate
    const version = await this.getById(versionId);
    if (!version) {
      throw new Error(`Price version ${versionId} not found`);
    }
    if (version.status !== "draft") {
      throw new Error(`Cannot activate version in '${version.status}' status; must be 'draft'`);
    }

    // Archive current active version for this plan tier
    const { error: archiveError } = await supabase!
      .from("billing_price_versions")
      .update({ status: "archived", archived_at: new Date().toISOString() })
      .eq("plan_tier", version.plan_tier)
      .is("tenant_id", null)
      .eq("status", "active");

    if (archiveError) throw archiveError;

    // Activate the new version
    const { data, error } = await supabase!
      .from("billing_price_versions")
      .update({ status: "active", activated_at: new Date().toISOString() })
      .eq("id", versionId)
      .select()
      .single();

    if (error) throw error;

    logger.info("Price version activated", {
      versionId,
      versionTag: version.version_tag,
      planTier: version.plan_tier,
    });

    return data as PriceVersion;
  }

  /**
   * Get the currently active price version for a plan tier.
   */
  async getActiveVersion(planTier: string): Promise<PriceVersion | null> {
    this.requireSupabase();

    const { data, error } = await supabase!
      .from("billing_price_versions")
      .select("*")
      .eq("plan_tier", planTier)
      .is("tenant_id", null)
      .eq("status", "active")
      .single();

    if (error && error.code !== "PGRST116") throw error;
    return (data as PriceVersion) ?? null;
  }

  /**
   * Get the price version pinned to a subscription.
   */
  async getVersionForSubscription(subscriptionId: string): Promise<PriceVersion | null> {
    this.requireSupabase();

    const { data: sub, error: subError } = await supabase!
      .from("subscriptions")
      .select("price_version_id, plan_tier")
      .eq("id", subscriptionId)
      .single();

    if (subError) throw subError;
    if (!sub) return null;

    // If subscription has a pinned version, use it
    if (sub.price_version_id) {
      return this.getById(sub.price_version_id);
    }

    // Fallback: return active version for the plan tier
    return this.getActiveVersion(sub.plan_tier);
  }

  /**
   * Get a price version by ID.
   */
  async getById(versionId: string): Promise<PriceVersion | null> {
    this.requireSupabase();

    const { data, error } = await supabase!
      .from("billing_price_versions")
      .select("*")
      .eq("id", versionId)
      .single();

    if (error && error.code !== "PGRST116") throw error;
    return (data as PriceVersion) ?? null;
  }

  /**
   * List all versions for a plan tier, ordered by creation date descending.
   */
  async listVersions(planTier?: string): Promise<PriceVersion[]> {
    this.requireSupabase();

    let query = supabase!
      .from("billing_price_versions")
      .select("*")
      .order("created_at", { ascending: false });

    if (planTier) {
      query = query.eq("plan_tier", planTier);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as PriceVersion[];
  }

  /**
   * Update a draft version's definition. Active/archived versions are immutable.
   */
  async updateDraft(
    versionId: string,
    definition: PriceVersionDefinition
  ): Promise<PriceVersion> {
    this.requireSupabase();

    const version = await this.getById(versionId);
    if (!version) {
      throw new Error(`Price version ${versionId} not found`);
    }
    if (version.status !== "draft") {
      throw new Error(`Cannot modify version in '${version.status}' status; only 'draft' versions are mutable`);
    }

    const { data, error } = await supabase!
      .from("billing_price_versions")
      .update({ definition })
      .eq("id", versionId)
      .select()
      .single();

    if (error) throw error;
    return data as PriceVersion;
  }

  /**
   * Create custom price version for enterprise tenant
   */
  async createCustomVersion(
    tenantId: string,
    planTier: string,
    definition: PriceVersionDefinition,
    versionTag?: string
  ): Promise<PriceVersion> {
    this.requireSupabase();

    const tag = versionTag || `custom-${tenantId}-${Date.now()}`;

    const { data, error } = await supabase!
      .from("billing_price_versions")
      .insert({
        version_tag: tag,
        plan_tier: planTier,
        tenant_id: tenantId,
        definition,
        status: "draft"
      })
      .select()
      .single();

    if (error) throw error;

    logger.info("Created custom price version", {
      versionId: data.id,
      tenantId,
      versionTag: tag
    });

    return data as PriceVersion;
  }

  /**
   * Get custom price versions for a tenant
   */
  async getCustomVersions(tenantId: string): Promise<PriceVersion[]> {
    this.requireSupabase();

    const { data, error } = await supabase!
      .from("billing_price_versions")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data ?? []) as PriceVersion[];
  }

  /**
   * Get effective price version for a tenant (custom or standard)
   */
  async getEffectiveVersionForTenant(
    tenantId: string,
    planTier: string
  ): Promise<PriceVersion | null> {
    this.requireSupabase();

    // First try to get custom version for this tenant
    const { data: customVersions, error: customError } = await supabase!
      .from("billing_price_versions")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("plan_tier", planTier)
      .eq("status", "active")
      .order("activated_at", { ascending: false })
      .limit(1);

    if (customError) throw customError;

    if (customVersions && customVersions.length > 0) {
      return customVersions[0] as PriceVersion;
    }

    // Fall back to standard version
    return this.getActiveVersion(planTier);
  }

  /**
   * Activate custom price version for tenant
   */
  async activateCustomVersion(versionId: string, tenantId: string): Promise<PriceVersion> {
    this.requireSupabase();

    // Verify the version belongs to the tenant
    const version = await this.getById(versionId);
    if (!version) {
      throw new Error(`Price version ${versionId} not found`);
    }

    if (version.tenant_id !== tenantId) {
      throw new Error(`Price version ${versionId} does not belong to tenant ${tenantId}`);
    }

    if (version.status !== "draft") {
      throw new Error(`Cannot activate version in '${version.status}' status`);
    }

    // Deactivate any existing custom versions for this tenant and plan
    await supabase!
      .from("billing_price_versions")
      .update({
        status: "archived",
        archived_at: new Date().toISOString()
      })
      .eq("tenant_id", tenantId)
      .eq("plan_tier", version.plan_tier)
      .eq("status", "active");

    // Activate the new version
    const { data, error } = await supabase!
      .from("billing_price_versions")
      .update({
        status: "active",
        activated_at: new Date().toISOString()
      })
      .eq("id", versionId)
      .select()
      .single();

    if (error) throw error;

    logger.info("Activated custom price version", {
      versionId,
      tenantId,
      planTier: version.plan_tier
    });

    return data as PriceVersion;
  }

  /**
   * Create negotiated pricing for enterprise tenant
   */
  async createNegotiatedPricing(
    tenantId: string,
    basePlanTier: string,
    negotiatedDefinition: PriceVersionDefinition,
    negotiatedBy: string,
    justification?: string
  ): Promise<PriceVersion> {
    this.requireSupabase();

    // Create custom version with negotiated pricing
    const versionTag = `negotiated-${tenantId}-${Date.now()}`;

    const { data, error } = await supabase!
      .from("billing_price_versions")
      .insert({
        version_tag: versionTag,
        plan_tier: basePlanTier,
        tenant_id: tenantId,
        definition: {
          ...negotiatedDefinition,
          negotiated: true,
          negotiated_by: negotiatedBy,
          negotiated_at: new Date().toISOString(),
          justification
        },
        status: "draft"
      })
      .select()
      .single();

    if (error) throw error;

    logger.info("Created negotiated pricing", {
      versionId: data.id,
      tenantId,
      negotiatedBy
    });

    return data as PriceVersion;
  }

  private requireSupabase(): asserts this is { supabase: SupabaseClient } {
    if (!supabase) {
      throw new Error("Supabase not configured for PriceVersionService");
    }
  }
}

export default new PriceVersionService();
