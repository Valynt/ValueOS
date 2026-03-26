# Spec: Production Sign-Off Remediation

**Source review:** `docs/production-sign-off-review.md`  
**Review verdict:** Ship with Conditions — Confidence: 2.5/5  
**Target verdict after remediation:** Ship — Confidence: 4/5+

---

## Problem Statement

The production sign-off review identified seven conditions that block an unconditional ship. Three must be resolved before any customer traffic; four must be resolved before scale. None require architectural change — all are gaps in deployment, key construction, CI configuration, async context propagation, metric wiring, and a silent null path.

This spec defines the acceptance criteria and implementation steps for closing all seven conditions.

---

## Conditions and Acceptance Criteria

### Condition 1 — NATS JetStream not deployed

**Priority:** Must fix before any customer traffic  
**Location:** `infra/k8s/base/nats-jetstream.yaml`, `packages/backend/src/services/metering/`

**What breaks if ignored:** `UsageQueueProducer.publishUsageEvent()` throws on every call. `UsageEmitter` routes events to an in-memory buffer (10k cap, process-scoped, lost on restart). The billing aggregator worker (`billingAggregatorWorker.ts`) crashes on startup because `MeteringQueue.subscribe()` calls `connect()` which throws. Revenue is silently unmetered from the first agent invocation.

**Acceptance criteria:**
- [ ] `kubectl get statefulset metering-nats -n valynt` returns `READY 1/1`
- [ ] `kubectl get service metering-nats -n valynt` returns the service on port 4222
- [ ] Billing aggregator worker pod starts and reaches `Running` state (liveness probe on port 8082 passes)
- [ ] A test usage event published via `UsageQueueProducer.publishUsageEvent()` appears in the `usage_ledger` table within 30 seconds
- [ ] `worker.getLag()` returns a numeric value (not an error) from the health endpoint

**Implementation steps:**
1. Verify `nats-jetstream.yaml` is included in `infra/k8s/base/kustomization.yaml` — it is (line already present).
2. Confirm the `valynt` namespace exists: `kubectl get namespace valynt`
3. Apply the manifest: `kubectl apply -k infra/k8s/base/`
4. Wait for the StatefulSet to reach ready: `kubectl rollout status statefulset/metering-nats -n valynt`
5. Verify the billing aggregator worker pod restarts cleanly after NATS is available
6. Run an end-to-end smoke test: trigger one agent invocation, confirm a row appears in `usage_ledger`
7. Confirm `dead_letter_events` table is empty (no events lost during the pre-deployment window)

---

### Condition 2 — `LLMCache` has no tenant prefix

**Priority:** Must fix before any customer traffic  
**Location:** `packages/backend/src/services/core/LLMCache.ts`, `packages/backend/src/services/llm/LLMCache.ts`

**What breaks if ignored:** Two tenants submitting identical prompts to the same model receive the same cached response. For a B2B SaaS platform where prompts encode deal data, financial models, or competitive intelligence, this is a confirmed cross-tenant data confidentiality breach on every cache hit.

**Current key format:** `llm:cache:{model}:{sha256(prompt+model+options)[0:16]}`  
**Required key format:** `llm:cache:{tenantId}:{model}:{sha256(prompt+model+options)[0:16]}`

**Design decisions (from user input):**
- Introduce a central `buildLLMCacheKey({ tenantId, model, hash })` function — single enforcement point
- `tenantId` is a required parameter; missing `tenantId` must throw/fail closed (not silently degrade)
- `AsyncLocalStorage` may be used as a convenience source to resolve `tenantId` at the service layer, but is not the trust boundary — callers must pass `tenantId` explicitly or the key builder throws
- One-time invalidation of all existing non-tenant-prefixed cache entries on deploy

**Acceptance criteria:**
- [ ] `buildLLMCacheKey` is the only key construction path in `LLMCache` — no inline key generation
- [ ] Calling `buildLLMCacheKey` without `tenantId` throws a typed error (not returns null, not logs a warning)
- [ ] All call sites of `LLMCache.get()` and `LLMCache.set()` pass `tenantId` explicitly
- [ ] Unit test: two tenants with identical prompts produce different cache keys
- [ ] Unit test: missing `tenantId` throws at key construction, not at Redis call time
- [ ] Deploy script includes a Redis key flush for the `llm:cache:` prefix (invalidates all pre-migration entries)
- [ ] `LLMCache.test.ts` updated to cover tenant-scoped key isolation

