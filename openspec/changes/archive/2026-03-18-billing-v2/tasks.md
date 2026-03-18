# Tasks

## Phase 0: Foundation

### 1. Database Migration

- [x] 1.1 Create `billing_meters` table: meter_key (PK), display_name, unit, aggregation, dimensions_schema (JSONB), created_at
- [x] 1.2 Create `billing_price_versions` table: id, version_tag (UNIQUE), plan_tier, definition (JSONB), status (draft|active|archived), activated_at, created_at
- [x] 1.3 Create `usage_policies` table: id, tenant_id, meter_key (FK), enforcement (hard_lock|grace_then_lock), grace_percent, lock_message_template_key, effective_start, effective_end, created_at
- [x] 1.4 Create `billing_approval_policies` table: id, tenant_id, action_type, thresholds (JSONB), required_approver_roles (JSONB), sla_hours, created_at
- [x] 1.5 Create `billing_approval_requests` table: approval_id, tenant_id, requested_by_user_id, action_type, payload (JSONB), computed_delta (JSONB), status (pending|approved|rejected|expired|canceled), approved_by_user_id, decision_reason, effective_at, expires_at, created_at, updated_at
- [x] 1.6 Create `entitlement_snapshots` table: id, tenant_id, subscription_id (FK), price_version_id (FK), entitlements (JSONB), effective_at, superseded_at, created_at
- [x] 1.7 ALTER `usage_events`: add idempotency_key, signature; add UNIQUE (tenant_id, idempotency_key)
- [x] 1.8 ALTER `usage_aggregates`: add period_id, source_event_count, source_hash
- [x] 1.9 ALTER `subscriptions`: add price_version_id (FK)
- [x] 1.10 ALTER `invoices`: add price_version_id (FK)
- [x] 1.11 Add RLS policies on all new tables
- [x] 1.12 Write rollback SQL

### 2. Billing Meters Catalog

- [x] 2.1 Implement `BillingMetersCatalog` service
- [x] 2.2 Seed `billing_meters` with `ai_tokens` (unit: tokens, aggregation: sum) and `api_calls` (unit: calls, aggregation: sum)
- [x] 2.3 Implement `getMeter(key)` and `listMeters()` accessors
- [x] 2.4 Update `config/billing.ts` to reference meter catalog

### 3. Price Version Service

- [x] 3.1 Implement `PriceVersionService` with CRUD
- [x] 3.2 `getActiveVersion(planTier)` — return current active version
- [x] 3.3 `getVersionForSubscription(subscriptionId)` — return pinned version
- [x] 3.4 `activateVersion(versionId)` — transition draft→active, archive previous
- [x] 3.5 Enforce immutability: active/archived versions cannot be modified
- [x] 3.6 Seed initial v1 versions from current PLANS config

### 4. Entitlement Snapshots

- [x] 4.1 Implement `EntitlementSnapshotService`
- [x] 4.2 `createSnapshot(tenantId, subscriptionId, priceVersionId)` — compute entitlements from price version
- [x] 4.3 `getCurrentSnapshot(tenantId)` — return snapshot where superseded_at IS NULL
- [x] 4.4 `supersede(snapshotId)` — set superseded_at = now()
- [x] 4.5 Call on subscription create, plan change, and version migration

### 5. Subscription State Machine

- [x] 5.1 Implement `SubscriptionStateMachine`
- [x] 5.2 Define transitions: incomplete→active|incomplete_expired, active→past_due|canceled|trialing, trialing→active|past_due|canceled, past_due→active|canceled|unpaid, unpaid→canceled
- [x] 5.3 `transition(currentStatus, event)` — return new status or throw
- [x] 5.4 Events: payment_succeeded, payment_failed, trial_ended, canceled, reactivated
- [x] 5.5 Emit `SubscriptionChanged` domain event on every transition

### 6. Domain Event Types

- [x] 6.1 Create `packages/shared/src/types/billing-events.ts`
- [x] 6.2 Define: UsageRecorded, SubscriptionChanged, InvoiceDrafted, InvoiceFinalized, PaymentStatusUpdated, BillingApprovalRequested, BillingApprovalDecided

### 7. Stripe Enhancements

- [x] 7.1 Add `createSetupIntent(tenantId)` to CustomerService
- [x] 7.2 Add `listPaymentMethods(tenantId)` to CustomerService
- [x] 7.3 Add `provider_events` audit write to WebhookService
- [x] 7.4 Emit `PaymentStatusUpdated` domain event from WebhookService

## Phase 1: Self-Serve + Enforcement

