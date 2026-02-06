/**
 * LLM Cost Tracker
 *
 * Tracks and monitors LLM usage costs across the application.
 * Provides cost analytics, alerts, and optimization recommendations.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../lib/logger.js"
import { getEnvVar, getLLMCostTrackerConfig, getSupabaseConfig } from "@shared/lib/env";

const TOKENS_PER_MILLION = 1_000_000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const DAYS_PER_MONTH = 30;
const MILLIS_PER_SECOND = 1_000;
const ONE_HOUR_MS = MINUTES_PER_HOUR * SECONDS_PER_MINUTE * MILLIS_PER_SECOND;
const ONE_DAY_MS = HOURS_PER_DAY * ONE_HOUR_MS;
const ONE_MONTH_MS = DAYS_PER_MONTH * ONE_DAY_MS;

type PricingRate = { input: number; output: number };

/**
 * Together.ai pricing (as of 2024)
 * Prices are per 1M tokens
 */
const TOGETHER_AI_PRICING: Record<string, PricingRate> = {
  // Meta Llama 3.1 models
  "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo": {
    input: 0.88,
    output: 0.88,
  },
  "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo": {
    input: 0.18,
    output: 0.18,
  },
  "meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo": {
    input: 3.5,
    output: 3.5,
  },
  // Meta Llama 3 models
  "meta-llama/Llama-3-70b-chat-hf": {
    input: 0.9,
    output: 0.9,
  },
  "meta-llama/Llama-3-8b-chat-hf": {
    input: 0.2,
    output: 0.2,
  },
  // Mixtral models
  "mistralai/Mixtral-8x7B-Instruct-v0.1": {
    input: 0.6,
    output: 0.6,
  },
  "mistralai/Mixtral-8x22B-Instruct-v0.1": {
    input: 1.2,
    output: 1.2,
  },
  "mistralai/Mistral-7B-Instruct-v0.3": {
    input: 0.2,
    output: 0.2,
  },
  // Microsoft Phi models
  "microsoft/phi-4-mini": {
    input: 0.1,
    output: 0.1,
  },
  "microsoft/phi-3-medium-128k-instruct": {
    input: 0.2,
    output: 0.2,
  },
  // Qwen models
  "Qwen/Qwen2-72B-Instruct": {
    input: 0.9,
    output: 0.9,
  },
  "Qwen/Qwen2.5-72B-Instruct-Turbo": {
    input: 0.6,
    output: 0.6,
  },
  // DeepSeek models
  "deepseek-ai/DeepSeek-V2-Chat": {
    input: 0.14,
    output: 0.28,
  },
  "deepseek-ai/deepseek-llm-67b-chat": {
    input: 0.9,
    output: 0.9,
  },
  // Google Gemma
  "google/gemma-2-27b-it": {
    input: 0.8,
    output: 0.8,
  },
  // Default pricing for unknown models
  default: {
    input: 1.0,
    output: 1.0,
  },
};

const DEFAULT_PRICING_KEY = "default";

const resolvePricing = (model: string): PricingRate => {
  return (TOGETHER_AI_PRICING[model] ??
    TOGETHER_AI_PRICING[DEFAULT_PRICING_KEY]) as PricingRate;
};

/**
 * Cost thresholds for alerts
 */