**Implementation steps:**
1. Add `buildLLMCacheKey({ tenantId, model, prompt, options }: { tenantId: string; model: string; prompt: string; options?: unknown }): string` to `LLMCache.ts` — throws `Error('tenantId is required for LLM cache key construction')` if `tenantId` is falsy
2. Replace the inline `generateCacheKey` private method with `buildLLMCacheKey`
3. Update `get()`, `set()`, `delete()`, `setWithTTL()` signatures to accept `tenantId: string` as a required first parameter
4. Update all call sites (search: `llmCache.get\|llmCache.set\|LLMCache`) to pass `tenantId`
5. Add a `flushGlobalKeys()` method that scans and deletes all keys matching `llm:cache:` that do NOT match `llm:cache:{uuid}:` pattern
6. Call `flushGlobalKeys()` once during server startup (guarded by a one-time flag in Redis to prevent repeated flushes)
7. Update `packages/backend/src/services/core/LLMCache.ts` (the canonical location) and ensure `packages/backend/src/services/llm/LLMCache.ts` re-exports from it (already does via `packages/backend/src/services/LLMCache.ts`)
8. Update tests in `packages/backend/src/services/__tests__/LLMCache.test.ts` and `packages/backend/src/services/core/__tests__/LLMCache.test.ts`

---

### Condition 3 — RLS tests skip silently in CI

**Priority:** Must fix before any customer traffic  
**Location:** `tests/security/rls-tenant-isolation.test.ts`, `tests/security/supabase-rls-policy-matrix.test.ts`, `.github/workflows/`

**What breaks if ignored:** The `tenant-isolation-gate` CI job passes green with zero tests executed when `VITE_SUPABASE_URL` or `SUPABASE_SERVICE_KEY` are absent. The tenant isolation guarantee is backed by static analysis only — not by execution against real Postgres RLS policies.

**Current behavior:** `beforeAll` logs `console.warn("Skipping RLS tests - ...")` and returns early. Individual tests use `if (!process.env.SUPABASE_SERVICE_KEY) { return; }` guards. All pass as vacuous truths.

**Acceptance criteria:**
- [ ] CI job `tenant-isolation-gate` fails with a non-zero exit code if `VITE_SUPABASE_URL` or `SUPABASE_SERVICE_KEY` are not set
- [ ] `VITE_SUPABASE_URL`, `SUPABASE_SERVICE_KEY` (or `SUPABASE_SERVICE_ROLE_KEY`), and `SUPABASE_ANON_KEY` are configured as GitHub Actions secrets and injected into the `tenant-isolation-gate` job
- [ ] A CI step asserts that at least N RLS tests executed (not just passed) — N = total test count in the three RLS test files
- [ ] `rls-tenant-isolation.test.ts`: `beforeAll` throws `Error('RLS tests require VITE_SUPABASE_URL and SUPABASE_SERVICE_KEY — set these secrets in CI')` instead of returning early
- [ ] Individual test-level `if (!env) { return; }` guards are removed; the suite-level guard is the single enforcement point
- [ ] `pnpm run test:rls` passes locally when secrets are set and fails fast when they are not

**Implementation steps:**
1. Replace `console.warn + return` in `beforeAll` of all three RLS test files with `throw new Error(...)` — this causes Vitest to mark the entire suite as failed, not skipped
2. Remove per-test `if (!process.env.SUPABASE_SERVICE_KEY) { return; }` guards (they become dead code after step 1)
3. Add `VITE_SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_ANON_KEY` to GitHub Actions secrets (repository settings → Secrets and variables → Actions)
4. In the `tenant-isolation-gate` job in `.github/workflows/`, add `env:` block injecting the three secrets
5. Add a post-test step that reads Vitest's JSON reporter output and asserts `numPassedTests >= expected_count` — fail the job if the count is below threshold
6. Document the required secrets in `CONTRIBUTING.md` under "Running RLS tests locally"

---

### Condition 4 — BullMQ workers don't restore `AsyncLocalStorage` context

**Priority:** Must fix before scale  
**Location:** `packages/backend/src/workers/researchWorker.ts`, `packages/backend/src/workers/crmWorker.ts`, `packages/backend/src/workers/billingAggregatorWorker.ts`

