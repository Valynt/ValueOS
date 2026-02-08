/**
 * Subscription Service
 * Manages subscription creation, updates, and cancellation
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import StripeService from "./StripeService";
import CustomerService from "./CustomerService";
import { BillingMetric, PLANS, PlanTier } from "../../config/billing";
import { Subscription, SubscriptionItem } from "../../types/billing";
import { createLogger } from "../../lib/logger";
import { settings } from "../config/settings";

const logger = createLogger({ component: "SubscriptionService" });

import { settings } from "../config/settings";

// Constants for Stripe API (amounts are in cents)
const STRIPE_CENTS_PER_DOLLAR = 100;
const UNIX_TIMESTAMP_MULTIPLIER = 1000;

const supabaseUrl = settings.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = settings.SUPABASE_SERVICE_ROLE_KEY;

let supabase: SupabaseClient | null = null;

if (supabaseUrl && supabaseServiceRoleKey) {
  supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
} else {
  logger.warn(
    "Supabase billing not configured: VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing"
  );
}

class SubscriptionService {
  private stripeService: StripeService | null = null;
  private stripe: Stripe | null = null;

  constructor() {
    // Initialize Stripe service only if billing is configured
    try {
      this.stripeService = StripeService.getInstance();
      this.stripe = this.stripeService.getClient();
    } catch (_error) {
      logger.warn("Stripe service not available, billing features disabled");
      this.stripe = null;
      this.stripeService = null;
    }
  }

  /**
   * Create subscription for tenant
   */
  async createSubscription(
    tenantId: string,
    planTier: PlanTier,
    trialDays?: number
  ): Promise<Subscription> {
    if (!this.stripe || !supabase) {
      throw new Error("Billing service not configured");
    }
    try {
      logger.info("Creating subscription", { tenantId, planTier });

      // Get or create customer
      const customer = await CustomerService.getCustomerByTenantId(tenantId);
      if (!customer) {
        throw new Error("Customer not found. Create customer first.");
      }

      // Check if subscription already exists
      const existing = await this.getActiveSubscription(tenantId);
      if (existing) {
        throw new Error("Active subscription already exists");
      }

      const plan = PLANS[planTier];

      // Build subscription items for all metrics
      const items = this.buildSubscriptionItems(planTier);

      // Create subscription in Stripe
      const stripeSubscription = await this.stripe.subscriptions.create({
        customer: customer.stripe_customer_id,
        items,
        trial_period_days: trialDays,
        metadata: {
          tenant_id: tenantId,
          plan_tier: planTier,
        },
      });

      // Store in database
      const { data: subscription, error } = await supabase
        .from("subscriptions")
        .insert({
          billing_customer_id: customer.id,
          tenant_id: tenantId,
          stripe_subscription_id: stripeSubscription.id,
          stripe_customer_id: customer.stripe_customer_id,
          plan_tier: planTier,
          billing_period: plan.billingPeriod,
          status: stripeSubscription.status,
          current_period_start: new Date(
            stripeSubscription.current_period_start * UNIX_TIMESTAMP_MULTIPLIER
          ).toISOString(),
          current_period_end: new Date(
            stripeSubscription.current_period_end * UNIX_TIMESTAMP_MULTIPLIER
          ).toISOString(),
          trial_start: stripeSubscription.trial_start
            ? new Date(stripeSubscription.trial_start * UNIX_TIMESTAMP_MULTIPLIER).toISOString()
            : null,
          trial_end: stripeSubscription.trial_end
            ? new Date(stripeSubscription.trial_end * UNIX_TIMESTAMP_MULTIPLIER).toISOString()
            : null,
          amount: plan.price,
          currency: "usd",
        })
        .select()
        .single();

      if (error) throw error;

      // Store subscription items
      await this.storeSubscriptionItems(subscription.id, stripeSubscription.items.data, planTier);

      // Initialize usage quotas
      await this.initializeUsageQuotas(tenantId, subscription.id, planTier);

      logger.info("Subscription created", {
        tenantId,
        subscriptionId: stripeSubscription.id,
      });

      return subscription;
    } catch (error) {
      return this.stripeService.handleError(error, "createSubscription");
    }
  }

  /**
   * Build subscription items for Stripe
   */
  private buildSubscriptionItems(planTier: PlanTier): Stripe.SubscriptionCreateParams.Item[] {
    const plan = PLANS[planTier];
    const items: Stripe.SubscriptionCreateParams.Item[] = [];

    const metrics: BillingMetric[] = [
      "llm_tokens",
      "agent_executions",
      "api_calls",
      "storage_gb",
      "user_seats",
    ];

    metrics.forEach((metric) => {
      const priceId = plan.stripePriceIds?.[metric];
      if (priceId) {
        items.push({ price: priceId });
      }
    });

    return items;
  }

  /**
   * Store subscription items in database
   */
  private async storeSubscriptionItems(
    subscriptionId: string,
    stripeItems: Stripe.SubscriptionItem[],
    planTier: PlanTier
  ): Promise<void> {
    const plan = PLANS[planTier];
    const items = stripeItems.map((item) => {
      // Determine metric from price ID
      const metric = this.getMetricFromPriceId(item.price.id, planTier);

      return {
        subscription_id: subscriptionId,
        stripe_subscription_item_id: item.id,
        stripe_price_id: item.price.id,
        stripe_product_id: item.price.product,
        metric,
        unit_amount: item.price.unit_amount || 0,
        currency: item.price.currency,
        usage_type: "metered",
        aggregation: metric === "storage_gb" || metric === "user_seats" ? "max" : "sum",
        included_quantity: plan.quotas[metric],
      };
    });

    const { error } = await supabase.from("subscription_items").insert(items);

    if (error) throw error;
  }

  /**
   * Get metric from Stripe price ID
   */
  private getMetricFromPriceId(priceId: string, planTier: PlanTier): BillingMetric {
    const plan = PLANS[planTier];
    const priceIds = plan.stripePriceIds || {};

    for (const [metric, id] of Object.entries(priceIds)) {
      if (id === priceId) {
        return metric as BillingMetric;
      }
    }

    throw new Error(`Unknown price ID: ${priceId}`);
  }

  /**
   * Initialize usage quotas for the billing period
   */
  private async initializeUsageQuotas(
    tenantId: string,
    subscriptionId: string,
    planTier: PlanTier
  ): Promise<void> {
    const plan = PLANS[planTier];
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const metrics: BillingMetric[] = [
      "llm_tokens",
      "agent_executions",
      "api_calls",
      "storage_gb",
      "user_seats",
    ];

    const quotas = metrics.map((metric) => ({
      tenant_id: tenantId,
      subscription_id: subscriptionId,
      metric,
      quota_amount: plan.quotas[metric],
      hard_cap: plan.hardCaps[metric],
      current_usage: 0,
      period_start: periodStart.toISOString(),
      period_end: periodEnd.toISOString(),
    }));

    const { error } = await supabase.from("usage_quotas").insert(quotas);

    if (error) throw error;
  }

  /**
   * Get active subscription for tenant
   */
  async getActiveSubscription(tenantId: string): Promise<Subscription | null> {
    const { data, error } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("tenant_id", tenantId)
      .in("status", ["active", "trialing", "past_due"])
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== "PGRST116") {
      logger.error("Error fetching subscription", error);
      throw error;
    }

    return data;
  }

  /**
   * Update subscription (upgrade/downgrade) with transaction safety
   */
  async updateSubscription(tenantId: string, newPlanTier: PlanTier): Promise<Subscription> {
    try {
      logger.info("Updating subscription with transaction safety", { tenantId, newPlanTier });

      if (!this.stripe) {
        throw new Error("Stripe service not available");
      }

      // Use transactional service for atomic updates
      const TransactionalService = (await import("./SubscriptionService.transaction")).default;
      const transactionalService = new TransactionalService(this.stripe);

      const result = await transactionalService.updateSubscriptionWithTransaction(
        tenantId,
        newPlanTier
      );
      return result as Subscription;
    } catch (error) {
      return this.stripeService.handleError(error, "updateSubscription");
    }
  }

  /**
   * Legacy update subscription method (deprecated - use updateSubscription instead)
   * @deprecated Use updateSubscription for transaction safety
   */
  async updateSubscriptionLegacy(tenantId: string, newPlanTier: PlanTier): Promise<Subscription> {
    try {
      const subscription = await this.getActiveSubscription(tenantId);
      if (!subscription) {
        throw new Error("No active subscription found");
      }

      logger.info("Updating subscription (legacy)", { tenantId, newPlanTier });

      // Get current subscription items
      const { data: items } = await supabase
        .from("subscription_items")
        .select("*")
        .eq("subscription_id", subscription.id);

      // Update each item to new price
      const newPlan = PLANS[newPlanTier];
      const updatePromises =
        items?.map(async (item: { metric: string; stripe_subscription_item_id: string }) => {
          const newPriceId = newPlan.stripePriceIds?.[item.metric];
          if (newPriceId) {
            await this.stripe.subscriptionItems.update(item.stripe_subscription_item_id, {
              price: newPriceId,
            });
          }
        }) || [];

      await Promise.all(updatePromises);

      // Update subscription in database
      const { data, error } = await supabase
        .from("subscriptions")
        .update({
          plan_tier: newPlanTier,
          amount: newPlan.price,
          updated_at: new Date().toISOString(),
        })
        .eq("id", subscription.id)
        .select()
        .single();

      if (error) throw error;

      // Update quotas
      await this.updateUsageQuotas(tenantId, newPlanTier);

      logger.info("Subscription updated (legacy)", { tenantId, newPlanTier });

      return data;
    } catch (error) {
      return this.stripeService.handleError(error, "updateSubscriptionLegacy");
    }
  }

  /**
   * Update usage quotas after plan change
   */
  private async updateUsageQuotas(tenantId: string, planTier: PlanTier): Promise<void> {
    const plan = PLANS[planTier];
    const metrics: BillingMetric[] = [
      "llm_tokens",
      "agent_executions",
      "api_calls",
      "storage_gb",
      "user_seats",
    ];

    const updates = metrics.map((metric) =>
      supabase
        .from("usage_quotas")
        .update({
          quota_amount: plan.quotas[metric],
          hard_cap: plan.hardCaps[metric],
        })
        .eq("tenant_id", tenantId)
        .eq("metric", metric)
    );

    await Promise.all(updates);
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(tenantId: string, immediately: boolean = false): Promise<Subscription> {
    try {
      const subscription = await this.getActiveSubscription(tenantId);
      if (!subscription) {
        throw new Error("No active subscription found");
      }

      logger.info("Canceling subscription", { tenantId, immediately });

      // Cancel in Stripe
      const _stripeSubscription = immediately
        ? await this.stripe.subscriptions.cancel(subscription.stripe_subscription_id)
        : await this.stripe.subscriptions.update(subscription.stripe_subscription_id, {
            cancel_at_period_end: true,
          });

      // Update in database
      const { data, error } = await supabase
        .from("subscriptions")
        .update({
          status: _stripeSubscription.status,
          canceled_at: _stripeSubscription.canceled_at
            ? new Date(_stripeSubscription.canceled_at * UNIX_TIMESTAMP_MULTIPLIER).toISOString()
            : null,
          ended_at: _stripeSubscription.ended_at
            ? new Date(_stripeSubscription.ended_at * UNIX_TIMESTAMP_MULTIPLIER).toISOString()
            : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", subscription.id)
        .select()
        .single();

      if (error) throw error;

      logger.info("Subscription canceled", { tenantId });

      return data;
    } catch (error) {
      return this.stripeService.handleError(error, "cancelSubscription");
    }
  }

  /**
   * Get subscription items
   */
  async getSubscriptionItems(subscriptionId: string): Promise<SubscriptionItem[]> {
    const { data, error } = await supabase
      .from("subscription_items")
      .select("*")
      .eq("subscription_id", subscriptionId);

    if (error) throw error;

    return data || [];
  }

  /**
   * Preview subscription change with proration calculation
   */
  async previewSubscriptionChange(
    tenantId: string,
    newPlanTier: PlanTier
  ): Promise<{
    currentPlan: PlanTier;
    newPlan: PlanTier;
    proratedAmount: number;
    nextInvoiceAmount: number;
    effectiveDate: string;
    changes: Array<{
      metric: string;
      currentQuota: number;
      newQuota: number;
      currentPrice: number;
      newPrice: number;
    }>;
  }> {
    try {
      logger.info("Previewing subscription change", { tenantId, newPlanTier });

      // Get current subscription
      const currentSubscription = await this.getActiveSubscription(tenantId);
      if (!currentSubscription) {
        throw new Error("No active subscription found");
      }

      const currentPlan = currentSubscription.plan_tier as PlanTier;
      if (currentPlan === newPlanTier) {
        throw new Error("Cannot change to the same plan");
      }

      // Get customer
      const customer = await CustomerService.getCustomerByTenantId(tenantId);
      if (!customer) {
        throw new Error("Customer not found");
      }

      // Get plan configurations
      const currentPlanConfig = PLANS[currentPlan];
      const newPlanConfig = PLANS[newPlanTier];

      // Calculate proration using Stripe
      const prorationPreview = await this.stripe.invoices.retrieveUpcoming({
        customer: customer.stripe_customer_id,
        subscription: currentSubscription.stripe_subscription_id,
        subscription_items: this.buildSubscriptionItems(newPlanTier).map((item) => ({
          id: item.price, // Use the price ID for matching existing items
          price: item.price,
        })),
      });

      // Build changes array
      const changes = Object.entries(newPlanConfig.quotas).map(([metric, newQuota]) => {
        const currentQuota = currentPlanConfig.quotas[metric as BillingMetric] || 0;
        const currentPrice = currentPlanConfig.overageRates[metric as BillingMetric] || 0;
        const newPrice = newPlanConfig.overageRates[metric as BillingMetric] || 0;

        return {
          metric,
          currentQuota,
          newQuota: newQuota as number,
          currentPrice,
          newPrice,
        };
      });

      return {
        currentPlan,
        newPlan: newPlanTier,
        proratedAmount: (prorationPreview.amount_due || 0) / STRIPE_CENTS_PER_DOLLAR, // Convert cents to dollars
        nextInvoiceAmount: (prorationPreview.amount_due || 0) / STRIPE_CENTS_PER_DOLLAR, // This should be the full amount for next period
        effectiveDate: new Date().toISOString(),
        changes,
      };
    } catch (error) {
      logger.error("Error previewing subscription change", error as Error, {
        tenantId,
        newPlanTier,
      });
      throw error;
    }
  }
}

export default new SubscriptionService();
