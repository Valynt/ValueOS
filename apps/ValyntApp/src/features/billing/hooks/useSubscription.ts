import { useEffect, useState } from "react";
import type { PlanTier, Subscription } from "../types";
import { billingService } from "@/services/billing/billingService";

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
      const data = await billingService.getSubscription();
      setSubscription(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch subscription");
    } finally {
      setIsLoading(false);
    }
  };

  const changePlan = async (newPlan: PlanTier) => {
    try {
      setError(null);
      await billingService.changePlan(newPlan);
      // Refresh subscription data
      await fetchSubscription();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change plan");
      throw err;
    }
  };

  const cancelSubscription = async () => {
    try {
      setError(null);
      await billingService.cancelSubscription();
      // Refresh subscription data
      await fetchSubscription();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel subscription");
      throw err;
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
