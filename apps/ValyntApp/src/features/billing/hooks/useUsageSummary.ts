import { useQuery } from "@tanstack/react-query";
import { BillingSummaryResponseSchema } from "@valueos/shared";

import type { UsageMetric } from "../types";

import { apiClient } from "@/api/client/unified-api-client";


// ---------------------------------------------------------------------------
// Extended type — adds metricKey for threshold logic and React list keying
// ---------------------------------------------------------------------------

export type BillingMetricKey =
  | "llm_tokens"
  | "agent_executions"
  | "api_calls"
  | "storage_gb"
  | "user_seats";

export interface UsageMetricWithMeta extends UsageMetric {
  metricKey: BillingMetricKey;
}

export interface UsageSummaryResult {
  metrics: UsageMetricWithMeta[];
  /** True when any metric is at or above 80% of its quota. */
  thresholdBreached: boolean;
  /** True when any metric is at or above 100% of its quota. */
  hardLimitReached: boolean;
  periodStart: string;
  periodEnd: string;
}

// ---------------------------------------------------------------------------
// Shape translation
// ---------------------------------------------------------------------------

const METRIC_LABELS: Record<BillingMetricKey, string> = {
  llm_tokens: "LLM Tokens",
  agent_executions: "Agent Runs",
  api_calls: "API Calls",
  storage_gb: "Storage",
  user_seats: "Seats",
};

export function mapUsageSummary(raw: {
  tenant_id: string;
  period_start: string;
  period_end: string;
  usage: Partial<Record<BillingMetricKey, number>>;
  quotas: Partial<Record<BillingMetricKey, number>>;
  percentages: Partial<Record<BillingMetricKey, number>>;
  overages: Partial<Record<BillingMetricKey, number>>;
}): UsageSummaryResult {
  const metrics = (Object.keys(raw.usage) as BillingMetricKey[]).map((key) => ({
    metric: METRIC_LABELS[key] ?? key,
    metricKey: key,
    used: raw.usage[key] ?? 0,
    limit: raw.quotas[key] ?? 0,
    percentage: raw.percentages[key] ?? 0,
  }));

  return {
    metrics,
    thresholdBreached: metrics.some((m) => m.percentage >= 80),
    hardLimitReached: metrics.some((m) => m.percentage >= 100),
    periodStart: raw.period_start,
    periodEnd: raw.period_end,
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useUsageSummary() {
  return useQuery<UsageSummaryResult | null>({
    queryKey: ["billing", "usage-summary"],
    queryFn: async () => {
      const res = await apiClient.get<unknown>("/api/billing/summary");
      if (!res.success) {
        if (res.error?.code === "404" || res.error?.message?.includes("404")) return null;
        throw new Error(res.error?.message ?? "Failed to fetch usage summary");
      }
      if (!res.data) return null;
      const usage = (res.data as { usage?: unknown }).usage;
      if (!usage) return null;
      const parsedUsage = BillingSummaryResponseSchema.shape.usage.parse(usage);
      return mapUsageSummary(parsedUsage);
    },
    staleTime: 30_000,
    retry: (failureCount, error) => {
      if (error instanceof Error && error.message.includes("404")) return false;
      return failureCount < 2;
    },
  });
}
