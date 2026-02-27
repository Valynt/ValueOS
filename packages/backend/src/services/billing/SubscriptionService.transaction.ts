/**
 * Enhanced Subscription Service with Transaction Safety
 * Adds atomic transaction support for subscription updates
 */

import { SupabaseClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { logger } from "../../lib/logger.js"
import { PlanTier } from "../../config/billing.js"
import { supabase as supabaseClient } from '../../lib/supabase.js';

class TransactionalSubscriptionService {
  private supabase: SupabaseClient;
  private stripe: Stripe;

  constructor(stripe: Stripe) {
    this.stripe = stripe;
    this.supabase = supabaseClient;
  }

  /**
   * Update subscription with atomic transaction support
   */
  async updateSubscriptionWithTransaction(tenantId: string, newPlanTier: PlanTier): Promise<any> {
    // Start a database transaction
    const { data: subscription, error: fetchError } = await this.supabase
      .from("subscriptions")
      .select("*")
      .eq("tenant_id", tenantId)
      .in("status", ["active", "trialing", "past_due"])
      .single();

    if (fetchError) {
      throw new Error(`Failed to fetch subscription: ${fetchError.message}`);
    }

    if (!subscription) {
      throw new Error("No active subscription found");
    }

    // Get current subscription items
    const { data: items, error: itemsError } = await this.supabase
      .from("subscription_items")
      .select("*")
      .eq("subscription_id", subscription.id);

    if (itemsError) {
      throw new Error(`Failed to fetch subscription items: ${itemsError.message}`);
    }

    // Prepare rollback state
    const rollbackState = {
      subscriptionId: subscription.id,
      originalItems:
        items?.map((item) => ({
          id: item.id,
          stripe_subscription_item_id: item.stripe_subscription_item_id,
          original_price_id: item.stripe_price_id,
        })) || [],
    };

    try {
      // Phase 1: Update Stripe subscription items atomically
      const stripeUpdatePromises =
        items?.map(async (item: any) => {
          const newPriceId = this.getPriceIdForPlan(newPlanTier, item.metric);
          if (!newPriceId) {
            throw new Error(`No price ID found for metric ${item.metric} in plan ${newPlanTier}`);
          }

          return await this.stripe.subscriptionItems.update(item.stripe_subscription_item_id, {
            price: newPriceId,
          });
        }) || [];

      // Execute all Stripe updates
      const stripeResults = await Promise.all(stripeUpdatePromises);

      // Phase 2: Update database record
      const { data: updatedSubscription, error: updateError } = await this.supabase
        .from("subscriptions")
        .update({
          plan_tier: newPlanTier,
          updated_at: new Date().toISOString(),
        })
        .eq("id", subscription.id)
        .select()
        .single();

      if (updateError) {
        throw new Error(`Failed to update subscription: ${updateError.message}`);
      }

      // Phase 3: Update subscription items in database
      const itemUpdates = stripeResults.map((result, index) => ({
        id: items?.[index]?.id,
        stripe_price_id: result.price.id,
        updated_at: new Date().toISOString(),
      }));

      const { error: itemsUpdateError } = await this.supabase
        .from("subscription_items")
        .upsert(itemUpdates);

      if (itemsUpdateError) {
        throw new Error(`Failed to update subscription items: ${itemsUpdateError.message}`);
      }

      // Phase 4: Update quotas
      await this.updateUsageQuotas(tenantId, newPlanTier);

      logger.info("Subscription updated successfully", {
        tenantId,
        subscriptionId: subscription.id,
        newPlanTier,
      });

      return updatedSubscription;
    } catch (error) {
      // Rollback changes if possible
      logger.error("Subscription update failed, attempting rollback", error as Error, {
        tenantId,
        subscriptionId: subscription.id,
        rollbackState,
      });

      await this.performRollback(rollbackState);

      throw error;
    }
  }

  /**
   * Perform rollback of subscription changes
   */
  private async performRollback(rollbackState: any): Promise<void> {
    try {
      logger.info("Rolling back subscription changes", { rollbackState });

      // Rollback Stripe items
      for (const item of rollbackState.originalItems) {
        try {
          await this.stripe.subscriptionItems.update(item.stripe_subscription_item_id, {
            price: item.original_price_id,
          });
        } catch (rollbackError) {
          logger.error("Failed to rollback Stripe item", rollbackError as Error, { item });
        }
      }

      logger.info("Rollback completed");
    } catch (error) {
      logger.error("Rollback failed", error as Error, { rollbackState });
      // Manual intervention required
    }
  }

  /**
   * Get price ID for plan and metric
   */
  private getPriceIdForPlan(planTier: PlanTier, metric: string): string | null {
    // This would typically come from billing configuration
    const priceMap: Record<PlanTier, Record<string, string>> = {
      free: {
        llm_tokens: process.env.STRIPE_PRICE_LLM_TOKENS_FREE || "",
        agent_executions: process.env.STRIPE_PRICE_AGENT_EXECUTIONS_FREE || "",
        api_calls: process.env.STRIPE_PRICE_API_CALLS_FREE || "",
        storage_gb: process.env.STRIPE_PRICE_STORAGE_FREE || "",
        user_seats: process.env.STRIPE_PRICE_USER_SEATS_FREE || "",
      },
      standard: {
        llm_tokens: process.env.STRIPE_PRICE_LLM_TOKENS_STANDARD || "",
        agent_executions: process.env.STRIPE_PRICE_AGENT_EXECUTIONS_STANDARD || "",
        api_calls: process.env.STRIPE_PRICE_API_CALLS_STANDARD || "",
        storage_gb: process.env.STRIPE_PRICE_STORAGE_STANDARD || "",
        user_seats: process.env.STRIPE_PRICE_USER_SEATS_STANDARD || "",
      },
      enterprise: {
        llm_tokens: process.env.STRIPE_PRICE_LLM_TOKENS_ENTERPRISE || "",
        agent_executions: process.env.STRIPE_PRICE_AGENT_EXECUTIONS_ENTERPRISE || "",
        api_calls: process.env.STRIPE_PRICE_API_CALLS_ENTERPRISE || "",
        storage_gb: process.env.STRIPE_PRICE_STORAGE_ENTERPRISE || "",
        user_seats: process.env.STRIPE_PRICE_USER_SEATS_ENTERPRISE || "",
      },
    };

    return priceMap[planTier]?.[metric] || null;
  }

  /**
   * Update usage quotas after plan change
   */
  private async updateUsageQuotas(tenantId: string, planTier: PlanTier): Promise<void> {
    // Import PLANS from billing config
    const { PLANS } = await import("../../config/billing");
    const plan = PLANS[planTier];

    const metrics = ["llm_tokens", "agent_executions", "api_calls", "storage_gb", "user_seats"];

    const updates = metrics.map((metric) =>
      this.supabase
        .from("usage_quotas")
        .update({
          quota_amount: plan.quotas[metric as keyof typeof plan.quotas],
          hard_cap: plan.hardCaps[metric as keyof typeof plan.hardCaps],
          updated_at: new Date().toISOString(),
        })
        .eq("tenant_id", tenantId)
        .eq("metric", metric)
    );

    await Promise.all(updates);
  }
}

export default TransactionalSubscriptionService;
