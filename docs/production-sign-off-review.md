# ValueOS — Production Sign-Off Review

**Reviewer role:** Senior DevOps / Release Authority  
**Review date:** 2025-07-23  
**Codebase state:** Pre-production (no live traffic)  
**Review scope:** Full repo static analysis — architecture, CI/CD, billing, tenant isolation, observability, failure modes

---

## Verdict

**Ship with Conditions**

The core platform architecture is sound. Tenant isolation at the HTTP layer is enforced correctly. The billing state machine, webhook idempotency, and workflow compensation patterns are well-designed. However, three conditions make an unconditional ship irresponsible: (1) the metering pipeline's NATS JetStream dependency is not deployed, meaning usage-based billing is silently broken from day one; (2) the RLS integration tests in CI are running against an in-memory test double when Supabase secrets are absent, so the tenant isolation guarantee is unproven against real database policies; and (3) the `LLMCache` Redis layer has no tenant prefix, creating a cross-tenant data leakage vector on every cache hit. None of these are architectural dead-ends — all are fixable in days — but none can be deferred past first customer traffic.

---

## Top Failure Scenarios

### 1. Metering pipeline dead on arrival — Probability: High × Impact: Critical

NATS JetStream is not deployed. `UsageQueueProducer.publishUsageEvent()` calls `MeteringQueue.connect()` which attempts `nats.connect()` to `nats://metering-nats:4222`. This will throw on every usage emission. `UsageEmitter.emitUsage()` catches the error, logs it, and routes the event to an in-memory `failedEventsBuffer` (capped at 10,000 entries, process-scoped). The buffer is not drained automatically — `retryFailedEvents()` must be called explicitly. Under any real load the buffer fills, events are dropped with a `warn` log, and billing aggregation receives zero input. Revenue is silently unmetered from the first agent invocation.

### 2. RLS isolation unproven in CI — Probability: High × Impact: Critical

