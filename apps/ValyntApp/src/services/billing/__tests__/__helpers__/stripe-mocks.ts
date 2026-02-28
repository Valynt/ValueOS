/**
 * Stripe API Mocks
 * Provides realistic mock responses for Stripe API calls
 */

import Stripe from "stripe";
import { vi } from "vitest";

/**
 * Mock Stripe Customer
 */
export function createMockStripeCustomer(
  overrides?: Partial<Stripe.Customer>
): Stripe.Customer {
  return {
    id: `cus_${Math.random().toString(36).substring(7)}`,
    object: "customer",
    address: null,
    balance: 0,
    created: Math.floor(Date.now() / 1000),
    currency: "usd",
    default_source: null,
    delinquent: false,
    description: "Test Customer",
    discount: null,
    email: "test@example.com",
    invoice_prefix: "INV",
    invoice_settings: {
      custom_fields: null,
      default_payment_method: null,
      footer: null,
      rendering_options: null,
    },
    livemode: false,
    metadata: {},
    name: "Test Organization",
    phone: null,
    preferred_locales: [],
    shipping: null,
    tax_exempt: "none",
    test_clock: null,
    ...overrides,
  } as Stripe.Customer;
}

/**
 * Mock Stripe Subscription
 */
export function createMockStripeSubscription(
  overrides?: Partial<Stripe.Subscription>
): Stripe.Subscription {
  const now = Math.floor(Date.now() / 1000);
  const monthLater = now + 30 * 24 * 60 * 60;

  return {
    id: `sub_${Math.random().toString(36).substring(7)}`,
    object: "subscription",
    application: null,
    application_fee_percent: null,
    automatic_tax: { enabled: false },
    billing_cycle_anchor: now,
    billing_thresholds: null,
    cancel_at: null,
    cancel_at_period_end: false,
    canceled_at: null,
    cancellation_details: null,
    collection_method: "charge_automatically",
    created: now,
    currency: "usd",
    current_period_end: monthLater,
    current_period_start: now,
    customer: `cus_${Math.random().toString(36).substring(7)}`,
    days_until_due: null,
    default_payment_method: null,
    default_source: null,
    default_tax_rates: [],
    description: null,
    discount: null,
    ended_at: null,
    items: {
      object: "list",
      data: [],
      has_more: false,
      url: "/v1/subscription_items",
    },
    latest_invoice: null,
    livemode: false,
    metadata: {},
    next_pending_invoice_item_invoice: null,
    on_behalf_of: null,
    pause_collection: null,
    payment_settings: null,
    pending_invoice_item_interval: null,
    pending_setup_intent: null,
    pending_update: null,
    schedule: null,
    start_date: now,
    status: "active",
    test_clock: null,
    transfer_data: null,
    trial_end: null,
    trial_settings: null,
    trial_start: null,
    ...overrides,
  } as Stripe.Subscription;
}

/**
 * Mock Stripe Subscription Item
 */
export function createMockStripeSubscriptionItem(
  overrides?: Partial<Stripe.SubscriptionItem>
): Stripe.SubscriptionItem {
  return {
    id: `si_${Math.random().toString(36).substring(7)}`,
    object: "subscription_item",
    billing_thresholds: null,
    created: Math.floor(Date.now() / 1000),
    metadata: {},
    price: createMockStripePrice(),
    quantity: null,
    subscription: `sub_${Math.random().toString(36).substring(7)}`,
    tax_rates: [],
    ...overrides,
  } as Stripe.SubscriptionItem;
}

/**
 * Mock Stripe Price
 */
export function createMockStripePrice(
  overrides?: Partial<Stripe.Price>
): Stripe.Price {
  return {
    id: `price_${Math.random().toString(36).substring(7)}`,
    object: "price",
    active: true,
    billing_scheme: "per_unit",
    created: Math.floor(Date.now() / 1000),
    currency: "usd",
    custom_unit_amount: null,
    livemode: false,
    lookup_key: null,
    metadata: {},
    nickname: null,
    product: `prod_${Math.random().toString(36).substring(7)}`,
    recurring: {
      aggregate_usage: "sum",
      interval: "month",
      interval_count: 1,
      trial_period_days: null,
      usage_type: "metered",
    },
    tax_behavior: "unspecified",
    tiers_mode: null,
    transform_quantity: null,
    type: "recurring",
    unit_amount: 1000,
    unit_amount_decimal: "1000",
    ...overrides,
  } as Stripe.Price;
}

/**
 * Mock Stripe Invoice
 */
