# ValueOS Production Readiness — Sprint Plan Spec

## Problem Statement

ValueOS has four categories of production risk that must be closed before the system can be considered production-ready:

1. **Billing correctness** — Stripe webhook processing has idempotency gaps, no durable large-payload storage, and no Stripe↔DB reconciliation. Silent revenue loss is possible.
2. **Tenant isolation** — RLS coverage and middleware hardening are partially implemented but not fully audited or CI-enforced against all tables and edge cases.
3. **Distributed correctness** — Several services fall back to in-memory state when Redis is unavailable, which is unsafe in multi-pod production. Startup validation is incomplete.
4. **CI/CD trust** — Some gates are advisory rather than enforced. TypeScript debt, E2E flake, and security CVE handling need tightening.

**Approach:** Full re-audit of each area against acceptance criteria. Spec only the delta — what is missing, incomplete, or not meeting the stated acceptance criteria — with explicit references to existing code.

---

## Codebase Baseline (Audit Findings)

Before speccing work, the following items were audited against their acceptance criteria:

### Already implemented (verify correctness, do not re-implement)
- `WebhookRetryWorker.ts` — BullMQ queue, exponential backoff (1m→5m→15m→1h→6h), max 5 attempts, deterministic job IDs for dedup, DLQ via `failed` status in DB. **Gap:** no observable DLQ dashboard/replay API; exhausted jobs are marked failed but not replayable without manual DB intervention.
- `tenantContextMiddleware.ts` — 4-source resolution chain (TCT JWT → service header → user claim → user lookup), fail-closed conflict detection, audit logging on every resolution. **Gap:** `user-lookup` (source 4) is a DB call on every unauthenticated request; no explicit test for the "all sources conflict" scenario.
- `CacheService.ts` — Redis backend with Lua atomic get/set/del, versioned namespace invalidation, in-memory fallback. **Gap:** fallback is silent in production; no startup enforcement that Redis is present when `NODE_ENV=production`.
- `20260922000000_rls_gap_remediation.sql` — covers `llm_calls`, `memberships`, `login_attempts`, and 13 other tables. **Gap:** no CI check that prevents new tables from being added without RLS; partition tables and archive tables not confirmed covered.
- Docker Compose (`ops/compose/compose.yml`) — Redis and NATS already present. **Gap:** no NATS in the infra profile used by the dev container by default.
- `pr-fast.yml` — RLS test gate (≥10 tests), flake-gate, Trivy/pnpm audit at `high` threshold, TypeScript ratchet. **Gap:** `skip_tests` is blocked for production but allowed for non-production with evidence fields — this is acceptable per the existing break-glass design.

### Not yet implemented
- DB `UNIQUE` constraint on `stripe_event_id` (migration needed; `ignoreDuplicates: true` is application-level only)
- Durable raw webhook payload storage (no oversized payload path exists)
- Stripe↔DB reconciliation job
- `webhooks_received_total`, `webhooks_processed_total`, `webhook_dlq_size` Prometheus metrics with alerts
- CI gate blocking new tables without RLS
- Redis/NATS startup validation (fail-fast in production)
- Workflow watchdog for stuck agent executions
- Integration tests: webhook→aggregation→Stripe flow end-to-end; tenant isolation end-to-end

---

## Sprint 1 — Billing Correctness (P0)

### 1.1 Webhook Idempotency — DB Constraint

**Current state:** `WebhookService.ts` uses `onConflict: "stripe_event_id", ignoreDuplicates: true`. This is application-level dedup only. If the DB constraint does not exist, concurrent inserts can both succeed before either reads the other.

**Work:**
- Add migration: `ALTER TABLE webhook_events ADD CONSTRAINT webhook_events_stripe_event_id_unique UNIQUE (stripe_event_id);`
- Audit `WebhookService.processEvent()`: replace `ignoreDuplicates: true` with explicit conflict handling — on conflict, log and return early with a structured result (not silently drop).
- Add concurrency test: two simultaneous calls with the same `stripe_event_id` → exactly one processes, one returns duplicate-detected result.

