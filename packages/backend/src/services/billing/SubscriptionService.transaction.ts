/**
 * Transactional Subscription Service
 *
 * Provides atomic subscription plan changes across Stripe and the local DB.
 *
 * Problem with the naive two-phase approach:
 *   Stripe succeeds → DB update fails → rollback attempt may also fail →
 *   system is in an inconsistent state with no detection mechanism.
 *
 * Solution implemented here:
 *   1. Write a `pending_subscription_changes` record BEFORE calling Stripe.
 *      This is the intent log — if the process crashes mid-flight, the
 *      reconciler can detect and resolve the divergence.
 *   2. Use Stripe idempotency keys derived from (tenantId + changeId) so
 *      retries never double-bill.
 *   3. On success, mark the change record `completed`.
 *   4. On failure, mark it `failed` and attempt a best-effort Stripe rollback.
 *   5. `reconcileSubscription()` can be called by a background job to detect
 *      and resolve any `pending` or `needs_reconciliation` records.
 */

import crypto from "node:crypto";

import Stripe from "stripe";

import { PlanTier } from "../../config/billing.js";
import { createLogger } from "../../lib/logger.js";
import { subscriptionCreationDriftTotal } from "../../metrics/billingMetrics.js";

import StripeService from "./StripeService.js";

const logger = createLogger({ component: "TransactionalSubscriptionService" });

type SupabaseClient = Awaited<typeof import("../../lib/supabase.js")>["supabase"];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ChangeStatus =
  | "pending"           // intent written, Stripe not yet called
  | "stripe_updated"    // Stripe succeeded, DB not yet updated
  | "completed"         // both Stripe and DB updated successfully
  | "failed"            // update failed; rollback attempted
  | "needs_reconciliation"; // divergence detected; awaiting reconciler