The `tenant-isolation-gate` CI job runs `describe.skipIf(!supabaseAvailable)`. `supabaseAvailable` is `true` only when `isRealIntegrationTestMode()` returns true AND `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are set. When those secrets are absent (which is the confirmed state for this environment), every RLS test in `tests/security/rls-tenant-isolation.test.ts`, `supabase-rls-policy-matrix.test.ts`, and `billing/__tests__/security/rls-policies.test.ts` is silently skipped. The CI gate passes green. The tenant isolation guarantee is backed by code review and static analysis only — not by execution against real Postgres RLS policies.

### 3. Cross-tenant LLM cache hits — Probability: Medium × Impact: High

`LLMCache` keys are `llm:cache:{model}:{sha256(prompt+model+options)}`. There is no tenant prefix. Two tenants submitting identical prompts to the same model receive the same cached response. For a B2B SaaS platform where prompts encode deal data, competitive intelligence, or financial models, this is a data confidentiality breach. The cache is Redis-backed and shared across all processes.

---

## CI/CD Trust Assessment

**Trust Level: Medium**

The CI pipeline is architecturally mature — 20+ gates, static tenant boundary guards, TypeScript ratchets, DAG acyclicity validation, OpenAPI structural checks, and a release manifest gate that requires a successful `release.yml` run before deploy. The `skip_tests` bypass in `deploy.yml` is blocked for production and requires an incident reference for staging. This is well-designed.

**Gaps:**

- **Tenant isolation gate passes on skipped tests.** `describe.skipIf(!supabaseAvailable)` means the gate is green whether tests ran or were skipped. There is no assertion that at least N tests executed. A CI run with zero RLS tests executed is indistinguishable from one with 100% passing.

- **Billing integration tests use an in-memory double by default.** `deterministicSupabaseAvailable = true` unconditionally, so `describe.skipIf(!deterministicSupabaseAvailable)` never skips. But `getTestSupabaseClient()` returns `createInMemorySupabaseClient()` when real credentials are absent. The in-memory double does not enforce RLS. Tests that assert cross-tenant isolation via `executeAsUser()` fall back to the service-role client path, which bypasses RLS entirely.

- **`WebhookService.processWebhook` is test-only.** The deprecated method uses an in-memory `Set` for idempotency and throws in production (`NODE_ENV !== 'test'`). The `webhook-idempotency.test.ts` suite tests this method, not the production `processEvent` path. Webhook idempotency unit tests do not exercise production code.

- **E2E coverage is narrow.** `e2e-critical` covers `auth-complete-flow.spec.ts` and `critical-user-flow.spec.ts` only. No billing E2E. No agent workflow E2E. No payment lifecycle E2E. A payment failure → grace period → restriction transition has never been exercised end-to-end in CI.

- **Coverage thresholds are aggregate, not path-specific.** 75% line / 70% branch coverage across the workspace does not guarantee any coverage of the billing aggregation path, the DAG executor, or the compensation handlers. A 0% coverage file is hidden by high-coverage files elsewhere.

- **Stripe failure tests exercise mock clients.** `stripe-failures.test.ts` tests a hand-rolled retry loop against `createMockStripeClient()`. The real `StripeService` has `maxNetworkRetries: 3` configured in the Stripe SDK — this is never tested.

---

## Tenant Isolation Assessment

**Status: Conditionally Enforced — Two Active Gaps**

The HTTP request path enforces isolation correctly. `tenantContextMiddleware` resolves tenant ID through a priority chain (TCT → service header → user claim → user lookup), validates tenant existence, verifies membership, and stores the resolved context in `AsyncLocalStorage`. `WorkflowExecutor.buildStageContext` calls `assertTenantContextMatch` at every stage boundary. The `service_role` client is scoped to `AuthService`, `TenantProvisioning`, and cron jobs per AGENTS.md policy.

**Risks:**

- **`LLMCache` has no tenant prefix.** Redis keys: `llm:cache:{model}:{hash(prompt)}`. All tenants share the same cache namespace. A cache hit for tenant B on a prompt first submitted by tenant A returns tenant A's response. This is not theoretical — it fires on any two tenants with overlapping prompts (e.g., standard onboarding questions, common financial modeling inputs).

- **`CacheService` falls back to `tenant:global:` when AsyncLocalStorage context is absent.** `tenantPrefix()` calls `tenantContextStorage.getStore()` and uses `ctx?.tid ?? "global"`. In BullMQ job processors, the AsyncLocalStorage context from the HTTP request is not propagated into the job execution context. Any `CacheService` call inside a worker job uses `tenant:global:` as the prefix, making all worker-scoped cache entries shared across tenants.

- **BullMQ workers do not restore tenant context from job payload.** `researchWorker` passes `tenantId` in the job payload and uses it for LLM calls (`secureLLMComplete` requires `tenantId`). However, it does not call `tenantContextStorage.run()` before processing. Any downstream service that reads from `AsyncLocalStorage` (CacheService, logger context, audit hooks) operates without tenant context.

- **`crmWorker` circuit breaker is in-memory and per-process.** The circuit breaker state (`circuitBreakers: Map<string, CircuitState>`) is not shared across worker replicas. A circuit that opens in replica 1 is invisible to replica 2. Under K8s with 2+ worker replicas, a failing CRM provider will not be circuit-broken consistently.

- **RLS enforcement is unproven against real Postgres policies** (see CI/CD section). The static guard `check-supabase-tenant-controls.mjs` and `check-permissive-rls.sh` run in CI, but these are static file checks, not live policy execution.

---

## Revenue Risk Assessment

**Status: Broken at the Queue Layer**

The full money flow is:

```
Agent invocation
  → UsageEmitter.emitUsage()
    → UsageQueueProducer.publishUsageEvent()   ← NATS not deployed: throws here
      → MeteringQueue.publish()
        → NATS JetStream stream
          → UsageQueueConsumerWorker
            → UsageLedgerIngestionService → usage_ledger
              → UsageAggregator → billing_aggregates
                → RatingEngine → InvoiceService
                  → Stripe invoice
                    → WebhookService (payment_succeeded)
                      → tenant enforcement state
