import { useState, useEffect } from "react";
import type { Subscription, PlanTier } from "../types";

export function useSubscription() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSubscription();
  }, []);

  const fetchSubscription = async () => {
    setIsLoading(true);
    try {
      // TODO: Implement actual API call
      // const res = await fetch("/api/billing/subscription");
      // const data = await res.json();
      // setSubscription(data);

      // Mock data for now
      setSubscription({
        id: "sub_1",
        userId: "user_1",
        planTier: "pro",
        status: "active",
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        cancelAtPeriodEnd: false,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch subscription");
    } finally {
      setIsLoading(false);
    }
  };

  const changePlan = async (newPlan: PlanTier) => {
    try {
      // TODO: Implement actual API call
      setSubscription((prev) => (prev ? { ...prev, planTier: newPlan } : null));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change plan");
    }
  };

  const cancelSubscription = async () => {
    try {
      // TODO: Implement actual API call
      setSubscription((prev) => (prev ? { ...prev, cancelAtPeriodEnd: true } : null));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel subscription");
    }
  };

  return {
    subscription,
    isLoading,
    error,
    changePlan,
    cancelSubscription,
    refetch: fetchSubscription,
  };
}