export function createMockStripeInvoice(
  overrides?: Partial<Stripe.Invoice>
): Stripe.Invoice {
  const now = Math.floor(Date.now() / 1000);

  return {
    id: `in_${Math.random().toString(36).substring(7)}`,
    object: "invoice",
    account_country: "US",
    account_name: "Test Account",
    account_tax_ids: null,
    amount_due: 5000,
    amount_paid: 0,
    amount_remaining: 5000,
    amount_shipping: 0,
    application: null,
    application_fee_amount: null,
    attempt_count: 0,
    attempted: false,
    auto_advance: true,
    automatic_tax: { enabled: false, status: null },
    billing_reason: "subscription_cycle",
    charge: null,
    collection_method: "charge_automatically",
    created: now,
    currency: "usd",
    custom_fields: null,
    customer: `cus_${Math.random().toString(36).substring(7)}`,
    customer_address: null,
    customer_email: "test@example.com",
    customer_name: "Test Customer",
    customer_phone: null,
    customer_shipping: null,
    customer_tax_exempt: "none",
    customer_tax_ids: [],
    default_payment_method: null,
    default_source: null,
    default_tax_rates: [],
    description: null,
    discount: null,
    discounts: [],
    due_date: null,
    ending_balance: 0,
    footer: null,
    from_invoice: null,
    hosted_invoice_url: `https://invoice.stripe.com/i/test_${Math.random().toString(36).substring(7)}`,
    invoice_pdf: `https://invoice.stripe.com/i/test_${Math.random().toString(36).substring(7)}/pdf`,
    last_finalization_error: null,
    latest_revision: null,
    lines: {
      object: "list",
      data: [],
      has_more: false,
      url: "/v1/invoices/lines",
    },
    livemode: false,
    metadata: {},
    next_payment_attempt: now + 3600,
    number: `INV-${Math.random().toString(36).substring(7).toUpperCase()}`,
    on_behalf_of: null,
    paid: false,
    paid_out_of_band: false,
    payment_intent: null,
    payment_settings: {
      default_mandate: null,
      payment_method_options: null,
      payment_method_types: null,
    },
    period_end: now,
    period_start: now - 30 * 24 * 60 * 60,
    post_payment_credit_notes_amount: 0,
    pre_payment_credit_notes_amount: 0,
    quote: null,
    receipt_number: null,
    rendering: null,
    rendering_options: null,
    shipping_cost: null,
    shipping_details: null,
    starting_balance: 0,
    statement_descriptor: null,
    status: "draft",
    status_transitions: {
      finalized_at: null,
      marked_uncollectible_at: null,
      paid_at: null,
      voided_at: null,
    },
    subscription: null,
    subscription_details: null,
    subtotal: 5000,
    subtotal_excluding_tax: null,
    tax: null,
    test_clock: null,
    total: 5000,
    total_discount_amounts: [],
    total_excluding_tax: null,
    total_tax_amounts: [],
    transfer_data: null,
    webhooks_delivered_at: null,
    ...overrides,
  } as Stripe.Invoice;
}

/**
 * Mock Stripe Webhook Event
 */
export function createMockStripeEvent(
  type: string,
  data: unknown,
  overrides?: Partial<Stripe.Event>
): Stripe.Event {
  return {
    id: `evt_${Math.random().toString(36).substring(7)}`,
    object: "event",
    api_version: "2023-10-16",
    created: Math.floor(Date.now() / 1000),
    data: {
      object: data,
      previous_attributes: undefined,
    },
    livemode: false,
    pending_webhooks: 0,
    request: {
      id: null,
      idempotency_key: null,
    },
    type,
    ...overrides,
  } as Stripe.Event;
}

/**
 * Mock Stripe Usage Record
 */
export function createMockStripeUsageRecord(
  overrides?: Partial<Stripe.UsageRecord>
): Stripe.UsageRecord {
  return {
    id: `mbur_${Math.random().toString(36).substring(7)}`,
    object: "usage_record",
    livemode: false,
    quantity: 100,
    subscription_item: `si_${Math.random().toString(36).substring(7)}`,
    timestamp: Math.floor(Date.now() / 1000),
    ...overrides,
  } as Stripe.UsageRecord;
}

/**
 * Mock Stripe Payment Method
 */
export function createMockStripePaymentMethod(
  overrides?: Partial<Stripe.PaymentMethod>
): Stripe.PaymentMethod {
  return {
    id: `pm_${Math.random().toString(36).substring(7)}`,
    object: "payment_method",
    billing_details: {
      address: null,
      email: "test@example.com",
      name: "Test User",
      phone: null,
    },
    card: {
      brand: "visa",
      checks: null,
      country: "US",
      exp_month: 12,
      exp_year: 2025,
      fingerprint: Math.random().toString(36).substring(7),
      funding: "credit",
      generated_from: null,
      last4: "4242",
      networks: null,
      three_d_secure_usage: null,
      wallet: null,
    },
    created: Math.floor(Date.now() / 1000),
    customer: null,
    livemode: false,
    metadata: {},
    type: "card",
    ...overrides,
  } as Stripe.PaymentMethod;
}