**What breaks if ignored:** `CacheService.tenantPrefix()` calls `tenantContextStorage.getStore()` and falls back to `tenant:global:` when the store is empty. All `CacheService` calls inside worker jobs write to and read from a shared global namespace, making worker-scoped cache entries cross-tenant. Logger context, audit hooks, and any other `AsyncLocalStorage`-dependent service also operate without tenant context.

**Current state:** `researchWorker.ts` passes `tenantId` in the job payload and uses it for LLM calls, but does not call `tenantContextStorage.run()` before processing. `crmWorker.ts` and `billingAggregatorWorker.ts` have no tenant context restoration.

**Acceptance criteria:**
- [ ] Every BullMQ job processor wraps its handler body in `tenantContextStorage.run(tctPayload, handler)` before any service call
- [ ] `tctPayload` is constructed from `job.data.tenantId` (required field in all job payloads)
- [ ] If `job.data.tenantId` is absent, the job throws and is moved to the BullMQ dead-letter queue — it does not process with `tenant:global:` context
- [ ] Unit test: a job processed without `tenantId` in payload is rejected (not silently processed)
- [ ] Unit test: `CacheService.get()` called inside a job processor uses the job's `tenantId` as the cache prefix
- [ ] After deploying the fix, flush Redis keys matching `tenant:global:*` to evict any cross-tenant entries written before the fix

**Implementation steps:**
1. Import `tenantContextStorage` from the shared context module in each worker file
2. In each worker's job processor function, extract `tenantId` from `job.data` — throw `Error('Worker job missing tenantId in payload')` if absent
3. Wrap the entire job handler body: `await tenantContextStorage.run({ tid: tenantId, ... }, async () => { /* existing handler */ })`
4. Define a minimal `TenantContextPayload` type (`{ tid: string }`) if not already exported from the context module
5. Add a `tenantId` field to the TypeScript type definitions for each worker's job data interface
6. Add unit tests for each worker verifying context propagation
7. Add a one-time Redis flush of `tenant:global:*` keys to the deploy runbook

---

### Condition 5 — Billing alert rules reference non-existent metrics

**Priority:** Must fix before scale  
**Location:** `infra/k8s/monitoring/billing-alerts.yaml`, `packages/backend/src/services/billing/`

**What breaks if ignored:** `billing-alerts.yaml` references `billing_usage_records_unaggregated`, `billing_stripe_submission_errors_total`, `billing_webhook_retry_queue_size`, and `billing_pending_aggregates_age_seconds`. None of these metric names appear anywhere in the backend source. All billing alerts are permanently silent — no alert will ever fire regardless of billing system state.

**Acceptance criteria:**
- [ ] Each metric referenced in `billing-alerts.yaml` has a corresponding `Counter`, `Gauge`, or `Histogram` registration in the backend source
- [ ] Each metric is incremented/set at the correct point in the billing pipeline:
  - `billing_usage_records_unaggregated` — gauge set by `UsageAggregator` before each aggregation run
  - `billing_stripe_submission_errors_total` — counter incremented on Stripe API errors in `InvoiceService`
  - `billing_webhook_retry_queue_size` — gauge set by `WebhookRetryService` before each poll cycle
  - `billing_pending_aggregates_age_seconds` — gauge set to the age of the oldest un-aggregated record
- [ ] A Prometheus scrape of the backend `/metrics` endpoint returns all four metric names
- [ ] At least one alert rule fires correctly in a staging environment test (inject a synthetic failure, confirm alert state changes to `firing`)

**Implementation steps:**
1. Create `packages/backend/src/lib/metrics/billingMetrics.ts` — register all four metrics using the existing `prom-client` pattern (see `cacheMetrics.ts` for reference)
2. Export metrics from the billing metrics module and import them at the relevant service call sites:
   - `UsageAggregator`: set `billing_usage_records_unaggregated` gauge before aggregation
   - `InvoiceService`: increment `billing_stripe_submission_errors_total` in the Stripe error catch block
   - `WebhookRetryService`: set `billing_webhook_retry_queue_size` gauge at the start of each poll
   - `UsageAggregator` or a scheduled job: set `billing_pending_aggregates_age_seconds` by querying the oldest un-aggregated `usage_events` row
3. Register the metrics module in `server.ts` alongside existing metric registrations
4. Verify `/metrics` endpoint returns the new metric names
5. Update `billing-alerts.yaml` if any metric names need adjustment to match the registered names exactly
6. Add a CI lint step that cross-references metric names in `billing-alerts.yaml` against the backend source (grep-based, fails if any alert references an unregistered metric name)

