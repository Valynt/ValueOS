# Spec: Senior DevOps Final Repo Review (Production Sign-Off Gate)

## Problem Statement

ValueOS is a multi-tenant, agentic SaaS platform approaching its first production deployment. This spec defines the structure, scope, and methodology for a Senior DevOps / Release Authority production sign-off review. The review must determine whether the system is safe to ship, identify where it breaks under real conditions, and quantify the blast radius of each failure mode.

The review is **not** a code quality audit. It is a failure-mode analysis with a hard verdict.

---

## Context (Established from Codebase Exploration)

**Stack:**
- pnpm monorepo — React/Vite frontend (`ValyntApp`), Node.js/Express backend (`@valueos/backend`)
- Supabase (Postgres + RLS + Auth + Realtime)
- Redis (rate limiting, caching, auth fallback counters)
- BullMQ workers (research, CRM, artifact generation, certificate generation)
- NATS JetStream (metering/usage queue — **not yet deployed**)
- 8-agent fabric with DAG workflow orchestration
- Stripe billing (webhooks, subscriptions, usage metering)
- OpenTelemetry tracing (10% sample rate in production)

**Deployment state:** Pre-production. No live traffic yet.

**CI/CD:** GitHub Actions with ~20 workflow jobs across `pr-fast.yml`, `main-verify.yml`, `deploy.yml`, `release.yml`, `test.yml`. Tenant isolation gate (`tenant-isolation-gate`) runs against Supabase secrets — confirmation status unknown whether real DB or test double is used.

**Integration test posture:** Billing integration tests use `createInMemorySupabaseClient()` when `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` are absent. RLS policy tests in `tests/security/` skip via `describe.skipIf(!supabaseAvailable)` when env vars are missing.

---

## Acceptance Criteria

The completed review document must:

1. Open with a hard **Verdict** — one of: `Ship` / `Ship with Conditions` / `No-Ship` — with a one-paragraph justification.
2. Identify the **Top 3 Failure Scenarios** with probability × impact scoring.
3. Deliver a **Failure Mode Analysis** covering at minimum:
   - Partial workflow execution / DAG stage failures
   - NATS JetStream unavailability (metering pipeline not deployed)
   - Stripe webhook delivery failures and retry edge cases
   - Billing enforcement state divergence (Stripe vs. Supabase)
   - Tenant boundary violations via cache, queue, or async context loss
4. Deliver a **CI/CD Trust Assessment** (High / Medium / Low) covering:
   - Whether the tenant isolation gate runs against a real Supabase instance
   - Integration test skip-if patterns and their implications
   - The `skip_tests` bypass path in `deploy.yml`
   - Coverage thresholds (75% lines / 70% branches) vs. actual risk coverage
   - The `processedWebhookIds` in-memory idempotency set (test-only, not production path)
5. Deliver a **Tenant Isolation Assessment** covering:
   - RLS enforcement consistency across all billing tables
   - `CacheService` tenant prefix derivation from `AsyncLocalStorage` — failure when context is absent
   - `LLMCache` Redis keys — no tenant prefix (cross-tenant cache collision risk)
   - Background worker tenant context propagation (BullMQ jobs, NATS consumer)
   - `service_role` usage scope (AuthService, tenant provisioning, cron jobs)
6. Deliver a **Revenue & Billing Risk Assessment** covering:
   - NATS JetStream not deployed → `UsageQueueConsumerWorker` cannot start → usage events never persisted → billing aggregation silently broken
   - Webhook idempotency: `processEvent` uses DB upsert (correct) but `processWebhook` uses in-memory `Set` (test-only, throws in production)
   - `handleSubscriptionDeleted` reads `tenant_id` from a second query after updating status — TOCTOU window
   - `resolveTenantId` failure path in `handlePaymentSucceeded` — silent skip if customer not found
   - `WebhookRetryService` polls `webhook_events` without tenant scoping — service_role bypass acceptable but must be confirmed
7. Deliver an **Observability Assessment** covering:
   - OpenTelemetry tracing at 10% sample rate — 90% of production traces invisible
   - No confirmed alerting rules wired to `agent_fabric_cost_usd_total` or `queue_consumer_lag` in the review scope
   - Billing worker health endpoint on port 8082 — not confirmed as monitored
   - Silent failure paths: `CacheService` Redis errors swallowed; `LLMCache` Redis errors return `null` silently
8. List **Systemic Risks** (patterns that recur across multiple subsystems).
9. List **Required Conditions Before Ship** in the format: `[ ] Condition / Why it matters / What breaks if ignored / Effort`.
10. Close with a **Confidence Score** (0–5) with justification.

---

## Review Philosophy (Enforced)

- Assume tests lie unless proven otherwise. The RLS tests skip when Supabase env vars are absent — their pass/fail status in CI is unconfirmed.
- Prefer real execution paths over mocks. The Stripe failure tests exercise mock clients, not the real `StripeService` retry path.
- Prefer failure scenarios over happy paths.
- Prefer system behavior over code quality.
- Map each identified risk to where else the same pattern appears in the system.

---

## Implementation Approach (Ordered Steps)

The Build step will produce the review document by executing the following analysis tasks in order:

### Step 1 — Verdict Determination
Synthesize findings from all subsequent steps into a single verdict. The verdict is written last but placed first in the output document.

### Step 2 — Top 3 Failure Scenarios
Rank by `probability × impact`. Candidates identified during exploration:
- NATS JetStream not deployed → metering pipeline dead on arrival
- Stripe webhook `resolveTenantId` silent skip → payment events lost without alert
- RLS integration tests running against test double → isolation guarantees unproven in CI

### Step 3 — Failure Mode Analysis
For each failure mode, document: Trigger → Execution path → Detection → Outcome → Recovery.

