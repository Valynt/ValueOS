/**
 * Billing TypeScript Types
 */

import { BillingMetric, PlanTier } from '../config/billing';

export interface BillingCustomer {
  id: string;
  tenant_id: string;
  organization_name: string;
  stripe_customer_id: string;
  stripe_customer_email?: string;
  status: 'active' | 'suspended' | 'cancelled';
  default_payment_method?: string;
  payment_method_type?: string;
  card_last4?: string;
  card_brand?: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface Subscription {
  id: string;
  billing_customer_id: string;
  tenant_id: string;
  stripe_subscription_id: string;
  stripe_customer_id: string;
  plan_tier: PlanTier;
  billing_period: 'monthly' | 'yearly';
  status: 'active' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete' | 'trialing';
  current_period_start: string;
  current_period_end: string;
  trial_start?: string;
  trial_end?: string;
  canceled_at?: string;
  ended_at?: string;
  amount: number;
  currency: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionItem {
  id: string;
  subscription_id: string;
  stripe_subscription_item_id: string;
  stripe_price_id: string;
  stripe_product_id: string;
  metric: BillingMetric;
  unit_amount: number;
  currency: string;
  usage_type: 'metered' | 'licensed';
  aggregation: 'sum' | 'max' | 'last_during_period';
  included_quantity?: number;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface UsageEvent {
  id: string;
  tenant_id: string;
  metric: BillingMetric;
  amount: number;
  request_id: string;
  metadata?: Record<string, any>;
  processed: boolean;
  processed_at?: string;
  timestamp: string;
  created_at: string;
}

export interface UsageAggregate {
  id: string;
  tenant_id: string;
  subscription_item_id: string;
  metric: BillingMetric;
  total_amount: number;
  event_count: number;
  period_start: string;
  period_end: string;
  submitted_to_stripe: boolean;
  submitted_at?: string;
  stripe_usage_record_id?: string;
  idempotency_key: string;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface Invoice {
  id: string;
  billing_customer_id: string;
  tenant_id: string;
  subscription_id?: string;
  stripe_invoice_id: string;
  stripe_customer_id: string;
  invoice_number?: string;
  invoice_pdf_url?: string;
  hosted_invoice_url?: string;
  amount_due: number;
  amount_paid: number;
  amount_remaining?: number;
  subtotal?: number;
  tax?: number;
  total?: number;
  currency: string;
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
  period_start?: string;
  period_end?: string;
  due_date?: string;
  paid_at?: string;
  line_items?: any[];
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface UsageQuota {
  id: string;
  tenant_id: string;
  subscription_id: string;
  metric: BillingMetric;
  quota_amount: number;
  hard_cap: boolean;
  current_usage: number;
  last_synced_at?: string;
  period_start: string;
  period_end: string;
  created_at: string;
  updated_at: string;
}

export interface UsageAlert {
  id: string;
  tenant_id: string;
  metric: BillingMetric;
  threshold_percentage: 80 | 100 | 120;
  current_usage: number;
  quota_amount: number;
  alert_type: 'warning' | 'critical' | 'exceeded';
  acknowledged: boolean;
  acknowledged_at?: string;
  acknowledged_by?: string;
  notification_sent: boolean;
  notification_sent_at?: string;
  created_at: string;
}

export interface WebhookEvent {
  id: string;
  stripe_event_id: string;
  event_type: string;
  payload: any;
  processed: boolean;
  processed_at?: string;
  error_message?: string;
  retry_count: number;
  received_at: string;
}

export interface UsageSummary {
  tenant_id: string;
  period_start: string;
  period_end: string;
  usage: Record<BillingMetric, number>;
  quotas: Record<BillingMetric, number>;
  percentages: Record<BillingMetric, number>;
  overages: Record<BillingMetric, number>;
  costs: {
    base: number;
    overage: Record<BillingMetric, number>;
    total: number;
  };
}