---

### Condition 6 — `resolveTenantId` silent null in `handlePaymentSucceeded`

**Priority:** Must fix before scale  
**Location:** `packages/backend/src/services/billing/WebhookService.ts`

**What breaks if ignored:** A `invoice.payment_succeeded` event for a Stripe customer with no matching `billing_customers` row silently skips `setTenantEnforcementState`. The webhook is marked as successfully processed. The tenant has paid but their `access_mode` remains in its previous state (e.g., `grace_period` or `restricted`). No alert fires. No error log. The tenant cannot access the product despite having paid.

**Current code path:**
```typescript
const tenantId = await this.resolveTenantId(invoice.customer);
if (tenantId) {
  // enforcement state update
}
logger.info("Payment succeeded processed", { invoiceId: invoice.id });
```

**Acceptance criteria:**
- [ ] When `resolveTenantId` returns `null`, `handlePaymentSucceeded` logs at `error` level with `stripeCustomerId`, `invoiceId`, and a message indicating the enforcement state was not updated
- [ ] A `billing_webhook_unresolved_tenant_total` counter is incremented (wired to the billing metrics module from Condition 5)
- [ ] The webhook event is NOT marked as successfully processed when `tenantId` is null — it is marked as `failed` so `WebhookRetryService` will retry it
- [ ] An alert rule fires when `billing_webhook_unresolved_tenant_total > 0` for more than 5 minutes
- [ ] Unit test: `handlePaymentSucceeded` with a Stripe customer ID not in `billing_customers` results in a failed webhook event and an error log
- [ ] Unit test: `handlePaymentSucceeded` with a valid customer ID still updates enforcement state correctly (regression)

**Implementation steps:**
1. In `handlePaymentSucceeded`, replace the silent `if (tenantId)` guard with an explicit null check that:
   - Logs at `error` level: `logger.error('Payment succeeded but tenant not found', { stripeCustomerId: invoice.customer, invoiceId: invoice.id })`
   - Increments `billing_webhook_unresolved_tenant_total` counter
   - Throws an error (or returns a failure result) so the webhook is not marked as processed
2. Ensure `WebhookService.processEvent` propagates the thrown error to mark the event as `failed` in `webhook_events`
3. Add the `billing_webhook_unresolved_tenant_total` counter to `billingMetrics.ts` (from Condition 5)
4. Add an alert rule to `billing-alerts.yaml` for this counter
5. Add unit tests covering both the null and non-null paths

---

### Condition 7 — OTel collector deployment unconfirmed

**Priority:** Must fix before scale  
**Location:** `infra/k8s/observability/otel-collector/`, `packages/backend/src/observability/tracing.ts`

**What breaks if ignored:** At 10% sampling, if no collector is running, no traces reach the backend. A billing failure affecting 5% of tenants may produce zero traces. The `OTEL_EXPORTER_OTLP_ENDPOINT` env var in the backend deployment points to the collector service — if the service doesn't exist, the SDK silently drops all spans.

**Current state:** The OTel collector manifests exist in `infra/k8s/observability/otel-collector/` but are in a separate observability directory with its own `deploy-observability.sh` script — not included in the base kustomization. Deployment status is unconfirmed.

**Acceptance criteria:**
- [ ] `kubectl get deployment otel-collector -n observability` returns `READY 1/1`
- [ ] `kubectl get service otel-collector -n observability` returns the service on the OTLP port
- [ ] The backend deployment's `OTEL_EXPORTER_OTLP_ENDPOINT` env var resolves to the running collector service
- [ ] A test request to the backend produces a trace visible in the configured tracing backend (Tempo or equivalent)
- [ ] The 10% sample rate is documented in the runbook with a procedure for temporarily increasing it during incident investigation (`kubectl set env deployment/backend OTEL_TRACES_SAMPLER_ARG=1.0`)
- [ ] A `ServiceMonitor` or `PodMonitor` resource is created for the billing aggregator worker so its `/metrics` endpoint on port 8082 is scraped by Prometheus

