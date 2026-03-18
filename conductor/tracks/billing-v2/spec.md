> **Superseded by [Billing spec](../../../openspec/specs/billing/spec.md)**. Retained for implementation detail reference.

# Billing V2: ValueOS-Native Billing Implementation Plan

**Date:** 2026-02-13
**Status:** Phase 0 ready for implementation

## Architecture Decision

- **ValueOS** owns: pricing versions, subscription state, entitlements, usage evidence, invoice math, approvals
- **Stripe** owns: payment methods, payment attempts, charge outcomes, invoice collection, tax
- **Meters**: `ai_tokens`, `api_calls` (primary); existing `llm_tokens`, `agent_executions`, `storage_gb`, `user_seats` retained
- **Enforcement**: hard locks on overages; enterprise-configurable grace via `usage_policies`
- **Enterprise self-serve**: approval-gated workflows for spend-changing actions

## Current State → Target State

### What exists and is kept
| Component | Location | Notes |
|---|---|---|
| `billing_customers` table + `CustomerService` | `services/billing/CustomerService.ts` | Stripe customer mapping |
| `subscriptions` table + `SubscriptionService` | `services/billing/SubscriptionService.ts` | Plan lifecycle |
| `subscription_items` table | DB schema | Per-metric line items |
| `usage_events` table + aggregation pipeline | `services/metering/` | Raw events → aggregates |
| `usage_quotas` table | DB schema | Per-tenant quotas |
| `webhook_events` + `WebhookService` | `services/billing/WebhookService.ts` | Idempotent Stripe webhooks |
| `InvoiceService` | `services/billing/InvoiceService.ts` | Stripe invoice storage |
| `GracePeriodService` | `services/metering/GracePeriodService.ts` | Grace period management |
| `ApprovalWorkflowService` | `services/ApprovalWorkflowService.ts` | Generic approvals |
| Billing config (plans, metrics, quotas) | `config/billing.ts` | Plan definitions |

### What's new (by phase)

## Phase 0: Foundation

### 0.1 Database Migration
**File:** `infra/supabase/supabase/migrations/20260213000001_billing_v2_foundation.sql`

New tables:

```sql
-- Catalog: meter definitions
billing_meters (
  meter_key text PK,          -- 'ai_tokens', 'api_calls'
  display_name text NOT NULL,
  unit text NOT NULL,          -- 'tokens', 'calls'
  aggregation text NOT NULL,   -- 'sum'
  dimensions_schema jsonb,     -- allowed dims
  created_at timestamptz DEFAULT now()
)

-- Versioned pricing (immutable once active)
billing_price_versions (
  id uuid PK DEFAULT gen_random_uuid(),
  version_tag text NOT NULL UNIQUE,  -- 'v1.0', 'v2.0'
  plan_tier text NOT NULL,
  definition jsonb NOT NULL,  -- full plan config including meters[].included_quantity, hard_cap_quantity, overage_rate, enforcement
  status text NOT NULL DEFAULT 'draft',  -- draft|active|archived
  activated_at timestamptz,
  created_at timestamptz DEFAULT now(),
  CHECK (status IN ('draft','active','archived'))
)

-- Per-tenant enforcement overrides
usage_policies (
  id uuid PK DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  meter_key text NOT NULL REFERENCES billing_meters(meter_key),
  enforcement text NOT NULL DEFAULT 'hard_lock',  -- hard_lock|grace_then_lock
  grace_percent numeric(5,4),  -- e.g. 0.0500 for 5%
  lock_message_template_key text,
  effective_start timestamptz NOT NULL DEFAULT now(),
  effective_end timestamptz,
  created_at timestamptz DEFAULT now(),
  CHECK (enforcement IN ('hard_lock','grace_then_lock'))
)

-- Billing-specific approval policies
billing_approval_policies (
  id uuid PK DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  action_type text NOT NULL,  -- plan_change|seat_change|enable_overage|increase_cap|billing_cycle_change|cancel
  thresholds jsonb,           -- {"delta_mrr_usd": 500}
  required_approver_roles jsonb,  -- ["Owner","BillingAdmin"]
  sla_hours integer,
  created_at timestamptz DEFAULT now(),
  CHECK (action_type IN ('plan_change','seat_change','enable_overage','increase_cap','billing_cycle_change','cancel'))
)

-- Billing-specific approval requests
billing_approval_requests (
  approval_id uuid PK DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  requested_by_user_id uuid NOT NULL,
  action_type text NOT NULL,
  payload jsonb NOT NULL,
  computed_delta jsonb,       -- {delta_mrr_usd, delta_arr_usd, proration_delta}
  status text NOT NULL DEFAULT 'pending',
  approved_by_user_id uuid,
  decision_reason text,
  effective_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CHECK (status IN ('pending','approved','rejected','expired','canceled'))
)

-- Entitlement snapshots (point-in-time record of what tenant is entitled to)
entitlement_snapshots (
  id uuid PK DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  subscription_id uuid NOT NULL REFERENCES subscriptions(id),
  price_version_id uuid NOT NULL REFERENCES billing_price_versions(id),
  entitlements jsonb NOT NULL,  -- {ai_tokens: {included: 1000000, cap: 1200000, enforcement: 'hard_lock'}, ...}
  effective_at timestamptz NOT NULL,
  superseded_at timestamptz,    -- NULL = current
  created_at timestamptz DEFAULT now()
)
```