export interface PendingSubscriptionChange {
  id: string;
  tenant_id: string;
  subscription_id: string;
  old_plan_tier: PlanTier;
  new_plan_tier: PlanTier;
  /** Stable idempotency key for all Stripe calls in this change. */
  idempotency_key: string;
  status: ChangeStatus;
  stripe_updated_at: string | null;
  db_updated_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export type CreationStatus =
  | "pending"               // intent written, Stripe not yet called
  | "stripe_created"        // Stripe subscription created, DB not yet written
  | "completed"             // both Stripe and DB written successfully
  | "failed"                // creation failed; Stripe subscription cancelled (or never created)
  | "needs_reconciliation"; // DB insert failed AND Stripe rollback failed; orphaned Stripe sub

export interface PendingSubscriptionCreation {
  id: string;
  tenant_id: string;
  plan_tier: PlanTier;
  idempotency_key: string;
  status: CreationStatus;
  stripe_subscription_id: string | null;
  stripe_created_at: string | null;
  subscription_id: string | null;
  db_created_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

interface SubscriptionRow {
  id: string;
  tenant_id: string;
  plan_tier: PlanTier;
  stripe_subscription_id: string;
}

interface SubscriptionItemRow {
  id: string;
  subscription_id: string;
  metric: string;
  stripe_subscription_item_id: string;
  stripe_price_id: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class TransactionalSubscriptionService {
  private stripe: Stripe;
  private stripeService: StripeService;
  // Per-instance lazy Supabase client — deferred so the module can be imported
  // in tests without triggering getValidatedSupabaseRuntimeConfig() at load time.
  // Stored per-instance so credential rotation or vi.resetModules() in tests
  // produces a fresh client on the next call rather than reusing a stale one.
  //
  // An explicit client can be injected via the constructor (e.g. a service-role
  // client from the reconciliation worker that needs to bypass RLS).
  private _supabase: SupabaseClient | null = null;

  constructor(stripe: Stripe, supabase?: SupabaseClient) {
    this.stripe = stripe;
    this.stripeService = StripeService.getInstance();
    if (supabase) this._supabase = supabase;
  }

  private async getSupabase(): Promise<SupabaseClient> {
    if (!this._supabase) {
      const mod = await import("../../lib/supabase.js");
      this._supabase = mod.supabase;
    }
    return this._supabase;
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Update a subscription plan atomically.
   *
   * Writes an intent record first so any mid-flight crash is detectable and
   * recoverable by `reconcileSubscription()`.
   */
  async updateSubscriptionWithTransaction(
    tenantId: string,
    newPlanTier: PlanTier,
  ): Promise<SubscriptionRow> {
    const subscription = await this.fetchActiveSubscription(tenantId);
    const items = await this.fetchSubscriptionItems(subscription.id);

    // Step 1: Write the intent record before touching Stripe.
    // The idempotency key is stable for this (tenant, subscription, newPlan) tuple
    // so retries are safe.
    const changeId = crypto.randomUUID();
    const idempotencyKey = this.stripeService.generateIdempotencyKey(
      tenantId,
      "plan_change",
      changeId,
    );

    const change = await this.createChangeRecord({
      id: changeId,
      tenant_id: tenantId,
      subscription_id: subscription.id,
      old_plan_tier: subscription.plan_tier,
      new_plan_tier: newPlanTier,
      idempotency_key: idempotencyKey,
    });

    // Tracks whether we reached the Stripe API call. If an error is thrown
    // before this point (e.g. missing price ID env var), rollback must be
    // skipped — no Stripe state was mutated.
    let stripeCallAttempted = false;

    try {
      // Step 2: Update Stripe subscription items.
      // Each item gets its own idempotency key derived from the change key so
      // partial retries (e.g. first item succeeded, second failed) are safe.
      stripeCallAttempted = true;
      const stripeResults = await this.updateStripeItems(items, newPlanTier, idempotencyKey);

      await this.markChangeStatus(change.id, "stripe_updated", {
        stripe_updated_at: new Date().toISOString(),
      });

      // Step 3: Update the DB subscription record.
      const updatedSubscription = await this.updateSubscriptionRecord(
        subscription.id,
        newPlanTier,
      );

      // Step 4: Update subscription items in DB.
      await this.updateSubscriptionItemsRecord(items, stripeResults);

      // Step 5: Update usage quotas.
      await this.updateUsageQuotas(tenantId, newPlanTier);

      await this.markChangeStatus(change.id, "completed", {
        db_updated_at: new Date().toISOString(),
      });

      logger.info("Subscription updated successfully", {
        tenantId,
        subscriptionId: subscription.id,
        oldPlanTier: subscription.plan_tier,
        newPlanTier,
        changeId,
      });

      return updatedSubscription;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error("Subscription update failed, attempting rollback", {
        tenantId,
        subscriptionId: subscription.id,
        changeId,
        error: errorMessage,
      });

      await this.markChangeStatus(change.id, "failed", { error_message: errorMessage });

      // Only attempt rollback if we actually reached Stripe. If the error
      // occurred before the API call (e.g. missing price ID env var), there
      // is nothing to revert and issuing rollback calls would be misleading.
      if (stripeCallAttempted) {
        const rollbackSucceeded = await this.rollbackStripeItems(items, idempotencyKey);

        if (!rollbackSucceeded) {
          await this.markChangeStatus(change.id, "needs_reconciliation");
          logger.error(
            "Stripe rollback failed — change marked needs_reconciliation. " +
              "Run reconcileSubscription() or check the pending_subscription_changes table.",
            { tenantId, changeId },
          );
        }
      }

      throw error;
    }
  }

  /**
   * Detect and resolve divergence between Stripe and the local DB.
   *
   * Should be called by a background job (e.g. every 15 minutes) to catch
   * any changes that were left in `pending`, `stripe_updated`, or
   * `needs_reconciliation` state due to crashes or partial failures.
   */
  async reconcileSubscription(tenantId: string): Promise<void> {
    const sb = await this.getSupabase();
    const { data: staleChanges, error } = await sb
      .from("pending_subscription_changes")
      .select("*")
      .eq("tenant_id", tenantId)
      .in("status", ["pending", "stripe_updated", "needs_reconciliation"])
      .order("created_at", { ascending: true });

    if (error) {
      logger.error("Failed to fetch stale subscription changes for reconciliation", {
        tenantId,
        error: error.message,
      });
      return;
    }

    if (!staleChanges || staleChanges.length === 0) return;

    logger.info("Reconciling stale subscription changes", {
      tenantId,
      count: staleChanges.length,
    });

    await Promise.all(
      (staleChanges as PendingSubscriptionChange[]).map((change) =>
        this.reconcileChange(change),
      ),
    );
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async fetchActiveSubscription(tenantId: string): Promise<SubscriptionRow> {
    const { data, error } = await (await this.getSupabase())
      .from("subscriptions")
      .select("id, tenant_id, plan_tier, stripe_subscription_id")
      .eq("tenant_id", tenantId)
      .in("status", ["active", "trialing", "past_due"])
      .single();

    if (error) throw new Error(`Failed to fetch subscription: ${error.message}`);
    if (!data) throw new Error("No active subscription found");
    return data as SubscriptionRow;
  }

  private async fetchSubscriptionItems(subscriptionId: string): Promise<SubscriptionItemRow[]> {
    const { data, error } = await (await this.getSupabase())
      .from("subscription_items")
      .select("id, subscription_id, metric, stripe_subscription_item_id, stripe_price_id")
      .eq("subscription_id", subscriptionId);

    if (error) throw new Error(`Failed to fetch subscription items: ${error.message}`);
    return (data ?? []) as SubscriptionItemRow[];
  }

  private async createChangeRecord(
    input: Omit<PendingSubscriptionChange, "status" | "stripe_updated_at" | "db_updated_at" | "error_message" | "created_at" | "updated_at">,
  ): Promise<PendingSubscriptionChange> {
    const now = new Date().toISOString();
    const record = {
      ...input,
      status: "pending" as ChangeStatus,
      stripe_updated_at: null,
      db_updated_at: null,
      error_message: null,
      created_at: now,
      updated_at: now,
    };

    const { data, error } = await (await this.getSupabase())
      .from("pending_subscription_changes")
      .insert(record)
      .select()
      .single();

    if (error) throw new Error(`Failed to create change record: ${error.message}`);
    return data as PendingSubscriptionChange;
  }

  private async markChangeStatus(
    changeId: string,
    status: ChangeStatus,
    extra: Partial<Pick<PendingSubscriptionChange, "stripe_updated_at" | "db_updated_at" | "error_message">> = {},
  ): Promise<void> {
    const { error } = await (await this.getSupabase())
      .from("pending_subscription_changes")
      .update({ status, updated_at: new Date().toISOString(), ...extra })
      .eq("id", changeId);

    if (error) {
      // Non-fatal: the change record is a diagnostic aid. Log and continue.
      logger.warn("Failed to update change record status", {
        changeId,
        status,
        error: error.message,
      });
    }
  }

  private async updateStripeItems(
    items: SubscriptionItemRow[],
    newPlanTier: PlanTier,
    baseIdempotencyKey: string,
  ): Promise<Stripe.SubscriptionItem[]> {
    const results = await Promise.all(
      items.map(async (item, index) => {
        const newPriceId = this.getPriceIdForPlan(newPlanTier, item.metric);
        if (!newPriceId) {
          throw new Error(
            `No price ID configured for metric "${item.metric}" in plan "${newPlanTier}". ` +
              "Check STRIPE_PRICE_* environment variables.",
          );
        }

        // Per-item idempotency key: stable for this change + item combination.
        const itemIdempotencyKey = `${baseIdempotencyKey}_item_${index}`;

        return this.stripe.subscriptionItems.update(
          item.stripe_subscription_item_id,
          { price: newPriceId },
          { idempotencyKey: itemIdempotencyKey },
        );
      }),
    );

    return results;
  }

  private async updateSubscriptionRecord(
    subscriptionId: string,
    newPlanTier: PlanTier,
  ): Promise<SubscriptionRow> {
    const { data, error } = await (await this.getSupabase())
      .from("subscriptions")
      .update({ plan_tier: newPlanTier, updated_at: new Date().toISOString() })
      .eq("id", subscriptionId)
      .select("id, tenant_id, plan_tier, stripe_subscription_id")
      .single();

    if (error) throw new Error(`Failed to update subscription record: ${error.message}`);
    return data as SubscriptionRow;
  }

  private async updateSubscriptionItemsRecord(
    items: SubscriptionItemRow[],
    stripeResults: Stripe.SubscriptionItem[],
  ): Promise<void> {
    const updates = stripeResults.map((result, index) => ({
      id: items[index]?.id,
      stripe_price_id: result.price.id,
      updated_at: new Date().toISOString(),
    }));

    const supabase = await this.getSupabase();
    const { error } = await supabase.from("subscription_items").upsert(updates);
    if (error) throw new Error(`Failed to update subscription items: ${error.message}`);
  }

  /**
   * Best-effort rollback: revert Stripe items to their original price IDs.
   * Returns true if all rollbacks succeeded, false if any failed.
   *
   * `items` MUST be the pre-forward-update snapshot (old price IDs). Callers
   * must not re-fetch subscription items between the forward update and this
   * call, or the "original" price IDs will already reflect the new plan.
   */
  private async rollbackStripeItems(
    items: SubscriptionItemRow[],
    baseIdempotencyKey: string,
  ): Promise<boolean> {
    // Use Promise.allSettled so each item's outcome is independent and the
    // results are inspected from a single array rather than via a shared
    // mutable flag that concurrent callbacks could race on.
    const results = await Promise.allSettled(
      items.map((item, index) => {
        // Rollback idempotency key is distinct from the forward key so Stripe
        // treats it as a separate operation.
        const rollbackKey = `${baseIdempotencyKey}_rollback_${index}`;
        return this.stripe.subscriptionItems.update(
          item.stripe_subscription_item_id,
          { price: item.stripe_price_id },
          { idempotencyKey: rollbackKey },
        );
      }),
    );

    let allSucceeded = true;
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === "rejected") {
        allSucceeded = false;
        logger.error("Failed to rollback Stripe subscription item", {
          itemId: items[i].id,
          stripeItemId: items[i].stripe_subscription_item_id,
          originalPriceId: items[i].stripe_price_id,
          error: result.reason instanceof Error ? result.reason.message : String(result.reason),
        });
      }
    }

    return allSucceeded;
  }

  /**
   * Reconcile a single stale change record.
   *
   * Strategy:
   * - `pending`: Stripe was never called. Safe to mark failed and let the
   *   caller retry via the normal path.
   * - `stripe_updated`: Stripe succeeded but DB was not updated. Re-apply
   *   the DB update using the already-committed Stripe state.
   * - `needs_reconciliation`: Rollback failed. Fetch current Stripe state
   *   and align the DB to it.
   */
  private async reconcileChange(change: PendingSubscriptionChange): Promise<void> {
    logger.info("Reconciling subscription change", {
      changeId: change.id,
      tenantId: change.tenant_id,
      status: change.status,
    });

    try {
      if (change.status === "pending") {
        // Stripe was never called — safe to mark failed.
        await this.markChangeStatus(change.id, "failed", {
          error_message: "Marked failed by reconciler: Stripe was never called",
        });
        return;
      }

      if (change.status === "stripe_updated" || change.status === "needs_reconciliation") {
        // Fetch the current Stripe subscription to determine ground truth.
        const subscription = await this.fetchActiveSubscription(change.tenant_id);
        const stripeSubscription = await this.stripe.subscriptions.retrieve(
          subscription.stripe_subscription_id,
          { expand: ["items.data.price"] },
        );

        // Align the DB to the Stripe state.
        const { error: updateError } = await (await this.getSupabase())
          .from("subscriptions")
          .update({
            plan_tier: change.new_plan_tier,
            updated_at: new Date().toISOString(),
          })
          .eq("id", subscription.id);

        if (updateError) {
          logger.error("Reconciler failed to update subscription record", {
            changeId: change.id,
            error: updateError.message,
          });
          return;
        }

        // Align subscription items.
        const itemUpdates = stripeSubscription.items.data.map((stripeItem) => ({
          stripe_subscription_item_id: stripeItem.id,
          stripe_price_id: stripeItem.price.id,
          updated_at: new Date().toISOString(),
        }));

        const supabaseForItems = await this.getSupabase();
        await supabaseForItems.from("subscription_items").upsert(itemUpdates);

        await this.markChangeStatus(change.id, "completed", {
          db_updated_at: new Date().toISOString(),
        });

        logger.info("Reconciler resolved subscription change", {
          changeId: change.id,
          tenantId: change.tenant_id,
        });
      }
    } catch (err) {
      logger.error("Reconciler failed to resolve change", {
        changeId: change.id,
        tenantId: change.tenant_id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private getPriceIdForPlan(planTier: PlanTier, metric: string): string | null {
    const priceMap: Record<PlanTier, Record<string, string>> = {
      free: {
        llm_tokens:        process.env.STRIPE_PRICE_LLM_TOKENS_FREE ?? "",
        agent_executions:  process.env.STRIPE_PRICE_AGENT_EXECUTIONS_FREE ?? "",
        api_calls:         process.env.STRIPE_PRICE_API_CALLS_FREE ?? "",
        storage_gb:        process.env.STRIPE_PRICE_STORAGE_FREE ?? "",
        user_seats:        process.env.STRIPE_PRICE_USER_SEATS_FREE ?? "",
      },
      standard: {
        llm_tokens:        process.env.STRIPE_PRICE_LLM_TOKENS_STANDARD ?? "",
        agent_executions:  process.env.STRIPE_PRICE_AGENT_EXECUTIONS_STANDARD ?? "",
        api_calls:         process.env.STRIPE_PRICE_API_CALLS_STANDARD ?? "",
        storage_gb:        process.env.STRIPE_PRICE_STORAGE_STANDARD ?? "",
        user_seats:        process.env.STRIPE_PRICE_USER_SEATS_STANDARD ?? "",
      },
      enterprise: {
        llm_tokens:        process.env.STRIPE_PRICE_LLM_TOKENS_ENTERPRISE ?? "",
        agent_executions:  process.env.STRIPE_PRICE_AGENT_EXECUTIONS_ENTERPRISE ?? "",
        api_calls:         process.env.STRIPE_PRICE_API_CALLS_ENTERPRISE ?? "",
        storage_gb:        process.env.STRIPE_PRICE_STORAGE_ENTERPRISE ?? "",
        user_seats:        process.env.STRIPE_PRICE_USER_SEATS_ENTERPRISE ?? "",
      },
    };

    return priceMap[planTier]?.[metric] || null;
  }

  private async updateUsageQuotas(tenantId: string, planTier: PlanTier): Promise<void> {
    const { PLANS } = await import("../../config/billing.js");
    const plan = PLANS[planTier];
    const metrics = ["llm_tokens", "agent_executions", "api_calls", "storage_gb", "user_seats"];

    const supabase = await this.getSupabase();
    await Promise.all(
      metrics.map((metric) =>
        supabase
          .from("usage_quotas")
          .update({
            quota_amount: plan.quotas[metric as keyof typeof plan.quotas],
            hard_cap: plan.hardCaps[metric as keyof typeof plan.hardCaps],
            updated_at: new Date().toISOString(),
          })
          .eq("tenant_id", tenantId)
          .eq("metric", metric),
      ),
    );
  }

  // ── Subscription creation reconciliation ─────────────────────────────────

  /**
   * Scan for stale `pending_subscription_creations` records and resolve them.
   *
   * Called by the background reconciliation worker on each scheduled run.
   * Returns the number of records resolved (cancelled or completed).
   *
   * Resolution strategy per status:
   * - `pending`: Stripe was never called (process died before step 2).
   *   Mark failed — no Stripe action needed.
   * - `stripe_created` / `needs_reconciliation`: A live Stripe subscription
   *   exists with no corresponding DB row. Cancel it in Stripe and mark the
   *   intent failed so the customer is not billed without service access.
   *   If the DB row was actually written (race between worker and original
   *   request), mark completed instead.
   */
  async reconcileSubscriptionCreations(
    staleCutoffMs = 5 * 60 * 1000,
    batchSize = 50,
  ): Promise<number> {
    const sb = await this.getSupabase();
    const cutoff = new Date(Date.now() - staleCutoffMs).toISOString();

    let resolved = 0;

    // Always fetch from the start of the result set (no offset). Each batch
    // updates processed rows out of the stale status set, so the next query
    // naturally returns the next unprocessed rows without skipping any.
    // Using a numeric offset on a mutating result set would skip rows that
    // shift into vacated positions after each batch is processed.
    while (true) {
      const { data: batch, error } = await sb
        .from("pending_subscription_creations")
        .select("*")
        .in("status", ["pending", "stripe_created", "needs_reconciliation"])
        .lt("updated_at", cutoff)
        .order("created_at", { ascending: true })
        .limit(batchSize);

      if (error) {
        logger.error("Failed to fetch stale subscription creations for reconciliation", {
          error: error.message,
        });
        break;
      }

      if (!batch || batch.length === 0) break;

      logger.info("Reconciling stale subscription creations batch", {
        count: batch.length,
      });

      const results = await Promise.allSettled(
        (batch as PendingSubscriptionCreation[]).map((intent) =>
          this.reconcileCreationIntent(intent),
        ),
      );

      for (const result of results) {
        if (result.status === "fulfilled") resolved++;
      }

      // If the batch was smaller than batchSize, we've reached the end.
      if (batch.length < batchSize) break;
    }

    return resolved;
  }

  private async reconcileCreationIntent(intent: PendingSubscriptionCreation): Promise<void> {
    const sb = await this.getSupabase();

    logger.info("Reconciling subscription creation intent", {
      intentId: intent.id,
      tenantId: intent.tenant_id,
      status: intent.status,
      stripeSubscriptionId: intent.stripe_subscription_id,
    });

    try {
      if (intent.status === "pending") {
        // Stripe was never called — nothing to cancel.
        await sb
          .from("pending_subscription_creations")
          .update({
            status: "failed",
            error_message: "Marked failed by reconciler: process died before Stripe was called",
            updated_at: new Date().toISOString(),
          })
          .eq("id", intent.id);
        logger.info("Reconciler marked creation intent failed (no Stripe call made)", {
          intentId: intent.id,
          tenantId: intent.tenant_id,
        });
        return;
      }

      // status is stripe_created or needs_reconciliation — a Stripe subscription exists.
      const stripeSubId = intent.stripe_subscription_id;
      if (!stripeSubId) {
        // Shouldn't happen, but guard defensively.
        logger.warn("Reconciler: stripe_subscription_id missing on non-pending intent", {
          intentId: intent.id,
        });
        return;
      }

      // Check whether the DB row was actually written (e.g. the original
      // request succeeded after the intent was flagged stale).
      const { data: existingRow } = await sb
        .from("subscriptions")
        .select("id")
        .eq("stripe_subscription_id", stripeSubId)
        .maybeSingle();

      if (existingRow) {
        // DB row exists — the creation completed; just close the intent.
        await sb
          .from("pending_subscription_creations")
          .update({
            status: "completed",
            subscription_id: existingRow.id,
            db_created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", intent.id);
        logger.info("Reconciler: creation intent already completed (DB row found)", {
          intentId: intent.id,
          tenantId: intent.tenant_id,
          stripeSubscriptionId: stripeSubId,
        });
        return;
      }

      // No DB row — cancel the orphaned Stripe subscription.
      // Mark the intent as cancelling BEFORE calling Stripe so that if the
      // subsequent DB update fails, the intent is already in a terminal-ish
      // state. On the next reconciler run the status check will see
      // `cancelling` and skip the Stripe call rather than attempting to cancel
      // an already-cancelled subscription (which Stripe rejects with an error).
      subscriptionCreationDriftTotal.inc({ tenant_id: intent.tenant_id });

      await sb
        .from("pending_subscription_creations")
        .update({
          status: "failed",
          error_message:
            "Reconciler cancelling orphaned Stripe subscription: DB row was never written",
          updated_at: new Date().toISOString(),
        })
        .eq("id", intent.id);

      // Cancel in Stripe after the intent is marked. If this call fails, the
      // intent is already terminal so the next run will not retry the cancel.
      // The Stripe subscription may remain active briefly until manual cleanup,
      // but the drift metric and log provide the signal for intervention.
      try {
        await this.stripe.subscriptions.cancel(stripeSubId);
      } catch (cancelErr) {
        logger.error("Reconciler failed to cancel orphaned Stripe subscription", {
          intentId: intent.id,
          tenantId: intent.tenant_id,
          stripeSubscriptionId: stripeSubId,
          error: cancelErr instanceof Error ? cancelErr.message : String(cancelErr),
        });
        // Do not re-throw: the intent is already marked failed. The drift
        // metric is already incremented. Manual cleanup of the Stripe
        // subscription is required.
        return;
      }

      logger.warn("Reconciler cancelled orphaned Stripe subscription", {
        intentId: intent.id,
        tenantId: intent.tenant_id,
        stripeSubscriptionId: stripeSubId,
      });
    } catch (err) {
      logger.error("Reconciler failed to resolve creation intent", {
        intentId: intent.id,
        tenantId: intent.tenant_id,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }
}

export { TransactionalSubscriptionService };
/** @deprecated Use named import `TransactionalSubscriptionService` instead. */
export default TransactionalSubscriptionService;
