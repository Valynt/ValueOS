# Tasks

## Phase 0: Foundation

### 1. Database Migration

- [ ] 1.1 Create `billing_meters` table: meter_key (PK), display_name, unit, aggregation, dimensions_schema (JSONB), created_at
- [ ] 1.2 Create `billing_price_versions` table: id, version_tag (UNIQUE), plan_tier, definition (JSONB), status (draft|active|archived), activated_at, created_at
- [ ] 1.3 Create `usage_policies` table: id, tenant_id, meter_key (FK), enforcement (hard_lock|grace_then_lock), grace_percent, lock_message_template_key, effective_start, effective_end, created_at
- [ ] 1.4 Create `billing_approval_policies` table: id, tenant_id, action_type, thresholds (JSONB), required_approver_roles (JSONB), sla_hours, created_at
- [ ] 1.5 Create `billing_approval_requests` table: approval_id, tenant_id, requested_by_user_id, action_type, payload (JSONB), computed_delta (JSONB), status (pending|approved|rejected|expired|canceled), approved_by_user_id, decision_reason, effective_at, expires_at, created_at, updated_at
- [ ] 1.6 Create `entitlement_snapshots` table: id, tenant_id, subscription_id (FK), price_version_id (FK), entitlements (JSONB), effective_at, superseded_at, created_at
- [ ] 1.7 ALTER `usage_events`: add idempotency_key, signature; add UNIQUE (tenant_id, idempotency_key)
- [ ] 1.8 ALTER `usage_aggregates`: add period_id, source_event_count, source_hash
- [ ] 1.9 ALTER `subscriptions`: add price_version_id (FK)
- [ ] 1.10 ALTER `invoices`: add price_version_id (FK)
- [ ] 1.11 Add RLS policies on all new tables
- [ ] 1.12 Write rollback SQL

### 2. Billing Meters Catalog

- [ ] 2.1 Implement `BillingMetersCatalog` service
- [ ] 2.2 Seed `billing_meters` with `ai_tokens` (unit: tokens, aggregation: sum) and `api_calls` (unit: calls, aggregation: sum)
- [ ] 2.3 Implement `getMeter(key)` and `listMeters()` accessors
- [ ] 2.4 Update `config/billing.ts` to reference meter catalog

### 3. Price Version Service

- [ ] 3.1 Implement `PriceVersionService` with CRUD
- [ ] 3.2 `getActiveVersion(planTier)` — return current active version
- [ ] 3.3 `getVersionForSubscription(subscriptionId)` — return pinned version
- [ ] 3.4 `activateVersion(versionId)` — transition draft→active, archive previous
- [ ] 3.5 Enforce immutability: active/archived versions cannot be modified
- [ ] 3.6 Seed initial v1 versions from current PLANS config

### 4. Entitlement Snapshots

- [ ] 4.1 Implement `EntitlementSnapshotService`
- [ ] 4.2 `createSnapshot(tenantId, subscriptionId, priceVersionId)` — compute entitlements from price version
- [ ] 4.3 `getCurrentSnapshot(tenantId)` — return snapshot where superseded_at IS NULL
- [ ] 4.4 `supersede(snapshotId)` — set superseded_at = now()
- [ ] 4.5 Call on subscription create, plan change, and version migration

### 5. Subscription State Machine

- [ ] 5.1 Implement `SubscriptionStateMachine`
- [ ] 5.2 Define transitions: incomplete→active|incomplete_expired, active→past_due|canceled|trialing, trialing→active|past_due|canceled, past_due→active|canceled|unpaid, unpaid→canceled
- [ ] 5.3 `transition(currentStatus, event)` — return new status or throw
- [ ] 5.4 Events: payment_succeeded, payment_failed, trial_ended, canceled, reactivated
- [ ] 5.5 Emit `SubscriptionChanged` domain event on every transition

### 6. Domain Event Types

- [ ] 6.1 Create `packages/shared/src/types/billing-events.ts`
- [ ] 6.2 Define: UsageRecorded, SubscriptionChanged, InvoiceDrafted, InvoiceFinalized, PaymentStatusUpdated, BillingApprovalRequested, BillingApprovalDecided

### 7. Stripe Enhancements

- [ ] 7.1 Add `createSetupIntent(tenantId)` to CustomerService
- [ ] 7.2 Add `listPaymentMethods(tenantId)` to CustomerService
- [ ] 7.3 Add `provider_events` audit write to WebhookService
- [ ] 7.4 Emit `PaymentStatusUpdated` domain event from WebhookService

## Phase 1: Self-Serve + Enforcement

### 8. Billing API Routes