```

**Risks:**

- **NATS not deployed → entire metering pipeline is non-functional.** `UsageEmitter` catches the NATS connection error and routes to `failedEventsBuffer` (in-memory, process-scoped, 10k cap). Events are not persisted to the DB on queue failure — the `usage_events` insert happens *after* the queue publish in the same try block, so a queue failure aborts both. Usage is lost silently. The billing aggregator worker (`billingAggregatorWorker.ts`) will crash on startup because `worker.start()` calls `MeteringQueue.subscribe()` which calls `connect()` which throws.

- **`resolveTenantId` silent null in `handlePaymentSucceeded`.** If `billing_customers` has no row for the Stripe customer ID (e.g., provisioning race, data migration gap), `resolveTenantId` returns `null`. The `if (tenantId)` guard silently skips the enforcement state update and the billing event emission. The invoice is marked paid in Stripe, but the tenant's `access_mode` remains whatever it was before. No alert fires. No log at `error` level — only `info` for the payment succeeded event.

- **`handleSubscriptionDeleted` TOCTOU window.** The method first updates `subscriptions.status = 'canceled'`, then queries `subscriptions` again to get `tenant_id` for the enforcement state update. Between the two queries, the row exists with `status = 'canceled'` but the enforcement state has not been updated. A concurrent request checking enforcement state sees the subscription as canceled but the tenant still in `full_access`. Window is milliseconds but non-zero.

- **`WebhookRetryService` calls `WebhookService.processEvent(event.payload)` directly.** `processEvent` is the correct production path (DB-backed idempotency via upsert). However, `WebhookRetryService` imports the default export (`webhookService` singleton) and calls `.processEvent()` on the raw payload from `webhook_events.payload` (type `unknown`). There is no re-validation of the payload shape before processing. A corrupted or truncated payload in the retry table will throw inside `processEvent`, increment `retry_count`, and eventually move to `webhook_dead_letter_queue` — but the error is not surfaced as a billing alert.

- **`UsageEmitter` in-memory DLQ is process-scoped.** `failedEventsBuffer` is a module-level array. A process restart (pod eviction, OOM, deploy) drops all buffered events. The durable path (`persistToDeadLetterTable`) is called, but only after the in-memory buffer is populated — if the DB insert also fails, events are gone.

- **Idempotency key derivation is deterministic but not enforced at the queue layer.** `UsageEmitter.deriveDeterministicIdempotencyKey` produces a SHA-256 of `tenantId:requestId:agentUuid:metric`. The NATS stream has a `duplicate_window` of 120 seconds. Events replayed after 120 seconds will be re-processed. `UsageLedgerIngestionService` uses `onConflict: 'tenant_id,request_id'` which provides DB-level deduplication, but `usage_events` uses `onConflict: 'tenant_id,idempotency_key'` — these are different keys. A replay after the NATS dedup window but within the DB constraint window is safe; a replay after both windows produces a duplicate ledger entry.

---

## Observability Assessment

**Status: Infrastructure Defined, Activation Unconfirmed**

Alert rules exist in `infra/k8s/monitoring/` for billing, agent fabric, SLO burn rates, and queue health. The billing aggregator worker has liveness/readiness probes on port 8082 wired in `billing-aggregator-worker-deployment.yaml`. OpenTelemetry SDK is bootstrapped in `server.ts`. This is a well-structured observability layer on paper.

**Blind spots:**

- **10% trace sampling in production.** `OTEL_TRACES_SAMPLER_ARG` defaults to `0.1` in production. 90% of requests produce no trace. A billing failure affecting 5% of tenants may produce zero traces. The sampler is `parentbased_traceidratio` — downstream spans inherit the parent decision, so a sampled request is fully traced, but an unsampled one is invisible end-to-end.

- **Alert rules reference metrics that may not be emitted.** `billing-alerts.yaml` references `billing_usage_records_unaggregated`, `billing_stripe_submission_errors_total`, `billing_webhook_retry_queue_size`, `billing_pending_aggregates_age_seconds`. None of these metric names appear in the backend source code. The Prometheus rules will never fire because the time series do not exist. The alert infrastructure is defined but not wired to actual instrumentation.

- **`agent_fabric_cost_usd_total` is emitted but the ROI alert fires on a ratio.** `AgentFabricLowROI` requires `agent_fabric_value_generated_usd_total` to be non-zero. If value generation metrics are not emitted (no confirmed emission site found in the codebase), the denominator is zero, `clamp_min` prevents division by zero, but the alert never fires meaningfully.

- **`CacheService` swallows Redis errors silently.** The constructor registers `this.redisClient.on("error", () => { /* swallow redis errors in tests */ })`. This comment says "in tests" but the code runs in production. A Redis connection failure produces no log, no metric, no alert. The cache silently degrades to the in-memory store, which has no TTL enforcement and no size limit.

- **`LLMCache` Redis errors return `null` silently.** The `get()` method catches all errors and returns `null`. A Redis outage causes every LLM call to be a cache miss, multiplying LLM costs by the cache hit rate. No alert fires. The `AgentFabricCostBurnRateHigh` alert would eventually fire, but only after sustained spend — not immediately on cache failure.

- **Billing worker health endpoint is defined but Prometheus scraping is not confirmed.** The K8s deployment exposes port 8082 with liveness/readiness probes. There is no `ServiceMonitor` or `PodMonitor` resource in `infra/k8s/monitoring/` that scrapes the billing worker's `/metrics` endpoint. Queue lag metrics from `billingAggregatorWorker` are not scraped.

- **No distributed trace correlation across NATS boundary.** `MeteringQueue.publish()` does not propagate OpenTelemetry trace context into NATS message headers. The trace for an agent invocation ends at the queue publish. The consumer-side processing (`UsageQueueConsumerWorker`) starts a new unlinked trace. Billing failures cannot be correlated back to the originating agent invocation.

---

## Failure Mode Analysis

### DAG stage failure → compensation

- **Trigger:** An agent stage throws or returns a non-`completed` status inside `WorkflowExecutor.executeDAGAsync`.
- **Execution path:** The stage result is marked `failed` in the local `failed` map. Remaining stages with unmet dependencies are also marked failed. `_updateStatus` sets the execution to `failed` in Supabase. The caller's `.catch` handler invokes `_handleWorkflowFailure`. Compensation is not automatically triggered from `executeDAGAsync` — `WorkflowCompensation.rollbackExecution` must be called explicitly by the caller.
- **Detection:** `logger.error('DAG execution failed', ...)` is emitted with an error summary. `value_loop_agent_invocations_total` counter is incremented. No dedicated alert rule fires on workflow failure count.
- **Outcome:** Workflow execution record is marked `failed`. Artifacts created by completed stages remain in the database. Downstream stages never run. The user sees a failed workflow with no automatic recovery.
- **Recovery:** Manual — operator must call `rollbackExecution` or re-trigger the workflow. No automatic compensation is initiated by the executor itself.

---

### NATS JetStream unavailable → metering pipeline failure

- **Trigger:** `UsageQueueProducer.publishUsageEvent()` is called while NATS is not deployed or unreachable.
- **Execution path:** `MeteringQueue.connect()` throws on `nats.connect()`. `UsageEmitter.emitUsage()` catches the error in the outer try/catch. The `usage_events` DB insert (which follows the queue publish in the same try block) is never reached. The event is routed to `failedEventsBuffer` (in-memory, 10k cap, process-scoped) and `persistToDeadLetterTable`. The billing aggregator worker crashes on startup because `MeteringQueue.subscribe()` also calls `connect()`.
- **Detection:** `logger.error('Error emitting usage', ...)` is emitted per event. No metric is incremented. No alert fires. The billing aggregator worker's liveness probe on port 8082 will fail, triggering a K8s pod restart loop — this is the only observable signal.
- **Outcome:** All usage events are silently lost or buffered in-memory. Billing aggregation receives zero input. Revenue is unmetered.
- **Recovery:** Deploy NATS JetStream. Drain `dead_letter_events` table via `retryFailedEvents()`. In-memory buffer contents are lost on process restart.

---

### `resolveTenantId` null → payment enforcement state not updated

- **Trigger:** `WebhookService.handlePaymentSucceeded` receives a `invoice.payment_succeeded` event for a Stripe customer ID that has no matching row in `billing_customers` (provisioning race, data migration gap, or manual Stripe customer creation).
- **Execution path:** `resolveTenantId(invoice.customer)` queries `billing_customers` and returns `null`. The `if (tenantId)` guard skips `setTenantEnforcementState` and `emitBillingEvent`. `markEventProcessed` is still called — the webhook is marked as successfully processed.
- **Detection:** `logger.info('Payment succeeded processed', ...)` is emitted at `info` level. No `error` or `warn` log. No metric increment. The event is permanently marked processed and will not be retried.
- **Outcome:** Stripe records the invoice as paid. The tenant's `access_mode` remains in its previous state (e.g., `grace_period` or `restricted`). The tenant has paid but cannot access the product.
- **Recovery:** Manual — operator must query `billing_customers` for the missing row, create it, and re-trigger enforcement state update via admin API or direct DB write.

---

### `CacheService` context loss → cross-tenant cache entries

- **Trigger:** Any `CacheService` method is called from a BullMQ job processor, NATS consumer, or cron job where `tenantContextStorage.getStore()` returns `undefined`.
- **Execution path:** `tenantPrefix()` evaluates `ctx?.tid ?? "global"` → returns `"global"`. The full cache key becomes `tenant:global:{namespace}:{key}`. All tenants' job-scoped cache writes land in the same namespace.
- **Detection:** No log, no metric, no error. The cache operates normally from its own perspective. Cross-tenant reads are silent.
- **Outcome:** A cache entry written by a job processing tenant A's data is readable by a job processing tenant B's data if the key matches. `CacheService.clear()` called in any worker context clears all tenants' entries under that namespace.
- **Recovery:** Add `tenantContextStorage.run(tctPayload, handler)` at the top of each worker job processor. Flush the Redis cache after deploying the fix to evict any cross-tenant entries.

---

### `WorkflowCompensation.rollbackExecution` timeout → partial rollback

- **Trigger:** A compensation handler for a workflow stage exceeds `ROLLBACK_TIMEOUT_MS = 5000ms` (e.g., a slow Supabase delete on a large artifact set, or a network timeout to an external system).
- **Execution path:** `executeWithTimeout(handler(compensationContext))` rejects after 5 seconds. The catch block sets `rollbackState.status = 'failed'` and `failed_stage` to the current stage ID. `persistRollbackState` writes the failed state to Supabase. `logRollbackEvent` emits a `stage_compensation_failed` event. If `policy === 'halt_on_error'`, rollback stops immediately — earlier stages are compensated, later stages are not.
- **Detection:** `logRollbackEvent` writes to `workflow_execution_logs`. No Prometheus metric is incremented for compensation failures. No alert rule in `infra/k8s/monitoring/` fires on rollback failures. The failure is only visible via direct DB query or log search.
- **Outcome:** Workflow state is partially rolled back. Artifacts from uncompensated stages remain in the database. The execution record shows `status = 'failed'` with `rollback_state.status = 'failed'` — but no automated notification reaches the on-call team.
- **Recovery:** Manual — operator must identify the failed stage from `workflow_execution_logs`, run the compensation handler manually, and update `rollback_state` to `completed`.

---

## Systemic Risks

### 1. AsyncLocalStorage context loss in background jobs

`CacheService`, structured logging (`tenantId` in log context), audit hooks, and any service that reads `tenantContextStorage.getStore()` all silently degrade when called outside an HTTP request context. BullMQ job processors, NATS consumers, and cron jobs do not restore the AsyncLocalStorage context from job payloads. This is not a single bug — it is a pattern that affects every background processing path. The fix requires a convention: every worker job processor must call `tenantContextStorage.run(payload.tenantContext, handler)` before any service call.

### 2. Test doubles masking real integration failures

Three independent test suites use in-memory or mock backends that do not enforce the same invariants as production:
- RLS tests skip against real Postgres when secrets are absent
- Billing integration tests use `createInMemorySupabaseClient()` which does not enforce RLS
- Stripe failure tests exercise a mock client, not the real SDK retry path

The pattern is: a test suite exists, CI passes, but the test does not exercise the production code path. This creates false confidence. The fix is not more tests — it is making the existing tests fail loudly when they cannot run against real infrastructure, rather than silently skipping.

### 3. Silent null returns on missing data

Three independent services return `null` or degrade silently when expected data is absent:
- `WebhookService.resolveTenantId()` returns `null` → enforcement state update skipped, no error log
- `CacheService.get()` returns `null` on Redis error → silent cache miss, no metric
- `LLMCache.get()` returns `null` on Redis error → silent cache miss, no metric

The pattern is: a missing dependency or missing data causes a silent no-op rather than a logged error or circuit break. Under production load, these silent failures accumulate invisibly until a downstream symptom (unpaid invoice, cost spike, tenant locked out) surfaces the root cause.

### 4. Infrastructure defined but not deployed

NATS JetStream, the Prometheus scraping configuration for the billing worker, and the OpenTelemetry collector endpoint are all defined in `infra/k8s/` manifests but their deployment status is unconfirmed. The K8s manifests are correct and production-grade. The risk is that the manifests exist in the repo but have not been applied to the target cluster. There is no CI gate that validates live cluster state against the manifests.

---

## Required Conditions Before Ship

- [ ] **Deploy NATS JetStream (metering-nats StatefulSet) and confirm end-to-end metering pipeline**
  - Why it matters: Every agent invocation emits usage via NATS. Without it, billing aggregation receives zero input. Revenue is unmetered from day one.
  - What breaks if ignored: Silent revenue loss. No invoice line items for agent usage. Billing aggregator worker crashes on startup.
  - Effort: Low — K8s manifest exists (`infra/k8s/base/nats-jetstream.yaml`). Apply and smoke-test.

- [ ] **Add tenant prefix to LLMCache Redis keys**
  - Why it matters: Cross-tenant cache hits return one tenant's LLM response to another tenant. For a B2B platform encoding deal data in prompts, this is a data breach.
  - What breaks if ignored: Tenant A's financial model output served to Tenant B on cache hit.
  - Effort: Low — change key format in `LLMCache.generateCacheKey()` from `llm:cache:{model}:{hash}` to `llm:cache:{tenantId}:{model}:{hash}`. Requires `tenantId` to be passed into `LLMCache.get/set` — thread from caller.

- [ ] **Confirm tenant-isolation-gate runs against a real Supabase instance**
  - Why it matters: All RLS tests skip silently when `SUPABASE_URL` is absent. CI passes green with zero RLS coverage. The isolation guarantee is unproven.
  - What breaks if ignored: A missing or misconfigured RLS policy ships to production undetected. Cross-tenant data access becomes possible at the DB layer.
  - Effort: Medium — add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to GitHub Actions secrets for the `tenant-isolation-gate` job. Add a guard that fails the job if 0 tests ran.

- [ ] **Restore tenant context in BullMQ job processors**
  - Why it matters: `CacheService`, logging, and audit hooks read `AsyncLocalStorage`. Without context restoration, all worker-scoped cache entries use `tenant:global:` prefix.
  - What breaks if ignored: Cache entries from worker jobs are shared across all tenants. Audit logs from workers have no `tenant_id`. `CacheService.clear()` in a worker clears all tenants' cache entries.
  - Effort: Low-Medium — add `tenantContextStorage.run(tctPayload, handler)` at the top of each BullMQ job processor. Requires `tenantContext` to be serialized into job payload at enqueue time.

- [x] **Wire billing alert metrics to actual instrumentation** ✅ Resolved 2026-04-08
  - Resolution evidence: CI contract check now parses `infra/k8s/monitoring/billing-alerts.yaml` and `packages/backend/src/metrics/billingMetrics.ts`, and fails when an alert references a non-existent metric (`scripts/ci/check-infra-readiness-contract.mjs`, commit `61f976a`, validated on `2026-04-08`).
  - Why it mattered: `billing-alerts.yaml` references metric names (`billing_usage_records_unaggregated`, `billing_stripe_submission_errors_total`, etc.) that must exist in backend instrumentation, otherwise alerts are silent.
  - Prior risk if ignored: A billing pipeline failure could produce no alert; on-call would get no signal until customer impact.

- [ ] **Add a minimum-test-count assertion to the tenant-isolation-gate job**
  - Why it matters: A job that passes because all tests were skipped is indistinguishable from one that passed because all tests ran and passed.
  - What breaks if ignored: A future change that breaks the Supabase secret configuration causes all RLS tests to silently skip, and the gate continues to pass.
  - Effort: Low — add a step after the vitest run that reads the JUnit XML output and fails if total test count < expected minimum (e.g., 20).

- [ ] **Fix `resolveTenantId` silent skip in `handlePaymentSucceeded`**
  - Why it matters: If `billing_customers` has no row for a Stripe customer ID, the payment event is silently dropped. The tenant's `access_mode` is not updated.
  - What breaks if ignored: A tenant pays successfully but remains in `grace_period` or `restricted` state. They cannot access the product despite having paid.
  - Effort: Low — add `logger.error()` and a metric increment when `resolveTenantId` returns `null`. Consider throwing to trigger the webhook retry path rather than silently continuing.

- [ ] **Confirm OpenTelemetry collector is deployed and receiving traces in staging**
  - Why it matters: `tracing.ts` exports to `http://otel-collector:4318`. If the collector is not deployed, all traces are silently dropped. At 10% sampling, debugging production issues without traces is extremely difficult.
  - What breaks if ignored: No distributed tracing in production. Incident response relies entirely on logs and metrics.
  - Effort: Low — deploy `otel-collector` (or configure `OTEL_EXPORTER_OTLP_ENDPOINT` to a managed collector). Verify with a test trace.

---

## Confidence Score

**2.5 / 5**

The codebase is architecturally well-designed. The patterns are correct: saga compensation, DB-backed webhook idempotency, TCT-based tenant context, circuit breakers, structured logging. The engineering quality is high.

The score is 2.5 because confidence in a production sign-off requires evidence of correct behavior under real conditions, not just correct code. What is missing:

- The metering pipeline has never run end-to-end (NATS not deployed)
- The RLS policies have never been tested against real Postgres
- Billing alert correctness is now contract-gated in CI; remaining observability risk is deployment/runtime verification in staging
- The LLM cache has a confirmed cross-tenant data path
- 90% of production traces will be invisible at the default sample rate

Each of these is fixable in 1–5 days of engineering effort. None requires architectural change. The score would move to 4/5 after the seven conditions above are satisfied and verified in staging.

---

*Review philosophy applied: tests were assumed to lie until execution against real infrastructure was confirmed. Failure paths were preferred over happy paths. Silent failures were weighted more heavily than loud crashes.*
