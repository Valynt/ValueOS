---
owner: team-platform
generated_at: 2026-04-05
source_commit: fe8b2fb54a61
status: active
---

# Sprint Plan — Sprints 15–19: E2E Billing and Usage Management

**Author:** Lead Developer  
**Date:** 2026-06-10  
**Baseline:** Post-Sprint 14 (beta-hardened value loop; six lifecycle stages real and persistent; PDF export; performance indexes applied)

---

## Strategic Framing

### Product Principle: Billing as a First-Class Product Surface

ValueOS has a substantially complete billing backend. The `rated_ledger`, `billing_price_versions`, `entitlement_snapshots`, `billing_approval_requests`, `usage_events`, and `usage_aggregates` tables exist and are RLS-protected. `InvoiceMathEngine`, `RatingEngine`, `EntitlementsService`, `SubscriptionStateMachine`, `BillingApprovalService`, and `PriceVersionService` are all real implementations. The billing API router is mounted at `/api/billing` with RBAC enforcement.

What does not exist: the frontend billing surface is entirely mock data. `useSubscription` is exported from `features/billing/index.ts` but the `hooks/` directory does not exist — the import is broken. `UsageTab`, `PlansTab`, and `InvoicesTab` in `BillingPage.tsx` render hardcoded arrays. The usage ledger API endpoint (`GET /billing/usage/ledger/:dateRange`) returns an empty stub. Metering is not instrumented on the agent invocation path.

The gap is not architectural — it is the same frontend-to-backend wiring gap that existed for the value loop before Sprint 4. The fix follows the same pattern: DB is real → backend is real → wire the frontend → add enforcement → harden.

### Current State

**Complete (backend):** Subscription lifecycle, plan versioning, entitlement snapshots, approval workflows, invoice math engine, Stripe webhook ingestion, usage event ingestion, usage aggregation, rated ledger, enforcement middleware, all billing API routes mounted and RBAC-protected.

**Incomplete:** `useSubscription` hook missing (broken import), `UsageTab` hardcoded, `InvoicesTab` hardcoded, usage ledger endpoint stub, metering not instrumented on agent/LLM paths, no usage threshold alerts in UI, no reconciliation dashboard, no dunning/collections UI, enterprise contract overrides (Phase 3 of billing-v2) not started.

---

## Baseline

- **Current sprint:** 15 (first billing sprint)
- **Complete:** All billing backend services (Phases 0–2 of `conductor/tracks/billing-v2/spec.md`)
- **Broken (P0):** `features/billing/hooks/useSubscription` — exported but directory does not exist; `BillingPage` will not compile in strict mode
- **Incomplete (P1):** Usage ledger endpoint stub (`GET /billing/usage/ledger/:dateRange`); `UsageTab` hardcoded; `InvoicesTab` hardcoded; metering not on agent invocation path
- **Deferred (P2):** Enterprise contract overrides (Phase 3); PPTX export; Kafka rollout

---

## Sprint 15 — Wire the Billing Frontend (Weeks 1–2)

**Objective:** The billing page reads from real APIs. No mock data remains in `BillingPage.tsx`.

**Success statement:** A user can open the Billing page and see their real subscription tier, real usage metrics from `usage_aggregates`, and real invoices from `InvoiceService`. Refreshing shows the same data. The broken `useSubscription` import is resolved.

### Key Results

**KR1 — Fix broken `useSubscription` import and implement the hook**  
*Addresses: broken import in `features/billing/index.ts`; `BillingPage` compile failure*

- Create `apps/ValyntApp/src/features/billing/hooks/useSubscription.ts`
- Fetches `GET /api/billing/subscription` — returns `Subscription` shape from `features/billing/types.ts`
- Exposes `{ subscription, isLoading, error, changePlan, cancelSubscription }`
- `changePlan(planTier)` → `POST /api/billing/plan-change/submit`
- `cancelSubscription()` → `POST /api/billing/subscription/cancel`
- Co-located unit test (mock fetch)

Acceptance: `BillingPage` compiles. `subscription.planTier` renders the real plan tier from `subscriptions` table. `pnpm run typecheck` passes.

**KR2 — Wire `UsageTab` to real usage data**  
*Addresses: hardcoded `usage` array in `UsageTab`*