**Implementation steps:**
1. Run `infra/k8s/observability/deploy-observability.sh` against the target cluster (or apply the otel-collector manifests directly: `kubectl apply -f infra/k8s/observability/otel-collector/`)
2. Verify the collector is receiving spans: check collector logs for incoming OTLP data
3. Confirm `OTEL_EXPORTER_OTLP_ENDPOINT` in `infra/k8s/base/configmap.yaml` or the backend deployment env points to `http://otel-collector.observability.svc.cluster.local:4318`
4. Create `infra/k8s/monitoring/billing-worker-service-monitor.yaml` — a `ServiceMonitor` resource targeting `app: billing-aggregator-worker` on port `health` (8082), path `/metrics`
5. Apply the ServiceMonitor: `kubectl apply -f infra/k8s/monitoring/billing-worker-service-monitor.yaml`
6. Add the sampling rate override procedure to `docs/runbooks/` (or update the existing observability runbook)
7. Verify end-to-end: trigger an agent invocation, confirm a trace appears in the tracing UI

---

## Implementation Order

The seven conditions must be addressed in this order to minimize risk:

| Order | Condition | Reason |
|-------|-----------|--------|
| 1 | LLMCache tenant prefix (Condition 2) | Pure code change, no infra dependency, closes a live data leak path |
| 2 | `resolveTenantId` silent null (Condition 6) | Pure code change, closes a silent billing failure path |
| 3 | BullMQ worker context (Condition 4) | Code change + Redis flush; must happen before NATS is live to avoid polluting the cache |
| 4 | Billing metrics wiring (Condition 5) | Code change; must be deployed before NATS goes live so alerts fire from day one |
| 5 | NATS JetStream deployment (Condition 1) | Infra change; deploy after code fixes are live so the pipeline is instrumented on first use |
| 6 | RLS CI gate (Condition 3) | CI configuration; can be done in parallel with code changes but must be verified before ship |
| 7 | OTel collector deployment (Condition 7) | Infra change; deploy in parallel with NATS |

---

## Files to Create or Modify

| File | Action | Condition |
|------|--------|-----------|
| `packages/backend/src/services/core/LLMCache.ts` | Modify — add `buildLLMCacheKey`, require `tenantId` | 2 |
| `packages/backend/src/services/core/__tests__/LLMCache.test.ts` | Modify — add tenant isolation tests | 2 |
| `packages/backend/src/services/__tests__/LLMCache.test.ts` | Modify — add tenant isolation tests | 2 |
| `packages/backend/src/services/billing/WebhookService.ts` | Modify — `handlePaymentSucceeded` null guard | 6 |
| `packages/backend/src/workers/researchWorker.ts` | Modify — wrap handler in `tenantContextStorage.run()` | 4 |
| `packages/backend/src/workers/crmWorker.ts` | Modify — wrap handler in `tenantContextStorage.run()` | 4 |
| `packages/backend/src/workers/billingAggregatorWorker.ts` | Modify — wrap handler in `tenantContextStorage.run()` | 4 |
| `packages/backend/src/lib/metrics/billingMetrics.ts` | Create — register four billing metrics | 5 |
| `tests/security/rls-tenant-isolation.test.ts` | Modify — `beforeAll` throws instead of warns | 3 |
| `tests/security/supabase-rls-policy-matrix.test.ts` | Modify — same | 3 |
| `packages/backend/src/services/billing/__tests__/security/rls-policies.test.ts` | Modify — same | 3 |
| `.github/workflows/` (tenant-isolation-gate job) | Modify — inject Supabase secrets, add test count assertion | 3 |
| `infra/k8s/monitoring/billing-worker-service-monitor.yaml` | Create — ServiceMonitor for billing worker | 7 |
| `infra/k8s/monitoring/billing-alerts.yaml` | Modify — add `billing_webhook_unresolved_tenant_total` alert | 6 |

---

## Verification Gate

Before marking this spec complete, all of the following must be true:

- [ ] `pnpm test` passes with no regressions
- [ ] `pnpm run test:rls` passes against a real Supabase instance
- [ ] `kubectl get pods -n valynt` shows billing aggregator worker in `Running` state
- [ ] `kubectl get pods -n observability` shows otel-collector in `Running` state
- [ ] A synthetic end-to-end test confirms: agent invocation → usage event → `usage_ledger` row → billing aggregate
- [ ] Prometheus scrape of `/metrics` returns all four billing metric names
- [ ] No Redis keys matching `llm:cache:{model}:` (without tenant prefix) exist after the flush
- [ ] CI `tenant-isolation-gate` job fails when Supabase secrets are removed from the test environment
