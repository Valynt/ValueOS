/**
 * Billing Type Definitions
 * 
 * Types for Stripe integration, subscription management, invoicing,
 * usage metering, and customer billing operations.
 */

// ============================================================================
// Customer Types
// ============================================================================

export interface BillingCustomer {
  id: string;
  stripe_customer_id: string;
  organization_id: string;
  tenant_id?: string;
  email: string;
  name?: string;
  payment_method_id?: string;
  default_payment_method?: string;
  address?: CustomerAddress;
  tax_ids?: TaxId[];
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
  customer_id: string;
  organization_id: string;
  status: SubscriptionStatus;
  plan_tier: 'free' | 'standard' | 'enterprise';
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  canceled_at?: string;
  trial_start?: string;
  trial_end?: string;
  items: SubscriptionItem[];
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
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
  stripe_price_id: string;
  quantity: number;
  metric: string;
  created_at: string;
}

// ============================================================================
// Invoice Types
// ============================================================================

export interface Invoice {
  id: string;
  stripe_invoice_id: string;
  customer_id: string;
  organization_id: string;
  subscription_id?: string;
  status: InvoiceStatus;
  amount_due: number;
  amount_paid: number;
  amount_remaining: number;
  currency: string;
  description?: string;
  hosted_invoice_url?: string;
  invoice_pdf?: string;
  period_start: string;
  period_end: string;
  due_date?: string;
  paid_at?: string;
  line_items: InvoiceLineItem[];
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export type InvoiceStatus =
  | 'draft'
  | 'open'
  | 'paid'
  | 'void'
  | 'uncollectible';

export interface InvoiceLineItem {
  id: string;
  description: string;
  amount: number;
  quantity: number;
  unit_amount: number;
  currency: string;
  period_start: string;
  period_end: string;
  metadata?: Record<string, any>;
}

// ============================================================================
// Usage Types
// ============================================================================

export interface UsageRecord {
  id: string;
  organization_id: string;
  metric: string;
  quantity: number;
  timestamp: string;
  idempotency_key: string;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface UsageAggregate {
  id?: string;
  organization_id: string;
  metric: string;
  period_start: string;
  period_end: string;
  total_quantity: number;
  quota: number;
  overage: number;
  is_capped: boolean;
}

export interface UsageSummary {
  organization_id: string;
  period_start: string;
  period_end: string;
  metrics: Record<string, UsageAggregate>;
  total_overage_cost: number;
  estimated_invoice_amount: number;
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
  id: string;
  stripe_event_id: string;
  event_type: string;
  data: Record<string, any>;
  processed: boolean;
  processed_at?: string;
  retry_count: number;
  error_message?: string;
  created_at: string;
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
  metric: string;
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