- Create `apps/ValyntApp/src/features/billing/hooks/useUsageSummary.ts`
- Fetches `GET /api/billing/usage/summary` — returns per-meter `{ metric, used, limit, percentage }` array
- `UsageTab` replaces hardcoded array with `useUsageSummary()` data
- Empty state: skeleton loaders while loading; "No usage data yet" when empty
- Threshold alert: render warning card when any meter is ≥ 80% (driven by API data, not hardcoded)

Acceptance: `UsageTab` shows real `ai_tokens` and `api_calls` usage from `usage_aggregates`. Hardcoded `usage` array removed. Alert fires only when real data crosses threshold.

**KR3 — Wire `InvoicesTab` to real invoice data**  
*Addresses: `mockInvoices` array in `BillingPage.tsx`*

- Create `apps/ValyntApp/src/features/billing/hooks/useInvoices.ts`
- Fetches `GET /api/billing/invoices` — returns `Invoice[]` from `InvoiceService`
- `InvoicesTab` replaces `mockInvoices` with `useInvoices()` data
- Each invoice row: amount, status badge, date, PDF download link (signed URL from `FinanceExportService`)
- Empty state: "No invoices yet" when array is empty

Acceptance: `mockInvoices` constant removed. `InvoicesTab` renders real rows or truthful empty state. PDF link present when `pdfUrl` is non-null.

**KR4 — Implement usage ledger endpoint**  
*Addresses: TODO stub in `packages/backend/src/api/billing/usage.ts:136`*

- `GET /api/billing/usage/ledger/:dateRange` — queries `rated_ledger` via `InvoiceMathEngine.getRatedLedgerEntries()` (already private; expose as a repository method or inline the query)
- Returns `{ ledgerEntries: RatedLedgerRow[], breakdownByMetric: Record<string, number>, dateRange }`
- Tenant-scoped: `eq('tenant_id', tenantId)` required
- Remove the TODO comment

Acceptance: Endpoint returns real rows from `rated_ledger` for the tenant. Empty array when no entries. TODO comment removed. `pnpm run test:rls` passes.

**KR5 — Test gate**

- `pnpm test` green
- `pnpm run test:rls` green for billing tables
- `pnpm run typecheck` passes (no broken imports)

**Architectural rationale:** The billing backend is complete. This sprint is the same wiring step that Sprint 4 was for the value loop — the only work is connecting the frontend to real APIs. No new backend services are needed. This sprint must precede Sprint 16 (metering instrumentation) because the UI must be able to display metered data before metering is turned on.

**Risk flags:**
- `GET /api/billing/subscription` may not return the `planTier` field shape expected by `features/billing/types.ts` — verify field mapping before wiring. Contingency: add a Zod transform in the hook.
- `InvoiceService` may return Stripe invoice objects with different field names than `Invoice` type. Contingency: add a mapper function in `useInvoices`.

---

## Sprint 16 — Instrument Metering on Agent Paths (Weeks 3–4)

**Objective:** Every billable agent action emits a usage event. Quota enforcement blocks over-limit tenants.

**Success statement:** Running an agent in the product emits a `UsageRecorded` event to `usage_events`. A tenant at their `ai_tokens` cap receives a `402` response with a structured error body. The usage dashboard reflects real consumption within one aggregation cycle.

### Key Results

**KR1 — Instrument agent invocation path with usage events**  
*Addresses: metering not on agent path; checklist item §4 "Emit usage events from every billable subsystem"*

- In `packages/backend/src/api/agents.ts`: after successful agent execution, call `UsageMeteringService.recordUsage(tenantId, 'ai_tokens', tokenCount)` where `tokenCount` is extracted from the LLM response
- In `BaseAgent.secureInvoke()`: extract token usage from LLM response metadata; pass to caller via `AgentOutput.usage: { input_tokens, output_tokens }`
- `UsageMeteringService` already exists — wire it; do not create a new service
- Idempotency key: `${sessionId}:${agentType}:${Date.now()}` — prevents double-billing on retry
- Emit `UsageRecorded` CloudEvent via `MessageBus` after successful write

Acceptance: Running `OpportunityAgent` creates a row in `usage_events` with `meter_key: 'ai_tokens'`, correct `tenant_id`, and a non-zero `quantity`. Duplicate invocation with same idempotency key does not create a second row.

**KR2 — Instrument tool call path**  
*Addresses: checklist item §4 "tool invocations" billable subsystem*

- In `ToolRegistry.ts`: wrap `execute()` to call `UsageMeteringService.recordUsage(tenantId, 'api_calls', 1)` after each successful tool invocation
- `tenantId` sourced from execution context — never from client input
- Failures do not emit usage events (failed runs are not billable per `conductor/tracks/billing-v2/spec.md`)