Schema changes to existing tables:

```sql
-- usage_events: add idempotency + tamper evidence
ALTER TABLE usage_events ADD COLUMN idempotency_key text;
ALTER TABLE usage_events ADD COLUMN signature text;  -- optional HMAC
ALTER TABLE usage_events ADD UNIQUE (tenant_id, idempotency_key);

-- usage_aggregates: add evidence chain
ALTER TABLE usage_aggregates ADD COLUMN period_id uuid;
ALTER TABLE usage_aggregates ADD COLUMN source_event_count integer;
ALTER TABLE usage_aggregates ADD COLUMN source_hash text;

-- subscriptions: pin to price version
ALTER TABLE subscriptions ADD COLUMN price_version_id uuid REFERENCES billing_price_versions(id);

-- invoices: add pricing version reference
ALTER TABLE invoices ADD COLUMN price_version_id uuid REFERENCES billing_price_versions(id);
```

### 0.2 Billing Meters Catalog
**File:** `packages/backend/src/services/billing/BillingMetersCatalog.ts`

- Seed `billing_meters` with `ai_tokens` and `api_calls`
- Provide `getMeter(key)`, `listMeters()` accessors
- Update `config/billing.ts` to reference meter catalog

### 0.3 Price Version Service
**File:** `packages/backend/src/services/billing/PriceVersionService.ts`

- CRUD for `billing_price_versions`
- `getActiveVersion(planTier)` — returns current active version
- `getVersionForSubscription(subscriptionId)` — returns pinned version
- `activateVersion(versionId)` — transitions draft→active, archives previous
- Immutability: active/archived versions cannot be modified
- Seed initial v1 versions from current `PLANS` config

### 0.4 Entitlement Snapshots
**File:** `packages/backend/src/services/billing/EntitlementSnapshotService.ts`

- `createSnapshot(tenantId, subscriptionId, priceVersionId)` — computes entitlements from price version definition
- `getCurrentSnapshot(tenantId)` — returns snapshot where `superseded_at IS NULL`
- `supersede(snapshotId)` — sets `superseded_at = now()`
- Called on subscription create, plan change, and version migration

### 0.5 Subscription State Machine
**File:** `packages/backend/src/services/billing/SubscriptionStateMachine.ts`

Valid transitions:
```
incomplete → active | incomplete_expired
active → past_due | canceled | trialing
trialing → active | past_due | canceled
past_due → active | canceled | unpaid
unpaid → canceled
canceled → (terminal)
incomplete_expired → (terminal)
```

- `transition(currentStatus, event)` — returns new status or throws
- Events: `payment_succeeded`, `payment_failed`, `trial_ended`, `canceled`, `reactivated`
- Emits `SubscriptionChanged` domain event on every transition

### 0.6 Domain Event Types
**File:** `packages/shared/src/types/billing-events.ts`

```typescript
UsageRecorded { tenant_id, occurred_at, meter_key, quantity, idempotency_key, dimensions, source_ref }
SubscriptionChanged { tenant_id, before, after, effective_at, actor_user_id, reason }
InvoiceDrafted { tenant_id, invoice_id, period_start, period_end, pricing_version_id, totals, line_item_refs }
InvoiceFinalized { ... same as drafted }
PaymentStatusUpdated { tenant_id, external_invoice_id, external_payment_intent_id, status, occurred_at, idempotency_key }
BillingApprovalRequested { tenant_id, approval_id, action_type, requested_by, payload }
BillingApprovalDecided { tenant_id, approval_id, status, decided_by, reason }
```

### 0.7 Stripe Customer + Payment Method Setup
**Modify:** `packages/backend/src/services/billing/CustomerService.ts`

- Add `createSetupIntent(tenantId)` — returns Stripe SetupIntent client_secret
- Add `listPaymentMethods(tenantId)` — returns stored payment methods
- Existing `updatePaymentMethod` already works

### 0.8 Webhook Ingestion Hardening
**Modify:** `packages/backend/src/services/billing/WebhookService.ts`

- Add `provider_events` table write (optional, for audit)
- Emit `PaymentStatusUpdated` domain event
- Ensure idempotency by Stripe event ID (already done via upsert)

## Phase 1: Self-Serve + Enforcement

### 1.1 Billing API Routes
**File:** `packages/backend/src/routes/billing.ts`