### 8. Billing API Routes

- [x] 8.1 `GET /billing/summary` — BillingSummaryHandler
- [x] 8.2 `GET /billing/plans` — PlansHandler
- [x] 8.3 `POST /billing/plan-change/preview` — PlanChangePreviewHandler
- [x] 8.4 `POST /billing/plan-change/submit` — PlanChangeSubmitHandler
- [x] 8.5 `POST /billing/seats/preview` — SeatsPreviewHandler
- [x] 8.6 `POST /billing/seats/submit` — SeatsSubmitHandler
- [x] 8.7 `GET /billing/invoices` — InvoicesListHandler
- [x] 8.8 `GET /billing/invoices/:id` — InvoiceDetailHandler
- [x] 8.9 `GET /billing/usage` — UsageHandler
- [x] 8.10 `POST /billing/payment-methods` — PaymentMethodHandler
- [x] 8.11 `POST /billing/cancel/submit` — CancelHandler
- [x] 8.12 `GET /billing/approvals` — ApprovalsListHandler
- [x] 8.13 `POST /billing/approvals/:id/decide` — ApprovalDecideHandler
- [x] 8.14 `POST /billing/stripe/webhook` — StripeWebhookHandler

### 9. Billing Approval Service

- [x] 9.1 Implement `BillingApprovalService`
- [x] 9.2 `requiresApproval(tenantId, actionType, computedDelta)` — check billing_approval_policies
- [x] 9.3 `createRequest(tenantId, userId, actionType, payload, computedDelta)` — create pending request
- [x] 9.4 `decide(approvalId, userId, decision, reason)` — approve/reject with role validation
- [x] 9.5 `getExpired()` + cron to expire stale requests
- [x] 9.6 Emit BillingApprovalRequested / BillingApprovalDecided events

### 10. Entitlements Enforcement

- [x] 10.1 Implement `EntitlementsService.checkUsageAllowance(tenant_id, meter_key, requested_increment)`
- [x] 10.2 Read current entitlement snapshot + current period usage aggregate
- [x] 10.3 Check usage_policies for grace config
- [x] 10.4 Return: allowed (boolean), reason, meter_key, cap, used, requested, reset_at, upgrade_url
- [x] 10.5 Implement `usageEnforcement` Express middleware
- [x] 10.6 Apply to AI token and API call routes
- [x] 10.7 Return 402 with structured error body when blocked

### 11. Usage Policy Service

- [x] 11.1 Implement `UsagePolicyService` with CRUD
- [x] 11.2 `getEffectivePolicy(tenantId, meterKey)` — return active policy or default (hard_lock)

## Phase 2: Invoice Engine

### 12. Invoice Math Engine

- [x] 12.1 Implement `InvoiceMathEngine`
- [x] 12.2 `computeLineItems(tenantId, periodId, priceVersionId)` → line items with math_breakdown
- [x] 12.3 Each line item: meter_key, included_quantity, cap_quantity, used_quantity, billable_quantity, rate, formula_string, inputs, computed_amount, evidence_refs
- [x] 12.4 Verify determinism: same inputs → same output (hash-verifiable)

### 13. Stripe Invoice Mirroring

- [x] 13.1 Modify InvoiceService: `createStripeInvoice(tenantId, lineItems)` — create Stripe invoice items + finalize
- [x] 13.2 `finalizeAndCollect(invoiceId)` — trigger Stripe collection
- [x] 13.3 Emit InvoiceDrafted / InvoiceFinalized events

### 14. Usage Ingestion Hardening

- [x] 14.1 Modify UsageAggregator: compute source_hash (hash of event IDs in aggregate)
- [x] 14.2 Store source_event_count per aggregate
- [x] 14.3 Link aggregates to period_id

## 15. Tests

- [x] 15.1 Unit test usage aggregation with 10k events including duplicates → correct totals
- [x] 15.2 Unit test cap enforcement exact boundary: at cap → allow; cap+1 → block
- [x] 15.3 Unit test grace policy: within grace → allow; beyond → block
- [x] 15.4 Unit test invoice reproducibility: same inputs → same hash
- [x] 15.5 Unit test price version pinning: tenant on v1 stays on v1 after v2 activation
- [x] 15.6 Unit test approval-gated change: over-threshold → pending; approve → applied; reject → no change
- [x] 15.7 Unit test webhook idempotency: replay events → no duplicate ledger entries
- [x] 15.8 Unit test state machine transitions: valid succeed, invalid throw
- [x] 15.9 Unit test failure recovery: delayed ingestion fallback, idempotent finalization retry