Acceptance: Each tool call creates one `api_calls` usage event. Failed tool calls create no event. `pnpm test` passes for `ToolRegistry`.

**KR3 — Wire enforcement middleware to agent and API routes**  
*Addresses: `usageEnforcement.ts` middleware exists but is not applied to agent routes*

- Apply `usageEnforcement` middleware to `POST /api/agents/:agentId/invoke`
- Apply to `POST /api/usage/*` routes
- `EntitlementsService.checkUsageAllowance()` already implements the check — middleware calls it
- Return `402 Payment Required` with body: `{ allowed: false, reason, meter_key, cap, used, upgrade_url }`
- Soft limit (80%): log warning + emit `value_loop_usage_threshold_reached` Prometheus counter; do not block
- Hard limit (100%): block with 402

Acceptance: Tenant at 100% `ai_tokens` cap receives `402` with structured body. Tenant at 80% receives `200` with a `X-Usage-Warning` header. Tenant below 80% is unaffected.

**KR4 — Usage threshold alert in UI**  
*Addresses: checklist item §21 "Support usage threshold alerts"*

- `useUsageSummary` hook (Sprint 15): add `thresholdBreached: boolean` and `hardLimitReached: boolean` fields derived from API response
- `BillingPage`: render a dismissible banner when `thresholdBreached` (yellow) or `hardLimitReached` (red with upgrade CTA)
- Banner links to Plans tab

Acceptance: UI shows yellow banner at 80%, red banner at 100%. Banner is data-driven, not hardcoded.

**KR5 — Test gate**

- Golden test: `packages/backend/src/services/billing/__tests__/golden-usage-aggregation.test.ts` passes with real metering path
- `cap-enforcement-boundary.test.ts` passes
- `pnpm test` green

**Architectural rationale:** Metering must exist before invoicing can produce correct line items. This sprint depends on Sprint 15 (UI must be able to display the metered data). Enforcement middleware is already written — this sprint wires it to the routes it was designed for.

**Risk flags:**
- LLM response token counts may not be available in all Together.ai response shapes. Contingency: fall back to `prompt.length / 4` estimate; log a warning; mark event with `estimated: true` flag.
- `usageEnforcement` middleware may not have access to `tenantId` on all routes. Contingency: verify `tenantContextMiddleware` runs before enforcement on all affected routes.

---

## Sprint 17 — Invoice Generation and Payment Collection (Weeks 5–6)

**Objective:** Invoices are generated from real usage, finalized via Stripe, and visible in the product.

**Success statement:** At end-of-period, `InvoiceMathEngine` produces a draft invoice from `rated_ledger` entries. The invoice is finalized via Stripe. The customer sees it in the Invoices tab with a correct total and a PDF download link.

### Key Results

**KR1 — End-of-period invoice generation job**  
*Addresses: checklist item §11 "Generate draft invoices first"; §2.2 Stripe Invoice Mirroring from billing-v2 spec*

- Create `packages/backend/src/jobs/billing/generateMonthlyInvoices.ts` — BullMQ job, runs on the 1st of each month
- For each active subscription: call `InvoiceMathEngine.computeLineItems(tenantId, periodId, priceVersionId)` → `InvoiceService.createStripeInvoice(tenantId, lineItems)` → `InvoiceService.finalizeAndCollect(invoiceId)`
- Emit `InvoiceDrafted` then `InvoiceFinalized` CloudEvents via `MessageBus`
- Idempotent: check `invoices` table for existing invoice for `(tenant_id, period_start)` before creating
- Write audit log entry: `action: 'invoice.finalized'`, `resource_id: invoiceId`, `organization_id: tenantId`

Acceptance: Running the job for a tenant with usage creates one invoice row in `invoices` table. Re-running does not create a duplicate. Audit log entry exists. `InvoiceFinalized` event emitted.

**KR2 — Invoice preview endpoint**  
*Addresses: checklist item §11 "Support invoice preview in product before finalization"*

- `GET /api/billing/invoices/preview` — calls `InvoiceMathEngine.computeLineItems()` for current period without writing to DB
- Returns `{ lineItems, subtotal, credits, tax, total, periodStart, periodEnd, priceVersionId }`
- Uses same rating engine as actual invoice generation — preview and final must match