**Acceptance criteria:**
- DB enforces uniqueness at the constraint level, not only application level.
- Duplicate webhook → no duplicate processing, no dropped events.
- Concurrent duplicate → deterministic outcome, both callers get a result.

---

### 1.2 Durable Webhook Payload Storage

**Current state:** No oversized payload path exists. Raw payloads are not persisted separately from the event record.

**Work:**
- Audit whether any object storage abstraction exists in the repo (search for Supabase Storage client usage, S3 SDK, or storage service).
- If an abstraction exists: extend it for webhook payload archival.
- If not: implement a `WebhookPayloadStore` using **Supabase Storage** (not raw S3 — no AWS dependency exists in the stack).
- Logic: if raw payload size > 256kb, store in Supabase Storage bucket `webhook-payloads/{event_id}`; store the object path in `webhook_events.payload_ref`; DB column stores pointer, not raw payload.
- If payload ≤ 256kb: store inline in existing `webhook_events.raw_payload` column (add column if missing).
- Add migration for `payload_ref` column on `webhook_events`.

**Acceptance criteria:**
- No webhook rejected due to payload size.
- All events auditable: either inline payload or pointer to stored object.
- Supabase Storage bucket has RLS: only `service_role` can read/write.

---

### 1.3 DLQ Observability + Replay

**Current state:** `WebhookRetryWorker.ts` exists with BullMQ, backoff, and exhaustion handling. Exhausted jobs are marked `failed` in DB. **Gap:** no replay API, no DLQ size metric, no way to inspect or requeue failed jobs without direct DB/Redis access.

**Work:**
- Add `GET /internal/billing/dlq` endpoint (service-role only): returns count and list of `webhook_events` with `status = 'failed'`.
- Add `POST /internal/billing/dlq/:eventId/replay` endpoint: re-enqueues the event into `webhook-retry` BullMQ queue, resets status to `pending`.
- Add `webhook_dlq_size` Prometheus gauge: updated on worker `failed` event and on replay.
- Verify `removeOnFail: { age: 30 * 86400 }` is sufficient for audit retention; document in code.

**Acceptance criteria:**
- Failed jobs visible via API without direct Redis/DB access.
- Replay re-enqueues and processes correctly.
- DLQ size is a Prometheus gauge, not just a log line.

---

### 1.4 Stripe↔DB Reconciliation Job

**Current state:** No reconciliation job exists.

**Work:**
- Implement `StripeReconciliationWorker.ts` in `packages/backend/src/workers/`.
- Use BullMQ repeatable job: schedule every 6 hours (configurable via env `RECONCILIATION_INTERVAL_HOURS`).
- Job logic per tenant:
  1. Fetch Stripe events from the last N hours (configurable window, default 24h) via `stripe.events.list`.
  2. Query `webhook_events` for the same time window and tenant.
  3. Diff: events in Stripe not in DB → backfill by re-processing via `WebhookService.processEvent()`.
  4. Emit `webhook_reconciliation_drift_count` metric with tenant label.
- Job must be idempotent: re-running for the same window produces no duplicate records (relies on 1.1 constraint).
- Register in `workerMain.ts`.
- Add `webhook_reconciliation_runs_total` and `webhook_reconciliation_failures_total` Prometheus counters.

**Acceptance criteria:**
- Drift detection works: missing events are detected and backfilled.
- Job is idempotent.
- Metrics emitted on every run.
- Job failure does not crash the worker process.

---

### 1.5 Webhook Reliability Metrics + Alerts

**Current state:** `billingMetrics.ts` uses `prom-client`. Some counters exist (`recordStripeWebhook`, `billingWebhookExhaustedTotal`). **Gap:** no `webhooks_received_total`, no `webhooks_processed_total` as distinct counters, no alert rules.

