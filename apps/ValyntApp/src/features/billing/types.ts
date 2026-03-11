export type PlanTier = "free" | "pro" | "enterprise";

export interface Plan {
  id: PlanTier;
  name: string;
  price: number;
  features: string[];
  limits: PlanLimits;
}

export interface PlanLimits {
  projects: number;
  storage: number; // in GB
  apiCalls: number;
  teamMembers: number;
}

export interface Subscription {
  id: string;
  userId: string;
  planTier: PlanTier;
  status: SubscriptionStatus;
  /**
   * The raw status string returned by the backend. May include values outside
   * the UI-facing SubscriptionStatus union (e.g. "unpaid", "incomplete").
   * Use this when you need to display or act on the exact backend state.
   */
  rawStatus: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
}

/**
 * UI-facing subscription statuses. Maps the full backend set to the states
 * the product surfaces to users. Use rawStatus for the uncoerced value.
 */
export type SubscriptionStatus = "active" | "canceled" | "past_due" | "trialing";

export interface Invoice {
  id: string;
  amount: number;
  status: "paid" | "pending" | "failed";
  date: string;
  pdfUrl?: string;
}

export interface UsageMetric {
  metric: string;
  used: number;
  limit: number;
  percentage: number;
}
