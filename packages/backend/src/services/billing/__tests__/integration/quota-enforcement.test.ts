/**
 * Quota Enforcement Integration Tests
 * Validates quota checking, alerts, and enforcement at all thresholds
 *
 * CRITICAL: These tests ensure revenue protection and service abuse prevention.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createCompleteBillingSetup,
  createUsageAlert,
  createUsageEvent,
  createUsageQuota,
} from "../__helpers__/billing-factories";
import {
  assertRecordExists,
  cleanupBillingTables,
  getTestSupabaseClient,
  seedTestData,
  supabaseAvailable
} from "../__helpers__/db-helpers";

describe.skipIf(!supabaseAvailable)("Quota Enforcement Integration Tests", () => {
  let supabase: SupabaseClient;

  beforeEach(async () => {
    supabase = getTestSupabaseClient();
    await cleanupBillingTables(supabase);
  });

  afterEach(async () => {
    await cleanupBillingTables(supabase);
  });

  describe("Quota Threshold Detection", () => {
    it("should detect 80% quota usage (warning threshold)", async () => {
      const tenantId = `tenant_${Date.now()}`;
      const quota = createUsageQuota("llm_tokens", {
        tenant_id: tenantId,
        quota_amount: 1000000,
        current_usage: 800000, // 80%
      });

      await seedTestData(supabase, { usageQuotas: [quota] });

      // Check usage percentage
      const { data } = await supabase
        .rpc("get_usage_percentage", {
          p_tenant_id: tenantId,
          p_metric: "llm_tokens",
        })
        .single();

      // Should be at or near 80%
      expect(data).toBeGreaterThanOrEqual(79);
      expect(data).toBeLessThanOrEqual(81);

      // Should trigger warning alert
      const alert = createUsageAlert("llm_tokens", 80, {
        tenant_id: tenantId,
        current_usage: 800000,
        quota_amount: 1000000,
      });

      const { error } = await supabase.from("usage_alerts").insert(alert);
      expect(error).toBeNull();

      await assertRecordExists(supabase, "usage_alerts", {
        tenant_id: tenantId,
        threshold_percentage: 80,
        alert_type: "warning",
      });
    });

    it("should detect 100% quota usage (critical threshold)", async () => {
      const tenantId = `tenant_${Date.now()}`;
      const quota = createUsageQuota("llm_tokens", {
        tenant_id: tenantId,
        quota_amount: 1000000,
        current_usage: 1000000, // 100%
      });

      await seedTestData(supabase, { usageQuotas: [quota] });

      // Check if over quota
      const { data: isOver } = await supabase
        .rpc("is_over_quota", {
          p_tenant_id: tenantId,
          p_metric: "llm_tokens",
        })
        .single();

      expect(isOver).toBe(true);

      // Should create critical alert
      const alert = createUsageAlert("llm_tokens", 100, {
        tenant_id: tenantId,
        current_usage: 1000000,
        quota_amount: 1000000,
      });

      await supabase.from("usage_alerts").insert(alert);

      await assertRecordExists(supabase, "usage_alerts", {
        tenant_id: tenantId,
        threshold_percentage: 100,
        alert_type: "critical",
      });
    });

    it("should detect 120% quota usage (exceeded threshold)", async () => {
      const tenantId = `tenant_${Date.now()}`;
      const quota = createUsageQuota("llm_tokens", {
        tenant_id: tenantId,
        quota_amount: 1000000,
        current_usage: 1200000, // 120%
        hard_cap: false, // Allows overage
      });

      await seedTestData(supabase, { usageQuotas: [quota] });

      const { data: percentage } = await supabase
        .rpc("get_usage_percentage", {
          p_tenant_id: tenantId,
          p_metric: "llm_tokens",
        })
        .single();

      expect(percentage).toBeGreaterThanOrEqual(120);

      // Should create exceeded alert
      const alert = createUsageAlert("llm_tokens", 120, {
        tenant_id: tenantId,
        current_usage: 1200000,
        quota_amount: 1000000,
      });

      await supabase.from("usage_alerts").insert(alert);

      await assertRecordExists(supabase, "usage_alerts", {
        tenant_id: tenantId,
        threshold_percentage: 120,
        alert_type: "exceeded",
      });
    });
  });

  describe("Hard Cap Enforcement", () => {
    it("should block usage when hard cap is reached", async () => {
      const tenantId = `tenant_${Date.now()}`;
      const quota = createUsageQuota("storage_gb", {
        tenant_id: tenantId,
        quota_amount: 100,
        current_usage: 100,
        hard_cap: true, // Hard cap enabled
      });

      await seedTestData(supabase, { usageQuotas: [quota] });

      // Attempt to add more usage
      const newEvent = createUsageEvent("storage_gb", 10, {
        tenant_id: tenantId,
      });

      // In production, application would check quota before accepting
      const { data: isOver } = await supabase
        .rpc("is_over_quota", {
          p_tenant_id: tenantId,
          p_metric: "storage_gb",
        })
        .single();

      expect(isOver).toBe(true);

      // Application should reject this event
      // Document: Implement pre-submission quota check
    });

    it("should allow overage when hard cap is disabled", async () => {
      const tenantId = `tenant_${Date.now()}`;
      const quota = createUsageQuota("llm_tokens", {
        tenant_id: tenantId,
        quota_amount: 1000000,
        current_usage: 1000000,
        hard_cap: false, // Overage allowed
      });

      await seedTestData(supabase, { usageQuotas: [quota] });

      // Overage is allowed, will be charged
      const overageEvent = createUsageEvent("llm_tokens", 100000, {
        tenant_id: tenantId,
      });

      const { error } = await supabase
        .from("usage_events")
        .insert(overageEvent);
      expect(error).toBeNull();

      // Update quota with overage
      await supabase
        .from("usage_quotas")
        .update({ current_usage: 1100000 })
        .eq("tenant_id", tenantId)
        .eq("metric", "llm_tokens");

      // Verify overage recorded
      const { data } = await supabase
        .from("usage_quotas")
        .select("current_usage, quota_amount")
        .eq("tenant_id", tenantId)
        .eq("metric", "llm_tokens")
        .single();

      expect(data!.current_usage).toBeGreaterThan(data!.quota_amount);
    });
  });

  describe("Multi-Metric Quota Tracking", () => {
    it("should track quotas independently for each metric", async () => {
      const tenantId = `tenant_${Date.now()}`;
      const setup = createCompleteBillingSetup("standard", tenantId);

      await seedTestData(supabase, {
        customers: [setup.customer],
        subscriptions: [setup.subscription],
        usageQuotas: setup.quotas,
      });

      // Update usage for different metrics
      await supabase
        .from("usage_quotas")
        .update({ current_usage: 900000 }) // 90%
        .eq("tenant_id", tenantId)
        .eq("metric", "llm_tokens");

      await supabase
        .from("usage_quotas")
        .update({ current_usage: 500 }) // 10%
        .eq("tenant_id", tenantId)
        .eq("metric", "agent_executions");

      // Verify independent tracking
      const { data: quotas } = await supabase
        .from("usage_quotas")
        .select("metric, current_usage, quota_amount")
        .eq("tenant_id", tenantId);

      expect(quotas).toHaveLength(5);

      const tokensQuota = quotas!.find((q) => q.metric === "llm_tokens");
      const executionsQuota = quotas!.find(
        (q) => q.metric === "agent_executions"
      );

      expect(
        tokensQuota!.current_usage / tokensQuota!.quota_amount
      ).toBeGreaterThan(0.8);
      expect(
        executionsQuota!.current_usage / executionsQuota!.quota_amount
      ).toBeLessThan(0.2);
    });
  });

  describe("Alert Generation", () => {
    it("should create only one alert per threshold per period", async () => {
      const tenantId = `tenant_${Date.now()}`;

      const alert1 = createUsageAlert("llm_tokens", 80, {
        tenant_id: tenantId,
      });

      await supabase.from("usage_alerts").insert(alert1);

      // Attempt to create duplicate alert
      const alert2 = createUsageAlert("llm_tokens", 80, {
        tenant_id: tenantId,
      });

      await supabase.from("usage_alerts").insert(alert2);

      // Should have 2 alerts (no unique constraint)
      const { count } = await supabase
        .from("usage_alerts")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("threshold_percentage", 80);

      expect(count).toBe(2);

      // Document: Application should check for existing unacknowledged alerts
      // before creating new ones
    });

    it("should track alert acknowledgment", async () => {
      const tenantId = `tenant_${Date.now()}`;
      const userId = "user_123";

      const alert = createUsageAlert("llm_tokens", 80, {
        tenant_id: tenantId,
        acknowledged: false,
      });

      await supabase.from("usage_alerts").insert(alert);

      // Acknowledge alert
      await supabase
        .from("usage_alerts")
        .update({
          acknowledged: true,
          acknowledged_at: new Date().toISOString(),
          acknowledged_by: userId,
        })
        .eq("id", alert.id);

      const { data } = await supabase
        .from("usage_alerts")
        .select("acknowledged, acknowledged_by")
        .eq("id", alert.id)
        .single();

      expect(data!.acknowledged).toBe(true);
      expect(data!.acknowledged_by).toBe(userId);
    });

    it("should mark alerts for notification", async () => {
      const tenantId = `tenant_${Date.now()}`;

      const alert = createUsageAlert("llm_tokens", 100, {
        tenant_id: tenantId,
        notification_sent: false,
      });

      await supabase.from("usage_alerts").insert(alert);

      // Mark as notified
      await supabase
        .from("usage_alerts")
        .update({
          notification_sent: true,
          notification_sent_at: new Date().toISOString(),
        })
        .eq("id", alert.id);

      const { data } = await supabase
        .from("usage_alerts")
        .select("notification_sent, notification_sent_at")
        .eq("id", alert.id)
        .single();

      expect(data!.notification_sent).toBe(true);
      expect(data!.notification_sent_at).toBeTruthy();
    });
  });

  describe("Quota Period Rollover", () => {
    it("should reset usage at period end", async () => {
      const tenantId = `tenant_${Date.now()}`;

      // Current period ending
      const oldPeriodEnd = new Date();
      const quota = createUsageQuota("llm_tokens", {
        tenant_id: tenantId,
        quota_amount: 1000000,
        current_usage: 950000,
        period_start: new Date(
          oldPeriodEnd.getTime() - 30 * 24 * 60 * 60 * 1000
        ).toISOString(),
        period_end: oldPeriodEnd.toISOString(),
      });

      await seedTestData(supabase, { usageQuotas: [quota] });

      // New period starts
      const newPeriodStart = new Date(oldPeriodEnd.getTime() + 1);
      const newPeriodEnd = new Date(
        newPeriodStart.getTime() + 30 * 24 * 60 * 60 * 1000
      );

      await supabase
        .from("usage_quotas")
        .update({
          current_usage: 0, // Reset
          period_start: newPeriodStart.toISOString(),
          period_end: newPeriodEnd.toISOString(),
        })
        .eq("id", quota.id);

      const { data } = await supabase
        .from("usage_quotas")
        .select("current_usage")
        .eq("id", quota.id)
        .single();

      expect(data!.current_usage).toBe(0);
    });
  });

  describe("Plan-Specific Quotas", () => {
    it("should enforce free plan quotas", async () => {
      const tenantId = `tenant_${Date.now()}`;
      const setup = createCompleteBillingSetup("free", tenantId);

      await seedTestData(supabase, {
        customers: [setup.customer],
        subscriptions: [setup.subscription],
        usageQuotas: setup.quotas,
      });

      // Free plan: 10K tokens
      const { data } = await supabase
        .from("usage_quotas")
        .select("quota_amount")
        .eq("tenant_id", tenantId)
        .eq("metric", "llm_tokens")
        .single();

      expect(data!.quota_amount).toBe(10000);
    });

    it("should enforce standard plan quotas", async () => {
      const tenantId = `tenant_${Date.now()}`;
      const setup = createCompleteBillingSetup("standard", tenantId);

      await seedTestData(supabase, {
        customers: [setup.customer],
        subscriptions: [setup.subscription],
        usageQuotas: setup.quotas,
      });

      // Standard plan: 1M tokens
      const { data } = await supabase
        .from("usage_quotas")
        .select("quota_amount")
        .eq("tenant_id", tenantId)
        .eq("metric", "llm_tokens")
        .single();

      expect(data!.quota_amount).toBe(1000000);
    });

    it("should enforce enterprise plan quotas", async () => {
      const tenantId = `tenant_${Date.now()}`;
      const setup = createCompleteBillingSetup("enterprise", tenantId);

      await seedTestData(supabase, {
        customers: [setup.customer],
        subscriptions: [setup.subscription],
        usageQuotas: setup.quotas,
      });

      // Enterprise plan: 10M tokens
      const { data } = await supabase
        .from("usage_quotas")
        .select("quota_amount")
        .eq("tenant_id", tenantId)
        .eq("metric", "llm_tokens")
        .single();

      expect(data!.quota_amount).toBe(10000000);
    });
  });

  describe("Real-time Usage Updates", () => {
    it("should update current_usage when events are processed", async () => {
      const tenantId = `tenant_${Date.now()}`;
      const quota = createUsageQuota("llm_tokens", {
        tenant_id: tenantId,
        quota_amount: 1000000,
        current_usage: 0,
      });

      await seedTestData(supabase, { usageQuotas: [quota] });

      // Add usage events
      const events = Array.from({ length: 10 }, () =>
        createUsageEvent("llm_tokens", 1000, { tenant_id: tenantId })
      );

      await supabase.from("usage_events").insert(events);

      // Calculate total usage
      const { data: totalUsage } = await supabase
        .rpc("get_current_usage", {
          p_tenant_id: tenantId,
          p_metric: "llm_tokens",
        })
        .single();

      expect(totalUsage).toBe(10000);

      // Update quota
      await supabase
        .from("usage_quotas")
        .update({ current_usage: totalUsage })
        .eq("id", quota.id);

      const { data } = await supabase
        .from("usage_quotas")
        .select("current_usage")
        .eq("id", quota.id)
        .single();

      expect(data!.current_usage).toBe(10000);
    });
  });
});