Key paths to trace:
- `WorkflowExecutor.executeDAGAsync` → stage failure → `_handleWorkflowFailure` → compensation
- `UsageQueueConsumerWorker.start()` → NATS connect failure → process crash or silent hang
- `WebhookService.processEvent` → `resolveTenantId` returns null → enforcement state not updated
- `CacheService.get()` → `tenantContextStorage.getStore()` returns undefined → key prefixed with `tenant:global:` → cross-tenant cache read
- `WorkflowCompensation.rollbackExecution` → `ROLLBACK_TIMEOUT_MS = 5000` → compensation timeout → partial rollback, no alert

### Step 4 — CI/CD Trust Assessment
Evaluate each CI gate:
- `tenant-isolation-gate`: runs `describe.skipIf(!supabaseAvailable)` — if secrets absent, all RLS tests skip and gate passes green
- `unit-component-schema`: coverage thresholds 75%/70% — does not enforce billing or agent orchestration path coverage specifically
- `e2e-critical`: only covers `auth-complete-flow.spec.ts` and `critical-user-flow.spec.ts` — no billing E2E
- `deploy.yml` `skip_tests` input: blocked for production but allowed for staging with incident reference — audit trail exists but gate is bypassable
- `WebhookService.processWebhook` (deprecated, test-only): throws in production — confirms test isolation but means webhook idempotency unit tests do not exercise the production code path

### Step 5 — Tenant Isolation Assessment
Evaluate:
- `CacheService`: tenant prefix from `AsyncLocalStorage` — if middleware did not run (background jobs, direct service calls), `tid` is `undefined` → key becomes `tenant:global:namespace:key` → all tenants share the same cache entry
- `LLMCache`: Redis keys are `llm:cache:{model}:{hash}` — **no tenant prefix** — LLM responses cached globally, cross-tenant cache hit possible
- BullMQ workers (`researchWorker`, `crmWorker`, `ArtifactGenerationWorker`): no evidence of tenant context propagation into job payloads or AsyncLocalStorage restoration on job pickup
- `WorkflowExecutor.buildStageContext`: calls `assertTenantContextMatch` — correct enforcement at orchestration layer
- `service_role` client: used in `WebhookRetryService`, `TenantProvisioning`, `AuthService` — scope appears correct per AGENTS.md rules

### Step 6 — Revenue & Billing Risk Assessment
Trace the full money flow:
```
Agent invocation → UsageEmitter → UsageQueueProducer → NATS JetStream
  → UsageQueueConsumerWorker → UsageLedgerIngestionService → usage_ledger table
  → UsageAggregator → billing_aggregates → RatingEngine → InvoiceService
  → Stripe invoice → WebhookService (payment_succeeded) → tenant enforcement state
```
Identify each node where silent failure is possible.

### Step 7 — Observability Assessment
Evaluate signal coverage:
- Tracing: OTLP at 10% sample rate — document what is invisible
- Metrics: `agent_fabric_cost_usd_total`, `queue_job_total`, `queue_consumer_lag` — confirm alert rules exist
- Billing worker health: port 8082 — confirm liveness probe is wired in K8s deployment
- Structured logging: `createLogger` used consistently — confirm `tenantId` is propagated via `AsyncLocalStorage` context in all paths

### Step 8 — Systemic Risks
Identify patterns that appear in ≥2 subsystems. Candidates:
- "AsyncLocalStorage context loss in background jobs" — affects CacheService, LLMCache, logging, tenant enforcement
- "Test doubles masking real integration failures" — affects RLS tests, billing integration tests, Stripe failure tests
- "Silent null returns on missing data" — affects `resolveTenantId`, `CacheService.get`, `LLMCache.get`

### Step 9 — Required Conditions Before Ship
Format each as: `[ ] Condition / Why it matters / What breaks if ignored / Effort`

Candidates identified:
- Confirm NATS JetStream is deployed and metering pipeline is operational end-to-end
- Confirm `tenant-isolation-gate` runs against a real Supabase instance with actual RLS policies applied
- Add tenant prefix to `LLMCache` Redis keys
- Confirm BullMQ job processors restore tenant context from job payload before any service call
- Confirm billing E2E test coverage (at minimum: payment_succeeded → enforcement state transition)
- Confirm OpenTelemetry collector is deployed and receiving traces in staging
- Confirm billing worker liveness probe is wired in K8s

### Step 10 — Confidence Score
Score 0–5 based on:
- Depth of test coverage actually exercised against real infrastructure
- Completeness of observability signal
- Number of unresolved "unknown" states (NATS, RLS test backend, alert wiring)

---

## Output Document Structure (Strict)

The review document produced by the Build step must follow this exact structure and be written to `docs/production-sign-off-review.md`:

```
# ValueOS — Production Sign-Off Review

## Verdict
(Ship / Ship with Conditions / No-Ship)
[Justification paragraph]

## Top Failure Scenarios
1. ...
2. ...
3. ...

## CI/CD Trust Assessment
Trust Level: High / Medium / Low
Gaps:
  - ...

## Tenant Isolation Assessment
Status:
Risks:
  - ...

## Revenue Risk Assessment
Status:
Risks:
  - ...

## Observability Assessment
Status:
Blind spots:
  - ...

## Failure Mode Analysis
### [Failure Name]
- Trigger:
- Execution path:
- Detection:
- Outcome:
- Recovery:
[repeat for each failure mode]

## Systemic Risks
1. ...

## Required Conditions Before Ship
[ ] Condition
    Why it matters:
    What breaks if ignored:
    Effort:
[repeat]

## Confidence Score
X/5 — [justification]
```

---

## Files Affected

| File | Action |
|---|---|
| `docs/production-sign-off-spec.md` | Created (this file) |
| `docs/production-sign-off-review.md` | Created by Build step |
