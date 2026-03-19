/**
 * Billing Type Definitions
 *
 * Types for Stripe integration, subscription management, invoicing,
 * usage metering, and customer billing operations.
 */

import type { BillingMetric as ConfigBillingMetric } from '../config/billing.js';

// ============================================================================
// Customer Types
// ============================================================================

export interface BillingCustomer {
  id: string;
  stripe_customer_id: string;
  organization_id: string;
  tenant_id?: string;
  email: string;
  stripe_customer_email?: string;
  name?: string;
  organization_name?: string;
  payment_method_id?: string;
  default_payment_method?: string;
  address?: CustomerAddress;
  tax_ids?: TaxId[];
  status?: string;
  card_last4?: string;
  card_brand?: string;
  payment_method_type?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CustomerAddress {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country: string;
}

export interface TaxId {
  type: string;
  value: string;
}

// ============================================================================
// Subscription Types
// ============================================================================

export interface Subscription {
  id: string;
  stripe_subscription_id: string;
  customer_id?: string;
  billing_customer_id?: string;
  organization_id?: string;
  tenant_id?: string;
  status: SubscriptionStatus;
  plan_tier: 'free' | 'standard' | 'enterprise';
  billing_period?: 'monthly' | 'quarterly' | 'annual';
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end?: boolean;
  canceled_at?: string;
  trial_start?: string;
  trial_end?: string;
  items?: SubscriptionItem[];
  amount?: number;
  currency?: string;
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
  version?: number;
}

export type SubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'incomplete'
  | 'incomplete_expired';

export interface SubscriptionItem {
  id: string;
  subscription_id: string;
  stripe_subscription_item_id?: string;
  stripe_price_id: string;
  stripe_product_id?: string;
  metric: string;
  unit_amount?: number;
  currency?: string;
  usage_type?: 'metered' | 'licensed';
  aggregation?: 'sum' | 'max' | 'last';
  included_quantity?: number;
  quantity?: number;
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

// ============================================================================
// Invoice Types
// ============================================================================

export interface Invoice {
  id: string;
  billing_customer_id?: string;
  tenant_id?: string;
  subscription_id?: string;
  stripe_invoice_id: string;
  stripe_customer_id?: string;
  invoice_number?: string;
  status: InvoiceStatus;
  amount_due: number;
  amount_paid: number;
  amount_remaining: number;
  currency: string;
  description?: string;
  hosted_invoice_url?: string;
  invoice_pdf_url?: string;
  period_start: string;
  period_end: string;
  due_date?: string;
  paid_at?: string;
  line_items: InvoiceLineItem[];
  subtotal?: number;
  tax?: number;
  total?: number;
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
  version?: number;
}

export type InvoiceStatus =
  | 'draft'
  | 'open'
  | 'paid'
  | 'void'
  | 'uncollectible';

export interface InvoiceLineItem {
  id?: string;
  description: string;
  amount: number;
  quantity: number;
  unit_amount: number;
  currency: string;
  period_start: string;
  period_end: string;
  metadata?: Record<string, unknown>;
  subscription_item_id?: string;
}

// ============================================================================
// Usage Types
// ============================================================================

export interface UsageRecord {
  id: string;
  tenant_id?: string;
  organization_id?: string;
  metric: ConfigBillingMetric;
  quantity: number;
  timestamp: string;
  request_id?: string;
  idempotency_key?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface UsageEvent {
  id: string;
  tenant_id?: string;
  metric: ConfigBillingMetric;
  amount?: number;
  request_id: string;
  metadata?: Record<string, unknown>;
  processed?: boolean;
  processed_at?: string;
  timestamp?: string;
  created_at?: string;
}

export interface UsageAggregate {
  id?: string;
  tenant_id?: string;
  subscription_item_id?: string;
  metric?: ConfigBillingMetric;
  total_amount?: number;
  event_count?: number;
  period_start?: string;
  period_end?: string;
  submitted_to_stripe?: boolean;
  submitted_at?: string;
  stripe_usage_record_id?: string;
  idempotency_key?: string;
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface UsageQuota {
  id?: string;
  tenant_id?: string;
  subscription_id?: string;
  metric?: ConfigBillingMetric;
  quota_amount?: number;
  hard_cap?: boolean;
  current_usage?: number;
  last_synced_at?: string;
  period_start?: string;
  period_end?: string;
  created_at?: string;
  updated_at?: string;
}

export interface UsageAlert {
  id?: string;
  tenant_id?: string;
  metric?: ConfigBillingMetric;
  threshold_percentage?: number;
  current_usage?: number;
  quota_amount?: number;
  alert_type?: 'warning' | 'critical' | 'exceeded';
  acknowledged?: boolean;
  acknowledged_at?: string;
  acknowledged_by?: string;
  notification_sent?: boolean;
  notification_sent_at?: string;
  created_at?: string;
}

export interface UsageSummary {
  organization_id: string;
  /** Alias for organization_id — accepted for backward compatibility. */
  tenant_id?: string;
  period_start: string;
  period_end: string;
  metrics: Record<string, UsageAggregate>;
  total_overage_cost: number;
  estimated_invoice_amount: number;
  usage?: Record<string, number>;
  quotas?: Record<string, number>;
  percentages?: Record<string, number>;
  overages?: Record<string, number>;
  costs?: Record<string, number>;
}

// ============================================================================
// Payment Types
// ============================================================================

export interface PaymentMethod {
  id: string;
  stripe_payment_method_id: string;
  customer_id: string;
  type: 'card' | 'bank_account' | 'sepa_debit';
  card?: CardDetails;
  billing_details?: BillingDetails;
  is_default: boolean;
  created_at: string;
}

export interface CardDetails {
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
  country?: string;
}

export interface BillingDetails {
  name?: string;
  email?: string;
  phone?: string;
  address?: CustomerAddress;
}

// ============================================================================
// Webhook Types
// ============================================================================

export interface WebhookEvent {
  id?: string;
  stripe_event_id?: string;
  event_type?: string;
  payload?: Record<string, unknown>;
  data?: Record<string, unknown>;
  processed?: boolean;
  processed_at?: string;
  retry_count?: number;
  error_message?: string;
  received_at?: string;
  created_at?: string;
}

// ============================================================================
// Metering Types
// ============================================================================

export interface MeteringSnapshot {
  id: string;
  organization_id: string;
  period_start: string;
  period_end: string;
  metrics: Record<string, number>;
  snapshot_at: string;
  created_at: string;
}

export interface QuotaStatus {
  metric: ConfigBillingMetric;
  current_usage: number;
  quota: number;
  percentage_used: number;
  is_exceeded: boolean;
  hard_cap: boolean;
}

// ============================================================================
// Billing Configuration Types
// ============================================================================

export interface PlanQuotas {
  llm_tokens: number;
  agent_executions: number;
  api_calls: number;
  storage_gb: number;
  user_seats: number;
}

export interface OverageRates {
  llm_tokens: number;
  agent_executions: number;
  api_calls: number;
  storage_gb: number;
  user_seats: number;
}

// Re-export BillingMetric from config for convenience
export type BillingMetric = ConfigBillingMetric;

export interface TenantBillingSpendPolicy {
  organization_id: string;
  daily_limit: number;
  daily_spend: number;
  monthly_hard_cap: number;
  monthly_soft_cap: number;
}

export interface TenantExecutionState {
  organization_id: string;
  is_paused: boolean;
  reason: string | null;
  paused_at: string | null;
  paused_by: string | null;
  updated_at?: string;
}