```
GET  /billing/summary          → BillingSummaryHandler
GET  /billing/plans            → PlansHandler
POST /billing/plan-change/preview → PlanChangePreviewHandler
POST /billing/plan-change/submit  → PlanChangeSubmitHandler
POST /billing/seats/preview    → SeatsPreviewHandler
POST /billing/seats/submit     → SeatsSubmitHandler
GET  /billing/invoices         → InvoicesListHandler
GET  /billing/invoices/:id     → InvoiceDetailHandler
GET  /billing/usage            → UsageHandler
POST /billing/payment-methods  → PaymentMethodHandler
POST /billing/cancel/submit    → CancelHandler
GET  /billing/approvals        → ApprovalsListHandler
GET  /billing/approvals/:id    → ApprovalDetailHandler
POST /billing/approvals/:id/decide → ApprovalDecideHandler
POST /billing/stripe/webhook   → StripeWebhookHandler
```

### 1.2 Billing Approval Service
**File:** `packages/backend/src/services/billing/BillingApprovalService.ts`

- `requiresApproval(tenantId, actionType, computedDelta)` — checks `billing_approval_policies`
- `createRequest(tenantId, userId, actionType, payload, computedDelta)` → `billing_approval_requests`
- `decide(approvalId, userId, decision, reason)` — approve/reject with role validation
- `getExpired()` + cron to expire stale requests
- Emits `BillingApprovalRequested` / `BillingApprovalDecided`

### 1.3 EntitlementsService (Hard Lock Enforcement)
**File:** `packages/backend/src/services/billing/EntitlementsService.ts`

```typescript
checkUsageAllowance(tenant_id, meter_key, requested_increment): {
  allowed: boolean,
  reason?: string,
  meter_key, cap, used, requested, reset_at, upgrade_url, approval_required
}
```

- Reads current entitlement snapshot
- Reads current period usage aggregate
- Checks `usage_policies` for grace config
- Returns 402-shaped error payload if blocked

### 1.4 Enforcement Middleware
**File:** `packages/backend/src/middleware/usageEnforcement.ts`

- Express middleware that calls `EntitlementsService.checkUsageAllowance()`
- Applied to AI token and API call routes
- Returns `402 Payment Required` with structured error body

### 1.5 Usage Policy Service
**File:** `packages/backend/src/services/billing/UsagePolicyService.ts`

- CRUD for `usage_policies`
- `getEffectivePolicy(tenantId, meterKey)` — returns active policy or default (hard_lock)

## Phase 2: Invoice Engine + Collection

### 2.1 Invoice Math Engine
**File:** `packages/backend/src/services/billing/InvoiceMathEngine.ts`

- `computeLineItems(tenantId, periodId, priceVersionId)` → line items with `math_breakdown`
- Each line item includes: meter_key, included_quantity, cap_quantity, used_quantity, billable_quantity, rate, formula_string, inputs, computed_amount, evidence_refs
- Deterministic: same inputs always produce same output (hash-verifiable)

### 2.2 Stripe Invoice Mirroring
**Modify:** `packages/backend/src/services/billing/InvoiceService.ts`

- `createStripeInvoice(tenantId, lineItems)` — creates Stripe invoice items + finalizes
- `finalizeAndCollect(invoiceId)` — triggers Stripe collection
- Emits `InvoiceDrafted` / `InvoiceFinalized`

### 2.3 Usage Ingestion Hardening
**Modify:** `packages/backend/src/services/metering/UsageAggregator.ts`

- Compute `source_hash` (hash of event IDs in aggregate)
- Store `source_event_count`
- Link to `period_id`

## Phase 3: Enterprise + Reconciliation

### 3.1 Custom Pricing per Tenant
- `billing_overrides` table for temporary cap increases
- Contract mode with custom `billing_price_versions` per tenant

### 3.2 Temporary Cap Increase Workflows
- Approval-gated temporary cap increases with `effective_end`

### 3.3 Finance Exports
- Reconciliation dashboard data endpoints

---

## Test Plan (Phase 0-1)

### Golden Tests

| Test | Location | What it validates |
|---|---|---|
| Usage aggregation with idempotency | `services/billing/__tests__/usage-aggregation.test.ts` | 10k events with duplicates → correct totals |
| Cap enforcement exact boundary | `services/billing/__tests__/entitlements.test.ts` | at cap: allow; cap+1: block |
| Grace policy enforcement | `services/billing/__tests__/entitlements.test.ts` | within grace: allow; beyond: block |
| Invoice reproducibility | `services/billing/__tests__/invoice-math.test.ts` | same inputs → same hash |
| Price version pinning | `services/billing/__tests__/price-versions.test.ts` | tenant on v1 stays on v1 after v2 activation |
| Approval-gated change | `services/billing/__tests__/approvals.test.ts` | over-threshold → pending; approve → applied; reject → no change |
| Webhook idempotency | `services/billing/__tests__/WebhookService.test.ts` | replay events → no duplicate ledger entries |
| State machine transitions | `services/billing/__tests__/subscription-state-machine.test.ts` | valid transitions succeed; invalid throw |
| Failure recovery | `services/billing/__tests__/failure-modes.test.ts` | delayed ingestion fallback; idempotent finalization retry |
