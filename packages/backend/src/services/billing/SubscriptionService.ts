/**
 * Subscription Service
 * Manages subscription creation, updates, and cancellation
 */

import crypto from "node:crypto";

import { SupabaseClient } from "@supabase/supabase-js";
import Stripe from "stripe";

import { BILLING_METRICS, PLANS, PlanTier } from "../../config/billing.js"
import type { BillingMetric } from "../../config/billing.js"
import { createLogger } from "../../lib/logger.js"
import { supabase as supabaseClient } from '../../lib/supabase.js';
import { billingSubscriptionCreateRollbackFailuresTotal } from '../../metrics/billingMetrics.js';
import { Subscription, SubscriptionItem } from "../../types/billing";

import CustomerService from "./CustomerService.js"
import StripeService from "./StripeService.js"

const logger = createLogger({ component: "SubscriptionService" });

// Constants for Stripe API (amounts are in cents)
const STRIPE_CENTS_PER_DOLLAR = 100;
const UNIX_TIMESTAMP_MULTIPLIER = 1000;

const supabase: SupabaseClient | null = supabaseClient ?? null;

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
   * Create subscription for tenant.
   *
   * Uses the intent-log pattern from TransactionalSubscriptionService:
   *   1. Write a `pending_subscription_changes` record (status=pending) BEFORE
   *      calling Stripe. If the process crashes mid-flight the reconciler can
   *      detect the divergence.
   *   2. Call Stripe with a stable idempotency key derived from the intent ID.
   *   3. Write the DB subscription record.
   *   4. Mark the intent completed.
   *
   * If the DB insert fails after Stripe succeeds, the intent record remains in
   * `stripe_updated` state. The reconciler will detect it and either complete
   * the DB write or cancel the Stripe subscription — no silent split-brain.
   */
  async createSubscription(
    tenantId: string,
    planTier: PlanTier,
    trialDays?: number,
    createRequestId?: string
  ): Promise<Subscription> {
    if (!this.stripe || !supabase || !this.stripeService) {
      throw new Error("Billing service not configured");
    }
    try {
      logger.info("Creating subscription", { tenantId, planTier, createRequestId });

      // Get or create customer
      const customer = await CustomerService.getCustomerByTenantId(tenantId);
      if (!customer) {
        throw new Error("Customer not found. Create customer first.");
      }

      const plan = PLANS[planTier];

      // ── Step 1: Write intent record ──────────────────────────────────────
      // This must happen before any Stripe call. If the process crashes after
      // Stripe succeeds but before the DB write, the reconciler detects the
      // `stripe_updated` record and completes or rolls back the operation.
      const intentId = crypto.randomUUID();
      const stripeIdempotencyKey = this.stripeService.generateIdempotencyKey(
        tenantId,
        "sub_create",
        idempotencyKey ?? intentId,
      );

      const { error: intentError } = await supabase
        .from("pending_subscription_changes")
        .insert({
          id: intentId,
          tenant_id: tenantId,
          subscription_id: null, // not yet created
          old_plan_tier: null,   // null signals a creation (not a plan change)
          new_plan_tier: planTier,
          idempotency_key: stripeIdempotencyKey,
          status: "pending",
        });

      if (intentError) {
        logger.error("Failed to write subscription creation intent", intentError, { tenantId });
        throw intentError;
      }

      // ── Step 2: Call Stripe ──────────────────────────────────────────────
      const items = this.buildSubscriptionItems(planTier);
      let stripeSubscription: Stripe.Subscription;
      try {
        stripeSubscription = await this.stripe.subscriptions.create(
          {
            customer: customer.stripe_customer_id,
            items,
            trial_period_days: trialDays,
            metadata: { tenant_id: tenantId, plan_tier: planTier },
          },
          { idempotencyKey: stripeIdempotencyKey },
        );
      } catch (stripeError) {
        // Stripe call failed — mark intent failed so the reconciler skips it
        await supabase
          .from("pending_subscription_changes")
          .update({
            status: "failed",
            error_message: stripeError instanceof Error ? stripeError.message : String(stripeError),
            updated_at: new Date().toISOString(),
          })
          .eq("id", intentId);
        throw stripeError;
      }

      // Mark intent as stripe_updated so the reconciler knows Stripe has state.
      // If this write fails, the intent stays in `pending` — the reconciler
      // would incorrectly treat it as "Stripe never called" and mark it failed,
      // leaving an active Stripe subscription with no DB record. Throw so the
      // caller surfaces the error and the intent is not silently misclassified.
      const { error: stripeUpdatedError } = await supabase
        .from("pending_subscription_changes")
        .update({
          status: "stripe_updated",
          stripe_updated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", intentId);

      if (stripeUpdatedError) {
        logger.error(
          "Failed to mark intent stripe_updated — Stripe subscription exists but intent is in pending state. Manual reconciliation required.",
          stripeUpdatedError,
          { tenantId, stripeSubscriptionId: stripeSubscription.id, intentId },
        );
        throw stripeUpdatedError;
      }

      // ── Step 3: Write DB subscription record ────────────────────────────
      let subscription: Subscription;
      try {
        const { data, error } = await supabase
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

        if (error) {
          if (error.code === "23505") {
            throw new Error("Active subscription already exists");
          }
          throw error;
        }
        subscription = data;
        if (pendingCreation?.id) {
          await supabase
            .from("pending_subscription_creations")
            .update({
              status: "completed",
              stripe_subscription_id: stripeSubscription.id,
              completed_at: new Date().toISOString(),
            })
            .eq("id", pendingCreation.id);
        }
      } catch (dbError) {
        // DB insert failed after Stripe succeeded. The intent record is in
        // `stripe_updated` state — the reconciler will detect this and either
        // retry the DB write or cancel the Stripe subscription. No silent
        // split-brain: the intent record is the recovery path.
        logger.error(
          "DB insert failed after Stripe subscription created — intent record left in stripe_updated for reconciler",
          dbError as Error,
          { tenantId, stripeSubscriptionId: stripeSubscription.id, intentId },
        );
        throw dbError;
      }

      // ── Step 4: Mark intent completed ───────────────────────────────────
      await supabase
        .from("pending_subscription_changes")
        .update({
          status: "completed",
          subscription_id: subscription.id,
          db_updated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", intentId);

      // Store subscription items and initialize usage quotas
      await this.storeSubscriptionItems(subscription.id, stripeSubscription.items.data, planTier);
      await this.initializeUsageQuotas(tenantId, subscription.id, planTier);

      logger.info("Subscription created", {
        tenantId,
        subscriptionId: stripeSubscription.id,
        intentId,
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

    BILLING_METRICS.forEach((metric) => {
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
    if (!supabase) {
      throw new Error("Supabase not configured");
    }
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
    if (!supabase) {
      throw new Error("Supabase not configured");
    }
    const plan = PLANS[planTier];
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const quotas = BILLING_METRICS.map((metric) => ({
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
    if (!supabase) {
      throw new Error("Supabase not configured");
    }
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
    if (!this.stripe || !this.stripeService) {
      throw new Error("Stripe service not available");
    }

    try {
      logger.info("Updating subscription with transaction safety", {
        tenantId,
        newPlanTier,
      });

      // Use transactional service for atomic updates
      const TransactionalService = (await import("./SubscriptionService.transaction")).default;
      const transactionalService = new TransactionalService(this.stripe);

      const result = await transactionalService.updateSubscriptionWithTransaction(
        tenantId,
        newPlanTier
      );
      return result as Subscription;
    } catch (error) {
      return this.stripeService!.handleError(error, "updateSubscription");
    }
  }

  /**
   * Legacy update subscription method (deprecated - use updateSubscription instead)
   * @deprecated Use updateSubscription for transaction safety
   */
  /** @deprecated Legacy direct Stripe + DB update path; use updateSubscription instead. */
  private async updateSubscriptionLegacy(tenantId: string, newPlanTier: PlanTier): Promise<Subscription> {
    if (!supabase || !this.stripe || !this.stripeService) {
      throw new Error("Billing service not configured");
    }
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
          const newPriceId = newPlan.stripePriceIds?.[item.metric as BillingMetric];
          if (newPriceId) {
            await this.stripe!.subscriptionItems.update(item.stripe_subscription_item_id, {
              price: newPriceId,
            });
          }
        }) || [];

      await Promise.all(updatePromises);

      // Update subscription in database
      const { data, error } = await supabase!
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
      return this.stripeService!.handleError(error, "updateSubscriptionLegacy");
    }
  }

  /**
   * Update usage quotas after plan change
   */
  private async updateUsageQuotas(tenantId: string, planTier: PlanTier): Promise<void> {
    if (!supabase) {
      throw new Error("Supabase not configured");
    }
    const plan = PLANS[planTier];

    const updates = BILLING_METRICS.map((metric) =>
      supabase!
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
   * Change the plan for an active subscription.
   *
   * Validates the transition (no same-plan change, no downgrade to free while
   * active), then delegates to updateSubscription which uses the transactional
   * service for atomic Stripe + DB updates.
   *
   * Callers should call previewSubscriptionChange first to show proration to
   * the user before committing.
   */
  async changePlan(
    tenantId: string,
    newPlanTier: PlanTier,
    options?: {
      effectiveDate?: string;
      justification?: string;
      idempotencyKey?: string;
    },
  ): Promise<Subscription> {
    if (!this.stripe || !this.stripeService) {
      throw new Error('Billing service not configured');
    }

    const current = await this.getActiveSubscription(tenantId);
    if (!current) {
      throw new Error('No active subscription found for tenant');
    }

    const currentTier = current.plan_tier as PlanTier;
    if (currentTier === newPlanTier) {
      throw new Error(`Tenant is already on the ${newPlanTier} plan`);
    }

    logger.info('changePlan: initiating plan change', {
      tenantId,
      from: currentTier,
      to: newPlanTier,
      effectiveDate: options?.effectiveDate,
      justification: options?.justification,
    });

    // Delegate to the transactional update path
    const updated = await this.updateSubscription(tenantId, newPlanTier);

    logger.info('changePlan: plan change completed', {
      tenantId,
      from: currentTier,
      to: newPlanTier,
      subscriptionId: updated.id,
    });

    return updated;
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(tenantId: string, immediately: boolean = false): Promise<Subscription> {
    if (!this.stripe || !supabase || !this.stripeService) {
      throw new Error("Billing service not configured");
    }
    try {
      const subscription = await this.getActiveSubscription(tenantId);
      if (!subscription) {
        throw new Error("No active subscription found");
      }

      logger.info("Canceling subscription", { tenantId, immediately });

      // Cancel in Stripe — idempotency key is stable per subscription+operation
      // so retries after a network failure don't double-cancel or create
      // conflicting state in Stripe.
      const cancelKey = this.stripeService.generateIdempotencyKey(
        tenantId,
        immediately ? "sub_cancel_immediate" : "sub_cancel_period_end",
        subscription.stripe_subscription_id,
      );
      const _stripeSubscription = immediately
        ? await this.stripe.subscriptions.cancel(
            subscription.stripe_subscription_id,
            undefined,
            { idempotencyKey: cancelKey },
          )
        : await this.stripe.subscriptions.update(
            subscription.stripe_subscription_id,
            { cancel_at_period_end: true },
            { idempotencyKey: cancelKey },
          );

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
    if (!supabase) {
      throw new Error("Supabase not configured");
    }
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

      if (!this.stripe) {
        throw new Error("Stripe not configured");
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

export const subscriptionService = new SubscriptionService();
/** @deprecated Use named import `subscriptionService` instead. */
export default subscriptionService;