**Work:**
- Add to `billingMetrics.ts`:
  - `webhooks_received_total` — counter, label: `event_type`
  - `webhooks_processed_total` — counter, labels: `event_type`, `status` (success|duplicate|failed)
  - `webhook_dlq_size` — gauge (from 1.3)
  - `webhook_processing_failures_total` — counter, label: `event_type`
  - `webhook_reconciliation_runs_total` — counter
  - `webhook_reconciliation_drift_count` — gauge, label: `tenant_id`
- Instrument `WebhookService.processEvent()` to increment `webhooks_received_total` on entry and `webhooks_processed_total` on exit.
- Add Prometheus alert rules (in `infra/` or `ops/` — match existing alert rule location):
  - `WebhookProcessingDrift`: `rate(webhooks_processed_total[5m]) / rate(webhooks_received_total[5m]) < 0.95` for 10 minutes.
  - `WebhookDLQGrowing`: `webhook_dlq_size > 10` for 15 minutes.
  - `ReconciliationJobFailing`: `increase(webhook_reconciliation_failures_total[1h]) > 0`.
  - `ReconciliationDriftDetected`: `webhook_reconciliation_drift_count > 0`.

**Acceptance criteria:**
- All six metrics present in `/metrics` endpoint.
- Alert rules exist in infra config (not just code comments).
- Silent loss becomes detectable within one alert window.

---

## Sprint 2 — Tenant Isolation (P0)

### 2.1 RLS Full Audit

**Current state:** `20260922000000_rls_gap_remediation.sql` addressed 16 tables. **Gap:** no authoritative list of all tables; partition tables and archive tables not confirmed; no ongoing enforcement.

**Work:**
- Generate current table list from DB schema snapshot (`docs/db/schema_snapshot.sql` or live DB).
- For each table: confirm `ENABLE ROW LEVEL SECURITY` is present AND at least one policy exists.
- Classify each table: `tenant_scoped`, `service_only`, `own_row`, or `explicitly_exempt` (with documented justification).
- Write findings to `docs/db/rls-coverage-audit.md` — one row per table, classification, policy name, justification if exempt.
- For any table missing RLS: write a migration.
- Confirm partition tables (`secret_audit_logs_2024/2025/2026/default`) inherit parent RLS or have their own policies.

**Acceptance criteria:**
- 100% of tables are either RLS-covered or explicitly documented as exempt with justification.
- No cross-tenant query possible via `authenticated` role.
- Audit doc exists and is current.

---

### 2.2 CI Gate for RLS

**Current state:** `scripts/ci/check-permissive-rls.sh` and `check-migration-rls-required.sh` exist in `pr-fast.yml`. **Gap:** these check for permissive policies but may not block new tables added without any RLS.

**Work:**
- Audit `check-migration-rls-required.sh`: confirm it fails CI if a migration adds a `CREATE TABLE` without a corresponding `ENABLE ROW LEVEL SECURITY`.
- If the check is incomplete: extend it to parse migration SQL for `CREATE TABLE` statements and require a matching `ENABLE ROW LEVEL SECURITY` in the same migration file.
- Extend to cover `CREATE TABLE ... PARTITION OF` (partition tables).
- Add test: a migration with `CREATE TABLE` but no RLS → CI fails.

**Acceptance criteria:**
- Cannot merge a migration that adds a table without RLS.
- Partition tables are covered by the check.
- CI failure message is actionable (names the table missing RLS).

---

### 2.3 tenantContextMiddleware — Audit Against Acceptance Criteria

**Current state:** Middleware is largely hardened. **Gap:** `user-lookup` (source 4) fires a DB query on every request where sources 1–3 fail; no test for the scenario where all sources conflict simultaneously.

