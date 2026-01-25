import { useState, useEffect } from "react";
import type { Subscription, PlanTier } from "../types";
import { api } from "../../../api/client/unified-api-client";

export function useSubscription() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSubscription();
  }, []);

  const fetchSubscription = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.getSubscription();
      if (response.success && response.data) {
        setSubscription(response.data);
      } else {
        throw new Error(response.error?.message || "Failed to fetch subscription");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch subscription");
    } finally {
      setIsLoading(false);
    }
  };

  const changePlan = async (newPlan: PlanTier) => {
    setError(null);
    try {
      const response = await api.changePlan(newPlan);
      if (response.success && response.data) {
        setSubscription(response.data);
      } else {
        throw new Error(response.error?.message || "Failed to change plan");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change plan");
    }
  };

  const cancelSubscription = async () => {
    setError(null);
    try {
      const response = await api.cancelSubscription();
      if (response.success && response.data) {
        setSubscription(response.data);
      } else {
        throw new Error(response.error?.message || "Failed to cancel subscription");
      }
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
