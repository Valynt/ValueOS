# ADR-0019: Production Readiness Audit Controls (March 27, 2026)

- Status: Accepted
- Date: 2026-03-27
- Scope: Auth fallback controls, tenant isolation validation, billing safety, CI required checks, worker coordination, observability.

## Context

ValueOS completed a production readiness audit that identified critical controls requiring hardening and several validated controls requiring explicit ADR-level documentation.

## Decision

1. **Emergency auth fallback is retained as break-glass only** with mandatory structured audit events, Prometheus metric `auth_fallback_activations_total`, and immediate critical alerting.
2. **Auth fallback environment variable surface is controlled**:
   - `AUTH_FALLBACK_EMERGENCY_MODE`
   - `AUTH_FALLBACK_EMERGENCY_TTL_UNTIL`
   - `AUTH_FALLBACK_INCIDENT_ID`
   - `AUTH_FALLBACK_INCIDENT_SEVERITY`
   - `AUTH_FALLBACK_INCIDENT_STARTED_AT`
   - `AUTH_FALLBACK_ALLOWED_ROUTES`
   - `AUTH_FALLBACK_ALLOWED_ROLES`
   - `AUTH_FALLBACK_INCIDENT_CONTEXT_SIGNATURE`
   - `AUTH_FALLBACK_INCIDENT_SIGNING_SECRET`
   - `AUTH_FALLBACK_MAX_EMERGENCY_DURATION_SECONDS`
   - `AUTH_FALLBACK_ALERT_THRESHOLD`
   - `AUTH_FALLBACK_ALERT_WINDOW_SECONDS`
   - `ALLOW_LOCAL_JWT_FALLBACK` (explicitly forbidden in production)
3. **Tenant controls validated and documented**:
   - Tenant resolution chain in `tenantContext.ts`: TCT JWT → verified service header → user JWT claim → DB lookup, with conflict rejection.
   - DB transaction-scoped tenant context in `tenantDbContext.ts` via `SET LOCAL app.tenant_id` + RLS policies.
4. **CI now requires real Supabase integration lane** (`integration-supabase`) covering:
   - `security/rls-policies.test.ts` (mandatory multi-tenant RLS matrix).
   - `resiliency/advisory-lock-idempotency.test.ts`.
   - `integration/subscription-lifecycle.test.ts`.
   - `integration/quota-enforcement.test.ts`.
5. **Validated strong controls acknowledged**:
   - Webhook DB-constraint idempotency gate.
   - Transactional subscription change intent-log reference path.
   - Redis-backed billing rate-limit fail-open behavior.
   - OpenTelemetry bootstrap and auto-instrumentation.
   - CRM token encryption with AES-256-GCM envelope model.
   - SSRF/HMAC timing-safe verification in CRM provider integrations.
6. **Validated control crosswalk captured in this ADR (no separate ADR required)** with per-control implementation evidence:

| Control | Design rationale | Evidence pointers |
|---|---|---|
| AUTH-02 | Tenant resolution uses an explicit source-priority chain (TCT JWT → verified service header → user claim → DB lookup), rejects conflicts, and excludes route params as user-controlled input. | `packages/backend/src/middleware/tenantContext.ts`; `packages/backend/src/middleware/__tests__/tenantContext.test.ts` |
| AUTH-03 | RLS context is transaction-scoped using `SET LOCAL app.tenant_id` so tenant context auto-clears on commit/rollback and cannot bleed across pooled connections. | `packages/backend/src/middleware/tenantDbContext.ts`; `packages/backend/src/middleware/__tests__/tenantDbContext.integration.test.ts` |
| BILLING-04 | Stripe webhook idempotency is enforced by DB uniqueness (`stripe_event_id`) with conflict-safe insert semantics (`ON CONFLICT DO NOTHING`) rather than process-local memory state. | `packages/backend/src/services/billing/WebhookService.ts`; `packages/backend/src/services/billing/__tests__/WebhookService.idempotency-race.test.ts` |
| BILLING-05 | Subscription changes follow an intent-log/saga model (`pending_subscription_changes`) with explicit statuses and reconciliation paths for split-brain recovery. | `packages/backend/src/services/billing/SubscriptionService.transaction.ts`; `packages/backend/src/services/billing/__tests__/SubscriptionService.transaction.test.ts` |
| BILLING-08 | Billing rate limiting is Redis-backed with fail-open behavior when Redis is unavailable and optimistic locking to prevent duplicate submission races. | `packages/backend/src/services/billing/UsageMeteringService.ts`; `packages/backend/src/services/billing/__tests__/UsageMeteringService.redis-rate-limit.test.ts` |
| BILLING-09 | Billing exposes Prometheus counters/gauges for webhook receipt, processing outcomes, retries, failures, DLQ, reconciliation, and subscription rollback outcomes. | `packages/backend/src/metrics/billingMetrics.ts`; `infra/k8s/monitoring/billing-alerts.yaml` |
| RESIL-03 | Agent kill switches are backed by Redis key state so operators can disable specific agent types quickly without redeploying. | `packages/backend/src/services/agents/AgentKillSwitchService.ts`; `packages/backend/src/runtime/policy-engine/index.ts` |
| RESIL-04 | E2B sandbox execution is guarded by Zod input validation, unsafe-code blocklists, and bounded timeout/memory controls before provider execution. | `packages/backend/src/services/agents/SandboxedExecutor.ts`; `packages/backend/src/services/__tests__/SandboxedExecutor.test.ts` |
| WORKERS-03 | Webhook retry path uses BullMQ with deterministic job IDs and defined exponential backoff schedule for replay reliability and deduplication. | `packages/backend/src/workers/WebhookRetryWorker.ts`; `packages/backend/src/services/billing/WebhookRetryService.ts` |
| WORKERS-04 | Async worker processing is isolated into a dedicated Kubernetes `Deployment` and separately managed scaling policy. | `infra/k8s/base/worker-deployment.yaml`; `infra/k8s/base/kustomization.yaml` |
| OBS-01 | OpenTelemetry bootstrap uses Node auto-instrumentation, OTLP export, and default 10% production sample rate for cost-aware tracing. | `packages/backend/src/observability/tracing.ts`; `infra/k8s/base/backend-deployment.yaml` |
| CRYPTO-01 | CRM token storage uses AES-256-GCM envelope encryption with KEK/data-key version metadata and promotion/rotation workflows. | `packages/backend/src/services/crm/tokenEncryption.ts`; `packages/backend/src/services/crm/TokenReEncryptionJob.ts` |
| CRYPTO-02 | CRM providers enforce SSRF URL allowlists and timing-safe HMAC signature verification for HubSpot/Salesforce webhook integrity. | `packages/backend/src/services/crm/HubSpotProvider.ts`; `packages/backend/src/services/crm/SalesforceProvider.ts` |
| CICD-05 | Emergency deploy skip path is constrained to non-production and requires incident reference, reason, and post-deploy validation evidence fields. | `.github/workflows/deploy.yml`; `.github/workflows/README.md` |
| CICD-06 | PR gate inventory is codified in required-check policy and CI control matrix with `pr-fast` as the canonical merge blocker. | `.github/branch-protection/required-checks.json`; `.github/workflows/CI_CONTROL_MATRIX.md`; `.github/workflows/pr-fast.yml` |
| CICD-07 | Staging promotion enforces standardized k6 performance benchmarks and Cosign verification/signature checks before production progression. | `.github/workflows/deploy.yml`; `.github/workflows/release.yml` |

## Consequences

- Emergency fallback is auditable and immediately visible in monitoring.
- Merge-gate confidence for RLS and billing correctness increases due to real DB coverage.
- Audit evidence now includes explicit, durable rationale for previously implicit controls.
- WORKERS-02 closure is verified: no in-memory `processedWebhookIds`/`processWebhookTestOnly` path remains in `WebhookService`; DB idempotency is the sole production path.
