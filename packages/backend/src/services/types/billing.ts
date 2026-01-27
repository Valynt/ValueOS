// packages/backend/src/services/types/billing.ts
export interface BillingPlan {
  id: string;
  name: string;
  price: number;
  currency: string;
  features: string[];
}

export interface Subscription {
  id: string;
  userId: string;
  planId: string;
  status: 'active' | 'canceled' | 'past_due';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
}