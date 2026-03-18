# Design: Billing V2

## Technical Approach

Layer billing services on existing Stripe integration (CustomerService, SubscriptionService, WebhookService). Add metering catalog, versioned pricing, entitlement snapshots, and enforcement middleware.

## Architecture Decisions

### Decision: ValueOS owns pricing math, Stripe owns payment

All pricing calculations, entitlement checks, and invoice line items are computed in ValueOS. Stripe handles payment method storage, charge attempts, and tax calculation. This ensures deterministic, auditable billing logic.

### Decision: Immutable price versions

Price versions cannot be modified once active. Tenants are pinned to their version until explicitly migrated. This prevents retroactive pricing changes.

### Decision: Hard-lock enforcement by default

Usage exceeding the cap is blocked immediately (HTTP 402). Enterprise tenants can opt into grace_then_lock via `usage_policies`.

### Decision: Deterministic invoice math

Same inputs always produce same output, hash-verifiable. Each line item includes formula_string and inputs for audit.

## Data Flow

```
Agent/API Call ──► Usage Event (idempotent) ──► Usage Aggregates
                                                      │
                                                      ▼
                                              EntitlementsService
                                              ┌───────┴───────┐
                                         allowed           blocked (402)
                                              │
                                              ▼
                                        InvoiceMathEngine
                                              │
                                              ▼
                                      Stripe Invoice Mirror
```

## File Changes

### New
- `infra/supabase/supabase/migrations/YYYYMMDD_billing_v2_foundation.sql`
- `packages/backend/src/services/billing/BillingMetersCatalog.ts`
- `packages/backend/src/services/billing/PriceVersionService.ts`
- `packages/backend/src/services/billing/EntitlementSnapshotService.ts`
- `packages/backend/src/services/billing/SubscriptionStateMachine.ts`
- `packages/backend/src/services/billing/EntitlementsService.ts`
- `packages/backend/src/services/billing/UsagePolicyService.ts`
- `packages/backend/src/services/billing/BillingApprovalService.ts`
- `packages/backend/src/services/billing/InvoiceMathEngine.ts`
- `packages/backend/src/middleware/usageEnforcement.ts`
- `packages/backend/src/routes/billing.ts`
- `packages/shared/src/types/billing-events.ts`

### Modified
- `packages/backend/src/services/billing/CustomerService.ts` — Add setupIntent, listPaymentMethods
- `packages/backend/src/services/billing/WebhookService.ts` — Add audit write, emit PaymentStatusUpdated
- `packages/backend/src/services/billing/InvoiceService.ts` — Add Stripe invoice mirroring
- `packages/backend/src/services/metering/UsageAggregator.ts` — Add source_hash, source_event_count
- `config/billing.ts` — Reference meter catalog
