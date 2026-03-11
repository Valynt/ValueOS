import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BackendSubscriptionSchema } from "@valueos/shared";

import { apiClient } from "@/api/client/unified-api-client";

import type { PlanTier, Subscription, SubscriptionStatus } from "../types";

// ---------------------------------------------------------------------------
// Shape translation
// ---------------------------------------------------------------------------

// The backend uses 'standard' where the frontend type uses 'pro'.
export function mapPlanTier(backendTier: "free" | "standard" | "enterprise"): PlanTier {
  if (backendTier === "standard") return "pro";
  return backendTier;
}

// Map the full backend status set to the UI-facing SubscriptionStatus union.
// Unknown values fall back to "active" so the UI never shows a blank state,
// but rawStatus preserves the original value for display or logic that needs it.
const UI_STATUS_MAP: Record<string, SubscriptionStatus> = {
  active: "active",
  trialing: "trialing",
  past_due: "past_due",
  canceled: "canceled",
  // Non-UI statuses coerced to the closest meaningful UI state:
  unpaid: "past_due",
  incomplete: "active",
  incomplete_expired: "canceled",
};

export function mapSubscriptionStatus(raw: string): SubscriptionStatus {
  return UI_STATUS_MAP[raw] ?? "active";
}

export function mapSubscription(
  raw: ReturnType<typeof BackendSubscriptionSchema.parse>,
): Subscription {
  return {
    id: raw.id,
    // Backend does not expose userId directly; organization_id is the
    // tenant-level identity used for display purposes.
    userId: raw.organization_id,
    planTier: mapPlanTier(raw.plan_tier),
    status: mapSubscriptionStatus(raw.status),
    rawStatus: raw.status,
    currentPeriodStart: raw.current_period_start,
    currentPeriodEnd: raw.current_period_end,
    cancelAtPeriodEnd: raw.cancel_at_period_end,
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSubscription() {
  const queryClient = useQueryClient();

  const query = useQuery<Subscription | null>({
    queryKey: ["billing", "subscription"],
    queryFn: async () => {
      const res = await apiClient.get<unknown>("/api/billing/subscription");
      if (!res.success) {
        // 404 means no active subscription — not an error state for the UI.
        if (res.error?.code === "404" || res.error?.message?.includes("404")) return null;
        throw new Error(res.error?.message ?? "Failed to fetch subscription");
      }
      if (!res.data) return null;
      const parsed = BackendSubscriptionSchema.parse(res.data);
      return mapSubscription(parsed);
    },
    staleTime: 60_000,
    retry: (failureCount, error) => {
      if (error instanceof Error && error.message.includes("404")) return false;
      return failureCount < 2;
    },
  });

  const changePlanMutation = useMutation<void, Error, PlanTier>({
    mutationFn: async (planTier) => {
      // Map frontend 'pro' back to backend 'standard'.
      const backendTier = planTier === "pro" ? "standard" : planTier;
      const res = await apiClient.post("/api/billing/plan-change/submit", {
        new_plan_tier: backendTier,
      });
      if (!res.success) throw new Error(res.error?.message ?? "Plan change failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing", "subscription"] });
    },
  });

  const cancelMutation = useMutation<void, Error, void>({
    mutationFn: async () => {
      const res = await apiClient.delete("/api/billing/subscription");
      if (!res.success) throw new Error(res.error?.message ?? "Cancellation failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing", "subscription"] });
    },
  });

  return {
    subscription: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
    changePlan: changePlanMutation.mutateAsync,
    cancelSubscription: cancelMutation.mutateAsync,
  };
}