Acceptance: Preview total matches finalized invoice total for the same period. No rows written to `invoices` or `rated_ledger` during preview call.

**KR3 — Wire invoice preview to BillingPage**  
*Addresses: checklist item §14 "Real-time or near-real-time usage meters"; "next invoice estimate"*

- Add "Next Invoice" card to `BillingPage` usage tab
- Fetches `GET /api/billing/invoices/preview` on mount
- Shows: estimated total, period dates, line item breakdown (meter key, included, overage, amount)
- Skeleton loader while fetching; "No charges this period" when total is zero

Acceptance: Card renders real preview data. No hardcoded amounts. Empty state is truthful.

**KR4 — Payment failure → past_due flow**  
*Addresses: checklist item §12 "Handle retries and dunning"; `SubscriptionStateMachine` `payment_failed` transition*

- `WebhookService`: on `invoice.payment_failed` Stripe event, call `SubscriptionStateMachine.transition(currentStatus, 'payment_failed')` → update `subscriptions.status` to `past_due`
- Emit `SubscriptionChanged` CloudEvent
- `BillingPage`: when `subscription.status === 'past_due'`, render a red banner with "Update payment method" CTA linking to payment methods tab

Acceptance: Replaying a `invoice.payment_failed` webhook transitions subscription to `past_due`. UI renders the past-due banner. Idempotent: replaying the same webhook event does not double-transition.

**KR5 — Test gate**

- `invoice-reproducibility.test.ts` passes
- `integration/invoice-generation.test.ts` passes
- `integration/webhook-events.test.ts` passes for `payment_failed` → `past_due`
- `pnpm test` green

**Architectural rationale:** Invoice generation depends on Sprint 16 (metering must populate `rated_ledger` before `InvoiceMathEngine` has data to rate). The preview endpoint reuses the same engine, ensuring no divergence between what customers see and what they are charged. This sprint depends on Sprint 16.

**Risk flags:**
- `InvoiceMathEngine.computeLineItems()` queries `rated_ledger` — if the aggregation job has not run for the period, the ledger may be empty. Contingency: fall back to querying `usage_aggregates` directly and rate on the fly; log a warning.
- Stripe invoice finalization is irreversible. Contingency: add a `DRY_RUN=true` env flag that runs the job without calling `finalizeAndCollect`; default to dry-run in non-production environments.

---

## Sprint 18 — Customer Billing UX and Self-Serve Controls (Weeks 7–8)

**Objective:** A customer can manage their entire billing relationship from the product without contacting support.

**Success statement:** A customer can upgrade their plan, add a payment method, view a line-item breakdown of their current invoice, and see a real-time usage meter — all from the Billing page. Approval-gated changes show a pending state with expected resolution time.

### Key Results

**KR1 — Plan upgrade/downgrade flow with approval gating**  
*Addresses: checklist item §14 "Upgrade/downgrade flow"; `BillingApprovalService` is implemented but not wired to UI*

- `PlansTab`: "Select Plan" button calls `POST /api/billing/plan-change/preview` first — renders a confirmation modal showing proration delta and whether approval is required
- On confirm: `POST /api/billing/plan-change/submit`
- If response `status: 'pending_approval'`: show "Change submitted — awaiting approval" state with SLA hours from `billing_approval_policies`
- If response `status: 'applied'`: invalidate `useSubscription` query; show success toast

Acceptance: Plan change below approval threshold applies immediately. Plan change above threshold creates a `billing_approval_requests` row and shows pending state. No plan change applies without going through the preview step.

**KR2 — Payment method management**  
*Addresses: checklist item §14 "Payment method management"; `CustomerService.createSetupIntent()` exists*

- `PaymentMethodsTab` (new tab in `BillingPage`): lists payment methods from `GET /api/billing/payment-methods`
- "Add payment method" button: calls `POST /api/billing/payment-methods/setup-intent` → renders Stripe Elements `SetupElement` with the returned `client_secret`
- On success: invalidate payment methods query; show new card in list
- Default payment method badge

Acceptance: User can add a card via Stripe Elements. New card appears in list after success. No raw card data touches ValueOS servers.

**KR3 — Billing contact and address management**  
*Addresses: checklist item §14 "Billing contact management"; tax address required for Stripe Tax*

- `BillingSettingsTab` (new tab): form for billing email, company name, address, tax ID
- `PATCH /api/billing/subscription/billing-details` — updates Stripe customer via `CustomerService`; stores in `billing_customers` table
- Zod validation on all fields server-side