/**
 * Create mock Stripe client with chainable methods
 */
export function createMockStripeClient() {
  const mockClient = {
    customers: {
      create: vi.fn().mockResolvedValue(createMockStripeCustomer()),
      retrieve: vi.fn().mockResolvedValue(createMockStripeCustomer()),
      update: vi.fn().mockResolvedValue(createMockStripeCustomer()),
      del: vi.fn().mockResolvedValue({ id: "cus_test", deleted: true }),
      list: vi.fn().mockResolvedValue({
        object: "list",
        data: [createMockStripeCustomer()],
        has_more: false,
      }),
    },
    subscriptions: {
      create: vi.fn().mockResolvedValue(createMockStripeSubscription()),
      retrieve: vi.fn().mockResolvedValue(createMockStripeSubscription()),
      update: vi.fn().mockResolvedValue(createMockStripeSubscription()),
      cancel: vi
        .fn()
        .mockResolvedValue(
          createMockStripeSubscription({ status: "canceled" })
        ),
      list: vi.fn().mockResolvedValue({
        object: "list",
        data: [createMockStripeSubscription()],
        has_more: false,
      }),
    },
    subscriptionItems: {
      create: vi.fn().mockResolvedValue(createMockStripeSubscriptionItem()),
      retrieve: vi.fn().mockResolvedValue(createMockStripeSubscriptionItem()),
      update: vi.fn().mockResolvedValue(createMockStripeSubscriptionItem()),
      del: vi.fn().mockResolvedValue({ id: "si_test", deleted: true }),
      list: vi.fn().mockResolvedValue({
        object: "list",
        data: [createMockStripeSubscriptionItem()],
        has_more: false,
      }),
      createUsageRecord: vi
        .fn()
        .mockResolvedValue(createMockStripeUsageRecord()),
      listUsageRecordSummaries: vi.fn().mockResolvedValue({
        object: "list",
        data: [createMockStripeUsageRecord()],
        has_more: false,
      }),
    },
    invoices: {
      create: vi.fn().mockResolvedValue(createMockStripeInvoice()),
      retrieve: vi.fn().mockResolvedValue(createMockStripeInvoice()),
      update: vi.fn().mockResolvedValue(createMockStripeInvoice()),
      retrieveUpcoming: vi.fn().mockResolvedValue(createMockStripeInvoice()),
      finalizeInvoice: vi
        .fn()
        .mockResolvedValue(createMockStripeInvoice({ status: "open" })),
      pay: vi
        .fn()
        .mockResolvedValue(
          createMockStripeInvoice({ status: "paid", paid: true })
        ),
      list: vi.fn().mockResolvedValue({
        object: "list",
        data: [createMockStripeInvoice()],
        has_more: false,
      }),
    },
    paymentMethods: {
      retrieve: vi.fn().mockResolvedValue(createMockStripePaymentMethod()),
      attach: vi.fn().mockResolvedValue(createMockStripePaymentMethod()),
      detach: vi.fn().mockResolvedValue(createMockStripePaymentMethod()),
    },
    webhooks: {
      constructEvent: vi.fn((payload, signature, secret) => {
        // Simple mock that returns a parsed event
        const event =
          typeof payload === "string" ? JSON.parse(payload) : payload;
        return createMockStripeEvent(
          event.type || "test.event",
          event.data?.object || {}
        );
      }),
    },
  };

  return mockClient;
}

/**
 * Mock Stripe errors
 */
export function createMockStripeError(
  type: string,
  message: string = "Test error",
  code?: string
): unknown {
  const error: unknown = new Error(message);
  error.type = type;
  error.code = code;
  error.statusCode = type === "StripeAPIError" ? 500 : 400;
  return error;
}

export const StripeErrors = {
  cardDeclined: () =>
    createMockStripeError(
      "StripeCardError",
      "Your card was declined",
      "card_declined"
    ),
  invalidRequest: (msg?: string) =>
    createMockStripeError(
      "StripeInvalidRequestError",
      msg || "Invalid request",
      "parameter_invalid_empty"
    ),
  apiError: () =>
    createMockStripeError("StripeAPIError", "An error occurred with our API"),
  authenticationError: () =>
    createMockStripeError("StripeAuthenticationError", "Invalid API key"),
  rateLimitError: () =>
    createMockStripeError("StripeRateLimitError", "Too many requests"),
  connectionError: () =>
    createMockStripeError("StripeConnectionError", "Network error"),
};