**Work:**
- Audit source 4 (`user-lookup`): confirm it is only reached when the user is authenticated but has no tenant claim. Add a log warning when source 4 is used (it should be rare in production).
- Add test: authenticated user with no JWT tenant claim → source 4 fires, tenant resolved correctly.
- Add test: TCT JWT `tid` conflicts with user JWT claim → 403 returned.
- Add test: service header present but `serviceIdentityVerified = false` → 403 returned.
- Confirm `tenantSource` is always logged on resolution (it is, per current code — verify no code path skips it).

**Acceptance criteria:**
- All four resolution sources have test coverage.
- Conflict between any two sources → 403, logged.
- Source 4 usage is logged as a warning (signals misconfigured client).

---

### 2.4 Fail-Closed Conflict Handling — Verify Coverage

**Current state:** Conflict detection exists for TCT↔existing tenant and TCT↔user identity. Universal claim↔resolved conflict check exists. **Gap:** verify the "all sources agree but tenant does not exist" path is covered.

**Work:**
- Audit `verifyTenantExists` call: confirm it is reached for all resolution paths, not only TCT.
- Add test: resolved tenant ID is valid UUID format but does not exist in DB → 404 returned.
- Add test: resolved tenant ID exists but is archived/inactive → 404 returned.

**Acceptance criteria:**
- Spoof attempts (valid-looking but non-existent tenant) fail with 404.
- Inactive tenant → 404, not 200.

---

### 2.5 Security Tests — Cross-Tenant Attack Paths

**Current state:** Some tenant isolation tests exist. **Gap:** no consolidated test suite covering all attack vectors listed in the sprint plan.

**Work:**
- Add/extend tests in `packages/backend/src/__tests__/` or `tests/security/`:
  - Cross-tenant data access: authenticated as tenant A, request data belonging to tenant B → 403/404.
  - Spoofed `x-tenant-id` header without `serviceIdentityVerified` → 403.
  - Spoofed `x-tenant-context` JWT with wrong secret → 401.
  - Middleware bypass: request with no auth, no tenant headers, `enforce=true` → 403.
  - TCT with mismatched `sub` (user ID) → 403.
- These tests must run in `pr-fast.yml` RLS/security lane (already wired for `tests/security/`).

**Acceptance criteria:**
- All five attack paths have automated test coverage.
- Tests run in CI and are blocking (not advisory).

---

## Sprint 3 — Distributed Correctness (P1)

### 3.1 CacheService — Production Redis Enforcement

**Current state:** `CacheService.ts` has Redis backend with Lua scripts and in-memory fallback. **Gap:** fallback is silent in production; no enforcement that Redis is required when `NODE_ENV=production`.

**Work:**
- Add startup check in `CacheService` constructor: if `NODE_ENV === 'production'` and `REDIS_URL` is not set → throw (fail fast, do not silently fall back).
- Add test: production mode without `REDIS_URL` → constructor throws.
- Add test: Redis connection failure after startup → operations fall through to in-memory (acceptable for dev, logged as error in prod).
- Verify Lua scripts are correct under Redis Cluster (KEYS must hash to same slot) — document limitation if not cluster-safe.

**Acceptance criteria:**
- Production startup fails if `REDIS_URL` is absent.
- In-memory fallback is dev-only, not a silent production degradation.
- Cluster safety documented.

---

### 3.2 UsageMeteringService — Verify Redis Rate Limiter

**Current state:** `UsageMeteringService.ts` has Redis rate limiter helpers. **Gap:** audit whether any static `Map` fallback is still reachable in production paths.

**Work:**
- Audit `UsageMeteringService`: confirm per-tenant and global rate limits use Redis, not a static `Map`.
- If any `Map`-based path remains: replace with Redis-backed limiter or add production guard.
- Add test: rate limit enforced consistently across two simulated instances (shared Redis state).

**Acceptance criteria:**
- No `Map`-based rate limiting reachable in production.
- Rate limits are consistent across pods (Redis-backed).

---

### 3.3 Redis + NATS Startup Validation

