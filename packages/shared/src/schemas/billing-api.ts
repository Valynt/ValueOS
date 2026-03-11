/**
 * Zod schemas for billing API response contracts.
 *
 * These are the canonical shapes returned by the billing backend. Both the
 * frontend hooks and backend tests import from here so a backend shape change
 * produces a compile error at the hook boundary rather than a silent runtime
 * mismatch.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Primitives shared across schemas
// ---------------------------------------------------------------------------

export const BackendPlanTierSchema = z.enum(["free", "standard", "enterprise"]);
export type BackendPlanTier = z.infer<typeof BackendPlanTierSchema>;

export const BackendSubscriptionStatusSchema = z.enum([
  "active",
  "trialing",
  "past_due",
  "canceled",
  "unpaid",
  "incomplete",
  "incomplete_expired",
]);
export type BackendSubscriptionStatus = z.infer<typeof BackendSubscriptionStatusSchema>;

export const MeterKeySchema = z.enum([
  "llm_tokens",
  "agent_executions",
  "api_calls",
  "storage_gb",
  "user_seats",
]);
export type MeterKey = z.infer<typeof MeterKeySchema>;

// ---------------------------------------------------------------------------
// GET /api/billing/subscription
// ---------------------------------------------------------------------------

export const BackendSubscriptionSchema = z.object({
  id: z.string(),
  stripe_subscription_id: z.string(),
  customer_id: z.string(),
  organization_id: z.string(),
  status: BackendSubscriptionStatusSchema,
  plan_tier: BackendPlanTierSchema,
  current_period_start: z.string(),
  current_period_end: z.string(),
  cancel_at_period_end: z.boolean(),
  canceled_at: z.string().optional(),
  trial_start: z.string().optional(),
  trial_end: z.string().optional(),
});
export type BackendSubscription = z.infer<typeof BackendSubscriptionSchema>;

// ---------------------------------------------------------------------------
// GET /api/billing/summary  (usage portion)
// ---------------------------------------------------------------------------

const MeterRecordSchema = z.record(MeterKeySchema, z.number());

export const BackendUsageSummarySchema = z
  .object({
    tenant_id: z.string(),
    period_start: z.string(),
    period_end: z.string(),
    usage: MeterRecordSchema,
    quotas: MeterRecordSchema,
    percentages: MeterRecordSchema,
    overages: MeterRecordSchema,
  })
  .passthrough();
export type BackendUsageSummary = z.infer<typeof BackendUsageSummarySchema>;

// The summary endpoint wraps the usage object inside a top-level `usage` key.
export const BillingSummaryResponseSchema = z
  .object({
    tenant_id: z.string(),
    subscription: z
      .object({
        id: z.string(),
        status: BackendSubscriptionStatusSchema,
        plan_tier: BackendPlanTierSchema,
        current_period_start: z.string(),
        current_period_end: z.string(),
        cancel_at_period_end: z.boolean(),
      })
      .nullable(),
    usage: BackendUsageSummarySchema.nullable(),
    generated_at: z.string(),
  })
  .passthrough();
export type BillingSummaryResponse = z.infer<typeof BillingSummaryResponseSchema>;

// ---------------------------------------------------------------------------
// GET /api/billing/invoices
// ---------------------------------------------------------------------------

export const BackendInvoiceStatusSchema = z.enum([
  "draft",
  "open",
  "paid",
  "uncollectible",
  "void",
]);
export type BackendInvoiceStatus = z.infer<typeof BackendInvoiceStatusSchema>;

export const BackendInvoiceSchema = z.object({
  id: z.string(),
  stripe_invoice_id: z.string(),
  invoice_number: z.string().optional(),
  status: z.string(), // kept as string — Stripe may return values outside the enum
  amount_due: z.number(),
  amount_paid: z.number(),
  currency: z.string(),
  period_start: z.string(),
  period_end: z.string(),
  invoice_pdf_url: z.string().optional(),
  hosted_invoice_url: z.string().optional(),
  created_at: z.string(),
});
export type BackendInvoice = z.infer<typeof BackendInvoiceSchema>;

export const InvoicesResponseSchema = z.object({
  invoices: z.array(BackendInvoiceSchema),
  limit: z.number(),
  offset: z.number(),
});
export type InvoicesResponse = z.infer<typeof InvoicesResponseSchema>;

// ---------------------------------------------------------------------------
// GET /api/billing/usage/ledger/:dateRange
// ---------------------------------------------------------------------------

export const LedgerEntrySchema = z.object({
  id: z.string(),
  meter_key: z.string(),
  period_start: z.string(),
  period_end: z.string(),
  quantity_used: z.number(),
  quantity_included: z.number(),
  quantity_overage: z.number(),
  unit_price: z.number(),
  amount: z.number(),
  rated_at: z.string(),
});
export type LedgerEntry = z.infer<typeof LedgerEntrySchema>;

export const LedgerResponseSchema = z.object({
  ledgerEntries: z.array(LedgerEntrySchema),
  breakdownByMetric: z.record(z.string(), z.number()),
  dateRange: z.string(),
  timestamp: z.string(),
});
export type LedgerResponse = z.infer<typeof LedgerResponseSchema>;
