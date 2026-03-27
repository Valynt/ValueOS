# Billing Risk Remediation Spec

**Status:** Draft  
**Risk level:** High  
**Scope:** Three confirmed production risks in the revenue/billing pipeline

---

## Problem Statement

Three independent failure modes in the billing pipeline can cause silent revenue loss, duplicate charges, or tenant fairness violations in a multi-pod Kubernetes deployment:

1. **In-memory rate limiting** — `UsageMeteringService.ts` uses a `static Map` for per-tenant rate limiting. Each pod maintains independent state, so a tenant can exceed global limits by a factor of N pods. The code itself contains a comment acknowledging this: `// for demo; use Redis in prod`.

2. **Webhook DLQ reliability** — `WebhookRetryService.processRetries()` is invoked exclusively by a Kubernetes CronJob every 5 minutes. If the CronJob pod fails to start (image pull error, resource exhaustion, node pressure), failed webhooks are never retried. There is no alerting on DLQ growth rate or retry exhaustion. The `UsageAggregationJobFailing` Prometheus alert is a known active issue.

3. **Idempotency race in aggregation** — `UsageAggregator.ts` generates `idempotency_key` as `aggregate_{tenantId}_{metric}_{periodStart}_{periodEnd}_{sourceHash[0:8]}`. The `sourceHash` is a SHA-256 of the sorted event set. If two concurrent aggregation runs observe overlapping but non-identical event sets (e.g., new events arrive mid-aggregation), each computes a different deterministic key and both can proceed to call Stripe. The DB unique constraint on `idempotency_key` catches the DB insert race but does not prevent the Stripe call from firing twice.

---

## Current State

| Component | File | Current behavior | Risk |
|---|---|---|---|
| Inbound rate limiting | `UsageMeteringService.ts` | `static Map<string, number>` per pod | Per-pod, not global |
| Batch loop rate limiting | `UsageMeteringService.ts` | None | Unbounded drain loop |
| Stripe call rate limiting | `UsageMeteringService.ts` | None | Stripe API abuse on burst |
| Webhook retry trigger | `WebhookRetryService.ts` + `infra/k8s/cronjobs/webhook-retry.yaml` | CronJob every 5 min | Silent failure if CronJob dies |
| Webhook DLQ alerting | `infra/k8s/monitoring/billing-alerts.yaml` | `UsageAggregationJobFailing` alert exists | No DLQ depth or age alert |
| Aggregation concurrency | `UsageAggregator.ts` | No lock on tenant+metric+period | Race produces duplicate Stripe calls |
| Pre-Stripe validation | `UsageMeteringService.ts` | None | No guard before Stripe call |
| Unit tests | `__tests__/UsageMeteringService.test.ts` | Tautological — no mocks, no assertions | No behavioral coverage |

---

## Requirements

### Risk 1: Distributed Rate Limiting (REQ-R1)

**REQ-R1a — Inbound event rate limiting (per-tenant, Redis-backed)**  
Replace the `static Map` in `UsageMeteringService.ts` with a Redis-backed rate limiter using the existing `getRedisClient()` infrastructure. The limiter must:
- Be keyed per tenant: `rate:inbound:{tenantId}`
- Use a sliding window or token bucket (consistent with `redisRateLimiter.ts` Lua pattern)
- Enforce a configurable per-tenant inbound event rate (default: 1000 events/min)
- Return a structured `RateLimitResult` with `allowed`, `remaining`, `resetAt`
- Fail open (allow) on Redis unavailability, log a warning, and increment a `billing_rate_limit_redis_unavailable_total` counter

**REQ-R1b — Batch loop / aggregate submission rate limiting (per-worker)**  
Add a concurrency/rate guard on `submitPendingAggregates()`:
- Limit concurrent aggregate submissions per worker instance using a Redis-backed semaphore or token bucket keyed `rate:batch:{workerId}`
- Default: max 10 concurrent Stripe submissions per worker
- Prevents the drain loop from starving other workers or thrashing Postgres under partial outage