**Current state:** Server starts without validating Redis or NATS connectivity. Workers fall back or warn on connection failure.

**Work:**
- Add startup probe in `server.ts` (production only): ping Redis before accepting traffic. If Redis is unreachable → log fatal + exit(1).
- Add startup probe for NATS/messaging: if `NATS_URL` is set and NATS is unreachable in production → log fatal + exit(1).
- Dev/test: probes are skipped or warn-only (controlled by `NODE_ENV`).
- Add health check endpoint extension: `GET /health` should include Redis and NATS connectivity status.

**Acceptance criteria:**
- Production startup fails fast if Redis is unreachable.
- `/health` reflects dependency status.
- Dev startup is unaffected.

---

### 3.4 Workflow Watchdog

**Current state:** No watchdog for stuck agent executions exists in `workerMain.ts` or elsewhere.

**Work:**
- Implement `WorkflowWatchdogWorker.ts` in `packages/backend/src/workers/`.
- BullMQ repeatable job: runs every 5 minutes.
- Logic: query `workflow_states` (or equivalent) for executions in `running` state older than a configurable threshold (default: 30 minutes).
- For each stuck execution: emit `workflow_stuck_detected_total` counter; attempt requeue if retryable; mark as `failed` with reason `watchdog_timeout` if not.
- Register in `workerMain.ts`.

**Acceptance criteria:**
- Stuck workflows detected within one watchdog interval.
- Detected workflows are either requeued or failed — no infinite hangs.
- Metric emitted on detection.

---

## Sprint 4 — CI/CD Trust + Test Integrity (P1)

### 4.1 TypeScript Debt Enforcement — Verify Strict Zones

**Current state:** `ts-error-ratchet.mjs` runs in `pr-fast.yml`. `ts-any-baseline.json` and `ts-debt-baseline.json` exist. **Gap:** audit whether the ratchet covers critical modules (billing, middleware, tenant services) with stricter thresholds.

**Work:**
- Audit `ts-error-ratchet.mjs`: confirm it fails CI if `any` count increases above baseline.
- Confirm `tsconfig.strict-zones.json` covers `packages/backend/src/services/billing/`, `packages/backend/src/middleware/`, and `packages/backend/src/services/tenant/`.
- If strict zones do not cover these paths: add them.
- Document the baseline update process in `CONTRIBUTING.md` (one paragraph).

**Acceptance criteria:**
- `any` count cannot increase in billing, middleware, or tenant modules without CI failure.
- Baseline update requires explicit PR step (not automatic).

---

### 4.2 E2E Test Stabilization + Integration Tests

**Current state:** `e2e-critical` lane exists in `pr-fast.yml`. `flake-gate` lane exists. **Gap:** no documented classification of which tests are blocking vs. tracked; flake threshold not confirmed; no end-to-end billing or isolation integration tests.

**Work:**
- Audit `scripts/ci/flake-gate.mjs`: confirm it tracks flake rate per test and fails if rate exceeds threshold.
- Set flake threshold to 2% (configurable via env or config file).
- Document in `docs/testing/` which E2E tests are in the blocking `e2e-critical` lane vs. tracked-only.
- Add integration test: webhook received → usage aggregated → Stripe event emitted (end-to-end billing flow).
- Add integration test: tenant A authenticated → cannot read tenant B data (end-to-end isolation).

**Acceptance criteria:**
- Flake rate < 2% enforced in CI.
- Blocking vs. tracked test classification is documented.
- Two new integration tests exist and run in CI.

---

### 4.3 Security Gate — CVE Waiver System

**Current state:** `pnpm audit --audit-level=high` and Trivy run in `pr-fast.yml`. **Gap:** no waiver system — a known, accepted CVE blocks all PRs with no way to document acceptance.

