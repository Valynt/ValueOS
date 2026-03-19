/**
 * Billing Data Factories
 * Generate test data for billing entities
 */

import { BillingMetric, PlanTier } from "../../../../config/billing";
import type {
  BillingCustomer,
  Invoice,
  Subscription,
  SubscriptionItem,
  UsageAggregate,
  UsageAlert,
  UsageEvent,
  UsageQuota,
  WebhookEvent,
} from "../../../../types/billing";

let idCounter = 0;
const generateId = () => `test-${Date.now()}-${++idCounter}`;

/**
 * Factory for BillingCustomer
 */
export function createBillingCustomer(
  overrides?: Partial<BillingCustomer>
): BillingCustomer {
  const now = new Date().toISOString();
  const tenantId = generateId();
  const orgId = generateId();

  return {
    id: generateId(),
    tenant_id: tenantId,
    organization_id: orgId,
    stripe_customer_id: `cus_${Math.random().toString(36).substring(7)}`,
    stripe_customer_email: "billing@test.com",
    email: "billing@test.com",
    status: "active",
    default_payment_method: undefined,
    payment_method_type: undefined,
    card_last4: undefined,
    card_brand: undefined,
    metadata: {},
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

/**
 * Factory for Subscription
 */
export function createSubscription(
  overrides?: Partial<Subscription>
): Subscription {
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
    23,
    59,
    59
  );

  return {
    id: generateId(),
    billing_customer_id: generateId(),
    tenant_id: generateId(),
    stripe_subscription_id: `sub_${Math.random().toString(36).substring(7)}`,
    plan_tier: "standard",
    billing_period: "monthly",
    status: "active",
    current_period_start: periodStart.toISOString(),
    current_period_end: periodEnd.toISOString(),
    trial_start: undefined,
    trial_end: undefined,
    canceled_at: undefined,
    amount: 99,
    currency: "usd",
    items: [],
    metadata: {},
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
    version: 1,
    ...overrides,
  };
}

/**
 * Factory for SubscriptionItem
 */
export function createSubscriptionItem(
  metric: BillingMetric = "llm_tokens",
  overrides?: Partial<SubscriptionItem>
): SubscriptionItem {
  const now = new Date().toISOString();

  return {
    id: generateId(),
    subscription_id: generateId(),
    stripe_price_id: `price_${Math.random().toString(36).substring(7)}`,
    metric,
    unit_amount: 1000,
    currency: "usd",
    usage_type: "metered",
    aggregation:
      metric === "storage_gb" || metric === "user_seats" ? "max" : "sum",
    included_quantity: 1000000,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

/**
 * Factory for UsageEvent
 */
export function createUsageEvent(
  metric: BillingMetric = "llm_tokens",
  amount: number = 100,
  overrides?: Partial<UsageEvent>
): UsageEvent {
  const now = new Date().toISOString();

  return {
    id: generateId(),
    tenant_id: generateId(),
    metric,
    amount,
    request_id: `req_${Math.random().toString(36).substring(7)}`,
    metadata: {},
    processed: false,
    processed_at: undefined,
    timestamp: now,
    created_at: now,
    ...overrides,
  };
}

/**
 * Factory for UsageAggregate
 */
export function createUsageAggregate(
  metric: BillingMetric = "llm_tokens",
  overrides?: Partial<UsageAggregate>
): UsageAggregate {
  const now = new Date();
  const periodStart = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago
  const tenantId = generateId();
  const subscriptionItemId = generateId();

  return {
    id: generateId(),
    tenant_id: tenantId,
    subscription_item_id: subscriptionItemId,
    metric,
    total_amount: 1000,
    event_count: 10,
    period_start: periodStart.toISOString(),
    period_end: now.toISOString(),
    submitted_to_stripe: false,
    submitted_at: undefined,
    stripe_usage_record_id: undefined,
    idempotency_key: `agg_${tenantId}_${subscriptionItemId}_${Date.now()}`,
    metadata: {},
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
    ...overrides,
  };
}

/**
 * Factory for Invoice
 */
export function createInvoice(overrides?: Partial<Invoice>): Invoice {
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  return {
    id: generateId(),
    billing_customer_id: generateId(),
    tenant_id: generateId(),
    subscription_id: generateId(),
    stripe_invoice_id: `in_${Math.random().toString(36).substring(7)}`,
    stripe_customer_id: `cus_${Math.random().toString(36).substring(7)}`,
    invoice_number: `INV-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
    invoice_pdf_url: `https://invoice.stripe.com/i/test/pdf`,
    hosted_invoice_url: `https://invoice.stripe.com/i/test`,
    amount_due: 9900,
    amount_paid: 0,
    amount_remaining: 9900,
    subtotal: 9900,
    tax: 0,
    total: 9900,
    currency: "usd",
    status: "draft",
    period_start: periodStart.toISOString(),
    period_end: periodEnd.toISOString(),
    due_date: undefined,
    paid_at: undefined,
    line_items: [],
    metadata: {},
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
    version: 1,
    ...overrides,
  };
}

/**
 * Factory for UsageQuota
 */
export function createUsageQuota(
  metric: BillingMetric = "llm_tokens",
  overrides?: Partial<UsageQuota>
): UsageQuota {
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
    23,
    59,
    59
  );

  return {
    id: generateId(),
    tenant_id: generateId(),
    subscription_id: generateId(),
    metric,
    quota_amount: 1000000,
    hard_cap: false,
    current_usage: 0,
    last_synced_at: undefined,
    period_start: periodStart.toISOString(),
    period_end: periodEnd.toISOString(),
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
    ...overrides,
  };
}

/**
 * Factory for UsageAlert
 */
export function createUsageAlert(
  metric: BillingMetric = "llm_tokens",
  threshold: 80 | 100 | 120 = 80,
  overrides?: Partial<UsageAlert>
): UsageAlert {
  const now = new Date().toISOString();

  return {
    id: generateId(),
    tenant_id: generateId(),
    metric,
    threshold_percentage: threshold,
    current_usage: 800000,
    quota_amount: 1000000,
    alert_type:
      threshold === 80
        ? "warning"
        : threshold === 100
          ? "critical"
          : "exceeded",
    acknowledged: false,
    acknowledged_at: undefined,
    acknowledged_by: undefined,
    notification_sent: false,
    notification_sent_at: undefined,
    created_at: now,
    ...overrides,
  };
}

/**
 * Factory for WebhookEvent
 */
export function createWebhookEvent(
  eventType: string = "invoice.payment_succeeded",
  overrides?: Partial<WebhookEvent>
): WebhookEvent {
  const now = new Date().toISOString();

  return {
    id: generateId(),
    stripe_event_id: `evt_${Math.random().toString(36).substring(7)}`,
    event_type: eventType,
    payload: {
      id: `evt_${Math.random().toString(36).substring(7)}`,
      type: eventType,
      data: { object: {} },
    },
    processed: false,
    processed_at: undefined,
    error_message: undefined,
    retry_count: 0,
    received_at: now,
    created_at: now,
    ...overrides,
  };
}

/**
 * Create a complete billing setup for a tenant
 */
export function createCompleteBillingSetup(
  planTier: PlanTier = "standard",
  tenantId?: string
): {
  customer: BillingCustomer;
  subscription: Subscription;
  subscriptionItems: SubscriptionItem[];
  quotas: UsageQuota[];
} {
  const tid = tenantId || generateId();
  const customer = createBillingCustomer({ tenant_id: tid });
  const subscription = createSubscription({
    tenant_id: tid,
    billing_customer_id: customer.id,
    plan_tier: planTier,
  });

  const metrics: BillingMetric[] = [
    "llm_tokens",
    "agent_executions",
    "api_calls",
    "storage_gb",
    "user_seats",
  ];

  const subscriptionItems = metrics.map((metric) =>
    createSubscriptionItem(metric, {
      subscription_id: subscription.id,
    })
  );

  const quotas = metrics.map((metric) =>
    createUsageQuota(metric, {
      tenant_id: tid,
      subscription_id: subscription.id,
    })
  );

  return {
    customer,
    subscription,
    subscriptionItems,
    quotas,
  };
}

/**
 * Create batch of usage events
 */
export function createBatchUsageEvents(
  count: number,
  metric: BillingMetric = "llm_tokens",
  tenantId?: string
): UsageEvent[] {
  const tid = tenantId || generateId();
  return Array.from({ length: count }, (_, i) =>
    createUsageEvent(metric, Math.floor(Math.random() * 1000), {
      tenant_id: tid,
      request_id: `req_${tid}_${i}`,
    })
  );
}