// Cost thresholds for alerts (configurable via environment variables)
const COST_THRESHOLDS = {
  hourly: {
    warning: parseFloat(
      getEnvVar("LLM_COST_HOURLY_WARNING", { defaultValue: "10" }) || "10"
    ),
    critical: parseFloat(
      getEnvVar("LLM_COST_HOURLY_CRITICAL", { defaultValue: "50" }) || "50"
    ),
  },
  daily: {
    warning: parseFloat(
      getEnvVar("LLM_COST_DAILY_WARNING", { defaultValue: "100" }) || "100"
    ),
    critical: parseFloat(
      getEnvVar("LLM_COST_DAILY_CRITICAL", { defaultValue: "500" }) || "500"
    ),
  },
  monthly: {
    warning: parseFloat(
      getEnvVar("LLM_COST_MONTHLY_WARNING", { defaultValue: "1000" }) || "1000"
    ),
    critical: parseFloat(
      getEnvVar("LLM_COST_MONTHLY_CRITICAL", { defaultValue: "5000" }) || "5000"
    ),
  },
  perUser: {
    daily: parseFloat(
      getEnvVar("LLM_COST_PER_USER_DAILY", { defaultValue: "10" }) || "10"
    ),
    monthly: parseFloat(
      getEnvVar("LLM_COST_PER_USER_MONTHLY", { defaultValue: "100" }) || "100"
    ),
  },
};

export interface LLMUsageRecord {
  tenant_id?: string;
  user_id: string;
  session_id?: string;
  provider: "together_ai" | "openai" | "anthropic" | "gemini" | "custom";
  model: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost: number;
  endpoint: string;
  success: boolean;
  error_message?: string;
  latency_ms: number;
  created_at: string;
}

export interface CostAlert {
  level: "warning" | "critical";
  period: "hourly" | "daily" | "monthly";
  threshold: number;
  actual: number;
  message: string;
  tenantId?: string;
}

export class LLMCostTracker {
  private supabase?: SupabaseClient;
  private enabled = false;
  private static warnedMissingConfig = false;

  constructor() {
    const { supabaseUrl, supabaseKey } = getLLMCostTrackerConfig();
    const { serviceRoleKey } = getSupabaseConfig();
    const key = serviceRoleKey || supabaseKey;

    if (!supabaseUrl || !key) {
      if (!LLMCostTracker.warnedMissingConfig) {
        logger.warn("LLMCostTracker disabled: missing Supabase configuration");
        LLMCostTracker.warnedMissingConfig = true;
      }
      return;
    }

    this.supabase = createClient(supabaseUrl, key);
    this.enabled = true;
  }

  private isEnabled(): boolean {
    return this.enabled && Boolean(this.supabase);
  }

  /**
   * Calculate cost for a Together.ai API call
   */
  calculateCost(
    model: string,
    promptTokens: number,
    completionTokens: number
  ): number {
    const pricing = resolvePricing(model);

    const inputCost = (promptTokens / TOKENS_PER_MILLION) * pricing.input;
    const outputCost = (completionTokens / TOKENS_PER_MILLION) * pricing.output;

    return inputCost + outputCost;
  }

  /**
   * Track LLM usage and cost
   */
  async trackUsage(params: {
    tenantId?: string;
    userId: string;
    tenant_id?: string;
    sessionId?: string;
    provider: "together_ai" | "openai" | "anthropic" | "gemini" | "custom";
    model: string;
    promptTokens: number;
    completionTokens: number;
    endpoint: string;
    success: boolean;
    errorMessage?: string;
    latencyMs: number;
  }): Promise<void> {
    if (!this.isEnabled() || !this.supabase) return;

    const normalizedTenantId = params.tenantId ?? params.tenant_id;
    if (!normalizedTenantId) {
      logger.warn("LLM usage missing tenant id; usage may be unbillable", {
        userId: params.userId,
        model: params.model,
        provider: params.provider,
        endpoint: params.endpoint,
      });
    }

    const cost = this.calculateCost(
      params.model,
      params.promptTokens,
      params.completionTokens
    );

    const record: LLMUsageRecord = {
      user_id: params.userId,
      tenant_id: normalizedTenantId,
      session_id: params.sessionId,
      provider: params.provider,
      model: params.model,
      input_tokens: params.promptTokens,
      output_tokens: params.completionTokens,
      total_tokens: params.promptTokens + params.completionTokens,
      cost,
      endpoint: params.endpoint,
      success: params.success,
      error_message: params.errorMessage,
      latency_ms: params.latencyMs,
      created_at: new Date().toISOString(),
    };

    // Store in database (fire and forget)
    this.supabase
      .from("llm_usage")
      .insert(record)
      .then(({ error }) => {
        if (error) {
          logger.error("Failed to track LLM usage", error);
        }

        // Fire and forget cost threshold check with error handling
        this.checkCostThresholds(normalizedTenantId).catch((err) => {
          logger.error("Failed to check cost thresholds", {
            err: err instanceof Error ? err.message : String(err),
            userId: params.userId,
            model: params.model,
          });
        });
      })
      .catch((err) => {
        logger.error("Failed to track LLM usage (unexpected)", {
          err: err instanceof Error ? err.message : String(err),
          userId: params.userId,
          model: params.model,
        });
      });
  }