Acceptance: Billing details saved to `billing_customers` and reflected in Stripe customer object. Invalid tax ID format rejected with 400.

**KR4 — Approval queue for billing admins**  
*Addresses: checklist item §15 "Internal finance and support tooling"; `BillingApprovalService.decide()` exists*

- `ApprovalsTab` (visible to `billing:manage` role only): lists pending `billing_approval_requests` from `GET /api/billing/approvals`
- Each row: action type, requested by, delta MRR, SLA deadline, Approve/Reject buttons
- Approve/Reject calls `POST /api/billing/approvals/:id/decide`
- On decision: row moves to resolved state; `SubscriptionChanged` event triggers plan change

Acceptance: Billing admin can approve or reject a pending plan change. Approved change applies within one event cycle. Rejected change leaves subscription unchanged. Non-billing-admin cannot see the tab.

**KR5 — Test gate**

- `approval-workflow.test.ts` passes
- `integration/subscription-lifecycle.test.ts` passes for upgrade and downgrade paths
- `pnpm test` green

**Architectural rationale:** Self-serve controls depend on Sprint 17 (invoice preview must work before plan change confirmation can show accurate proration). Approval gating depends on `BillingApprovalService` (Sprint 15 baseline). This sprint depends on Sprint 17.

**Risk flags:**
- Stripe Elements requires the Stripe.js CDN. Contingency: load via `@stripe/stripe-js` npm package (already in the ecosystem); do not load from CDN directly.
- `billing:manage` RBAC permission may not be assigned to any role in the current `rbac.ts` config. Contingency: verify permission exists in `requirePermission` middleware; add if missing before wiring the Approvals tab.

---

## Sprint 19 — Reconciliation, Observability, and Enterprise Hardening (Weeks 9–10)

**Objective:** Finance can close the month. Anomalies are detected. Enterprise tenants can have custom pricing. The billing system is production-safe.

**Success statement:** A finance operator can export a reconciliation report. Usage spikes trigger alerts. A tenant can be placed on a custom price version without modifying the global plan catalog. `pnpm test` passes with 0 failed suites across all billing test files.

### Key Results

**KR1 — Reconciliation export endpoints**  
*Addresses: checklist item §16 "Reconcile invoices to payment processor settlements"; Phase 3.3 of billing-v2 spec; `FinanceExportService` exists but `generatePDF` returns a mock URL*

- `GET /api/billing/reconciliation/summary?period=YYYY-MM` — returns: total invoiced, total collected, total outstanding, credit issued, credit consumed, seat count vs billed seats
- `GET /api/billing/reconciliation/export?period=YYYY-MM&format=csv` — streams CSV of all invoice line items for the period
- Wire `FinanceExportService` to query real `invoices` and `rated_ledger` tables
- Require `billing:admin` permission

Acceptance: Reconciliation summary totals match sum of `invoices.total` for the period. CSV export contains one row per `rated_ledger` entry. Cross-tenant data is not included in any single tenant's export.

**KR2 — Usage anomaly detection**  
*Addresses: checklist item §21 "Support anomaly detection for sudden usage spikes"; `AlertingService` exists*

- `UsageAggregator`: after each aggregation cycle, compare current period total to 7-day rolling average; if > 3× average, call `AlertingService.sendAlert(tenantId, 'usage_spike', details)`
- `AlertingService` already has `sendEmailAlert` and `sendSlackAlert` — wire them (same pattern as `SecurityMonitor` in Sprint 13)
- Emit `value_loop_usage_anomaly_total` Prometheus counter

Acceptance: Injecting 10× normal usage into `usage_events` triggers an alert log entry. `SLACK_WEBHOOK_URL` set → Slack message sent. Counter incremented.

**KR3 — Custom pricing per tenant (Phase 3.1)**  
*Addresses: Phase 3.1 of billing-v2 spec; checklist item §3.1 "Custom Pricing per Tenant"*

- `billing_overrides` table: `id`, `tenant_id`, `price_version_id` (FK to `billing_price_versions`), `effective_at`, `effective_end`, `created_by`, `reason`, `created_at`
- RLS: `security.user_has_tenant_access()` + `billing:admin` only
- `PriceVersionService.getVersionForTenant(tenantId)`: checks `billing_overrides` first; falls back to global active version
- `POST /api/billing/admin/overrides` — creates override; requires `billing:admin`
- Migration + rollback file