**Work:**
- Add `docs/security-compliance/cve-waivers.json` — schema: `[{ "id": "CVE-XXXX-XXXX", "package": "...", "accepted_by": "...", "expires": "YYYY-MM-DD", "justification": "..." }]`.
- Extend the security gate script (or add `scripts/ci/check-cve-waivers.mjs`) to: read active waivers, suppress waivered CVEs from the blocking list, fail if a waiver is expired.
- Fail CI on any Critical CVE not in the waiver list.
- Fail CI on any High CVE not in the waiver list (existing behavior — confirm it is enforced, not advisory).

**Acceptance criteria:**
- No known Critical CVE ships to production without an active waiver.
- Expired waivers block CI.
- Waiver file is auditable (in version control).

---

## Cross-Sprint Tasks (Parallel)

### X.1 DB Advisory Locks on Aggregation

**Work:**
- Audit `billingAggregatorWorker.ts`: confirm it uses Postgres advisory locks (or BullMQ job-level locking) to prevent concurrent aggregation for the same tenant/period.
- If not: add `pg_try_advisory_lock(tenant_hash)` before aggregation, release after.
- Add test: two concurrent aggregation jobs for the same tenant → one proceeds, one skips.

### X.2 Pre-Call Stripe Idempotency Key Validation

**Work:**
- Audit all Stripe API call sites: confirm idempotency keys are set on all mutating calls (`charges.create`, `subscriptions.create`, etc.).
- Add pre-call validation: if idempotency key is missing on a mutating call → throw in production, warn in dev.

### X.3 Documentation Updates

**Work:**
- Update `docs/AGENTS.md` RLS scope section to reflect the full audit findings from 2.1.
- Update or create `docs/infra/requirements.md` to document Redis and NATS as required production dependencies.
- Update webhook guarantee documentation to reflect idempotency constraint, DLQ, and reconciliation.

---

## Implementation Order

Tasks are ordered by risk and dependency. P0 items must be complete before P1 items begin.

**Phase 1 (P0 — do first):**
1. 1.1 — DB unique constraint migration (unblocks everything else in Sprint 1)
2. 2.1 — RLS full audit (establishes ground truth before CI gate)
3. 2.2 — CI RLS gate (locks in 2.1 findings)
4. 1.3 — DLQ observability + replay API
5. 2.3 / 2.4 / 2.5 — Middleware audit + security tests
6. 1.2 — Durable payload storage
7. 1.4 — Reconciliation job
8. 1.5 — Metrics + alerts

**Phase 2 (P1 — after P0 complete):**
9. 3.1 — CacheService production guard
10. 3.2 — UsageMeteringService Redis audit
11. 3.3 — Startup validation
12. 3.4 — Workflow watchdog
13. 4.1 — TypeScript strict zones
14. 4.2 — E2E stabilization + integration tests
15. 4.3 — CVE waiver system

**Parallel (any phase):**
- X.1 Advisory locks
- X.2 Stripe idempotency keys
- X.3 Documentation

---

## Definition of Done

The system is production-ready when:

| Area | Criterion |
|---|---|
| Billing | DB-level unique constraint on `stripe_event_id` |
| Billing | Raw payloads stored durably (inline or Supabase Storage pointer) |
| Billing | DLQ is observable and replayable via API |
| Billing | Reconciliation job runs on schedule, emits drift metrics |
| Billing | Six Prometheus metrics present; four alert rules active |
| Isolation | 100% tables RLS-covered or explicitly documented as exempt |
| Isolation | CI blocks new tables without RLS |
| Isolation | All five attack paths have automated test coverage |
| Distributed | Production startup fails if Redis is absent |
| Distributed | No `Map`-based shared state in production paths |
| Distributed | Stuck workflows detected and resolved within one watchdog interval |
| CI/CD | TypeScript `any` cannot increase in critical modules |
| CI/CD | Flake rate < 2% enforced |
| CI/CD | No Critical CVE ships without active waiver |
| CI/CD | Two new integration tests (billing flow + tenant isolation) in CI |