  /**
   * Get cost for a specific time period
   */
  async getCostForPeriod(
    startTime: Date,
    endTime: Date,
    userId?: string,
    tenantId?: string
  ): Promise<number> {
    if (!this.isEnabled() || !this.supabase) return 0;

    let query = this.supabase
      .from("llm_usage")
      .select("cost")
      .gte("created_at", startTime.toISOString())
      .lte("created_at", endTime.toISOString());

    if (userId) {
      query = query.eq("user_id", userId);
    }
    if (tenantId) {
      query = query.eq("tenant_id", tenantId);
    }

    const { data, error } = await query;
    if (error) {
      logger.error("Failed to get cost for period", error);
      return 0;
    }
    return (
      data?.reduce(
        (sum: number, record: { cost: number }) =>
          sum + record.cost,
        0
      ) || 0
    );
  }

  /**
   * Get hourly cost
   */
  async getHourlyCost(tenantId?: string): Promise<number> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - ONE_HOUR_MS);
    return this.getCostForPeriod(oneHourAgo, now, undefined, tenantId);
  }

  /**
   * Get daily cost
   */
  async getDailyCost(userId?: string, tenantId?: string): Promise<number> {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - ONE_DAY_MS);
    return this.getCostForPeriod(oneDayAgo, now, userId, tenantId);
  }

  /**
   * Get monthly cost
   */
  async getMonthlyCost(tenantId?: string): Promise<number> {
    const now = new Date();
    const oneMonthAgo = new Date(now.getTime() - ONE_MONTH_MS);
    return this.getCostForPeriod(oneMonthAgo, now, undefined, tenantId);
  }

  /**
   * Check if cost thresholds are exceeded
   */
  async checkCostThresholds(tenantId?: string): Promise<CostAlert[]> {
    if (!this.isEnabled()) return [];

    const alerts: CostAlert[] = [];

    // Check hourly threshold
    const hourlyCost = await this.getHourlyCost(tenantId);
    if (hourlyCost >= COST_THRESHOLDS.hourly.critical) {
      alerts.push({
        level: "critical",
        period: "hourly",
        threshold: COST_THRESHOLDS.hourly.critical,
        actual: hourlyCost,
        message: `CRITICAL: Hourly LLM cost ($${hourlyCost.toFixed(2)}) exceeded critical threshold ($${COST_THRESHOLDS.hourly.critical})`,
        tenantId,
      });
    } else if (hourlyCost >= COST_THRESHOLDS.hourly.warning) {
      alerts.push({
        level: "warning",
        period: "hourly",
        threshold: COST_THRESHOLDS.hourly.warning,
        actual: hourlyCost,
        message: `WARNING: Hourly LLM cost ($${hourlyCost.toFixed(2)}) exceeded warning threshold ($${COST_THRESHOLDS.hourly.warning})`,
        tenantId,
      });
    }

    // Check daily threshold
    const dailyCost = await this.getDailyCost(undefined, tenantId);
    if (dailyCost >= COST_THRESHOLDS.daily.critical) {
      alerts.push({
        level: "critical",
        period: "daily",
        threshold: COST_THRESHOLDS.daily.critical,
        actual: dailyCost,
        message: `CRITICAL: Daily LLM cost ($${dailyCost.toFixed(2)}) exceeded critical threshold ($${COST_THRESHOLDS.daily.critical})`,
        tenantId,
      });
    } else if (dailyCost >= COST_THRESHOLDS.daily.warning) {
      alerts.push({
        level: "warning",
        period: "daily",
        threshold: COST_THRESHOLDS.daily.warning,
        actual: dailyCost,
        message: `WARNING: Daily LLM cost ($${dailyCost.toFixed(2)}) exceeded warning threshold ($${COST_THRESHOLDS.daily.warning})`,
        tenantId,
      });
    }

    // Check monthly threshold
    const monthlyCost = await this.getMonthlyCost(tenantId);
    if (monthlyCost >= COST_THRESHOLDS.monthly.critical) {
      alerts.push({
        level: "critical",
        period: "monthly",
        threshold: COST_THRESHOLDS.monthly.critical,
        actual: monthlyCost,
        message: `CRITICAL: Monthly LLM cost ($${monthlyCost.toFixed(2)}) exceeded critical threshold ($${COST_THRESHOLDS.monthly.critical})`,
        tenantId,
      });
    } else if (monthlyCost >= COST_THRESHOLDS.monthly.warning) {
      alerts.push({
        level: "warning",
        period: "monthly",
        threshold: COST_THRESHOLDS.monthly.warning,
        actual: monthlyCost,
        message: `WARNING: Monthly LLM cost ($${monthlyCost.toFixed(2)}) exceeded warning threshold ($${COST_THRESHOLDS.monthly.warning})`,
        tenantId,
      });
    }

    // Send alerts
    for (const alert of alerts) {
      await this.sendAlert(alert);
    }

    return alerts;
  }

  /**
   * Send cost alert
   */
  private async sendAlert(alert: CostAlert): Promise<void> {
    if (!this.isEnabled() || !this.supabase) return;

    // Check for duplicate alerts within 1 hour using database
    const alertKey = `${alert.period}-${alert.level}`;
    const oneHourAgo = new Date(Date.now() - ONE_HOUR_MS).toISOString();

    let duplicateQuery = this.supabase
      .from("cost_alerts")
      .select("id")
      .eq("level", alert.level)
      .eq("period", alert.period)
      .gte("created_at", oneHourAgo);

    if (alert.tenantId) {
      duplicateQuery = duplicateQuery.eq("tenant_id", alert.tenantId);
    }

    const { data: existingAlerts, error: checkError } = await duplicateQuery.limit(1);

    if (checkError) {
      logger.error("Failed to check for duplicate alerts", checkError);
      // Continue with sending alert despite check failure
    } else if ((existingAlerts?.length ?? 0) > 0) {
      return;
    }

    logger.warn("LLM COST ALERT", { alert });

    // Store alert in database
    await this.supabase.from("cost_alerts").insert({
      level: alert.level,
      period: alert.period,
      threshold: alert.threshold,
      actual_cost: alert.actual,
      message: alert.message,
      tenant_id: alert.tenantId,
      created_at: new Date().toISOString(),
    });

    // Send to monitoring service (e.g., Slack, PagerDuty)
    const { slackWebhookUrl, alertEmail } = getLLMCostTrackerConfig();
    if (slackWebhookUrl) {
      void this.sendSlackAlert(alert);
    }
    // For critical alerts, also send email
    if (alert.level === "critical" && alertEmail) {
      void this.sendEmailAlert(alert);
    }
  }

  /**
   * Send Slack alert
   */
  private async sendSlackAlert(alert: CostAlert): Promise<void> {
    try {
      const color = alert.level === "critical" ? "danger" : "warning";
      const emoji = alert.level === "critical" ? "🚨" : "⚠️";

      const { slackWebhookUrl } = getLLMCostTrackerConfig();
      if (!slackWebhookUrl) {
        throw new Error("Slack webhook URL is not configured");
      }
      await fetch(slackWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `${emoji} LLM Cost Alert`,
          attachments: [
            {
              color,
              title: alert.message,
              fields: [
                {
                  title: "Period",
                  value: alert.period,
                  short: true,
                },
                {
                  title: "Threshold",
                  value: `$${alert.threshold}`,
                  short: true,
                },
                {
                  title: "Actual Cost",
                  value: `$${alert.actual.toFixed(2)}`,
                  short: true,
                },
                {
                  title: "Overage",
                  value: `$${(alert.actual - alert.threshold).toFixed(2)}`,
                  short: true,
                },
              ],
              footer: "ValueCanvas LLM Cost Tracker",
              ts: Math.floor(Date.now() / MILLIS_PER_SECOND),
            },
          ],
        }),
      });
    } catch (error) {
      logger.error(
        "Failed to send Slack alert",
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Send email alert
   */
  private async sendEmailAlert(alert: CostAlert): Promise<void> {
    // Implement email sending (e.g., using SendGrid, AWS SES)
    logger.info("Email alert would be sent", { alert });
  }

  /**
   * Get cost analytics
   */
  async getCostAnalytics(
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalCost: number;
    costByModel: Record<string, number>;
    costByUser: Record<string, number>;
    costByEndpoint: Record<string, number>;
    totalTokens: number;
    averageCostPerRequest: number;
    requestCount: number;
  }> {
    if (!this.isEnabled() || !this.supabase) {
      return {
        totalCost: 0,
        costByModel: {},
        costByUser: {},
        costByEndpoint: {},
        totalTokens: 0,
        averageCostPerRequest: 0,
        requestCount: 0,
      };
    }

    const { data, error } = await this.supabase
      .from("llm_usage")
      .select("*")
      .gte("created_at", startDate.toISOString())
      .lte("created_at", endDate.toISOString());

    if (error || !data) {
      throw new Error(`Failed to get cost analytics: ${error?.message}`);
    }

    const analytics = {
      totalCost: 0,
      costByModel: {} as Record<string, number>,
      costByUser: {} as Record<string, number>,
      costByEndpoint: {} as Record<string, number>,
      totalTokens: 0,
      averageCostPerRequest: 0,
      requestCount: data.length,
    };

    for (const record of data) {
      analytics.totalCost += record.cost;
      analytics.totalTokens += record.total_tokens;

      // By model
      analytics.costByModel[record.model] =
        (analytics.costByModel[record.model] || 0) + record.cost;

      // By user
      analytics.costByUser[record.user_id] =
        (analytics.costByUser[record.user_id] || 0) + record.cost;

      // By endpoint
      analytics.costByEndpoint[record.endpoint] =
        (analytics.costByEndpoint[record.endpoint] || 0) + record.cost;
    }

    analytics.averageCostPerRequest =
      analytics.requestCount > 0
        ? analytics.totalCost / analytics.requestCount
        : 0;

    return analytics;
  }

  /**
   * Get top cost users
   */
  async getTopCostUsers(limit: number = 10): Promise<
    Array<{
      userId: string;
      totalCost: number;
      requestCount: number;
    }>
  > {
    if (!this.isEnabled() || !this.supabase) {
      return [];
    }

    const { data, error } = await this.supabase
      .from("llm_usage")
      .select("user_id, cost")
      .gte("created_at", new Date(Date.now() - ONE_DAY_MS).toISOString());

    if (error || !data) {
      return [];
    }

    const userCosts = new Map<string, { cost: number; count: number }>();

    for (const record of data) {
      const current = userCosts.get(record.user_id) || { cost: 0, count: 0 };
      userCosts.set(record.user_id, {
        cost: current.cost + record.cost,
        count: current.count + 1,
      });
    }

    return Array.from(userCosts.entries())
      .map(([userId, stats]) => ({
        userId,
        totalCost: stats.cost,
        requestCount: stats.count,
      }))
      .sort((a, b) => b.totalCost - a.totalCost)
      .slice(0, limit);
  }
}

// Export a singleton for convenience and for modules/tests that expect a shared instance
export const llmCostTracker = new LLMCostTracker();
