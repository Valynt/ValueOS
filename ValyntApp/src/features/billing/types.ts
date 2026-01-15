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
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
}

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