Acceptance: Tenant with an override uses the override price version for invoice calculation. Tenant without an override uses the global active version. Override with `effective_end` in the past is ignored. `pnpm run test:rls` passes for `billing_overrides`.

**KR4 — Billing observability dashboard**  
*Addresses: checklist item §23 "Metering ingest lag dashboard"; "invoice generation failure alerts"*

- `infra/grafana/dashboards/billing.json` — Grafana dashboard with panels for:
  - `usage_events` ingest rate (events/min)
  - `rated_ledger` entry count by meter
  - Invoice generation success/failure rate
  - Enforcement check outcomes (allowed vs blocked)
  - Usage anomaly alert count
- Wire `MetricsCollector` in `packages/backend/src/services/billing/MetricsCollector.ts` to emit these counters (service exists; verify all counters are registered)

Acceptance: Dashboard JSON is valid and importable into Grafana. All five panels have data sources pointing to the Prometheus metrics emitted by the billing services.

**KR5 — Full billing test suite gate**

- All files in `packages/backend/src/services/billing/__tests__/` pass
- All files in `packages/backend/src/services/billing/__tests__/integration/` pass
- All files in `packages/backend/src/services/billing/__tests__/resiliency/` pass
- `pnpm run test:rls` passes for all billing tables including `billing_overrides`
- `pnpm test` green with 0 failed suites

**Architectural rationale:** Reconciliation and observability are the last layer — they require a complete, running billing system to be meaningful. Custom pricing depends on `PriceVersionService` (Sprint 15 baseline) and the invoice engine (Sprint 17). This sprint depends on Sprint 18. Enterprise gates are last per the sequencing rules.

**Risk flags:**
- Grafana dashboard JSON format may differ between Grafana versions in the dev stack. Contingency: use the same format as `infra/grafana/dashboards/value-loop.json` (Sprint 13 deliverable) as a template.
- `billing_overrides` table requires a migration; if the migration conflicts with existing `billing_price_versions` FK constraints, the rollback must be tested before merging. Contingency: test migration against a clean local Supabase instance before PR.

---

## Cross-Sprint Invariants

These rules apply to every PR across all five sprints. Source: `AGENTS.md`.

| Rule | Enforcement |
|---|---|
| Every DB query includes `organization_id` or `tenant_id` | Code review + `pnpm run test:rls` |
| All agent LLM calls use `this.secureInvoke()` | Code review; direct `llmGateway.complete()` calls are a PR blocker |
| `service_role` only in AuthService, tenant provisioning, cron jobs | Code review |
| TypeScript strict mode — no `any`; use `unknown` + type guards | `pnpm run typecheck` |
| Named exports only; no default exports | ESLint |
| Billing arithmetic uses `decimal.js` — no `number` type for money values | Code review (established in Sprint 14 S14-4) |
| Usage events are immutable and idempotent | Idempotency key required on every `UsageMeteringService.recordUsage()` call |
| Invoice amounts are frozen once finalized — no retroactive recalculation | `InvoiceService.finalizeAndCollect()` must set a `finalized_at` timestamp; any post-finalization mutation is a blocker |
| Audit log entry required for: invoice.finalized, subscription.changed, approval.decided, override.created | `AuditLogger` call required at each write point |

---

## Deferred (Post-Sprint 19)

- Kafka rollout for usage event ingestion at scale
- PPTX export
- Annual contract true-up and minimum commitment billing
- Multi-currency support
- VAT/GST tax calculation (Stripe Tax integration beyond flat rate)
- `DeviceFingerprintService` GeoIP / threat intelligence
- Grafana alerting rules (dashboard in Sprint 19; alert rules post-GA)
- Consolidated billing across multiple tenants
- PO-based enterprise billing and net-30/60 payment terms

---

## Sprint Dependency Chain

```
Sprint 15: Fix broken billing frontend wiring (useSubscription, UsageTab, InvoicesTab, ledger endpoint)
    ↓
Sprint 16: Instrument metering on agent/tool paths; wire enforcement middleware
    ↓
Sprint 17: Invoice generation job; invoice preview; payment failure → past_due flow
    ↓
Sprint 18: Self-serve plan change; payment method management; approval queue UI
    ↓
Sprint 19: Reconciliation exports; anomaly detection; custom pricing; observability dashboard
```

Each sprint's output is a prerequisite for the next. Sprint 15 is the only sprint that can begin immediately — it has no dependency on new backend work.