- [ ] 8.1 `GET /billing/summary` — BillingSummaryHandler
- [ ] 8.2 `GET /billing/plans` — PlansHandler
- [ ] 8.3 `POST /billing/plan-change/preview` — PlanChangePreviewHandler
- [ ] 8.4 `POST /billing/plan-change/submit` — PlanChangeSubmitHandler
- [ ] 8.5 `POST /billing/seats/preview` — SeatsPreviewHandler
- [ ] 8.6 `POST /billing/seats/submit` — SeatsSubmitHandler
- [ ] 8.7 `GET /billing/invoices` — InvoicesListHandler
- [ ] 8.8 `GET /billing/invoices/:id` — InvoiceDetailHandler
- [ ] 8.9 `GET /billing/usage` — UsageHandler
- [ ] 8.10 `POST /billing/payment-methods` — PaymentMethodHandler
- [ ] 8.11 `POST /billing/cancel/submit` — CancelHandler
- [ ] 8.12 `GET /billing/approvals` — ApprovalsListHandler
- [ ] 8.13 `POST /billing/approvals/:id/decide` — ApprovalDecideHandler
- [ ] 8.14 `POST /billing/stripe/webhook` — StripeWebhookHandler

### 9. Billing Approval Service

- [ ] 9.1 Implement `BillingApprovalService`
- [ ] 9.2 `requiresApproval(tenantId, actionType, computedDelta)` — check billing_approval_policies
- [ ] 9.3 `createRequest(tenantId, userId, actionType, payload, computedDelta)` — create pending request
- [ ] 9.4 `decide(approvalId, userId, decision, reason)` — approve/reject with role validation
- [ ] 9.5 `getExpired()` + cron to expire stale requests
- [ ] 9.6 Emit BillingApprovalRequested / BillingApprovalDecided events

### 10. Entitlements Enforcement

- [ ] 10.1 Implement `EntitlementsService.checkUsageAllowance(tenant_id, meter_key, requested_increment)`
- [ ] 10.2 Read current entitlement snapshot + current period usage aggregate
- [ ] 10.3 Check usage_policies for grace config
- [ ] 10.4 Return: allowed (boolean), reason, meter_key, cap, used, requested, reset_at, upgrade_url
- [ ] 10.5 Implement `usageEnforcement` Express middleware
- [ ] 10.6 Apply to AI token and API call routes
- [ ] 10.7 Return 402 with structured error body when blocked

### 11. Usage Policy Service

- [ ] 11.1 Implement `UsagePolicyService` with CRUD
- [ ] 11.2 `getEffectivePolicy(tenantId, meterKey)` — return active policy or default (hard_lock)

## Phase 2: Invoice Engine

### 12. Invoice Math Engine

- [ ] 12.1 Implement `InvoiceMathEngine`
- [ ] 12.2 `computeLineItems(tenantId, periodId, priceVersionId)` → line items with math_breakdown
- [ ] 12.3 Each line item: meter_key, included_quantity, cap_quantity, used_quantity, billable_quantity, rate, formula_string, inputs, computed_amount, evidence_refs
- [ ] 12.4 Verify determinism: same inputs → same output (hash-verifiable)

### 13. Stripe Invoice Mirroring

- [ ] 13.1 Modify InvoiceService: `createStripeInvoice(tenantId, lineItems)` — create Stripe invoice items + finalize
- [ ] 13.2 `finalizeAndCollect(invoiceId)` — trigger Stripe collection
- [ ] 13.3 Emit InvoiceDrafted / InvoiceFinalized events

### 14. Usage Ingestion Hardening

- [ ] 14.1 Modify UsageAggregator: compute source_hash (hash of event IDs in aggregate)
- [ ] 14.2 Store source_event_count per aggregate
- [ ] 14.3 Link aggregates to period_id

## 15. Tests

- [ ] 15.1 Unit test usage aggregation with 10k events including duplicates → correct totals
- [ ] 15.2 Unit test cap enforcement exact boundary: at cap → allow; cap+1 → block
- [ ] 15.3 Unit test grace policy: within grace → allow; beyond → block
- [ ] 15.4 Unit test invoice reproducibility: same inputs → same hash
- [ ] 15.5 Unit test price version pinning: tenant on v1 stays on v1 after v2 activation
- [ ] 15.6 Unit test approval-gated change: over-threshold → pending; approve → applied; reject → no change
- [ ] 15.7 Unit test webhook idempotency: replay events → no duplicate ledger entries
- [ ] 15.8 Unit test state machine transitions: valid succeed, invalid throw
- [ ] 15.9 Unit test failure recovery: delayed ingestion fallback, idempotent finalization retry