**REQ-R1c — Outbound Stripe call rate limiting (global)**  
Add a global token bucket for Stripe API calls:
- Key: `rate:stripe:global`
- Default: 80 req/s (Stripe's documented limit is 100/s; leave 20% headroom)
- On rate limit hit: back off with exponential jitter, do not drop — re-queue the aggregate
- Emit `billing_stripe_rate_limited_total` counter on each throttle event

### Risk 2: Webhook DLQ Reliability (REQ-R2)

**REQ-R2a — Migrate webhook retry to BullMQ**  
Replace the CronJob-triggered `WebhookRetryService.processRetries()` with a BullMQ queue:
- Queue name: `webhook-retry`
- On webhook delivery failure: enqueue a job with the webhook event payload, tenant ID, attempt count, and next retry timestamp
- Retry schedule: exponential backoff matching the existing `WebhookRetryService` schedule (1 min, 5 min, 15 min, 1 hr, 6 hr)
- Max attempts: 5 (matching current `max_retries` column)
- On exhaustion: mark the event `failed` in DB, emit `billing_webhook_exhausted_total` counter
- Idempotency: job ID = `webhook:{eventId}:{attemptNumber}` to prevent duplicate enqueue on worker restart

**REQ-R2b — DLQ alerting**  
Add Prometheus alerts to `infra/k8s/monitoring/billing-alerts.yaml`:
- `BillingWebhookDLQDepth`: alert when `webhook_retry_queue_depth > 50` for 5 minutes
- `BillingWebhookRetryExhausted`: alert when `billing_webhook_exhausted_total` rate > 0 over 10 minutes
- `BillingWebhookOldestJobAge`: alert when oldest unprocessed webhook job age > 30 minutes
- Severity: `critical` for exhaustion, `warning` for depth/age

**REQ-R2c — Retire the CronJob**  
Remove or disable `infra/k8s/cronjobs/webhook-retry.yaml` once the BullMQ worker is deployed. Keep the CronJob manifest in a `deprecated/` directory with a comment until the BullMQ path is confirmed stable in production.

### Risk 3: Aggregation Idempotency (REQ-R3)

**REQ-R3a — Postgres advisory lock on aggregation**  
Wrap the aggregation run in `UsageAggregator.ts` with a Postgres advisory lock scoped to `(tenantId, metric, billingPeriod)`:
- Use `pg_try_advisory_xact_lock(hashtext(lockKey))` inside the aggregation transaction
- If the lock cannot be acquired, log and return early (another worker is already aggregating this window)
- Lock key format: `agg:{tenantId}:{metric}:{periodStart}:{periodEnd}`
- This prevents two concurrent workers from observing overlapping event sets and generating different idempotency keys

**REQ-R3b — Pre-Stripe submission validation**  
Before calling `stripe.billing.meterEvents.create()` in `UsageMeteringService.ts`, query the DB for an existing aggregate with:
- Same `tenant_id`, `metric`, `period_start`, `period_end`
- `status = 'submitted'` or `status = 'pending'`
- If found: skip the Stripe call, log a warning, emit `billing_duplicate_submission_prevented_total`
- If not found: proceed with Stripe call, then atomically update aggregate status to `submitted`

**REQ-R3c — Harden idempotency key generation**  
The current `sourceHash.substring(0, 8)` truncation reduces collision resistance. Change to:
- Use the full 16-character hex prefix (64 bits) instead of 8 characters
- Add the event count to the key: `aggregate_{tenantId}_{metric}_{periodStart}_{periodEnd}_{eventCount}_{sourceHash[0:16]}`
- This makes accidental key collisions between different event sets astronomically unlikely

### Testing (REQ-T)

**REQ-T1 — Unit tests for rate limiting**  
In `__tests__/UsageMeteringService.test.ts`, replace tautological tests with:
- Rate limit allow path: mock Redis returns `allowed: true`, assert Stripe call proceeds
- Rate limit deny path: mock Redis returns `allowed: false`, assert Stripe call is not made and event is re-queued
- Redis unavailability: mock Redis throws, assert fail-open behavior and counter increment
- Stripe rate limit: mock Stripe returns 429, assert exponential backoff and re-queue

**REQ-T2 — Unit tests for idempotency**  
Extend `__tests__/resiliency/usage-idempotency.test.ts`:
- Advisory lock acquired: assert aggregation proceeds
- Advisory lock not acquired (concurrent run): assert early return, no Stripe call
- Pre-Stripe validation finds existing submitted aggregate: assert skip + counter increment
- Pre-Stripe validation finds no existing aggregate: assert Stripe call proceeds

**REQ-T3 — Integration tests for the full pipeline**  
Add `__tests__/integration/metering-pipeline.test.ts`:
- Ingest → aggregate → submit flow with real Supabase (test DB) and mocked Stripe
- Concurrent aggregation of overlapping event sets: assert exactly one Stripe call
- Webhook delivery failure → BullMQ retry → eventual success: assert idempotent delivery
- Webhook retry exhaustion: assert DB status = `failed` and counter increment

---

## Acceptance Criteria

| Requirement | Acceptance criteria | Evidence |
|---|---|---|
| REQ-R1a | Per-tenant inbound rate enforced globally across pods | Unit test: two pods sharing Redis both see the same counter |
| REQ-R1b | Batch loop bounded to 10 concurrent Stripe submissions | Unit test: 11th submission is queued, not dropped |
| REQ-R1c | Stripe calls throttled at 80 req/s globally | Unit test: 81st call in 1s is deferred with backoff |
| REQ-R2a | Webhook retry survives CronJob pod failure | Integration test: enqueue job, kill worker, restart, assert delivery |
| REQ-R2b | DLQ depth alert fires within 5 min of 50+ stuck jobs | Prometheus alert rule unit test |
| REQ-R2c | CronJob manifest deprecated | `infra/k8s/cronjobs/deprecated/webhook-retry.yaml` exists |
| REQ-R3a | Concurrent aggregation runs for same window produce exactly one Stripe call | Integration test: two concurrent `aggregateAndSubmit()` calls |
| REQ-R3b | Pre-Stripe check prevents duplicate submission on retry | Unit test: existing `submitted` aggregate → no Stripe call |
| REQ-R3c | Idempotency key uses 16-char hash prefix + event count | Unit test: key format assertion |
| REQ-T1 | Rate limiter unit tests pass | CI green |
| REQ-T2 | Idempotency unit tests pass | CI green |
| REQ-T3 | Integration pipeline tests pass | CI green |

---

## Implementation Approach

Steps are ordered by blast radius — highest risk first.

### Step 1 — Postgres advisory lock on aggregation (REQ-R3a)

Modify `UsageAggregator.ts`:
- Add `acquireAggregationLock(tenantId, metric, periodStart, periodEnd)` helper using `pg_try_advisory_xact_lock`
- Wrap `aggregateEvents()` body in lock acquisition; return `{ skipped: true }` if lock not acquired
- Add unit test: concurrent calls with same lock key → exactly one proceeds

### Step 2 — Pre-Stripe submission validation (REQ-R3b)

Modify `UsageMeteringService.ts`:
- Add `checkExistingSubmission(tenantId, metric, periodStart, periodEnd)` query before Stripe call
- On hit: log, increment counter, return early
- On miss: proceed, then atomically set `status = 'submitted'`
- Add unit test for both paths

### Step 3 — Harden idempotency key (REQ-R3c)

Modify `UsageAggregator.ts`:
- Change key format to include event count and 16-char hash prefix
- Add unit test asserting key format and uniqueness across different event sets

### Step 4 — Redis-backed inbound rate limiting (REQ-R1a)

Modify `UsageMeteringService.ts`:
- Remove `static Map<string, number> tenantQueryCosts`
- Add `checkInboundRateLimit(tenantId)` using `getRedisClient()` with Lua sliding window
- Wire fail-open path with counter
- Add unit tests for allow, deny, and Redis-unavailable paths

### Step 5 — Batch loop and Stripe outbound rate limiting (REQ-R1b, REQ-R1c)

Modify `UsageMeteringService.ts`:
- Add Redis semaphore for `submitPendingAggregates()` concurrency
- Add global Stripe token bucket with exponential jitter backoff
- Add unit tests for throttle and backoff paths

### Step 6 — Migrate webhook retry to BullMQ (REQ-R2a)

- Create `packages/backend/src/workers/WebhookRetryWorker.ts` following the pattern of `researchWorker.ts`
- Modify `WebhookRetryService.ts`: on delivery failure, enqueue to BullMQ instead of writing directly to DLQ table
- Register worker in `workerMain.ts`
- Add integration test for retry-on-failure and exhaustion paths

### Step 7 — DLQ alerting (REQ-R2b)

- Add three alert rules to `infra/k8s/monitoring/billing-alerts.yaml`
- Add corresponding recording rules for queue depth and job age metrics
- Add Prometheus alert rule unit test

### Step 8 — Deprecate CronJob (REQ-R2c)

- Move `infra/k8s/cronjobs/webhook-retry.yaml` to `infra/k8s/cronjobs/deprecated/`
- Add deprecation comment referencing the BullMQ worker

### Step 9 — Integration tests (REQ-T3)

- Create `packages/backend/src/services/billing/__tests__/integration/metering-pipeline.test.ts`
- Cover: full ingest→aggregate→submit flow, concurrent aggregation, webhook retry lifecycle

---

## Files to Create / Modify

| File | Action | Requirement |
|---|---|---|
| `packages/backend/src/services/billing/UsageMeteringService.ts` | Modify — replace Map, add Redis rate limits, add pre-Stripe check | REQ-R1a, R1b, R1c, R3b |
| `packages/backend/src/services/metering/UsageAggregator.ts` | Modify — add advisory lock, harden idempotency key | REQ-R3a, R3c |
| `packages/backend/src/workers/WebhookRetryWorker.ts` | Create | REQ-R2a |
| `packages/backend/src/services/billing/WebhookRetryService.ts` | Modify — enqueue to BullMQ on failure | REQ-R2a |
| `packages/backend/src/workers/workerMain.ts` | Modify — register WebhookRetryWorker | REQ-R2a |
| `infra/k8s/monitoring/billing-alerts.yaml` | Modify — add DLQ alerts | REQ-R2b |
| `infra/k8s/cronjobs/webhook-retry.yaml` | Move to `deprecated/` | REQ-R2c |
| `packages/backend/src/services/billing/__tests__/UsageMeteringService.test.ts` | Rewrite — real unit tests | REQ-T1 |
| `packages/backend/src/services/billing/__tests__/resiliency/usage-idempotency.test.ts` | Extend | REQ-T2 |
| `packages/backend/src/services/billing/__tests__/integration/metering-pipeline.test.ts` | Create | REQ-T3 |
